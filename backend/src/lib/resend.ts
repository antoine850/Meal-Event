import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || '')

const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@mealevent.com'
const facturationEmail = 'facturation@pasparisien.com'

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType?: string
  }>
}

export async function sendEmail(options: SendEmailOptions): Promise<{ id: string }> {
  // Build reply-to list: always include facturation email, plus optional commercial email
  const replyToList = options.replyTo 
    ? [options.replyTo, facturationEmail]
    : [facturationEmail]

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: options.to,
    subject: options.subject,
    html: options.html,
    reply_to: replyToList,
    attachments: options.attachments?.map(a => ({
      filename: a.filename,
      content: a.content,
      content_type: a.contentType || 'application/pdf',
    })),
  })

  if (error) {
    console.error('Resend error:', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }

  return { id: data?.id || '' }
}
