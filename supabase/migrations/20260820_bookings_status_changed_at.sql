-- Socle des badges "action requise" (spec 2026-08-20) :
-- status_changed_at = horloge des delais par statut, posee par trigger ;
-- relance_traitee_le / retour_experience_fait_le = accuses horodates.
alter table public.bookings
  add column if not exists status_changed_at timestamptz not null default now(),
  add column if not exists relance_traitee_le timestamptz,
  add column if not exists retour_experience_fait_le timestamptz;

-- Backfill : date de creation par defaut, ecrasee par le dernier changement
-- de statut connu (3030 logs pour 17021 bookings, couverture partielle).
update public.bookings
set status_changed_at = created_at
where created_at is not null;

update public.bookings b
set status_changed_at = l.last_change
from (
  select booking_id, max(created_at) as last_change
  from public.activity_logs
  where action_type = 'booking.status_changed'
  group by booking_id
) l
where l.booking_id = b.id
  and l.last_change is not null;

-- Ne pose l'horloge que si l'appelant ne l'a pas fournie explicitement :
-- c'est ce qui permettra a la future migration des statuts de conserver
-- les horloges (poser status_changed_at dans le meme UPDATE).
create or replace function public.set_booking_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status_id is distinct from old.status_id
     and new.status_changed_at is not distinct from old.status_changed_at then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_status_changed_at on public.bookings;
create trigger bookings_status_changed_at
  before update on public.bookings
  for each row execute function public.set_booking_status_changed_at();

-- La vue booking_badges filtre par statut.
create index if not exists bookings_status_id_idx
  on public.bookings (status_id);
