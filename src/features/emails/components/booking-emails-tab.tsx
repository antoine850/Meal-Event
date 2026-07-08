import { Loader2, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useGmailStatus } from '@/features/settings/hooks/use-gmail-account'
import { useEmailLogsByBooking } from '../hooks/use-email-logs'
import { useBookingEmailThread } from '../hooks/use-email-thread'
import { EmailReplyComposer } from './email-reply-composer'
import { EmailThreadView } from './email-thread-view'

const EMAIL_TYPE_LABELS: Record<string, string> = {
  quote_sent: 'Devis',
  deposit_invoice: "Facture d'acompte",
  deposit_invoice_resend: "Facture d'acompte (renvoi)",
  balance_invoice: 'Facture de solde',
  balance_invoice_resend: 'Facture de solde (renvoi)',
  payment_link: 'Lien de paiement',
  payment_reminder: 'Relance de paiement',
  credit_note: 'Avoir',
  manual_reply: 'Réponse',
}

export function BookingEmailsTab({
  bookingId,
  contactEmail,
}: {
  bookingId: string
  contactEmail?: string | null
}) {
  const { data: logs = [], isLoading: logsLoading } =
    useEmailLogsByBooking(bookingId)
  const { data: threadData, isLoading: threadLoading } =
    useBookingEmailThread(bookingId)
  const { data: gmailStatus } = useGmailStatus()

  const messages = threadData?.messages ?? []
  const isLoading = logsLoading || threadLoading

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>Emails</h3>
        <Badge variant='secondary'>
          {messages.length || logs.length} email
          {(messages.length || logs.length) > 1 ? 's' : ''}
        </Badge>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className='flex items-center justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </CardContent>
        </Card>
      ) : (
        <>
          {messages.length > 0 ? (
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
                  Les échanges avec le client apparaîtront ici.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Zone de reponse : uniquement quand l'integration Gmail est active
              (les reponses clients ne remontent pas sans polling). */}
          {gmailStatus?.integration_enabled && (
            <EmailReplyComposer bookingId={bookingId} />
          )}

          {logs.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className='text-sm text-muted-foreground underline-offset-4 hover:underline'>
                Journal des envois ({logs.length})
              </CollapsibleTrigger>
              <CollapsibleContent className='mt-2'>
                <Card>
                  <CardContent className='divide-y py-2'>
                    {logs.map((log) => (
                      <div key={log.id} className='flex items-start gap-3 py-3'>
                        <Mail className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                        <div className='min-w-0 flex-1'>
                          <div className='flex items-center gap-2'>
                            <span className='text-sm font-medium'>
                              {EMAIL_TYPE_LABELS[log.email_type] ||
                                log.email_type}
                            </span>
                            {log.status === 'failed' ? (
                              <Badge
                                variant='destructive'
                                className='h-5 px-1.5 text-[10px]'
                              >
                                Échec
                              </Badge>
                            ) : (
                              <Badge
                                variant='secondary'
                                className='h-5 px-1.5 text-[10px]'
                              >
                                Envoyé
                              </Badge>
                            )}
                          </div>
                          {log.subject && (
                            <p className='truncate text-sm text-muted-foreground'>
                              {log.subject}
                            </p>
                          )}
                          <p className='text-xs text-muted-foreground'>
                            À {log.recipient_email}
                            {log.sent_at &&
                              ` · ${new Date(log.sent_at).toLocaleString(
                                'fr-FR',
                                {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                }
                              )}`}
                          </p>
                          {log.status === 'failed' && log.error_message && (
                            <p className='mt-1 text-xs text-destructive'>
                              {log.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  )
}
