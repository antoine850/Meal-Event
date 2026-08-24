-- Motif d'annulation (spec 2026-08-23). Valeurs libres cote SQL : le
-- referentiel vit dans src/features/reservations/data/cancellation-reasons.ts,
-- comme companies.category. Pas d'index : le seul lecteur est la RPC dashboard,
-- qui balaye deja le jeu filtre.
-- lock_timeout : table vivante de 17 000 lignes, echouer vite plutot que
-- bloquer l'app derriere le lock de l'ALTER.
set lock_timeout = '5s';

alter table public.bookings
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_comment text;
