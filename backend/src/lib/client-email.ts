import { sendEmail, SendEmailOptions } from './resend.js'
import { supabase } from './supabase.js'

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
  quoteId?: string | null
  emailType: string
  to: string
  subject: string
  html: string
  replyTo?: string
  facturationEmail?: string
  attachments?: SendEmailOptions['attachments']
}

// Point de passage unique des emails client : envoi Resend + journalisation
// email_logs de chaque tentative (sent/failed). Un échec d'insert ne doit
// jamais faire échouer un envoi réussi (best-effort).
export async function sendClientEmail(
  params: ClientEmailParams
): Promise<{ id: string }> {
  const logRow = {
    organization_id: params.organizationId,
    quote_id: params.quoteId || null,
    booking_id: params.bookingId || null,
    email_type: params.emailType,
    recipient_email: params.to,
    reply_to_email: params.replyTo || null,
    subject: params.subject,
  }

  try {
    const result = await sendEmail({
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
      facturationEmail: params.facturationEmail,
      attachments: params.attachments,
    })

    const { error } = await supabase.from('email_logs').insert({
      ...logRow,
      resend_message_id: result.id,
      status: 'sent',
    })
    if (error) console.error('[client-email] email_logs insert failed:', error)

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const { error } = await supabase.from('email_logs').insert({
      ...logRow,
      status: 'failed',
      error_message: message,
    })
    if (error) console.error('[client-email] email_logs insert failed:', error)
    throw err
  }
}
