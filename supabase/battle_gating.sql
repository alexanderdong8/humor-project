-- Members-only Caption Battle: signed-out visitors get a small preview, not the board.
-- Safe to re-run. Apply after captions.sql.

-- 1. Only signed-in members can read posts and captions directly.
drop policy if exists "Posts are public" on public.generations;
drop policy if exists "Members read posts" on public.generations;
create policy "Members read posts"
  on public.generations for select
  to authenticated
  using (true);

drop policy if exists "Captions are public" on public.captions;
drop policy if exists "Members read captions" on public.captions;
create policy "Members read captions"
  on public.captions for select
  to authenticated
  using (true);

-- 2. The preview everyone (including signed-out visitors and link unfurlers)
--    can see: at most 3 posts, each with only its winning caption and how
--    many more captions are hidden. No voters, no other captions.
create or replace function public.battle_preview(
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
  caption_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.image_url, g.theme, g.voice, g.author_name, g.created_at,
         best.text, g.top_score,
         (select count(*)::int from public.captions x where x.generation_id = g.id)
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
