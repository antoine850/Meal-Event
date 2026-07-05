# Intégration Gmail — gestion des emails clients en fil unique

Date : 2026-06-26, révisé le 2026-07-05
Statut : design validé (révision du 05/07 intégrant l'audit du code du 04/07 et les nouveaux besoins)

## Objectif

Gérer les échanges email avec les clients **directement dans le CRM**, dans des **boucles de mail
suivies** au lieu d'envois transactionnels isolés. Quand un commercial est affecté à un booking,
ses devis et ses échanges partent **depuis son propre Gmail** (Workspace Pasparisien), et les
réponses du client **remontent dans le CRM**.

Besoins couverts (ajouts du 04/07 en gras) :
- envoyer devis, factures d'acompte/solde et échanges depuis la boîte du commercial, dans le fil ;
- **emails ponctuels depuis la fiche contact** (y compris contact sans booking) ;
- **onglet « Emails » sur la page de détails événement** avec la trace de tous les envois
  (Gmail + Resend historiques) ;
- **avoir envoyé par email** (flux inexistant aujourd'hui, déclenché manuellement) ;
- fallback complet sur Resend si le commercial n'a pas connecté de Gmail (prod inchangée).

## Décisions verrouillées

| Sujet | Décision |
|---|---|
| Boîte mail | Une par commercial : chaque commercial connecte son Gmail (OAuth par utilisateur). |
| Granularité des fils | **Hybride** : un fil par booking (devis + acompte + solde), un fil par contact pour les ponctuels hors booking, un fil « facturation » séparé si le destinataire principal change (ex : compta@). |
| Sujet du fil | Figé au premier message, envois suivants en `Re: …`. Fil booking ouvert au premier devis (sujet généré depuis l'événement, ex « Votre événement du 12/09 — Pasparisien ») ; fil contact ouvert au premier ponctuel (sujet saisi dans le composer). |
| Expéditeur | **L'acteur connecté** (celui qui clique) s'il a un Gmail actif ; sinon le commercial assigné (`assigned_user_ids[0]`) s'il en a un ; sinon Resend. Les flux automatiques (acompte post-signature) partent du commercial assigné. |
| Multi-boîtes | Un fil CRM peut traverser plusieurs boîtes (multi-acteur, réassignation) : le threading côté client repose sur `References`/`In-Reply-To` (Message-ID RFC 2822) + sujet en `Re:`, pas sur le threadId Gmail. On suit un `gmail_thread_id` par boîte impliquée. |
| Capture des réponses | Polling ciblé (cron backend) via `history.list`, pas de Gmail watch/Pub-Sub. |
| Envoi | Gmail API `messages.send`, MIME RFC 2822 construit via nodemailer/MailComposer (base64url), `threadId` + `In-Reply-To`/`References` depuis `rfc_message_id`. |
| Fallback | Resend reste le défaut. Fallback **uniquement sur erreur franche avant envoi** (400/401/403). Sur timeout/5xx ambigu : vérification `rfc822msgid:` via gmail.readonly avant de décider. **Jamais** de fallback sur un échec de journalisation. |
| Activation | Deux switches env distincts `GMAIL_SENDING_ENABLED` / `GMAIL_POLLING_ENABLED` (défaut OFF) + flag pilote `user_gmail_accounts.sending_enabled` (défaut false, activé à la main). |
| App Google | Écran de consentement **Internal** (mono-groupe, même Workspace) → aucun audit/CASA. |
| Stockage tokens | Table dédiée `user_gmail_accounts`, refresh token **chiffré** (clé en env), accessible **service-role uniquement** (aucune policy SELECT client sur le token). Tranché : pas de stockage en clair. |
| State OAuth | **Signé** (HMAC + expiration) et vérifié au callback — le pattern Calendar actuel (state brut) est vulnérable CSRF, à corriger au passage. |

### Périmètre des envois passant par le fil

Tous via `sendClientEmail()` :
1. devis (`send-email`) ;
2. acompte (`send-deposit`) ;
3. solde (`send-balance`) ;
4. **acompte auto post-signature** (`autoSendDepositAfterSignature` dans webhooks.ts — flux
   dupliqué à fusionner avec `send-deposit` en phase 0bis, envoi déclenché hors réponse du
   webhook pour éviter les retries SignNow → double facture Stripe) ;
5. re-envois acompte/solde (aujourd'hui sans PJ ni log) ;
6. lien de paiement manuel (`payments.ts create-link`) ;
7. **relance de paiement** : `/api/payments/:id/remind` n'envoie aucun email aujourd'hui — créer
   le vrai email de relance dans le fil ;
8. **avoir** : créer le flux d'envoi (PDF seul aujourd'hui), déclenché manuellement via le
   dropdown d'envoi.

Hors fil : fiche de fonction (pas d'envoi email), invitations équipe, notifications internes
commerciales (restent Resend).

## Prérequis

- **Phase 0 (fait, commit 30ae346)** : résolution du commercial via `assigned_user_ids[0]` dans
  quotes.ts, commercial-notifications.ts, webhooks.ts, payments.ts. `bookings.ts` GET référence
  encore la FK supprimée `bookings_assigned_to_fkey` mais n'est pas consommé par l'UI — à traiter
  séparément.
- Avant la phase 2 : exécuter `round_recompute_quotes.py --apply` (chantier arrondis) pour ne pas
  ouvrir des fils avec des devis aux anciens montants ; committer les specs untracked.

## Architecture

### 1. Connexion (OAuth par commercial)

- Même app Google Cloud que Calendar, scopes ajoutés : `gmail.send` + `gmail.readonly`.
- Flux OAuth par utilisateur : routes connect/callback dédiées, `state` signé HMAC portant
  `user_id` + expiration, vérifié au callback avant toute écriture.
- Au callback : `users.getProfile` → `history_id` initial ; `users.settings.sendAs.list` →
  adresse d'envoi effective (From = `google_email` du compte, les alias non déclarés sont
  réécrits silencieusement par Gmail).
- Helper `gmailClient(userId)` : charge le refresh token (déchiffré), instancie le client Google,
  refresh délégué à la lib comme Calendar.
- UI : bouton « Connecter mon Gmail » dans les réglages **utilisateur** (pas restaurant), avec
  statut connecté, email, déconnexion, et bandeau « à reconnecter » si `status = 'revoked'`.

### 2. Modèle de données

**`user_gmail_accounts`** (nouvelle) — 1:1 utilisateur :
`id`, `user_id`, `organization_id`, `google_email`, `refresh_token` (chiffré), `scopes`,
`history_id`, `status` (`connected`/`revoked`), `sending_enabled` (bool, défaut false — flag
pilote), `last_sync_at`, `last_error`, `connected_at`. Lecture/écriture service-role uniquement ;
le front lit le statut via un endpoint backend, jamais la table.

**`email_threads`** (nouvelle) — le fil côté CRM :
`id`, `organization_id`, `kind` (`booking`/`contact`/`facturation`), `booking_id` (nullable),
`contact_id` (nullable), `subject`, `last_message_at`, `status` (`open`/`closed`).
Contraintes : `CHECK (booking_id IS NOT NULL OR contact_id IS NOT NULL)` ; unique partiel
`(booking_id, kind)` où `booking_id IS NOT NULL` ; un seul fil `contact` ouvert par contact.
La fiche contact lit les fils booking via la jointure booking→contact (pas le `contact_id`
dénormalisé du thread, qui peut diverger après correction du contact d'un booking).

**`email_messages`** (nouvelle) — un message du fil, quel que soit le transport :
`id`, `thread_id`, `direction` (`outbound`/`inbound`), `provider` (`gmail`/`resend`),
`sender_user_id` (nullable, la boîte/acteur), `gmail_thread_id` (le thread de la boîte
expéditrice, null si Resend), `gmail_message_id` (UNIQUE, null si Resend),
`rfc_message_id` (Message-ID RFC 2822 — généré par nous au send, lu du header au polling ;
aussi renseigné pour Resend via son API), `from_email`, `to_emails`, `cc`, `subject`,
`body_html`, `body_text`, `snippet`, `sent_at`, `in_reply_to`, `references`.
Les envois fallback Resend sont matérialisés dans le fil dès la phase 2 (marqueur « parti hors
fil » dans l'UI), pas en phase 5.

**`email_logs`** (existante, extensions additives rétrocompatibles) :
`+ provider` (défaut `'resend'`), `+ gmail_thread_id`, `+ gmail_message_id`. Les colonnes
`status`/`error_message` (jamais utilisées en échec aujourd'hui) le deviennent : **chaque
tentative** est loggée (`sent`/`failed`), ce qui donne la métrique du taux de fallback.
Ajouter la RLS org manquante (aucune policy aujourd'hui) si lecture front directe, sinon
lecture via endpoint/RPC.

**Vue unifiée** `booking_email_activity` (vue ou RPC) : union `email_messages` + lignes
`email_logs` sans message correspondant (historique pré-fil), dédup par
`gmail_message_id`/`resend_message_id`, tri `sent_at`. Rendu dégradé assumé pour les lignes
logs-seules (type + destinataire + date, sans corps).

### 3. Flux d'envoi — `sendClientEmail()`

Signature indicative :
`sendClientEmail({ actorUserId?, bookingId?, contactId?, threadKind?, to, cc?, subject?, html, attachments?, emailType })`
→ `{ provider, threadId?, messageId }` (le transport réellement utilisé remonte à l'UI).

```
résoudre le fil : booking (kind selon destinataire) ou contact
résoudre la boîte : acteur connecté + sending_enabled → sa boîte
                    sinon commercial assigné connecté   → sa boîte
                    sinon                                → Resend
SI boîte Gmail ET GMAIL_SENDING_ENABLED :
    construire le MIME (MailComposer) : Message-ID pré-généré, sujet du fil en Re:,
    In-Reply-To/References depuis le rfc_message_id du dernier message du fil,
    threadId de CETTE boîte s'il existe pour ce fil, PDF en pièce jointe
    try messages.send :
        succès → insert email_messages + email_logs (provider gmail) en best-effort
                 (un échec DB ne déclenche JAMAIS de fallback, log serveur)
    catch :
        invalid_grant/401 → status 'revoked' + notification unique + fallback Resend
        400/403 franche   → fallback Resend
        timeout/5xx       → recherche rfc822msgid: ; trouvé → traiter comme succès ;
                            introuvable → fallback Resend
        429               → retry backoff court, puis fallback sans toucher au status
SINON :
    Resend (chemin actuel) + insert email_messages (provider resend, rfc_message_id Resend)
    + email_logs
```

Idempotence : le re-clic sur send-deposit ne recrée pas de facture Stripe (réutiliser l'invoice
existante < 30 j comme aujourd'hui, mais logger le re-envoi).

### 4. Flux de réception — polling ciblé

Cron backend (2–5 min, si `GMAIL_POLLING_ENABLED`) par compte connecté :
- `history.list(startHistoryId, historyTypes=messageAdded)` avec pagination `nextPageToken` ;
  filtrage applicatif sur les `gmail_thread_id` suivis **de ce compte** (distincts depuis
  `email_messages`) ;
- `messages.get` sur les nouveaux messages ; insert `email_messages` inbound (dédup par
  `UNIQUE(gmail_message_id)`), `rfc_message_id` lu du header ; maj `last_message_at` ;
- le `history_id` persisté est celui de la réponse `history.list`, écrit **seulement après
  traitement complet du batch** ; backoff exponentiel sur 429/5xx ;
- `404` (historyId expiré, rétention ~1 semaine) : resync bornée par `threads.get` sur les fils
  `open` de ce compte, puis re-seed du `history_id` via `getProfile` — jamais avalé en silence ;
- `invalid_grant` dans le cron : `status = 'revoked'` + `last_error` + notification unique au
  commercial (dédupliquée entre ticks) + bandeau réglages ;
- messages SPAM/TRASH exclus ; expéditeur différent de l'email du contact → `from_email` brut
  affiché avec un marqueur « adresse différente du contact ».

Limite structurelle à communiquer aux commerciaux : `history.list` voit passer les métadonnées de
toute la boîte (c'est l'API qui veut ça) ; seule la **lecture du contenu** (`messages.get`) est
restreinte aux threads suivis. Un nouveau mail spontané du client (pas une réponse) n'est pas
capté — hors scope, documenté.

Bonus conservé : si le commercial répond depuis Gmail (hors CRM) dans un thread suivi, le polling
capte le message, le fil CRM reste complet.

### 5. UI

Feature-folder `src/features/emails/`.

- **Page événement** : nouvel onglet « Emails » — timeline unifiée (fil Gmail entrants/sortants +
  envois Resend historiques, dédupliqués), zone de réponse en bas (via `sendClientEmail`), badge
  = vrai count (le badge Historique actuel est codé en dur à 0). Composant d'onglet séparé —
  ne pas grossir le monolithe booking-detail.tsx (170 Ko). L'onglet Historique (activity_logs)
  reste inchangé.
- **Fiche contact** : 3e onglet « Emails » (fils booking via jointure + fil contact), composer
  pour les ponctuels (templates org réutilisés, sujet libre). Sans Gmail connecté : envoi Resend
  tracé (reply-to commercial), la réponse n'est pas captée — même logique de fallback.
- **Menu « Envoyer un email » actuel** (tableau événements + dropdown Actions) : remplacé par le
  composer intégré. Le chemin « ouvrir Gmail web » disparaît (chaque usage ferait un trou dans le
  fil).
- **Réglages utilisateur** : connexion Gmail (cf. §1).
- Fils dont la boîte est révoquée/déconnectée : état visible « réponses non suivies ».

## Configuration Google Cloud (à faire une fois)

1. Même projet que Calendar ; écran de consentement **Internal**.
2. Ajouter les scopes `gmail.send` et `gmail.readonly`.
3. Déclarer la redirect URI du callback Gmail.
4. Documenter `GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT_URI` dans `.env.example` et LOCALHOST.md
   (absents aujourd'hui, credentials uniquement en prod).

## Stratégie de non-régression / mise en prod sereine

- **Phase 0bis déployable seule** : 100 % Resend, aucun changement de comportement visible, mais
  envoi factorisé + journalisation complète + onglet trace déjà en prod.
- **Deux kill switches** : `GMAIL_SENDING_ENABLED` OFF → tout repart en Resend instantanément ;
  `GMAIL_POLLING_ENABLED` indépendant → couper l'envoi ne coupe pas la capture des réponses des
  fils en cours (et vice-versa).
- **Pilote réel** : `sending_enabled` activé à la main pour un seul commercial (Thomas), les
  autres peuvent connecter leur boîte sans que leurs envois basculent.
- **Fallback Resend** sur toute erreur franche → un devis part toujours ; les fallbacks sont
  visibles (marqueur dans le fil + métrique `email_logs.provider`), pas silencieux.
- **Tokens chiffrés**, service-role only, state OAuth signé (tranché, plus « à trancher »).

## Découpage en phases

- **Phase 0** — fix `assigned_to` → `assigned_user_ids[0]` (fait, commit 30ae346).
- **Phase 0bis** — refactor 100 % Resend, livrable seul : `sendClientEmail()` au-dessus de
  Resend, fusion de `autoSendDepositAfterSignature` avec `send-deposit`, journalisation
  `email_logs` sur tous les call sites client (y compris échecs et re-envois), RLS/canal de
  lecture, **onglet « Emails » en version trace**.
- **Phase 1** — Fondations Gmail : config Google Cloud, migrations (3 tables + colonnes
  `email_logs`), OAuth par user (state signé, token chiffré, `history_id` + sendAs au callback),
  UI de connexion réglages utilisateur. Aucun changement d'envoi.
- **Phase 2** — Envoi : transport Gmail dans `sendClientEmail` (MIME, sujets `Re:`, vérification
  timeout, classification des erreurs), fils booking/contact/facturation, relance réelle, flux
  avoir, composer fiche contact (backend).
- **Phase 3** — Réception : cron polling complet (cas limites §4) + notifications in-app.
- **Phase 4** — UI : fil de conversation dans l'onglet Emails (lecture + réponse), composer sur
  la fiche contact, remplacement du menu email, badge.
- **Phase 5** — Finitions : pièces jointes entrantes, capture des réponses aux emails Resend
  (match `References` sur le Message-ID Resend stocké), état « réponses non suivies », polish.

## Hors scope (pour l'instant)

- Fiche de fonction par email.
- Boîte de réception Gmail complète dans le CRM ; boîte partagée par organisation.
- Multi-tenant External / audit Google (un seul groupe aujourd'hui).
- Nouveaux mails spontanés du client (non-réponses) — non captés par le polling.
- Réécriture de `bookings.ts` GET (route non consommée, à traiter à part).
