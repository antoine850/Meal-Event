-- Numero de dossier externe (agences : Rejolt/Result, Cactus, Business
-- Profiler, Joy, Naboo) saisi sur la fiche evenement et recherchable.
alter table public.bookings
  add column if not exists numero_dossier text;

create index if not exists bookings_org_numero_dossier_idx
  on public.bookings (organization_id, numero_dossier)
  where numero_dossier is not null;
