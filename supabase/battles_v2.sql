-- PM feedback round: one caption per photo (picked by the uploader in a
-- bracket), post-vs-post battles as the single community vote, owner-only
-- remixes, at most 4 captions per photo, and caption battles only on the
-- daily AI meme. Safe to re-run. Apply after quick_vote_remix_daily.sql.

-- ===========================================================================
-- 1. Posts: drafts until the uploader picks a caption, then one caption each,
--    plus a battle record.
-- ===========================================================================

alter table public.generations add column if not exists status text not null default 'published';
alter table public.generations add column if not exists caption_id uuid references public.captions (id) on delete set null;
alter table public.generations add column if not exists published_at timestamptz;
alter table public.generations add column if not exists battle_wins integer not null default 0;
alter table public.generations add column if not exists battle_losses integer not null default 0;

do $$
begin
  alter table public.generations drop constraint if exists generations_status_check;
  alter table public.generations add constraint generations_status_check check (status in ('draft', 'published'));
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'generations' and column_name = 'battle_rating'
  ) then
    -- Win rate with one imaginary win and loss, so a 1-0 post doesn't outrank a 9-1 post.
    alter table public.generations add column battle_rating numeric
      generated always as ((battle_wins + 1)::numeric / (battle_wins + battle_losses + 2)) stored;
  end if;
end;
$$;

create index if not exists generations_board_idx
  on public.generations (kind, status, battle_rating desc, published_at desc);

-- Existing member posts keep their best caption; everything already posted is published.
update public.generations g
   set caption_id = (
         select c.id from public.captions c
          where c.generation_id = g.id
          order by c.score desc, c.position
          limit 1
       )
 where g.kind = 'member' and g.caption_id is null;

update public.generations set published_at = coalesce(published_at, created_at) where status = 'published';

-- New posts: members start as drafts with no caption chosen; daily posts go live immediately.
create or replace function public.stamp_generation_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.caption_id := null;
  new.battle_wins := 0;
  new.battle_losses := 0;

  if auth.uid() is null then
    if new.kind is distinct from 'daily' then
      raise exception 'only daily posts can be created without a signed-in user';
    end if;
    new.user_id := null;
    new.status := 'published';
    new.published_at := now();
    new.author_name := coalesce(new.author_name, 'Punchline AI');
    return new;
  end if;

  new.user_id := auth.uid();
  new.kind := 'member';
  new.status := 'draft';
  new.published_at := null;
  new.daily_for := null;
  new.photo_credit := null;
  new.photo_source_url := null;
  select nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(left(p.last_name, 1) || '.', '')), '')
    into new.author_name
    from public.profiles p
   where p.id = auth.uid();
  return new;
end;
$$;

-- Members may only change which caption is chosen and publish; everything else is server-owned.
revoke update on public.generations from anon, authenticated;
grant update (caption_id, status) on public.generations to authenticated;

create or replace function public.guard_generation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.caption_id is not null and not exists (
    select 1 from public.captions c where c.id = new.caption_id and c.generation_id = new.id
  ) then
    raise exception 'that caption belongs to a different post';
  end if;
  if new.kind = 'member' and new.status = 'published' and new.caption_id is null then
    raise exception 'pick a caption before publishing';
  end if;
  if old.status = 'published' and new.status = 'draft' then
    raise exception 'a published post cannot go back to draft';
  end if;
  if old.status = 'draft' and new.status = 'published' then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists guard_generation_update on public.generations;
create trigger guard_generation_update
  before update on public.generations
  for each row execute function public.guard_generation_update();

-- ===========================================================================
-- 2. Captions: at most 4 per photo at any time; remixes can repeat forever
--    because losing captions are deleted.
-- ===========================================================================

do $$
begin
  alter table public.captions drop constraint if exists captions_position_range;
  alter table public.captions add constraint captions_position_range
    check (position >= 1 and (remix_id is not null or position <= 4));
end;
$$;

create or replace function public.cap_captions_per_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.captions where generation_id = new.generation_id) >= 4 then
    raise exception 'a photo can have at most 4 captions';
  end if;
  return new;
end;
$$;

drop trigger if exists cap_captions_per_post on public.captions;
create trigger cap_captions_per_post
  before insert on public.captions
  for each row execute function public.cap_captions_per_post();

-- ===========================================================================
-- 3. Post-vs-post battles: the community vote.
-- ===========================================================================

create table if not exists public.post_battles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  post_a uuid not null references public.generations (id) on delete cascade,
  post_b uuid not null references public.generations (id) on delete cascade,
  winner uuid not null references public.generations (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (post_a < post_b),
  check (winner in (post_a, post_b)),
  unique (user_id, post_a, post_b) -- each member judges a given matchup once
);

create index if not exists post_battles_user_created_idx on public.post_battles (user_id, created_at desc);

create or replace function public.tally_post_battle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.generations set battle_wins = battle_wins + 1 where id = new.winner;
  update public.generations set battle_losses = battle_losses + 1
   where id = case when new.winner = new.post_a then new.post_b else new.post_a end;
  return null;
end;
$$;

drop trigger if exists tally_post_battle on public.post_battles;
create trigger tally_post_battle
  after insert on public.post_battles
  for each row execute function public.tally_post_battle();

-- ===========================================================================
-- 4. Row level security.
-- ===========================================================================

alter table public.post_battles enable row level security;

-- Posts: everyone signed in sees published posts; drafts are private to their owner.
drop policy if exists "Members read posts" on public.generations;
create policy "Members read posts"
  on public.generations for select
  to authenticated
  using (status = 'published' or user_id = (select auth.uid()));

drop policy if exists "Members finish their own posts" on public.generations;
create policy "Members finish their own posts"
  on public.generations for update
  to authenticated
  using (user_id = (select auth.uid()) and kind = 'member')
  with check (user_id = (select auth.uid()) and kind = 'member');

-- Captions: others only see a post's chosen caption (and the daily meme's captions);
-- owners also see their candidates while picking.
drop policy if exists "Members read captions" on public.captions;
create policy "Members read captions"
  on public.captions for select
  to authenticated
  using (
    exists (
      select 1 from public.generations g
       where g.id = generation_id
         and (g.user_id = (select auth.uid()) or g.kind = 'daily' or g.caption_id = captions.id)
    )
  );

drop policy if exists "Members add captions to their own new post or remix" on public.captions;
create policy "Members add captions to their own new post or remix"
  on public.captions for insert
  to authenticated
  with check (
    upvotes = 0 and downvotes = 0 and duel_wins = 0 and duel_losses = 0
    and (
      (
        remix_id is null
        and exists (
          select 1 from public.generations g
           where g.id = generation_id
             and g.user_id = (select auth.uid())
             and g.status = 'draft'
             and g.created_at > now() - interval '10 minutes'
        )
      )
      or (
        remix_id is not null
        and exists (
          select 1 from public.caption_remixes r
            join public.generations g on g.id = r.generation_id
           where r.id = remix_id
             and r.generation_id = captions.generation_id
             and r.user_id = (select auth.uid())
             and g.user_id = (select auth.uid())
             and r.created_at > now() - interval '10 minutes'
        )
      )
    )
  );

-- Owners clear out the captions that lost their bracket (never the chosen one).
drop policy if exists "Owners clear losing captions" on public.captions;
create policy "Owners clear losing captions"
  on public.captions for delete
  to authenticated
  using (
    exists (
      select 1 from public.generations g
       where g.id = generation_id
         and g.user_id = (select auth.uid())
         and g.kind = 'member'
         and g.caption_id is distinct from captions.id
    )
  );

-- Remix: only the person who posted the photo, as often as they like (20 a day keeps AI costs sane).
drop policy if exists "Members remix posts within limits" on public.caption_remixes;
drop policy if exists "Owners remix their own posts" on public.caption_remixes;
create policy "Owners remix their own posts"
  on public.caption_remixes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.my_remixes_today()) < 20
    and exists (
      select 1 from public.generations g
       where g.id = generation_id
         and g.user_id = (select auth.uid())
         and g.kind = 'member'
         and g.status = 'published'
    )
  );

-- Caption-vs-caption duels now only happen on the daily AI meme.
drop policy if exists "Members judge other people's captions" on public.caption_duels;
drop policy if exists "Members judge the daily meme's captions" on public.caption_duels;
create policy "Members judge the daily meme's captions"
  on public.caption_duels for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.captions a
        join public.captions b on b.generation_id = a.generation_id
        join public.generations g on g.id = a.generation_id
       where a.id = caption_a
         and b.id = caption_b
         and g.id = caption_duels.generation_id
         and g.kind = 'daily'
    )
  );

-- Post battles: private to the judge; two different published member posts, neither your own.
drop policy if exists "Members see their own battles" on public.post_battles;
create policy "Members see their own battles"
  on public.post_battles for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Members judge other people's posts" on public.post_battles;
create policy "Members judge other people's posts"
  on public.post_battles for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      select count(*) from public.generations g
       where g.id in (post_a, post_b)
         and g.kind = 'member'
         and g.status = 'published'
         and g.caption_id is not null
         and g.user_id <> (select auth.uid())
    ) = 2
  );

-- ===========================================================================
-- 5. What signed-out visitors (and link previews) see: published posts with
--    their one caption, at most 3 at a time.
-- ===========================================================================

drop function if exists public.battle_preview(uuid, timestamptz, integer);
drop function if exists public.battle_preview(uuid, timestamptz, integer, text);
create function public.battle_preview(
  p_post uuid default null,
  p_since timestamptz default null,
  p_limit integer default 3,
  p_kind text default 'member'
)
returns table (
  id uuid,
  kind text,
  image_url text,
  theme text,
  voice text,
  author_name text,
  published_at timestamptz,
  caption text,
  caption_count integer,
  battle_wins integer,
  battle_losses integer,
  photo_credit text,
  photo_source_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.kind, g.image_url, g.theme, g.voice, g.author_name, g.published_at,
         coalesce(chosen.text, best.text),
         (select count(*)::int from public.captions x where x.generation_id = g.id),
         g.battle_wins, g.battle_losses, g.photo_credit, g.photo_source_url
    from public.generations g
    left join public.captions chosen on chosen.id = g.caption_id
    left join lateral (
      select c.text from public.captions c
       where c.generation_id = g.id
       order by c.score desc, c.position
       limit 1
    ) best on true
   where g.status = 'published'
     and (p_post is not null or p_kind is null or g.kind = p_kind)
     and (p_post is null or g.id = p_post)
     and (p_since is null or g.published_at >= p_since)
   order by g.battle_rating desc, g.top_score desc, g.published_at desc
   limit least(greatest(coalesce(p_limit, 3), 1), 3);
$$;

revoke execute on function public.battle_preview(uuid, timestamptz, integer, text) from public;
grant execute on function public.battle_preview(uuid, timestamptz, integer, text) to anon, authenticated;

-- ===========================================================================
-- 6. Data fix: older daily posts used Openverse photos; credit the source now
--    that the page shows the credit text as-is.
-- ===========================================================================

update public.generations
   set photo_credit = photo_credit || ' · via Openverse'
 where kind = 'daily'
   and image_path like 'openverse:%'
   and photo_credit is not null
   and photo_credit not like '%Openverse%';
