-- create_credit_note est SECURITY DEFINER (bypasse la RLS) et Postgres accorde
-- EXECUTE a PUBLIC par defaut : la fonction etait donc appelable via
-- POST /rest/v1/rpc/create_credit_note avec la cle anon, permettant une ecriture
-- cross-org (update quotes / delete quote_items). On retire EXECUTE a tout le monde
-- sauf service_role (le backend l'appelle en service-role).
-- Signature complete requise pour cibler la bonne fonction.

revoke execute on function public.create_credit_note(
  uuid, uuid, uuid, uuid, text,
  numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric,
  uuid[], jsonb, jsonb, uuid
) from public, anon, authenticated;

grant execute on function public.create_credit_note(
  uuid, uuid, uuid, uuid, text,
  numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric,
  uuid[], jsonb, jsonb, uuid
) to service_role;
