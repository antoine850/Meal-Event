-- Tracabilite import Booking Shake : upsert idempotent + dedoublonnage sur re-run.
-- external_source/external_id sont distincts du champ "source" (canal d'acquisition).
-- Index unique non-partiel : les lignes natives (external_id NULL) ne sont pas contraintes
-- (NULL distinct en Postgres) et l'index reste inferable par l'upsert PostgREST (on_conflict).

alter table public.contacts  add column if not exists external_source text;
alter table public.contacts  add column if not exists external_id text;
alter table public.companies add column if not exists external_source text;
alter table public.companies add column if not exists external_id text;
alter table public.bookings  add column if not exists external_source text;
alter table public.bookings  add column if not exists external_id text;
alter table public.quotes    add column if not exists external_source text;
alter table public.quotes    add column if not exists external_id text;
alter table public.payments  add column if not exists external_source text;
alter table public.payments  add column if not exists external_id text;
alter table public.quote_items add column if not exists external_source text;
alter table public.quote_items add column if not exists external_id text;

create unique index if not exists contacts_org_external_uidx  on public.contacts  (organization_id, external_source, external_id);
create unique index if not exists companies_org_external_uidx on public.companies (organization_id, external_source, external_id);
create unique index if not exists bookings_org_external_uidx  on public.bookings  (organization_id, external_source, external_id);
create unique index if not exists quotes_org_external_uidx    on public.quotes    (organization_id, external_source, external_id);
create unique index if not exists payments_org_external_uidx  on public.payments  (organization_id, external_source, external_id);
create unique index if not exists quote_items_external_uidx   on public.quote_items (external_source, external_id);
