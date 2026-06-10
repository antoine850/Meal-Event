-- Recherche clients insensible aux accents, a la casse et aux espaces superflus.
-- Etend le principe de search_companies (20260608) aux contacts et bookings,
-- et tokenise le terme : chaque mot doit apparaitre, ordre et espaces libres.

-- chaque mot du terme apparait dans le texte, ordre libre
create or replace function public.matches_all_words(haystack text, search text)
returns boolean
language sql
immutable
parallel safe
as $$
  select bool_and(
    public.f_unaccent(coalesce(haystack, '')) ilike '%' || w || '%'
  )
  from unnest(
    regexp_split_to_array(trim(public.f_unaccent(coalesce(search, ''))), '\s+')
  ) as w
$$;

create or replace function public.search_contacts(
  search text default '',
  org uuid default null,
  lim int default 50
)
returns setof public.contacts
language sql
stable
as $$
  select c.*
  from public.contacts c
  left join public.companies co on co.id = c.company_id
  where (org is null or c.organization_id = org)
    and (
      coalesce(trim(search), '') = ''
      or public.matches_all_words(
        concat_ws(' ', c.first_name, c.last_name, c.email, co.name),
        search
      )
    )
  order by c.first_name, c.last_name
  limit greatest(1, least(coalesce(lim, 50), 200))
$$;

grant execute on function public.search_contacts(text, uuid, int) to anon, authenticated;

-- ids des bookings correspondant a une recherche par client / contact sur place /
-- type d'evenement / restaurant ; le frontend refait ensuite un .in('id', ...)
create or replace function public.search_booking_ids(
  search text default '',
  org uuid default null,
  lim int default 1000
)
returns table(id uuid)
language sql
stable
as $$
  select b.id
  from public.bookings b
  left join public.contacts c on c.id = b.contact_id
  left join public.restaurants r on r.id = b.restaurant_id
  where (org is null or b.organization_id = org)
    and coalesce(trim(search), '') <> ''
    and public.matches_all_words(
      concat_ws(' ', c.first_name, c.last_name, c.email,
                b.contact_sur_place_nom, b.contact_sur_place_societe,
                b.event_type, r.name),
      search
    )
  order by b.event_date desc
  limit greatest(1, least(coalesce(lim, 1000), 2000))
$$;

grant execute on function public.search_booking_ids(text, uuid, int) to anon, authenticated;

-- search_companies tokenisee : "jean  dupont" (double espace) ou "dupont jean"
-- matche desormais "Jean Dupont"
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
      coalesce(trim(search), '') = ''
      or public.matches_all_words(c.name, search)
    )
  order by c.name
  limit greatest(1, least(coalesce(lim, 50), 200))
$$;
