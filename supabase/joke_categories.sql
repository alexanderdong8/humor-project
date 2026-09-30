-- Category list with counts for the home page and the library filter.
-- security_invoker makes the view respect the jokes table's RLS.
create or replace view public.joke_categories
with (security_invoker = true) as
select category, count(*)::int as joke_count
from public.jokes
where category is not null
group by category
order by category;

grant select on public.joke_categories to anon, authenticated;
