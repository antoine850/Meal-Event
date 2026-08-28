-- Sync Google Calendar temps réel : toute écriture pertinente sur bookings
-- notifie le backend via pg_net (trigger = unique déclencheur de la sync).
-- Placeholders __BACKEND_URL__ et __GCAL_SYNC_SECRET__ à substituer au
-- collage dans l'éditeur SQL prod (jamais de vraie valeur versionnée).
create extension if not exists pg_net;

create or replace function public.gcal_sync_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  if tg_op = 'DELETE' then
    -- Jamais synchronisé : rien à nettoyer côté Google.
    if old.google_calendar_event_id is null then
      return old;
    end if;
    -- La ligne va disparaître : le backend reçoit les valeurs OLD.
    payload := jsonb_build_object(
      'action', 'delete',
      'booking_id', old.id,
      'restaurant_id', old.restaurant_id,
      'google_calendar_event_id', old.google_calendar_event_id
    );
  elsif tg_op = 'INSERT' then
    payload := jsonb_build_object('action', 'upsert', 'booking_id', new.id);
  else
    -- UPDATE : ne tirer que si une colonne pertinente change.
    -- google_calendar_event_id est exclu : l'écriture de l'id par le backend
    -- après création ne doit pas re-déclencher.
    if row(new.status_id, new.event_date, new.start_time, new.end_time,
           new.guests_count, new.occasion, new.event_type, new.reservation_type,
           new.is_privatif, new.commentaires, new.allergies_regimes,
           new.budget_client, new.contact_id, new.restaurant_id, new.space_id)
       is not distinct from
       row(old.status_id, old.event_date, old.start_time, old.end_time,
           old.guests_count, old.occasion, old.event_type, old.reservation_type,
           old.is_privatif, old.commentaires, old.allergies_regimes,
           old.budget_client, old.contact_id, old.restaurant_id, old.space_id)
    then
      return new;
    end if;
    payload := jsonb_build_object('action', 'upsert', 'booking_id', new.id);
    -- Booking déplacé vers un autre resto : le backend purge l'ancien
    -- calendrier avant de recréer dans le nouveau.
    if new.restaurant_id is distinct from old.restaurant_id
       and old.google_calendar_event_id is not null then
      payload := payload || jsonb_build_object(
        'prev_restaurant_id', old.restaurant_id,
        'prev_event_id', old.google_calendar_event_id
      );
    end if;
  end if;

  perform net.http_post(
    url := '__BACKEND_URL__/api/internal/gcal-sync',
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', '__GCAL_SYNC_SECRET__'
    )
  );
  return coalesce(new, old);
exception when others then
  -- Ne jamais bloquer une écriture bookings à cause de la sync calendrier.
  raise warning '[gcal_sync_notify] %', sqlerrm;
  return coalesce(new, old);
end;
$$;

drop trigger if exists bookings_gcal_sync on public.bookings;
create trigger bookings_gcal_sync
  after insert or update or delete on public.bookings
  for each row execute function public.gcal_sync_notify();
