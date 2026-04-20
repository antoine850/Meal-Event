# Architecture

## Vue d'ensemble

Application full-stack en deux processus :

```
┌─────────────────┐    HTTPS    ┌──────────────────┐     ┌──────────────┐
│  Frontend Vite  │ ──────────► │  Backend Express │ ──► │   Supabase   │
│  React 19 + TS  │             │  Node + TS       │     │  (PG + Auth) │
│  port 5173      │ ─────────── │  port 3001       │     │  RLS enabled │
└─────────────────┘   Supabase  └──────────────────┘     └──────────────┘
        │           JS SDK (auth, lectures RLS-safe)            ▲
        └───────────────────────────────────────────────────────┘
```

Le frontend parle directement à Supabase pour les lectures/écritures classiques (RLS fait l'autorisation). Il passe par le backend Express pour : paiements Stripe, emails (Resend), génération PDF, OAuth Google Calendar, opérations nécessitant la service role key.

## Structure `src/`

```
src/
├── routes/                 # TanStack Router file-based
│   ├── __root.tsx          # Layout racine (providers)
│   ├── (auth)/             # Layout group : sign-in, sign-up, OTP
│   ├── (errors)/           # Pages 401/403/404/500
│   ├── _authenticated/     # Routes protégées (sidebar layout)
│   │   ├── dashboard/
│   │   ├── settings/
│   │   └── ...
│   ├── r.$slug.tsx         # Liens publics (menus, formulaires)
│   └── routeTree.gen.ts    # GÉNÉRÉ — ne pas éditer
│
├── features/               # Modules métier (voir FEATURES.md)
│
├── components/
│   ├── ui/                 # shadcn/ui (customisés RTL)
│   ├── layout/             # Sidebar, header, command menu
│   └── data-table/         # Wrapper TanStack Table
│
├── context/                # auth, theme, direction (RTL), font
├── hooks/                  # Hooks partagés (use-mobile, use-permissions…)
├── lib/
│   ├── supabase/           # Client Supabase + types générés
│   ├── api-client.ts       # Axios wrapper vers backend
│   └── utils.ts            # cn(), helpers
└── main.tsx                # Entry — monte router + providers
```

## Patterns de données

### Lectures
```ts
// src/features/contacts/hooks/use-contacts.ts (exemple de pattern)
export function useContacts(orgId: string) {
  return useQuery({
    queryKey: ['contacts', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('organization_id', orgId)
      if (error) throw error
      return data
    },
  })
}
```

Règles :
- **Une clé par ressource** : `['contacts', orgId]`, `['booking', id]`.
- **Invalider finement** après mutation : `queryClient.invalidateQueries({ queryKey: ['contacts'] })`.
- **Pas de `supabase.from(...)` dans les composants** — toujours via un hook feature.

### Mutations
React Query `useMutation` + `onSuccess` pour invalidation + toast Sonner.

## Authentification

- Supabase Auth (email + OTP). Pas de passwords côté app en production.
- `src/context/auth-provider.tsx` initialise la session au chargement et écoute `onAuthStateChange`.
- Routes sous `_authenticated/` redirigent vers `/sign-in` si pas de session.
- Le `organization_id` actif est résolu via la table `users` (et non `organization_members`) — voir commit `292951b`.

## Routing — TanStack Router

- File-based : un fichier = une route. Segments dynamiques `$param`, layouts via fichiers sans underscore.
- `_authenticated` est un **layout route** — son composant enveloppe toutes les routes enfants.
- Navigation : `<Link to="/path" />` ou `useNavigate()`. Types de paramètres inférés automatiquement.
- Codegen : Vite plugin `@tanstack/router-plugin` regénère `routeTree.gen.ts` à chaque changement.

## État global

| Type                         | Solution                           |
| ---------------------------- | ---------------------------------- |
| Server state                 | React Query                        |
| UI globale (theme, dir, org) | Zustand + Context                  |
| Form state                   | React Hook Form                    |
| URL state                    | TanStack Router search params      |

## Backend Express

- Rôle : orchestration de ce que le frontend ne peut pas faire en sécurité (clés secrètes).
- Endpoints typiques : `/api/stripe/*`, `/api/pdf/*`, `/api/email/*`, `/api/gcal/callback`.
- Utilise la **service role key Supabase** côté serveur uniquement.
- Voir [backend/README.md](../backend/README.md).

## Build & déploiement

- Frontend : `pnpm build` → `dist/` statique, déployable sur n'importe quel host (Vercel, Netlify, S3).
- Backend : `pnpm build` → `backend/dist/`, déployable en Node 20+ (Render, Railway, Fly).
- Variables d'env : `VITE_*` côté frontend, reste côté backend.
