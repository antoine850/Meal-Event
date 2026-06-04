# Dashboard & Événements — performance, RPC d'agrégation, fixes

Date : 2026-06-05
Statut : design validé (en attente de relecture)

## Contexte

L'import Booking Shake a chargé ~14 179 événements (`bookings`) et ~23 545 contacts
(`contacts`), tous créés le même jour (4 juin 2026). Le dashboard et la page
Événements chargent **toutes** les lignes côté client puis filtrent/agrègent en
JavaScript. PostgREST plafonne par défaut à **1000 lignes** : les deux pages ne
voient que les 1000 premières lignes, sans `.limit()` ni `.range()` explicites.

Deux symptômes en découlent :

1. **Dashboard** : tous les KPI sont calculés sur 1000 lignes arbitraires → chiffres
   faux/partiels. Les filtres ("serveur") sont appliqués **après** le fetch, donc
   filtrer ne récupère jamais les bonnes lignes.
2. **Page Événements** : `useBookings()` trie par `event_date` **ascendant** (cap
   1000) → renvoie les 1000 événements les plus **anciens** (tous historiques). La
   vue Liste applique un filtre par défaut "à partir d'aujourd'hui". Intersection
   = vide → **aucun événement affiché** (régression depuis l'import massif).

La RLS est **désactivée** sur `bookings`/`contacts`/etc. (`migration-3-rls-policies.sql`).
L'isolation multi-tenant est applicative : `.eq('organization_id', orgId)` + scoping
restaurant pour les rôles non-admin (`commercial`, `gerant`) via `user_restaurants`.

## Objectifs

- Défaut "30 derniers jours d'import" sur le dashboard.
- Corriger l'affichage des événements sur `/evenements`.
- Déplacer l'agrégation du dashboard côté serveur via RPC Postgres (correct à 14k+,
  payloads minuscules), en respectant l'isolation org + le scoping restaurant.
- Titre + plage sélectionnée visibles dans le popup du filtre de dates.

Non-objectifs : réactiver/réécrire la RLS, toucher au modèle de rôles, refondre le
visuel des onglets (seules les sources de données changent).

## Architecture — RPC d'agrégation

Toutes les fonctions sont **`SECURITY INVOKER`** et **dérivent l'org/rôle/restaurants
assignés depuis `auth.uid()`** côté serveur — aucun `org_id` n'est accepté du client.
Le scoping reproduit la logique de `useBookings` : admin = toute l'org ; non-admin =
`restaurant_id IN (restaurants assignés)`, liste vide si aucun.

### Signature de filtres partagée

Tous les RPC prennent la même signature (tous nullables ; null/empty = pas de filtre) :

```
p_from_event date, p_to_event date,
p_from_sign  date, p_to_sign  date,
p_from_import date, p_to_import date,
p_restaurants uuid[], p_statuses uuid[], p_commercials uuid[],
p_client_type text          -- null | 'b2b' | 'b2c'
```

Le filtre "signature" porte sur la date du devis primary (`quotes.quote_signed_at`
du devis `primary_quote`, sinon premier devis signé). Le filtre "import" porte sur
`bookings.created_at` (et `contacts.created_at` pour les leads).

### Helpers internes (DRY)

- `_dashboard_booking_ids(filtres...)` → `TABLE(id uuid)` : applique une seule fois
  le scoping (org + restaurants) et tous les filtres dashboard sur `bookings`.
- `_dashboard_contact_ids(filtres...)` → `TABLE(id uuid)` : idem pour `contacts`
  (import sur `created_at`, commercial = `assigned_to`, B2B/B2C via `company_id`).

Les RPC publics joignent leurs agrégats contre ces ensembles d'ids.

### RPC publics

- **`dashboard_aggregates(filtres...)` → `jsonb`** — un seul appel renvoie tous les
  agrégats numériques des 4 onglets :
  - KPI : total demandes, CA signé HT, count signés, convives signés, ticket moyen
    par convive, taux de conversion.
  - `pipeline` : par statut `{ status_id, name, color, slug, count, amount }`.
  - `by_restaurant` (signés) : `{ id, name, color, revenue, signed_count, avg_ticket }`.
  - `by_commercial` : `{ id, name, sales, bookings, signed, conversion_rate, avg_ticket }`.
  - `by_source` (marketing) : `{ source, leads, bookings, signed_count,
    conversion_rate, signature_rate, revenue }`.
  - Séries 6 mois : `monthly_trend`, `monthly_revenue_by_restaurant`,
    `monthly_revenue_by_commercial`, `monthly_leads_by_source`.
  - Répartitions : `by_day_of_week`, `by_type`.
  - Réservations : `confirmed`, `pending`, `total_guests`, `avg_guests`.

- **`dashboard_action_lists(filtres...)` → `jsonb`** — listes de lignes **bornées
  (LIMIT)** :
  - `action_items` : urgents (J-0..J+2 non finalisés), retards de paiement,
    relances (`relance_paiement`), propositions stale (>3 j sans action).
  - `stale_proposals`, `recent_bookings` (5 derniers), `upcoming_bookings` (5 prochains).

- **`dashboard_response_time(filtres...)` → `jsonb`** — `{ avg_hours, count }`, heures
  ouvrées Lun-Ven 9h-17h Europe/Paris entre `bookings.created_at` et le premier
  passage de statut quittant "Nouveau" (`activity_logs`, `action_type =
  booking.status_changed`, `metadata.old_status = 'nouveau'`).

### Fidélité métier (réécriture SQL 1:1)

Constantes portées telles quelles depuis `use-dashboard-data.ts` :

- `SIGNED_SLUGS` = `attente_paiement, relance_paiement, confirme_fonctionnaire,
  fonction_envoyee, a_facturer, cloture`
- `CONFIRMED_SLUGS` = `confirme_fonctionnaire, fonction_envoyee, a_facturer, cloture`
- `SIGNED_QUOTE_STATUSES` = `quote_signed, deposit_paid, balance_paid, completed`
- `getSignedQuoteTtc` : `total_ht` du devis `primary_quote`, sinon premier devis
  dont `status` ∈ SIGNED_QUOTE_STATUSES.
- `getPipelineQuoteTtc` : primary, sinon signé, sinon `max(total_ht)` tous statuts.
- `getPaidAmount` : somme des `payments.amount` où `status ∈ (paid, completed)`.

Chaque agrégat est vérifié par comparaison chiffrée contre l'implémentation TS
actuelle sur un échantillon avant suppression du code client.

### Index à créer

Migration dédiée (`YYYYMMDD_dashboard_perf_indexes.sql`) :

```
bookings(organization_id, created_at)
bookings(organization_id, event_date)
bookings(organization_id, status_id)
bookings(organization_id, restaurant_id)
contacts(organization_id, created_at)
contacts(organization_id, assigned_to)
quotes(booking_id)            -- si absent
payments(booking_id)          -- si absent
statuses(organization_id, type)
```

GIN sur `bookings.assigned_user_ids` déjà présent.

## Front — dashboard

- 3 hooks React Query : `useDashboardAggregates`, `useDashboardActionLists`,
  `useDashboardResponseTime`, clés sur les filtres sérialisés, appelant
  `supabase.rpc(...)`. `staleTime` modéré (ex. 60 s).
- `useDashboardData` réécrit : n'appelle plus `useBookings`/`useContacts` ; expose
  les structures déjà calculées par les RPC (mêmes formes que les helpers actuels).
- Les 4 onglets cessent d'importer les helpers de calcul et lisent les champs du
  résultat RPC. Le rendu (cartes, charts, drill-down) reste inchangé.
- Les helpers de calcul de `use-dashboard-data.ts` devenus inutilisés sont
  supprimés (vérifier `pnpm knip`). `getBookingRefDate`, `SIGNED_SLUGS`,
  `CONFIRMED_SLUGS` restent si encore importés ailleurs (ex. page Événements,
  drill-down) — vérifier avant suppression.

### Défaut 30 jours d'import

Dans `Dashboard` (`features/dashboard/index.tsx`) : au montage, si `fromImport`
et `toImport` sont absents de l'URL, écrire `[aujourd'hui-30, aujourd'hui]` via
`navigate({ search, replace: true })`. Ainsi l'URL, le drill-down vers `/evenements`
et les RPC voient la même fenêtre. "Réinitialiser" revient à ce défaut 30 j (pas
vide). Le badge "filtre actif" ne compte pas le défaut import comme un filtre.

## Front — page Événements (fix régression + opti)

Cause : cap 1000 + tri `event_date` ascendant + défaut "à partir d'aujourd'hui".

Correctif retenu : **filtrage + pagination côté serveur** dans `useBookings`
(ou un hook dédié `useBookingsPaged`) :

- Pousser dans la requête Supabase : `organization_id`, scoping restaurant, plage
  de dates (`event_date`/`created_at` selon le tri), statuts, restaurants,
  commerciaux (`assigned_user_ids` overlaps), recherche `q` (sur nom contact /
  société / numéro), tri courant.
- Pagination serveur via `.range(from, to)` + `count: 'exact'` pour la table
  (TanStack Table en mode pagination serveur). La vue Liste n'affiche qu'une page.
- Vues Calendrier/Pipeline : requêter la fenêtre visible (mois/plage) côté serveur
  plutôt que tout charger.

Le filtre par défaut "à partir d'aujourd'hui" est conservé pour la vue Liste, mais
il s'applique désormais en SQL → les événements futurs s'affichent correctement
quel que soit le volume historique.

Périmètre : ce chantier remplace le "charger tout puis filtrer" actuel. Les
drill-downs du dashboard (qui passent les mêmes search params) restent compatibles.

## Filtre de dates — titre dans le popup

`components/data-table/date-filter.tsx` : ajouter en haut du `PopoverContent` un
en-tête affichant le `placeholder` (titre du filtre : "Date d'événement", "Date de
signature", "Date d'import") et, en dessous, la plage actuellement sélectionnée
formatée (`du JJ/MM/AAAA au JJ/MM/AAAA`, ou "Toutes les dates" si vide). Aucun
changement de props publiques : `placeholder` sert déjà de titre.

## Phasage

- **P0 — quick wins** : (a) titre popup date-filter ; (b) défaut 30 j d'import ;
  (c) fix `/evenements` (filtrage + pagination serveur). Débloque l'usage immédiat.
- **P1 — RPC agrégats** : migration index + `_dashboard_booking_ids` /
  `_dashboard_contact_ids` + `dashboard_aggregates` ; câblage onglets Général &
  Événements ; vérification chiffrée.
- **P2 — RPC listes & marketing/commercial** : `dashboard_action_lists` + agrégats
  marketing/commercial + séries mensuelles ; câblage onglets restants.
- **P3 — temps de réponse** : `dashboard_response_time` (heures ouvrées en SQL),
  test de parité contre l'implémentation TS.

## Critères d'acceptation

- `/evenements` (vue Liste) affiche les événements à venir même avec >14k events
  historiques en base ; les filtres date/statut/restaurant/commercial/recherche
  agissent côté serveur ; la pagination fonctionne.
- Dashboard : au chargement, le filtre import = 30 derniers jours ; les KPI
  reflètent l'intégralité des lignes correspondant aux filtres (pas un cap à 1000) ;
  les chiffres correspondent à l'implémentation TS de référence sur échantillon.
- Une org A ne voit jamais les données d'une org B via les RPC ; un `commercial`/
  `gerant` ne voit que ses restaurants assignés.
- Le popup du filtre de dates montre son titre et la plage sélectionnée.
- `pnpm build`, `pnpm lint`, `pnpm knip` passent.

## Risques

- Divergence métier SQL ↔ TS sur les KPI → mitigé par vérification chiffrée avant
  suppression du code client.
- `dashboard_response_time` (math heures ouvrées en SQL) = pièce la plus risquée →
  isolée en P3 avec test de parité.
- Performance des RPC sans index → migration index livrée avec/avant les RPC.
