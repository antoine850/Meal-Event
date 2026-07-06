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

// Helper partage : email de facturation de l'organisation (reply-to secondaire)
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

// Helper partage : commercial assigne d'un booking (premier de assigned_user_ids)
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

// Journalisation email_logs best-effort. DOIT etre non-throwing : supabase-js
// rejette (throw) sur erreur transport, pas seulement via {error} ; un throw ici
// re-rentrerait dans le catch Gmail et pourrait declencher un double envoi.
async function logEmail(row: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await supabase.from('email_logs').insert(row as never)
    if (error) console.error('[client-email] email_logs insert failed:', error)
  } catch (err) {
    console.error('[client-email] email_logs insert threw:', err)
  }
}

// Point de passage unique des emails client. Resout un fil, choisit la boite
// (acteur -> commercial assigne -> aucune), envoie via Gmail si une boite pilote
// existe et GMAIL_SENDING_ENABLED est ON, sinon Resend. Chaque envoi est
// materialise dans email_messages + email_logs. Fallback Resend sur erreur franche.
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

  // 1. Fil (best-effort : un echec degrade en envoi sans threading).
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

  // 2. Boite d'envoi + tentative Gmail.
  const mailbox = await resolveSenderMailbox({
    actorUserId: params.actorUserId ?? null,
    bookingId: params.bookingId ?? null,
  })

  if (mailbox && isGmailSendingEnabled()) {
    const client = await gmailClient(mailbox.userId)
    if (client) {
      // In-Reply-To/References = seulement le dernier message (phase 2). Pas la
      // chaine References complete : le threading reste bon pour un aller-retour
      // lineaire (In-Reply-To + sujet), chaine complete reportee.
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

  // 3. Resend (defaut + fallback). Materialise dans le fil comme "parti hors fil".
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
