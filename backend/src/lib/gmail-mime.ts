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

// MIME RFC 2822 encode base64url pour gmail.users.messages.send({ requestBody: { raw } }).
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

// Sujet du fil fige au 1er message, "Re:" ensuite (idempotent, insensible a la casse).
export function toReplySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`
}

// Message-ID RFC 2822 (entre chevrons), genere par nous a l'envoi et stocke pour
// alimenter In-Reply-To/References des reponses. Le gmail_message_id de l'API ne
// sert PAS au threading cote client.
export function generateRfcMessageId(domain: string): string {
  return `<${crypto.randomUUID()}@${domain}>`
}

// Classe une erreur d'envoi Gmail pour decider du fallback. googleapis remonte un
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
