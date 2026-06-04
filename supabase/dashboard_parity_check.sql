-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION DE PARITE des RPC dashboard (SQL editor Supabase).
-- Auto-selectionne un utilisateur admin de l'org qui a le plus de bookings.
-- Colle TOUT le bloc et lance-le tel quel (rien a editer).
--
-- But : confirmer que dashboard_aggregates == des requetes SQL independantes sur
-- le JEU COMPLET (et NON le dashboard live, plafonne a 1000 et donc faux).
-- La colonne rpc doit etre identique a la colonne ref sur les 3 lignes.
-- ════════════════════════════════════════════════════════════════════════════

-- Simule l'utilisateur connecte (admin de l'org la plus active) pour le scoping.
select set_config('request.jwt.claims',
  json_build_object(
    'sub', (
      select u.id::text
      from public.users u
      where u.organization_id = (
        select organization_id from public.bookings
        where organization_id is not null
        group by organization_id order by count(*) desc limit 1)
      order by (exists (select 1 from public.roles r where r.id = u.role_id and r.slug = 'admin')) desc,
               u.created_at asc
      limit 1
    ),
    'role', 'authenticated'
  )::text, true);

-- Doit renvoyer un uuid (l'utilisateur simule). Si null -> aucun user trouve.
select auth.uid() as user_used, (select email from public.users where id = auth.uid()) as email;

-- Comparaison RPC vs references independantes (toutes dates, aucun filtre).
with rpc as (
  select public.dashboard_aggregates() as j
),
ctx as (
  select organization_id as org from public.users where id = auth.uid()
),
ref as (
  select
    (select count(*) from public.bookings b, ctx where b.organization_id = ctx.org) as total,
    (select count(*) from public.bookings b
       join public.statuses s on s.id = b.status_id, ctx
       where b.organization_id = ctx.org
         and s.slug = any(array['attente_paiement','relance_paiement','confirme_fonctionnaire','fonction_envoyee','a_facturer','cloture'])
    ) as signed_count,
    (select coalesce(sum(
        coalesce(
          (select q.total_ht from public.quotes q where q.booking_id = b.id and q.primary_quote order by q.created_at limit 1),
          (select q.total_ht from public.quotes q where q.booking_id = b.id
             and q.status = any(array['quote_signed','deposit_paid','balance_paid','completed']) order by q.created_at limit 1),
          0)), 0)
       from public.bookings b
       join public.statuses s on s.id = b.status_id, ctx
       where b.organization_id = ctx.org
         and s.slug = any(array['attente_paiement','relance_paiement','confirme_fonctionnaire','fonction_envoyee','a_facturer','cloture'])
    ) as signed_revenue
)
select 'total'          as metric, (rpc.j->>'total')::numeric           as rpc, ref.total           as ref from rpc, ref
union all
select 'signed_count',  (rpc.j->>'signed_count')::numeric,   ref.signed_count   from rpc, ref
union all
select 'signed_revenue',(rpc.j->>'signed_revenue')::numeric, ref.signed_revenue from rpc, ref;

-- Inspection complete (optionnel) :
-- select jsonb_pretty(public.dashboard_aggregates());
-- select jsonb_pretty(public.dashboard_marketing());
