import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import type { Quote, QuoteItem, Payment } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useOrganizationUsers } from '@/features/contacts/hooks/use-contacts'
import {
  type BookingWithRelations,
  useUpdateBooking,
} from '../hooks/use-bookings'
import {
  computeVatBreakdown,
  formatBookingId,
  getActiveQuote,
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

// Intl.NumberFormat('fr-FR') insère U+202F (NARROW NO-BREAK SPACE) comme
// séparateur de milliers ; html2canvas/jsPDF ne sait pas le rendre et
// l'affiche comme "/" dans le PDF. On normalise vers U+00A0 (NBSP).
function normalizeFrenchSpaces(s: string): string {
  return s.replace(/ /g, ' ')
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return DASH
  return normalizeFrenchSpaces(
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  )
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
  return `${normalizeFrenchSpaces(new Intl.NumberFormat('fr-FR').format(v))}${suffix}`
}

function ItemsTable({ title, items }: { title: string; items: QuoteItem[] }) {
  return (
    <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
      <CardHeader className='px-3 pt-0 pb-0'>
        <CardTitle className='text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className='px-3 pt-0 pb-0'>
        <table className='w-full text-xs' style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '38%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
          </colgroup>
          <thead>
            <tr className='border-b text-[10px] text-muted-foreground'>
              <th className='py-1 pr-2 text-left font-normal'>Titre</th>
              <th className='px-1 py-1 text-right font-normal'>Qté</th>
              <th className='px-1 py-1 text-right font-normal'>TVA</th>
              <th className='px-1 py-1 text-right font-normal'>Prix U HT</th>
              <th className='px-1 py-1 text-right font-normal'>Prix U TTC</th>
              <th className='px-1 py-1 text-right font-normal'>Total HT</th>
              <th className='py-1 pl-1 text-right font-normal'>Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className='py-2 text-center text-muted-foreground'
                >
                  Aucune ligne
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const tvaRate = item.tva_rate || 0
                const unitTtc = (item.unit_price || 0) * (1 + tvaRate / 100)
                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td className='py-1 pr-2 font-medium break-words'>
                        {item.name}
                      </td>
                      <td className='px-1 py-1 text-right'>
                        {item.quantity ?? DASH}
                      </td>
                      <td className='px-1 py-1 text-right'>
                        {tvaRate.toFixed(2)}%
                      </td>
                      <td className='px-1 py-1 text-right'>
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className='px-1 py-1 text-right'>
                        {formatCurrency(unitTtc)}
                      </td>
                      <td className='px-1 py-1 text-right'>
                        {formatCurrency(item.total_ht)}
                      </td>
                      <td className='py-1 pl-1 text-right'>
                        {formatCurrency(item.total_ttc)}
                      </td>
                    </tr>
                    {item.description && (
                      <tr>
                        <td
                          colSpan={7}
                          className='pb-1 text-[11px] whitespace-pre-wrap text-muted-foreground'
                        >
                          {item.description}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

export function FicheFonction({ booking, quotes, payments, spaceName }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const { data: orgUsers = [] } = useOrganizationUsers()
  const { mutate: updateBooking } = useUpdateBooking()

  // Édition inline du commentaire facturation : état local, save on blur,
  // resync si la valeur change côté DB (ex. autre tab/onglet édite le booking).
  const [billingNotes, setBillingNotes] = useState(booking.internal_notes || '')
  useEffect(() => {
    setBillingNotes(booking.internal_notes || '')
  }, [booking.internal_notes])

  const saveBillingNotes = () => {
    const next = billingNotes.trim() || null
    const current = booking.internal_notes || null
    if (next === current) return
    updateBooking({ id: booking.id, internal_notes: next } as never, {
      onError: () => toast.error('Erreur lors de la sauvegarde'),
    })
  }

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
    contactSurPlaceLines.push(
      `Contact sur place : ${booking.contact_sur_place_nom}`
    )
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
    commentairesBlocks.push(
      `Instructions spéciales :\n${booking.instructions_speciales}`
    )
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

  const printedAt = format(new Date(), "EEEE d MMM yyyy 'à' HH:mm", {
    locale: fr,
  })

  return (
    <div className='space-y-4'>
      {/* Header with print button (not inside the PDF area) */}
      <div className='flex items-start justify-between gap-4'>
        <h2 className='text-lg font-semibold'>
          Récapitulatif d&apos;évènements
        </h2>
        <FicheFonctionPdfButton bookingId={booking.id} printRef={printRef} />
      </div>

      {/* Printable area */}
      <div
        ref={printRef}
        id='fiche-fonction-content'
        className='space-y-1.5 rounded-lg bg-muted/30 p-3 sm:p-4 print:bg-white print:p-0'
      >
        {/* Print header (only visible inside the PDF area) */}
        <div className='flex items-baseline justify-between border-b pb-1'>
          <h3 className='text-sm font-semibold'>
            Récapitulatif d&apos;évènements
          </h3>
          <span className='text-[10px] text-muted-foreground'>
            Imprimé le : {printedAt}
          </span>
        </div>
        {/* Row 1: Nom de l'établissement + Identifiant */}
        <div className='grid grid-cols-1 gap-1.5 sm:grid-cols-2'>
          <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
            <CardContent className='space-y-0.5 px-3 py-0'>
              <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                Nom de l&apos;établissement
              </div>
              <div className='text-xs'>{booking.restaurant?.name || DASH}</div>
            </CardContent>
          </Card>
          <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
            <CardContent className='space-y-0.5 px-3 py-0'>
              <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                Identifiant
              </div>
              <div className='font-mono text-sm font-medium'>
                {formatBookingId(booking.id)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Horaires */}
        <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
          <CardContent className='space-y-0.5 px-3 py-0'>
            <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
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
        <div className='grid grid-cols-1 gap-1.5 sm:grid-cols-3'>
          <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
            <CardContent className='space-y-0.5 px-3 py-0'>
              <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                Nom du compte
              </div>
              <div className='text-xs'>
                {booking.contact?.company?.name || DASH}
              </div>
            </CardContent>
          </Card>
          <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
            <CardContent className='space-y-0.5 px-3 py-0'>
              <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                Contact
              </div>
              <div className='text-xs font-medium'>{contactName || DASH}</div>
            </CardContent>
          </Card>
          <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
            <CardContent className='space-y-0.5 px-3 py-0'>
              <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                Coordonnées
              </div>
              <div className='space-y-0.5 text-sm font-medium'>
                <div>{booking.contact?.phone || DASH}</div>
                <div className='text-xs break-all text-muted-foreground'>
                  {booking.contact?.email || DASH}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Prestations + Food + Total + Acomptes + Reste */}
        {!activeQuote ? (
          <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
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
            <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
              <CardHeader className='px-3 pt-0 pb-0'>
                <CardTitle className='text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'>
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent className='px-3 pt-0 pb-0'>
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
            <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
              <CardHeader className='px-3 pt-0 pb-0'>
                <CardTitle className='text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'>
                  Acomptes
                </CardTitle>
              </CardHeader>
              <CardContent className='px-3 pt-0 pb-0'>
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
                          className='text-center text-sm text-muted-foreground'
                        >
                          Aucun acompte
                        </TableCell>
                      </TableRow>
                    ) : (
                      allDeposits.map((p) => {
                        const isPaid =
                          p.status === 'paid' || p.status === 'completed'
                        const totalRatio =
                          (activeQuote.total_ttc || 0) > 0
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
                            <TableCell className='font-mono text-xs'>
                              {quoteNum}
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatCurrency(ht)}
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatCurrency(v10)}
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatCurrency(v20)}
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

            {/* Reste — 4 colonnes (matches legacy CRM, no Facture/Statut) */}
            <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
              <CardHeader className='px-3 pt-0 pb-0'>
                <CardTitle className='text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'>
                  Reste
                </CardTitle>
              </CardHeader>
              <CardContent className='px-3 pt-0 pb-0'>
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

        {/* Commentaires facturation — éditable inline (save on blur).
            En print, on remplace le Textarea par le texte brut pour rester
            propre à l'export PDF. */}
        <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
          <CardContent className='space-y-1 px-3 py-0'>
            <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
              Commentaires facturation
            </div>
            <Textarea
              value={billingNotes}
              onChange={(e) => setBillingNotes(e.target.value)}
              onBlur={saveBillingNotes}
              placeholder='Ajouter un commentaire de facturation…'
              className='min-h-[60px] resize-y border-dashed text-xs print:hidden'
            />
            <p className='hidden text-xs whitespace-pre-wrap print:block'>
              {booking.internal_notes || DASH}
            </p>
          </CardContent>
        </Card>

        {/* Espace + Nombre de personnes */}
        <div className='grid grid-cols-1 gap-1.5 sm:grid-cols-2'>
          <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
            <CardContent className='space-y-0.5 px-3 py-0'>
              <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                Espace
              </div>
              <div className='text-xs'>{spaceName || DASH}</div>
            </CardContent>
          </Card>
          <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
            <CardContent className='space-y-0.5 px-3 py-0'>
              <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                Nombre de personnes
              </div>
              <div className='text-xs'>{booking.guests_count ?? DASH}</div>
            </CardContent>
          </Card>
        </div>

        {/* Mise en place */}
        <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
          <CardContent className='space-y-0.5 px-3 py-0'>
            <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
              Mise en place
            </div>
            <p className='text-xs whitespace-pre-wrap'>
              {booking.mise_en_place || DASH}
            </p>
          </CardContent>
        </Card>

        {/* Déroulé de l'événement */}
        <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
          <CardContent className='space-y-0.5 px-3 py-0'>
            <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
              Déroulé
            </div>
            <p className='text-xs whitespace-pre-wrap'>
              {booking.deroulement || DASH}
            </p>
          </CardContent>
        </Card>

        {/* Menu — 2 cols: food list / boissons (matches legacy CRM) */}
        <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
          <CardHeader className='px-3 pt-0 pb-0'>
            <CardTitle className='text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'>
              Menu
            </CardTitle>
          </CardHeader>
          <CardContent className='px-3 pt-0 pb-0'>
            <div className='grid grid-cols-1 gap-1.5 sm:grid-cols-2'>
              <div className='space-y-3'>
                {[
                  { label: 'Apéritif', value: booking.menu_aperitif },
                  { label: 'Entrée', value: booking.menu_entree },
                  { label: 'Plat', value: booking.menu_plat },
                  { label: 'Dessert', value: booking.menu_dessert },
                ].map((m) => (
                  <div key={m.label} className='space-y-0.5'>
                    <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                      {m.label}
                    </div>
                    <p className='text-xs whitespace-pre-wrap'>
                      {m.value || DASH}
                    </p>
                  </div>
                ))}
              </div>
              <div className='space-y-0.5 sm:border-l sm:pl-4'>
                <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                  Boissons
                </div>
                <p className='text-xs whitespace-pre-wrap'>
                  {booking.menu_boissons || DASH}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Allergies et régimes + Prestations souhaitées */}
        <div className='grid grid-cols-1 gap-1.5 sm:grid-cols-2'>
          <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
            <CardContent className='space-y-0.5 px-3 py-0'>
              <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                Allergies et Régimes
              </div>
              <p className='text-xs whitespace-pre-wrap'>
                {booking.allergies_regimes || DASH}
              </p>
            </CardContent>
          </Card>
          <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
            <CardContent className='space-y-0.5 px-3 py-0'>
              <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                Prestations souhaitées
              </div>
              <p className='text-xs whitespace-pre-wrap'>
                {booking.prestations_souhaitees || DASH}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Commentaires */}
        <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
          <CardContent className='space-y-0.5 px-3 py-0'>
            <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
              Commentaires
            </div>
            <p className='text-xs whitespace-pre-wrap'>
              {commentairesText || DASH}
            </p>
          </CardContent>
        </Card>

        {/* Suivi commercial */}
        <Card className='gap-1 py-2 print:border-0 print:bg-white print:shadow-none'>
          <CardHeader className='px-3 pt-0 pb-0'>
            <CardTitle className='text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'>
              Suivi commercial
            </CardTitle>
          </CardHeader>
          <CardContent className='px-3 pt-0 pb-0'>
            <div className='grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2'>
              <div className='space-y-0.5'>
                <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                  Commerciaux assignés
                </div>
                <div className='font-medium'>{assignedNames}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                  Source
                </div>
                <div className='font-medium'>{booking.source || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                  Occasion
                </div>
                <div className='font-medium'>{booking.occasion || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                  Option
                </div>
                <div className='font-medium'>{booking.option || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                  Relance
                </div>
                <div className='font-medium'>{booking.relance || DASH}</div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                  Date signature devis
                </div>
                <div className='font-medium'>
                  {formatDate(booking.date_signature_devis)}
                </div>
              </div>
              <div className='space-y-0.5'>
                <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                  Budget client
                </div>
                <div className='font-medium'>
                  {formatNumber(booking.budget_client, ' €')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
