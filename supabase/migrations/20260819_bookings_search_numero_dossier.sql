-- Ajoute le numero de dossier (agences) et le nom de la societe du contact
-- aux champs couverts par la recherche de bookings.
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
  left join public.companies co on co.id = c.company_id
  left join public.restaurants r on r.id = b.restaurant_id
  where (org is null or b.organization_id = org)
    and coalesce(trim(search), '') <> ''
    and public.matches_all_words(
      concat_ws(' ', c.first_name, c.last_name, c.email, co.name,
                b.contact_sur_place_nom, b.contact_sur_place_societe,
                b.event_type, b.occasion, b.numero_dossier, r.name),
      search
    )
  order by b.event_date desc
  limit greatest(1, least(coalesce(lim, 1000), 2000))
$$;
