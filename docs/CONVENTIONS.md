# Conventions de code

## Nommage

| Élément              | Convention       | Exemple                        |
| -------------------- | ---------------- | ------------------------------ |
| Composant React      | PascalCase       | `ContactDialog`, `BookingCard` |
| Hook                 | `use` + camel    | `useContacts`, `usePermissions`|
| Fichier composant    | kebab-case       | `contact-dialog.tsx`           |
| Fichier hook         | kebab-case       | `use-contacts.ts`              |
| Dossier feature      | kebab-case       | `src/features/reservations/`   |
| Type / Interface     | PascalCase       | `Contact`, `BookingStatus`     |
| Constante            | UPPER_SNAKE_CASE | `DEFAULT_STATUSES`             |
| Variable / fonction  | camelCase        | `bookingId`, `formatPrice()`   |
| Table SQL            | snake_case plur. | `booking_events`               |
| Colonne SQL          | snake_case       | `organization_id`              |

## Imports

- Ordre géré par **prettier-plugin-sort-imports** — ne pas réordonner à la main.
- Chemins absolus via alias `@/` (configuré dans `tsconfig.json` et `vite.config.ts`).

```ts
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useContacts } from '@/features/contacts/hooks/use-contacts'
import type { Contact } from '@/features/contacts/types'
```

## TypeScript

- **Strict mode activé**. Pas de `any` — utiliser `unknown` ou typer correctement.
- Préférer `type` à `interface` sauf pour les contrats étendables.
- Types Supabase : toujours importer depuis `@/lib/supabase/` (générés, pas de duplication).
- `as const` pour les listes de valeurs finies.

## Composants

- Un composant = un fichier. Pas de re-exports barrel `index.ts` superflus à l'intérieur des features.
- Props typées via `type Props = { ... }` juste au-dessus du composant.
- Pas de `React.FC` — déclarer la fonction directement : `export function Foo({ ... }: Props) {}`.
- shadcn : composer, ne pas forker. Si modification RTL nécessaire, la faire dans `src/components/ui/<name>.tsx` et documenter.

## Styles

- **Tailwind v4** uniquement. Pas de CSS modules ni styled-components.
- `cn()` de `@/lib/utils` pour merger les classes conditionnelles.
- Variants avec **class-variance-authority (cva)**.
- Dark mode via `dark:` prefix.
- **RTL** : les composants UI critiques sont déjà RTL-safe. Utiliser `start`/`end` plutôt que `left`/`right` quand possible.

## Formulaires

React Hook Form + Zod systématiquement :

```ts
const schema = z.object({ name: z.string().min(1) })
const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
```

Composants `<Form>` de shadcn pour relier les champs.

## React Query

- Clés structurées : `['resource', id, ...filters]`.
- Mutation → invalidation ciblée + toast Sonner (succès/erreur).
- Pas de `refetchOnWindowFocus` désactivé globalement sans raison.

## Internationalisation

- UI et libellés métier **en français**. Code et commentaires : français ou anglais, rester cohérent dans un fichier.
- Dates formatées avec `date-fns` locale `fr`.
- Prix en EUR, format `1 234,56 €` (Intl.NumberFormat `fr-FR`).

## Commentaires

- Par défaut : aucun commentaire. Le code doit se lire seul.
- Commenter le **pourquoi** (contrainte métier, workaround), jamais le **quoi**.
- Pas de TODO sans ticket associé.

## Git

- Commits conventionnels : `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`.
- Scope optionnel entre parenthèses : `fix(gcal): ...`.
- PR : voir `.github/PULL_REQUEST_TEMPLATE.md`.

## Lint & format

- Avant commit : `pnpm lint && pnpm format:check`.
- `pnpm knip` périodiquement pour nettoyer les exports morts.
- Ne pas désactiver de règle ESLint sans commentaire justificatif.
