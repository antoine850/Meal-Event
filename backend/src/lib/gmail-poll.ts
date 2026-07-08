// Reception des reponses (phase 3) : helpers purs de parsing history/MIME,
// puis orchestration du polling par boite (pollAccount/runGmailPoll).

import { recordInbound } from './email-threads.js'
import { classifyGmailError } from './gmail-mime.js'
import {
  gmailClient,
  isGmailPollingEnabled,
  markAccountRevoked,
} from './gmail.js'
import { supabase } from './supabase.js'

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
  return labels.includes('SPAM') || labels.includes('TRASH') || labels.includes('DRAFT')
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
  return fromEmail.toLowerCase() === accountEmail.toLowerCase() ? 'outbound' : 'inbound'
}

export function getHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string | null {
  const h = (headers ?? []).find((x) => x.name?.toLowerCase() === name.toLowerCase())
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
    const data = part.body?.data
    if (data && part.mimeType === 'text/html' && html === null) {
      html = decodePartBody(part)
    } else if (data && part.mimeType === 'text/plain' && text === null) {
      text = decodePartBody(part)
    }
    for (const p of part.parts ?? []) walk(p)
  }
  walk(payload)
  return { html, text }
}

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
        console.warn(`[gmail-poll] boite ${account.user_id} revoquee, polling coupe`)
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
