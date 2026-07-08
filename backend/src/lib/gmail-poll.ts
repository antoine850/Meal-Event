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
