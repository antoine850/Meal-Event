# Stripe Connect par restaurant — Design

**Date** : 2026-05-05
**Statut** : Design validé, prêt pour planification d'implémentation
**Auteur** : Discussion brainstorming Thomas / Claude

---

## 1. Contexte & problème

### Situation actuelle

MealEvent CRM utilise aujourd'hui **une seule clé Stripe plateforme** (`STRIPE_SECRET_KEY`) pour créer tous les paiements Checkout / Invoice de tous les restaurants de tous les clients (organisations). Concrètement :

- L'argent des paiements clients atterrit sur le compte Stripe MealEvent puis devrait être redistribué (ce qui n'est pas implémenté).
- Aucune ségrégation comptable ni légale par restaurant.
- Les colonnes `settings.stripe_account_id`, `settings.stripe_public_key`, `settings.stripe_secret_key` existent en BDD mais sont **inutilisées** dans le code (faux amis).
- Le toggle `restaurants.stripe_enabled` existe et fonctionne — quand il est à `false`, le système bascule sur un flux **virement bancaire** (utilisant `restaurants.iban / bic / bank_name`).

### Problème

Pour un groupe de restaurants (Bocuse, Pic, Robuchon...), chaque restaurant est typiquement **une entité juridique séparée** avec son propre IBAN, son SIRET, sa TVA. Les paiements clients doivent atterrir **directement** sur le compte bancaire du restaurant concerné, pas transiter par MealEvent.

### Objectif

Permettre à un admin d'organisation de **lier un compte Stripe distinct à chaque restaurant** via OAuth Stripe Connect Standard, de sorte que :
- Chaque paiement événement utilise le compte Stripe du restaurant concerné
- L'argent va directement sur l'IBAN du restaurant (charges directes, sans transit)
- MealEvent ne touche aucune commission sur les transactions
- Le système reste fonctionnel pour les restaurants qui n'ont pas (encore) connecté Stripe (fallback virement bancaire existant)

---

## 2. Décisions clés (validées en brainstorming)

| # | Décision | Justification |
|---|---|---|
| 1 | **Stripe Connect Standard (OAuth)** comme intégration | Standard de l'industrie, gratuit, chaque restaurant garde son compte indépendant, support officiel Stripe |
| 2 | **Per-restaurant uniquement** — pas de compte Stripe au niveau organisation | Plus simple, plus flexible. L'orga n'a pas de rôle business sur les paiements |
| 3 | **Fallback virement bancaire** quand un restaurant n'a pas connecté Stripe | Réutilise le flux existant (`stripe_enabled = false` + IBAN sur restaurant) |
| 4 | **Seul l'admin org-wide** peut connecter / déconnecter un compte Stripe sur les restaurants | Action sensible (paiements vont au mauvais IBAN si erreur). Le gérant voit le statut sans pouvoir modifier |
| 5 | **Aucune commission MealEvent** sur les transactions | Modèle SaaS abonnement, pas marketplace. Évite la complexité comptable |
| 6 | **Mode legacy temporaire** lors du rollout | Permet zéro casse en prod : les restaurants non-connectés continuent à fonctionner via la clé plateforme jusqu'à leur migration |

---

## 3. Architecture

### 3.1 Vue d'ensemble multi-tenant

```
                 MealEvent CRM (plateforme Stripe Connect)
                                 │
                                 │ OAuth Connect Standard
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
   Org A: Bocuse              Org B: Pic               Org C: Robuchon
    │                          │                          │
    ├─ Resto Lyon             ├─ Resto Valence           ├─ Resto Tokyo
    │   acct_bocuse_lyon      │   acct_pic_valence       │   acct_robuchon_tokyo
    ├─ Resto Paris            └─ Resto Lausanne          └─ Resto Las Vegas
    │   acct_bocuse_paris         acct_pic_lausanne          acct_robuchon_vegas
    └─ Resto Marseille
        acct_bocuse_marseille
```

**Propriétés clés** :
- Tous les `acct_xxx` sont **siblings** côté Stripe — aucun lien entre eux dans Stripe
- La hiérarchie `Org → Restaurant → acct` n'existe **que dans la BDD MealEvent**
- L'argent va **directement** du client vers le compte du restaurant (pas de transit MealEvent)
- L'isolation entre orgs est garantie côté MealEvent par `organization_id` + 3 lignes de défense (Section 8)

### 3.2 Flux utilisateur — connexion d'un restaurant

```
1. Admin orga → Settings > Restaurants > [Restaurant X] > Compte Stripe
2. Clic "Connecter Stripe"
3. → Backend GET /api/stripe-connect/oauth/authorize?restaurant_id=X
4. ← Renvoie URL OAuth Stripe avec state token
5. Frontend window.location.href = url (redirection Stripe)
6. Stripe demande login + montre les comptes accessibles via cet email
7. User choisit un compte → autorise
8. Stripe → backend GET /api/stripe-connect/oauth/callback?code=ac_xxx&state=token
9. Backend valide state → échange code contre acct_xxx → store en BDD
10. Backend redirect → frontend /settings/restaurants/X?stripe_success=1
11. Frontend toast "Compte connecté" + UI mise à jour
```

### 3.3 Flux paiement — création d'un lien

```
1. Commercial crée un lien de paiement pour booking#42 (Restaurant X)
2. Backend lit booking → restaurant → restaurant.stripe_account_id
3. Arbre de décision (resolveStripeMode) :
   ├── stripe_enabled = false → flux virement bancaire (existant)
   ├── stripe_enabled = true + acct_id + charges_enabled → Stripe Connect
   ├── stripe_enabled = true + pas d'acct_id + LEGACY_MODE = true → clé plateforme (transition)
   └── stripe_enabled = true + pas d'acct_id + LEGACY_MODE = false → erreur 412
4. Si Connect : stripe.checkout.sessions.create({...}, { stripeAccount: acct_xxx })
5. L'argent arrive directement sur le compte bancaire du restaurant
```

### 3.4 Flux webhook

Tous les events arrivent sur le même endpoint `/api/webhooks/stripe`. Distinction via `event.account` :
- `event.account = undefined` → event plateforme (legacy)
- `event.account = 'acct_xxx'` → event Connect (compte restaurant)

---

## 4. Modèle de données

### 4.1 Migration unique additive

**Fichier** : `supabase/migrations/20260506_stripe_connect_per_restaurant.sql`

```sql
-- ═══════════════════════════════════════════════════════════════
-- Stripe Connect Standard — per-restaurant connected accounts
-- ═══════════════════════════════════════════════════════════════

-- 1. Restaurants : ID du compte Stripe connecté + métadonnées
ALTER TABLE restaurants
  ADD COLUMN stripe_account_id VARCHAR(255),
  ADD COLUMN stripe_account_name VARCHAR(255),
  ADD COLUMN stripe_account_email VARCHAR(255),
  ADD COLUMN stripe_connected_at TIMESTAMPTZ,
  ADD COLUMN stripe_connected_by UUID REFERENCES users(id),
  ADD COLUMN stripe_charges_enabled BOOLEAN DEFAULT false,
  ADD COLUMN stripe_payouts_enabled BOOLEAN DEFAULT false,
  ADD COLUMN stripe_disabled_reason VARCHAR(255);

CREATE UNIQUE INDEX idx_restaurants_stripe_account_unique
  ON restaurants(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- 2. Payments : audit + scoping webhook
ALTER TABLE payments
  ADD COLUMN stripe_account_id VARCHAR(255);

CREATE INDEX idx_payments_stripe_account_id
  ON payments(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- 3. Payment_links : idem
ALTER TABLE payment_links
  ADD COLUMN stripe_account_id VARCHAR(255);

CREATE INDEX idx_payment_links_stripe_account_id
  ON payment_links(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- 4. OAuth states : protection CSRF sur callback
CREATE TABLE stripe_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token VARCHAR(255) UNIQUE NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '15 minutes'),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX idx_stripe_oauth_states_token ON stripe_oauth_states(state_token);
CREATE INDEX idx_stripe_oauth_states_expires ON stripe_oauth_states(expires_at);

-- 5. Marquer les colonnes inutilisées comme dépréciées (DROP en Phase 6)
COMMENT ON COLUMN settings.stripe_account_id IS 'DEPRECATED: use restaurants.stripe_account_id instead';
COMMENT ON COLUMN settings.stripe_public_key IS 'DEPRECATED: not used';
COMMENT ON COLUMN settings.stripe_secret_key IS 'DEPRECATED: not used';
```

### 4.2 Justification de chaque colonne

| Colonne | Rôle |
|---|---|
| `stripe_account_id` | LE seul champ vraiment indispensable. Tout le reste = métadonnées d'affichage / audit |
| `stripe_account_name` / `_email` | Affichage UI : "Connecté à **Bocuse Lyon SAS** (admin@bocuse.fr)" |
| `stripe_connected_at` / `_by` | Audit : qui a connecté, quand |
| `stripe_charges_enabled` / `_payouts_enabled` | Synchro depuis webhook `account.updated`. Si `charges_enabled = false` → bloquer création de paiements + alerte UI |
| `stripe_disabled_reason` | Affichage UI si Stripe demande KYC complémentaire |
| `payments.stripe_account_id` | Audit + filtrage. **Crucial** : `NULL` pour paiements legacy (clé plateforme), `acct_xxx` pour Connect |
| `stripe_oauth_states` | **Protection CSRF** sur OAuth callback. Sans ça → vulnérabilité critique |

### 4.3 Régénération des types TypeScript

Après application de la migration :
```bash
supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
```

---

## 5. Backend — nouveaux endpoints

### 5.1 Routes OAuth

#### `GET /api/stripe-connect/oauth/authorize?restaurant_id=<uuid>`
Authentifié, **admin org-wide uniquement**.
1. Vérifier que `restaurant_id` appartient à l'organisation de l'utilisateur (anti-IDOR)
2. Générer state token (`crypto.randomBytes(32).toString('hex')`)
3. Insérer en BDD : `stripe_oauth_states { state_token, organization_id, restaurant_id, user_id, expires_at: now+15min }`
4. Construire URL OAuth Stripe :
   ```
   https://connect.stripe.com/oauth/authorize
     ?response_type=code
     &client_id=ca_xxx
     &scope=read_write
     &state=<token>
     &redirect_uri=<STRIPE_CONNECT_REDIRECT_URI>
     &stripe_user[email]=<email pré-rempli>
   ```
5. Retourner `{ url }`

#### `GET /api/stripe-connect/oauth/callback?code=<code>&state=<token>`
**Public** (Stripe redirige sans nos cookies). Sécurité = state token.

1. Lookup state token : `SELECT * FROM stripe_oauth_states WHERE state_token = $1 AND consumed_at IS NULL AND expires_at > now()`
   - Si non trouvé → redirect `/settings/restaurants/:id?stripe_error=invalid_state`
2. **Mark as consumed (atomic, anti-replay)** :
   ```sql
   UPDATE stripe_oauth_states SET consumed_at = now()
   WHERE state_token = $1 AND consumed_at IS NULL
   RETURNING *
   ```
   - Si 0 rows → quelqu'un a déjà consommé → abort
3. Échange code → acct_id : `await stripe.oauth.token({ grant_type: 'authorization_code', code })`
4. **Vérifier unicité** : `SELECT id FROM restaurants WHERE stripe_account_id = $1 AND id != $2`
   - Si déjà lié → redirect avec `stripe_error=already_linked` (sans révéler quel restaurant — protection cross-org)
5. Lire détails Stripe : `await stripe.accounts.retrieve(acctId)`
6. UPDATE restaurants avec `stripe_account_id`, `stripe_account_name`, `stripe_account_email`, `stripe_connected_at`, `stripe_connected_by`, `stripe_charges_enabled`, `stripe_payouts_enabled`, `stripe_disabled_reason`
7. Auto-activer `stripe_enabled = true` (si pas déjà)
8. Activity log : `restaurant.stripe_connected`
9. Redirect `${FRONTEND_URL}/settings/restaurants/${restaurant_id}?stripe_success=1`

#### `POST /api/stripe-connect/disconnect`
Body : `{ restaurant_id }`. Authentifié, admin org-wide.
1. Vérifier ownership
2. Lire `stripe_account_id`
3. `await stripe.oauth.deauthorize({ client_id, stripe_user_id: acctId })` — catch errors gracefully (peut être déjà déconnecté côté Stripe)
4. UPDATE restaurants : nullifier toutes les colonnes Stripe Connect
5. Activity log : `restaurant.stripe_disconnected`
6. **Ne pas toucher** aux `payments.stripe_account_id` historiques (audit préservé)

#### `GET /api/stripe-connect/restaurants/:id/status`
Authentifié, admin org-wide. Lit le statut courant chez Stripe et update les colonnes locales (`charges_enabled`, `payouts_enabled`, `disabled_reason`).

### 5.2 Webhook handlers (modifs + ajouts)

**Endpoint inchangé** : `POST /api/webhooks/stripe`. Stripe envoie events plateforme + Connect au même endpoint avec `event.account` discriminant.

**Switch case complet** :

```ts
switch (event.type) {
  // ── Existants (à upgrader Connect-aware) ──
  case 'checkout.session.completed':
    await handlePaymentSuccess(event.data.object, event.account)
    break
  case 'invoice.paid':
    await handleInvoicePaymentSuccess(event.data.object, event.account)
    break
  case 'payment_intent.succeeded':
    console.log(`PaymentIntent succeeded: ${(event.data.object as any).id}`)
    break
  case 'payment_intent.payment_failed':
    await handlePaymentFailed(event.data.object, event.account)
    break

  // ── Nouveaux Connect lifecycle ──
  case 'account.updated':
    await handleAccountUpdated(event.data.object as Stripe.Account)
    break
  case 'account.application.deauthorized':
    await handleAccountDeauthorized(event.account)
    break

  // ── Nouveaux events business (visibilité refunds / disputes / payouts) ──
  case 'charge.refunded':
    await handleChargeRefunded(event.data.object as Stripe.Charge, event.account)
    break
  case 'charge.dispute.created':
    await handleDisputeOpened(event.data.object as Stripe.Dispute, event.account)
    break
  case 'charge.dispute.closed':
    await handleDisputeClosed(event.data.object as Stripe.Dispute, event.account)
    break
  case 'payout.paid':
    await handlePayoutPaid(event.data.object as Stripe.Payout, event.account)
    break

  default:
    console.log(`Unhandled event type: ${event.type}`)
}
```

**Filtrage events parasites** : tous les handlers `handle*` vérifient les `metadata` (`booking_id`, `quote_id`) et **ignorent silencieusement** les events qui n'ont pas notre signature (cas où le restaurant utilise son Stripe en parallèle pour autre chose).

### 5.3 Comportement détaillé des nouveaux handlers

#### `handleAccountUpdated(account)`
```ts
await supabase.from('restaurants').update({
  stripe_charges_enabled: account.charges_enabled,
  stripe_payouts_enabled: account.payouts_enabled,
  stripe_disabled_reason: account.requirements?.disabled_reason || null,
}).eq('stripe_account_id', account.id)
```

#### `handleAccountDeauthorized(acctId)`
Le restaurant a déconnecté MealEvent depuis SON dashboard Stripe → on nettoie côté MealEvent.
```ts
await supabase.from('restaurants').update({
  stripe_account_id: null,
  stripe_account_name: null,
  stripe_account_email: null,
  stripe_charges_enabled: false,
  stripe_payouts_enabled: false,
}).eq('stripe_account_id', acctId)
// + activity_log avec actor_type: 'webhook'
```

#### `handleChargeRefunded(charge, acctId)`
Le restaurant a remboursé le client depuis son dashboard Stripe.
1. Lookup payment via `stripe_payment_intent_id = charge.payment_intent`
2. Si trouvé : update `payments.status = 'refunded'`, log activity `payment.refunded`
3. Notifier le commercial assigné (réutilise `notifyCommercialPayment` adapté)

#### `handleDisputeOpened(dispute, acctId)`
Litige client (chargeback) — important à remonter.
1. Lookup payment via `stripe_payment_intent_id = dispute.payment_intent`
2. Insert ligne dans une nouvelle table `payment_disputes` (ou simple log dans `activity_logs` selon préférence)
3. **Notifier admin orga** (email + bandeau in-app) : action urgente requise
4. Marquer `payments.status = 'disputed'` (nouvelle valeur d'enum à ajouter)

#### `handleDisputeClosed(dispute, acctId)`
1. Update activity log avec l'issue (`dispute.status`: 'won' / 'lost' / 'warning_closed')
2. Si `lost` → laisser `payments.status = 'disputed'` ou ajouter `'dispute_lost'`
3. Si `won` → repasser `payments.status = 'paid'`

#### `handlePayoutPaid(payout, acctId)`
Confirmation que Stripe a viré l'argent à l'IBAN du restaurant. Information bonus — on log juste un activity_log pour l'admin.

### 5.4 Helper centralisé — `backend/src/lib/stripe-connect.ts`

```ts
import Stripe from 'stripe'
import { supabase } from './supabase.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')
const LEGACY_MODE = process.env.STRIPE_CONNECT_LEGACY_MODE === 'true'

export interface RestaurantStripeContext {
  restaurantId: string
  organizationId: string
  stripeEnabled: boolean
  stripeAccountId: string | null
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

export async function getRestaurantStripeContext(restaurantId: string)
  : Promise<RestaurantStripeContext | null> { /* SELECT ... */ }

export type StripeMode =
  | { mode: 'connect'; acctId: string }
  | { mode: 'legacy_platform' }
  | { mode: 'bank_transfer' }
  | { mode: 'error'; code: 'NOT_CONNECTED' | 'CHARGES_DISABLED' }

export function resolveStripeMode(ctx: RestaurantStripeContext): StripeMode {
  if (!ctx.stripeEnabled) return { mode: 'bank_transfer' }
  if (ctx.stripeAccountId && ctx.chargesEnabled) {
    return { mode: 'connect', acctId: ctx.stripeAccountId }
  }
  if (ctx.stripeAccountId && !ctx.chargesEnabled) {
    return LEGACY_MODE
      ? { mode: 'legacy_platform' }
      : { mode: 'error', code: 'CHARGES_DISABLED' }
  }
  return LEGACY_MODE
    ? { mode: 'legacy_platform' }
    : { mode: 'error', code: 'NOT_CONNECTED' }
}

export function stripeRequestOptions(acctId: string | null): Stripe.RequestOptions | undefined {
  return acctId ? { stripeAccount: acctId } : undefined
}

export async function getOrCreateStripeCustomerOnAccount(
  email: string, name: string | null, acctId: string
): Promise<string> {
  const opts = { stripeAccount: acctId }
  const existing = await stripe.customers.list({ email, limit: 1 }, opts)
  if (existing.data.length > 0) return existing.data[0].id
  const customer = await stripe.customers.create(
    { email, ...(name ? { name } : {}) }, opts
  )
  return customer.id
}
```

### 5.5 Middleware `requireOrgAdmin`

À ajouter dans `backend/src/lib/auth.ts`. Refuse l'accès si l'user n'a pas le rôle `admin` org-wide. Utilisé sur toutes les routes Stripe Connect sensibles.

### 5.6 Variables d'environnement à ajouter

| Variable | Test | Prod (Phase 2-4) | Prod (Phase 5+) |
|---|---|---|---|
| `STRIPE_CLIENT_ID` | `ca_test_xxx` | `ca_live_xxx` | `ca_live_xxx` |
| `STRIPE_CONNECT_REDIRECT_URI` | `https://staging.../callback` | `https://api.../callback` | idem |
| `STRIPE_CONNECT_LEGACY_MODE` | `false` (test strict) | `true` | `false` |

---

## 6. Modifications des flux paiement existants

### 6.1 Arbre de décision unifié

```
restaurant.stripe_enabled === false
    └── → bank transfer (existant, inchangé)

restaurant.stripe_enabled === true
    ├── stripe_account_id NOT NULL && charges_enabled
    │       └── → Stripe Connect (acct_xxx)
    │
    └── stripe_account_id NULL OR charges_enabled = false
            ├── flux MANUEL (POST /create-link)
            │       ├── LEGACY_MODE = true → clé plateforme + warning
            │       └── LEGACY_MODE = false → erreur 412 NOT_CONNECTED / CHARGES_DISABLED
            │
            └── flux AUTO (after signature)
                    ├── LEGACY_MODE = true → clé plateforme + warning
                    └── LEGACY_MODE = false → fallback bank transfer + warning log
```

**Principe** : "fail loudly when the user is watching, fail gracefully when they're not".

### 6.2 Modifs `payments.ts` — POST /api/payments/create-link

Ajout de ~10 lignes : lookup `getRestaurantStripeContext` après fetch booking, `resolveStripeMode`, switch sur le mode, passage de `stripeRequestOptions(acctId)` comme second arg de `stripe.checkout.sessions.create`, ajout `stripe_account_id` dans les inserts `payment_links` + `payments`. Aucune logique existante remplacée.

### 6.3 Modifs `webhooks.ts` — `autoSendDepositAfterSignature`

Réutiliser le helper `resolveStripeMode`. Si mode `connect` → tous les appels Stripe (`customers.list/create`, `invoices.create`, `invoiceItems.create`, `invoices.finalizeInvoice`) prennent `{ stripeAccount: acctId }` en second arg. Si mode `legacy_platform` → comportement actuel inchangé. Si mode `bank_transfer` → branche existante inchangée.

⚠️ **Important** : `getOrCreateStripeCustomer` devient `getOrCreateStripeCustomerOnAccount` (signature change : reçoit `acctId`). **Les customers Stripe sont isolés par compte connecté** — un customer créé sur la plateforme est invisible depuis un compte connecté.

### 6.4 Modifs handlers webhook existants

Ajout de `eventAccount?: string` en paramètre de `handlePaymentSuccess`, `handleInvoicePaymentSuccess`, `handlePaymentFailed`. Tous les appels `stripe.paymentIntents.retrieve`, `stripe.charges.retrieve`, `stripe.checkout.sessions.list` prennent `{ stripeAccount: eventAccount }` quand `eventAccount` est défini, sinon `undefined` (comportement legacy).

**Aucune régression** sur les events plateforme historiques : `event.account` est `undefined` → SDK utilise la clé plateforme.

### 6.5 Récap fichiers backend touchés

| Fichier | Action | Effort |
|---|---|---|
| `backend/src/lib/stripe-connect.ts` | **CREATE** | nouveau (~100 lignes) |
| `backend/src/routes/stripe-connect.ts` | **CREATE** | nouveau (~280 lignes) |
| `backend/src/routes/payments.ts` | edit | +12 lignes |
| `backend/src/routes/webhooks.ts` | edit | +120 lignes (4 nouveaux handlers + 4 existants à upgrader) |
| `backend/src/index.ts` | edit | +3 lignes (mount router public + privé + middleware raw body inchangé) |
| `backend/src/lib/auth.ts` | edit | +20 lignes (`requireOrgAdmin`) |

---

## 7. Frontend — UI Settings

### 7.1 États UX (3 vues)

**État 1 — Pas connecté** : carte avec description + bouton "Connecter Stripe" (visible aux admins org-wide). Les gérants voient un message "Seul un administrateur peut connecter Stripe".

**État 2 — Connecté & opérationnel** : nom du compte, email, date de connexion, badges "Paiements actifs" / "Virements actifs", boutons "Vérifier le statut" et "Déconnecter".

**État 3 — Connecté avec problème KYC** : badges rouges "Paiements désactivés", alerte avec `disabled_reason`, message "Le restaurant doit se connecter à son dashboard Stripe pour compléter".

### 7.2 Nouveaux fichiers frontend

| Fichier | Rôle |
|---|---|
| `src/features/settings/hooks/use-stripe-connect.ts` | Hooks React Query : `useStartStripeConnect`, `useDisconnectStripe`, `useRefreshStripeStatus` |
| `src/hooks/use-is-org-admin.ts` | Vérification rôle (réutilisable ailleurs) |
| `src/features/settings/restaurants/components/stripe-connect-section.tsx` | Composant autonome (~150 lignes) — les 3 états UX |

### 7.3 Fichiers frontend modifiés

| Fichier | Modification |
|---|---|
| `src/features/settings/restaurants/detail-page.tsx` | Insérer `<StripeConnectSection />` au-dessus du formulaire + handler des query params `stripe_success` / `stripe_error` (toast + clean URL) |
| `src/routes/_authenticated/settings/restaurants/$id.tsx` | Ajouter `validateSearch` schema pour les query params OAuth |
| `src/features/reservations/components/payment-dialog.tsx` | Gestion erreur 412 `NOT_CONNECTED` / `CHARGES_DISABLED` avec CTA "Configurer Stripe" |
| `src/lib/supabase/types.ts` | Régénéré automatiquement après migration |

### 7.4 Toggle `stripe_enabled` existant

**Conservé tel quel** dans le formulaire (`restaurant-detail.tsx:1131`). Indépendant de Connect — permet de désactiver temporairement les paiements en ligne sans déconnecter le compte (ex : audit interne).

Logique : `Connect actif = stripe_enabled === true AND stripe_account_id !== null AND charges_enabled === true`.

---

## 8. Sécurité & isolation multi-tenant

### 8.1 Trois lignes de défense sur l'OAuth

1. **Avant OAuth** : vérification `restaurant.organization_id === user.organization_id` côté backend → impossible de lancer un OAuth pour un restaurant d'une autre org
2. **Pendant OAuth** : Stripe ne montre à l'admin que les comptes auxquels son email a accès ; le state token signé empêche le hijacking de session
3. **Au callback** : revérification de l'ownership + check d'unicité du `acct_id` (un même compte ne peut être lié qu'à un seul restaurant)

### 8.2 Protection cross-org sur l'erreur "already_linked"

Si l'org B essaie de connecter un compte déjà lié à l'org A, le message d'erreur **ne révèle PAS** le nom du restaurant qui a ce compte (juste "Compte déjà lié à un autre restaurant — contactez le support"). Évite la fuite d'information cross-tenant.

### 8.3 State token — anti-CSRF & anti-replay

- Token `crypto.randomBytes(32).toString('hex')` (256 bits)
- Expiration 15 min
- Marqué `consumed_at` au callback (atomic UPDATE) → impossible de rejouer
- Lié à `user_id` + `organization_id` + `restaurant_id` → un token volé ne marche que pour la session originale

### 8.4 Webhook signature

`STRIPE_WEBHOOK_SECRET` valide events plateforme ET Connect (même endpoint, même secret). Vérification déjà en place ([webhooks.ts:33-39](backend/src/routes/webhooks.ts:33)).

### 8.5 Clé plateforme — usage post-Connect

Après migration complète (Phase 6), `STRIPE_SECRET_KEY` ne sert plus que pour :
- L'OAuth (`stripe.oauth.token`, `stripe.oauth.deauthorize`)
- La validation des signatures webhook
- La récupération des détails compte au callback (`stripe.accounts.retrieve`)

Aucune charge n'est plus créée avec cette clé.

---

## 9. Liste exhaustive des webhook events

### 9.1 Configuration Stripe Dashboard

Endpoint unique `https://api.mealevent.fr/api/webhooks/stripe` avec **`Listen to events on Connected accounts` activé**.

### 9.2 Events écoutés (10 au total)

**Existants — à upgrader Connect-aware** :
| Event | Action MealEvent |
|---|---|
| `checkout.session.completed` | Update payment → paid, store receipt URL, update booking/quote status |
| `invoice.paid` | Idem (chemin auto post-signature) |
| `payment_intent.succeeded` | Log info (pas d'action en BDD) |
| `payment_intent.payment_failed` | Insert payment status = 'failed' |

**Nouveaux Connect lifecycle** :
| Event | Action MealEvent |
|---|---|
| `account.updated` | Sync `stripe_charges_enabled`, `stripe_payouts_enabled`, `stripe_disabled_reason` |
| `account.application.deauthorized` | Clear toutes les colonnes Stripe Connect du restaurant + activity log |

**Nouveaux business** :
| Event | Action MealEvent |
|---|---|
| `charge.refunded` | Update payment → 'refunded', activity log, notify commercial |
| `charge.dispute.created` | Insert dispute, payment → 'disputed', **alerte admin orga** (email + UI) |
| `charge.dispute.closed` | Update activity log avec issue (`won`/`lost`), update payment status |
| `payout.paid` | Activity log "virement effectif vers IBAN restaurant" (info bonus) |

### 9.3 Filtrage des events parasites

Tout handler vérifie en premier la présence de `metadata.booking_id` (ou `quote_id` selon le cas). Si absent → `console.log + return` (l'event vient probablement d'une utilisation parallèle du compte Stripe par le restaurant lui-même, hors MealEvent).

### 9.4 Idempotence & retries

- Stripe retente 4 fois sur 3 jours en cas d'échec de notre endpoint (exponential backoff)
- Tous les handlers utilisent `UPDATE ... WHERE stripe_payment_id = X` ou `WHERE stripe_account_id = X` → naturellement idempotents
- Pas de garantie d'ordering Stripe → pas un problème dans le code actuel

---

## 10. Migration & rollout — 6 phases

### Phase 0 — Stripe Dashboard prep

1. Activer Connect en **test mode** d'abord
2. Configurer onboarding (nom app, logo, email support, redirect URI)
3. Récupérer `client_id` test
4. Webhooks → cocher "Listen to events on Connected accounts" + ajouter les 10 events
5. **Tester l'intégralité du flux** avec 2 comptes test
6. Répéter en **live mode**

### Phase 1 — Migration BDD

```bash
supabase db push
supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
git commit -m "feat(db): add stripe connect per-restaurant columns"
```

Validation :
```sql
SELECT count(*), count(stripe_account_id) AS connected FROM restaurants;
-- Avant connexion: connected = 0
```

**Rollback** : `ALTER TABLE ... DROP COLUMN` (additive, aucune perte de données).

### Phase 2 — Backend deploy avec **`STRIPE_CONNECT_LEGACY_MODE=true`**

C'est la phase critique. Avec legacy mode actif :
- Restaurants sans `acct_id` → continuent à utiliser la clé plateforme (comportement actuel)
- Restaurants connectés → utilisent leur compte Connect
- **Aucun paiement existant ne se casse**
- Logs `[Legacy] Restaurant X using platform key` permettent de suivre la migration

Variables d'env à set : `STRIPE_CLIENT_ID`, `STRIPE_CONNECT_REDIRECT_URI`, `STRIPE_CONNECT_LEGACY_MODE=true`.

### Phase 3 — Frontend deploy

Le bouton "Connecter Stripe" apparaît pour les admins. Connexion optionnelle, pas de blocage.

### Phase 4 — Migration commerciale (4 semaines recommandées)

**Communication** :
- Email aux admins org : "Connectez votre compte Stripe d'ici le [date]"
- Bandeau in-app sur Settings restaurants si `stripe_enabled = true && stripe_account_id IS NULL`

**Monitoring** :
```sql
SELECT
  o.name AS org,
  count(r.id) FILTER (WHERE r.stripe_enabled = true) AS need_stripe,
  count(r.id) FILTER (WHERE r.stripe_account_id IS NOT NULL) AS connected,
  count(r.id) FILTER (WHERE r.stripe_enabled = true AND r.stripe_account_id IS NULL) AS pending
FROM organizations o LEFT JOIN restaurants r ON r.organization_id = o.id
GROUP BY o.id, o.name ORDER BY pending DESC;
```

### Phase 5 — Bascule `LEGACY_MODE=false`

Flip env var + restart backend. À partir de ce moment, les restaurants `stripe_enabled = true` sans `acct_id` reçoivent 412 sur `/create-link`. Paiements en flight (liens créés avant) finissent normalement.

**Rollback trivial** : repasser `LEGACY_MODE=true` + restart.

### Phase 6 — Cleanup (~3 mois après Phase 5)

```sql
ALTER TABLE settings DROP COLUMN stripe_account_id;
ALTER TABLE settings DROP COLUMN stripe_public_key;
ALTER TABLE settings DROP COLUMN stripe_secret_key;
```

Code : supprimer la branche `legacy_platform` du `resolveStripeMode`, supprimer la const `LEGACY_MODE`, supprimer `STRIPE_CONNECT_LEGACY_MODE` de l'env. Mettre à jour `LOCALHOST.md` et `backend/README.md`.

### Timeline totale

| Phase | Durée | Risque |
|---|---|---|
| 0 — Stripe prep | 1 jour | très faible |
| 1 — DB migration | 5 min | très faible |
| 2 — Backend deploy | 1 jour | faible (legacy mode = filet) |
| 3 — Frontend deploy | 1 jour | faible |
| 4 — Migration commerciale | 4 semaines | dépend adoption |
| 5 — Legacy mode off | 5 min | faible (rollback trivial) |
| 6 — Cleanup | quand à l'aise (3-6 mois après Phase 5) | très faible |

---

## 11. Stratégie de tests

| Test | Phase | Méthode |
|---|---|---|
| OAuth happy path | Avant Phase 2 | Stripe test + 2 comptes test |
| OAuth state expiré | Avant Phase 2 | Forcer `expires_at = now() - 1h` puis cliquer |
| Account deauthorized depuis Stripe | Avant Phase 2 | Déconnecter depuis dashboard test → vérifier nettoyage BDD |
| KYC bloqué (`charges_enabled = false`) | Avant Phase 2 | Compte test avec `requirements.disabled_reason` set |
| Paiement en mode legacy | Avant Phase 2 | Restaurant non connecté + `LEGACY_MODE=true` → vérifier que ça marche comme avant |
| Paiement Connect | Avant Phase 2 | Connecter test acct → créer lien → payer carte test → vérifier `payments.stripe_account_id` |
| Webhook avec `event.account` | Avant Phase 2 | `stripe trigger checkout.session.completed --stripe-account acct_xxx` |
| Refund | Avant Phase 2 | `stripe trigger charge.refunded --stripe-account acct_xxx` |
| Dispute | Avant Phase 2 | Carte test `4000 0000 0000 0259` qui crée auto un litige |
| `LEGACY_MODE=false` strict | Avant Phase 5 | Restaurant non connecté → vérifier 412 + UX claire |

---

## 12. Observabilité

Logs structurés à ajouter aux endpoints + handlers :

```ts
console.log('[stripe-connect.metric]', JSON.stringify({
  event: 'oauth_connected' | 'oauth_failed' | 'disconnected' | 'webhook_account_updated' | 'refund' | 'dispute_opened',
  restaurant_id, organization_id, acct_id,
  charges_enabled, payouts_enabled,
  legacy_mode_used: mode.mode === 'legacy_platform',  // KPI clé pour Phase 4
}))
```

Dashboards à monter (futur, hors scope de cette spec) :
- Pourcentage de restaurants connectés par org (suivi Phase 4)
- Taux de `legacy_mode_used` (doit décroître)
- Alertes `disabled_reason` non NULL (KYC à compléter)
- Disputes ouverts non clos > 30 jours

---

## 13. Risques & open questions

### Risques résiduels

| Risque | Probabilité | Mitigation |
|---|---|---|
| Un restaurant déconnecte MealEvent depuis Stripe pendant un paiement en cours | faible | Webhook `account.application.deauthorized` nettoie en BDD ; les paiements en flight (Checkout Session déjà créée) finissent normalement |
| `account.updated` reçu avant qu'on ait insert le restaurant dans notre BDD (race condition à la connexion) | très faible | Le callback OAuth fait un INSERT avant de retourner ; les events Stripe arrivent au plus tôt 1-2 sec après → ordre garanti en pratique |
| Webhook secret rotaté côté Stripe | faible (jamais en pratique) | `STRIPE_WEBHOOK_SECRET` versionnée dans secret manager + redeploy |
| Un admin org connecte par erreur le mauvais compte Stripe | moyen | Stripe affiche le nom du compte avant autorisation → l'erreur reste rare ; bouton "Déconnecter" facile |
| Customers Stripe créés sur la plateforme avant migration → invisibles depuis le compte connecté | n/a | Le code crée des nouveaux customers sur le compte connecté à la première transaction post-Connect |

### Open questions (à trancher pendant l'implémentation)

1. **Disputes** : on stocke dans une nouvelle table `payment_disputes` ou juste dans `activity_logs` ? → Recommandation : nouvelle table car peut nécessiter du suivi (montant, status, deadline de réponse, etc.)
2. **`payments.status`** : ajouter les valeurs `'refunded'`, `'disputed'`, `'dispute_lost'` ? → Oui, à inclure dans la migration ou dans une migration suivante au choix
3. **Notification disputes** : email + bandeau in-app + SMS ? → À discuter avec le client (probablement email + bandeau suffisent)
4. **Metadata `restaurant_id`** dans les checkout sessions Connect : redondant avec `event.account` mais utile pour debug. → On l'inclut.

---

## 14. Récap : tous les fichiers touchés

### Backend
| Fichier | Action |
|---|---|
| `backend/src/lib/stripe-connect.ts` | **CREATE** (~100 lignes) |
| `backend/src/routes/stripe-connect.ts` | **CREATE** (~280 lignes) |
| `backend/src/routes/payments.ts` | edit (+12 lignes) |
| `backend/src/routes/webhooks.ts` | edit (+120 lignes : 4 handlers existants à upgrader, 6 nouveaux handlers, helper customer) |
| `backend/src/index.ts` | edit (+3 lignes) |
| `backend/src/lib/auth.ts` | edit (+20 lignes : `requireOrgAdmin`) |
| `backend/.env.local` | edit (+3 vars) |

### Database
| Fichier | Action |
|---|---|
| `supabase/migrations/20260506_stripe_connect_per_restaurant.sql` | **CREATE** (~50 lignes SQL) |
| `src/lib/supabase/types.ts` | régénéré auto |

### Frontend
| Fichier | Action |
|---|---|
| `src/features/settings/hooks/use-stripe-connect.ts` | **CREATE** (~80 lignes) |
| `src/hooks/use-is-org-admin.ts` | **CREATE** (~25 lignes) |
| `src/features/settings/restaurants/components/stripe-connect-section.tsx` | **CREATE** (~150 lignes) |
| `src/features/settings/restaurants/detail-page.tsx` | edit (+30 lignes) |
| `src/routes/_authenticated/settings/restaurants/$id.tsx` | edit (+6 lignes) |
| `src/features/reservations/components/payment-dialog.tsx` | edit (+15 lignes — gestion erreur 412) |

### Documentation
| Fichier | Action |
|---|---|
| `LOCALHOST.md` | edit (documenter les nouvelles env vars) |
| `backend/README.md` | edit (documenter les routes Stripe Connect) |
| `CLAUDE.md` | edit éventuel (mentionner Stripe Connect dans l'archi) |

**Total : ~10 nouveaux fichiers, ~10 fichiers modifiés, ~900 lignes de code ajoutées (hors types regénérés).**

---

## 15. Glossaire

- **Stripe Connect Standard** : modèle Stripe où chaque "connected account" est un compte Stripe complet et indépendant, lié à la plateforme (MealEvent) via OAuth.
- **Connected account** : un compte Stripe d'un restaurant lié à MealEvent.
- **Plateforme** : MealEvent CRM, qui orchestre les paiements via les connected accounts mais ne reçoit jamais l'argent (charges directes).
- **Charges directes** : modèle où l'argent va directement du client au connected account, sans transit par la plateforme.
- **`acct_xxx`** : identifiant unique d'un connected account côté Stripe.
- **`event.account`** : champ ajouté par Stripe sur les webhooks d'events Connect, indiquant quel connected account est concerné.
- **State token** : token cryptographique anti-CSRF utilisé dans le flow OAuth.
- **Legacy mode** : mode transitoire (`STRIPE_CONNECT_LEGACY_MODE=true`) qui permet aux restaurants non-connectés de continuer à utiliser la clé plateforme MealEvent pendant la migration.
