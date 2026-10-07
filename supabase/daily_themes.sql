-- Daily Caption Battle theme, generated from what's trending on X in New York.
-- Safe to re-run.

create table if not exists public.daily_themes (
  day date primary key, -- the New York calendar day
  theme text not null,
  idea text, -- one-line photo suggestion shown under the theme
  trend text, -- the trending topic that inspired it
  source text not null, -- 'x' (via trends24.in), 'google-trends', or 'fallback'
  trends jsonb not null default '[]', -- the ranked trend list the model chose from
  prompt text,
  model text,
  created_at timestamptz not null default now()
);

alter table public.daily_themes enable row level security;

drop policy if exists "Themes are public" on public.daily_themes;
create policy "Themes are public"
  on public.daily_themes for select
  to anon, authenticated
  using (true);

-- Writes come only from the daily cron job, which logs in as theme_writer:
-- a role that can touch this one table and nothing else. Create it once with
--   create role theme_writer login password '<secret>' noinherit;
-- (the password is kept out of this file and stored as THEME_WRITER_DB_URL).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'theme_writer') then
    grant usage on schema public to theme_writer;
    grant select, insert, update on public.daily_themes to theme_writer;
  end if;
end;
$$;

drop policy if exists "Theme writer manages themes" on public.daily_themes;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'theme_writer') then
    create policy "Theme writer manages themes"
      on public.daily_themes for all
      to theme_writer
      using (true)
      with check (true);
  end if;
end;
$$;
