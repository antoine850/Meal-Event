# Gmail Phase 4b — Badges non-lu, composer contact, menu intégré — Design

Date : 2026-07-08
Statut : validé en conversation (surfaces badge, modèle lu partagé)
Prérequis : phase 4a mergée (7c3a158). Une migration à appliquer en prod
(idempotente, applicable dès maintenant, avant le merge de préférence).

## Objectif

Rendre les réponses clients impossibles à rater (pastilles non-lu), permettre
les emails ponctuels depuis la fiche contact, et faire passer le menu
templates « Envoyer un email » par le CRM (fil suivi, réponses capturées) au
lieu d'ouvrir Gmail dans un onglet.

## Décisions actées

1. **Surfaces non-lu** : pastille sur les lignes de la liste des réservations
   + badge compteur sur l'onglet Emails du booking. Pas de cloche globale.
2. **Modèle lu partagé équipe** : `email_threads.last_read_at` (une colonne).
   Ouvrir l'onglet Emails marque le fil lu pour toute l'équipe.
3. **Non lu = `last_inbound_at > coalesce(last_read_at, -infini)`**. Nouvelle
   colonne `last_inbound_at` bumpée par `recordInbound` (direction inbound
   seulement) : `last_message_at` bouge aussi sur nos envois, il ne peut pas
   servir (envoyer un devis allumerait la pastille).
4. **Le front ne peut pas écrire `email_threads`** (RLS SELECT-only, voulu) :
   marquage lu via `POST /api/emails/threads/:id/read` (garde org comme
   `/reply`).
5. **Route générique `POST /api/emails/send`** `{ bookingId | contactId,
   subject, message }` : email personnel brut (même builder texte+signature
   que `/reply`, factorisé), `emailType: 'manual_email'`, garde org sur la
   ressource visée. Sert le composer contact ET le menu templates.
6. **Menu templates** : si `integration_enabled`, le choix d'un template
   ouvre un dialog composer pré-rempli (sujet + corps rendus, éditables) qui
   envoie via `/send` ; sinon comportement actuel (Gmail compose URL) —
   zéro régression avant le pilote. L'auto-promotion « Nouveau » →
   « Qualification » est préservée sur les deux chemins.
7. **Composer contact** : bouton sur la fiche contact (gaté
   `integration_enabled` + contact avec email), fil contact-only
   (`threadKind: 'contact'`, premier producteur de cette plomberie phase 2).
   Le sujet saisi fige le fil.
8. Nuance sujet héritée du fil : sur un booking avec fil existant et master
   ON, le sujet envoyé suit le fil (« Re: Votre événement au X ») — le sujet
   du template/dialog ne s'applique qu'au premier message d'un fil contact
   ou master OFF. Cohérent avec devis/factures.

## Composants

### Migration `supabase/migrations/20260708_email_threads_read.sql`
`last_inbound_at` + `last_read_at` (IF NOT EXISTS) + backfill de
`last_inbound_at` depuis `email_messages`. Idempotente. À appliquer en prod
dès que possible (le code front tolère l'absence : les requêtes non-lu
échouent silencieusement en pastilles absentes, mais autant l'appliquer
avant le merge).

### Backend
- `recordInbound` (email-threads.ts) : bump `last_inbound_at` si inbound.
- `routes/emails.ts` : `POST /threads/:id/read` (marque lu, garde org) ;
  `POST /send` (booking XOR contact, garde org, `manual_email`) ; helper
  `buildPlainHtml` partagé avec `/reply`.

### Frontend
- `hooks/use-thread-unread.ts` : `useUnreadBookingThreads()` (Set des
  `booking_id` non lus de l'org, refetch 60 s — porte sur les seuls fils
  ayant au moins un entrant, volume faible ; cap PostgREST 1000 acceptable à
  ce stade, noté) ; `useThreadMeta(bookingId)` (2 colonnes, badge onglet) ;
  `useMarkThreadRead()` (mutation → route read, invalide les 2 queries).
- `BookingEmailsTab` : effet à l'ouverture — si fil non lu, `markRead`.
- `bookings-columns.tsx` : composant `UnreadDot bookingId` (pastille) dans la
  première colonne (React Query dédupe la requête partagée).
- `booking-detail-page.tsx:185` : badge sur le `TabsTrigger value='emails'`.
- `components/send-email-dialog.tsx` (features/emails) : dialog générique
  (sujet + message, pré-remplissable), mutation `/send`, gaté par l'appelant.
- `send-email-menu.tsx` : si `integration_enabled`, `handlePick` rend le
  template et ouvre le dialog au lieu de `window.open` ; auto-promotion dans
  `onSent`.
- `contact-detail-page.tsx` : bouton « Envoyer un email » (header) →
  dialog avec `contactId`.

## Hors périmètre

Cloche globale/inbox, realtime, lu par utilisateur, pièces jointes (phase 5),
capture des réponses aux fils contact envoyés en Resend (même limitation
générale que les envois Resend, phase 5).

## Tests / vérification

- Backend : câblage étendu (routes `/send` et `/read` passent par
  `sendClientEmail`/garde org, `recordInbound` bump `last_inbound_at`).
- Frontend : `pnpm build` + tsc ; vérification preview (pastille, badge,
  dialog, bouton contact) quand un environnement local est disponible.
