import DOMPurify from 'dompurify'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { EmailMessage } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

// Gmail renvoie snippet (et parfois body_text) avec entites HTML echappees
// (&#39; garanti en francais) : on decode au rendu, pas en base.
function decodeEntities(s: string): string {
  const doc = new DOMParser().parseFromString(s, 'text/html')
  return doc.documentElement.textContent ?? s
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function MessageBody({ message }: { message: EmailMessage }) {
  if (message.body_html) {
    // FORBID style : une balise <style> d'un email hostile s'appliquerait a
    // toute la page ; contain:paint clippe aussi les position:fixed du corps.
    const safeHtml = DOMPurify.sanitize(message.body_html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style'],
    })
    return (
      <div
        className='max-h-96 overflow-auto text-sm [contain:paint] [&_a]:text-primary [&_a]:underline'
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    )
  }
  const text =
    message.body_text ??
    (message.snippet ? decodeEntities(message.snippet) : '')
  return <p className='text-sm whitespace-pre-wrap'>{text}</p>
}

function MessageCard({
  message,
  contactEmail,
}: {
  message: EmailMessage
  contactEmail?: string | null
}) {
  const inbound = message.direction === 'inbound'
  const otherAddress =
    inbound &&
    !!contactEmail &&
    !!message.from_email &&
    message.from_email.toLowerCase() !== contactEmail.toLowerCase()

  return (
    <div
      className={
        inbound
          ? 'rounded-lg border bg-muted/40 p-3'
          : 'rounded-lg border bg-background p-3'
      }
    >
      <div className='mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
        {inbound ? (
          <ArrowDownLeft className='h-3.5 w-3.5 text-emerald-600' />
        ) : (
          <ArrowUpRight className='h-3.5 w-3.5' />
        )}
        <span className='font-medium text-foreground'>
          {inbound ? (message.from_email ?? 'Client') : 'Vous'}
        </span>
        {otherAddress && (
          <Badge variant='outline' className='h-5 px-1.5 text-[10px]'>
            Autre adresse
          </Badge>
        )}
        <span>{formatDate(message.sent_at)}</span>
      </div>
      <MessageBody message={message} />
    </div>
  )
}

export function EmailThreadView({
  subject,
  messages,
  contactEmail,
}: {
  subject: string | null
  messages: EmailMessage[]
  contactEmail?: string | null
}) {
  return (
    <Card>
      <CardContent className='space-y-3 py-4'>
        {subject && <p className='text-sm font-semibold'>{subject}</p>}
        {messages.map((m) => (
          <MessageCard key={m.id} message={m} contactEmail={contactEmail} />
        ))}
      </CardContent>
    </Card>
  )
}
