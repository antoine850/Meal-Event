# Modèle métier

## Contexte

**MealEvent** sert des groupes de restaurants qui commercialisent des **événements privés** (séminaires, mariages, dîners d'entreprise). Le CRM couvre tout le cycle : capter le prospect → qualifier → proposer → confirmer → livrer l'événement → encaisser.

## Entités principales

### Hiérarchie tenant
- **Organization** — le client SaaS (ex : un groupe de 3 restaurants).
- **Restaurant** — un établissement physique. Chaque restaurant a ses espaces, menus, intégrations.
- **User** — membre d'une organisation avec un rôle (voir `roles`). Résolu côté app via la table `users`.
- **Invitations** — pour ajouter des membres à une organisation.

### CRM / ventes
- **Contact** — une personne (prospect ou client).
- **Company** — une entreprise cliente (SIRET, TVA, adresse de facturation).
- **Booking** — une demande de réservation d'événement. C'est l'entité pivot du pipeline commercial.
- **Status** — étape du pipeline d'un booking (`nouveau`, `qualification`, `proposition`, `confirmed`, `paid`, …). ⚠️ Les statuts sont maintenant scopés au type `booking` uniquement (refactor en cours, voir [supabase/MIGRATION_ANALYSIS.md](../supabase/MIGRATION_ANALYSIS.md)).

### Opérations événement
- **Booking Event** — détails d'exécution d'un booking confirmé : date, heure, nombre de convives, allergies, contact sur place, demandes spéciales.
- **Space** — un espace du restaurant (salon privatisé, terrasse, salle principale).
- **Time Slot** — créneaux de disponibilité.
- **Product / Package** — items du menu et forfaits traiteur avec prix.
- **Menu Form** — formulaire digital envoyé au client pour choisir son menu.
- **Booking Extra** — options ajoutées (vin, animation, déco).

### Facturation & suivi
- **Payment** — acomptes et règlements (lien Stripe).
- **Attachment** — contrats signés, factures PDF (migration récente : `20260416_payments_attachment_columns.sql`).
- **Activity Log** — audit trail de toutes les actions (qui a changé quoi, quand).

### Intégrations
- **Google Calendar Integration** — sync bookings confirmés vers le calendrier du restaurant. OAuth par restaurant. Callback : `/settings/restaurant/:id` (singulier).
- **Stripe** — paiements via checkout sessions.
- **Resend** — emails transactionnels (confirmations, relances).

## Workflow commercial

```
Nouveau contact
      │
      ▼
  [Booking créé, status=nouveau]
      │
      ▼
  Qualification (budget, date, nombre)
      │
      ▼
  Proposition (devis PDF, menus proposés)
      │
      ▼
  Confirmé (acompte reçu, Google Calendar sync)
      │
      ▼
  Événement livré
      │
      ▼
  Soldé (paiement final)
```

Chaque transition met à jour `status_id` et crée une entrée dans `activity_logs`.

## Rôles utilisateurs (haut niveau)

- **Owner** — accès total à l'organisation.
- **Admin** — gestion équipe + settings.
- **Sales** — CRM, bookings, contacts.
- **Operations** — planning événements, menus.
- **Viewer** — lecture seule.

Détails exacts dans la table `roles` et les hooks `use-permissions`.

## Spécificités métier

- **Dates/horaires flexibles** : un booking peut être proposé avec plusieurs options de dates avant confirmation.
- **Multi-restaurant** : un booking appartient à un restaurant précis ; un utilisateur peut avoir accès à plusieurs restaurants de son organisation.
- **Numérotation bons de commande** : chaque événement a un numéro affiché sous la date (voir commit `c622842`).
- **Liens publics** : routes `r.$slug` pour partager des menus/formulaires sans authentification.
- **Localisation** : tout en français (UI, statuts, emails, PDFs).

## Pour aller plus loin

- Schéma détaillé : [supabase/DETAILED_SCHEMA_AUDIT.md](../supabase/DETAILED_SCHEMA_AUDIT.md)
- Migrations historiques : `supabase/migrations/`
- Spécifications client (redesign dashboard) : mémoire persistante Claude
