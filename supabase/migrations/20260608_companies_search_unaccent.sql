-- Recherche de societes insensible aux accents et a la casse
-- Utilisee par la RPC search_companies (combobox facturation, recherche globale)

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- wrapper immutable indispensable pour indexer / utiliser unaccent dans une expression
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select public.unaccent('public.unaccent'::regdictionary, $1)
$$;

create index if not exists idx_companies_name_unaccent
  on public.companies using gin (public.f_unaccent(name) gin_trgm_ops);

create or replace function public.search_companies(
  search text default '',
  org uuid default null,
  lim int default 50
)
returns setof public.companies
language sql
stable
as $$
  select c.*
  from public.companies c
  where (org is null or c.organization_id = org)
    and (
      coalesce(search, '') = ''
      or public.f_unaccent(c.name) ilike '%' || public.f_unaccent(search) || '%'
    )
  order by c.name
  limit greatest(1, least(coalesce(lim, 50), 200))
$$;

grant execute on function public.search_companies(text, uuid, int) to anon, authenticated;
