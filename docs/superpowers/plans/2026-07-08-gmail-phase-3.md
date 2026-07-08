# Gmail Phase 3 (réception des réponses) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire remonter les réponses clients Gmail dans `email_messages` via un polling par boîte connectée (curseur `history_id`), avec dédup, resync 404 et révocation gérés.

**Architecture:** Un nouveau module `backend/src/lib/gmail-poll.ts` porte des helpers purs (parsing history/MIME) et l'orchestration `pollAccount`/`runGmailPoll` ; `email-threads.ts` gagne un writer idempotent `recordInbound` ; `index.ts` démarre une boucle `setInterval` gardée derrière `isGmailPollingEnabled()`. Aucune migration : le schéma (index unique `gmail_message_id`, `last_sync_at`, `body_text`/`snippet`) existe déjà.

**Tech Stack:** Express 4 + TypeScript strict, googleapis (Gmail API v1), supabase-js (service-role), vitest.

**Référence design :** `docs/superpowers/specs/2026-07-08-gmail-phase-3-reception-design.md`

**Contexte pour un exécutant sans historique :**

- Travailler dans le worktree `.worktrees/feat-gmail-phase-2` (branche `feat/gmail-phase-2`). Tous les chemins ci-dessous sont relatifs à sa racine.
- Les phases 0-2 (envoi Gmail + fils) sont codées sur cette branche. Tables : `user_gmail_accounts` (curseur `history_id`, `status`, `last_sync_at`), `email_threads`, `email_messages` (index unique partiel sur `gmail_message_id`).
- Style tests du repo : helpers purs testés unitairement ; l'orchestration impure est vérifiée par des tests « câblage » qui lisent le source (voir `backend/tests/routes/gmail-routes.test.ts`). Pas de `vi.mock`.
- Commandes : `cd backend && pnpm exec vitest run <fichier>` ; typecheck `pnpm exec tsc --noEmit`.
- Style commits : `feat(gmail): sujet court en français sans accents`, une ligne, pas de body, pas de Co-Authored-By.

---

### Task 0: Committer les docs (spec + plan)

**Files:**

- Create: `docs/superpowers/specs/2026-07-08-gmail-phase-3-reception-design.md` (déjà écrit)
- Create: `docs/superpowers/plans/2026-07-08-gmail-phase-3.md` (ce fichier)

- [ ] **Step 1: Commit**

```bash
git add docs/superpowers/specs/2026-07-08-gmail-phase-3-reception-design.md docs/superpowers/plans/2026-07-08-gmail-phase-3.md
git commit -m "docs(gmail): spec et plan phase 3 (reception)"
```

---

### Task 1: Flag `isGmailPollingEnabled()`

**Files:**

- Modify: `backend/src/lib/gmail.ts` (après `isGmailSendingEnabled`, ~ligne 25)
- Test: `backend/tests/lib/gmail-polling-flag.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `backend/tests/lib/gmail-polling-flag.test.ts` :

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { isGmailPollingEnabled } from '../../src/lib/gmail.js'

const MASTER = 'GMAIL_INTEGRATION_ENABLED'
const POLL = 'GMAIL_POLLING_ENABLED'
const saved = { master: process.env[MASTER], poll: process.env[POLL] }

afterEach(() => {
  if (saved.master === undefined) delete process.env[MASTER]
  else process.env[MASTER] = saved.master
  if (saved.poll === undefined) delete process.env[POLL]
  else process.env[POLL] = saved.poll
})

describe('isGmailPollingEnabled (sous-switch, defaut OFF)', () => {
  it('OFF si le master est OFF, meme si le polling est true', () => {
    delete process.env[MASTER]
    process.env[POLL] = 'true'
    expect(isGmailPollingEnabled()).toBe(false)
  })

  it('OFF si master ON mais polling absent ou different de "true"', () => {
    process.env[MASTER] = 'true'
    for (const v of [undefined, '', 'false', 'TRUE', '1']) {
      if (v === undefined) delete process.env[POLL]
      else process.env[POLL] = v
      expect(isGmailPollingEnabled()).toBe(false)
    }
  })

  it('ON uniquement si master et polling valent "true"', () => {
    process.env[MASTER] = 'true'
    process.env[POLL] = 'true'
    expect(isGmailPollingEnabled()).toBe(true)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-polling-flag.test.ts`
Attendu : FAIL — `isGmailPollingEnabled` n'est pas exporté par `gmail.js`.

- [ ] **Step 3: Implémenter**

Dans `backend/src/lib/gmail.ts`, juste après `isGmailSendingEnabled` :

```typescript
// Sous-switch de polling (phase 3). Effectif seulement si le master est ON.
// Independant de l'envoi : couper l'envoi ne coupe pas la capture des reponses.
export function isGmailPollingEnabled(): boolean {
  return (
    isGmailIntegrationEnabled() && process.env.GMAIL_POLLING_ENABLED === 'true'
  )
}
```

- [ ] **Step 4: Vérifier le pass**

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-polling-flag.test.ts`
Attendu : PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/gmail.ts backend/tests/lib/gmail-polling-flag.test.ts
git commit -m "feat(gmail): flag de polling isGmailPollingEnabled"
```

---

### Task 2: Helpers purs de `gmail-poll.ts`

**Files:**

- Create: `backend/src/lib/gmail-poll.ts`
- Test: `backend/tests/lib/gmail-poll-pure.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `backend/tests/lib/gmail-poll-pure.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import {
  collectAddedStubs,
  classifyDirection,
  getHeader,
  parseAddress,
  parseAddressList,
  extractBodies,
} from '../../src/lib/gmail-poll.js'

const b64url = (s: string) => Buffer.from(s, 'utf-8').toString('base64url')

describe('collectAddedStubs', () => {
  it('extrait les messagesAdded, dedupe entre pages, exclut SPAM/TRASH/DRAFT', () => {
    const pages = [
      {
        history: [
          {
            messagesAdded: [
              { message: { id: 'm1', threadId: 't1', labelIds: ['INBOX'] } },
              { message: { id: 'm2', threadId: 't1', labelIds: ['SPAM'] } },
            ],
          },
        ],
      },
      {
        history: [
          {
            messagesAdded: [
              { message: { id: 'm1', threadId: 't1', labelIds: ['INBOX'] } },
              { message: { id: 'm3', threadId: 't2', labelIds: ['TRASH'] } },
              { message: { id: 'm5', threadId: 't1', labelIds: ['DRAFT'] } },
              { message: { id: 'm4', threadId: 't2' } },
            ],
          },
        ],
      },
      {},
    ]
    expect(collectAddedStubs(pages).map((s) => s.id)).toEqual(['m1', 'm4'])
  })

  it('ignore les stubs sans id ou threadId', () => {
    const pages = [
      { history: [{ messagesAdded: [{ message: { id: 'x' } }, {}] }] },
    ]
    expect(collectAddedStubs(pages)).toEqual([])
  })
})

describe('classifyDirection', () => {
  it('From == boite -> outbound (reponse du commercial hors CRM)', () => {
    expect(classifyDirection('vendeur@resto.fr', 'Vendeur@Resto.FR')).toBe(
      'outbound'
    )
  })

  it('sinon inbound, y compris From ou boite inconnus', () => {
    expect(classifyDirection('client@gmail.com', 'vendeur@resto.fr')).toBe(
      'inbound'
    )
    expect(classifyDirection(null, 'vendeur@resto.fr')).toBe('inbound')
    expect(classifyDirection('client@gmail.com', null)).toBe('inbound')
  })
})

describe('parsing adresses et headers', () => {
  const headers = [
    { name: 'From', value: 'Jean Dupont <Jean@Client.FR>' },
    { name: 'subject', value: 'Re: Devis' },
  ]

  it('getHeader est insensible a la casse et null si absent', () => {
    expect(getHeader(headers, 'Subject')).toBe('Re: Devis')
    expect(getHeader(headers, 'X-Absent')).toBeNull()
    expect(getHeader(undefined, 'From')).toBeNull()
  })

  it('parseAddress extrait la partie adresse et normalise en minuscules', () => {
    expect(parseAddress('Jean Dupont <Jean@Client.FR>')).toBe('jean@client.fr')
    expect(parseAddress('nu@client.fr')).toBe('nu@client.fr')
    expect(parseAddress(null)).toBeNull()
    expect(parseAddress('')).toBeNull()
  })

  it('parseAddressList gere les listes separees par des virgules', () => {
    expect(parseAddressList('A <a@x.fr>, b@y.fr')).toEqual(['a@x.fr', 'b@y.fr'])
    expect(parseAddressList(null)).toEqual([])
  })

  it('parseAddressList ecarte les fragments de display-name quotes', () => {
    expect(parseAddressList('"Dupont, Jean" <jean@x.fr>')).toEqual([
      'jean@x.fr',
    ])
  })
})

describe('extractBodies', () => {
  it('trouve text/html et text/plain dans un multipart imbrique', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: b64url('bonjour') } },
            { mimeType: 'text/html', body: { data: b64url('<p>bonjour</p>') } },
          ],
        },
      ],
    }
    expect(extractBodies(payload)).toEqual({
      html: '<p>bonjour</p>',
      text: 'bonjour',
    })
  })

  it('message simple non multipart', () => {
    const payload = { mimeType: 'text/plain', body: { data: b64url('salut') } }
    expect(extractBodies(payload)).toEqual({ html: null, text: 'salut' })
  })

  it('respecte le charset declare par la partie (latin1/windows-1252)', () => {
    const payload = {
      mimeType: 'text/plain',
      headers: [
        { name: 'Content-Type', value: 'text/plain; charset=ISO-8859-1' },
      ],
      body: { data: Buffer.from('café prévu', 'latin1').toString('base64url') },
    }
    expect(extractBodies(payload)).toEqual({ html: null, text: 'café prévu' })
  })

  it('payload vide -> les deux null', () => {
    expect(extractBodies(undefined)).toEqual({ html: null, text: null })
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-poll-pure.test.ts`
Attendu : FAIL — le module `src/lib/gmail-poll.ts` n'existe pas.

- [ ] **Step 3: Implémenter les helpers**

Créer `backend/src/lib/gmail-poll.ts` :

```typescript
// Reception des reponses (phase 3) : helpers purs de parsing history/MIME,
// puis orchestration du polling par boite (pollAccount/runGmailPoll).

export interface MessageStub {
  id: string
  threadId: string
  labelIds: string[]
}

// Page de history.list reduite a ce qu'on consomme (decouple de googleapis).
export interface HistoryPage {
  history?: Array<{
    messagesAdded?: Array<{
      message?: {
        id?: string | null
        threadId?: string | null
        labelIds?: string[] | null
      } | null
    }> | null
  }> | null
  historyId?: string | null
}

export function isExcludedByLabels(labels: string[]): boolean {
  return (
    labels.includes('SPAM') ||
    labels.includes('TRASH') ||
    labels.includes('DRAFT')
  )
}

// Stubs messagesAdded des pages history.list : dedupliques entre pages
// (Gmail repete un message present dans plusieurs entrees), hors SPAM/TRASH.
// DRAFT aussi : chaque autosave de brouillon cree un messageAdded a id neuf
// qui ne se reconcilie jamais avec le message finalement envoye.
export function collectAddedStubs(pages: HistoryPage[]): MessageStub[] {
  const seen = new Set<string>()
  const stubs: MessageStub[] = []
  for (const page of pages) {
    for (const h of page.history ?? []) {
      for (const added of h.messagesAdded ?? []) {
        const msg = added.message
        if (!msg?.id || !msg.threadId || seen.has(msg.id)) continue
        const labels = msg.labelIds ?? []
        if (isExcludedByLabels(labels)) continue
        seen.add(msg.id)
        stubs.push({ id: msg.id, threadId: msg.threadId, labelIds: labels })
      }
    }
  }
  return stubs
}

// From == boite du compte -> le commercial a repondu depuis Gmail hors CRM.
export function classifyDirection(
  fromEmail: string | null,
  accountEmail: string | null
): 'inbound' | 'outbound' {
  if (!fromEmail || !accountEmail) return 'inbound'
  return fromEmail.toLowerCase() === accountEmail.toLowerCase()
    ? 'outbound'
    : 'inbound'
}

export function getHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string | null {
  const h = (headers ?? []).find(
    (x) => x.name?.toLowerCase() === name.toLowerCase()
  )
  return h?.value ?? null
}

// "Jean Dupont <jean@x.fr>" -> "jean@x.fr" ; adresse nue renvoyee normalisee.
export function parseAddress(raw: string | null): string | null {
  if (!raw) return null
  const m = raw.match(/<([^>]+)>/)
  const email = (m ? m[1] : raw).trim().toLowerCase()
  return email || null
}

// Le split virgule casse les display-names quotes ("Dupont, Jean") : on ne
// garde que les fragments qui ressemblent a une adresse.
export function parseAddressList(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((p) => parseAddress(p))
    .filter((x): x is string => !!x && x.includes('@'))
}

interface MimePart {
  mimeType?: string | null
  headers?: Array<{ name?: string | null; value?: string | null }> | null
  body?: { data?: string | null } | null
  parts?: MimePart[] | null
}

// Gmail decode le transfer-encoding mais pas le charset : les octets sont ceux
// du Content-Type de la partie (windows-1252 courant chez les expediteurs
// francais). Fallback utf-8 si charset absent ou inconnu de TextDecoder.
function decodePartBody(part: MimePart): string {
  const buf = Buffer.from(part.body?.data ?? '', 'base64url')
  const ct = getHeader(part.headers ?? undefined, 'Content-Type')
  const charset = ct?.match(/charset="?([^";]+)"?/i)?.[1]?.trim()
  if (charset) {
    try {
      return new TextDecoder(charset).decode(buf)
    } catch {
      // charset inconnu -> utf-8
    }
  }
  return buf.toString('utf-8')
}

// Premiere partie text/html et text/plain du payload (walk recursif).
export function extractBodies(payload: MimePart | undefined): {
  html: string | null
  text: string | null
} {
  let html: string | null = null
  let text: string | null = null
  const walk = (part: MimePart | undefined | null): void => {
    if (!part) return
    if (part.body?.data && part.mimeType === 'text/html' && html === null) {
      html = decodePartBody(part)
    } else if (
      part.body?.data &&
      part.mimeType === 'text/plain' &&
      text === null
    ) {
      text = decodePartBody(part)
    }
    for (const p of part.parts ?? []) walk(p)
  }
  walk(payload)
  return { html, text }
}
```

- [ ] **Step 4: Vérifier le pass**

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-poll-pure.test.ts`
Attendu : PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/gmail-poll.ts backend/tests/lib/gmail-poll-pure.test.ts
git commit -m "feat(gmail): helpers purs du polling (stubs history, direction, mime)"
```

---

### Task 3: `recordInbound` dans `email-threads.ts`

**Files:**

- Modify: `backend/src/lib/email-threads.ts` (après `recordOutbound`, fin de fichier)
- Test: `backend/tests/lib/gmail-poll-wiring.test.ts` (créé ici, complété en Task 4/5)

- [ ] **Step 1: Écrire le test de câblage qui échoue**

Créer `backend/tests/lib/gmail-poll-wiring.test.ts` (style lecture de source, comme `tests/routes/gmail-routes.test.ts`) :

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const read = (p: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../src', p), 'utf-8')

describe('gmail polling wiring', () => {
  it('recordInbound insere avec dedup 23505 et bump last_message_at', () => {
    const threads = read('lib/email-threads.ts')
    expect(threads).toContain('export async function recordInbound')
    expect(threads).toContain("'23505'")
    expect(threads).toContain('last_message_at')
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-poll-wiring.test.ts`
Attendu : FAIL — `recordInbound` absent de `email-threads.ts`.

- [ ] **Step 3: Implémenter `recordInbound`**

Ajouter à la fin de `backend/src/lib/email-threads.ts` :

```typescript
// Materialise un message capte par le polling (phase 3). Idempotent : l'index
// unique partiel sur gmail_message_id fait la dedup (23505 = deja en base, pas
// une erreur ; pas d'upsert onConflict car PostgREST ne cible pas un index
// partiel). Contrairement a recordOutbound, un throw transport peut remonter :
// le curseur n'avance pas et le tick suivant re-traite (at-least-once).
export async function recordInbound(msg: {
  threadId: string
  direction: 'inbound' | 'outbound'
  senderUserId: string | null
  gmailThreadId: string | null
  gmailMessageId: string
  rfcMessageId: string | null
  fromEmail: string | null
  toEmails: string[]
  cc: string[]
  subject: string | null
  bodyHtml: string | null
  bodyText: string | null
  snippet: string | null
  sentAt: string | null
  inReplyTo: string | null
  references: string | null
}): Promise<boolean> {
  const { error } = await supabase.from('email_messages').insert({
    thread_id: msg.threadId,
    direction: msg.direction,
    provider: 'gmail',
    sender_user_id: msg.senderUserId,
    gmail_thread_id: msg.gmailThreadId,
    gmail_message_id: msg.gmailMessageId,
    rfc_message_id: msg.rfcMessageId,
    from_email: msg.fromEmail,
    to_emails: msg.toEmails,
    cc: msg.cc,
    subject: msg.subject,
    body_html: msg.bodyHtml,
    body_text: msg.bodyText,
    snippet: msg.snippet,
    sent_at: msg.sentAt,
    in_reply_to: msg.inReplyTo,
    references_header: msg.references,
  } as never)
  if (error) {
    if (error.code === '23505') return false
    console.error('[email-threads] recordInbound insert failed:', error)
    return false
  }
  await supabase
    .from('email_threads')
    .update({
      last_message_at: msg.sentAt ?? new Date().toISOString(),
    } as never)
    .eq('id', msg.threadId)
  return true
}
```

- [ ] **Step 4: Vérifier le pass + typecheck**

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-poll-wiring.test.ts && pnpm exec tsc --noEmit`
Attendu : PASS + `TypeScript: No errors found`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/email-threads.ts backend/tests/lib/gmail-poll-wiring.test.ts
git commit -m "feat(gmail): recordInbound idempotent dans le fil"
```

---

### Task 4: `pollAccount` + `resyncAccount`

**Files:**

- Modify: `backend/src/lib/gmail-poll.ts` (ajout sous les helpers purs)
- Test: `backend/tests/lib/gmail-poll-wiring.test.ts` (compléter)

- [ ] **Step 1: Compléter le test de câblage (échec attendu)**

Ajouter dans le `describe` de `backend/tests/lib/gmail-poll-wiring.test.ts` :

```typescript
it('pollAccount ne liste que messageAdded et persiste le curseur apres le batch', () => {
  const poll = read('lib/gmail-poll.ts')
  expect(poll).toContain("historyTypes: ['messageAdded']")
  expect(poll).toContain('saveCursor')
  expect(poll).toContain('last_sync_at')
  // Le fetch complet est reserve aux fils suivis et aux ids inconnus.
  expect(poll).toContain('filterUnknownIds')
  expect(poll).toContain("format: 'full'")
})

it('historyId expire (404) -> resync borne aux fils suivis puis re-seed', () => {
  const poll = read('lib/gmail-poll.ts')
  expect(poll).toContain('resyncAccount')
  expect(poll).toContain('getProfile')
  expect(poll).toContain('threads.get')
})
```

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-poll-wiring.test.ts`
Attendu : FAIL sur les 2 nouveaux tests.

- [ ] **Step 2: Implémenter l'orchestration par boîte**

Ajouter en tête de `backend/src/lib/gmail-poll.ts` (imports) :

```typescript
import { recordInbound } from './email-threads.js'
import { gmailClient } from './gmail.js'
import { supabase } from './supabase.js'
```

Puis ajouter sous les helpers purs :

```typescript
type GmailApi = NonNullable<Awaited<ReturnType<typeof gmailClient>>>

export interface PollableAccount {
  user_id: string
  google_email: string | null
  history_id: string | null
}

export interface PollSummary {
  inserted: number
}

async function saveCursor(
  userId: string,
  historyId: string | null
): Promise<void> {
  await supabase
    .from('user_gmail_accounts')
    .update({
      history_id: historyId,
      last_sync_at: new Date().toISOString(),
    } as never)
    .eq('user_id', userId)
}

// Ids deja en base (nos propres envois CRM notamment) : evite un messages.get
// inutile sur le scope restricted.
async function filterUnknownIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data } = await supabase
    .from('email_messages')
    .select('gmail_message_id')
    .in('gmail_message_id', ids)
  const known = new Set(((data ?? []) as any[]).map((r) => r.gmail_message_id))
  return new Set(ids.filter((id) => !known.has(id)))
}

// Materialise un message Gmail complet dans le fil CRM. false si exclu par
// labels (SPAM/TRASH/DRAFT, ceinture-bretelles : les labels peuvent changer
// entre le stub et le fetch) ou deja en base (dedup 23505 dans recordInbound).
async function ingestMessage(
  full: any,
  account: PollableAccount,
  crmThreadId: string
): Promise<boolean> {
  if (isExcludedByLabels(full.labelIds ?? [])) return false
  const headers = full.payload?.headers
  const fromEmail = parseAddress(getHeader(headers, 'From'))
  const direction = classifyDirection(fromEmail, account.google_email)
  const bodies = extractBodies(full.payload)
  return recordInbound({
    threadId: crmThreadId,
    direction,
    // From == boite : reponse du commercial depuis Gmail hors CRM.
    senderUserId: direction === 'outbound' ? account.user_id : null,
    gmailThreadId: full.threadId ?? null,
    gmailMessageId: full.id,
    rfcMessageId: getHeader(headers, 'Message-ID'),
    fromEmail,
    toEmails: parseAddressList(getHeader(headers, 'To')),
    cc: parseAddressList(getHeader(headers, 'Cc')),
    subject: getHeader(headers, 'Subject'),
    bodyHtml: bodies.html,
    bodyText: bodies.text,
    snippet: full.snippet ?? null,
    sentAt: full.internalDate
      ? new Date(Number(full.internalDate)).toISOString()
      : null,
    inReplyTo: getHeader(headers, 'In-Reply-To'),
    references: getHeader(headers, 'References'),
  })
}

// historyId expire (~1 semaine de retention Gmail) : re-liste chaque fil suivi
// via threads.get, ingere les manquants, puis re-seme le curseur via getProfile.
async function resyncAccount(
  gmail: GmailApi,
  account: PollableAccount,
  threadByGmailId: Map<string, string>
): Promise<PollSummary> {
  console.warn(
    `[gmail-poll] historyId expire pour ${account.user_id}, resync de ${threadByGmailId.size} fil(s)`
  )
  // Curseur capture AVANT la boucle : une reponse arrivant pendant le resync
  // (apres le threads.get de son fil) est >= ce point, donc reprise au tick
  // suivant, rededupliquee. Le semer apres la boucle raterait cette fenetre.
  const { data: profile } = await gmail.users.getProfile({ userId: 'me' })
  const cursor = profile.historyId ? String(profile.historyId) : null
  let inserted = 0
  for (const [gmailThreadId, crmThreadId] of threadByGmailId) {
    let thread: any
    try {
      const res = await gmail.users.threads.get({
        userId: 'me',
        id: gmailThreadId,
        format: 'full',
      })
      thread = res.data
    } catch (err) {
      const status = (err as any)?.response?.status ?? (err as any)?.code
      if (status === 404) continue // fil supprime cote Gmail : on saute
      throw err
    }
    const messages = (thread.messages ?? []) as any[]
    const fresh = await filterUnknownIds(messages.map((m) => m.id))
    for (const msg of messages) {
      if (!fresh.has(msg.id)) continue
      if (await ingestMessage(msg, account, crmThreadId)) inserted += 1
    }
  }
  await saveCursor(account.user_id, cursor)
  return { inserted }
}

// Poll d'une boite : history.list depuis le curseur, fetch limite aux fils
// suivis et aux ids inconnus, ingestion, puis avance du curseur. Le curseur
// n'est persiste qu'apres le batch complet : un echec => le tick suivant
// reprend au meme point (at-least-once, rededuplique par gmail_message_id).
export async function pollAccount(
  gmail: GmailApi,
  account: PollableAccount
): Promise<PollSummary> {
  // Fils suivis par cette boite : un fil nait toujours d'un envoi CRM de la
  // boite, donc sender_user_id = boite suffit a retrouver ses gmail_thread_id.
  const { data: tracked } = await supabase
    .from('email_messages')
    .select('gmail_thread_id, thread_id')
    .eq('sender_user_id', account.user_id)
    .not('gmail_thread_id', 'is', null)
  const threadByGmailId = new Map<string, string>()
  for (const row of (tracked ?? []) as any[]) {
    if (!threadByGmailId.has(row.gmail_thread_id)) {
      threadByGmailId.set(row.gmail_thread_id, row.thread_id)
    }
  }

  // Pas de curseur (compte connecte avant le seed, ou seed en echec) : on seme.
  if (!account.history_id) {
    const { data: profile } = await gmail.users.getProfile({ userId: 'me' })
    await saveCursor(
      account.user_id,
      profile.historyId ? String(profile.historyId) : null
    )
    return { inserted: 0 }
  }

  const pages: HistoryPage[] = []
  try {
    let pageToken: string | undefined
    do {
      const { data } = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: account.history_id,
        historyTypes: ['messageAdded'],
        pageToken,
      })
      pages.push(data as HistoryPage)
      pageToken = data.nextPageToken ?? undefined
    } while (pageToken)
  } catch (err) {
    const status = (err as any)?.response?.status ?? (err as any)?.code
    if (status === 404) return resyncAccount(gmail, account, threadByGmailId)
    throw err
  }

  const stubs = collectAddedStubs(pages).filter((s) =>
    threadByGmailId.has(s.threadId)
  )
  const fresh = await filterUnknownIds(stubs.map((s) => s.id))
  let inserted = 0
  for (const stub of stubs) {
    if (!fresh.has(stub.id)) continue
    const { data: full } = await gmail.users.messages.get({
      userId: 'me',
      id: stub.id,
      format: 'full',
    })
    if (
      await ingestMessage(full, account, threadByGmailId.get(stub.threadId)!)
    ) {
      inserted += 1
    }
  }

  const newCursor =
    [...pages].reverse().find((p) => p.historyId)?.historyId ??
    account.history_id
  await saveCursor(account.user_id, String(newCursor))
  return { inserted }
}
```

- [ ] **Step 3: Vérifier pass + typecheck**

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-poll-wiring.test.ts && pnpm exec tsc --noEmit`
Attendu : PASS (3 tests) + `TypeScript: No errors found`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/gmail-poll.ts backend/tests/lib/gmail-poll-wiring.test.ts
git commit -m "feat(gmail): pollAccount via history.list avec resync 404"
```

---

### Task 5: `runGmailPoll` + `startGmailPolling`

**Files:**

- Modify: `backend/src/lib/gmail-poll.ts` (fin de fichier)
- Test: `backend/tests/lib/gmail-poll-wiring.test.ts` (compléter)

- [ ] **Step 1: Compléter le test de câblage (échec attendu)**

Ajouter dans le `describe` :

```typescript
it('runGmailPoll gate sur le flag et isole les erreurs par boite', () => {
  const poll = read('lib/gmail-poll.ts')
  expect(poll).toContain('isGmailPollingEnabled()')
  expect(poll).toContain('markAccountRevoked')
  expect(poll).toContain('classifyGmailError')
  expect(poll).toContain("eq('status', 'connected')")
})

it('startGmailPolling: setInterval avec garde in-flight', () => {
  const poll = read('lib/gmail-poll.ts')
  expect(poll).toContain('export function startGmailPolling')
  expect(poll).toContain('setInterval')
  expect(poll).toContain('GMAIL_POLLING_INTERVAL_MS')
  expect(poll).toContain('pollInFlight')
})
```

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-poll-wiring.test.ts`
Attendu : FAIL sur les 2 nouveaux tests.

- [ ] **Step 2: Implémenter**

Mettre à jour l'import de `gmail.js` en tête de `gmail-poll.ts` :

```typescript
import { classifyGmailError } from './gmail-mime.js'
import {
  gmailClient,
  isGmailPollingEnabled,
  markAccountRevoked,
} from './gmail.js'
```

Ajouter en fin de `backend/src/lib/gmail-poll.ts` :

```typescript
// Un tick : toutes les boites connectees. Une boite en erreur n'empeche pas
// les autres ; son curseur reste en place (le tick suivant reprend au meme
// point, l'intervalle fait office de backoff sur 429/5xx).
export async function runGmailPoll(): Promise<{
  accounts: number
  inserted: number
}> {
  if (!isGmailPollingEnabled()) return { accounts: 0, inserted: 0 }
  const { data: accounts } = await supabase
    .from('user_gmail_accounts')
    .select('user_id, google_email, history_id')
    .eq('status', 'connected')
  let polled = 0
  let inserted = 0
  for (const account of (accounts ?? []) as PollableAccount[]) {
    try {
      const gmail = await gmailClient(account.user_id)
      if (!gmail) continue
      const res = await pollAccount(gmail, account)
      polled += 1
      inserted += res.inserted
    } catch (err) {
      if (classifyGmailError(err) === 'revoked') {
        console.warn(
          `[gmail-poll] boite ${account.user_id} revoquee, polling coupe`
        )
        await markAccountRevoked(account.user_id, err)
      } else {
        console.error(
          `[gmail-poll] boite ${account.user_id}:`,
          err instanceof Error ? err.message : err
        )
      }
    }
  }
  return { accounts: polled, inserted }
}

let pollInFlight = false

// Demarre la boucle si le flag est ON (lu au boot : flip = restart, Render
// redemarre sur changement d'env). Garde in-flight : un tick lent ne s'empile
// pas sur le suivant. Pas de verrou multi-instance : curseur idempotent +
// dedup par gmail_message_id rendent le double-run inoffensif.
export function startGmailPolling(): void {
  if (!isGmailPollingEnabled()) return
  const interval = Number(process.env.GMAIL_POLLING_INTERVAL_MS) || 180_000
  setInterval(async () => {
    if (pollInFlight) return
    pollInFlight = true
    try {
      const { accounts, inserted } = await runGmailPoll()
      if (inserted > 0) {
        console.log(
          `[gmail-poll] ${inserted} message(s) ingere(s) sur ${accounts} boite(s)`
        )
      }
    } catch (err) {
      console.error(
        '[gmail-poll] tick en echec:',
        err instanceof Error ? err.message : err
      )
    } finally {
      pollInFlight = false
    }
  }, interval)
}
```

- [ ] **Step 3: Vérifier pass + typecheck**

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-poll-wiring.test.ts && pnpm exec tsc --noEmit`
Attendu : PASS (5 tests) + `TypeScript: No errors found`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/gmail-poll.ts backend/tests/lib/gmail-poll-wiring.test.ts
git commit -m "feat(gmail): runGmailPoll et boucle setInterval gardee"
```

---

### Task 6: Câblage `index.ts` + doc env

**Files:**

- Modify: `backend/src/index.ts` (imports + callback `app.listen`, fin de fichier)
- Modify: `backend/.env.example:50-51`
- Modify: `LOCALHOST.md:91`
- Test: `backend/tests/lib/gmail-poll-wiring.test.ts` (compléter)

- [ ] **Step 1: Compléter le test de câblage (échec attendu)**

Ajouter dans le `describe` :

```typescript
it('index.ts demarre la boucle apres listen', () => {
  const index = read('index.ts')
  expect(index).toContain('startGmailPolling()')
})
```

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-poll-wiring.test.ts`
Attendu : FAIL sur le nouveau test.

- [ ] **Step 2: Câbler `index.ts`**

Ajouter l'import (à côté des autres imports `./lib/` ou routes en tête de fichier) :

```typescript
import { startGmailPolling } from './lib/gmail-poll.js'
```

Remplacer le bloc `app.listen` en fin de fichier :

```typescript
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  startGmailPolling()
})
```

- [ ] **Step 3: Mettre à jour la doc env**

Dans `backend/.env.example`, remplacer :

```
# Gmail phase 3 : polling des reponses (declare ici, consomme en phase 3).
GMAIL_POLLING_ENABLED=false
```

par :

```
# Gmail phase 3 : polling des reponses dans les fils suivis. Effectif seulement
# si GMAIL_INTEGRATION_ENABLED=true. Intervalle en ms (defaut 180000 = 3 min).
GMAIL_POLLING_ENABLED=false
GMAIL_POLLING_INTERVAL_MS=180000
```

Dans `LOCALHOST.md`, remplacer :

```
GMAIL_POLLING_ENABLED=false                            # phase 3 : polling des reponses (declare ici, consomme en phase 3)
```

par :

```
GMAIL_POLLING_ENABLED=false                            # phase 3 : polling des reponses (effectif seulement si le master est ON)
GMAIL_POLLING_INTERVAL_MS=180000                       # intervalle du polling en ms (defaut 3 min)
```

- [ ] **Step 4: Vérifier pass + typecheck**

Run: `cd backend && pnpm exec vitest run tests/lib/gmail-poll-wiring.test.ts && pnpm exec tsc --noEmit`
Attendu : PASS (6 tests) + `TypeScript: No errors found`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/index.ts backend/.env.example LOCALHOST.md backend/tests/lib/gmail-poll-wiring.test.ts
git commit -m "feat(gmail): demarre le polling au boot + doc env"
```

---

### Task 7: Suite complète + vérification finale

**Files:** aucun nouveau — vérification.

- [ ] **Step 1: Toute la suite backend**

Run: `cd backend && pnpm exec vitest run`
Attendu : PASS, 0 FAIL (les suites existantes gmail/stripe/crypto restent vertes).

- [ ] **Step 2: Build**

Run: `cd backend && pnpm build`
Attendu : exit 0.

- [ ] **Step 3: Lint**

Run: `cd backend && pnpm lint`
Attendu : exit 0 (ou uniquement des warnings préexistants).

- [ ] **Step 4: Smoke test manuel (optionnel, nécessite des credentials locaux)**

Avec un `.env` local où `GMAIL_INTEGRATION_ENABLED=true`, `GMAIL_POLLING_ENABLED=true`
et une boîte connectée : `cd backend && pnpm dev`, attendre un tick (3 min) ou
appeler `runGmailPoll()` depuis un script jetable, répondre depuis une boîte
externe à un email envoyé par le CRM, vérifier l'apparition de la ligne
`direction='inbound'` dans `email_messages` et l'avancée de `history_id`.

---

## Post-audit (08/07, après exécution complète)

L'audit multi-agents pré-push a ajouté 4 correctifs hors plan : `@types/nodemailer`
déplacé en dependencies (Render build avec NODE_ENV=production, devDeps omises),
`loadTrackedThreads` paginé par `.range()` (cap PostgREST 1000 lignes),
`filterUnknownIds` chunké par 500 ids (`.in()` casse vers ~1500 ids), et skip des
404 sur `messages.get` (message supprimé entre l'history et le fetch). Les blocs
de code des Tasks 4-5 ci-dessus ne reflètent pas ces correctifs : la source fait foi.

## Hors périmètre de ce plan

- **Phase 4 (UI)** : onglet Emails sur l'événement, composer contact, badge —
  nécessite sa propre passe de design (et la régénération des types Supabase
  pour exposer `email_threads`/`email_messages` au front).
- **Phase 5** : pièces jointes entrantes, capture des réponses Resend
  (prérequis : stocker un Message-ID sur les envois Resend), polish.
- **Jalons non-dev** : création de la 2e app Google Internal, merge des
  branches, migrations prod, variables d'env, pilote.
