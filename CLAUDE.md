# CLAUDE.md

Ce fichier oriente Claude Code (claude.ai/code) lorsqu'il travaille dans ce dépôt.

## Projet

**MealEvent CRM** — CRM SaaS multi-tenant pour groupes de restaurants : gestion du pipeline commercial (prospects → devis → événements confirmés → paiements), planification d'événements (salons, menus, extras), et opérations quotidiennes. Interface en français.

## Stack

- **Frontend** : Vite 7 + React 19 + TypeScript (strict), TanStack Router (file-based, `src/routes/`), TanStack Query, TanStack Table
- **UI** : Tailwind v4 + shadcn/ui (customisés pour RTL), Radix UI, Lucide/Tabler icons, Sonner (toasts)
- **État** : Zustand (client), React Query (serveur), Context API (auth/theme/direction)
- **Formulaires** : React Hook Form + Zod
- **Backend** : Express 4 (`/backend`) — Stripe, Resend (email), Google Calendar, PDFMake
- **Base de données** : Supabase (PostgreSQL + Auth + RLS), migrations dans `/supabase/migrations/`
- **Package manager** : pnpm

## Commandes

```bash
# Frontend (racine)
pnpm dev            # Vite dev server (port 5173)
pnpm build          # tsc + vite build
pnpm lint           # ESLint
pnpm format         # Prettier
pnpm knip           # Détection de code mort

# Backend
cd backend && pnpm dev      # tsx watch (port 3001)
cd backend && pnpm build    # tsc
```

Voir [LOCALHOST.md](LOCALHOST.md) pour le setup complet des variables d'environnement.

## Architecture — règles clés

1. **Feature-folder pattern** : chaque domaine vit dans `src/features/<nom>/` avec `index.tsx`, `types.ts`, `data/`, `hooks/`, composants locaux. Ne pas éparpiller la logique feature dans `components/` ou `hooks/` globaux.
2. **Routing** : fichiers dans `src/routes/` — TanStack Router génère `routeTree.gen.ts` automatiquement (ne pas éditer à la main). Routes protégées sous `_authenticated/`, layouts groupés via `(auth)` / `(errors)`.
3. **Données serveur** : toujours via React Query hooks (`useX`, `useXMutation`) qui encapsulent le client Supabase. Ne pas appeler `supabase.from(...)` directement dans les composants.
4. **Multi-tenant** : tout est scopé par `organization_id`. Les politiques RLS Supabase font l'isolation — ne jamais contourner avec la service role key côté frontend.
5. **shadcn customisé** : plusieurs composants dans `src/components/ui/` ont été modifiés pour le support RTL (scroll-area, separator, sonner, etc.). Ne pas les réécraser via `npx shadcn add` sans vérifier.
6. **Types Supabase** : `src/lib/supabase/` contient les types générés (~2665 lignes). Les régénérer après une migration via Supabase CLI plutôt que d'éditer à la main.

## Conventions

- Composants : `PascalCase` ; hooks : `useX` ; features : `kebab-case` ; types exportés depuis `types.ts`
- Commentaires : minimalistes, en français si le code environnant l'est
- Migrations SQL : nommées `YYYYMMDD_description.sql`, jamais modifier une migration appliquée — en créer une nouvelle

## Documentation complémentaire

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — structure détaillée, patterns de données, flux d'auth
- [docs/DOMAIN.md](docs/DOMAIN.md) — modèle métier (entités, workflow commercial, rôles)
- [docs/DATABASE.md](docs/DATABASE.md) — schéma Supabase, RLS, conventions migrations
- [docs/FEATURES.md](docs/FEATURES.md) — carte des modules `src/features/*`
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — conventions de code, nommage, i18n, RTL
- [LOCALHOST.md](LOCALHOST.md) — setup environnement local
- [backend/README.md](backend/README.md) — API Express

## Points de vigilance

- **Ne jamais committer** : `.env`, `.env.local`, clés Stripe/Supabase service role, credentials Google
- **Tester les flux multi-tenant** : toujours vérifier qu'une mutation ne fuite pas entre organisations
- **Migrations** : lire [supabase/MIGRATION_ANALYSIS.md](supabase/MIGRATION_ANALYSIS.md) avant de toucher aux statuts (refactor en cours)
- **Google Calendar** : l'OAuth callback est sensible — voir commits récents sur `gcal`
