import { Fragment, useMemo, useRef } from 'react'
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
  getRemainingBalance,
} from '../lib/booking-totals'
import { useOrganizationUsers } from '@/features/contacts/hooks/use-contacts'
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

function formatBool(v: boolean | null | undefined): string {
  if (v === true) return 'Oui'
  if (v === false) return 'Non'
  return DASH
}

function formatDate(v: string | null | undefined): string {
  if (!v) return DASH
  try {
    return format(new Date(v), 'd MMM yyyy', { locale: fr })
  } catch {
    return v
  }
}

function formatNumber(v: number | null | undefined, suffix = ''): string {
  if (v == null || !Number.isFinite(v)) return DASH
  return `${new Intl.NumberFormat('fr-FR').format(v)}${suffix}`
}

function ItemsTable({ title, items }: { title: string; items: QuoteItem[] }) {
  return (
    <Card className='print:shadow-none print:border-0 print:bg-white'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className='pb-4'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead className='text-right'>Qté</TableHead>
              <TableHead className='text-right'>TVA</TableHead>
              <TableHead className='text-right'>Prix U HT</TableHead>
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
                  Aucune ligne
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const tvaRate = item.tva_rate || 0
                const unitTtc = (item.unit_price || 0) * (1 + tvaRate / 100)
                return (
                  <Fragment key={item.id}>
                    <TableRow>
                      <TableCell className='font-medium'>{item.name}</TableCell>
                      <TableCell className='text-right'>{item.quantity ?? DASH}</TableCell>
                      <TableCell className='text-right'>{tvaRate.toFixed(2)}%</TableCell>
                      <TableCell className='text-right'>{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className='text-right'>{formatCurrency(unitTtc)}</TableCell>
                      <TableCell className='text-right'>{formatCurrency(item.total_ht)}</TableCell>
                      <TableCell className='text-right'>{formatCurrency(item.total_ttc)}</TableCell>
                    </TableRow>
                    {item.description && (
                      <TableRow className='border-t-0'>
                        <TableCell
                          colSpan={7}
                          className='pt-0 text-xs text-muted-foreground whitespace-pre-wrap'
                        >
                          {item.description}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function FicheFonction({ booking, quotes, payments, spaceName }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const { data: orgUsers = [] } = useOrganizationUsers()

  const activeQuote = useMemo(
    () => getActiveQuote(quotes) as QuoteWithItems | null,
    [quotes]
  )
  const items: QuoteItem[] = useMemo(
    () => activeQuote?.quote_items || [],
    [activeQuote]
  )
  const totals = useMemo(() => computeVatBreakdown(items), [items])

  // Old CRM split: Food = TVA 10% (restauration sur place), Prestations = autres
  // (boissons, services). Match the legacy 2-table layout.
  const foodItems = useMemo(
    () => items.filter((i) => i.tva_rate === 10),
    [items]
  )
  const prestationItems = useMemo(
    () => items.filter((i) => i.tva_rate !== 10),
    [items]
  )

  // Show all deposits (paid + pending) — old CRM displayed pending acomptes too.
  const allDeposits = useMemo(
    () =>
      payments.filter(
        (p) => p.payment_modality === 'acompte' || p.payment_type === 'deposit'
      ),
    [payments]
  )

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

  // Combine all free-text comment fields so the export carries everything the
  // booking form captures (commentaires, instructions spéciales, contact sur place).
  const commentairesBlocks: string[] = []
  if (booking.commentaires) commentairesBlocks.push(booking.commentaires)
  if (booking.instructions_speciales) {
    commentairesBlocks.push(`Instructions spéciales :\n${booking.instructions_speciales}`)
  }
  if (contactSurPlaceLines.length > 0) {
    commentairesBlocks.push(contactSurPlaceLines.join('\n'))
  }

  const commentairesText = commentairesBlocks.join('\n\n').trim()

  const contactName = booking.contact
    ? [booking.contact.first_name, booking.contact.last_name]
        .filter(Boolean)
        .join(' ')
    : ''

  // Resolve assigned commercial names from IDs
  const assignedNames = useMemo(() => {
    const ids = booking.assigned_user_ids || []
    if (ids.length === 0) return DASH
    const names = orgUsers
      .filter((u) => ids.includes(u.id))
      .map((u) => `${u.first_name} ${u.last_name}`.trim())
      .filter(Boolean)
    return names.length > 0 ? names.join(', ') : DASH
  }, [booking.assigned_user_ids, orgUsers])

  const printedAt = format(new Date(), "EEEE d MMM yyyy 'à' HH:mm", { locale: fr })

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
        className='space-y-3 bg-muted/30 p-4 sm:p-6 rounded-lg print:bg-white print:p-0'
      >
        {/* Print header (only visible inside the PDF area) */}
        <div className='flex items-baseline justify-between border-b pb-2'>
          <h3 className='text-base font-semibold'>Récapitulatif d&apos;évènements</h3>
          <span className='text-xs text-muted-foreground'>
            Imprimé le : {printedAt}
          </span>
        </div>
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

        {/* Compte + Contact + Coordonnées (3 cols, matches legacy CRM) */}
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
                <div className='text-muted-foreground break-all text-xs'>
                  {booking.contact?.email || DASH}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Prestations + Food + Total + Acomptes + Reste */}
        {!activeQuote ? (
          <Card className='print:shadow-none print:border-0 print:bg-white'>
            <CardContent className='pt-6 pb-6 text-center text-sm text-muted-foreground'>
              Aucun devis associé
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Prestations (TVA != 10%) — boissons / services */}
            {prestationItems.length > 0 && (
              <ItemsTable title='Prestations' items={prestationItems} />
            )}

            {/* Food (TVA = 10%) — restauration */}
            {foodItems.length > 0 && (
              <ItemsTable title='Food' items={foodItems} />
            )}

            {/* Fallback when no items split worked */}
            {prestationItems.length === 0 && foodItems.length === 0 && (
              <ItemsTable title='Prestations' items={[]} />
            )}

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

            {/* Acomptes — pending + paid (matches legacy CRM) */}
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
                      <TableHead>Statut</TableHead>
                      <TableHead>Facture</TableHead>
                      <TableHead className='text-right'>Total HT</TableHead>
                      <TableHead className='text-right'>TVA 10%</TableHead>
                      <TableHead className='text-right'>TVA 20%</TableHead>
                      <TableHead className='text-right'>Total TTC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allDeposits.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className='text-center text-muted-foreground text-sm'
                        >
                          Aucun acompte
                        </TableCell>
                      </TableRow>
                    ) : (
                      allDeposits.map((p) => {
                        const isPaid = p.status === 'paid' || p.status === 'completed'
                        const totalRatio = (activeQuote.total_ttc || 0) > 0
                          ? (p.amount || 0) / (activeQuote.total_ttc || 1)
                          : 0
                        const ht = totals.totalHt * totalRatio
                        const v10 = totals.vat10 * totalRatio
                        const v20 = totals.vat20 * totalRatio
                        const quoteNum = p.quote_id
                          ? quoteNumberById.get(p.quote_id) || DASH
                          : DASH
                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              <Badge variant={isPaid ? 'default' : 'secondary'}>
                                {isPaid ? 'Payé' : 'En attente'}
                              </Badge>
                            </TableCell>
                            <TableCell className='font-mono text-xs'>{quoteNum}</TableCell>
                            <TableCell className='text-right'>{formatCurrency(ht)}</TableCell>
                            <TableCell className='text-right'>{formatCurrency(v10)}</TableCell>
                            <TableCell className='text-right'>{formatCurrency(v20)}</TableCell>
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

            {/* Reste — 4 colonnes (matches legacy CRM, no Facture/Statut) */}
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
                      <TableHead className='text-right'>Total HT</TableHead>
                      <TableHead className='text-right'>TVA 10%</TableHead>
                      <TableHead className='text-right'>TVA 20%</TableHead>
                      <TableHead className='text-right'>Total TTC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
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

        {/* Type & format de l'événement */}
        <Card className='print:shadow-none print:border-0 print:bg-white'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
              Type & format
            </CardTitle>
          </CardHeader>
          <CardContent className='pb-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm'>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Type d&apos;événement</div>
                <div className='font-medium'>{booking.event_type || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Type de réservation</div>
                <div className='font-medium'>{booking.reservation_type || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Privatif</div>
                <div className='font-medium'>{formatBool(booking.is_privatif)}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Format souhaité</div>
                <div className='font-medium'>{booking.format_souhaite || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Heure préférée client</div>
                <div className='font-medium'>{booking.client_preferred_time || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Date flexible</div>
                <div className='font-medium'>{formatBool(booking.is_date_flexible)}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Restaurant flexible</div>
                <div className='font-medium'>{formatBool(booking.is_restaurant_flexible)}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Table bloquée</div>
                <div className='font-medium'>{formatBool(booking.is_table_blocked)}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Prestataire externe</div>
                <div className='font-medium'>{formatBool(booking.has_extra_provider)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Déroulé de l'événement */}
        <Card className='print:shadow-none print:border-0 print:bg-white'>
          <CardContent className='pt-4 pb-4 space-y-1'>
            <div className='text-xs text-muted-foreground uppercase tracking-wider'>
              Déroulé
            </div>
            <p className='text-sm font-medium whitespace-pre-wrap'>
              {booking.deroulement || DASH}
            </p>
          </CardContent>
        </Card>

        {/* Menu — 2 cols: food list / boissons (matches legacy CRM) */}
        <Card className='print:shadow-none print:border-0 print:bg-white'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
              Menu
            </CardTitle>
          </CardHeader>
          <CardContent className='pb-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='space-y-3'>
                {[
                  { label: 'Apéritif', value: booking.menu_aperitif },
                  { label: 'Entrée', value: booking.menu_entree },
                  { label: 'Plat', value: booking.menu_plat },
                  { label: 'Dessert', value: booking.menu_dessert },
                ].map((m) => (
                  <div key={m.label} className='space-y-0.5'>
                    <div className='text-xs text-muted-foreground uppercase tracking-wider'>
                      {m.label}
                    </div>
                    <p className='text-sm font-medium whitespace-pre-wrap'>
                      {m.value || DASH}
                    </p>
                  </div>
                ))}
              </div>
              <div className='space-y-0.5 sm:border-l sm:pl-4'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>
                  Boissons
                </div>
                <p className='text-sm font-medium whitespace-pre-wrap'>
                  {booking.menu_boissons || DASH}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Allergies et régimes + Prestations souhaitées */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
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
          <Card className='print:shadow-none print:border-0 print:bg-white'>
            <CardContent className='pt-4 pb-4 space-y-1'>
              <div className='text-xs text-muted-foreground uppercase tracking-wider'>
                Prestations souhaitées
              </div>
              <p className='text-sm font-medium whitespace-pre-wrap'>
                {booking.prestations_souhaitees || DASH}
              </p>
            </CardContent>
          </Card>
        </div>

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

        {/* Suivi commercial */}
        <Card className='print:shadow-none print:border-0 print:bg-white'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
              Suivi commercial
            </CardTitle>
          </CardHeader>
          <CardContent className='pb-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm'>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Commerciaux assignés</div>
                <div className='font-medium'>{assignedNames}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Source</div>
                <div className='font-medium'>{booking.source || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Occasion</div>
                <div className='font-medium'>{booking.occasion || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Option</div>
                <div className='font-medium'>{booking.option || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Relance</div>
                <div className='font-medium'>{booking.relance || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Date signature devis</div>
                <div className='font-medium'>{formatDate(booking.date_signature_devis)}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-xs text-muted-foreground uppercase tracking-wider'>Budget client</div>
                <div className='font-medium'>{formatNumber(booking.budget_client, ' €')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
