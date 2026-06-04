-- Index de performance pour les agregations dashboard (RPC).
-- Additif et sans risque : aucune fonction/feature existante n'en depend pour sa correction.

create index if not exists idx_bookings_org_created_at on public.bookings (organization_id, created_at);
create index if not exists idx_bookings_org_event_date on public.bookings (organization_id, event_date);
create index if not exists idx_bookings_org_status on public.bookings (organization_id, status_id);
create index if not exists idx_bookings_org_restaurant on public.bookings (organization_id, restaurant_id);
create index if not exists idx_bookings_org_contact on public.bookings (organization_id, contact_id);

create index if not exists idx_contacts_org_created_at on public.contacts (organization_id, created_at);
create index if not exists idx_contacts_org_assigned_to on public.contacts (organization_id, assigned_to);
create index if not exists idx_contacts_org_source on public.contacts (organization_id, source);

create index if not exists idx_quotes_booking on public.quotes (booking_id);
create index if not exists idx_payments_booking on public.payments (booking_id);
create index if not exists idx_statuses_org_type on public.statuses (organization_id, type);
