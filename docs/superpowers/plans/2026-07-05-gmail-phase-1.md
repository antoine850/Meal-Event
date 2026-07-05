# Gmail Phase 1 — Fondations OAuth par commercial

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les fondations Gmail : schéma DB (comptes + fils + messages), OAuth Google **par utilisateur** avec state signé et refresh token chiffré, et une page « Intégrations » où chaque commercial connecte sa boîte. Aucun email n'est envoyé ni lu par Gmail à ce stade.

**Architecture:** On calque le pattern OAuth existant de Google Calendar (`backend/src/lib/google-calendar.ts` + `routes/google-calendar.ts`), mais scopé par `user_id` au lieu de `restaurant_id`, avec une table dédiée `user_gmail_accounts` (token chiffré, service-role only), un `state` OAuth signé HMAC (le callback Calendar actuel prend le state brut, faille qu'on ne reproduit pas), et un flag d'activation `GMAIL_INTEGRATION_ENABLED` (défaut OFF) qui garde tout éteint tant que la console Google Cloud n'est pas configurée.

**Tech Stack:** Express 4 + TypeScript, googleapis (déjà en dépendance), Node `crypto` (AES-256-GCM), Supabase (service role backend, RLS front), Vite + React 19 + TanStack Query/Router, Vitest.

**Contexte spec :** `docs/superpowers/specs/2026-06-26-gmail-client-email-design.md`, sections 1-2 et « Phase 1 ». La phase 0bis (refactor Resend + onglet trace) est déjà mergée sur main.

**Décisions verrouillées (05/07) :** client OAuth = réutilise les credentials Calendar (`GOOGLE_CLIENT_ID`/`SECRET`) + une redirect URI dédiée Gmail ; UI sur une nouvelle page `/settings/integrations` ; on construit maintenant, `GMAIL_INTEGRATION_ENABLED` OFF, Thomas configure Google Cloud plus tard.

**Conventions du repo (extraits CLAUDE.md) :**
- Commits : une ligne courte en français, minuscules, `type(scope): sujet`, pas de body, jamais de `Co-Authored-By`, pas d'emoji.
- Commentaires FR minimalistes (le pourquoi, pas le quoi), pas de docstring sur du code évident, pas de bannière.
- Pas de sur-ingénierie ; validation/erreurs seulement aux frontières externes (ici : OAuth callback, entrée Google). Diff minimal. ASCII, double tiret `--`.
- Backend Supabase = client service-role non typé : le pattern existant caste (`as never`, `as any`), on suit.

**Nouvelles variables d'environnement (backend)** — à documenter dans `backend/.env.example` (Task 8), à renseigner en prod par Thomas :
- `GMAIL_REDIRECT_URI` — ex `https://api.mealevent.fr/api/gmail/callback`
- `GMAIL_TOKEN_ENC_KEY` — 64 caractères hex (= clé AES-256 de 32 octets)
- `GMAIL_OAUTH_STATE_SECRET` — chaîne aléatoire (signature HMAC du state)
- `GMAIL_INTEGRATION_ENABLED` — `'true'` pour activer le flux de connexion (défaut : absent = OFF)
- Réutilisés : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`

---

## File Structure

| Fichier | Action | Responsabilité |
|---|---|---|
| `supabase/migrations/20260706_gmail_foundations.sql` | Create | 3 tables (user_gmail_accounts, email_threads, email_messages) + colonnes email_logs + RLS + index. Note : le CHECK `booking_id OR contact_id` du spec est reporte en phase 2 (voir Task 1). |
| `backend/src/lib/crypto.ts` | Create | `encryptToken` / `decryptToken` (AES-256-GCM, clé env) |
| `backend/src/lib/oauth-state.ts` | Create | `signState` / `verifyState` (HMAC + expiration) |
| `backend/src/lib/gmail.ts` | Create | Scopes, OAuth client Gmail, auth-url, callback, `gmailClient(userId)`, status, disconnect |
| `backend/src/routes/gmail.ts` | Create | Routes auth-url / callback (public) / status / disconnect, gated par le flag |
| `backend/src/index.ts` | Modify | Monter `gmailPublicRouter` (avant auth) et `gmailRouter` (après auth) |
| `backend/tests/lib/crypto.test.ts` | Create | Round-trip chiffrement, clé requise, altération détectée |
| `backend/tests/lib/oauth-state.test.ts` | Create | Sign/verify, expiration, altération |
| `backend/tests/lib/gmail-authurl.test.ts` | Create | L'auth-url porte scopes + state signé + offline/consent |
| `backend/tests/routes/gmail-routes.test.ts` | Create | Verrou statique : routes présentes, callback public, gating |
| `src/features/settings/hooks/use-gmail-account.ts` | Create | Hooks React Query (status / auth-url / disconnect) |
| `src/features/settings/integrations/components/gmail-settings.tsx` | Create | Carte de connexion Gmail (par utilisateur) |
| `src/features/settings/integrations/page.tsx` | Create | Page « Intégrations » |
| `src/routes/_authenticated/settings/integrations.tsx` | Create | Route TanStack |
| `src/components/layout/data/sidebar-data.ts` | Modify | Entrée de nav « Intégrations » |

**Hors périmètre phase 1 (rappel) :** aucun envoi/polling Gmail, pas de `sendAs` (From = `google_email`, alias reporté en phase 2), pas de régénération des types Supabase (ni le backend service-role ni le front phase 1 ne lisent les nouvelles tables ; la régen se fera quand le front lira `email_messages`, phase 4).

---

### Task 1: Migration — tables Gmail + colonnes email_logs

**Files:**
- Create: `supabase/migrations/20260706_gmail_foundations.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Fondations Gmail (phase 1) : comptes OAuth par utilisateur, fils et messages.
-- Le token vit uniquement en service role (aucune policy SELECT client dessus).
-- email_threads/email_messages sont scopes org (lecture front en phase 4).

-- 1. Comptes Gmail par utilisateur (1:1). refresh_token chiffre applicatif.
CREATE TABLE user_gmail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_email TEXT,
  refresh_token TEXT NOT NULL,
  scopes TEXT,
  history_id TEXT,
  status TEXT NOT NULL DEFAULT 'connected',
  sending_enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_gmail_accounts ENABLE ROW LEVEL SECURITY;

-- Token sensible : accessible en service role UNIQUEMENT (le front lit le
-- statut via un endpoint backend, jamais la table). Pas de policy client.
CREATE POLICY "user_gmail_accounts_service_role" ON user_gmail_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- 2. Fils de conversation (un par booking, un par contact hors booking, ou facturation).
-- Le CHECK "booking_id ou contact_id non nul" du spec est REPORTE en phase 2 :
-- couple a contact_id ON DELETE SET NULL, il bloquerait la suppression d'un
-- contact possedant un fil contact-only (SET NULL -> les deux nuls -> CHECK
-- viole -> delete du contact echoue). La phase 1 ne cree aucun fil, donc le
-- CHECK ne protege rien ici ; il sera ajoute en phase 2 avec la politique de
-- suppression des fils contact-only.
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'booking',
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un seul fil par (booking, kind).
CREATE UNIQUE INDEX email_threads_booking_kind_uidx
  ON email_threads (booking_id, kind) WHERE booking_id IS NOT NULL;
CREATE INDEX email_threads_contact_idx ON email_threads (contact_id);
CREATE INDEX email_threads_org_idx ON email_threads (organization_id);

ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_threads_select_org" ON email_threads
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY "email_threads_service_role" ON email_threads
  FOR ALL USING (auth.role() = 'service_role');

-- 3. Messages d'un fil (sortants Gmail/Resend, entrants Gmail).
-- rfc_message_id = header Message-ID RFC 2822 (sert au threading In-Reply-To/References).
-- references_header : le mot "references" est reserve en SQL, on le renomme.
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  gmail_thread_id TEXT,
  gmail_message_id TEXT,
  rfc_message_id TEXT,
  from_email TEXT,
  to_emails TEXT[],
  cc TEXT[],
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  snippet TEXT,
  sent_at TIMESTAMPTZ,
  in_reply_to TEXT,
  references_header TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedup du polling : un gmail_message_id ne peut apparaitre qu'une fois.
CREATE UNIQUE INDEX email_messages_gmail_msg_uidx
  ON email_messages (gmail_message_id) WHERE gmail_message_id IS NOT NULL;
CREATE INDEX email_messages_thread_idx ON email_messages (thread_id);

ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_messages_select_org" ON email_messages
  FOR SELECT USING (
    thread_id IN (
      SELECT id FROM email_threads
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );
CREATE POLICY "email_messages_service_role" ON email_messages
  FOR ALL USING (auth.role() = 'service_role');

-- 4. Extensions additives de email_logs (rétrocompatibles, valeurs par défaut).
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'resend';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
```

- [ ] **Step 2: Vérifier l'unicité du nom de fichier**

Run: `ls supabase/migrations/ | grep 20260706`
Expected: seul `20260706_gmail_foundations.sql`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260706_gmail_foundations.sql
git commit -m "feat(gmail): schema fondations (comptes, fils, messages)"
```

**Note déploiement (Task 8) :** SQL appliqué manuellement dans l'éditeur SQL Supabase prod. Migration purement additive : elle ne touche aucune ligne existante et n'affecte pas le code en prod tant que le backend Gmail n'est pas déployé.

---

### Task 2: Chiffrement des tokens (`crypto.ts`)

Le refresh token Gmail porte le scope `gmail.readonly` : on le chiffre au repos (AES-256-GCM). Le backend n'a aucun module crypto aujourd'hui, on l'introduit ici. TDD.

**Files:**
- Create: `backend/tests/lib/crypto.test.ts`
- Create: `backend/src/lib/crypto.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

// Clé de test : 32 octets en hex (64 caractères).
const TEST_KEY = '0'.repeat(64)

beforeAll(() => {
  process.env.GMAIL_TOKEN_ENC_KEY = TEST_KEY
})

describe('crypto token', () => {
  it('round-trips a value', async () => {
    const { encryptToken, decryptToken } = await import('../../src/lib/crypto.js')
    const secret = '1//refresh-token-abc.def_ghi'
    const enc = encryptToken(secret)
    expect(enc).not.toContain(secret)
    expect(decryptToken(enc)).toBe(secret)
  })

  it('produces a different ciphertext each time (random iv)', async () => {
    const { encryptToken } = await import('../../src/lib/crypto.js')
    expect(encryptToken('same')).not.toBe(encryptToken('same'))
  })

  it('rejects a tampered ciphertext', async () => {
    const { encryptToken, decryptToken } = await import('../../src/lib/crypto.js')
    const enc = encryptToken('value')
    const tampered = enc.slice(0, -2) + (enc.endsWith('AA') ? 'BB' : 'AA')
    expect(() => decryptToken(tampered)).toThrow()
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd backend && pnpm vitest run tests/lib/crypto.test.ts`
Expected: FAIL (module `../../src/lib/crypto.js` introuvable).

- [ ] **Step 3: Implémenter `crypto.ts`**

```typescript
import crypto from 'node:crypto'

// AES-256-GCM. La cle vient de GMAIL_TOKEN_ENC_KEY (64 hex = 32 octets).
// Format de sortie : base64(iv).base64(tag).base64(ciphertext).
function getKey(): Buffer {
  const hex = process.env.GMAIL_TOKEN_ENC_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('GMAIL_TOKEN_ENC_KEY manquante ou invalide (64 hex attendus)')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Token chiffre malforme')
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivB64, 'base64')
  )
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd backend && pnpm vitest run tests/lib/crypto.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/crypto.ts backend/tests/lib/crypto.test.ts
git commit -m "feat(gmail): chiffrement aes-256-gcm des tokens"
```

---

### Task 3: State OAuth signé (`oauth-state.ts`)

Le callback Calendar actuel lit le `state` brut sans vérification (CSRF possible). Pour Gmail on signe le `state` (HMAC-SHA256 + expiration) et on le vérifie au callback avant toute écriture. TDD.

**Files:**
- Create: `backend/tests/lib/oauth-state.test.ts`
- Create: `backend/src/lib/oauth-state.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.GMAIL_OAUTH_STATE_SECRET = 'test-secret'
})

describe('oauth state', () => {
  it('signs and verifies a user id', async () => {
    const { signState, verifyState } = await import('../../src/lib/oauth-state.js')
    const state = signState('user-123')
    expect(verifyState(state)).toBe('user-123')
  })

  it('rejects a tampered state', async () => {
    const { signState, verifyState } = await import('../../src/lib/oauth-state.js')
    const state = signState('user-123')
    const tampered = state.replace('user-123', 'user-999')
    expect(verifyState(tampered)).toBeNull()
  })

  it('rejects an expired state', async () => {
    const { signState, verifyState } = await import('../../src/lib/oauth-state.js')
    const state = signState('user-123', -1000) // deja expire
    expect(verifyState(state)).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd backend && pnpm vitest run tests/lib/oauth-state.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `oauth-state.ts`**

```typescript
import crypto from 'node:crypto'

// State OAuth signe : "<userId>.<expiryMs>.<hmac>", base64url du payload signe.
// Empeche de lier une boite Gmail au user d'autrui (le state brut du flux
// Calendar est vulnerable). Duree de vie par defaut : 10 minutes.
function secret(): string {
  const s = process.env.GMAIL_OAUTH_STATE_SECRET
  if (!s) throw new Error('GMAIL_OAUTH_STATE_SECRET manquante')
  return s
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function signState(userId: string, ttlMs = 10 * 60 * 1000): string {
  const expiry = Date.now() + ttlMs
  const payload = `${userId}.${expiry}`
  return `${payload}.${sign(payload)}`
}

export function verifyState(state: string): string | null {
  const parts = state.split('.')
  if (parts.length !== 3) return null
  const [userId, expiry, sig] = parts
  const payload = `${userId}.${expiry}`
  const expected = sign(payload)
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null
  }
  if (Number(expiry) < Date.now()) return null
  return userId
}
```

Note : le test « expired » passe `ttlMs = -1000` → `expiry` dans le passé → `verifyState` retourne null. La signature reste valide, c'est bien l'expiration qui rejette.

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd backend && pnpm vitest run tests/lib/oauth-state.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/oauth-state.ts backend/tests/lib/oauth-state.test.ts
git commit -m "feat(gmail): state oauth signe avec expiration"
```

---

### Task 4: Client et helpers Gmail (`gmail.ts`)

Calque `google-calendar.ts` mais par utilisateur : auth-url avec state signé, callback qui vérifie le state / chiffre le token / initialise `history_id`, `gmailClient(userId)`, statut, déconnexion.

**Files:**
- Create: `backend/tests/lib/gmail-authurl.test.ts`
- Create: `backend/src/lib/gmail.ts`

- [ ] **Step 1: Écrire le test qui échoue (auth-url)**

`generateAuthUrl` est synchrone et ne touche pas le réseau : on peut vérifier l'URL produite.

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
  process.env.GMAIL_REDIRECT_URI = 'https://api.example.com/api/gmail/callback'
  process.env.GMAIL_OAUTH_STATE_SECRET = 'test-state-secret'
})

describe('gmail auth url', () => {
  it('embeds gmail scopes, offline access and a signed state', async () => {
    const { getGmailAuthUrl, GMAIL_SCOPES } = await import('../../src/lib/gmail.js')
    const url = getGmailAuthUrl('user-abc')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('access_type')).toBe('offline')
    expect(parsed.searchParams.get('prompt')).toBe('consent')
    const scope = parsed.searchParams.get('scope') || ''
    expect(scope).toContain('gmail.send')
    expect(scope).toContain('gmail.readonly')
    // Le state commence par le userId puis un point (format signe).
    expect(parsed.searchParams.get('state')).toMatch(/^user-abc\./)
    expect(GMAIL_SCOPES.length).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd backend && pnpm vitest run tests/lib/gmail-authurl.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `gmail.ts`**

```typescript
import { google } from 'googleapis'
import { supabase } from './supabase.js'
import { encryptToken, decryptToken } from './crypto.js'
import { signState, verifyState } from './oauth-state.js'

// gmail.send -> envoi ; gmail.readonly -> polling des reponses + getProfile ;
// userinfo.email -> adresse du compte connecte pour l'affichage.
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

function getGmailOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  )
}

export function getGmailAuthUrl(userId: string): string {
  const client = getGmailOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state: signState(userId),
  })
}

// Callback : verifie le state signe, echange le code, chiffre le refresh token,
// seme history_id (getProfile) et l'email du compte, upsert user_gmail_accounts.
export async function handleGmailCallback(code: string, state: string) {
  const userId = verifyState(state)
  if (!userId) throw new Error('State OAuth invalide ou expire')

  const { data: userRow } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single()
  if (!userRow?.organization_id) throw new Error('Utilisateur sans organisation')

  const client = getGmailOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error('Pas de refresh token (l\'utilisateur doit revoquer puis reconnecter)')
  }
  client.setCredentials(tokens)

  let googleEmail: string | null = null
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const { data } = await oauth2.userinfo.get()
    googleEmail = data.email || null
  } catch (err) {
    console.warn('[Gmail] userinfo.get a echoue:', err instanceof Error ? err.message : err)
  }

  let historyId: string | null = null
  try {
    const gmail = google.gmail({ version: 'v1', auth: client })
    const { data } = await gmail.users.getProfile({ userId: 'me' })
    historyId = data.historyId ? String(data.historyId) : null
  } catch (err) {
    console.warn('[Gmail] getProfile a echoue:', err instanceof Error ? err.message : err)
  }

  await supabase
    .from('user_gmail_accounts')
    .upsert(
      {
        user_id: userId,
        organization_id: userRow.organization_id,
        google_email: googleEmail,
        refresh_token: encryptToken(tokens.refresh_token),
        scopes: GMAIL_SCOPES.join(' '),
        history_id: historyId,
        status: 'connected',
        last_error: null,
        connected_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id' }
    )

  return { userId, googleEmail }
}

// Client Gmail authentifie pour un utilisateur, ou null s'il n'a pas de compte
// connecte. Utilise en phases 2-3 (envoi/polling).
export async function gmailClient(userId: string) {
  const { data: account } = await supabase
    .from('user_gmail_accounts')
    .select('refresh_token, status')
    .eq('user_id', userId)
    .single()

  if (!account?.refresh_token || account.status !== 'connected') return null

  const client = getGmailOAuthClient()
  client.setCredentials({ refresh_token: decryptToken(account.refresh_token) })
  return google.gmail({ version: 'v1', auth: client })
}

export async function getGmailAccountStatus(userId: string) {
  const { data: account } = await supabase
    .from('user_gmail_accounts')
    .select('google_email, status, sending_enabled')
    .eq('user_id', userId)
    .single()

  if (!account) {
    return { connected: false, email: null, status: null, sending_enabled: false }
  }
  return {
    connected: account.status === 'connected',
    email: account.google_email,
    status: account.status,
    sending_enabled: account.sending_enabled,
  }
}

export async function disconnectGmail(userId: string) {
  const { data: account } = await supabase
    .from('user_gmail_accounts')
    .select('refresh_token')
    .eq('user_id', userId)
    .single()

  if (account?.refresh_token) {
    try {
      const client = getGmailOAuthClient()
      await client.revokeToken(decryptToken(account.refresh_token))
    } catch {
      // Token peut-etre deja revoque, on continue le cleanup.
    }
  }

  await supabase.from('user_gmail_accounts').delete().eq('user_id', userId)
}
```

- [ ] **Step 4: Lancer le test + build, vérifier le succès**

Run: `cd backend && pnpm vitest run tests/lib/gmail-authurl.test.ts && pnpm build`
Expected: test PASS, `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/gmail.ts backend/tests/lib/gmail-authurl.test.ts
git commit -m "feat(gmail): client oauth par utilisateur et helpers"
```

---

### Task 5: Routes Gmail + montage dans index.ts

Routes par utilisateur (userId dérivé de `req.user.id`, jamais d'un paramètre client). Callback public (redirect Google). Tout gated par `GMAIL_INTEGRATION_ENABLED`.

**Files:**
- Create: `backend/src/routes/gmail.ts`
- Modify: `backend/src/index.ts` (imports + montage)
- Create: `backend/tests/routes/gmail-routes.test.ts`

- [ ] **Step 1: Écrire `routes/gmail.ts`**

```typescript
import { Router, type Request, type Response } from 'express'
import {
  getGmailAuthUrl,
  handleGmailCallback,
  getGmailAccountStatus,
  disconnectGmail,
} from '../lib/gmail.js'

export const gmailRouter = Router()
export const gmailPublicRouter = Router()

// Flag d'activation phase 1 : tant qu'il n'est pas 'true', le flux de connexion
// est eteint (Google Cloud pas encore configure).
function integrationEnabled(): boolean {
  return process.env.GMAIL_INTEGRATION_ENABLED === 'true'
}

// GET /api/gmail/auth-url — genere l'URL de consentement pour l'utilisateur courant.
gmailRouter.get('/auth-url', async (req: Request, res: Response) => {
  try {
    if (!integrationEnabled()) {
      return res.status(503).json({ error: 'Gmail integration disabled' })
    }
    const userId = (req as any).user?.id as string | undefined
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' })
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GMAIL_REDIRECT_URI) {
      return res.status(500).json({ error: 'Gmail integration is not configured' })
    }
    return res.json({ url: getGmailAuthUrl(userId) })
  } catch (error) {
    console.error('[Gmail] auth-url error:', error)
    return res.status(500).json({ error: 'Failed to generate auth URL' })
  }
})

// GET /api/gmail/status — statut de connexion de l'utilisateur courant.
gmailRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' })
    return res.json(await getGmailAccountStatus(userId))
  } catch (error) {
    console.error('[Gmail] status error:', error)
    return res.status(500).json({ error: 'Failed to get status' })
  }
})

// DELETE /api/gmail/disconnect — deconnecte le compte de l'utilisateur courant.
gmailRouter.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' })
    await disconnectGmail(userId)
    return res.json({ success: true })
  } catch (error) {
    console.error('[Gmail] disconnect error:', error)
    return res.status(500).json({ error: 'Failed to disconnect' })
  }
})

// GET /api/gmail/callback — retour OAuth Google (public, pas d'auth).
gmailPublicRouter.get('/callback', async (req: Request, res: Response) => {
  const frontendBase = process.env.FRONTEND_URL || 'https://app.mealevent.fr'
  const settingsUrl = `${frontendBase}/settings/integrations`
  try {
    const code = req.query.code as string
    const state = req.query.state as string
    const error = req.query.error as string

    if (error) return res.redirect(`${settingsUrl}?gmail_error=${encodeURIComponent(error)}`)
    if (!code || !state) return res.redirect(`${settingsUrl}?gmail_error=missing_params`)

    await handleGmailCallback(code, state)
    return res.redirect(`${settingsUrl}?gmail_connected=true`)
  } catch (error) {
    console.error('[Gmail] callback error:', error)
    return res.redirect(`${settingsUrl}?gmail_error=token_exchange_failed`)
  }
})
```

- [ ] **Step 2: Monter les routers dans `index.ts`**

Ajouter l'import à côté des autres routes (après la ligne `googleCalendarRouter` ~17) :

```typescript
import { gmailRouter, gmailPublicRouter } from './routes/gmail.js'
```

Monter le router public AVANT le bloc authentifié, à côté du callback Calendar (après la ligne 113 `app.use('/api/google-calendar', googleCalendarPublicRouter)`) :

```typescript
// Gmail OAuth callback (no auth — redirect from Google)
app.use('/api/gmail', gmailPublicRouter)
```

Monter le router authentifié dans le bloc `requireAuth` (après la ligne 119) :

```typescript
app.use('/api/gmail', requireAuth, gmailRouter)
```

- [ ] **Step 3: Écrire le verrou statique `gmail-routes.test.ts`**

Style du repo (lecture statique de source, cf. `webhook-switch.test.ts`).

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const read = (p: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../src', p), 'utf-8')

describe('gmail routes wiring', () => {
  const routes = read('routes/gmail.ts')
  const index = read('index.ts')

  it('expose les 4 routes', () => {
    expect(routes).toContain("gmailRouter.get('/auth-url'")
    expect(routes).toContain("gmailRouter.get('/status'")
    expect(routes).toContain("gmailRouter.delete('/disconnect'")
    expect(routes).toContain("gmailPublicRouter.get('/callback'")
  })

  it('gate auth-url derriere GMAIL_INTEGRATION_ENABLED', () => {
    expect(routes).toContain('GMAIL_INTEGRATION_ENABLED')
  })

  it('monte le callback public avant le router authentifie', () => {
    const pub = index.indexOf("app.use('/api/gmail', gmailPublicRouter)")
    const auth = index.indexOf("app.use('/api/gmail', requireAuth, gmailRouter)")
    expect(pub).toBeGreaterThan(-1)
    expect(auth).toBeGreaterThan(-1)
    expect(pub).toBeLessThan(auth)
  })
})
```

- [ ] **Step 4: Lancer les tests + build**

Run: `cd backend && pnpm build && pnpm test`
Expected: `tsc` exit 0 ; toute la suite verte, dont `gmail-routes.test.ts` (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/gmail.ts backend/src/index.ts backend/tests/routes/gmail-routes.test.ts
git commit -m "feat(gmail): routes oauth connect/callback/status/disconnect"
```

---

### Task 6: Hooks front (`use-gmail-account.ts`)

Le backend dérive l'utilisateur du JWT : les hooks ne passent aucun id.

**Files:**
- Create: `src/features/settings/hooks/use-gmail-account.ts`

- [ ] **Step 1: Écrire le hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

type GmailStatus = {
  connected: boolean
  email: string | null
  status: string | null
  sending_enabled: boolean
}

export function useGmailStatus() {
  return useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => apiClient<GmailStatus>('/api/gmail/status'),
  })
}

export function useGmailAuthUrl() {
  return useMutation({
    mutationFn: () => apiClient<{ url: string }>('/api/gmail/auth-url'),
  })
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient('/api/gmail/disconnect', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] })
    },
  })
}
```

- [ ] **Step 2: Compiler**

Run: `pnpm build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/hooks/use-gmail-account.ts
git commit -m "feat(gmail): hooks front du compte gmail"
```

---

### Task 7: Page Intégrations + carte de connexion + route + nav

Carte calquée sur `google-calendar-settings.tsx` (3 états : non connecté / connecté / à reconnecter), mais par utilisateur.

**Files:**
- Create: `src/features/settings/integrations/components/gmail-settings.tsx`
- Create: `src/features/settings/integrations/page.tsx`
- Create: `src/routes/_authenticated/settings/integrations.tsx`
- Modify: `src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Écrire la carte `gmail-settings.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Mail, Loader2, Unplug, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  useGmailStatus,
  useGmailAuthUrl,
  useDisconnectGmail,
} from '../../hooks/use-gmail-account'

export function GmailSettings() {
  const [showDisconnect, setShowDisconnect] = useState(false)
  const { data: status, isLoading } = useGmailStatus()
  const { mutateAsync: getAuthUrl, isPending: authPending } = useGmailAuthUrl()
  const { mutateAsync: disconnect, isPending: disconnectPending } =
    useDisconnectGmail()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail_connected') === 'true') {
      toast.success('Compte Gmail connecté.')
      const url = new URL(window.location.href)
      url.searchParams.delete('gmail_connected')
      window.history.replaceState({}, '', url.toString())
    }
    if (params.get('gmail_error')) {
      toast.error(`Erreur de connexion Gmail : ${params.get('gmail_error')}`)
      const url = new URL(window.location.href)
      url.searchParams.delete('gmail_error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const handleConnect = async () => {
    try {
      const { url } = await getAuthUrl()
      window.location.href = url
    } catch {
      toast.error('Impossible de générer le lien de connexion.')
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      toast.success('Compte Gmail déconnecté.')
    } catch {
      toast.error('Erreur lors de la déconnexion.')
    } finally {
      setShowDisconnect(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <Mail className='h-5 w-5' />
          <CardTitle>Gmail</CardTitle>
        </div>
        <CardDescription>
          Connectez votre boîte Gmail pour envoyer devis et factures depuis votre
          adresse et suivre les réponses des clients.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='flex items-center justify-center py-6'>
            <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
          </div>
        ) : status?.connected ? (
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <CheckCircle2 className='h-5 w-5 text-green-600' />
              <div>
                <p className='text-sm font-medium'>{status.email}</p>
                <Badge variant='secondary' className='mt-1'>
                  Connecté
                </Badge>
              </div>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowDisconnect(true)}
              disabled={disconnectPending}
              className='gap-2'
            >
              <Unplug className='h-4 w-4' />
              Déconnecter
            </Button>
          </div>
        ) : status?.status === 'revoked' ? (
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <AlertCircle className='h-5 w-5 text-amber-600' />
              <p className='text-sm'>
                Connexion expirée. Reconnectez votre compte Gmail.
              </p>
            </div>
            <Button size='sm' onClick={handleConnect} disabled={authPending}>
              Reconnecter
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={authPending} className='gap-2'>
            {authPending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Mail className='h-4 w-4' />
            )}
            Connecter mon Gmail
          </Button>
        )}
      </CardContent>

      <AlertDialog open={showDisconnect} onOpenChange={setShowDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déconnecter Gmail ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les nouveaux envois repartiront via le système par défaut. Les fils
              déjà envoyés restent visibles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect}>
              Déconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
```

- [ ] **Step 2: Écrire la page `page.tsx`**

```tsx
import { Main } from '@/components/layout/main'
import { GmailSettings } from './components/gmail-settings'

export function IntegrationsPage() {
  return (
    <Main>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight'>Intégrations</h1>
        <p className='text-muted-foreground'>
          Connectez vos outils personnels au CRM.
        </p>
      </div>
      <div className='mt-6 max-w-2xl'>
        <GmailSettings />
      </div>
    </Main>
  )
}
```

- [ ] **Step 3: Écrire la route `integrations.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { IntegrationsPage } from '@/features/settings/integrations/page'

export const Route = createFileRoute('/_authenticated/settings/integrations')({
  component: IntegrationsPage,
})
```

- [ ] **Step 4: Ajouter l'entrée de nav**

Dans `src/components/layout/data/sidebar-data.ts`, dans le tableau `items` de la section « Paramètres », après l'entrée « API » (`url: '/settings/api-docs'`, ~ligne 120) et avant la fermeture `]` de `items` :

```typescript
            {
              title: 'Intégrations',
              url: '/settings/integrations',
              icon: Plug,
            },
```

Vérifier que `Plug` est importé depuis `lucide-react` en tête de fichier ; sinon l'ajouter à l'import existant des icônes lucide.

- [ ] **Step 5: Compiler + lint**

Run: `pnpm build`
Expected: exit 0 (tsc + vite build ; la route `integrations` apparaît dans `routeTree.gen.ts` régénéré automatiquement par le plugin Vite au build).

Note : si `routeTree.gen.ts` n'est pas régénéré par le build, lancer `pnpm dev` une fois (le plugin TanStack Router le régénère au démarrage) puis re-`pnpm build`. Ne pas éditer `routeTree.gen.ts` à la main.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/integrations src/routes/_authenticated/settings/integrations.tsx src/components/layout/data/sidebar-data.ts src/routeTree.gen.ts
git commit -m "feat(gmail): page integrations et carte de connexion gmail"
```

---

### Task 8: Vérifications finales + checklist de déploiement

- [ ] **Step 1: Suites complètes**

Run: `cd backend && pnpm build && pnpm test`
Expected: `tsc` exit 0 ; suite verte (crypto 3, oauth-state 3, gmail-authurl 1, gmail-routes 3, + les tests existants dont le verrou phase 0bis).

Run (racine): `pnpm build`
Expected: exit 0.

- [ ] **Step 2: Documenter les variables d'env**

Ajouter à `backend/.env.example` (créer les lignes si le fichier existe ; sinon créer le fichier avec ces lignes) :

```
# Gmail (phase 1) — laisser GMAIL_INTEGRATION_ENABLED absent/false tant que la
# console Google Cloud n'est pas configuree.
GMAIL_REDIRECT_URI=
GMAIL_TOKEN_ENC_KEY=
GMAIL_OAUTH_STATE_SECRET=
GMAIL_INTEGRATION_ENABLED=false
```

Commit :

```bash
git add backend/.env.example
git commit -m "docs(gmail): variables d'env de la phase 1"
```

- [ ] **Step 3: Revue du diff**

Run: `git log --oneline main..HEAD`
Vérifier : ~10 commits, une ligne chacun, français, sans body.

- [ ] **Step 4: Checklist de déploiement (à exécuter par Thomas, dans cet ordre)**

Prérequis Google Cloud (console, une fois) :
1. Même projet que Calendar. Écran de consentement en **Internal**.
2. Ajouter les scopes `gmail.send` et `gmail.readonly` (userinfo.email déjà là).
3. Sur le client OAuth existant (celui de Calendar), ajouter la redirect URI Gmail : `https://api.mealevent.fr/api/gmail/callback` (adapter au domaine réel).

Déploiement :
4. Appliquer `supabase/migrations/20260706_gmail_foundations.sql` dans l'éditeur SQL Supabase prod (additif, sans risque).
5. Renseigner en prod : `GMAIL_REDIRECT_URI`, `GMAIL_TOKEN_ENC_KEY` (générer : `openssl rand -hex 32`), `GMAIL_OAUTH_STATE_SECRET` (`openssl rand -hex 32`). Laisser `GMAIL_INTEGRATION_ENABLED` **absent/false**.
6. Déployer le backend, puis le frontend. La page `/settings/integrations` apparaît ; le bouton « Connecter » renverra 503 tant que le flag est OFF.
7. Quand prêt à piloter : passer `GMAIL_INTEGRATION_ENABLED=true` en prod, connecter TON Gmail depuis `/settings/integrations`, vérifier que la ligne `user_gmail_accounts` est créée (`status=connected`, `google_email` renseigné, `history_id` non nul), et que « Déconnecter » supprime la ligne.

- [ ] **Step 5: Régénération des types (différée)**

Après application de la migration en prod, régénérer les types Supabase (`src/lib/supabase/types.ts`) pour exposer `user_gmail_accounts`/`email_threads`/`email_messages` et les colonnes email_logs. Non bloquant pour la phase 1 (ni le backend service-role ni le front phase 1 ne lisent ces tables) ; requis en phase 4 (lecture des messages côté front). À faire via la CLI Supabase ou le MCP `generate_typescript_types`.

---

## Comportements et points à connaître (review)

1. Rien n'est envoyé ni lu par Gmail en phase 1 : seule la connexion OAuth et le stockage du token sont livrés.
2. `GMAIL_INTEGRATION_ENABLED` OFF par défaut : `/api/gmail/auth-url` répond 503, le bouton « Connecter » ne fait rien d'exploitable. La page existe mais est inerte jusqu'au flag + config Google Cloud.
3. Le `state` OAuth est signé et vérifié (le flux Calendar ne le fait pas ; on ne reproduit pas sa faille CSRF). Le refresh token est chiffré (AES-256-GCM) et la table `user_gmail_accounts` n'a aucune policy SELECT client (service role only).
4. `sendAs`/alias non gérés en phase 1 : From = `google_email`. Décision alias reportée en phase 2 (implique un scope Gmail supplémentaire).
5. Migration purement additive : aucune ligne existante modifiée, aucune colonne retirée.

## Hors périmètre (phases suivantes)

Envoi Gmail via `sendClientEmail` + fallback + MIME + sujets `Re:` (phase 2), cron de polling + capture des réponses (phase 3), onglet Conversations + composer + fiche contact (phase 4), pièces jointes entrantes + capture des réponses Resend (phase 5).
