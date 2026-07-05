import { Loader2, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useEmailLogsByBooking } from '../hooks/use-email-logs'

const EMAIL_TYPE_LABELS: Record<string, string> = {
  quote_sent: 'Devis',
  deposit_invoice: "Facture d'acompte",
  deposit_invoice_resend: "Facture d'acompte (renvoi)",
  balance_invoice: 'Facture de solde',
  balance_invoice_resend: 'Facture de solde (renvoi)',
  payment_link: 'Lien de paiement',
}

export function BookingEmailsTab({ bookingId }: { bookingId: string }) {
  const { data: logs = [], isLoading } = useEmailLogsByBooking(bookingId)

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>Emails envoyés</h3>
        <Badge variant='secondary'>
          {logs.length} email{logs.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className='flex items-center justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className='py-8 text-center text-muted-foreground'>
            <Mail className='mx-auto mb-2 h-8 w-8 opacity-50' />
            <p className='text-sm'>Aucun email envoyé.</p>
            <p className='mt-1 text-xs'>
              Les devis et factures envoyés au client apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className='divide-y py-2'>
            {logs.map((log) => (
              <div key={log.id} className='flex items-start gap-3 py-3'>
                <Mail className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm font-medium'>
                      {EMAIL_TYPE_LABELS[log.email_type] || log.email_type}
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
                      ` · ${new Date(log.sent_at).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}`}
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
      )}
    </div>
  )
}
