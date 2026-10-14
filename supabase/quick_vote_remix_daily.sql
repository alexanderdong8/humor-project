-- Quick Vote (head-to-head), Remix, and the daily AI photo post.
-- Safe to re-run. Apply after captions.sql and battle_gating.sql.

-- ===========================================================================
-- 1. Caption columns: remix link, head-to-head tallies, and a score that
--    counts both up/down votes and head-to-head wins.
-- ===========================================================================

create table if not exists public.caption_remixes (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mood text not null check (mood in ('meaner', 'funnier', 'relatable')),
  prompt text not null, -- the exact text prompt sent to the model
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists caption_remixes_generation_idx on public.caption_remixes (generation_id);
create index if not exists caption_remixes_user_created_idx on public.caption_remixes (user_id, created_at desc);

alter table public.captions add column if not exists remix_id uuid references public.caption_remixes (id) on delete cascade;
alter table public.captions add column if not exists duel_wins integer not null default 0;
alter table public.captions add column if not exists duel_losses integer not null default 0;

-- Originals are positions 1-4; remixes add more after them.
do $$
begin
  alter table public.captions drop constraint if exists captions_position_check;
  alter table public.captions drop constraint if exists captions_position_range;
  alter table public.captions add constraint captions_position_range
    check (position between 1 and 40 and (remix_id is not null or position <= 4));
end;
$$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'captions' and column_name = 'score'
       and generation_expression ilike '%duel_wins%'
  ) then
    drop index if exists public.captions_score_idx;
    alter table public.captions drop column if exists score;
    alter table public.captions add column score integer generated always as (upvotes - downvotes + duel_wins) stored;
    create index captions_score_idx on public.captions (score desc, created_at desc);
  end if;
end;
$$;

-- ===========================================================================
-- 2. Daily AI posts: no member owns them; the nightly job creates one per day.
-- ===========================================================================

alter table public.generations alter column user_id drop not null;
alter table public.generations add column if not exists kind text not null default 'member';
alter table public.generations add column if not exists daily_for date;
alter table public.generations add column if not exists photo_credit text; -- attribution for openly licensed photos
alter table public.generations add column if not exists photo_source_url text;

do $$
begin
  alter table public.generations drop constraint if exists generations_kind_check;
  alter table public.generations add constraint generations_kind_check check (
    (kind = 'member' and user_id is not null and daily_for is null)
    or (kind = 'daily' and user_id is null and daily_for is not null)
  );
end;
$$;

create unique index if not exists generations_daily_for_key on public.generations (daily_for) where daily_for is not null;

-- Members' posts are always stamped with their own id and name. Inserts with
-- no signed-in user (only the daily job's role is allowed to make them) must
-- be daily posts.
create or replace function public.stamp_generation_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    if new.kind is distinct from 'daily' then
      raise exception 'only daily posts can be created without a signed-in user';
    end if;
    new.user_id := null;
    new.author_name := coalesce(new.author_name, 'Punchline AI');
    return new;
  end if;

  new.user_id := auth.uid();
  new.kind := 'member';
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

-- ===========================================================================
-- 3. Tallies: one place recomputes a post's best score; votes and duels use it.
-- ===========================================================================

create or replace function public.refresh_top_score(p_generation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.generations g
     set top_score = coalesce((select max(c.score) from public.captions c where c.generation_id = g.id), 0)
   where g.id = p_generation;
$$;

revoke execute on function public.refresh_top_score(uuid) from public, anon, authenticated;

create or replace function public.tally_caption_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.captions
       set upvotes = upvotes - (old.value = 1)::int,
           downvotes = downvotes - (old.value = -1)::int
     where id = old.caption_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.captions
       set upvotes = upvotes + (new.value = 1)::int,
           downvotes = downvotes + (new.value = -1)::int
     where id = new.caption_id;
  end if;
  perform public.refresh_top_score(
    (select generation_id from public.captions where id = coalesce(new.caption_id, old.caption_id))
  );
  return null;
end;
$$;

-- ===========================================================================
-- 4. Quick Vote: each pick between two captions on the same post is a row.
-- ===========================================================================

create table if not exists public.caption_duels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  generation_id uuid not null references public.generations (id) on delete cascade,
  caption_a uuid not null references public.captions (id) on delete cascade,
  caption_b uuid not null references public.captions (id) on delete cascade,
  winner uuid not null references public.captions (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (caption_a < caption_b),
  check (winner in (caption_a, caption_b)),
  unique (user_id, caption_a, caption_b) -- each member judges a given pair once
);

create index if not exists caption_duels_user_created_idx on public.caption_duels (user_id, created_at desc);
create index if not exists caption_duels_generation_idx on public.caption_duels (generation_id);

create or replace function public.tally_caption_duel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.captions set duel_wins = duel_wins + 1 where id = new.winner;
  update public.captions set duel_losses = duel_losses + 1
   where id = case when new.winner = new.caption_a then new.caption_b else new.caption_a end;
  perform public.refresh_top_score(new.generation_id);
  return null;
end;
$$;

drop trigger if exists tally_caption_duel on public.caption_duels;
create trigger tally_caption_duel
  after insert on public.caption_duels
  for each row execute function public.tally_caption_duel();

-- ===========================================================================
-- 5. Remix limits (checked by RLS).
-- ===========================================================================

create or replace function public.my_remixes_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.caption_remixes
   where user_id = auth.uid() and created_at > now() - interval '24 hours';
$$;

create or replace function public.remix_count(p_generation uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.caption_remixes where generation_id = p_generation;
$$;

revoke execute on function public.my_remixes_today() from public, anon;
revoke execute on function public.remix_count(uuid) from public, anon;
grant execute on function public.my_remixes_today() to authenticated;
grant execute on function public.remix_count(uuid) to authenticated;

-- ===========================================================================
-- 6. Row level security.
-- ===========================================================================

alter table public.caption_remixes enable row level security;
alter table public.caption_duels enable row level security;

-- Members' own posts only (never a daily post, never a pre-scored one).
drop policy if exists "Members create their own posts, 10 per day" on public.generations;
create policy "Members create their own posts, 10 per day"
  on public.generations for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and kind = 'member'
    and top_score = 0
    and image_path like (select auth.uid())::text || '/%'
    and (select public.my_generations_today()) < 10
  );

-- Captions: originals onto your own fresh post, or remix captions from a
-- remix you just made. Tallies always start at zero.
drop policy if exists "Members add captions to their own new post" on public.captions;
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
             and g.created_at > now() - interval '10 minutes'
        )
      )
      or (
        remix_id is not null
        and exists (
          select 1 from public.caption_remixes r
           where r.id = remix_id
             and r.generation_id = captions.generation_id
             and r.user_id = (select auth.uid())
             and r.created_at > now() - interval '10 minutes'
        )
      )
    )
  );

-- Remixes: members can see them (to label remix captions) and make their own,
-- 20 a day and 6 per post.
drop policy if exists "Members see remixes" on public.caption_remixes;
create policy "Members see remixes"
  on public.caption_remixes for select
  to authenticated
  using (true);

drop policy if exists "Members remix posts within limits" on public.caption_remixes;
create policy "Members remix posts within limits"
  on public.caption_remixes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.my_remixes_today()) < 20
    and public.remix_count(generation_id) < 6
  );

-- Duels: private to the judge; only pairs from the same post, never your own post.
drop policy if exists "Members see their own duels" on public.caption_duels;
create policy "Members see their own duels"
  on public.caption_duels for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Members judge other people's captions" on public.caption_duels;
create policy "Members judge other people's captions"
  on public.caption_duels for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.captions a
        join public.captions b on b.generation_id = a.generation_id
       where a.id = caption_a
         and b.id = caption_b
         and a.generation_id = caption_duels.generation_id
    )
    and not exists (
      select 1 from public.generations g
       where g.id = caption_duels.generation_id
         and g.user_id = (select auth.uid())
    )
  );

-- The nightly job (theme_writer role) may create the daily AI post and its
-- captions, and read daily posts back. Nothing else.
grant select, insert on public.generations to theme_writer;
grant select, insert on public.captions to theme_writer;

drop policy if exists "Daily job reads daily posts" on public.generations;
create policy "Daily job reads daily posts"
  on public.generations for select
  to theme_writer
  using (kind = 'daily');

drop policy if exists "Daily job creates daily posts" on public.generations;
create policy "Daily job creates daily posts"
  on public.generations for insert
  to theme_writer
  with check (kind = 'daily' and user_id is null and top_score = 0);

drop policy if exists "Daily job captions daily posts" on public.captions;
create policy "Daily job captions daily posts"
  on public.captions for insert
  to theme_writer
  with check (
    remix_id is null
    and upvotes = 0 and downvotes = 0 and duel_wins = 0 and duel_losses = 0
    and exists (select 1 from public.generations g where g.id = generation_id and g.kind = 'daily')
  );

-- ===========================================================================
-- 7. Signed-out preview now says whether a post is the daily AI photo.
-- ===========================================================================

drop function if exists public.battle_preview(uuid, timestamptz, integer);
create function public.battle_preview(
  p_post uuid default null,
  p_since timestamptz default null,
  p_limit integer default 3
)
returns table (
  id uuid,
  image_url text,
  theme text,
  voice text,
  author_name text,
  created_at timestamptz,
  top_caption text,
  top_score integer,
  caption_count integer,
  kind text,
  photo_credit text,
  photo_source_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.image_url, g.theme, g.voice, g.author_name, g.created_at,
         best.text, g.top_score,
         (select count(*)::int from public.captions x where x.generation_id = g.id),
         g.kind, g.photo_credit, g.photo_source_url
    from public.generations g
    left join lateral (
      select c.text from public.captions c
       where c.generation_id = g.id
       order by c.score desc, c.position
       limit 1
    ) best on true
   where (p_post is null or g.id = p_post)
     and (p_since is null or g.created_at >= p_since)
   order by g.top_score desc, g.created_at desc
   limit least(greatest(coalesce(p_limit, 3), 1), 3);
$$;

revoke execute on function public.battle_preview(uuid, timestamptz, integer) from public;
grant execute on function public.battle_preview(uuid, timestamptz, integer) to anon, authenticated;
