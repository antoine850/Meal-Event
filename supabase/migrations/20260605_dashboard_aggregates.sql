-- RPC d'agregation dashboard (P1 + P2 partie numerique).
-- SECURITY INVOKER : derive org/role/restaurants de auth.uid(), ne fait JAMAIS confiance
-- a un org_id passe par le client. Reproduit le scoping restaurant des roles non-admin.
-- RLS etant desactivee en prod, l'isolation repose sur le filtre organization_id derive ici.
--
-- Fidelite : constantes de slugs et logique de montants repliquent
-- src/features/dashboard/hooks/use-dashboard-data.ts (getSignedQuoteTtc, getPipelineQuoteTtc,
-- getPaidAmount, SIGNED_SLUGS, CONFIRMED_SLUGS, SIGNED_QUOTE_STATUSES).

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper : ids des bookings du scope courant apres application des filtres dashboard.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._dashboard_booking_ids(
  p_from_event  date default null,
  p_to_event    date default null,
  p_from_sign   date default null,
  p_to_sign     date default null,
  p_from_import date default null,
  p_to_import   date default null,
  p_restaurants uuid[] default null,
  p_statuses    uuid[] default null,
  p_commercials uuid[] default null,
  p_client_type text   default null
)
returns table(id uuid)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role text;
  v_restaurants uuid[];
begin
  select u.organization_id, r.slug
    into v_org, v_role
  from public.users u
  left join public.roles r on r.id = u.role_id
  where u.id = v_uid;

  if v_org is null then
    return;
  end if;

  select coalesce(array_agg(ur.restaurant_id) filter (where ur.restaurant_id is not null), '{}')
    into v_restaurants
  from public.user_restaurants ur
  where ur.user_id = v_uid;

  if coalesce(v_role, '') <> 'admin' and coalesce(array_length(v_restaurants, 1), 0) = 0 then
    return;
  end if;

  return query
  select b.id
  from public.bookings b
  where b.organization_id = v_org
    and (coalesce(v_role, '') = 'admin' or b.restaurant_id = any(v_restaurants))
    and (p_from_event  is null or b.event_date >= p_from_event)
    and (p_to_event    is null or b.event_date <= p_to_event)
    and (p_from_import is null or b.created_at >= p_from_import::timestamptz)
    and (p_to_import   is null or b.created_at <  (p_to_import + 1)::timestamptz)
    and (p_restaurants is null or cardinality(p_restaurants) = 0 or b.restaurant_id = any(p_restaurants))
    and (p_statuses    is null or cardinality(p_statuses) = 0    or b.status_id = any(p_statuses))
    and (p_commercials is null or cardinality(p_commercials) = 0 or b.assigned_user_ids && p_commercials)
    and (
      p_client_type is null
      or (p_client_type = 'b2b' and exists (
            select 1 from public.contacts c where c.id = b.contact_id and c.company_id is not null))
      or (p_client_type = 'b2c' and not exists (
            select 1 from public.contacts c where c.id = b.contact_id and c.company_id is not null))
    )
    and (
      (p_from_sign is null and p_to_sign is null)
      or exists (
        select 1 from (
          select case
                   when exists (select 1 from public.quotes q where q.booking_id = b.id and q.primary_quote)
                     then (select q.quote_signed_at from public.quotes q
                            where q.booking_id = b.id and q.primary_quote order by q.created_at limit 1)
                   else (select q.quote_signed_at from public.quotes q
                          where q.booking_id = b.id and q.quote_signed_at is not null
                          order by q.quote_signed_at limit 1)
                 end as signed_at
        ) sa
        where sa.signed_at is not null
          and (p_from_sign is null or sa.signed_at >= p_from_sign::timestamptz)
          and (p_to_sign   is null or sa.signed_at <  (p_to_sign + 1)::timestamptz)
      )
    );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper : ids des contacts du scope courant (org uniquement, comme useContacts).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._dashboard_contact_ids(
  p_from_import date   default null,
  p_to_import   date   default null,
  p_commercials uuid[] default null,
  p_client_type text   default null
)
returns table(id uuid)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  select u.organization_id into v_org from public.users u where u.id = v_uid;
  if v_org is null then
    return;
  end if;

  return query
  select c.id
  from public.contacts c
  where c.organization_id = v_org
    and (p_from_import is null or c.created_at >= p_from_import::timestamptz)
    and (p_to_import   is null or c.created_at <  (p_to_import + 1)::timestamptz)
    and (p_commercials is null or cardinality(p_commercials) = 0 or c.assigned_to = any(p_commercials))
    and (
      p_client_type is null
      or (p_client_type = 'b2b' and c.company_id is not null)
      or (p_client_type = 'b2c' and c.company_id is null)
    );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC principale : tous les agregats numeriques (General/Evenements/Commercial), 1 appel.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.dashboard_aggregates(
  p_from_event  date default null,
  p_to_event    date default null,
  p_from_sign   date default null,
  p_to_sign     date default null,
  p_from_import date default null,
  p_to_import   date default null,
  p_restaurants uuid[] default null,
  p_statuses    uuid[] default null,
  p_commercials uuid[] default null,
  p_client_type text   default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  signed_slugs    text[] := array['attente_paiement','relance_paiement','confirme_fonctionnaire','fonction_envoyee','a_facturer','cloture'];
  confirmed_slugs text[] := array['confirme_fonctionnaire','fonction_envoyee','a_facturer','cloture'];
  pending_slugs   text[] := array['nouveau','qualification','proposition','negociation','attente_paiement','relance_paiement'];
  sq_statuses     text[] := array['quote_signed','deposit_paid','balance_paid','completed'];
  v_month_start   date := date_trunc('month', current_date)::date - interval '5 month';
begin
  return (
    with bk as (
      select
        b.id, b.event_date, b.guests_count, b.restaurant_id, b.assigned_user_ids,
        b.occasion, b.event_type, b.total_amount, b.contact_id,
        st.slug as status_slug, st.name as status_name, st.color as status_color, st.id as status_id,
        r.name as restaurant_name, r.color as restaurant_color,
        coalesce(
          (select q.total_ht from public.quotes q where q.booking_id = b.id and q.primary_quote order by q.created_at limit 1),
          (select q.total_ht from public.quotes q where q.booking_id = b.id and q.status = any(sq_statuses) order by q.created_at limit 1),
          0) as signed_ttc,
        coalesce(
          (select q.total_ht from public.quotes q where q.booking_id = b.id and q.primary_quote order by q.created_at limit 1),
          (select q.total_ht from public.quotes q where q.booking_id = b.id and q.status = any(sq_statuses) order by q.created_at limit 1),
          (select max(q.total_ht) from public.quotes q where q.booking_id = b.id),
          0) as pipeline_ttc,
        exists (select 1 from public.quotes q where q.booking_id = b.id and q.status = any(sq_statuses)) as has_signed_quote
      from public.bookings b
      join public._dashboard_booking_ids(
        p_from_event, p_to_event, p_from_sign, p_to_sign,
        p_from_import, p_to_import, p_restaurants, p_statuses, p_commercials, p_client_type) ids on ids.id = b.id
      left join public.statuses st on st.id = b.status_id
      left join public.restaurants r on r.id = b.restaurant_id
    )
    select jsonb_build_object(
      'total', (select count(*) from bk),
      'signed_revenue', (select coalesce(sum(signed_ttc),0) from bk where status_slug = any(signed_slugs)),
      'signed_count',   (select count(*) from bk where status_slug = any(signed_slugs)),
      'signed_guests',  (select coalesce(sum(guests_count),0) from bk where status_slug = any(signed_slugs)),
      'signed_without_quote', (select count(*) from bk where status_slug = any(signed_slugs)
        and not exists (select 1 from public.quotes q where q.booking_id = bk.id)),
      'avg_ticket_per_guest', (
        select case when coalesce(sum(guests_count),0) = 0 then 0
                    else round(sum(signed_ttc) / sum(guests_count)) end
        from bk where status_slug = any(signed_slugs)),
      -- Taux de conversion = evenements passes en statut signe / total (coherent
      -- avec "Evenements signes" ; base sur le statut du booking, pas le devis).
      'conversion_rate', (
        select case when count(*) = 0 then 0
                    else round((count(*) filter (where status_slug = any(signed_slugs)))::numeric / count(*) * 1000) / 10 end
        from bk),

      'confirmed', (select count(*) from bk where status_slug = any(confirmed_slugs)),
      'pending',   (select count(*) from bk where status_slug = any(pending_slugs)),
      'total_guests', (select coalesce(sum(guests_count),0) from bk),
      'avg_guests', (select case when count(*)=0 then 0 else round(coalesce(sum(guests_count),0)::numeric / count(*)) end from bk),

      'pipeline', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'status_id', status_id, 'name', status_name, 'color', status_color,
          'slug', status_slug, 'count', cnt, 'amount', amount) order by amount desc), '[]'::jsonb)
        from (
          select status_id, status_name, status_color, status_slug,
                 count(*) cnt, coalesce(sum(pipeline_ttc),0) amount
          from bk where status_id is not null
          group by status_id, status_name, status_color, status_slug
          having count(*) > 0
        ) p),

      'by_restaurant', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', restaurant_id, 'name', restaurant_name, 'color', restaurant_color,
          'revenue', revenue, 'signed_count', cnt,
          'avg_ticket', case when cnt=0 then 0 else round(revenue/cnt) end) order by revenue desc), '[]'::jsonb)
        from (
          select restaurant_id, restaurant_name, restaurant_color,
                 coalesce(sum(signed_ttc),0) revenue, count(*) cnt
          from bk where status_slug = any(signed_slugs)
          group by restaurant_id, restaurant_name, restaurant_color
          having coalesce(sum(signed_ttc),0) > 0
        ) r),

      'by_commercial', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', uid, 'sales', sales, 'bookings', bookings, 'signed', signed,
          'conversion_rate', case when bookings=0 then 0 else round(signed::numeric / bookings * 1000)/10 end,
          'avg_ticket', case when signed=0 then 0 else round(sales/signed) end) order by sales desc), '[]'::jsonb)
        from (
          select uid,
                 coalesce(sum(signed_ttc) filter (where status_slug = any(signed_slugs)),0) sales,
                 count(*) bookings,
                 count(*) filter (where status_slug = any(signed_slugs)) signed,
                 count(*) filter (where has_signed_quote) signed_with_quote
          from (select b.*, unnest(b.assigned_user_ids) uid from bk b) x
          group by uid
        ) c),

      'by_day_of_week', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'dow', dow, 'reservations', cnt, 'guests', guests) order by dow), '[]'::jsonb)
        from (
          select extract(isodow from event_date)::int dow, count(*) cnt, coalesce(sum(guests_count),0) guests
          from bk where event_date is not null
          group by extract(isodow from event_date)::int
        ) d),

      'by_type', (
        select coalesce(jsonb_agg(jsonb_build_object('name', t, 'value', cnt) order by cnt desc), '[]'::jsonb)
        from (
          select coalesce(nullif(occasion,''), nullif(event_type,''), 'Autre') t, count(*) cnt
          from bk group by coalesce(nullif(occasion,''), nullif(event_type,''), 'Autre')
        ) tt),

      'monthly_trend', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'month', to_char(m, 'YYYY-MM'),
          'reservations', (select count(*) from bk where date_trunc('month', event_date) = m),
          'revenue', (select coalesce(sum(signed_ttc),0) from bk
                        where date_trunc('month', event_date) = m and status_slug = any(signed_slugs))
        ) order by m), '[]'::jsonb)
        from generate_series(v_month_start, date_trunc('month', current_date)::date, interval '1 month') m),

      'monthly_revenue_by_restaurant', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'month', to_char(m, 'YYYY-MM'), 'restaurant', restaurant_name, 'revenue', revenue) order by m), '[]'::jsonb)
        from (
          select date_trunc('month', event_date) m, restaurant_name, coalesce(sum(signed_ttc),0) revenue
          from bk
          where status_slug = any(signed_slugs) and event_date >= v_month_start and restaurant_name is not null
          group by date_trunc('month', event_date), restaurant_name
        ) s),

      'monthly_revenue_by_commercial', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'month', to_char(m, 'YYYY-MM'), 'user_id', uid, 'revenue', revenue) order by m), '[]'::jsonb)
        from (
          select date_trunc('month', event_date) m, uid, coalesce(sum(signed_ttc),0) revenue
          from (select b.*, unnest(b.assigned_user_ids) uid from bk b) x
          where status_slug = any(signed_slugs) and event_date >= v_month_start
          group by date_trunc('month', event_date), uid
        ) s)
    )
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC marketing : leads / bookings / signes / CA par source + leads mensuels.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.dashboard_marketing(
  p_from_event  date default null,
  p_to_event    date default null,
  p_from_sign   date default null,
  p_to_sign     date default null,
  p_from_import date default null,
  p_to_import   date default null,
  p_restaurants uuid[] default null,
  p_statuses    uuid[] default null,
  p_commercials uuid[] default null,
  p_client_type text   default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  signed_slugs text[] := array['attente_paiement','relance_paiement','confirme_fonctionnaire','fonction_envoyee','a_facturer','cloture'];
  sq_statuses  text[] := array['quote_signed','deposit_paid','balance_paid','completed'];
  v_month_start date := date_trunc('month', current_date)::date - interval '5 month';
begin
  return (
    with bids as (
      select id from public._dashboard_booking_ids(
        p_from_event,p_to_event,p_from_sign,p_to_sign,p_from_import,p_to_import,
        p_restaurants,p_statuses,p_commercials,p_client_type)
    ),
    cids as (
      select id from public._dashboard_contact_ids(p_from_import,p_to_import,p_commercials,p_client_type)
    ),
    b as (
      select bk.id, st.slug as slug, coalesce(nullif(ct.source,''), 'Autre') as source,
             bk.total_amount,
             coalesce(
               (select q.total_ht from public.quotes q where q.booking_id = bk.id and q.primary_quote order by q.created_at limit 1),
               (select q.total_ht from public.quotes q where q.booking_id = bk.id and q.status = any(sq_statuses) order by q.created_at limit 1),
               0) as signed_ttc
      from public.bookings bk
      join bids on bids.id = bk.id
      left join public.statuses st on st.id = bk.status_id
      left join public.contacts ct on ct.id = bk.contact_id
    ),
    leads as (
      select coalesce(nullif(c.source,''), 'Autre') as source, count(*) as leads
      from public.contacts c join cids on cids.id = c.id
      group by coalesce(nullif(c.source,''), 'Autre')
    ),
    bk_src as (
      select source, count(*) as bookings,
             count(*) filter (where slug = any(signed_slugs)) as signed,
             coalesce(sum(case when slug = any(signed_slugs)
                               then (case when coalesce(total_amount,0) > 0 then total_amount else signed_ttc end)
                               else 0 end), 0) as revenue
      from b group by source
    ),
    merged as (
      select coalesce(l.source, k.source) as source,
             coalesce(l.leads,0) as leads, coalesce(k.bookings,0) as bookings,
             coalesce(k.signed,0) as signed, coalesce(k.revenue,0) as revenue
      from leads l full outer join bk_src k on k.source = l.source
    ),
    monthly as (
      select to_char(date_trunc('month', c.created_at), 'YYYY-MM') as month,
             coalesce(nullif(c.source,''), 'Autre') as source, count(*) as leads
      from public.contacts c join cids on cids.id = c.id
      where c.created_at >= v_month_start::timestamptz
      group by 1, 2
    )
    select jsonb_build_object(
      'by_source', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'source', source, 'leads', leads, 'bookings', bookings, 'signed_count', signed,
          'conversion_rate', case when leads=0 then 0 else round(bookings::numeric / leads * 1000)/10 end,
          'signature_rate',  case when leads=0 then 0 else round(signed::numeric  / leads * 1000)/10 end,
          'revenue', revenue) order by leads desc), '[]'::jsonb) from merged),
      'monthly_leads_by_source', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'month', month, 'source', source, 'leads', leads) order by month), '[]'::jsonb) from monthly)
    )
  );
end;
$$;

grant execute on function public._dashboard_booking_ids(date,date,date,date,date,date,uuid[],uuid[],uuid[],text) to authenticated;
grant execute on function public._dashboard_contact_ids(date,date,uuid[],text) to authenticated;
grant execute on function public.dashboard_aggregates(date,date,date,date,date,date,uuid[],uuid[],uuid[],text) to authenticated;
grant execute on function public.dashboard_marketing(date,date,date,date,date,date,uuid[],uuid[],uuid[],text) to authenticated;
