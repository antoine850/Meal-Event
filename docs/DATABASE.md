# Base de données

## Supabase

Projet hébergé Supabase (PostgreSQL 15+). Deux clés :
- **Anon key** (frontend, `VITE_SUPABASE_ANON_KEY`) — soumise aux politiques RLS.
- **Service role key** (backend uniquement, `SUPABASE_SERVICE_ROLE_KEY`) — bypass RLS. **Jamais** dans le bundle frontend.

## Tables principales

Regroupées par domaine (voir [DOMAIN.md](DOMAIN.md) pour le sens métier).

### Tenant
`organizations`, `users`, `invitations`, `roles`

### Restaurants
`restaurants`, `spaces`, `time_slots`, `google_calendar_integration`

### CRM
`contacts`, `companies`, `statuses`

### Bookings
`bookings`, `booking_events`, `booking_extras`

### Menus
`products`, `packages`, `menu_forms`

### Facturation
`payments`, `attachments`

### Audit
`activity_logs`

## Row Level Security (RLS)

RLS est **activé partout**. Pattern standard :

```sql
-- Exemple : contacts visibles uniquement aux membres de l'organisation
CREATE POLICY "org members read contacts"
  ON contacts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
```

Règles à respecter :
- Toute nouvelle table avec `organization_id` doit avoir des policies par opération (SELECT / INSERT / UPDATE / DELETE).
- Jamais de `USING (true)` en production.
- Vérifier qu'une requête ne fuite pas entre tenants en testant avec deux comptes différents.

## Migrations

Dossier : `supabase/migrations/`
Convention de nommage : `YYYYMMDD_description.sql` (ex : `20260416_payments_attachment_columns.sql`).

### Règles d'or
1. **Ne jamais modifier** une migration déjà appliquée en prod. Créer une nouvelle migration.
2. Les migrations doivent être **idempotentes quand possible** (`IF NOT EXISTS`, `CREATE OR REPLACE`).
3. Toujours inclure : création de table/colonne + indexes + policies RLS + commentaires.
4. Tester localement via Supabase CLI avant de merger.

### Workflow
```bash
# Créer une migration
supabase migration new ma_feature

# Appliquer en local
supabase db reset

# Régénérer les types TypeScript
supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

## Types générés

Fichier : `src/lib/supabase/` (~2665 lignes). Généré par Supabase CLI.
- **Ne jamais éditer à la main** — régénérer après chaque migration.
- Utilisé par le client Supabase pour typer les requêtes (`supabase.from('bookings').select()` → typé).

## Refactors en cours

- **Statuts booking-only** : migration ajoutant une contrainte `type = 'booking'` à la table `statuses`. Les contacts n'ont plus de statuts. Voir `supabase/MIGRATION_ANALYSIS.md`.
- **Paiements & attachments** : colonnes récemment ajoutées (avril 2026, migration `20260416_...`).

## Edge Functions

Aucune pour l'instant. Toute la logique backend est dans Express (`/backend`).

## Audits

- `supabase/DETAILED_SCHEMA_AUDIT.md` — rapport d'audit du schéma.
- `supabase/MIGRATION_ANALYSIS.md` — stratégie de refactor.

## Dumps & seeds

Scripts d'import dans `/scripts/`. Utilisés pour onboarder de nouveaux clients avec leurs données legacy.
