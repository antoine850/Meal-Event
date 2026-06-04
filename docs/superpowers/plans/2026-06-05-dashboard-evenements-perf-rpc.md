# Dashboard & Événements — perf, RPC, fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger l'affichage des événements, mettre le filtre import à 30 jours par défaut, titrer le popup de dates, et déplacer l'agrégation du dashboard côté serveur via RPC Postgres.

**Architecture:** Le dashboard et `/evenements` chargent aujourd'hui toutes les lignes (cap PostgREST 1000) puis filtrent en JS. On pousse le filtrage/pagination côté serveur pour `/evenements`, et on remplace l'agrégation client du dashboard par des fonctions RPC `SECURITY INVOKER` qui dérivent l'org/rôle/restaurants de `auth.uid()`.

**Tech Stack:** Postgres (Supabase migrations, plpgsql), React 19 + TanStack Router/Query/Table, supabase-js, date-fns.

**Référence design :** `docs/superpowers/specs/2026-06-05-dashboard-evenements-perf-rpc-design.md`

**Note tests :** pas de harness unitaire dans ce repo. Vérification = `pnpm build`, `pnpm lint`, `pnpm knip`, preview server, et **parité chiffrée** RPC vs implémentation TS actuelle.

**Branche :** créer `feat/dashboard-perf-rpc` avant la première tâche (on est sur `main`).

---

## Phase P0 — Quick wins (déblocage immédiat)

### Task 1: Branche de travail

- [ ] **Step 1: Créer la branche**

```bash
cd /Users/thomas/Desktop/WINDSURF/restaurant-crm
git checkout -b feat/dashboard-perf-rpc
```

- [ ] **Step 2: Committer le spec déjà écrit**

```bash
git add docs/superpowers/specs/2026-06-05-dashboard-evenements-perf-rpc-design.md
git commit -m "docs: spec perf dashboard et evenements"
```

---

### Task 2: Titre + plage sélectionnée dans le popup du filtre de dates

**Files:**
- Modify: `src/components/data-table/date-filter.tsx`

- [ ] **Step 1: Ajouter un en-tête dans le PopoverContent**

Dans `src/components/data-table/date-filter.tsx`, remplacer l'ouverture du
`PopoverContent` (`<PopoverContent className='w-auto p-0' align='start'>` suivi de
`<div className='flex'>`) par une version avec en-tête. Ajouter d'abord un helper de
libellé juste avant le `return` du composant :

```tsx
  const selectedLabel = value?.from
    ? value.to
      ? `Du ${format(value.from, 'dd/MM/yyyy', { locale: fr })} au ${format(value.to, 'dd/MM/yyyy', { locale: fr })}`
      : `À partir du ${format(value.from, 'dd/MM/yyyy', { locale: fr })}`
    : 'Toutes les dates'
```

Puis structurer le contenu du popover :

```tsx
      <PopoverContent className='w-auto p-0' align='start'>
        <div className='border-b px-3 py-2'>
          <p className='text-sm font-medium'>{placeholder}</p>
          <p className='text-xs text-muted-foreground'>{selectedLabel}</p>
        </div>
        <div className='flex'>
          {/* ... contenu existant (presets + Calendar) inchangé ... */}
        </div>
      </PopoverContent>
```

Le `placeholder` (déjà passé : "Date d'événement", "Date de signature", "Date
d'import") sert de titre. Aucune prop publique ne change.

- [ ] **Step 2: Vérifier build + lint**

```bash
pnpm lint && pnpm build
```
Expected: PASS, aucune erreur TS.

- [ ] **Step 3: Vérifier visuellement via preview**

Démarrer le preview, ouvrir le dashboard, cliquer un filtre de date, confirmer que
le popup montre le titre ("Date d'événement") + la plage sélectionnée après choix.

- [ ] **Step 4: Commit**

```bash
git add src/components/data-table/date-filter.tsx
git commit -m "feat(filtres): titre et plage selectionnee dans le popup de dates"
```

---

### Task 3: Défaut "30 derniers jours d'import" sur le dashboard

**Files:**
- Modify: `src/features/dashboard/index.tsx`

- [ ] **Step 1: Injecter le défaut import dans l'URL au montage**

Dans `src/features/dashboard/index.tsx`, ajouter les imports en tête :

```tsx
import { useEffect } from 'react'
import { subDays } from 'date-fns'
```
(fusionner `useEffect` dans l'import React existant `import { useMemo } from 'react'`
→ `import { useEffect, useMemo } from 'react'`.)

Après la déclaration de `setSearch` (vers la ligne 103), ajouter :

```tsx
  // Défaut : 30 derniers jours d'import. Écrit dans l'URL (replace) pour que le
  // drill-down vers /evenements et les requêtes voient la même fenêtre.
  useEffect(() => {
    if (search.fromImport === undefined && search.toImport === undefined) {
      const to = new Date()
      const from = subDays(to, 29)
      navigate({
        search: (prev) => ({
          ...prev,
          fromImport: from.toISOString().slice(0, 10),
          toImport: to.toISOString().slice(0, 10),
        }),
        replace: true,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

- [ ] **Step 2: "Réinitialiser" revient au défaut 30 j (pas vide)**

Remplacer le corps de `resetFilters` pour réécrire le défaut import au lieu de le
vider :

```tsx
  const resetFilters = () => {
    const to = new Date()
    const from = subDays(to, 29)
    setSearch({
      fromEvent: undefined,
      toEvent: undefined,
      fromSign: undefined,
      toSign: undefined,
      fromImport: from.toISOString().slice(0, 10),
      toImport: to.toISOString().slice(0, 10),
      restaurants: undefined,
      statuses: undefined,
      commercials: undefined,
      clientType: undefined,
    })
  }
```

- [ ] **Step 3: Ne pas compter le défaut import comme "filtre actif"**

Le bouton "Réinitialiser" ne doit s'afficher que s'il y a un filtre au-delà du
défaut import. Laisser `hasFilters` tel quel mais retirer `importDateRange` de la
condition d'affichage du bouton n'est pas souhaitable (l'utilisateur peut changer
l'import). Garder `hasFilters` inchangé : le défaut 30 j étant dans l'URL,
`importDateRange` sera défini, donc "Réinitialiser" sera visible — c'est acceptable
puisqu'il ramène au défaut. Aucune modification ici.

- [ ] **Step 4: Vérifier build + preview**

```bash
pnpm lint && pnpm build
```
Puis preview : recharger le dashboard sans params → l'URL doit contenir
`fromImport`/`toImport` sur 30 jours, et le filtre "Date d'import" doit afficher la
plage.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/index.tsx
git commit -m "feat(dashboard): filtre import 30 derniers jours par defaut"
```

---

### Task 4: Fix `/evenements` — filtrage + pagination côté serveur

Cause : `useBookings` trie `event_date` ascendant + cap 1000 → renvoie les 1000
events les plus anciens (historiques) ; la vue Liste filtre "à partir
d'aujourd'hui" → intersection vide.

**Files:**
- Modify: `src/features/reservations/hooks/use-bookings.ts`
- Modify: `src/features/reservations/index.tsx`
- Modify: `src/features/reservations/components/bookings-table.tsx`

#### 4a. Hook paginé côté serveur

- [ ] **Step 1: Ajouter un hook `useBookingsPaged`**

Dans `src/features/reservations/hooks/use-bookings.ts`, ajouter un type de
paramètres et un hook qui pousse les filtres dans la requête. Garder `useBookings`
existant pour les consommateurs non migrés.

```tsx
export type BookingsQueryParams = {
  page: number // 0-based
  pageSize: number
  sort: { field: string; dir: 'asc' | 'desc' }
  search?: string
  from?: string // event_date >= (ISO date)
  to?: string // event_date <= (ISO date)
  statuses?: string[]
  restaurants?: string[]
  commercials?: string[]
}

export function useBookingsPaged(params: BookingsQueryParams) {
  return useQuery({
    queryKey: ['bookings-paged', params],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      // Scoping restaurant pour non-admins (même logique que useBookings)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      let restaurantScope: string[] | null = null
      if (user) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('role:roles(slug), user_restaurants(restaurant_id)')
          .eq('id', user.id)
          .single()
        const roleSlug = (dbUser as any)?.role?.slug || ''
        const assigned: string[] = ((dbUser as any)?.user_restaurants || [])
          .map((ur: any) => ur.restaurant_id)
          .filter(Boolean)
        if (roleSlug !== 'admin') restaurantScope = assigned
      }
      if (restaurantScope !== null && restaurantScope.length === 0) {
        return { rows: [] as BookingWithRelations[], total: 0 }
      }

      let query = supabase
        .from('bookings')
        .select(
          `
          *,
          restaurant:restaurants(id, name, color),
          contact:contacts(id, first_name, last_name, email, phone, source, created_at, company:companies(id, name)),
          status:statuses(id, name, color, slug),
          payments(id, amount, status, payment_modality, paid_at),
          quotes(id, total_ht, total_ttc, status, primary_quote, quote_number, quote_sent_at, signature_requested_at, quote_signed_at)
        `,
          { count: 'exact' }
        )
        .eq('organization_id', orgId)

      if (restaurantScope !== null) {
        query = query.in('restaurant_id', restaurantScope)
      }
      if (params.from) query = query.gte('event_date', params.from)
      if (params.to) query = query.lte('event_date', params.to)
      if (params.statuses?.length)
        query = query.in('status_id', params.statuses)
      if (params.restaurants?.length)
        query = query.in('restaurant_id', params.restaurants)
      if (params.commercials?.length)
        query = query.overlaps('assigned_user_ids', params.commercials)
      if (params.search) {
        const term = `%${params.search}%`
        query = query.or(
          `contact_sur_place_societe.ilike.${term},contact_sur_place_nom.ilike.${term}`
        )
      }

      query = query.order(params.sort.field, {
        ascending: params.sort.dir === 'asc',
      })
      const fromRow = params.page * params.pageSize
      query = query.range(fromRow, fromRow + params.pageSize - 1)

      const { data, error, count } = await query
      if (error) throw error
      return {
        rows: (data || []) as unknown as BookingWithRelations[],
        total: count || 0,
      }
    },
    placeholderData: (prev) => prev,
  })
}
```

Note : la recherche sur le nom du contact lié (`contacts.first_name`) nécessite un
filtre sur la table jointe ; en première version on cherche sur les champs "sur
place" du booking. La recherche cross-table sur le contact pourra être ajoutée plus
tard via une vue ou un RPC de recherche (hors périmètre P0).

- [ ] **Step 2: Vérifier que ça compile**

```bash
pnpm build
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/reservations/hooks/use-bookings.ts
git commit -m "feat(evenements): hook bookings pagine cote serveur"
```

#### 4b. Câbler la vue Liste sur le hook paginé

- [ ] **Step 4: Remplacer le chargement + filtrage client par le hook paginé**

Dans `src/features/reservations/index.tsx` :

1. Construire les params depuis l'URL (état déjà dérivé : `dateRange`,
   `selectedStatuses`, `selectedRestaurants`, `selectedCommercials`, `searchValue`,
   `sortValue`). Ajouter un état de pagination :

```tsx
  const [pageIndex, setPageIndex] = useState(0)
  const pageSize = 50

  const pagedParams = useMemo(
    () => ({
      page: pageIndex,
      pageSize,
      sort: parseSortValue(sortValue),
      search: searchValue || undefined,
      from: dateRange?.from
        ? dateRange.from.toISOString().slice(0, 10)
        : undefined,
      to: dateRange?.to ? dateRange.to.toISOString().slice(0, 10) : undefined,
      statuses: selectedStatuses.size ? [...selectedStatuses] : undefined,
      restaurants: selectedRestaurants.size
        ? [...selectedRestaurants]
        : undefined,
      commercials: selectedCommercials.size
        ? [...selectedCommercials]
        : undefined,
    }),
    [
      pageIndex,
      sortValue,
      searchValue,
      dateRange,
      selectedStatuses,
      selectedRestaurants,
      selectedCommercials,
    ]
  )
```

`parseSortValue` retourne `{ field, dir }` ? Vérifier sa signature dans
`src/components/sort-select.tsx` ; si elle retourne un objet TanStack
`{ id, desc }`, adapter : `{ field: parsed.id, dir: parsed.desc ? 'desc' : 'asc' }`.

2. Pour la vue Liste, utiliser `useBookingsPaged(pagedParams)` au lieu de
   `useBookings()`. Garder `useBookings()` pour Calendrier/Pipeline en P0 (migrés en
   P2 si besoin), OU n'appeler `useBookingsPaged` que quand `mainView === 'list'`.

```tsx
  const listQuery = useBookingsPaged(pagedParams)
  const allQuery = useBookings() // calendrier/pipeline (P0: inchangé)

  const bookings =
    mainView === 'list' ? listQuery.data?.rows ?? [] : allQuery.data ?? []
  const totalCount = listQuery.data?.total ?? 0
  const isLoading =
    mainView === 'list' ? listQuery.isLoading : allQuery.isLoading
```

3. Supprimer le filtrage client résiduel sur `bookings` pour la vue Liste (le
   serveur filtre déjà). Repérer le bloc de filtrage (`useMemo` qui applique
   date/statut/restaurant/commercial/recherche, ~lignes 200-309) et le contourner
   pour la vue Liste (l'appliquer uniquement aux vues non paginées).

4. Réinitialiser `pageIndex` à 0 quand les filtres changent :

```tsx
  useEffect(() => {
    setPageIndex(0)
  }, [
    sortValue,
    searchValue,
    dateRange?.from,
    dateRange?.to,
    search.status,
    search.restaurant,
    search.commercial,
  ])
```

- [ ] **Step 5: Pagination serveur dans la table**

Dans `src/features/reservations/components/bookings-table.tsx`, passer la table en
mode pagination manuelle. Ajouter aux props : `pageCount`, `pageIndex`,
`onPageChange`. Configurer `useReactTable` avec :

```tsx
    manualPagination: true,
    pageCount,
    state: { ...existingState, pagination: { pageIndex, pageSize } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize })
          : updater
      onPageChange(next.pageIndex)
    },
```
Passer `pageCount={Math.ceil(totalCount / pageSize)}` depuis `index.tsx`. Câbler les
boutons précédent/suivant existants sur `onPageChange`.

Si le tri est géré dans la table (colonnes triables), passer aussi `manualSorting:
true` et remonter le tri vers l'URL/`sortValue`. Sinon garder le `SortSelect`
existant qui pilote déjà `sortValue`.

- [ ] **Step 6: Vérifier build + preview**

```bash
pnpm lint && pnpm build
```
Preview : ouvrir `/evenements` → des événements à venir doivent s'afficher ;
changer le filtre date sur "Cette année" → events historiques visibles ; pagination
fonctionnelle ; recherche/filtre statut/restaurant/commercial agissent.

- [ ] **Step 7: Commit**

```bash
git add src/features/reservations/index.tsx src/features/reservations/components/bookings-table.tsx
git commit -m "feat(evenements): liste paginee et filtree cote serveur"
```

---

## Phase P1 — RPC agrégats (cœur)

### Task 5: Migration index de performance

**Files:**
- Create: `supabase/migrations/20260605_dashboard_perf_indexes.sql`

- [ ] **Step 1: Écrire la migration d'index**

```sql
-- Index pour les filtres/agrégats du dashboard et la pagination evenements.
create index if not exists idx_bookings_org_created_at on public.bookings (organization_id, created_at);
create index if not exists idx_bookings_org_event_date on public.bookings (organization_id, event_date);
create index if not exists idx_bookings_org_status on public.bookings (organization_id, status_id);
create index if not exists idx_bookings_org_restaurant on public.bookings (organization_id, restaurant_id);
create index if not exists idx_contacts_org_created_at on public.contacts (organization_id, created_at);
create index if not exists idx_contacts_org_assigned on public.contacts (organization_id, assigned_to);
create index if not exists idx_quotes_booking on public.quotes (booking_id);
create index if not exists idx_payments_booking on public.payments (booking_id);
create index if not exists idx_statuses_org_type on public.statuses (organization_id, type);
```

- [ ] **Step 2: Appliquer**

Appliquer via Supabase CLI (`supabase db push`) ou la migration MCP `apply_migration`.
Si la RLS/MCP n'est pas authentifiée, fournir le SQL à exécuter dans le SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260605_dashboard_perf_indexes.sql
git commit -m "feat(db): index perf dashboard et evenements"
```

---

### Task 6: Helper interne `_dashboard_booking_ids`

**Files:**
- Create: `supabase/migrations/20260605_dashboard_booking_ids.sql`

- [ ] **Step 1: Écrire le helper de scoping + filtres**

```sql
create or replace function public._dashboard_booking_ids(
  p_from_event date default null,
  p_to_event date default null,
  p_from_sign date default null,
  p_to_sign date default null,
  p_from_import date default null,
  p_to_import date default null,
  p_restaurants uuid[] default null,
  p_statuses uuid[] default null,
  p_commercials uuid[] default null,
  p_client_type text default null
)
returns table(id uuid)
language plpgsql
security invoker
stable
as $$
declare
  v_org uuid;
  v_role text;
  v_restaurants uuid[];
begin
  select u.organization_id, r.slug
    into v_org, v_role
  from public.users u
  left join public.roles r on r.id = u.role_id
  where u.id = auth.uid();

  if v_org is null then
    return;
  end if;

  if v_role is distinct from 'admin' then
    select coalesce(array_agg(ur.restaurant_id), '{}')
      into v_restaurants
    from public.user_restaurants ur
    where ur.user_id = auth.uid();
    if array_length(v_restaurants, 1) is null then
      return; -- non-admin sans restaurant : rien
    end if;
  end if;

  return query
  select b.id
  from public.bookings b
  where b.organization_id = v_org
    and (v_role = 'admin' or b.restaurant_id = any(v_restaurants))
    and (p_from_event is null or b.event_date >= p_from_event)
    and (p_to_event is null or b.event_date <= p_to_event)
    and (p_from_import is null or b.created_at >= p_from_import)
    and (p_to_import is null or b.created_at < (p_to_import + 1))
    and (p_restaurants is null or b.restaurant_id = any(p_restaurants))
    and (p_statuses is null or b.status_id = any(p_statuses))
    and (p_commercials is null or b.assigned_user_ids && p_commercials)
    and (
      p_client_type is null
      or (p_client_type = 'b2b' and exists (
            select 1 from public.contacts c
            where c.id = b.contact_id and c.company_id is not null))
      or (p_client_type = 'b2c' and not exists (
            select 1 from public.contacts c
            where c.id = b.contact_id and c.company_id is not null))
    )
    and (
      (p_from_sign is null and p_to_sign is null)
      or exists (
        select 1 from public.quotes q
        where q.booking_id = b.id
          and q.quote_signed_at is not null
          and (q.primary_quote is true or true)
          and (p_from_sign is null or q.quote_signed_at::date >= p_from_sign)
          and (p_to_sign is null or q.quote_signed_at::date <= p_to_sign)
      )
    );
end;
$$;

grant execute on function public._dashboard_booking_ids to authenticated;
```

- [ ] **Step 2: Vérifier parité du compte total**

Comparer `select count(*) from _dashboard_booking_ids(...)` (sans filtre, en tant
qu'utilisateur authentifié de l'org) au nombre de bookings que l'app charge
réellement. Exécuter pour un org de test connu.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260605_dashboard_booking_ids.sql
git commit -m "feat(db): helper _dashboard_booking_ids scope et filtres"
```

---

### Task 7: RPC `dashboard_aggregates` (KPI + pipeline + répartitions)

**Files:**
- Create: `supabase/migrations/20260605_dashboard_aggregates.sql`

- [ ] **Step 1: Écrire la fonction d'agrégats**

Construire un CTE des bookings filtrés (ids du helper) enrichi des champs dérivés
(slug statut, `signed_quote_ht`, `pipeline_quote_ht`, `paid_amount`), puis émettre
un `jsonb`. SQL complet :

```sql
create or replace function public.dashboard_aggregates(
  p_from_event date default null,
  p_to_event date default null,
  p_from_sign date default null,
  p_to_sign date default null,
  p_from_import date default null,
  p_to_import date default null,
  p_restaurants uuid[] default null,
  p_statuses uuid[] default null,
  p_commercials uuid[] default null,
  p_client_type text default null
)
returns jsonb
language sql
security invoker
stable
as $$
with ids as (
  select id from public._dashboard_booking_ids(
    p_from_event, p_to_event, p_from_sign, p_to_sign,
    p_from_import, p_to_import, p_restaurants, p_statuses,
    p_commercials, p_client_type)
),
base as (
  select
    b.id, b.restaurant_id, b.status_id, b.assigned_user_ids,
    b.guests_count, b.event_date, b.occasion, b.event_type, b.contact_id,
    s.slug as status_slug, s.name as status_name, s.color as status_color,
    -- total_ht du primary, sinon premier devis signe
    coalesce(
      (select q.total_ht from public.quotes q
        where q.booking_id = b.id and q.primary_quote is true limit 1),
      (select q.total_ht from public.quotes q
        where q.booking_id = b.id
          and q.status in ('quote_signed','deposit_paid','balance_paid','completed')
        limit 1),
      0
    ) as signed_quote_ht,
    -- pipeline: primary, sinon signe, sinon max(total_ht)
    coalesce(
      (select q.total_ht from public.quotes q
        where q.booking_id = b.id and q.primary_quote is true limit 1),
      (select q.total_ht from public.quotes q
        where q.booking_id = b.id
          and q.status in ('quote_signed','deposit_paid','balance_paid','completed')
        limit 1),
      (select max(q.total_ht) from public.quotes q where q.booking_id = b.id),
      0
    ) as pipeline_quote_ht,
    exists (
      select 1 from public.quotes q
      where q.booking_id = b.id
        and q.status in ('quote_signed','deposit_paid','balance_paid','completed')
    ) as has_signed_quote
  from public.bookings b
  join ids on ids.id = b.id
  left join public.statuses s on s.id = b.status_id
),
signed as (
  select * from base
  where status_slug in (
    'attente_paiement','relance_paiement','confirme_fonctionnaire',
    'fonction_envoyee','a_facturer','cloture')
)
select jsonb_build_object(
  'total_count', (select count(*) from base),
  'signed_revenue', (select coalesce(sum(signed_quote_ht),0) from signed),
  'signed_count', (select count(*) from signed),
  'signed_guests', (select coalesce(sum(guests_count),0) from signed),
  'avg_ticket_per_guest', (
    select case when coalesce(sum(guests_count),0) = 0 then 0
      else round(sum(signed_quote_ht) / sum(guests_count)) end from signed),
  'conversion_rate', (
    select case when count(*) = 0 then 0
      else round((count(*) filter (where has_signed_quote))::numeric
                 / count(*) * 1000) / 10 end from base),
  'confirmed', (select count(*) from base where status_slug in
    ('confirme_fonctionnaire','fonction_envoyee','a_facturer','cloture')),
  'pending', (select count(*) from base where status_slug in
    ('nouveau','qualification','proposition','negociation',
     'attente_paiement','relance_paiement')),
  'total_guests', (select coalesce(sum(guests_count),0) from base),
  'pipeline', (
    select coalesce(jsonb_agg(p), '[]'::jsonb) from (
      select s.id as status_id, s.name, s.color, s.slug,
             count(b.id) as count,
             coalesce(sum(b.pipeline_quote_ht),0) as amount
      from public.statuses s
      join base b on b.status_id = s.id
      where s.type = 'booking'
      group by s.id, s.name, s.color, s.slug, s.position
      having count(b.id) > 0
      order by s.position
    ) p),
  'by_restaurant', (
    select coalesce(jsonb_agg(r), '[]'::jsonb) from (
      select rest.id, rest.name, rest.color,
             coalesce(sum(s.signed_quote_ht),0) as revenue,
             count(s.id) as signed_count,
             case when count(s.id) = 0 then 0
               else round(sum(s.signed_quote_ht)/count(s.id)) end as avg_ticket
      from public.restaurants rest
      join signed s on s.restaurant_id = rest.id
      group by rest.id, rest.name, rest.color
      having sum(s.signed_quote_ht) > 0
      order by revenue desc
    ) r),
  'by_day_of_week', (
    select coalesce(jsonb_agg(d order by d->>'dow'), '[]'::jsonb) from (
      select jsonb_build_object(
        'dow', extract(dow from event_date)::int,
        'reservations', count(*),
        'guests', coalesce(sum(guests_count),0)) as d
      from base group by extract(dow from event_date)
    ) x),
  'by_type', (
    select coalesce(jsonb_agg(t order by (t->>'value')::int desc), '[]'::jsonb) from (
      select jsonb_build_object(
        'name', coalesce(nullif(occasion,''), nullif(event_type,''), 'Autre'),
        'value', count(*)) as t
      from base
      group by coalesce(nullif(occasion,''), nullif(event_type,''), 'Autre')
    ) x)
);
$$;

grant execute on function public.dashboard_aggregates to authenticated;
```

- [ ] **Step 2: Vérifier parité chiffrée**

Pour un org de test, appeler `dashboard_aggregates(...)` avec les mêmes filtres que
l'UI et comparer `signed_revenue`, `signed_count`, `conversion_rate`, `pipeline`
aux valeurs affichées par l'implémentation TS actuelle (sur un périmètre <1000 où le
TS est juste). Documenter les écarts éventuels et corriger le SQL.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260605_dashboard_aggregates.sql
git commit -m "feat(db): rpc dashboard_aggregates"
```

---

### Task 8: Hook + types front pour `dashboard_aggregates`

**Files:**
- Create: `src/features/dashboard/hooks/use-dashboard-rpc.ts`
- Modify: `src/lib/supabase/types.ts` (régénération)

- [ ] **Step 1: Régénérer les types Supabase**

```bash
npx supabase gen types typescript --project-id geofmvmydyjuculbbmil > src/lib/supabase/types.ts
```
(ou via le MCP `generate_typescript_types`). Vérifier que `dashboard_aggregates`
apparaît sous `Database['public']['Functions']`.

- [ ] **Step 2: Écrire le hook RPC + le type de résultat**

```tsx
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DashboardFilters } from './use-dashboard-data'

export type DashboardAggregates = {
  total_count: number
  signed_revenue: number
  signed_count: number
  signed_guests: number
  avg_ticket_per_guest: number
  conversion_rate: number
  confirmed: number
  pending: number
  total_guests: number
  pipeline: {
    status_id: string
    name: string
    color: string
    slug: string
    count: number
    amount: number
  }[]
  by_restaurant: {
    id: string
    name: string
    color: string | null
    revenue: number
    signed_count: number
    avg_ticket: number
  }[]
  by_day_of_week: { dow: number; reservations: number; guests: number }[]
  by_type: { name: string; value: number }[]
}

function rpcArgs(f: DashboardFilters) {
  const iso = (d?: Date) => (d ? d.toISOString().slice(0, 10) : null)
  const arr = (s: Set<string>) => (s.size ? [...s] : null)
  const ct =
    f.clientType.size === 1
      ? f.clientType.has('b2b')
        ? 'b2b'
        : 'b2c'
      : null
  return {
    p_from_event: iso(f.eventDateRange?.from),
    p_to_event: iso(f.eventDateRange?.to),
    p_from_sign: iso(f.signDateRange?.from),
    p_to_sign: iso(f.signDateRange?.to),
    p_from_import: iso(f.importDateRange?.from),
    p_to_import: iso(f.importDateRange?.to),
    p_restaurants: arr(f.restaurants),
    p_statuses: arr(f.statuses),
    p_commercials: arr(f.commercials),
    p_client_type: ct,
  }
}

export function useDashboardAggregates(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard-aggregates', rpcArgs(filters)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'dashboard_aggregates',
        rpcArgs(filters)
      )
      if (error) throw error
      return data as unknown as DashboardAggregates
    },
    staleTime: 60 * 1000,
  })
}
```

- [ ] **Step 3: Vérifier build**

```bash
pnpm build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/dashboard/hooks/use-dashboard-rpc.ts src/lib/supabase/types.ts
git commit -m "feat(dashboard): hook useDashboardAggregates"
```

---

### Task 9: Câbler l'onglet Général sur les agrégats RPC

**Files:**
- Modify: `src/features/dashboard/components/general-tab.tsx`
- Modify: `src/features/dashboard/hooks/use-dashboard-data.ts`
- Modify: `src/features/dashboard/index.tsx`

- [ ] **Step 1: Exposer les agrégats depuis `useDashboardData`**

Dans `use-dashboard-data.ts`, ajouter l'appel `useDashboardAggregates(filters)` et
retourner `aggregates` dans l'objet. Conserver `bookings`/`contacts` pour l'instant
(les listes migrent en P2) mais ne plus les utiliser pour les KPI de l'onglet
Général.

- [ ] **Step 2: Lire les KPI/pipeline/by_restaurant depuis `aggregates`**

Dans `general-tab.tsx`, remplacer les `useMemo` qui appellent `calcSignedRevenue`,
`calcSignedCount`, `calcAvgTicketPerGuest`, `calcConversionRate`, `calcPipeline`,
`groupBySignedRestaurant` par la lecture directe des champs d'`aggregates`
(`signed_revenue`, `signed_count`, `avg_ticket_per_guest`, `conversion_rate`,
`pipeline`, `by_restaurant`). Le rendu (cartes, pie, liste restaurants) lit les
nouveaux champs (`revenue`, `signed_count`, `avg_ticket`, `color`). `pieData` dérive
de `by_restaurant`.

Les blocs "Actions requises" et "Derniers événements" restent sur `bookings` en P1
(migrés en P2). Passer `aggregates` en prop de tab via `tabProps`.

- [ ] **Step 3: Vérifier parité visuelle**

```bash
pnpm lint && pnpm build
```
Preview : comparer les 5 cartes KPI + pipeline + "CA par restaurant" du dashboard
avant/après sur un même org/filtre (périmètre <1000 où le TS est juste). Les
chiffres doivent coïncider.

- [ ] **Step 4: Commit**

```bash
git add src/features/dashboard/
git commit -m "feat(dashboard): onglet general sur rpc agregats"
```

---

### Task 10: Câbler l'onglet Événements (réservations) sur les agrégats RPC

**Files:**
- Modify: `src/features/dashboard/components/reservations-tab.tsx`

- [ ] **Step 1: Lire stats/répartitions depuis `aggregates`**

Remplacer `stats` (total/confirmed/pending/totalGuests/avgGuests), `byDayOfWeek`,
`byType` par les champs RPC : `total_count`, `confirmed`, `pending`, `total_guests`,
`avg_guests` (calculer `avg = round(total_guests/total_count)` côté front si non
fourni), `by_day_of_week` (réordonner Lun→Dim côté front depuis `dow`), `by_type`
(réassigner les couleurs côté front comme aujourd'hui). `monthlyTrend` et
`upcomingBookings` restent en P2.

- [ ] **Step 2: Vérifier + commit**

```bash
pnpm lint && pnpm build
git add src/features/dashboard/components/reservations-tab.tsx
git commit -m "feat(dashboard): onglet evenements sur rpc agregats"
```

---

## Phase P2 — RPC listes, marketing, commercial, séries mensuelles

### Task 11: Étendre `dashboard_aggregates` (commercial, source, séries 6 mois)

**Files:**
- Create: `supabase/migrations/20260606_dashboard_aggregates_v2.sql`

- [ ] **Step 1: Ajouter au `jsonb` les clés manquantes**

`create or replace` de `dashboard_aggregates` ajoutant : `by_commercial`,
`by_source` (joint `contacts` filtrés via `_dashboard_contact_ids` pour les leads),
`monthly_trend`, `monthly_revenue_by_restaurant`, `monthly_revenue_by_commercial`,
`monthly_leads_by_source`. Les séries 6 mois utilisent
`generate_series(date_trunc('month', now()) - interval '5 months',
date_trunc('month', now()), interval '1 month')` jointe en `left join` aux bookings
filtrés par `event_date` dans le mois (revenu = signés). `by_commercial` déplie
`assigned_user_ids` via `unnest` puis joint `users`.

Fournir le SQL complet de chaque agrégat sur le modèle de la Task 7 (mêmes règles
signés/primary). Vérifier la parité chiffrée par série contre le TS
(`getMonthlyTrend`, `getMonthlyRevenueByCommercial`, `getContactsBySource`,
`getMonthlyLeadsBySource`).

- [ ] **Step 2: Créer `_dashboard_contact_ids`**

Helper symétrique pour les contacts (filtre import sur `created_at`, commercial =
`assigned_to`, B2B/B2C via `company_id`), même en-tête de scoping org/rôle que
`_dashboard_booking_ids` (les restaurants ne scopent pas les contacts → seulement
l'org).

- [ ] **Step 3: Étendre le type + hook**

Ajouter les nouvelles clés à `DashboardAggregates`. Régénérer les types.

- [ ] **Step 4: Vérifier parité + commit**

```bash
pnpm build
git add supabase/migrations/20260606_dashboard_aggregates_v2.sql src/features/dashboard/hooks/use-dashboard-rpc.ts src/lib/supabase/types.ts
git commit -m "feat(db): rpc agregats commercial marketing series mensuelles"
```

---

### Task 12: RPC `dashboard_action_lists` + hook

**Files:**
- Create: `supabase/migrations/20260606_dashboard_action_lists.sql`
- Modify: `src/features/dashboard/hooks/use-dashboard-rpc.ts`

- [ ] **Step 1: Écrire la fonction listes**

`dashboard_action_lists(filtres...)` → `jsonb` avec :
- `action_items` : union (ordonnée) de — urgents (`event_date` entre today et today+2,
  non annulés, non `nouveau`, non (signé ET acompte payé)), retards (signés, non
  annulés, `event_date < now`, payé < total_ht primary), relances (`relance_paiement`),
  stale (devis `status in ('sent','signature_requested')`,
  `coalesce(signature_requested_at, quote_sent_at) < now - 3 days`). Chaque item :
  `{ type, booking_id, title, detail, event_date, restaurant, status_name,
  status_color, guests, amount, severity }`. `LIMIT 100`.
- `stale_proposals` : `LIMIT 50`.
- `recent_bookings` : 5 derniers par `event_date desc`.
- `upcoming_bookings` : 5 prochains (`event_date >= now`) par `event_date asc`.

Reproduire `getPaidAmount` (somme `payments` `status in (paid,completed)`). Réutiliser
`_dashboard_booking_ids` pour le périmètre. Vérifier la parité contre
`getStaleProposals` / `actionItems` TS.

- [ ] **Step 2: Hook `useDashboardActionLists`**

Même patron que `useDashboardAggregates` (mêmes `rpcArgs`), type
`DashboardActionLists`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260606_dashboard_action_lists.sql src/features/dashboard/hooks/use-dashboard-rpc.ts src/lib/supabase/types.ts
git commit -m "feat(db): rpc dashboard_action_lists"
```

---

### Task 13: Câbler Commercial, Marketing, et les listes des onglets

**Files:**
- Modify: `src/features/dashboard/components/commercial-tab.tsx`
- Modify: `src/features/dashboard/components/marketing-tab.tsx`
- Modify: `src/features/dashboard/components/general-tab.tsx`
- Modify: `src/features/dashboard/components/reservations-tab.tsx`
- Modify: `src/features/dashboard/hooks/use-dashboard-data.ts`

- [ ] **Step 1: Commercial**

Lire `by_commercial`, `monthly_revenue_by_commercial` depuis `aggregates` ;
`stale_proposals` depuis `action_lists`. Supprimer `groupByUser`,
`getMonthlyRevenueByCommercial`, `getStaleProposals` de l'onglet. `target`,
`bestPerformer`, `pieData` dérivent de `by_commercial` côté front (inchangé).

- [ ] **Step 2: Marketing**

Lire `by_source`, `monthly_leads_by_source`. Supprimer `getContactsBySource`,
`getMonthlyLeadsBySource` de l'onglet.

- [ ] **Step 3: Général & Événements — listes**

Général : `action_items`, `recent_bookings` depuis `action_lists`. Événements :
`monthly_trend`, `upcoming_bookings` depuis aggregates/lists. Retirer la dépendance à
`bookings`/`contacts` dans les 4 onglets.

- [ ] **Step 4: Nettoyer `useDashboardData`**

Supprimer `useBookings`/`useContacts` et tout le filtrage client (`filteredBookings`,
`filteredContacts`). `useDashboardData` ne fait plus que composer les 3 hooks RPC +
`currentUser`/`isAdmin`/`restaurants`/`users`/`statuses`. Garder ces derniers (listes
courtes pour les options de filtres).

- [ ] **Step 5: Supprimer les helpers de calcul morts**

```bash
pnpm knip
```
Supprimer de `use-dashboard-data.ts` les fonctions devenues inutilisées (calc*,
group*, getMonthly*, getReservations*, getContactsBySource, getStaleProposals…).
Vérifier que `SIGNED_SLUGS`/`CONFIRMED_SLUGS`/`getStaleProposals` ne sont plus
importés par `features/reservations` (la page Événements les importe — Task 14 si
besoin) avant suppression.

- [ ] **Step 6: Vérifier + commit**

```bash
pnpm lint && pnpm build && pnpm knip
git add src/features/dashboard/
git commit -m "feat(dashboard): onglets commercial marketing et listes sur rpc"
```

---

### Task 14: Découpler la page Événements des helpers dashboard

**Files:**
- Modify: `src/features/reservations/index.tsx`

- [ ] **Step 1: Retirer l'import depuis dashboard**

`reservations/index.tsx` importe `SIGNED_SLUGS`, `getStaleProposals` depuis
`@/features/dashboard/hooks/use-dashboard-data`. Déplacer `SIGNED_SLUGS` (et
`CONFIRMED_SLUGS`/`PENDING_SLUGS` si utilisés) dans un module partagé
`src/features/reservations/lib/status-slugs.ts` et importer de là, pour que la
suppression des helpers dashboard (Task 13) ne casse pas la page Événements. Le
filtre "stale" de la liste, s'il dépend de `getStaleProposals`, bascule sur le
filtrage serveur ou un calcul local minimal.

- [ ] **Step 2: Vérifier + commit**

```bash
pnpm lint && pnpm build
git add src/features/reservations/
git commit -m "refactor(evenements): slugs statut en module partage"
```

---

## Phase P3 — Temps de réponse (heures ouvrées en SQL)

### Task 15: RPC `dashboard_response_time`

**Files:**
- Create: `supabase/migrations/20260607_dashboard_response_time.sql`

- [ ] **Step 1: Porter le calcul heures ouvrées en SQL**

Fonction `dashboard_response_time(filtres...)` → `jsonb {avg_hours, count}`. Pour
chaque booking filtré ayant un premier `activity_logs` (`action_type =
'booking.status_changed'`, `lower(metadata->>'old_status') = 'nouveau'`), calculer
les heures ouvrées (Lun-Ven 9h-17h Europe/Paris) entre `created_at` et ce premier
log. Implémenter une fonction `_working_hours_between(ts1 timestamptz, ts2
timestamptz)` qui itère les jours via `generate_series` et somme l'intersection de
chaque journée avec [09:00,17:00] en `Europe/Paris`, en excluant samedi/dimanche
(`extract(isodow)` 6,7). Retourner la moyenne sur les bookings avec delta ≥ 0.

- [ ] **Step 2: Test de parité contre `computeWorkingHoursBetween`**

Choisir 5 paires (created_at, first_change) connues, calculer la valeur attendue
avec `src/features/dashboard/lib/working-hours.ts` (exécuter la fonction TS en
isolation, ex. un petit script node), et comparer à `_working_hours_between`.
Tolérance < 0.1h. Documenter les paires testées dans le commit.

- [ ] **Step 3: Hook + câblage Commercial**

`useDashboardResponseTime` ; remplacer `useAvgResponseTime` dans `commercial-tab.tsx`.
Supprimer `useAvgResponseTime` de `use-dashboard-data.ts`.

- [ ] **Step 4: Vérifier + commit**

```bash
pnpm lint && pnpm build && pnpm knip
git add supabase/migrations/20260607_dashboard_response_time.sql src/features/dashboard/
git commit -m "feat(db): rpc dashboard_response_time heures ouvrees"
```

---

## Clôture

### Task 16: Vérification finale + advisors

- [ ] **Step 1: Build/lint/knip complet**

```bash
pnpm lint && pnpm build && pnpm knip
```
Expected: PASS, aucun code mort résiduel.

- [ ] **Step 2: Advisors Supabase (sécurité/perf)**

Lancer `get_advisors` (security + performance) sur le projet et corriger les
nouvelles alertes liées aux fonctions (`search_path`, grants). Fixer
`set search_path = public` sur chaque fonction si l'advisor le réclame.

- [ ] **Step 3: Vérification multi-tenant**

Avec deux orgs de test, confirmer qu'un utilisateur de l'org A obtient des agrégats
ne couvrant que l'org A, et qu'un `commercial`/`gerant` ne voit que ses restaurants
assignés (RPC et page Événements).

- [ ] **Step 4: Récap dans la PR**

Ouvrir la PR `feat/dashboard-perf-rpc` (uniquement sur demande de l'utilisateur).
Lister : fix `/evenements`, défaut 30 j, titre popup, RPC agrégats/listes/temps de
réponse, index.

---

## Self-review (couverture spec)

- Défaut 30 j import → Task 3. ✓
- Fix `/evenements` (cap 1000) → Task 4. ✓
- Titre popup date → Task 2. ✓
- Index perf → Task 5. ✓
- Helpers `_dashboard_booking_ids`/`_dashboard_contact_ids` → Tasks 6, 11. ✓
- `dashboard_aggregates` (KPI/pipeline/restaurant/jour/type) → Tasks 7, 11. ✓
- `dashboard_action_lists` → Task 12. ✓
- `dashboard_response_time` → Task 15. ✓
- Câblage 4 onglets + suppression helpers TS → Tasks 9, 10, 13, 14. ✓
- Sécurité multi-tenant via auth.uid() → Tasks 6, 16. ✓
- Phasage P0→P3, critères d'acceptation, parité chiffrée → présents. ✓
