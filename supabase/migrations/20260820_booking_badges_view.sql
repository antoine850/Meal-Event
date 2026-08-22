-- Vue des badges "action requise" (spec 2026-08-20). Source de verite unique
-- des regles : formule commune depuis = greatest(debut, accuse) + delai,
-- badge visible si depuis <= now(). Le rearmement et l'extinction au
-- changement de statut tombent de la formule, aucun etat stocke.
-- current_date est en UTC : bascule a 1-2 h pres de minuit Paris, acceptable.
create or replace view public.booking_badges
with (security_invoker = true) as
with base as not materialized (
  select
    b.id as booking_id,
    b.organization_id,
    b.event_date,
    b.status_changed_at,
    b.relance_traitee_le,
    b.retour_experience_fait_le,
    s.slug
  from public.bookings b
  join public.statuses s on s.id = b.status_id
),
badges as (
  -- Relance devis : proposition sans reponse depuis 24 h, event a venir
  -- (relancer un devis pour un event passe n'a pas de sens).
  select booking_id, organization_id, 'relance_devis'::text as badge_type,
         greatest(status_changed_at,
                  coalesce(relance_traitee_le, '-infinity'::timestamptz))
           + interval '24 hours' as depuis
  from base
  where slug = 'proposition'
    and event_date >= current_date

  union all

  -- Relance facture : en attente de paiement depuis 15 jours.
  select booking_id, organization_id, 'relance_facture',
         greatest(status_changed_at,
                  coalesce(relance_traitee_le, '-infinity'::timestamptz))
           + interval '15 days'
  from base
  where slug = 'attente_paiement'

  union all

  -- Relance acompte : acompte demande non paye, event dans 4 jours ou moins.
  -- Rearme au lendemain d'un accuse (J-4 puis J-3, doc FX).
  select b.booking_id, b.organization_id, 'relance_acompte',
         greatest(b.event_date::timestamptz - interval '4 days',
                  coalesce(b.relance_traitee_le + interval '1 day',
                           '-infinity'::timestamptz))
  from base b
  where b.event_date >= current_date
    -- hors annulees : un acompte pending residuel ne relance pas un dossier annule
    and b.slug <> 'cancelled'
    and exists (
      select 1 from public.payments p
      where p.booking_id = b.booking_id
        and p.payment_type = 'deposit'
        and p.status = 'pending'
    )

  union all

  -- Retour d'experience : event passe depuis 1 a 15 jours, pas encore fait.
  select booking_id, organization_id, 'retour_experience',
         event_date::timestamptz + interval '1 day'
  from base
  where slug in ('confirme_fonctionnaire', 'fonction_envoyee', 'a_facturer',
                 'attente_paiement', 'relance_paiement', 'cloture')
    and retour_experience_fait_le is null
    and event_date < current_date
    and event_date >= current_date - interval '15 days'

  -- Litige : desactive en v1, criteres et vue dediee a valider avec FX.
  -- union all
  -- select booking_id, organization_id, 'litige',
  --        greatest(status_changed_at,
  --                 coalesce(relance_traitee_le, '-infinity'::timestamptz))
  --          + interval '1 month'
  -- from base
  -- where slug = 'relance_paiement'
)
select booking_id, organization_id, badge_type, depuis
from badges
where depuis <= now();
