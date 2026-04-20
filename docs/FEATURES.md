# Carte des features

Chaque dossier de `src/features/` est un module autonome.

## Structure-type d'une feature

```
src/features/<nom>/
├── index.tsx           # Composant page principal
├── types.ts            # Interfaces TS du domaine feature
├── data/               # Constantes, mock, options de select
├── hooks/              # useX / useXMutation (React Query)
└── components/         # Composants spécifiques à la feature
```

Règle : si un composant n'est utilisé que par cette feature, il reste local. S'il devient partagé par 2+ features, il remonte dans `src/components/`.

## Modules

### `auth/`
Sign-in, sign-up, OTP, forgot-password, reset-password. Utilise Supabase Auth.

### `dashboard/`
Vue d'ensemble avec onglets **general** et **commercial**. Graphiques via Recharts. Hook agrégateur : `hooks/use-dashboard-data.ts`. Redesign récent (voir mémoire persistante `project_dashboard_redesign.md`).

### `contacts/`
Liste + fiche des contacts (prospects/clients). CRUD via hooks. Le fichier `data/contacts.ts` a été retiré (plus de mock).

### `companies/`
Entreprises clientes avec infos de facturation (SIRET, TVA).

### `reservations/`
Création et suivi des bookings (réservations d'événement). Cœur du pipeline commercial.

### `contracts/`
Gestion des contrats associés aux bookings. Génération PDF.

### `events/`
Planning et logistique des événements confirmés (menus finaux, allergies, contact sur place).

### `settings/` (sous-modules)
- `profile/` — infos personnelles utilisateur
- `account/` — email, password
- `organization/` — nom, logo, adresse
- `appearance/` — thème
- `display/` — préférences d'affichage
- `members/` — invitations, rôles
- `restaurants/` — restaurants de l'organisation, OAuth Google Calendar par restaurant
- `products/` — catalogue menu
- `packages/` — forfaits traiteur
- `menus/` — menus configurables
- `statuses/` — personnalisation du pipeline
- `notifications/` — préférences notifs
- `api-docs/` — documentation API publique
- `google-calendar/` — intégration calendrier

### `tasks/`
Tâches assignables aux membres de l'équipe.

### `users/`
Administration des utilisateurs (pour admins).

### `chats/`
Messagerie interne (beta).

### `errors/`
Pages d'erreur (401, 403, 404, 500, general-error, maintenance).

### `public/`
Pages accessibles sans authentification (liens partagés aux clients : `r.$slug`).

### `apps/`
Intégrations tierces et marketplace.

## Ajouter une nouvelle feature

1. Créer `src/features/<nom>/` avec la structure-type.
2. Ajouter les routes correspondantes dans `src/routes/_authenticated/<nom>/`.
3. Ajouter une entrée dans la sidebar : `src/components/layout/data/sidebar-data.ts`.
4. Créer les hooks React Query + les types.
5. Si la feature a besoin de tables Supabase : créer une migration + régénérer les types.
6. Vérifier les permissions via `use-permissions`.
