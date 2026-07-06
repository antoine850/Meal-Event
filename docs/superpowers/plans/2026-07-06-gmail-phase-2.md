# Gmail Phase 2 — Envoi via la boîte du commercial (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Envoyer les emails client depuis la boîte Gmail du commercial (fil unique, sujet `Re:`, In-Reply-To/References), avec fallback Resend automatique et sans régression, tout en matérialisant chaque envoi dans `email_threads`/`email_messages`.

**Architecture:** `sendClientEmail()` devient un dispatcher conscient du transport. Il résout un fil (`email_threads`), résout la boîte d'envoi (acteur connecté → commercial assigné → aucune), et si une boîte pilote est disponible et le sous-switch `GMAIL_SENDING_ENABLED` actif, construit un MIME RFC 2822 (MailComposer) et appelle `gmail.users.messages.send`. Toute erreur franche (401/400/403), un timeout non confirmé, ou l'absence de boîte retombe sur Resend. Chaque envoi (Gmail ou Resend) est inséré dans `email_messages` (fil) et `email_logs` (métrique/audit). Les unités de décision (MIME, classification d'erreur, sujet `Re:`, choix de boîte) sont des fonctions pures testées en TDD ; l'orchestration DB est couverte par les tests-verrous existants.

**Tech Stack:** Express 4 + TypeScript, googleapis ^171 (`gmail.users.messages.send`), nodemailer (MailComposer, MIME), Resend ^3, Supabase (service role), vitest.

---

## Prérequis et périmètre

- **Socle** : cette phase se construit **au-dessus du master switch** (`isGmailIntegrationEnabled`, `gmailClient()` renvoie `null` quand OFF) livré sur `feat/gmail-integration-gate`. Avant de démarrer, cette branche doit être mergée sur `main` (ou Phase 2 branchée depuis `feat/gmail-integration-gate`). Le plan suppose que `main` contient déjà `backend/src/lib/gmail.ts` avec `isGmailIntegrationEnabled()` et `gmailClient()`.
- **Backend uniquement.** Toute l'UI (composer fiche contact, bouton « Envoyer l'avoir », remplacement du menu email, badge) est **Phase 4**. Phase 2 livre les endpoints + le transport + les tests. Le seul rendu visible reste inchangé tant que `GMAIL_SENDING_ENABLED` est OFF (défaut) : 100 % Resend.
- **Deux jalons mergeables** dans ce plan : **2A** (Tasks 0–6 : transport Gmail + fils + call sites existants) et **2B** (Tasks 7–8 : relance réelle + flux avoir). Chacun est déployable seul (flag OFF = no-op). Task 9–10 clôturent (env, verrous, revue).
- **Chantier arrondis** : le spec demande de passer `round_recompute_quotes.py --apply` avant d'activer l'envoi Gmail en prod (ne pas ouvrir de fils sur d'anciens montants). C'est un prérequis de **déploiement/activation** (Task 10), pas de développement.

## Décisions verrouillées pour cette phase

| Sujet | Décision |
|---|---|
| Boîte d'envoi | `resolveSenderMailbox` : acteur connecté **et** `sending_enabled` → sa boîte ; sinon commercial assigné (`assigned_user_ids[0]`) idem ; sinon `null` → Resend. From = `user_gmail_accounts.google_email` (alias reporté). |
| Sous-switch | `isGmailSendingEnabled()` = master ON **et** `GMAIL_SENDING_ENABLED === 'true'`. OFF → Resend même si des boîtes sont connectées. |
| Flag pilote | `user_gmail_accounts.sending_enabled` (défaut false) : une boîte n'envoie via Gmail que si ce flag est vrai. Se connecter ≠ envoyer. |
| Fil | 1 par `(booking, kind)` ; kind `booking` par défaut, `facturation` si destinataire compta, `contact` pour un ponctuel hors booking. Sujet figé au 1er message, `Re:` ensuite. |
| Threading | Client-side via `In-Reply-To`/`References` = `rfc_message_id` du dernier message du fil (toutes boîtes confondues). `threadId` Gmail = celui de la **même boîte** pour ce fil s'il existe, sinon omis. |
| Fallback | Resend sur : pas de boîte, `gmailClient()` null, `revoked` (401/invalid_grant), `hard` (400/403). Sur `ambiguous` (timeout/5xx) : vérifier `rfc822msgid:` → trouvé = succès, sinon Resend. `rate_limited` (429) : fallback Resend (backoff/retry = Phase 3). **Jamais** de fallback sur un échec d'écriture DB. |
| Journalisation | `email_logs.provider` renseigné (`gmail`/`resend`), `gmail_message_id`/`gmail_thread_id` sur Gmail, `resend_message_id` sur Resend. Best-effort (un échec d'insert ne casse pas l'envoi). |
| Matérialisation | Chaque envoi (Gmail **et** Resend fallback) insère une ligne `email_messages` (`direction='outbound'`) rattachée au fil. Best-effort. |

## File Structure

**Créés**
- `supabase/migrations/20260707_gmail_phase2.sql` — `organizations.facturation_email` (idempotent), CHECK + trigger suppression fils contact-only + index unique fil contact, sous-switch documenté.
- `backend/src/lib/gmail-mime.ts` — **pur** : `buildRawMessage`, `classifyGmailError`, `toReplySubject`, `generateRfcMessageId`. Zéro accès DB/réseau.
- `backend/src/lib/email-threads.ts` — résolution fil + boîte + persistance message : `pickMailbox` (pur), `resolveSenderMailbox`, `getOrCreateThread`, `getThreadTail`, `recordOutbound`.
- `backend/tests/lib/gmail-mime.test.ts`, `backend/tests/lib/gmail-error-classify.test.ts`, `backend/tests/lib/reply-subject.test.ts`, `backend/tests/lib/sender-mailbox.test.ts`.

**Modifiés**
- `backend/src/lib/gmail.ts` — `isGmailSendingEnabled`, `findByRfcMessageId`, `markAccountRevoked`.
- `backend/src/lib/client-email.ts` — `ClientEmailParams` étendu, `sendClientEmail` en dispatcher, retour `{ id, provider }`.
- `backend/src/lib/email-templates.ts` — `buildReminderEmailHtml/Subject`, `buildCreditNoteEmailHtml/Subject`.
- `backend/src/lib/deposit-flow.ts` — passe `actorUserId` à `sendClientEmail`.
- `backend/src/routes/quotes.ts` — `actorUserId` sur les 4 call sites + nouvelle route avoir.
- `backend/src/routes/payments.ts` — `actorUserId` sur create-link + envoi email sur `/:id/remind`.
- `backend/src/routes/webhooks.ts` — le flux auto passe `actorUserId: null` (boîte du commercial assigné).
- `backend/.env.example`, `LOCALHOST.md` — `GMAIL_SENDING_ENABLED`, `GMAIL_POLLING_ENABLED`.
- `backend/tests/routes/client-email-callsites.test.ts` — verrous étendus.

---

### Task 0: Migration Phase 2 (intégrité des fils + colonne facturation)

**Files:**
- Create: `supabase/migrations/20260707_gmail_phase2.sql`

- [ ] **Step 1: Créer la branche de travail**

```bash
git checkout main
git pull
git checkout -b feat/gmail-phase-2
```

- [ ] **Step 2: Écrire la migration**

`supabase/migrations/20260707_gmail_phase2.sql` :

```sql
-- Gmail phase 2 : intégrité des fils + reply-to facturation.

-- 1. Reply-to facturation. getOrgFacturationEmail() (phase 0bis) sélectionne déjà
-- organizations.facturation_email, mais la colonne n'a jamais été créée : l'erreur
-- PostgREST était avalée -> null. IF NOT EXISTS = sûr quel que soit l'état prod.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS facturation_email TEXT;

-- 2. Suppression des fils contact-only quand le contact part. Le FK contact_id est
-- ON DELETE SET NULL : sans ce trigger, un fil (booking_id NULL, contact_id NULL)
-- violerait le CHECK ci-dessous et bloquerait la suppression du contact. Les fils
-- rattachés à un booking gardent booking_id -> SET NULL sans conséquence.
CREATE OR REPLACE FUNCTION delete_contact_only_threads()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM email_threads
  WHERE contact_id = OLD.id AND booking_id IS NULL;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_delete_email_threads
  BEFORE DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION delete_contact_only_threads();

-- 3. Chaque fil vise un booking OU un contact (report de la phase 1).
ALTER TABLE email_threads
  ADD CONSTRAINT email_threads_target_chk
  CHECK (booking_id IS NOT NULL OR contact_id IS NOT NULL);

-- 4. Un seul fil contact-only OUVERT par contact.
CREATE UNIQUE INDEX email_threads_contact_open_uidx
  ON email_threads (contact_id, kind)
  WHERE contact_id IS NOT NULL AND booking_id IS NULL AND status = 'open';
```

- [ ] **Step 3: Vérifier la syntaxe SQL localement (lecture seule)**

Run: `grep -c "CREATE\|ALTER" supabase/migrations/20260707_gmail_phase2.sql`
Expected: `4` (les 4 blocs présents). La migration n'est appliquée en prod qu'à la Task 10 (déploiement manuel par Thomas, éditeur SQL Supabase).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260707_gmail_phase2.sql
git commit -m "feat(gmail): migration phase 2 (integrite des fils + facturation_email)"
```

---

### Task 1: Dépendance MailComposer + builder MIME pur

**Files:**
- Modify: `backend/package.json` (dépendance `nodemailer`)
- Create: `backend/src/lib/gmail-mime.ts`
- Test: `backend/tests/lib/gmail-mime.test.ts`

- [ ] **Step 1: Installer nodemailer (MailComposer)**

Run:
```bash
cd backend && pnpm add nodemailer && pnpm add -D @types/nodemailer
```
Expected: `nodemailer` en `dependencies`, `@types/nodemailer` en `devDependencies`.

- [ ] **Step 2: Écrire le test (échoue)**

`backend/tests/lib/gmail-mime.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import {
  buildRawMessage,
  toReplySubject,
  generateRfcMessageId,
} from '../../src/lib/gmail-mime'

const decode = (raw: string) => Buffer.from(raw, 'base64url').toString('utf8')

describe('buildRawMessage', () => {
  it('encode un MIME base64url avec les en-têtes de threading', async () => {
    const raw = await buildRawMessage({
      from: 'commercial@pasparisien.fr',
      to: 'client@example.com',
      subject: 'Re: Votre devis DEV-1',
      html: '<p>Bonjour</p>',
      messageId: '<abc@pasparisien.fr>',
      inReplyTo: '<prev@pasparisien.fr>',
      references: '<prev@pasparisien.fr>',
    })
    const mime = decode(raw)
    expect(mime).toContain('From: commercial@pasparisien.fr')
    expect(mime).toContain('To: client@example.com')
    expect(mime).toContain('Subject: Re: Votre devis DEV-1')
    expect(mime).toContain('Message-ID: <abc@pasparisien.fr>')
    expect(mime).toContain('In-Reply-To: <prev@pasparisien.fr>')
    expect(mime).toContain('References: <prev@pasparisien.fr>')
    expect(mime).toContain('<p>Bonjour</p>')
  })

  it('joint un PDF en multipart', async () => {
    const raw = await buildRawMessage({
      from: 'c@pasparisien.fr',
      to: 'client@example.com',
      subject: 'Devis',
      html: '<p>x</p>',
      messageId: '<m@pasparisien.fr>',
      attachments: [{ filename: 'devis.pdf', content: Buffer.from('%PDF-1.4 fake') }],
    })
    const mime = decode(raw)
    expect(mime).toContain('multipart/mixed')
    expect(mime).toContain('filename="devis.pdf"')
    expect(mime).toContain('Content-Type: application/pdf')
  })
})

describe('toReplySubject', () => {
  it('préfixe Re: une seule fois', () => {
    expect(toReplySubject('Votre devis')).toBe('Re: Votre devis')
    expect(toReplySubject('Re: Votre devis')).toBe('Re: Votre devis')
    expect(toReplySubject('RE: x')).toBe('RE: x')
  })
})

describe('generateRfcMessageId', () => {
  it('produit un id RFC entre chevrons sur le domaine donné', () => {
    const id = generateRfcMessageId('pasparisien.fr')
    expect(id).toMatch(/^<[^@>]+@pasparisien\.fr>$/)
    expect(generateRfcMessageId('pasparisien.fr')).not.toBe(id)
  })
})
```

- [ ] **Step 3: Lancer le test (échoue)**

Run: `cd backend && pnpm test gmail-mime`
Expected: FAIL — `Cannot find module '../../src/lib/gmail-mime'`.

- [ ] **Step 4: Implémenter le module pur**

`backend/src/lib/gmail-mime.ts` :

```ts
import crypto from 'node:crypto'
import MailComposer from 'nodemailer/lib/mail-composer/index.js'

export interface RawMessageOptions {
  from: string
  to: string
  cc?: string[]
  subject: string
  html: string
  messageId: string
  inReplyTo?: string
  references?: string
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
}

// MIME RFC 2822 encodé base64url pour gmail.users.messages.send({ requestBody: { raw } }).
export async function buildRawMessage(opts: RawMessageOptions): Promise<string> {
  const mail = new MailComposer({
    from: opts.from,
    to: opts.to,
    cc: opts.cc,
    subject: opts.subject,
    html: opts.html,
    messageId: opts.messageId,
    inReplyTo: opts.inReplyTo,
    references: opts.references,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType || 'application/pdf',
    })),
  })
  const message: Buffer = await new Promise((resolve, reject) => {
    mail.compile().build((err: Error | null, msg: Buffer) =>
      err ? reject(err) : resolve(msg)
    )
  })
  return message.toString('base64url')
}

// Sujet du fil figé au 1er message, "Re:" ensuite (idempotent, insensible à la casse).
export function toReplySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`
}

// Message-ID RFC 2822 (entre chevrons), généré par nous à l'envoi et stocké pour
// alimenter In-Reply-To/References des réponses. Le gmail_message_id de l'API ne
// sert PAS au threading côté client.
export function generateRfcMessageId(domain: string): string {
  return `<${crypto.randomUUID()}@${domain}>`
}

// Classe une erreur d'envoi Gmail pour décider du fallback. googleapis remonte un
// GaxiosError : status HTTP dans response.status ou code ; invalid_grant dans message.
export function classifyGmailError(
  err: any
): 'revoked' | 'hard' | 'ambiguous' | 'rate_limited' {
  const status = err?.response?.status ?? err?.code
  const msg = String(err?.message ?? '')
  if (msg.includes('invalid_grant') || status === 401) return 'revoked'
  if (status === 429) return 'rate_limited'
  if (status === 400 || status === 403) return 'hard'
  return 'ambiguous'
}
```

- [ ] **Step 5: Lancer le test (passe)**

Run: `cd backend && pnpm test gmail-mime`
Expected: PASS (5 assertions).

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/pnpm-lock.yaml backend/src/lib/gmail-mime.ts backend/tests/lib/gmail-mime.test.ts
git commit -m "feat(gmail): builder mime pur (mailcomposer) et helpers de threading"
```

---

### Task 2: Test de la classification d'erreur

**Files:**
- Test: `backend/tests/lib/gmail-error-classify.test.ts`
- (implémentation `classifyGmailError` déjà écrite en Task 1)

- [ ] **Step 1: Écrire le test**

`backend/tests/lib/gmail-error-classify.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { classifyGmailError } from '../../src/lib/gmail-mime'

describe('classifyGmailError', () => {
  it('401 / invalid_grant -> revoked', () => {
    expect(classifyGmailError({ response: { status: 401 } })).toBe('revoked')
    expect(classifyGmailError({ message: 'invalid_grant' })).toBe('revoked')
  })
  it('429 -> rate_limited', () => {
    expect(classifyGmailError({ response: { status: 429 } })).toBe('rate_limited')
  })
  it('400 / 403 -> hard', () => {
    expect(classifyGmailError({ response: { status: 400 } })).toBe('hard')
    expect(classifyGmailError({ code: 403 })).toBe('hard')
  })
  it('timeout / 5xx / inconnu -> ambiguous', () => {
    expect(classifyGmailError({ code: 'ETIMEDOUT' })).toBe('ambiguous')
    expect(classifyGmailError({ response: { status: 503 } })).toBe('ambiguous')
    expect(classifyGmailError({})).toBe('ambiguous')
  })
})
```

- [ ] **Step 2: Lancer le test (passe)**

Run: `cd backend && pnpm test gmail-error-classify`
Expected: PASS (4 tests).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/lib/gmail-error-classify.test.ts
git commit -m "test(gmail): classification des erreurs d'envoi"
```

---

### Task 3: Choix de la boîte d'envoi (fonction pure)

**Files:**
- Create (partiel) : `backend/src/lib/email-threads.ts` (seulement `pickMailbox` dans cette task)
- Test: `backend/tests/lib/sender-mailbox.test.ts`

- [ ] **Step 1: Écrire le test (échoue)**

`backend/tests/lib/sender-mailbox.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { pickMailbox } from '../../src/lib/email-threads'

const box = (o: Partial<Parameters<typeof pickMailbox>[0][number]>) => ({
  userId: 'u1',
  email: 'u1@pasparisien.fr',
  connected: true,
  sendingEnabled: true,
  ...o,
})

describe('pickMailbox', () => {
  it('prend le 1er candidat connecté ET pilote', () => {
    expect(pickMailbox([box({ userId: 'actor', email: 'a@x.fr' })])).toEqual({
      userId: 'actor',
      email: 'a@x.fr',
    })
  })
  it('saute un candidat non pilote (sending_enabled false)', () => {
    expect(
      pickMailbox([
        box({ userId: 'actor', sendingEnabled: false }),
        box({ userId: 'assigned', email: 'as@x.fr' }),
      ])
    ).toEqual({ userId: 'assigned', email: 'as@x.fr' })
  })
  it('null si aucune boîte connectée+pilote ou email manquant', () => {
    expect(pickMailbox([box({ connected: false })])).toBeNull()
    expect(pickMailbox([box({ email: null })])).toBeNull()
    expect(pickMailbox([])).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `cd backend && pnpm test sender-mailbox`
Expected: FAIL — module `email-threads` absent.

- [ ] **Step 3: Créer `email-threads.ts` avec `pickMailbox`**

`backend/src/lib/email-threads.ts` (le reste des helpers arrive en Task 4) :

```ts
import { supabase } from './supabase.js'

export interface MailboxCandidate {
  userId: string | null
  email: string | null
  connected: boolean
  sendingEnabled: boolean
}

// 1re boîte connectée ET pilote (sending_enabled). Pure : décision seule.
export function pickMailbox(
  candidates: MailboxCandidate[]
): { userId: string; email: string } | null {
  for (const c of candidates) {
    if (c.userId && c.email && c.connected && c.sendingEnabled) {
      return { userId: c.userId, email: c.email }
    }
  }
  return null
}
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `cd backend && pnpm test sender-mailbox`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/email-threads.ts backend/tests/lib/sender-mailbox.test.ts
git commit -m "feat(gmail): selection de la boite d'envoi (pure)"
```

---

### Task 4: Résolution de fil, boîte et persistance des messages (DB)

**Files:**
- Modify: `backend/src/lib/email-threads.ts` (ajouts DB)
- Modify: `backend/src/lib/gmail.ts` (`isGmailSendingEnabled`, `findByRfcMessageId`, `markAccountRevoked`)

Ces helpers touchent Supabase (service role) et l'API Gmail : pas de test unitaire (aligné sur la culture du repo — pas de mock HTTP/Supabase) ; ils sont couverts par le verrou d'imports (Task 9) et le smoke test de déploiement (Task 10).

- [ ] **Step 1: Ajouter les helpers DB à `email-threads.ts`**

Ajouter à la fin de `backend/src/lib/email-threads.ts` :

```ts
export interface ThreadRef {
  id: string
  subject: string
  isNew: boolean
}

type ThreadKind = 'booking' | 'contact' | 'facturation'

// Fil du booking (unique par (booking_id, kind)) ou fil contact-only ouvert.
// Sujet figé au 1er message. Renvoie isNew pour décider "Re:" côté appelant.
export async function getOrCreateThread(input: {
  organizationId: string | null
  kind: ThreadKind
  bookingId?: string | null
  contactId?: string | null
  subject: string
}): Promise<ThreadRef> {
  const base = supabase.from('email_threads')

  if (input.bookingId) {
    const { data: existing } = await base
      .select('id, subject')
      .eq('booking_id', input.bookingId)
      .eq('kind', input.kind)
      .maybeSingle()
    if (existing) return { id: existing.id, subject: existing.subject ?? input.subject, isNew: false }
  } else if (input.contactId) {
    const { data: existing } = await base
      .select('id, subject')
      .eq('contact_id', input.contactId)
      .eq('kind', input.kind)
      .is('booking_id', null)
      .eq('status', 'open')
      .maybeSingle()
    if (existing) return { id: existing.id, subject: existing.subject ?? input.subject, isNew: false }
  }

  const { data: created, error } = await base
    .insert({
      organization_id: input.organizationId,
      kind: input.kind,
      booking_id: input.bookingId ?? null,
      contact_id: input.contactId ?? null,
      subject: input.subject,
      last_message_at: new Date().toISOString(),
    } as never)
    .select('id, subject')
    .single()
  if (error) throw new Error(`getOrCreateThread: ${error.message}`)
  return { id: created.id, subject: created.subject ?? input.subject, isNew: true }
}

// Dernier message du fil : rfc_message_id (In-Reply-To/References, toutes boîtes)
// et gmail_thread_id de CETTE boîte pour ré-attacher côté Gmail.
export async function getThreadTail(
  threadId: string,
  senderUserId: string
): Promise<{ lastRfcMessageId: string | null; gmailThreadIdForSender: string | null }> {
  const { data: last } = await supabase
    .from('email_messages')
    .select('rfc_message_id')
    .eq('thread_id', threadId)
    .not('rfc_message_id', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: mine } = await supabase
    .from('email_messages')
    .select('gmail_thread_id')
    .eq('thread_id', threadId)
    .eq('sender_user_id', senderUserId)
    .not('gmail_thread_id', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    lastRfcMessageId: (last as any)?.rfc_message_id ?? null,
    gmailThreadIdForSender: (mine as any)?.gmail_thread_id ?? null,
  }
}

// Acteur connecté (celui qui clique) prioritaire, sinon commercial assigné.
export async function resolveSenderMailbox(input: {
  actorUserId?: string | null
  bookingId?: string | null
}): Promise<{ userId: string; email: string } | null> {
  const ids: string[] = []
  if (input.actorUserId) ids.push(input.actorUserId)

  if (input.bookingId) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('assigned_user_ids')
      .eq('id', input.bookingId)
      .single()
    const assigned = (booking as any)?.assigned_user_ids?.[0] as string | undefined
    if (assigned && assigned !== input.actorUserId) ids.push(assigned)
  }
  if (ids.length === 0) return null

  const { data: accounts } = await supabase
    .from('user_gmail_accounts')
    .select('user_id, google_email, status, sending_enabled')
    .in('user_id', ids)

  const byId = new Map((accounts ?? []).map((a: any) => [a.user_id, a]))
  const candidates: MailboxCandidate[] = ids.map((id) => {
    const a: any = byId.get(id)
    return {
      userId: id,
      email: a?.google_email ?? null,
      connected: a?.status === 'connected',
      sendingEnabled: a?.sending_enabled === true,
    }
  })
  return pickMailbox(candidates)
}

// Matérialise un envoi dans le fil. Best-effort : jamais throw (un échec DB ne
// doit pas déclencher de fallback ni casser un envoi réussi).
export async function recordOutbound(
  thread: ThreadRef | null,
  msg: {
    provider: 'gmail' | 'resend'
    senderUserId: string | null
    gmailThreadId: string | null
    gmailMessageId: string | null
    rfcMessageId: string | null
    fromEmail: string | null
    toEmails: string[]
    cc: string[] | null
    subject: string
    html: string
    inReplyTo: string | null
    references: string | null
  }
): Promise<void> {
  if (!thread) return
  const now = new Date().toISOString()
  const { error } = await supabase.from('email_messages').insert({
    thread_id: thread.id,
    direction: 'outbound',
    provider: msg.provider,
    sender_user_id: msg.senderUserId,
    gmail_thread_id: msg.gmailThreadId,
    gmail_message_id: msg.gmailMessageId,
    rfc_message_id: msg.rfcMessageId,
    from_email: msg.fromEmail,
    to_emails: msg.toEmails,
    cc: msg.cc,
    subject: msg.subject,
    body_html: msg.html,
    sent_at: now,
    in_reply_to: msg.inReplyTo,
    references_header: msg.references,
  } as never)
  if (error) {
    console.error('[email-threads] recordOutbound insert failed:', error)
    return
  }
  await supabase
    .from('email_threads')
    .update({ last_message_at: now } as never)
    .eq('id', thread.id)
}
```

- [ ] **Step 2: Ajouter les helpers Gmail à `gmail.ts`**

Ajouter à `backend/src/lib/gmail.ts`, après `isGmailIntegrationEnabled` :

```ts
// Sous-switch d'envoi. Effectif seulement si le master est ON.
export function isGmailSendingEnabled(): boolean {
  return isGmailIntegrationEnabled() && process.env.GMAIL_SENDING_ENABLED === 'true'
}
```

Ajouter à la fin de `backend/src/lib/gmail.ts` :

```ts
// Vérifie qu'un message qu'on croit avoir envoyé existe bien (après timeout ambigu).
// Renvoie le gmail_message_id trouvé, sinon null.
export async function findByRfcMessageId(
  client: NonNullable<Awaited<ReturnType<typeof gmailClient>>>,
  rfcMessageId: string
): Promise<string | null> {
  try {
    const bare = rfcMessageId.replace(/^<|>$/g, '')
    const { data } = await client.users.messages.list({
      userId: 'me',
      q: `rfc822msgid:${bare}`,
      maxResults: 1,
    })
    return data.messages?.[0]?.id ?? null
  } catch {
    return null
  }
}

// Marque un compte comme révoqué (401/invalid_grant) : coupe les futurs envois
// Gmail de cette boîte et alimente le bandeau réglages. Best-effort.
export async function markAccountRevoked(userId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  await supabase
    .from('user_gmail_accounts')
    .update({ status: 'revoked', last_error: message } as never)
    .eq('user_id', userId)
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `cd backend && pnpm build`
Expected: exit 0 (les helpers ne sont pas encore consommés, mais doivent typer).

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/email-threads.ts backend/src/lib/gmail.ts
git commit -m "feat(gmail): resolution fil/boite, persistance message, helpers revoked/verif"
```

---

### Task 5: `sendClientEmail` devient un dispatcher Gmail/Resend

**Files:**
- Modify: `backend/src/lib/client-email.ts:41-98`

- [ ] **Step 1: Réécrire `client-email.ts`**

Remplacer intégralement le contenu de `backend/src/lib/client-email.ts` par :

```ts
import { sendEmail, SendEmailOptions } from './resend.js'
import { supabase } from './supabase.js'
import {
  buildRawMessage,
  classifyGmailError,
  toReplySubject,
  generateRfcMessageId,
} from './gmail-mime.js'
import {
  gmailClient,
  isGmailSendingEnabled,
  findByRfcMessageId,
  markAccountRevoked,
} from './gmail.js'
import {
  getOrCreateThread,
  getThreadTail,
  resolveSenderMailbox,
  recordOutbound,
  type ThreadRef,
} from './email-threads.js'

// Helper partagé : email de facturation de l'organisation (reply-to secondaire)
export async function getOrgFacturationEmail(
  organizationId: string | null
): Promise<string | null> {
  if (!organizationId) return null
  const { data } = await supabase
    .from('organizations')
    .select('facturation_email')
    .eq('id', organizationId)
    .single()
  return (data as any)?.facturation_email || null
}

// Helper partagé : commercial assigné d'un booking (premier de assigned_user_ids)
export async function getCommercialInfo(
  bookingId: string
): Promise<{ name: string | null; email: string | null }> {
  const { data: bookingFull } = await supabase
    .from('bookings')
    .select('assigned_user_ids')
    .eq('id', bookingId)
    .single()

  const commercialId = (bookingFull as any)?.assigned_user_ids?.[0]
  if (commercialId) {
    const { data: user } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', commercialId)
      .single()
    if (user) {
      return { name: `${user.first_name} ${user.last_name}`, email: user.email }
    }
  }
  return { name: null, email: null }
}

export interface ClientEmailParams {
  organizationId: string | null
  bookingId?: string | null
  contactId?: string | null
  quoteId?: string | null
  emailType: string
  to: string
  cc?: string[]
  subject: string
  html: string
  replyTo?: string
  facturationEmail?: string
  attachments?: SendEmailOptions['attachments']
  actorUserId?: string | null
  threadKind?: 'booking' | 'contact' | 'facturation'
}

// Journalisation email_logs best-effort (un échec d'insert ne casse jamais l'envoi).
async function logEmail(row: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('email_logs').insert(row as never)
  if (error) console.error('[client-email] email_logs insert failed:', error)
}

// Point de passage unique des emails client. Résout un fil, choisit la boîte
// (acteur -> commercial assigné -> aucune), envoie via Gmail si une boîte pilote
// existe et GMAIL_SENDING_ENABLED est ON, sinon Resend. Chaque envoi est
// matérialisé dans email_messages + email_logs. Fallback Resend sur erreur franche.
export async function sendClientEmail(
  params: ClientEmailParams
): Promise<{ id: string; provider: 'gmail' | 'resend' }> {
  const logBase = {
    organization_id: params.organizationId,
    quote_id: params.quoteId || null,
    booking_id: params.bookingId || null,
    email_type: params.emailType,
    recipient_email: params.to,
    reply_to_email: params.replyTo || null,
    subject: params.subject,
  }

  // 1. Fil (best-effort : un échec dégrade en envoi sans threading).
  const kind = params.threadKind ?? (params.bookingId ? 'booking' : 'contact')
  let thread: ThreadRef | null = null
  try {
    thread = await getOrCreateThread({
      organizationId: params.organizationId,
      kind,
      bookingId: params.bookingId ?? null,
      contactId: params.contactId ?? null,
      subject: params.subject,
    })
  } catch (err) {
    console.error('[client-email] getOrCreateThread failed:', err)
  }
  const effectiveSubject =
    thread && !thread.isNew ? toReplySubject(thread.subject) : params.subject

  // 2. Boîte d'envoi + tentative Gmail.
  const mailbox = await resolveSenderMailbox({
    actorUserId: params.actorUserId ?? null,
    bookingId: params.bookingId ?? null,
  })

  if (mailbox && isGmailSendingEnabled()) {
    const client = await gmailClient(mailbox.userId)
    if (client) {
      const tail = thread
        ? await getThreadTail(thread.id, mailbox.userId)
        : { lastRfcMessageId: null, gmailThreadIdForSender: null }
      const domain = mailbox.email.split('@')[1] || 'mealevent.fr'
      const rfcMessageId = generateRfcMessageId(domain)

      const persistGmail = async (gmailMessageId: string, gmailThreadId: string | null) => {
        await recordOutbound(thread, {
          provider: 'gmail',
          senderUserId: mailbox.userId,
          gmailThreadId,
          gmailMessageId,
          rfcMessageId,
          fromEmail: mailbox.email,
          toEmails: [params.to],
          cc: params.cc ?? null,
          subject: effectiveSubject,
          html: params.html,
          inReplyTo: tail.lastRfcMessageId,
          references: tail.lastRfcMessageId,
        })
        await logEmail({
          ...logBase,
          provider: 'gmail',
          gmail_message_id: gmailMessageId,
          gmail_thread_id: gmailThreadId,
          status: 'sent',
        })
      }

      try {
        const raw = await buildRawMessage({
          from: mailbox.email,
          to: params.to,
          cc: params.cc,
          subject: effectiveSubject,
          html: params.html,
          messageId: rfcMessageId,
          inReplyTo: tail.lastRfcMessageId || undefined,
          references: tail.lastRfcMessageId || undefined,
          attachments: params.attachments,
        })
        const sendRes = await client.users.messages.send({
          userId: 'me',
          requestBody: {
            raw,
            ...(tail.gmailThreadIdForSender
              ? { threadId: tail.gmailThreadIdForSender }
              : {}),
          },
        })
        const gmailMessageId = sendRes.data.id || ''
        await persistGmail(gmailMessageId, sendRes.data.threadId || null)
        return { id: gmailMessageId, provider: 'gmail' }
      } catch (err) {
        const cls = classifyGmailError(err)
        if (cls === 'ambiguous') {
          const found = await findByRfcMessageId(client, rfcMessageId)
          if (found) {
            await persistGmail(found, null)
            return { id: found, provider: 'gmail' }
          }
        }
        if (cls === 'revoked') await markAccountRevoked(mailbox.userId, err)
        console.error(`[client-email] Gmail send ${cls}, fallback Resend:`, err)
        // tombe sur Resend ci-dessous
      }
    }
  }

  // 3. Resend (défaut + fallback). Matérialisé dans le fil comme "parti hors fil".
  try {
    const result = await sendEmail({
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
      facturationEmail: params.facturationEmail,
      attachments: params.attachments,
    })
    await recordOutbound(thread, {
      provider: 'resend',
      senderUserId: null,
      gmailThreadId: null,
      gmailMessageId: null,
      rfcMessageId: null,
      fromEmail: null,
      toEmails: [params.to],
      cc: params.cc ?? null,
      subject: params.subject,
      html: params.html,
      inReplyTo: null,
      references: null,
    })
    await logEmail({ ...logBase, provider: 'resend', resend_message_id: result.id, status: 'sent' })
    return { id: result.id, provider: 'resend' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logEmail({ ...logBase, provider: 'resend', status: 'failed', error_message: message })
    throw err
  }
}
```

- [ ] **Step 2: Compiler**

Run: `cd backend && pnpm build`
Expected: exit 0.

- [ ] **Step 3: Lancer toute la suite (non-régression)**

Run: `cd backend && pnpm test`
Expected: PASS. Le verrou `client-email-callsites` reste vert (aucun call site ne fait `from('email_logs').insert` ou n'importe `resend.js` directement).

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/client-email.ts
git commit -m "feat(gmail): sendClientEmail dispatcher gmail/resend avec fallback et fil"
```

---

### Task 6: Passer `actorUserId` sur les call sites existants

Chaque route client résout déjà le commercial pour le reply-to ; il faut passer **l'acteur connecté** (`(req as any).user?.id`) pour que la boîte d'envoi soit la sienne en priorité. Les routes sont montées derrière `requireAuth` (cf. `quotes.ts:1096` qui lit déjà `(req as any).user?.id`).

**Files:**
- Modify: `backend/src/routes/quotes.ts` (send-email, send-deposit resend, send-balance resend + new)
- Modify: `backend/src/lib/deposit-flow.ts`
- Modify: `backend/src/routes/payments.ts` (create-link)
- Modify: `backend/src/routes/webhooks.ts` (flux auto)

- [ ] **Step 1: quotes.ts — send-email (call site ~302)**

Dans l'objet passé à `sendClientEmail` (route `POST /:id/send-email`), ajouter `actorUserId` :

```ts
    const emailResult = await sendClientEmail({
      organizationId: quoteData.organization_id,
      bookingId: booking?.id || null,
      quoteId,
      emailType: 'quote_sent',
      actorUserId: (req as any).user?.id ?? null,
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      facturationEmail: facturationEmail || undefined,
      attachments: [
        {
          filename: `${quoteData.quote_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    })
```

- [ ] **Step 2: quotes.ts — send-deposit resend (~536) et send-balance resend (~690) + new (~847)**

Sur les 3 appels `sendClientEmail` restants de `quotes.ts`, ajouter la même ligne `actorUserId: (req as any).user?.id ?? null,` (juste après `emailType`). Les emailType concernés : `deposit_invoice_resend`, `balance_invoice_resend`, `balance_invoice`.

- [ ] **Step 3: deposit-flow.ts — propager l'acteur reçu**

`createAndSendDeposit` reçoit déjà `opts.actorUserId`. Dans son appel `sendClientEmail` (~190), ajouter :

```ts
  await sendClientEmail({
    organizationId: quoteData.organization_id,
    bookingId: booking?.id || null,
    quoteId,
    emailType: 'deposit_invoice',
    actorUserId: opts.actorUserId ?? null,
    to: contact.email,
    subject,
    html,
    replyTo: commercial.email || restaurant?.email || undefined,
    facturationEmail: facturationEmail || undefined,
    attachments: [
      {
        filename: `facture-acompte-${quoteData.quote_number}.pdf`,
        content: pdfBuffer,
      },
    ],
  })
```

Note : pour `source: 'auto_signature'`, `actorUserId` est `undefined` → `resolveSenderMailbox` tombe sur le commercial assigné (comportement voulu : l'envoi automatique part de la boîte du commercial du booking).

- [ ] **Step 4: quotes.ts — send-deposit / send-balance passent l'acteur à createAndSendDeposit**

Vérifier les appels à `createAndSendDeposit(quoteId, { source: 'manual', ... })` dans `quotes.ts` (route send-deposit) et y ajouter `actorUserId: (req as any).user?.id ?? null` s'il n'y est pas déjà.

Run pour localiser : `grep -n "createAndSendDeposit" backend/src/routes/quotes.ts`
Expected : au moins un appel `source: 'manual'` à compléter.

- [ ] **Step 5: payments.ts — create-link (~317)**

Ajouter `actorUserId: (req as any).user?.id ?? null,` à l'appel `sendClientEmail` de `create-link` (emailType `payment_link`).

- [ ] **Step 6: webhooks.ts — flux auto (aucun acteur)**

`autoSendDepositAfterSignature` appelle `createAndSendDeposit(quoteId, { source: 'auto_signature' })` sans acteur. Ne rien changer : l'absence d'`actorUserId` fait partir l'email de la boîte du commercial assigné. Confirmer par lecture qu'aucun `sendClientEmail` direct n'existe dans `webhooks.ts` hormis via `createAndSendDeposit`.

- [ ] **Step 7: Compiler + suite**

Run: `cd backend && pnpm build && pnpm test`
Expected: exit 0, suite verte.

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/quotes.ts backend/src/routes/payments.ts backend/src/lib/deposit-flow.ts
git commit -m "feat(gmail): passe l'acteur connecte aux envois client (boite d'envoi)"
```

> **Fin du jalon 2A.** Déployable seul : flag `GMAIL_SENDING_ENABLED` OFF = 100 % Resend, aucune régression. Peut être mergé/PR ici avant d'attaquer 2B.

---

### Task 7: Relance de paiement réelle (`/api/payments/:id/remind`)

Aujourd'hui la route enregistre un `payment_reminders` et bascule le statut du booking, mais **n'envoie aucun email**. On ajoute l'envoi via `sendClientEmail` sans toucher à l'existant.

**Files:**
- Modify: `backend/src/lib/email-templates.ts` (nouveau template)
- Modify: `backend/src/routes/payments.ts:427-490`

- [ ] **Step 1: Template de relance**

Ajouter à `backend/src/lib/email-templates.ts` :

```ts
// ═══════════════════════════════════════════════
// Template F: Relance de paiement
// ═══════════════════════════════════════════════

export function buildReminderEmailHtml(params: {
  restaurant: RestaurantBranding
  contact: ContactInfo
  message: string
  commercialName?: string | null
}): string {
  const { restaurant, contact, message, commercialName } = params
  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Bonjour <strong>${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444;white-space:pre-line;">${message}</p>
    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#444;">Cordialement,</p>
    <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">${commercialName || restaurant.name}</p>
  `
  return buildEmailWrapper(restaurant, body)
}

export function buildReminderEmailSubject(subject: string | null, restaurantName: string): string {
  return subject && subject.trim() ? subject : `Relance de paiement — ${restaurantName}`
}
```

- [ ] **Step 2: Envoyer l'email dans `/:id/remind`**

Dans `backend/src/routes/payments.ts`, la route `POST /:id/remind` : élargir la sélection du payment pour récupérer le contexte booking, puis envoyer après l'insert `payment_reminders`. Remplacer le corps de la route par :

```ts
paymentsRouter.post('/:id/remind', async (req: Request, res: Response) => {
  try {
    const { reminder_type, subject, message } = req.body

    const { data: payment } = await supabase
      .from('payments')
      .select('booking_id, organization_id, quote_id')
      .eq('id', req.params.id)
      .single()

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    const { data, error } = await supabase
      .from('payment_reminders')
      .insert({
        booking_id: payment.booking_id,
        payment_id: req.params.id,
        reminder_type: reminder_type || 'payment',
        subject,
        message,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) throw error

    // Envoi email de relance (best-effort : n'échoue pas la relance en cas de souci envoi).
    let emailSent = false
    if (payment.booking_id && message) {
      try {
        const { data: booking } = await supabase
          .from('bookings')
          .select('organization_id, contact:contacts(first_name, last_name, email), restaurant:restaurants(*)')
          .eq('id', payment.booking_id)
          .single()
        const contact = (booking as any)?.contact
        const restaurant = (booking as any)?.restaurant
        if (contact?.email) {
          const commercial = await getCommercialInfo(payment.booking_id)
          const facturationEmail = await getOrgFacturationEmail(
            (booking as any)?.organization_id ?? payment.organization_id
          )
          const html = buildReminderEmailHtml({
            restaurant: restaurant as any,
            contact,
            message,
            commercialName: commercial.name,
          })
          await sendClientEmail({
            organizationId: (booking as any)?.organization_id ?? payment.organization_id,
            bookingId: payment.booking_id,
            quoteId: payment.quote_id || null,
            emailType: 'payment_reminder',
            actorUserId: (req as any).user?.id ?? null,
            to: contact.email,
            subject: buildReminderEmailSubject(subject, restaurant?.name || 'Restaurant'),
            html,
            replyTo: commercial.email || restaurant?.email || undefined,
            facturationEmail: facturationEmail || undefined,
          })
          emailSent = true
        }
      } catch (mailErr) {
        console.error('[Remind] envoi email échoué:', mailErr)
      }
    }

    // Auto-update booking status → Relance paiement
    if (payment.booking_id) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('organization_id')
        .eq('id', payment.booking_id)
        .single()
      if (booking?.organization_id) {
        const { data: statusData } = await supabase
          .from('statuses')
          .select('id')
          .eq('organization_id', booking.organization_id)
          .eq('slug', 'relance_paiement')
          .eq('type', 'booking')
          .single()
        if (statusData) {
          await supabase
            .from('bookings')
            .update({ status_id: statusData.id })
            .eq('id', payment.booking_id)
        }
      }
    }

    res.status(201).json({ ...data, email_sent: emailSent })
  } catch (error) {
    console.error('Error sending reminder:', error)
    res.status(500).json({ error: 'Failed to send reminder' })
  }
})
```

- [ ] **Step 3: Vérifier les imports de payments.ts**

`payments.ts` importe déjà `sendClientEmail`, `getCommercialInfo`, `getOrgFacturationEmail` (create-link les utilise). Ajouter `buildReminderEmailHtml`, `buildReminderEmailSubject` à l'import de `email-templates.js`.

Run: `grep -n "from '../lib/email-templates" backend/src/routes/payments.ts`
Expected: une ligne d'import à compléter.

- [ ] **Step 4: Compiler + suite**

Run: `cd backend && pnpm build && pnpm test`
Expected: exit 0, suite verte (le verrou call-sites tolère `payment_reminder` car il passe par `sendClientEmail`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/payments.ts backend/src/lib/email-templates.ts
git commit -m "feat(gmail): relance de paiement envoie un vrai email dans le fil"
```

---

### Task 8: Flux d'envoi de l'avoir

L'avoir est aujourd'hui PDF seul (généré par `generateCreditNotePdf`, stocké, téléchargeable). On ajoute un endpoint d'envoi email dans le fil du booking. Document fiscal immuable : on n'altère rien, on envoie le PDF existant.

**Files:**
- Modify: `backend/src/lib/email-templates.ts` (template avoir)
- Modify: `backend/src/routes/quotes.ts` (nouvelle route send-email avoir)

- [ ] **Step 1: Template avoir**

Ajouter à `backend/src/lib/email-templates.ts` :

```ts
// ═══════════════════════════════════════════════
// Template G: Avoir (note de crédit) — document fiscal
// ═══════════════════════════════════════════════

export function buildCreditNoteEmailHtml(params: {
  restaurant: RestaurantBranding
  contact: ContactInfo
  avoirNumber: string
  totalTtc: number
  quoteNumber?: string | null
  commercialName?: string | null
}): string {
  const { restaurant, contact, avoirNumber, totalTtc, quoteNumber, commercialName } = params
  const color = restaurant.color || '#0d7377'
  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Bonjour <strong>${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444;">
      Veuillez trouver ci-joint votre avoir <strong>n°${avoirNumber}</strong>${quoteNumber ? ` relatif au devis <strong>n°${quoteNumber}</strong>` : ''}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f8f9fa;border-radius:8px;border:1px solid #e5e7eb;">
      <tr><td style="padding:16px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#666;">Montant de l'avoir</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:${color};">${formatCurrency(totalTtc)}</p>
      </td></tr>
    </table>
    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#444;">Cordialement,</p>
    <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">${commercialName || restaurant.name}</p>
  `
  return buildEmailWrapper(restaurant, body)
}

export function buildCreditNoteEmailSubject(avoirNumber: string, restaurantName: string): string {
  return `Avoir ${avoirNumber} — ${restaurantName}`
}
```

- [ ] **Step 2: Route d'envoi de l'avoir**

Ajouter à `backend/src/routes/quotes.ts` (après la route `credit-note`, ~ligne 1123). Vérifier/compléter les imports : `generateCreditNotePdf` (`../lib/pdf-generator.js`), `buildCreditNoteEmailHtml`, `buildCreditNoteEmailSubject` (`../lib/email-templates.js`).

```ts
// POST /api/quotes/credit-notes/:id/send-email — envoie l'avoir (PDF) dans le fil.
quotesRouter.post(
  '/credit-notes/:id/send-email',
  async (req: Request, res: Response) => {
    try {
      const { data: cn } = await supabase
        .from('credit_notes')
        .select('id, organization_id, booking_id, quote_id, avoir_number, total_ttc')
        .eq('id', req.params.id)
        .single()
      if (!cn) return res.status(404).json({ error: 'Avoir introuvable' })

      const quoteData = cn.quote_id ? await fetchQuoteFullData(cn.quote_id) : null
      const contact = quoteData?.booking?.contact
      const restaurant = quoteData?.booking?.restaurant
      if (!contact?.email) {
        return res.status(400).json({ error: "Le contact n'a pas d'adresse email" })
      }

      const pdfBuffer = await generateCreditNotePdf(cn.id)
      const commercial = cn.booking_id
        ? await getCommercialInfo(cn.booking_id)
        : { name: null, email: null }
      const facturationEmail = await getOrgFacturationEmail(cn.organization_id)

      const html = buildCreditNoteEmailHtml({
        restaurant: restaurant as any,
        contact: { first_name: contact.first_name, last_name: contact.last_name, email: contact.email },
        avoirNumber: cn.avoir_number,
        totalTtc: cn.total_ttc,
        quoteNumber: quoteData?.quote_number ?? null,
        commercialName: commercial.name,
      })

      const result = await sendClientEmail({
        organizationId: cn.organization_id,
        bookingId: cn.booking_id || null,
        quoteId: cn.quote_id || null,
        emailType: 'credit_note',
        actorUserId: (req as any).user?.id ?? null,
        to: contact.email,
        subject: buildCreditNoteEmailSubject(cn.avoir_number, restaurant?.name || 'Restaurant'),
        html,
        replyTo: commercial.email || restaurant?.email || undefined,
        facturationEmail: facturationEmail || undefined,
        attachments: [{ filename: `avoir-${cn.avoir_number}.pdf`, content: pdfBuffer }],
      })

      await supabase.from('activity_logs').insert({
        organization_id: cn.organization_id,
        booking_id: cn.booking_id,
        action_type: 'payment.avoir_sent',
        action_label: `Avoir ${cn.avoir_number} envoyé par email`,
        actor_type: 'user',
        actor_id: (req as any).user?.id ?? null,
        entity_type: 'credit_note',
        entity_id: cn.id,
      })

      res.json({ success: true, provider: result.provider })
    } catch (error) {
      console.error('Error sending credit note email:', error)
      res.status(500).json({ error: "Échec de l'envoi de l'avoir" })
    }
  }
)
```

- [ ] **Step 3: Compiler + suite**

Run: `cd backend && pnpm build && pnpm test`
Expected: exit 0, suite verte.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/quotes.ts backend/src/lib/email-templates.ts
git commit -m "feat(gmail): envoi de l'avoir par email dans le fil"
```

> **Fin du jalon 2B.**

---

### Task 9: Variables d'env, verrous de test, suite complète

**Files:**
- Modify: `backend/.env.example`
- Modify: `LOCALHOST.md`
- Modify: `backend/tests/routes/client-email-callsites.test.ts`

- [ ] **Step 1: Documenter les sous-switches**

Ajouter à `backend/.env.example`, sous le bloc Gmail existant :

```
# Gmail phase 2 : envoi via la boite du commercial. Effectif seulement si
# GMAIL_INTEGRATION_ENABLED=true. OFF => 100% Resend meme si des boites sont connectees.
GMAIL_SENDING_ENABLED=false
# Gmail phase 3 : polling des reponses (declare ici, consomme en phase 3).
GMAIL_POLLING_ENABLED=false
```

Ajouter la même paire dans la section Gmail de `LOCALHOST.md`.

- [ ] **Step 2: Étendre le verrou call-sites**

Ajouter à `backend/tests/routes/client-email-callsites.test.ts`, dans le `describe` existant :

```ts
  it('le transport Gmail vit uniquement dans client-email.ts', () => {
    const libDir = path.resolve(__dirname, '../../src/lib')
    const senders = fs
      .readdirSync(libDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) =>
        fs
          .readFileSync(path.join(libDir, f), 'utf-8')
          .includes('users.messages.send')
      )
    expect(senders).toEqual(['client-email.ts'])
  })

  it('email_messages n\'est ecrit que par email-threads.ts', () => {
    const libDir = path.resolve(__dirname, '../../src/lib')
    const writers = fs
      .readdirSync(libDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) =>
        fs
          .readFileSync(path.join(libDir, f), 'utf-8')
          .includes("from('email_messages').insert")
      )
    expect(writers).toEqual(['email-threads.ts'])
  })
```

- [ ] **Step 3: Suite complète + build racine**

Run: `cd backend && pnpm test && pnpm build`
Expected: tout vert, tsc exit 0.

Run (racine): `pnpm build`
Expected: exit 0 (le front ne change pas en phase 2, doit toujours builder).

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example LOCALHOST.md backend/tests/routes/client-email-callsites.test.ts
git commit -m "docs(gmail): sous-switches phase 2 + verrous transport/fil"
```

---

### Task 10: Revue, régénération des types, checklist de déploiement

- [ ] **Step 1: Revue du diff**

Run: `git log --oneline main..HEAD`
Vérifier : commits courts, français, sans body, sans co-author.

Run: `git diff main..HEAD --stat`
Vérifier : périmètre backend + migration + docs, aucun fichier front modifié.

- [ ] **Step 2: Régénérer les types Supabase (après application de la migration en prod)**

Après Step 3 (SQL prod), régénérer `src/lib/supabase/types.ts` pour exposer `organizations.facturation_email` et le CHECK/index (via CLI Supabase ou MCP `generate_typescript_types`). Non bloquant pour le backend (service role), requis en phase 4 (lecture front).

- [ ] **Step 3: Checklist de déploiement (Thomas, dans cet ordre)**

Prérequis données :
1. Exécuter `round_recompute_quotes.py --apply` (chantier arrondis) pour ne pas ouvrir de fils sur d'anciens montants.

SQL prod (AVANT le backend) :
2. Appliquer `supabase/migrations/20260707_gmail_phase2.sql` dans l'éditeur SQL Supabase. Additif + un CHECK/trigger ; vérifier qu'aucun `email_threads` orphelin (booking_id ET contact_id nuls) n'existe avant d'ajouter le CHECK (`SELECT count(*) FROM email_threads WHERE booking_id IS NULL AND contact_id IS NULL;` doit valoir 0 — la phase 1 n'en crée aucun).

Env prod :
3. Laisser `GMAIL_SENDING_ENABLED` **absent/false** et `GMAIL_POLLING_ENABLED` absent/false.

Déploiement :
4. Déployer le backend. Aucun changement de comportement : boîtes non pilotes + sous-switch OFF ⇒ 100 % Resend.
5. Smoke test Resend : envoi devis + renvoi acompte + relance paiement ⇒ emails partent, `email_logs.provider = 'resend'`, une ligne `email_messages` par envoi.

Pilotage (quand prêt) :
6. Passer `GMAIL_INTEGRATION_ENABLED=true` puis connecter ta boîte (`/settings/integrations`).
7. Mettre `user_gmail_accounts.sending_enabled = true` pour ta seule ligne (SQL manuel).
8. Passer `GMAIL_SENDING_ENABLED=true`. Envoyer un devis : vérifier qu'il part de ta boîte (visible dans ton « Envoyés » Gmail), `email_logs.provider = 'gmail'`, `email_messages.gmail_message_id`/`rfc_message_id` renseignés, sujet du 2e envoi en `Re:`.
9. Test fallback : révoquer l'accès Google ⇒ prochain envoi retombe sur Resend, compte passe `revoked`.

- [ ] **Step 4: Finaliser la branche**

Utiliser le skill `superpowers:finishing-a-development-branch` (merge sur main ou PR selon la préférence de Thomas, comme 0bis/phase 1).

---

## Comportements et points à connaître (review)

1. Tant que `GMAIL_SENDING_ENABLED` est OFF (défaut), rien ne change : 100 % Resend, mais chaque envoi est désormais matérialisé dans `email_threads`/`email_messages` (base pour l'onglet Conversations de la phase 4).
2. La boîte d'envoi = **acteur connecté** en priorité, sinon commercial assigné, sinon Resend. Le flux auto post-signature n'a pas d'acteur ⇒ part du commercial assigné.
3. Une boîte n'envoie via Gmail que si elle est `connected` **et** `sending_enabled` (flag pilote, activé à la main). Se connecter ne bascule pas les envois.
4. Fallback Resend sur : pas de boîte, `revoked` (compte marqué + coupe les envois suivants), `hard` (400/403). Sur timeout ambigu : vérification `rfc822msgid:` avant de renvoyer (évite le double envoi). Jamais de fallback sur un échec d'écriture DB.
5. Threading côté client via `In-Reply-To`/`References` (Message-ID généré par nous), pas via `threadId` Gmail (qui est per-boîte). Un fil peut traverser plusieurs boîtes.
6. `email_logs.provider` donne la métrique du taux de fallback. `resend_message_id` (Resend) vs `gmail_message_id`/`gmail_thread_id` (Gmail).
7. Capture des réponses (polling) = **phase 3**. `GMAIL_POLLING_ENABLED` est déclaré mais non consommé ici.
8. La capture des Message-ID Resend (pour matcher les réponses aux fallbacks) est **phase 5** ; en phase 2 les lignes Resend ont `rfc_message_id = null`.

## Hors périmètre (phases suivantes)

- Toute l'UI : onglet Conversations (lecture + réponse), composer fiche contact, boutons « Envoyer l'avoir »/relance, remplacement du menu email, badge — **phase 4**.
- Cron de polling + notifications in-app des réponses — **phase 3**.
- Pièces jointes entrantes, capture des réponses aux emails Resend, alias `sendAs` — **phase 5**.

## Self-review (couverture du spec)

- Transport Gmail dans `sendClientEmail` (MIME, `Re:`, vérification timeout, classification erreurs) → Tasks 1, 2, 5. ✔
- Fils booking/contact/facturation → Tasks 0, 4 (`getOrCreateThread`, kind), 5. ✔
- Fallback complet + visible (marqueur fil + `provider`) → Task 5. ✔
- Relance réelle → Task 7. ✔
- Flux avoir → Task 8. ✔
- Composer fiche contact **backend** (`contactId`/`threadKind` sur `ClientEmailParams`, résolution fil contact) → Tasks 4, 5 (l'UI est phase 4). ✔
- Sous-switch `GMAIL_SENDING_ENABLED` + flag pilote `sending_enabled` → Tasks 4, 5, 9. ✔
- State signé / token chiffré / service-role → hérités de la phase 1, inchangés. ✔
- CHECK + suppression fils contact-only reportés → Task 0. ✔
- `organizations.facturation_email` manquante → Task 0 (idempotent). ✔
