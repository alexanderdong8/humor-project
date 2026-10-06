-- AI caption battles: photo posts, AI-written captions, and per-user votes.
-- Safe to re-run.

-- 1. Posts: one uploaded photo plus the exact prompt sent to the model.
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text, -- "First L.", filled in by a trigger so feeds never read profiles
  image_path text not null, -- object path in the caption-photos bucket; the bytes live in Storage
  image_url text not null,
  theme text,
  voice text not null,
  prompt text not null,
  model text not null,
  top_score integer not null default 0, -- best caption score, kept current by the vote trigger
  created_at timestamptz not null default now()
);

alter table public.generations add column if not exists top_score integer not null default 0;

create index if not exists generations_top_score_idx on public.generations (top_score desc, created_at desc);
create index if not exists generations_created_at_idx on public.generations (created_at desc);
create index if not exists generations_user_created_idx on public.generations (user_id, created_at desc);

-- 2. Captions: up to four per post. Vote tallies are maintained by a trigger.
create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations (id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  text text not null check (char_length(text) between 1 and 280),
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  score integer generated always as (upvotes - downvotes) stored,
  created_at timestamptz not null default now(),
  unique (generation_id, position)
);

create index if not exists captions_generation_idx on public.captions (generation_id);
create index if not exists captions_score_idx on public.captions (score desc, created_at desc);

-- 3. Votes: one row per (caption, user). +1 or -1.
create table if not exists public.caption_votes (
  caption_id uuid not null references public.captions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (caption_id, user_id)
);

create index if not exists caption_votes_user_idx on public.caption_votes (user_id);

-- 4. Triggers.

-- Stamp the author from the caller's own profile; clients can't spoof either field.
create or replace function public.stamp_generation_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  select nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(left(p.last_name, 1) || '.', '')), '')
    into new.author_name
    from public.profiles p
   where p.id = auth.uid();
  return new;
end;
$$;

drop trigger if exists stamp_generation_author on public.generations;
create trigger stamp_generation_author
  before insert on public.generations
  for each row execute function public.stamp_generation_author();

-- Keep captions.upvotes / downvotes in sync with caption_votes.
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
  update public.generations g
     set top_score = coalesce((select max(c.score) from public.captions c where c.generation_id = g.id), 0)
   where g.id = (select generation_id from public.captions where id = coalesce(new.caption_id, old.caption_id));
  return null;
end;
$$;

drop trigger if exists tally_caption_vote on public.caption_votes;
create trigger tally_caption_vote
  after insert or update or delete on public.caption_votes
  for each row execute function public.tally_caption_vote();

-- How many posts the caller has made in the last 24 hours (for the daily cap).
create or replace function public.my_generations_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
    from public.generations
   where user_id = auth.uid()
     and created_at > now() - interval '24 hours';
$$;

revoke execute on function public.my_generations_today() from public, anon;
grant execute on function public.my_generations_today() to authenticated;

-- 5. Row level security: the strictest rules the app can run on.
alter table public.generations enable row level security;
alter table public.captions enable row level security;
alter table public.caption_votes enable row level security;

-- generations: public feed; members post (10 per day) and delete only their own.
drop policy if exists "Posts are public" on public.generations;
create policy "Posts are public"
  on public.generations for select
  to anon, authenticated
  using (true);

drop policy if exists "Members create their own posts, 10 per day" on public.generations;
create policy "Members create their own posts, 10 per day"
  on public.generations for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and top_score = 0
    and image_path like (select auth.uid())::text || '/%'
    and (select public.my_generations_today()) < 10
  );

drop policy if exists "Members delete their own posts" on public.generations;
create policy "Members delete their own posts"
  on public.generations for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- captions: public; inserted only onto your own fresh post, with zeroed tallies.
drop policy if exists "Captions are public" on public.captions;
create policy "Captions are public"
  on public.captions for select
  to anon, authenticated
  using (true);

drop policy if exists "Members add captions to their own new post" on public.captions;
create policy "Members add captions to their own new post"
  on public.captions for insert
  to authenticated
  with check (
    upvotes = 0
    and downvotes = 0
    and exists (
      select 1 from public.generations g
       where g.id = generation_id
         and g.user_id = (select auth.uid())
         and g.created_at > now() - interval '10 minutes'
    )
  );

-- caption_votes: private to the voter; tallies are the only public signal.
drop policy if exists "Members see their own votes" on public.caption_votes;
create policy "Members see their own votes"
  on public.caption_votes for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Members cast their own votes" on public.caption_votes;
create policy "Members cast their own votes"
  on public.caption_votes for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Members change their own votes" on public.caption_votes;
create policy "Members change their own votes"
  on public.caption_votes for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Members take back their own votes" on public.caption_votes;
create policy "Members take back their own votes"
  on public.caption_votes for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- 6. Photo storage: public to view, each member writes only to their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('caption-photos', 'caption-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members upload their own caption photos" on storage.objects;
create policy "Members upload their own caption photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'caption-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- The server downloads the photo with the member's session to send it to the model.
drop policy if exists "Members read their own caption photos" on storage.objects;
create policy "Members read their own caption photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'caption-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Members delete their own caption photos" on storage.objects;
create policy "Members delete their own caption photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'caption-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
