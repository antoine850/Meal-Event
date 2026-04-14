import { useMemo, useRef } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { Quote, QuoteItem, Payment } from '@/lib/supabase/types'
import type { BookingWithRelations } from '../hooks/use-bookings'
import {
  computeVatBreakdown,
  formatBookingId,
  getActiveQuote,
  getPaidDeposits,
  getRemainingBalance,
} from '../lib/booking-totals'
import { FicheFonctionPdfButton } from './fiche-fonction-pdf-button'

type QuoteWithItems = Quote & { quote_items?: QuoteItem[] }

type Props = {
  booking: BookingWithRelations
  quotes: Quote[]
  payments: Payment[]
  spaceName?: string | null
}

const DASH = '—'

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return DASH
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatHorairesGlobal(
  eventDate: string | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined
): string {
  if (!eventDate) return DASH
  try {
    const d = new Date(eventDate)
    const dateStr = format(d, 'EEEE d MMM yyyy', { locale: fr })
    const start = (startTime || '').slice(0, 5)
    const end = (endTime || '').slice(0, 5)
    if (start && end) return `${dateStr} – ${start}–${end}`
    if (start) return `${dateStr} – ${start}`
    return dateStr
  } catch {
    return String(eventDate)
  }
}

function capitalize(s: string | null | undefined): string {
  if (!s) return DASH
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function paymentStatusLabel(status: string | null | undefined): {
  label: string
  variant: 'default' | 'secondary' | 'outline'
} {
  if (status === 'paid' || status === 'completed') {
    return { label: 'Payé', variant: 'default' }
  }
  return { label: 'En attente', variant: 'secondary' }
}

export function FicheFonction({ booking, quotes, payments, spaceName }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  const activeQuote = useMemo(
    () => getActiveQuote(quotes) as QuoteWithItems | null,
    [quotes]
  )
  const items: QuoteItem[] = useMemo(
    () => activeQuote?.quote_items || [],
    [activeQuote]
  )
  const totals = useMemo(() => computeVatBreakdown(items), [items])

  const paidDeposits = useMemo(() => getPaidDeposits(payments), [payments])

  // Quote number lookup by quote_id for acomptes
  const quoteNumberById = useMemo(() => {
    const map = new Map<string, string>()
    for (const q of quotes) {
      if (q.id && q.quote_number) map.set(q.id, q.quote_number)
    }
    return map
  }, [quotes])

  const remainingTtc = useMemo(
    () =>
      activeQuote?.total_ttc != null
        ? getRemainingBalance(activeQuote.total_ttc || 0, payments)
        : 0,
    [activeQuote, payments]
  )

  // Weighted VAT proration for "Reste" line:
  // We know the TTC remainder. We split it across VAT buckets using the
  // active quote's TVA ratio (vat10 share vs vat20 share vs untaxed).
  const remainingVatBreakdown = useMemo(() => {
    if (!activeQuote || (activeQuote.total_ttc || 0) <= 0) {
      return { ht: 0, vat10: 0, vat20: 0, ttc: 0 }
    }
    const ratio = remainingTtc / (activeQuote.total_ttc || 1)
    return {
      ht: totals.totalHt * ratio,
      vat10: totals.vat10 * ratio,
      vat20: totals.vat20 * ratio,
      ttc: remainingTtc,
    }
  }, [activeQuote, remainingTtc, totals])

  // Contact "sur place" formatted block
  const contactSurPlaceLines: string[] = []
  if (booking.contact_sur_place_nom) {
    contactSurPlaceLines.push(`Contact sur place : ${booking.contact_sur_place_nom}`)
  }
  if (booking.contact_sur_place_tel) {
    contactSurPlaceLines.push(`Tél : ${booking.contact_sur_place_tel}`)
  }
  if (booking.contact_sur_place_societe) {
    contactSurPlaceLines.push(`Société : ${booking.contact_sur_place_societe}`)
  }

  const commentairesText = [
    booking.commentaires || '',
    contactSurPlaceLines.join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim()

  const contactName = booking.contact
    ? [booking.contact.first_name, booking.contact.last_name]
        .filter(Boolean)
        .join(' ')
    : ''

  return (
    <div className='space-y-4'>
      {/* Header with print button (not inside the PDF area) */}
      <div className='flex items-start justify-between gap-4'>
        <h2 className='text-lg font-semibold'>Récapitulatif d&apos;évènements</h2>
        <FicheFonctionPdfButton bookingId={booking.id} printRef={printRef} />
      </div>

      {/* Printable area */}
      <div
        ref={printRef}
        id='fiche-fonction-content'
        className='space-y-4 bg-muted/30 p-4 sm:p-6 rounded-lg print:bg-white print:p-0'
      >
        {/* Row 1: Nom de l'établissement + Identifiant */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <Card className='print:shadow-none print:border-0 print:bg-white'>
            <CardContent className='pt-4 pb-4 space-y-1'>
              <div className='text-xs text-muted-foreground uppercase tracking-wider'>
                Nom de l&apos;établissement
              </div>
              <div className='text-sm font-medium'>
                {booking.restaurant?.name || DASH}
              </div>
            </CardContent>
          </Card>
          <Card className='print:shadow-none print:border-0 print:bg-white'>
            <CardContent className='pt-4 pb-4 space-y-1'>
              <div className='text-xs text-muted-foreground uppercase tracking-wider'>
                Identifiant
              </div>
              <div className='text-sm font-mono font-medium'>
                {formatBookingId(booking.id)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Horaires */}
        <Card className='print:shadow-none print:border-0 print:bg-white'>
          <CardContent className='pt-4 pb-4 space-y-1'>
            <div className='text-xs text-muted-foreground uppercase tracking-wider'>
              Horaires (Global)
            </div>
            <div className='text-sm font-medium'>
              {formatHorairesGlobal(
                booking.event_date,
                booking.start_time,
                booking.end_time
              )}
            </div>
          </CardContent>
        </Card>

        {/* Row 3: Compte / Contact / Coordonnées */}
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
          <Card className='print:shadow-none print:border-0 print:bg-white'>
            <CardContent className='pt-4 pb-4 space-y-1'>
              <div className='text-xs text-muted-foreground uppercase tracking-wider'>
                Nom du compte
              </div>
              <div className='text-sm font-medium'>
                {booking.contact?.company?.name || DASH}
              </div>
            </CardContent>
          </Card>
          <Card className='print:shadow-none print:border-0 print:bg-white'>
            <CardContent className='pt-4 pb-4 space-y-1'>
              <div className='text-xs text-muted-foreground uppercase tracking-wider'>
                Contact
              </div>
              <div className='text-sm font-medium'>{contactName || DASH}</div>
            </CardContent>
          </Card>
          <Card className='print:shadow-none print:border-0 print:bg-white'>
            <CardContent className='pt-4 pb-4 space-y-1'>
              <div className='text-xs text-muted-foreground uppercase tracking-wider'>
                Coordonnées
              </div>
              <div className='text-sm font-medium space-y-0.5'>
                <div>{booking.contact?.phone || DASH}</div>
                <div className='text-muted-foreground'>
                  {booking.contact?.email || DASH}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Prestations / Total / Acomptes / Reste */}
        {!activeQuote ? (
          <Card className='print:shadow-none print:border-0 print:bg-white'>
            <CardContent className='pt-6 pb-6 text-center text-sm text-muted-foreground'>
              Aucun devis associé
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Prestations */}
            <Card className='print:shadow-none print:border-0 print:bg-white'>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
                  Prestations
                </CardTitle>
              </CardHeader>
              <CardContent className='pb-4'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead className='text-right'>Qté</TableHead>
                      <TableHead className='text-right'>Prix U HT</TableHead>
                      <TableHead className='text-right'>TVA</TableHead>
                      <TableHead className='text-right'>Prix U TTC</TableHead>
                      <TableHead className='text-right'>Total HT</TableHead>
                      <TableHead className='text-right'>Total TTC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className='text-center text-muted-foreground text-sm'
                        >
                          Aucune prestation
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => {
                        const tvaRate = item.tva_rate || 0
                        const unitTtc =
                          (item.unit_price || 0) * (1 + tvaRate / 100)
                        return (
                          <TableRow key={item.id}>
                            <TableCell className='font-medium'>
                              {item.name}
                            </TableCell>
                            <TableCell className='text-right'>
                              {item.quantity ?? DASH}
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatCurrency(item.unit_price)}
                            </TableCell>
                            <TableCell className='text-right'>
                              {tvaRate}%
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatCurrency(unitTtc)}
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatCurrency(item.total_ht)}
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatCurrency(item.total_ttc)}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Total */}
            <Card className='print:shadow-none print:border-0 print:bg-white'>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent className='pb-4'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='text-right'>Total HT</TableHead>
                      <TableHead className='text-right'>TVA 10%</TableHead>
                      <TableHead className='text-right'>TVA 20%</TableHead>
                      <TableHead className='text-right'>Total TTC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className='text-right font-medium'>
                        {formatCurrency(totals.totalHt)}
                      </TableCell>
                      <TableCell className='text-right font-medium'>
                        {formatCurrency(totals.vat10)}
                      </TableCell>
                      <TableCell className='text-right font-medium'>
                        {formatCurrency(totals.vat20)}
                      </TableCell>
                      <TableCell className='text-right font-semibold'>
                        {formatCurrency(totals.totalTtc)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Acomptes */}
            <Card className='print:shadow-none print:border-0 print:bg-white'>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
                  Acomptes
                </CardTitle>
              </CardHeader>
              <CardContent className='pb-4'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Facture</TableHead>
                      <TableHead className='text-right'>Total HT</TableHead>
                      <TableHead className='text-right'>TVA 10%</TableHead>
                      <TableHead className='text-right'>TVA 20%</TableHead>
                      <TableHead className='text-right'>Total TTC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paidDeposits.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className='text-center text-muted-foreground text-sm'
                        >
                          Aucun acompte encaissé
                        </TableCell>
                      </TableRow>
                    ) : (
                      paidDeposits.map((p) => {
                        const statusInfo = paymentStatusLabel(p.status)
                        const quoteNum = p.quote_id
                          ? quoteNumberById.get(p.quote_id) || DASH
                          : DASH
                        return (
                          <TableRow key={p.id}>
                            <TableCell className='font-medium'>
                              {capitalize(p.payment_modality) || 'Acompte'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusInfo.variant}>
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>{quoteNum}</TableCell>
                            <TableCell className='text-right text-muted-foreground'>
                              {DASH}
                            </TableCell>
                            <TableCell className='text-right text-muted-foreground'>
                              {DASH}
                            </TableCell>
                            <TableCell className='text-right text-muted-foreground'>
                              {DASH}
                            </TableCell>
                            <TableCell className='text-right font-medium'>
                              {formatCurrency(p.amount)}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Reste */}
            <Card className='print:shadow-none print:border-0 print:bg-white'>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
                  Reste
                </CardTitle>
              </CardHeader>
              <CardContent className='pb-4'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Facture</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className='text-right'>Total HT</TableHead>
                      <TableHead className='text-right'>TVA 10%</TableHead>
                      <TableHead className='text-right'>TVA 20%</TableHead>
                      <TableHead className='text-right'>Total TTC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className='font-medium'>
                        {activeQuote.quote_number || DASH}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            remainingTtc > 0 ? 'secondary' : 'default'
                          }
                        >
                          {remainingTtc > 0 ? 'En attente' : 'Payé'}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-right'>
                        {formatCurrency(remainingVatBreakdown.ht)}
                      </TableCell>
                      <TableCell className='text-right'>
                        {formatCurrency(remainingVatBreakdown.vat10)}
                      </TableCell>
                      <TableCell className='text-right'>
                        {formatCurrency(remainingVatBreakdown.vat20)}
                      </TableCell>
                      <TableCell className='text-right font-semibold'>
                        {formatCurrency(remainingVatBreakdown.ttc)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Commentaires facturation */}
        <Card className='print:shadow-none print:border-0 print:bg-white'>
          <CardContent className='pt-4 pb-4 space-y-1'>
            <div className='text-xs text-muted-foreground uppercase tracking-wider'>
              Commentaires facturation
            </div>
            <p className='text-sm font-medium whitespace-pre-wrap'>
              {booking.internal_notes || DASH}
            </p>
          </CardContent>
        </Card>

        {/* Espace + Nombre de personnes */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <Card className='print:shadow-none print:border-0 print:bg-white'>
            <CardContent className='pt-4 pb-4 space-y-1'>
              <div className='text-xs text-muted-foreground uppercase tracking-wider'>
                Espace
              </div>
              <div className='text-sm font-medium'>
                {spaceName || DASH}
              </div>
            </CardContent>
          </Card>
          <Card className='print:shadow-none print:border-0 print:bg-white'>
            <CardContent className='pt-4 pb-4 space-y-1'>
              <div className='text-xs text-muted-foreground uppercase tracking-wider'>
                Nombre de personnes
              </div>
              <div className='text-sm font-medium'>
                {booking.guests_count ?? DASH}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mise en place */}
        <Card className='print:shadow-none print:border-0 print:bg-white'>
          <CardContent className='pt-4 pb-4 space-y-1'>
            <div className='text-xs text-muted-foreground uppercase tracking-wider'>
              Mise en place
            </div>
            <p className='text-sm font-medium whitespace-pre-wrap'>
              {booking.mise_en_place || DASH}
            </p>
          </CardContent>
        </Card>

        {/* Menu */}
        <Card className='print:shadow-none print:border-0 print:bg-white'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
              Menu
            </CardTitle>
          </CardHeader>
          <CardContent className='pb-4 space-y-4'>
            {[
              { label: 'Apéritif', value: booking.menu_aperitif },
              { label: 'Entrée', value: booking.menu_entree },
              { label: 'Plat', value: booking.menu_plat },
              { label: 'Dessert', value: booking.menu_dessert },
              { label: 'Boissons', value: booking.menu_boissons },
            ].map((m) => (
              <div key={m.label} className='space-y-1'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>
                  {m.label}
                </div>
                <p className='text-sm font-medium whitespace-pre-wrap'>
                  {m.value || DASH}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Allergies et régimes */}
        <Card className='print:shadow-none print:border-0 print:bg-white'>
          <CardContent className='pt-4 pb-4 space-y-1'>
            <div className='text-xs text-muted-foreground uppercase tracking-wider'>
              Allergies et Régimes
            </div>
            <p className='text-sm font-medium whitespace-pre-wrap'>
              {booking.allergies_regimes || DASH}
            </p>
          </CardContent>
        </Card>

        {/* Commentaires */}
        <Card className='print:shadow-none print:border-0 print:bg-white'>
          <CardContent className='pt-4 pb-4 space-y-1'>
            <div className='text-xs text-muted-foreground uppercase tracking-wider'>
              Commentaires
            </div>
            <p className='text-sm font-medium whitespace-pre-wrap'>
              {commentairesText || DASH}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
