# Gmail Phase 3 — Réception des réponses (polling) — Design

Date : 2026-07-08
Statut : validé en conversation (infra polling + notifications tranchées)
Prérequis : feat/gmail-phase-2 (envoi + fils), migrations 20260706 + 20260707

## Objectif

Faire remonter les réponses clients dans `email_messages` de façon fiable :
polling Gmail par boîte connectée, curseur `history_id` qui avance, cas limites
gérés. Phase 100 % backend : pas d'UI, pas de sous-système de notification.

## Décisions structurantes

1. **Trigger : `setInterval` in-process.** Le backend Render est always-on
   (plan payant), donc pas de problème de sommeil. Même pattern que le
   nettoyage des rate-limits (`api-auth.ts`, `public.ts`). La logique vit dans
   une fonction `runGmailPoll()` découplée du trigger : passer à un cron
   externe plus tard = swap trivial. Pas de verrou multi-instance : l'index
   unique sur `gmail_message_id` déduplique et le curseur est idempotent
   (at-least-once safe).
2. **Notifications : ingestion seule.** Le « non-lu » se dérivera de
   `email_messages.direction='inbound'` au read-time (badge/compteur = Phase
   4, où il est déjà rangé). L'alerte « boîte révoquée » réutilise le plumbing
   existant : `markAccountRevoked` flippe `status='revoked'`, le bandeau
   réglages le lit via `getGmailAccountStatus`. Dédup naturelle entre ticks
   (le statut ne flippe qu'une fois).

## Composants

- `isGmailPollingEnabled()` (`gmail.ts`) — calqué sur `isGmailSendingEnabled()` :
  master ON **et** `GMAIL_POLLING_ENABLED === 'true'`. Kill-switch indépendant
  de l'envoi. Lu au démarrage de la boucle : flip = restart (Render redémarre
  sur changement d'env de toute façon).
- `backend/src/lib/gmail-poll.ts` (nouveau) :
  - helpers purs : `collectAddedStubs` (stubs `messagesAdded` hors
    SPAM/TRASH/DRAFT — chaque autosave de brouillon crée un `messageAdded` à id
    neuf qui ne se réconcilie jamais avec le message envoyé — dédupliqués entre
    pages), `classifyDirection` (From == boîte ⇒ outbound), `getHeader`,
    `parseAddress`, `parseAddressList`, `extractBodies` (walk du payload MIME,
    base64url, charset du Content-Type respecté — Gmail décode le
    transfer-encoding mais pas le charset, et windows-1252 reste courant chez
    les expéditeurs français).
  - `pollAccount(gmail, account)` — poll d'une boîte, client injecté.
  - `resyncAccount(...)` — chemin 404 (historyId expiré).
  - `runGmailPoll()` — orchestrateur : gate flag, itère les boîtes
    `status='connected'`, isole les erreurs par boîte.
  - `startGmailPolling()` — `setInterval` + garde in-flight (un tick lent ne
    s'empile pas).
- `recordInbound(...)` (`email-threads.ts`) — jumeau de `recordOutbound` :
  insert `email_messages` avec `direction` paramétrée, `provider='gmail'`,
  `body_text`/`snippet` remplis, headers RFC. Idempotent : violation d'unicité
  `23505` sur `gmail_message_id` = déjà en base, pas une erreur. (Pas d'upsert
  `onConflict` : l'index unique est partiel, PostgREST ne sait pas le cibler.)
- Trigger dans `index.ts` : `startGmailPolling()` dans le callback de
  `app.listen`.

## Flux d'un tick (par boîte)

1. Fils suivis de la boîte : `gmail_thread_id → thread_id` depuis
   `email_messages` où `sender_user_id = boîte` (un fil naît toujours d'un
   envoi CRM de cette boîte). Requête paginée par `.range()` : PostgREST cappe
   à 1000 lignes et tronque en silence (fil absent = réponses perdues).
2. `history_id` null ? → seed via `getProfile`, fin du tick pour cette boîte.
3. `history.list(startHistoryId, historyTypes=[messageAdded])` + pagination.
4. Filtre **sur les stubs** (id + threadId + labelIds, pas de fetch) :
   threadId ∈ fils suivis, labels sans SPAM/TRASH/DRAFT.
5. Skip des ids déjà en base (nos propres envois CRM notamment) — pas de
   `messages.get` inutile, économie de quota sur le scope restricted. Requête
   chunkée par 500 ids (`.in()` casse vers ~1500 ids, réponse cappée à 1000).
6. `messages.get(format=full)` sur les survivants → `recordInbound` + bump
   `last_message_at`.
7. Batch complet OK → persiste le nouveau `history_id` (celui de la réponse
   `history.list`) + `last_sync_at = now`.

Direction : `from_email == google_email` de la boîte ⇒ `outbound`
(`sender_user_id = boîte` — le commercial a répondu depuis Gmail hors CRM,
cas bonus du spec général), sinon `inbound` (`sender_user_id = null`).

## Cas limites

| Cas                             | Traitement                                                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `history_id` null (boîte neuve) | seed via `getProfile`, skip le fetch ce tick                                                                                                                                                          |
| `history_id` expiré → **404**   | resync borné aux fils suivis de la boîte : `threads.get` par fil, ingestion des manquants, re-seed via `getProfile`. Un fil supprimé côté Gmail (404) est sauté. Jamais avalé en silence (warn loggé) |
| **401 / invalid_grant**         | `classifyGmailError` ⇒ `markAccountRevoked` (existant) → bandeau réglages                                                                                                                             |
| **429 / 5xx**                   | curseur inchangé, erreur loggée ; le tick suivant (3 min) reprend au même point — l'intervalle **est** le backoff                                                                                     |
| SPAM / TRASH / DRAFT            | exclus au filtre labelIds (stubs et resync)                                                                                                                                                           |
| Message supprimé avant le fetch | `messages.get` → 404 (cas documenté Gmail) : message sauté, le curseur avance (même pattern que `threads.get` au resync)                                                                              |
| Même email vu par deux boîtes   | `gmail_message_id` est un id PAR boîte (répondre-à-tous, commercial en copie ⇒ deux ids pour un même email) : index unique `(thread_id, rfc_message_id)` (migration 20260708), la 2e ingestion rebondit en 23505 |
| Expéditeur ≠ email du contact   | stocké tel quel (`from_email` brut) ; marqueur « autre adresse » = dérivation read-time en Phase 4, pas de colonne                                                                                    |
| Boîte en erreur                 | isolée : ne bloque pas les autres boîtes du tick                                                                                                                                                      |
| Échec en cours de batch         | curseur non avancé → re-traitement au tick suivant, redédupliqué par `gmail_message_id` (at-least-once)                                                                                               |

## Hors scope (→ Phase 5)

- Pièces jointes entrantes.
- Capture des réponses aux envois Resend (+ prérequis : stocker un Message-ID
  sur les envois Resend, aujourd'hui `null`).
- Mail client spontané hors fil suivi (limitation assumée du spec général).

## Migration & config

- **Une migration post-audit** : `20260708_email_messages_rfc_dedup.sql`
  (index unique partiel `(thread_id, rfc_message_id)` — dédup inter-boîtes).
  Le reste existait déjà : `last_sync_at`, l'index unique `gmail_message_id`,
  `body_text`/`snippet`/`in_reply_to`/`references_header`.
  Le poller tourne en service-role comme le reste du stack email.
- Config : `GMAIL_POLLING_ENABLED` (reader ajouté) ;
  `GMAIL_POLLING_INTERVAL_MS` (nouveau, défaut 180000 = 3 min).

## Tests (style du repo)

- Helpers purs : tests unitaires directs (`collectAddedStubs` dédup + filtre
  spam/trash, `classifyDirection`, parsing adresses/headers, `extractBodies`
  multipart imbriqué).
- Flag : test env calqué sur `gmail-integration-flag.test.ts`.
- Orchestration : test de câblage par lecture de source (style
  `gmail-routes.test.ts` / `client-email-callsites.test.ts`) — gate flag,
  `historyTypes`, persistance curseur après batch, chemin 404 → resync +
  `getProfile`, `markAccountRevoked` sur revoked, `23505` toléré,
  `startGmailPolling()` dans `index.ts`.
