import { supabase } from './supabase.js'

export interface MailboxCandidate {
  userId: string | null
  email: string | null
  connected: boolean
  sendingEnabled: boolean
}

// 1re boite connectee ET pilote (sending_enabled). Pure : decision seule.
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

export interface ThreadRef {
  id: string
  subject: string
  isNew: boolean
}

type ThreadKind = 'booking' | 'contact' | 'facturation'

// Fil du booking (unique par (booking_id, kind)) ou fil contact-only ouvert.
// Sujet fige au 1er message. Renvoie isNew pour decider "Re:" cote appelant.
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

  // Race select-then-insert : deux envois simultanes sur le meme (booking_id, kind)
  // peuvent lever un duplicate-key ; le fil part alors non lie (pas de double envoi).
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

// Dernier message du fil : rfc_message_id (In-Reply-To/References, toutes boites)
// et gmail_thread_id de CETTE boite pour re-attacher cote Gmail.
export async function getThreadTail(
  threadId: string,
  senderUserId: string
): Promise<{ lastRfcMessageId: string | null; gmailThreadIdForSender: string | null }> {
  const { data: last } = await supabase
    .from('email_messages')
    .select('rfc_message_id')
    .eq('thread_id', threadId)
    .not('rfc_message_id', 'is', null)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const { data: mine } = await supabase
    .from('email_messages')
    .select('gmail_thread_id')
    .eq('thread_id', threadId)
    .eq('sender_user_id', senderUserId)
    .not('gmail_thread_id', 'is', null)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  return {
    lastRfcMessageId: (last as any)?.rfc_message_id ?? null,
    gmailThreadIdForSender: (mine as any)?.gmail_thread_id ?? null,
  }
}

// Acteur connecte (celui qui clique) prioritaire, sinon commercial assigne.
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

// Materialise un envoi dans le fil. Best-effort : jamais throw (un echec DB ne
// doit pas declencher de fallback ni casser un envoi reussi).
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
  // Non-throwing : supabase-js rejette sur erreur transport (pas seulement via
  // {error}) ; un throw ici s'echapperait de sendClientEmail apres un envoi
  // reussi -> le caller croit a un echec -> retry -> double envoi.
  try {
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
  } catch (err) {
    console.error('[email-threads] recordOutbound threw:', err)
  }
}
