import { useEffect } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useContactEmailThread } from '../hooks/use-email-thread'
import {
  useContactThreadMeta,
  useMarkThreadRead,
} from '../hooks/use-thread-unread'
import { EmailThreadView } from './email-thread-view'

// Fil contact-only (emails ponctuels hors evenement). Les fils des bookings
// du contact vivent sur chaque page evenement.
export function ContactEmailsTab({
  contactId,
  contactEmail,
}: {
  contactId: string
  contactEmail?: string | null
}) {
  const { data: threadData, isLoading } = useContactEmailThread(contactId)
  const { data: threadMeta } = useContactThreadMeta(contactId)
  const markRead = useMarkThreadRead()

  useEffect(() => {
    if (threadMeta?.id && threadMeta.unread) {
      markRead.mutate(threadMeta.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadMeta?.id, threadMeta?.unread])

  const messages = threadData?.messages ?? []

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>Emails</h3>
        <Badge variant='secondary'>
          {messages.length} email{messages.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className='flex items-center justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </CardContent>
        </Card>
      ) : messages.length > 0 ? (
        <EmailThreadView
          subject={threadData?.thread?.subject ?? null}
          messages={messages}
          contactEmail={contactEmail}
        />
      ) : (
        <Card>
          <CardContent className='py-8 text-center text-muted-foreground'>
            <Mail className='mx-auto mb-2 h-8 w-8 opacity-50' />
            <p className='text-sm'>Aucune conversation.</p>
            <p className='mt-1 text-xs'>
              Les emails envoyés depuis cette fiche (hors événement)
              apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
