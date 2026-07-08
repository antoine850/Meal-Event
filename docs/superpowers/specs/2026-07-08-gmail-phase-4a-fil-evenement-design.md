# Gmail Phase 4a — Fil email sur la page événement — Design

Date : 2026-07-08
Statut : validé en conversation (découpage, style de réponse, gating)
Prérequis : merge 161db20 (phases 2-3) sur main ; migrations 20260706/20260707/20260708 appliquées en prod.

## Objectif

Rendre le fil email visible et actionnable sur la page événement : l'onglet
Emails affiche la conversation (envoyés + reçus) et permet de répondre.
C'est la première itération de la phase 4 ; le badge compteur, le composer
fiche contact et le remplacement du menu « envoyer un email » suivront.

## Décisions actées

1. **Le fil remplace le contenu de l'onglet Emails existant.** Le composant
   actuel (liste `email_logs`) devient un bloc repliable « Journal des
   envois » sous le fil — il garde les échecs et l'historique pré-fil, que
   `email_messages` ne porte pas. Pas de vue unifiée avec dédup fuzzy
   (révision de la décision du 04/07 : la dédup logs/messages par
   `gmail_message_id` ne couvre pas les envois Resend, séparation nette
   fil / journal à la place).
2. **Le fil est visible même master OFF** (il montre les envois Resend,
   écrits depuis le merge). **Tout ce qui touche aux réponses est gaté** sur
   `integration_enabled` (déjà exposé par `GET /api/gmail/status`) : zone de
   réponse masquée quand OFF ; s'active au flip du switch sans redéploiement.
3. **Réponse = email personnel brut** : texte simple, retours à la ligne,
   signature « Prénom Nom » de l'acteur. Pas d'habillage brandé (les
   devis/factures gardent leur template, eux).
4. **Destinataire de la réponse** : le `from_email` du dernier message
   entrant du fil, sinon l'email du contact du booking (comportement
   « répondre » naturel quand le client écrit depuis une autre adresse).
5. **Types Supabase ajoutés à la main** (email_threads, email_messages) au
   format généré exact, dérivés des migrations 20260706/20260707 — le MCP
   Supabase est non autorisé et la CLI sans token. La prochaine régénération
   officielle les écrasera avec un résultat identique.

## Composants

### Frontend (`src/features/emails/`)

- `hooks/use-email-thread.ts` — `useBookingEmailThread(bookingId)` : fil
  `email_threads` (booking_id, kind='booking') puis messages ordonnés
  `sent_at` asc. `refetchInterval` 45 s (pas de realtime, YAGNI).
  RLS `select_org` fait l'isolation.
- `components/email-thread-view.tsx` — la conversation : sujet du fil en
  tête, messages en cartes différenciées entrant/sortant. Corps :
  `body_html` **sanitisé DOMPurify** (nouvelle dépendance front — un email
  client est un vecteur XSS réel), fallback `body_text` puis `snippet`
  (désescapé : Gmail renvoie le snippet HTML-échappé). Conteneur borné
  (max-h + scroll). Expéditeur : « Vous » / `from_email`, avec marqueur
  « autre adresse » si `from_email` ≠ email du contact (dérivation
  read-time, pas de colonne).
- `components/email-reply-composer.tsx` — textarea + Envoyer, rendu
  seulement si `integration_enabled` (hook `useGmailStatus` existant).
  Mutation `POST /api/emails/reply` via `apiClient`, invalidation de la
  query du fil au succès.
- `components/booking-emails-tab.tsx` — remanié : fil + composer +
  `<details>` « Journal des envois » avec la liste actuelle. Labels
  `EMAIL_TYPE_LABELS` complétés (payment_reminder, credit_note,
  manual_reply — manquants depuis la phase 2).
- Call site (`booking-detail.tsx:3163`) : passe `contactEmail` en plus de
  `bookingId` (le booking est déjà chargé sur la page).

### Backend

- `routes/emails.ts` (nouveau) — `POST /api/emails/reply`
  `{ bookingId, message }`, monté `requireAuth` sur `/api/emails` :
  résout booking + contact (400 si contact sans email), destinataire
  (décision 4), html minimal échappé (nl2br + signature acteur), puis
  `sendClientEmail({ emailType: 'manual_reply', actorUserId, ... })` — le
  dispatcher gère déjà fil, sujet (« Re: » événement), boîte Gmail,
  fallback Resend, journalisation. La route n'est pas gatée : master OFF ⇒
  l'envoi part en Resend (l'UI masque le composer de toute façon).
- `src/lib/supabase/types.ts` — types `email_threads`/`email_messages` +
  alias `EmailThread`/`EmailMessage` (décision 5).

## Sécurité

- DOMPurify sur tout `body_html` entrant, profil html standard. Les images
  distantes restent autorisées (v1, emails clients en contiennent rarement).
- Le html de la réponse est construit côté serveur à partir de texte
  échappé — pas de html libre depuis le front.
- Multi-tenant : lecture via RLS `select_org` ; la route reply vérifie le
  booking et passe par le plumbing service-role existant.

## Hors périmètre (itération 4b)

Badge compteur onglet, marquage lu/non-lu (aucune table de lecture),
composer fiche contact (fils contact-only), remplacement du menu
« envoyer un email », realtime.

## Tests / vérification

- Backend : test de câblage style `client-email-callsites` — la route
  reply passe par `sendClientEmail` (pas de sendEmail direct), montée avec
  `requireAuth` dans `index.ts`.
- Frontend : pas de harnais de tests dans le repo — vérification par
  `pnpm build` (tsc strict) + preview navigateur (fil affiché, composer
  gaté, journal repliable).
