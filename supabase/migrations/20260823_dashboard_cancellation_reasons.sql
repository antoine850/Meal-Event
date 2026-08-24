-- Repartition des motifs d'annulation (spec 2026-08-23) : ajout de
-- by_cancellation_reason a dashboard_aggregates, fonction rejouee a
-- l'identique par ailleurs (source : 20260605_dashboard_aggregates.sql).

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
        b.occasion, b.event_type, b.total_amount, b.contact_id, b.cancellation_reason,
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
      -- Reste a encaisser (AR) sur les signes : total TTC du devis primary - deja paye.
      'outstanding', (
        select coalesce(sum(greatest(
          coalesce((select q.total_ttc from public.quotes q where q.booking_id = bk.id and q.primary_quote order by q.created_at limit 1),0)
          - coalesce((select sum(p.amount) from public.payments p where p.booking_id = bk.id and p.status in ('paid','completed')),0), 0)),0)
        from bk where status_slug = any(signed_slugs)),

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

      'by_cancellation_reason', (
        select coalesce(jsonb_agg(jsonb_build_object('name', r, 'value', cnt)
          order by cnt desc), '[]'::jsonb)
        from (
          select coalesce(cancellation_reason, '') r, count(*) cnt
          from bk where status_slug = 'cancelled'
          group by coalesce(cancellation_reason, '')
        ) c),

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

grant execute on function public.dashboard_aggregates(date,date,date,date,date,date,uuid[],uuid[],uuid[],text) to authenticated;
