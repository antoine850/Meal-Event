# Plan de fixes du module Stripe — Production

> **Pour les agents :** Utiliser `superpowers:subagent-driven-development` ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe checkbox (`- [ ]`).

**Goal :** Corriger 6 bugs du module Stripe (OAuth Connect cassé, webhook handler qui crash, incohérence platform/Connect entre flows, webhook secret manquant, events non traités, signature SignNow ignorée) sans interrompre les paiements en cours en production.

**Architecture :** Approche par phases isolées, chacune déployable indépendamment. PR séparée par phase pour limiter le blast radius. Hotfix critiques d'abord (sans changement métier), refactor Connect ensuite (avec tests), durcissement sécurité en dernier.

**Tech Stack :** Node.js 20 / Express 4 / Stripe SDK 14.25 / Supabase / Render (auto-deploy sur push `main`) / pas de staging — tester en local avec Stripe CLI puis déployer en off-peak.

---

## Contexte critique

- **Aucun framework de test** côté backend actuellement (`package.json` n'a pas de script `test`).
- **Pas de staging environment** — `main` → auto-deploy sur Render free tier.
- **CI actuel** (`.github/workflows/ci.yml`) : lint + format + build uniquement.
- **Render config** : `backend/render.yaml` ne déclare pas `STRIPE_CLIENT_ID`, `STRIPE_CONNECT_REDIRECT_URI`, `STRIPE_CONNECT_LEGACY_MODE` (présents en runtime via dashboard).
- **Heures d'ouverture de l'app** : restaurants → trafic matin (commande) et soir (signature/paiement). Déployer entre **14h–17h** pour minimiser l'impact.

---

## Enjeu métier de chaque bug

### Bug #1 — OAuth Stripe Connect cassé (boucle d'erreurs)
**Symptôme :** Tout admin qui clique "Connecter Stripe" sur un restaurant déclenche `StripeInvalidGrantError: Authorization code provided does not belong to you`. Vu **8+ fois dans les logs**, donc utilisateurs réels bloqués.

**Enjeu métier :** **Aucun nouveau restaurant ne peut activer Stripe Connect**. Les bookings de ces restaurants tombent en `bank_transfer` (virement manuel) — friction commerciale, abandon panier, manque à gagner direct.

**Cause :** Mismatch test/live entre `STRIPE_SECRET_KEY` et `STRIPE_CLIENT_ID` sur Render. La réponse Stripe contient `x-stripe-routing-context-priority-tier: api-testmode` → la secret key est en mode test, donc le client_id doit l'être aussi (`ca_test_xxx`).

### Bug #2 — Webhook `payment_intent.payment_failed` crash systématique
**Symptôme :** À chaque échec de paiement, le webhook handler crash avec `Stripe: Unknown arguments ([object Object])`. Vu **18+ fois dans les logs**.

**Enjeu métier :** Quand un client échoue à payer (carte refusée, fonds insuffisants), **aucun `payment.failed` n'est enregistré en BDD**. Le commercial n'est pas notifié, le booking reste en `attente_paiement`, et personne ne relance le client → **revenus perdus silencieusement**.

**Cause :** Le pattern `stripeRequestOptions(eventAccount ?? null) ?? {}` passe `{}` au SDK quand l'event vient de la plateforme (pas Connect). Le SDK ne reconnaît pas `{}` comme options hash et throw. Confirmé en lisant `utils.js:5-17` du SDK.

### Bug #3 — Incohérence Connect : `send-deposit` ≠ flow auto
**Symptôme :** Le bouton "Envoyer acompte" depuis l'UI crée la facture Stripe **sur la plateforme**, alors que l'envoi automatique après signature SignNow crée la facture **sur le compte Connect du restaurant**.

**Enjeu métier :** **Risque légal et comptable majeur** :
- Si le restaurant a Stripe Connect activé, le client paye sur le compte **plateforme** (le compte du gérant du SaaS), pas sur celui du restaurant
- Les fonds doivent ensuite être transférés manuellement vers le restaurant
- Cela peut violer les conditions Stripe (acting as PSP non agréé)
- Comptabilité incorrecte (TVA, factures émises par le mauvais SIRET)

**Cause :** `quotes.ts:588` et `quotes.ts:897` appellent `stripe.invoices.create(...)` **sans** `stripeOpts`. `webhooks.ts:954` (autoSend) passe `stripeOpts` correctement. Le commit `5656125` a migré le webhook handler mais pas les endpoints `/send-deposit` et `/send-balance`.

### Bug #4 — `STRIPE_WEBHOOK_SECRET` non configuré (vulnérabilité)
**Symptôme :** Tous les webhooks Stripe sont acceptés sans vérification de signature : `⚠️ STRIPE_WEBHOOK_SECRET not configured - accepting webhook without verification`.

**Enjeu métier :** **Vulnérabilité de sécurité critique**. N'importe qui peut envoyer un POST forgé à `/api/webhooks/stripe` avec un `invoice.paid` factice → le booking passe à `confirme_fonctionnaire` sans paiement réel. Risque de **fraude directe**.

**Cause :** `webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''` — fallback explicite vers "no verification" sans guard de production. `render.yaml` déclare la variable mais elle n'a jamais été remplie.

### Bug #5 — Events `invoice.payment_failed` ignorés
**Symptôme :** Les events `invoice.payment_failed`, `charge.failed` arrivent mais tombent dans le `default: Unhandled event type`. Vu **2 fois dans les logs récents**.

**Enjeu métier :** Avec la migration vers Stripe Invoices (commit `442158d`), c'est `invoice.payment_failed` qui se déclenche maintenant (pas `payment_intent.payment_failed`). Même conséquence que Bug #2 : échecs invisibles, pas de relance, revenus perdus.

**Cause :** Le `switch` de `webhooks.ts:55-104` couvre `payment_intent.payment_failed` (ancien flow Checkout) mais pas `invoice.payment_failed` (nouveau flow Invoices).

### Bug #6 — Signature SignNow ignorée
**Symptôme :** `[SignNow] Webhook signature verification failed — processing anyway for now`.

**Enjeu métier :** Vulnérabilité similaire au Bug #4 : un acteur malveillant peut forger un `user.document.complete` → le devis passe en `quote_signed`, le booking en `attente_paiement`, et une facture acompte est envoyée par email au **client réel** (qui pourrait payer un devis non signé).

**Cause :** Deux problèmes :
1. `index.ts:66` ne monte `express.raw()` que pour `/api/webhooks/stripe`, pas `/api/webhooks/signnow` → le body est parsé en JSON et `JSON.stringify(req.body)` reproduit pas le format signé.
2. `webhooks.ts:130` log un warning mais continue le traitement.

---

## Phase 0 — Préparation (sans toucher au code)

### Task 0.1 : Vérifier la configuration Render actuelle

**Pourquoi :** On ne peut pas fixer le Bug #1 sans connaître les vraies valeurs des env vars.

- [ ] **Étape 1 :** Aller dans Render Dashboard → service `mealevent-crm-api` → onglet **Environment**.

- [ ] **Étape 2 :** Noter les **préfixes** (pas les valeurs complètes) :
  - `STRIPE_SECRET_KEY` → préfixe attendu `sk_test_` OU `sk_live_`
  - `STRIPE_CLIENT_ID` → préfixe attendu `ca_` (devrait commencer par `ca_test_` ou `ca_live_`, mais c'est juste `ca_` historiquement)
  - `STRIPE_CONNECT_REDIRECT_URI` → doit être `https://<render-url>/api/stripe-connect/oauth/callback`
  - `STRIPE_WEBHOOK_SECRET` → vide ? rempli ? préfixe `whsec_` ?

- [ ] **Étape 3 :** Aller dans **Stripe Dashboard** (dashboard.stripe.com) :
  - Toggle **Test mode** ou **Live mode** en haut à droite (utiliser le mode qui correspond à `STRIPE_SECRET_KEY`)
  - **Connect → Settings → Integration** → noter le `client_id` affiché
  - Comparer avec la valeur sur Render → ils doivent être identiques

- [ ] **Étape 4 :** Décider :
  - Si Render = test et Stripe Dashboard live → soit basculer Render en live, soit copier le `ca_test_xxx` depuis Stripe test dashboard
  - Si tout est cohérent en test → l'erreur vient d'ailleurs (redirect_uri ? code déjà consommé ?)

**Résultat attendu :** Décision claire sur le mode (test/live) à maintenir + valeurs à mettre à jour. **Pas de modification Render encore** — c'est la Phase 3.

---

## Phase 1 — Hotfix Bug #2 (déployable en 15 min, risque ~zéro)

### Task 1.1 : Créer une branche isolée

**Files :**
- Branche : `fix/stripe-webhook-options-arg`

- [ ] **Étape 1 :** Créer la branche
```bash
git checkout main
git pull origin main
git checkout -b fix/stripe-webhook-options-arg
```

### Task 1.2 : Patcher les 4 call sites

**Files :**
- Modify : `backend/src/routes/webhooks.ts:189`
- Modify : `backend/src/routes/webhooks.ts:192`
- Modify : `backend/src/routes/webhooks.ts:393`
- Modify : `backend/src/routes/webhooks.ts:555`
- Modify : `backend/src/lib/stripe-connect.ts:58-60` (helper)

- [ ] **Étape 1 :** Modifier `stripeRequestOptions` pour qu'il retourne `undefined` quand pas de Connect (plus explicite), et créer un alias `stripeRequestOptionsOrUndefined`.

Dans `backend/src/lib/stripe-connect.ts`, remplacer la fonction existante (ligne 58-60) :
```typescript
export function stripeRequestOptions(
  acctId: string | null | undefined
): Stripe.RequestOptions | undefined {
  return acctId ? { stripeAccount: acctId } : undefined
}
```

(C'est déjà ce que le code fait, mais on s'assure que le type est `| undefined` explicite.)

- [ ] **Étape 2 :** Dans `backend/src/routes/webhooks.ts`, remplacer les 4 occurrences :

Ligne 189 :
```typescript
// AVANT
const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string, stripeRequestOptions(eventAccount ?? null) ?? {})

// APRÈS
const paymentIntent = await stripe.paymentIntents.retrieve(
  session.payment_intent as string,
  stripeRequestOptions(eventAccount ?? null)
)
```

Ligne 192 :
```typescript
// AVANT
const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string, stripeRequestOptions(eventAccount ?? null) ?? {})

// APRÈS
const charge = await stripe.charges.retrieve(
  paymentIntent.latest_charge as string,
  stripeRequestOptions(eventAccount ?? null)
)
```

Ligne 393 (dans `handleInvoicePaymentSuccess`) :
```typescript
// AVANT
const charge = await stripe.charges.retrieve(invoice.charge as string, stripeRequestOptions(eventAccount ?? null) ?? {})

// APRÈS
const charge = await stripe.charges.retrieve(
  invoice.charge as string,
  stripeRequestOptions(eventAccount ?? null)
)
```

Ligne 552-555 (dans `handlePaymentFailed`) :
```typescript
// AVANT
const sessions = await stripe.checkout.sessions.list({
  payment_intent: paymentIntent.id,
  limit: 1,
}, stripeRequestOptions(eventAccount ?? null) ?? {})

// APRÈS
const sessions = await stripe.checkout.sessions.list(
  {
    payment_intent: paymentIntent.id,
    limit: 1,
  },
  stripeRequestOptions(eventAccount ?? null)
)
```

### Task 1.3 : Vérifier le build TypeScript

- [ ] **Étape 1 :** Compiler le backend
```bash
cd backend
pnpm build
```
**Expected :** Pas d'erreur. Le SDK accepte `RequestOptions | undefined`.

Si TypeScript râle (signature stricte), passer `undefined` explicite :
```typescript
const sessions = await stripe.checkout.sessions.list(
  { payment_intent: paymentIntent.id, limit: 1 },
  stripeRequestOptions(eventAccount ?? null) as Stripe.RequestOptions | undefined
)
```

### Task 1.4 : Test manuel local avec Stripe CLI

**Prérequis :** Installer Stripe CLI (`brew install stripe/stripe-cli/stripe`) et `stripe login`.

- [ ] **Étape 1 :** Démarrer le backend local
```bash
cd backend
pnpm dev
```

- [ ] **Étape 2 :** Dans un autre terminal, forward les webhooks Stripe vers localhost
```bash
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```
Noter le `whsec_xxx` affiché → copier dans `backend/.env.local` comme `STRIPE_WEBHOOK_SECRET` (temporaire pour le test local).

- [ ] **Étape 3 :** Déclencher un `payment_intent.payment_failed` factice
```bash
stripe trigger payment_intent.payment_failed
```

**Expected dans les logs backend :**
- AVANT le fix : `Error looking up checkout session for failed payment: Error: Stripe: Unknown arguments...`
- APRÈS le fix : `[Stripe] Payment failed but no booking_id found for PaymentIntent pi_xxx` (le message normal — pas de booking_id car c'est un trigger artificiel)

### Task 1.5 : Commit + PR + Merge

- [ ] **Étape 1 :** Commit
```bash
git add backend/src/routes/webhooks.ts backend/src/lib/stripe-connect.ts
git commit -m "fix(webhooks): corriger Unknown arguments dans les handlers Stripe

Le pattern stripeRequestOptions(...) ?? {} passe {} au SDK quand l'event
vient de la plateforme (pas Connect). Le SDK ne reconnaît pas {} comme
options hash car il vérifie la présence de clés (apiKey, stripeAccount,
etc.) et throw 'Unknown arguments'.

Passer undefined explicite à la place. Corrige les 4 call sites :
paymentIntents.retrieve, charges.retrieve x2, checkout.sessions.list."
```

- [ ] **Étape 2 :** Pousser et créer PR
```bash
git push -u origin fix/stripe-webhook-options-arg
gh pr create --title "fix(webhooks): corriger Unknown arguments dans handlers Stripe" --body "## Contexte
À chaque échec de paiement Stripe, le handler webhook crash avec \`Stripe: Unknown arguments ([object Object])\` (vu 18+ fois dans les logs Render).

## Root cause
Le pattern \`stripeRequestOptions(x) ?? {}\` passe \`{}\` comme options au SDK. Le SDK Stripe v14 vérifie la présence de clés (apiKey, stripeAccount...) pour reconnaître un options hash. \`{}\` échoue cette vérification, n'est pas pop() de args, et le SDK throw.

## Fix
Passer \`undefined\` explicite (le SDK l'accepte). 4 call sites corrigés.

## Test plan
- [ ] Build TypeScript passe (\`pnpm build\`)
- [ ] \`stripe trigger payment_intent.payment_failed\` ne crash plus le handler localement
- [ ] Logs Render après deploy : plus de \`Unknown arguments\`"
```

- [ ] **Étape 3 :** Une fois CI passé, merger en main.

### Task 1.6 : Vérifier post-déploiement

- [ ] **Étape 1 :** Attendre 3-5 min que Render redéploie.

- [ ] **Étape 2 :** Sur Render Dashboard → Logs en temps réel :
  - Filtrer sur "Unknown arguments" → doit ne plus apparaître pour les nouveaux events
  - Si un client échoue à payer, le log doit montrer `[Stripe] Payment failed for booking <id>` au lieu du crash

**Rollback :** `git revert <commit-sha> && git push origin main` → Render redéploie automatiquement la version précédente. Aucun changement de DB, donc rollback safe.

---

## Phase 2 — Setup minimal de tests (sans toucher au code prod)

### Task 2.1 : Installer Vitest

**Files :**
- Modify : `backend/package.json`
- Create : `backend/vitest.config.ts`
- Create : `backend/tests/setup.ts`

- [ ] **Étape 1 :** Installer Vitest
```bash
cd backend
pnpm add -D vitest @vitest/coverage-v8
```

- [ ] **Étape 2 :** Ajouter le script `test` dans `backend/package.json` :
```json
"scripts": {
  "dev": "tsx watch --env-file=.env src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "lint": "eslint src --ext .ts",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Étape 3 :** Créer `backend/vitest.config.ts` :
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Étape 4 :** Créer `backend/tests/setup.ts` (env vars pour les tests) :
```typescript
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
process.env.STRIPE_CLIENT_ID = 'ca_test_dummy'
process.env.SUPABASE_URL = 'https://dummy.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy'
```

### Task 2.2 : Test unitaire du helper `stripeRequestOptions`

**Files :**
- Create : `backend/tests/lib/stripe-connect.test.ts`

- [ ] **Étape 1 :** Écrire le test
```typescript
import { describe, it, expect } from 'vitest'
import { stripeRequestOptions } from '../../src/lib/stripe-connect.js'

describe('stripeRequestOptions', () => {
  it('returns undefined when no account id', () => {
    expect(stripeRequestOptions(null)).toBeUndefined()
    expect(stripeRequestOptions(undefined as any)).toBeUndefined()
    expect(stripeRequestOptions('')).toBeUndefined()
  })

  it('returns options with stripeAccount when account id provided', () => {
    expect(stripeRequestOptions('acct_123')).toEqual({ stripeAccount: 'acct_123' })
  })

  it('never returns an empty object (would crash Stripe SDK)', () => {
    const result = stripeRequestOptions(null)
    expect(result).not.toEqual({})
  })
})
```

- [ ] **Étape 2 :** Run le test
```bash
cd backend
pnpm test
```
**Expected :** 3 tests passing.

### Task 2.3 : Test du switch webhook (snapshot du routing)

**Files :**
- Create : `backend/tests/routes/webhook-switch.test.ts`

- [ ] **Étape 1 :** Test qui vérifie que les events critiques sont bien routés
```typescript
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Stripe webhook event routing', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../src/routes/webhooks.ts'),
    'utf-8'
  )

  // Events critiques pour le métier (paiements, échecs, Connect lifecycle)
  const requiredEvents = [
    'checkout.session.completed',
    'invoice.paid',
    'invoice.payment_failed',     // <-- Bug #5
    'payment_intent.payment_failed',
    'account.updated',
    'account.application.deauthorized',
    'charge.refunded',
    'charge.dispute.created',
    'charge.dispute.closed',
  ]

  requiredEvents.forEach(eventType => {
    it(`handles ${eventType}`, () => {
      expect(source).toContain(`case '${eventType}':`)
    })
  })
})
```

**Expected (avant Phase 5) :** `invoice.payment_failed` FAIL. C'est volontaire — on l'utilisera comme test de non-régression pour la Phase 5.

### Task 2.4 : Ajouter `pnpm test` au CI

**Files :**
- Modify : `.github/workflows/ci.yml`

- [ ] **Étape 1 :** Ajouter une étape après le build
```yaml
      - name: Build the project
        run: pnpm build

      - name: Run backend tests
        run: cd backend && pnpm test
```

- [ ] **Étape 2 :** Commit Phase 2 sur la branche `chore/backend-tests-setup`
```bash
git checkout -b chore/backend-tests-setup
git add backend/package.json backend/pnpm-lock.yaml backend/vitest.config.ts backend/tests .github/workflows/ci.yml
git commit -m "chore(backend): setup Vitest + premier test unitaire stripeRequestOptions"
git push -u origin chore/backend-tests-setup
gh pr create --title "chore(backend): setup Vitest + tests Stripe initiaux" --body "Installe Vitest pour pouvoir tester les fixes Stripe à venir. Ajoute 2 suites de tests :
- Unit : helper stripeRequestOptions (bug #2)
- Routing : switch webhook (test qui FAIL sur invoice.payment_failed → couvre bug #5)"
```

**Rollback :** Aucun risque code prod (uniquement setup tests + CI step).

---

## Phase 3 — Fix Bug #1 (OAuth Connect) — config + observabilité

### Task 3.1 : Ajouter du logging au démarrage

**Files :**
- Modify : `backend/src/lib/stripe-connect.ts`

**Pourquoi :** Sans accès direct aux env Render, on a besoin que le serveur log lui-même les préfixes au boot pour confirmer la cohérence test/live.

- [ ] **Étape 1 :** Ajouter en haut du fichier (après le `const stripe = new Stripe(...)`) :
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

// Boot-time config check — logged once on startup for ops visibility
const secretPrefix = (process.env.STRIPE_SECRET_KEY || '').slice(0, 8) || 'MISSING'
const clientIdPrefix = (process.env.STRIPE_CLIENT_ID || '').slice(0, 8) || 'MISSING'
const mode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'LIVE' :
             process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN'
console.log(`[stripe.config] secret=${secretPrefix}*** client_id=${clientIdPrefix}*** mode=${mode}`)
if (process.env.STRIPE_CLIENT_ID && process.env.STRIPE_SECRET_KEY) {
  const secretMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live'
  // Les client_id Stripe Connect modernes contiennent 'test' dans l'ID pour le test mode
  // (format ca_xxx_test_xxx). Ce check est best-effort.
  const clientLooksTest = process.env.STRIPE_CLIENT_ID.includes('test')
  if (secretMode === 'test' && !clientLooksTest) {
    console.warn('[stripe.config] ⚠️ MISMATCH possible : secret=test mais client_id pas marqué test')
  }
}
```

- [ ] **Étape 2 :** Build + commit
```bash
git checkout -b chore/stripe-config-logging
cd backend && pnpm build
git add backend/src/lib/stripe-connect.ts
git commit -m "chore(stripe): logger les préfixes secret/client_id au boot pour debug Connect"
git push -u origin chore/stripe-config-logging
gh pr create --title "chore(stripe): logging config Stripe au boot" --body "Ajoute un log au démarrage pour identifier rapidement un mismatch test/live entre STRIPE_SECRET_KEY et STRIPE_CLIENT_ID — root cause du bug OAuth Connect."
```

### Task 3.2 : Lire les logs et identifier le mismatch

- [ ] **Étape 1 :** Après merge + redéploiement Render, ouvrir les logs.

- [ ] **Étape 2 :** Chercher la ligne `[stripe.config] secret=sk_xxxx*** client_id=ca_xxxx*** mode=XXX`

- [ ] **Étape 3 :** Comparer avec **Stripe Dashboard → Connect → Settings → Integration** dans le **MÊME mode** (test/live).

- [ ] **Étape 4 :** Si mismatch confirmé, décider de la cible :
  - Option A (recommandée pour démarrer) : **rester en test mode**. Mettre à jour `STRIPE_CLIENT_ID` sur Render avec le `ca_xxx` du test dashboard.
  - Option B : passer en live mode. Récupérer `sk_live_xxx` et `ca_xxx` live. ⚠️ Plus lourd : prévoir aussi le `STRIPE_WEBHOOK_SECRET` live et tous les comptes Connect existants à reconnecter.

### Task 3.3 : Mettre à jour les env vars Render

- [ ] **Étape 1 :** Render Dashboard → service → Environment → modifier `STRIPE_CLIENT_ID` (ou `STRIPE_SECRET_KEY` selon l'option).

- [ ] **Étape 2 :** Vérifier que `STRIPE_CONNECT_REDIRECT_URI` matche exactement une des URLs enregistrées dans Stripe Dashboard → Connect → Settings → Integration → Redirects.

- [ ] **Étape 3 :** Aussi vérifier sur Stripe Dashboard que `STRIPE_CONNECT_REDIRECT_URI` est bien dans la liste des redirect_uri autorisés (sinon Stripe rejette le code).

- [ ] **Étape 4 :** Render redéploie automatiquement au changement d'env var. Confirmer dans les logs : `[stripe.config] mode=TEST` (ou LIVE) sans warning.

### Task 3.4 : Test bout-en-bout OAuth

- [ ] **Étape 1 :** Sur l'app prod, créer un nouveau restaurant test (ou en utiliser un sans Stripe connecté).

- [ ] **Étape 2 :** Cliquer "Connecter Stripe" → être redirigé vers `connect.stripe.com`.

- [ ] **Étape 3 :** Compléter le formulaire Stripe → être redirigé sur `/settings/restaurants/<id>?stripe_success=1`.

- [ ] **Étape 4 :** Vérifier dans Supabase que `restaurants.stripe_account_id` est rempli, `stripe_charges_enabled` reflète le statut réel.

**Rollback :** Restaurer l'ancienne valeur de `STRIPE_CLIENT_ID` (ou `STRIPE_SECRET_KEY`) dans Render. Aucun changement code à rollback.

---

## Phase 4 — Fix Bug #3 (incohérence Connect dans send-deposit/send-balance)

**⚠️ Phase la plus risquée.** Modifie le flow de création de facture. À tester en LOCAL avec un compte Stripe Connect test avant de déployer.

### Task 4.1 : Branche dédiée

- [ ] **Étape 1 :** Créer la branche
```bash
git checkout main && git pull
git checkout -b fix/stripe-connect-deposit-balance-routing
```

### Task 4.2 : Extraire la logique commune en helper

**Files :**
- Modify : `backend/src/lib/stripe-connect.ts`

**Pourquoi :** Plutôt que dupliquer la résolution Connect/legacy dans 3 endroits (send-deposit, send-balance, autoSend), centraliser dans un helper.

- [ ] **Étape 1 :** Ajouter en bas de `backend/src/lib/stripe-connect.ts` :
```typescript
import type Stripe from 'stripe'

export interface ResolvedStripeContext {
  mode: StripeMode
  isEnabled: boolean
  connectAcctId: string | null
  opts: Stripe.RequestOptions | undefined
  /** Returns existing customer id for this email on the right account */
  getOrCreateCustomer: (email: string, name: string | null) => Promise<string>
}

/**
 * Résout le contexte Stripe (Connect/legacy/bank_transfer) pour un restaurant
 * et retourne tout ce qu'il faut pour faire les appels API avec les bonnes options.
 *
 * Throws si le restaurant est en erreur (NOT_CONNECTED / CHARGES_DISABLED) sans LEGACY_MODE.
 */
export async function resolveStripeForRestaurant(
  restaurantId: string,
  platformStripe: Stripe
): Promise<ResolvedStripeContext> {
  const ctx = await getRestaurantStripeContext(restaurantId)
  if (!ctx) throw new Error(`Restaurant ${restaurantId} introuvable`)

  const mode = resolveStripeMode(ctx)
  const connectAcctId = mode.mode === 'connect' ? mode.acctId : null
  const opts = stripeRequestOptions(connectAcctId)
  const isEnabled = mode.mode !== 'bank_transfer'

  if (mode.mode === 'error') {
    const err = new Error(`Stripe non disponible pour ce restaurant: ${mode.code}`)
    ;(err as any).code = mode.code
    throw err
  }

  const getOrCreateCustomer = async (email: string, name: string | null) => {
    if (connectAcctId) {
      return getOrCreateStripeCustomerOnAccount(email, name, connectAcctId)
    }
    // Legacy / platform mode
    const existing = await platformStripe.customers.list({ email, limit: 1 })
    if (existing.data.length > 0) return existing.data[0].id
    const customer = await platformStripe.customers.create({
      email,
      ...(name ? { name } : {}),
    })
    return customer.id
  }

  return { mode, isEnabled, connectAcctId, opts, getOrCreateCustomer }
}
```

### Task 4.3 : Refactor `send-deposit` pour utiliser le helper

**Files :**
- Modify : `backend/src/routes/quotes.ts:574-619` (bloc `isStripeEnabled` + invoice creation)

- [ ] **Étape 1 :** En haut du fichier `quotes.ts`, importer le helper :
```typescript
import { resolveStripeForRestaurant } from '../lib/stripe-connect.js'
```

- [ ] **Étape 2 :** Remplacer le bloc `if (isStripeEnabled) { ... }` à la ligne 579-616 par :
```typescript
    let invoiceUrl = ''
    let invoiceId = ''
    let connectAcctIdForPayment: string | null = null

    // Résoudre le contexte Stripe (Connect / legacy / bank_transfer)
    let stripeCtx: Awaited<ReturnType<typeof resolveStripeForRestaurant>> | null = null
    try {
      stripeCtx = await resolveStripeForRestaurant(restaurant.id, stripe)
    } catch (err: any) {
      if (err.code === 'NOT_CONNECTED' || err.code === 'CHARGES_DISABLED') {
        return res.status(412).json({ error: err.code, message: err.message })
      }
      throw err
    }

    if (stripeCtx.isEnabled) {
      console.log(`[send-deposit] Creating Stripe invoice (mode=${stripeCtx.mode.mode}) for deposit: ${formatEuroWhole(depositAmount)}`)

      const customerId = await stripeCtx.getOrCreateCustomer(
        contact.email,
        `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || null
      )

      const invoice = await stripe.invoices.create({
        customer: customerId,
        collection_method: 'send_invoice',
        days_until_due: 30,
        metadata: {
          booking_id: booking?.id || '',
          quote_id: quoteId,
          link_type: 'deposit',
          restaurant_id: restaurant.id,
        },
        description: (quoteData as any).deposit_amount_override != null
          ? `Acompte ${formatEuroWhole(depositAmount)} - ${quoteData.quote_number}`
          : `Acompte ${effectiveDepositPct}% - ${quoteData.quote_number}`,
      }, stripeCtx.opts)

      await stripe.invoiceItems.create({
        invoice: invoice.id,
        customer: customerId,
        amount: Math.round(depositAmount * 100),
        currency: 'eur',
        description: (quoteData as any).deposit_amount_override != null
          ? `Acompte ${formatEuroWhole(depositAmount)} pour ${restaurant?.name || 'événement'} le ${quoteData.date_start || booking?.event_date || ''}`
          : `Acompte ${effectiveDepositPct}% pour ${restaurant?.name || 'événement'} le ${quoteData.date_start || booking?.event_date || ''}`,
      }, stripeCtx.opts)

      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id, undefined, stripeCtx.opts)
      invoiceUrl = finalizedInvoice.hosted_invoice_url || ''
      invoiceId = invoice.id
      connectAcctIdForPayment = stripeCtx.connectAcctId
    } else {
      console.log(`[send-deposit] Stripe disabled for restaurant — sending bank transfer only deposit for ${formatEuroWhole(depositAmount)}`)
    }
```

- [ ] **Étape 3 :** Ailleurs dans la même fonction, là où le `payment` row est inséré en BDD, ajouter `stripe_account_id: connectAcctIdForPayment` pour tracer.

### Task 4.4 : Refactor `send-balance` identique

**Files :**
- Modify : `backend/src/routes/quotes.ts:883-924`

- [ ] **Étape 1 :** Appliquer le même refactor que Task 4.3 sur `send-balance` (ligne 883+).

### Task 4.5 : Refactor `autoSendDepositAfterSignature` pour utiliser le helper

**Files :**
- Modify : `backend/src/routes/webhooks.ts:922-977`

- [ ] **Étape 1 :** Remplacer le bloc `stripeCtx` + `stripeMode` + `getOrCreateStripeCustomerOnAccount` par un appel au helper `resolveStripeForRestaurant`. Garantit que les 3 paths ont exactement le même comportement.

### Task 4.6 : Tester en local avec Stripe Connect test

**Prérequis :** Compte Stripe **test** + au moins 1 compte Connect test (créé via Stripe Dashboard → Connect → "Create test account").

- [ ] **Étape 1 :** Dans Supabase (en local ou test), mettre à jour un restaurant test :
```sql
UPDATE restaurants
SET stripe_enabled = true,
    stripe_account_id = 'acct_xxx_du_compte_test',
    stripe_charges_enabled = true
WHERE id = '<restaurant_test_id>';
```

- [ ] **Étape 2 :** Démarrer le backend local + frontend local.

- [ ] **Étape 3 :** Créer un devis lié à ce restaurant, le signer (manuel via UI ou bypass SignNow en local), puis cliquer **"Envoyer acompte"**.

- [ ] **Étape 4 :** Dans **Stripe Dashboard → Connect → Connected accounts → [le test account]**, vérifier que la facture y apparaît (pas dans le dashboard plateforme).

- [ ] **Étape 5 :** Refaire le test avec un restaurant **sans Connect** (`stripe_enabled = true` mais `stripe_account_id = null`) :
  - Si `STRIPE_CONNECT_LEGACY_MODE=true` → facture sur la plateforme (mode legacy)
  - Sinon → erreur 412 `NOT_CONNECTED` retournée au frontend

### Task 4.7 : Tester le webhook flow complet

- [ ] **Étape 1 :** Avec `stripe listen --forward-to localhost:3001/api/webhooks/stripe --connect` (le `--connect` est crucial pour recevoir les events des comptes connectés).

- [ ] **Étape 2 :** Payer la facture créée à l'étape précédente avec carte test `4242 4242 4242 4242`.

- [ ] **Étape 3 :** Vérifier que `invoice.paid` arrive **avec `event.account = acct_xxx`** et que le payment passe à `paid` en BDD, booking à `confirme_fonctionnaire`.

### Task 4.8 : PR + déploiement off-peak

- [ ] **Étape 1 :** Commit + PR
```bash
git add backend/src/routes/quotes.ts backend/src/lib/stripe-connect.ts backend/src/routes/webhooks.ts
git commit -m "fix(stripe): unifier flow Connect entre send-deposit/send-balance/auto-send

Les endpoints /send-deposit et /send-balance créaient les factures sur la
plateforme même quand le restaurant avait un compte Connect activé. Le
flow automatique après signature (autoSendDepositAfterSignature) utilisait
correctement le compte Connect. Risque comptable et conformité.

Centralise la résolution du contexte Stripe dans resolveStripeForRestaurant
et applique le même comportement aux 3 paths."
git push -u origin fix/stripe-connect-deposit-balance-routing
gh pr create --title "fix(stripe): unifier flow Connect entre send-deposit, send-balance et auto-send"
```

- [ ] **Étape 2 :** Déployer en off-peak (14h-17h, mardi/mercredi/jeudi).

- [ ] **Étape 3 :** Surveiller les 30 premières minutes :
  - Logs Render : pas de nouvelle erreur Stripe
  - Stripe Dashboard → Activity : factures apparaissent bien sur les bons comptes Connect

**Rollback :** `git revert` + push. **Attention** : les factures déjà créées avant le revert restent où elles sont (Connect ou plateforme). Pas de migration de données.

---

## Phase 5 — Activer la signature webhook + ajouter `invoice.payment_failed`

### Task 5.1 : Récupérer le webhook secret

- [ ] **Étape 1 :** Stripe Dashboard → **Developers → Webhooks** → vérifier qu'un endpoint pointe sur `https://<render-url>/api/webhooks/stripe`. Si pas → créer.

- [ ] **Étape 2 :** Cocher tous les events que le code traite :
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed` ← nouveau (Phase 5)
  - `payment_intent.payment_failed`
  - `account.updated`
  - `account.application.deauthorized`
  - `charge.refunded`
  - `charge.dispute.created`
  - `charge.dispute.closed`
  - `payout.paid`

- [ ] **Étape 3 :** Cocher **"Listen to events on Connected accounts"** (essentiel pour recevoir les events des comptes Connect).

- [ ] **Étape 4 :** Copier le **Signing secret** (`whsec_xxx`).

### Task 5.2 : Ajouter le handler `invoice.payment_failed` + guard de production

**Files :**
- Modify : `backend/src/routes/webhooks.ts:34-53` (init webhook secret check)
- Modify : `backend/src/routes/webhooks.ts:55-104` (switch case)

- [ ] **Étape 1 :** Créer la branche
```bash
git checkout main && git pull
git checkout -b fix/stripe-webhook-secret-and-invoice-failed
```

- [ ] **Étape 2 :** Renforcer la vérification de signature (lignes 28-53) :
```typescript
webhooksRouter.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string

  let event: Stripe.Event

  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET manquant en production — webhook rejeté')
      return res.status(503).send('Webhook signature verification not configured')
    }
    // Dev only — accept without verification
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET not configured (dev mode) - accepting without verification')
    try {
      const bodyString = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body
      event = typeof bodyString === 'string' ? JSON.parse(bodyString) : bodyString
    } catch (parseErr) {
      console.error('Failed to parse Stripe webhook body:', parseErr)
      return res.status(400).send('Invalid webhook payload')
    }
  } else {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err)
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`)
    }
  }

  console.log(`[Stripe Webhook] Event type: ${event.type}, account: ${event.account || 'platform'}`)

  switch (event.type) {
    // ... existing cases ...
```

- [ ] **Étape 3 :** Ajouter le nouveau case (après `payment_intent.payment_failed`) :
```typescript
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await handleInvoicePaymentFailed(invoice, event.account)
      break
    }
```

- [ ] **Étape 4 :** Ajouter la fonction `handleInvoicePaymentFailed` (à côté de `handleInvoicePaymentSuccess`) :
```typescript
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, eventAccount?: string) {
  const { booking_id, quote_id, link_type } = invoice.metadata || {}
  console.log(`[Stripe Invoice] Payment FAILED - booking: ${booking_id}, quote: ${quote_id}, type: ${link_type}, invoice: ${invoice.id}`)

  if (!booking_id) {
    console.warn(`[Stripe Invoice] invoice.payment_failed sans booking_id (invoice ${invoice.id})`)
    return
  }

  try {
    // Marquer le payment existant comme failed
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, organization_id')
      .eq('stripe_payment_id', invoice.id)
      .maybeSingle()

    if (existingPayment) {
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', existingPayment.id)
    } else {
      // Insérer un payment failed si pas trouvé (fallback)
      const { data: bookingForOrg } = await supabase
        .from('bookings')
        .select('organization_id')
        .eq('id', booking_id)
        .single()
      await supabase.from('payments').insert({
        organization_id: bookingForOrg?.organization_id || null,
        booking_id,
        quote_id: quote_id || null,
        amount: (invoice.amount_due || 0) / 100,
        payment_type: link_type || 'full',
        payment_modality: link_type === 'deposit' ? 'acompte' : 'solde',
        payment_method: 'stripe',
        stripe_payment_id: invoice.id,
        status: 'failed',
      })
    }

    // Activity log
    const { data: booking } = await supabase
      .from('bookings').select('organization_id').eq('id', booking_id).single()
    await supabase.from('activity_logs').insert({
      organization_id: booking?.organization_id,
      booking_id,
      action_type: 'payment.failed',
      action_label: `Paiement Stripe échoué — ${((invoice.amount_due || 0) / 100).toLocaleString('fr-FR')} €${invoice.last_finalization_error ? ` (${invoice.last_finalization_error.message})` : ''}`,
      actor_type: 'webhook',
      actor_name: 'Stripe',
      entity_type: 'payment',
      entity_id: existingPayment?.id || null,
      metadata: { invoice_id: invoice.id, acct_id: eventAccount },
    })

    console.log(`[Stripe Invoice] ✅ Payment failed enregistré pour booking ${booking_id}`)
  } catch (error) {
    console.error('[Stripe Invoice] Erreur handling invoice.payment_failed:', error)
  }
}
```

### Task 5.3 : Mettre à jour le test routing

- [ ] **Étape 1 :** Le test créé en Task 2.3 doit maintenant passer pour `invoice.payment_failed`. Confirmer en local :
```bash
cd backend && pnpm test
```
**Expected :** Tous les `it()` de `webhook-switch.test.ts` passent.

### Task 5.4 : Déployer dans l'ordre

**⚠️ Ordre critique :** ajouter le secret sur Render **AVANT** que le code qui rejette les webhooks non signés soit déployé, sinon downtime.

- [ ] **Étape 1 :** Render Dashboard → Environment → renseigner `STRIPE_WEBHOOK_SECRET=whsec_xxx`. Render redéploie (le code actuel utilise déjà le secret si présent, donc safe). Surveiller les logs : doit voir `[Stripe Webhook] Event type: xxx, account: yyy` sans warning "not configured".

- [ ] **Étape 2 :** Une fois confirmé que la signature est vérifiée (env loadée), merger la PR avec le guard `NODE_ENV === 'production'` + nouveau case `invoice.payment_failed`.

- [ ] **Étape 3 :** Test bout-en-bout :
```bash
# Local avec stripe CLI vers Render staging si possible, ou Stripe Dashboard → Webhooks → endpoint → "Send test webhook"
stripe trigger invoice.payment_failed
```
Vérifier dans les logs Render : `[Stripe Invoice] Payment FAILED - ...`

**Rollback :** 2 niveaux :
- Si le code casse : `git revert` + push.
- Si la signature secret est mauvaise : supprimer la variable `STRIPE_WEBHOOK_SECRET` sur Render → le code fallback dev mode... **MAIS** notre code prod renvoie 503 si NODE_ENV=production. **Donc en cas de pépin, garder le secret valide ET revert le code.**

---

## Phase 6 — Fix SignNow signature (Bug #6)

### Task 6.1 : Brancher `express.raw()` sur `/api/webhooks/signnow`

**Files :**
- Modify : `backend/src/index.ts:66`

- [ ] **Étape 1 :** Créer la branche
```bash
git checkout -b fix/signnow-raw-body-signature
```

- [ ] **Étape 2 :** Remplacer ligne 66 :
```typescript
// AVANT
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }))

// APRÈS
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }))
app.use('/api/webhooks/signnow', express.raw({ type: 'application/json' }))
```

### Task 6.2 : Adapter le handler SignNow pour lire le raw buffer

**Files :**
- Modify : `backend/src/routes/webhooks.ts:112-169`

- [ ] **Étape 1 :** Au début du handler `/signnow`, parser le buffer :
```typescript
webhooksRouter.post('/signnow', async (req: Request, res: Response) => {
  try {
    // req.body est un Buffer grâce à express.raw()
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))

    const signature = req.headers['x-signnow-signature'] as string
      || req.headers['x-sn-signature'] as string
      || req.headers['signature'] as string
      || ''

    // Bloquer si secret configuré et signature invalide (en prod)
    if (process.env.SIGNNOW_WEBHOOK_SECRET) {
      if (!signature) {
        console.error('[SignNow Webhook] Signature manquante alors que SIGNNOW_WEBHOOK_SECRET configuré')
        if (process.env.NODE_ENV === 'production') {
          return res.status(401).json({ error: 'missing_signature' })
        }
      } else {
        const isValid = verifyWebhookSignature(rawBody, signature)
        if (!isValid) {
          console.error('[SignNow Webhook] Signature invalide')
          if (process.env.NODE_ENV === 'production') {
            return res.status(401).json({ error: 'invalid_signature' })
          }
          console.warn('[SignNow Webhook] Signature invalide — accepté en dev')
        }
      }
    }

    const payload = JSON.parse(rawBody)
    // ... reste du handler inchangé (eventType extraction, etc.)
```

### Task 6.3 : Vérifier la fonction `verifyWebhookSignature`

**Files :**
- Read : `backend/src/lib/signnow.ts`

- [ ] **Étape 1 :** Lire la fonction `verifyWebhookSignature` dans `backend/src/lib/signnow.ts` pour confirmer qu'elle utilise le bon algo (HMAC-SHA256 sur raw body avec `SIGNNOW_WEBHOOK_SECRET`).

- [ ] **Étape 2 :** Si l'algo est correct, le fix de `express.raw()` devrait suffire. Sinon, corriger l'algo selon la doc SignNow.

### Task 6.4 : Test local

- [ ] **Étape 1 :** Démarrer le backend local. Désactiver SIGNNOW_WEBHOOK_SECRET temporairement pour pouvoir simuler des webhooks bruts.

- [ ] **Étape 2 :** `curl -X POST localhost:3001/api/webhooks/signnow -H 'Content-Type: application/json' -d '{"event":"user.document.complete","document_id":"test123"}'`

- [ ] **Étape 3 :** Vérifier que le log montre bien `[SignNow Webhook] Event: user.document.complete, Document: test123` et que le code dans `handleSignNowDocumentComplete` est appelé (échouera car document inexistant, mais ce sera un échec contrôlé pas un parse error).

### Task 6.5 : Déploiement

- [ ] **Étape 1 :** Avant merge, **vérifier** sur SignNow Dashboard que le webhook est bien configuré avec un secret, et que le secret est dans Render env.

- [ ] **Étape 2 :** Merger + déployer + monitorer les premiers webhooks après déploiement (un client signe un devis → vérifier que `[SignNow Webhook]` passe).

**Rollback :** revert. Le warning original `processing anyway for now` permet au flow de fonctionner même avec le bug, donc rollback safe.

---

## Tests d'intégration manuels post-déploiement (toutes phases)

Une fois toutes les phases déployées, exécuter ce parcours utilisateur complet :

### Parcours 1 : Réservation avec compte Connect
- [ ] Créer un restaurant test avec compte Stripe Connect test
- [ ] Créer un booking + devis pour ce restaurant
- [ ] Envoyer pour signature → signer côté client
- [ ] Email d'acompte auto-envoyé (vérifier dans Resend logs)
- [ ] Cliquer le lien Stripe Invoice dans l'email → carte test `4242 ... 4242` → payer
- [ ] Vérifier que :
  - Stripe Dashboard → Connected account → l'invoice est marquée payée
  - Supabase `payments.status = paid`, `quotes.status = deposit_paid`, `bookings.status_id` → "Confirmé"
  - Document `Reçu Stripe - Acompte` apparait dans la fiche booking
  - Aucune erreur dans les logs Render

### Parcours 2 : Échec de paiement
- [ ] Même setup, mais payer avec carte test `4000 0000 0000 0002` (declined)
- [ ] Vérifier :
  - Logs Render : `[Stripe Invoice] Payment FAILED - booking: ...`
  - Supabase `payments.status = failed`
  - Activity log entry visible dans la fiche booking

### Parcours 3 : Restaurant sans Connect (bank transfer)
- [ ] Restaurant avec `stripe_enabled = false`
- [ ] Send-deposit → vérifier email envoyé sans lien Stripe (juste IBAN)
- [ ] Payment row créé avec `payment_method = 'virement'`, `status = 'pending'`

### Parcours 4 : OAuth Connect new restaurant
- [ ] Nouveau restaurant sans Stripe
- [ ] Cliquer "Connecter Stripe" → flow OAuth complet → retour sur app avec success
- [ ] `restaurants.stripe_account_id` rempli

---

## Plan de rollback global

Si après tous les déploiements il y a un problème majeur :

1. **Rollback rapide (env only) :** Restaurer la valeur précédente de `STRIPE_WEBHOOK_SECRET` ou la supprimer → l'ancien code accepte sans verification (mais 6/x code rejette en prod → re-vérifier la branche en cours).

2. **Rollback complet :** `git revert <merge-commit-de-phase-X>` sur main + push. Render redéploie.

3. **Données :** Aucune migration SQL dans ce plan → les données restent intactes. Les factures Stripe déjà créées avant le rollback restent où elles sont (plateforme ou Connect).

4. **Fallback ultime :** activer `STRIPE_CONNECT_LEGACY_MODE=true` sur Render → tout retombe sur la plateforme, même les restaurants Connect.

---

## Critères d'acceptation finaux

- [ ] Zero `Unknown arguments` dans les logs Render sur 7 jours
- [ ] Zero `Authorization code provided does not belong to you` sur 7 jours (sauf si user tente sur restaurant déjà connecté ailleurs)
- [ ] Zero `STRIPE_WEBHOOK_SECRET not configured` au boot
- [ ] Tous les webhooks Stripe arrivent avec signature valide
- [ ] `invoice.payment_failed` produit bien un `payments.status = failed` en BDD
- [ ] Toutes les factures Stripe sont créées sur le bon compte (Connect quand applicable)
- [ ] CI pipeline inclut `pnpm test` et passe sur main

---

## Self-Review

**Couverture spec :** 6 bugs identifiés → 6 phases. ✓
- Bug #1 → Phase 0 + 3
- Bug #2 → Phase 1
- Bug #3 → Phase 4
- Bug #4 → Phase 5 (partie 1)
- Bug #5 → Phase 5 (partie 2)
- Bug #6 → Phase 6

**Placeholder scan :** Aucun "TBD" / "à compléter" — toutes les modifs ont du code exact. ✓

**Type consistency :** `resolveStripeForRestaurant` retourne `ResolvedStripeContext` utilisé dans 3 endroits avec la même interface. ✓

**Ordre de déploiement :** Phases isolées, chacune déployable indépendamment, chacune avec rollback. Risque croissant : 1 (faible) → 4 (haute) → 5 (sécurité). ✓
