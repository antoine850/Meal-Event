-- RPC dashboard - 2e lot : listes d'actions + temps de reponse.
-- SECURITY INVOKER, scope derive de auth.uid() via _dashboard_booking_ids.
-- Fidelite : replique general-tab (actionItems, recentBookings), commercial-tab
-- (staleProposals, useAvgResponseTime), reservations-tab (upcomingBookings).

-- Heures ouvrees (Lun-Ven 9h-17h Europe/Paris) entre deux instants.
create or replace function public._working_hours_between(p_start timestamptz, p_end timestamptz)
returns numeric
language plpgsql
immutable
as $$
declare
  s timestamp; e timestamp; total numeric := 0; d date;
  ov_start timestamp; ov_end timestamp;
begin
  if p_start is null or p_end is null or p_end <= p_start then
    return 0;
  end if;
  s := p_start at time zone 'Europe/Paris';
  e := p_end   at time zone 'Europe/Paris';
  for d in select generate_series(s::date, e::date, interval '1 day')::date loop
    if extract(isodow from d) between 1 and 5 then
      ov_start := greatest(s, d + time '09:00');
      ov_end   := least(e,  d + time '17:00');
      if ov_end > ov_start then
        total := total + extract(epoch from (ov_end - ov_start)) / 3600.0;
      end if;
    end if;
  end loop;
  return total;
end;
$$;

create or replace function public.dashboard_response_time(
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
begin
  return (
    with ids as (
      select id from public._dashboard_booking_ids(
        p_from_event,p_to_event,p_from_sign,p_to_sign,p_from_import,p_to_import,
        p_restaurants,p_statuses,p_commercials,p_client_type)
    ),
    firsts as (
      select al.booking_id, min(al.created_at) as first_change
      from public.activity_logs al
      join ids on ids.id = al.booking_id
      where al.action_type = 'booking.status_changed'
        and lower(coalesce(al.metadata->>'old_status','')) = 'nouveau'
      group by al.booking_id
    ),
    deltas as (
      select public._working_hours_between(b.created_at, f.first_change) as h
      from firsts f
      join public.bookings b on b.id = f.booking_id
      where b.created_at is not null
    )
    select case when count(*) = 0 then null
                else jsonb_build_object('avg_hours', round(avg(h)::numeric, 1), 'count', count(*)) end
    from deltas where h >= 0
  );
end;
$$;

-- Listes de lignes (bornees) : actions requises, propositions stale, derniers, prochains.
create or replace function public.dashboard_action_lists(
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
begin
  return (
    with ids as (
      select id from public._dashboard_booking_ids(
        p_from_event,p_to_event,p_from_sign,p_to_sign,p_from_import,p_to_import,
        p_restaurants,p_statuses,p_commercials,p_client_type)
    ),
    b as (
      select bk.id, bk.event_date, bk.guests_count, bk.start_time,
             st.slug as slug, st.name as status_name, st.color as status_color,
             r.name as restaurant_name,
             nullif(trim(concat_ws(' ', ct.first_name, ct.last_name)), '') as contact_name,
             coalesce(bk.occasion, bk.event_type) as kind,
             (select q.total_ht  from public.quotes q where q.booking_id = bk.id and q.primary_quote order by q.created_at limit 1) as primary_ht,
             (select q.total_ttc from public.quotes q where q.booking_id = bk.id and q.primary_quote order by q.created_at limit 1) as primary_ttc,
             (select coalesce(sum(p.amount),0) from public.payments p where p.booking_id = bk.id and p.status in ('paid','completed')) as paid,
             (st.slug = any(signed_slugs)) as is_signed,
             (coalesce(st.slug,'') not like '%annul%' and lower(coalesce(st.name,'')) not like '%annul%') as not_cancelled
      from public.bookings bk
      join ids on ids.id = bk.id
      left join public.statuses st on st.id = bk.status_id
      left join public.restaurants r on r.id = bk.restaurant_id
      left join public.contacts ct on ct.id = bk.contact_id
    ),
    stale_q as (
      select bk.id as booking_id, q.quote_number, q.total_ht,
             coalesce(q.signature_requested_at, q.quote_sent_at) as sent_at,
             floor(extract(epoch from (now() - coalesce(q.signature_requested_at, q.quote_sent_at))) / 86400)::int as days_since
      from b bk
      join public.quotes q on q.booking_id = bk.id
      where q.status in ('sent','signature_requested')
        and coalesce(q.signature_requested_at, q.quote_sent_at) is not null
        and coalesce(q.signature_requested_at, q.quote_sent_at) < now() - interval '3 day'
    ),
    -- action items : urgents (J0-J2 non finalises), retards de paiement, relances, stale
    urgent as (
      select 'urgent_upcoming' as type, id, coalesce(contact_name,'Sans contact') as title,
             'Evenement ' || case when event_date = current_date then 'aujourd''hui' else 'dans ' || (event_date - current_date) || 'j' end
               || ' - ' || case when not is_signed then 'non signe' else 'acompte non paye' end as detail,
             event_date, restaurant_name, status_name, status_color, coalesce(guests_count,0) as guests,
             coalesce(primary_ht,0) as amount, 'danger' as severity
      from b
      where not_cancelled and event_date is not null
        and event_date >= current_date and event_date < current_date + 3
        and slug <> 'nouveau'
        and (not is_signed or paid <= 0)
    ),
    overdue as (
      select 'overdue', id, coalesce(contact_name,'Sans contact'),
             'Paiement en retard', event_date, restaurant_name, status_name, status_color, coalesce(guests_count,0),
             coalesce(primary_ht,0) - paid, 'danger'
      from b
      where not_cancelled and is_signed and coalesce(primary_ht,0) > 0
        and paid < coalesce(primary_ht,0) and event_date < current_date
    ),
    relances as (
      select 'relance', id, coalesce(contact_name,'Sans contact'),
             'Relance de paiement a envoyer', event_date, restaurant_name, status_name, status_color, coalesce(guests_count,0),
             coalesce(primary_ttc,0), 'warning'
      from b where not_cancelled and slug = 'relance_paiement'
    ),
    stale_ai as (
      select 'stale', sq.booking_id, coalesce(bb.contact_name,'Sans contact'),
             'Devis envoye depuis ' || sq.days_since || 'j sans reponse',
             bb.event_date, bb.restaurant_name, bb.status_name, bb.status_color, coalesce(bb.guests_count,0),
             coalesce(sq.total_ht,0), 'warning'
      from stale_q sq join b bb on bb.id = sq.booking_id
      where bb.not_cancelled
    )
    select jsonb_build_object(
      'action_items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'type', type, 'booking_id', id, 'title', title, 'detail', detail,
          'event_date', event_date, 'restaurant', restaurant_name,
          'status_name', status_name, 'status_color', status_color,
          'guests', guests, 'amount', amount, 'severity', severity)), '[]'::jsonb)
        from (
          select * from urgent union all select * from overdue
          union all select * from relances union all select * from stale_ai
        ) ai),
      'stale_proposals', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'booking_id', sq.booking_id, 'contact_name', coalesce(bb.contact_name,'Sans contact'),
          'restaurant_name', bb.restaurant_name, 'quote_number', sq.quote_number,
          'amount', coalesce(sq.total_ht,0), 'days_since', sq.days_since) order by sq.days_since desc), '[]'::jsonb)
        from stale_q sq join b bb on bb.id = sq.booking_id),
      'recent_bookings', (
        select coalesce(jsonb_agg(row order by ed desc), '[]'::jsonb) from (
          select jsonb_build_object(
            'id', id, 'contact_name', coalesce(contact_name,'Sans contact'),
            'restaurant_name', restaurant_name, 'kind', kind,
            'status_name', status_name, 'status_color', status_color,
            'amount', coalesce(primary_ht,0)) as row, event_date as ed
          from b where event_date is not null order by event_date desc limit 5
        ) x),
      'upcoming_bookings', (
        select coalesce(jsonb_agg(row order by ed asc), '[]'::jsonb) from (
          select jsonb_build_object(
            'id', id, 'contact_name', coalesce(contact_name,'Sans contact'),
            'restaurant_name', restaurant_name, 'kind', kind,
            'status_name', status_name, 'status_color', status_color,
            'event_date', event_date, 'start_time', start_time, 'guests', coalesce(guests_count,0)) as row, event_date as ed
          from b where event_date is not null and event_date > current_date order by event_date asc limit 5
        ) x)
    )
  );
end;
$$;

grant execute on function public._working_hours_between(timestamptz,timestamptz) to authenticated;
grant execute on function public.dashboard_response_time(date,date,date,date,date,date,uuid[],uuid[],uuid[],text) to authenticated;
grant execute on function public.dashboard_action_lists(date,date,date,date,date,date,uuid[],uuid[],uuid[],text) to authenticated;
