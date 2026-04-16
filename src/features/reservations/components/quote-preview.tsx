import { Separator } from '@/components/ui/separator'
import type { QuoteItem, Payment } from '@/lib/supabase/types'
import type { BookingWithRelations } from '../hooks/use-bookings'
import type { Restaurant } from '@/features/settings/hooks/use-settings'
import type { QuoteWithItems } from '../hooks/use-quotes'

export type DocumentType = 'devis' | 'acompte' | 'solde' | 'facture_finale'

export type QuotePreviewData = {
  quote: QuoteWithItems | null
  items: QuoteItem[]
  booking: BookingWithRelations
  restaurant: Restaurant | null
  contact: {
    id: string
    first_name: string
    last_name: string | null
    email: string | null
    phone: string | null
    company?: {
      name: string
      billing_address?: string | null
      billing_city?: string | null
      billing_postal_code?: string | null
    } | null
  } | null
  title: string
  dateStart: string
  dateEnd: string
  startTime?: string
  endTime?: string
  quoteDate: string
  quoteDueDays: number
  invoiceDueDays: number
  depositPercentage: number
  depositLabel: string
  depositDays: number
  balanceLabel: string
  balanceDays: number
  depositAmount: number
  balanceAmount: number
  totalHt: number
  totalTtc: number
  totalTva: number
  rawTotalHt?: number
  rawTotalTtc?: number
  discountPercentage: number
  orderNumber: string
  commentsFr: string
  commentsEn: string
  conditionsDevis: string
  conditionsFacture: string
  conditionsAcompte: string
  conditionsSolde: string
  additionalConditions: string
  language: 'fr' | 'en'
  extras?: QuoteItem[]
  payments?: Payment[]
}

type Props = {
  data: QuotePreviewData
  documentType?: DocumentType
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function addDays(dateStr: string | null | undefined, days: number): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return '—'
  }
}

// Labels by language
const labels = {
  fr: {
    quote: 'DEVIS',
    depositInvoice: "FACTURE D'ACOMPTE",
    balanceInvoice: 'FACTURE DE SOLDE',
    quoteNumber: 'Devis n°',
    invoiceNumber: 'Facture n°',
    date: 'Date',
    dateInvoice: 'Date de la facture',
    dueDate: 'Échéance',
    dateDue: "Date d'échéance",
    issuer: 'Émetteur',
    client: 'Client',
    eventTitle: 'Événement',
    serviceStart: 'Début de la prestation',
    serviceDate: 'Date de prestation',
    designation: 'Désignation',
    quantity: 'Qté',
    unitPriceTtc: 'Prix TTC',
    unitPriceHt: 'P.U. HT',
    tvaRate: 'TVA',
    totalHt: 'Total HT',
    totalTtc: 'Total TTC',
    subtotalHt: 'Sous-total HT',
    subtotalBeforeDeposit: 'Sous total HT (avant acompte)',
    totalTvaLabel: 'Total TVA',
    paymentSchedule: 'Échéancier de paiement',
    bankDetails: 'Coordonnées bancaires',
    generalConditions: 'Conditions générales',
    page: 'Page',
    orderNumber: 'N° commande',
    discount: 'Remise',
    comments: 'Commentaires',
    depositFor: 'Acompte pour le devis n°',
    depositsHt: 'Acompte(s) HT',
    depositAtSignature: 'Acompte à signature',
    relatedQuote: 'Réf. devis',
    depositPercent: 'Acompte',
    balancePercent: 'Solde',
    companyName: 'Raison sociale',
    name: 'Nom',
    address: 'Adresse',
    siretSiren: 'Siret/Siren',
    vatNumber: 'Numéro de TVA',
    email: 'Email',
    phone: 'Téléphone',
    firstName: 'Prénom Nom',
    billingAddress: 'Adresse de facturation',
    dateOf: 'Date du',
    dueDateLabel: "Date d'échéance",
    iban: 'IBAN',
    bic: 'BIC',
    bankName: 'Banque',
    shareCapital: 'au capital de',
    additionalConditions: 'Conditions particulières',
    finalInvoice: 'FACTURE FINALE',
    extras: 'Extras',
    paymentsReceived: 'Paiements reçus',
    remainingBalance: 'Solde restant',
    totalWithExtras: 'Total avec extras',
    serviceItems: 'Prestation',
    subtotalPrestation: 'Sous-total prestation',
    subtotalExtras: 'Sous-total extras',
  },
  en: {
    quote: 'QUOTE',
    depositInvoice: 'DEPOSIT INVOICE',
    balanceInvoice: 'BALANCE INVOICE',
    quoteNumber: 'Quote #',
    invoiceNumber: 'Invoice #',
    date: 'Date',
    dateInvoice: 'Invoice date',
    dueDate: 'Due date',
    dateDue: 'Due date',
    issuer: 'Issuer',
    client: 'Client',
    eventTitle: 'Event',
    serviceStart: 'Service start',
    serviceDate: 'Service date',
    designation: 'Description',
    quantity: 'Qty',
    unitPriceTtc: 'Price incl. VAT',
    unitPriceHt: 'Unit price',
    tvaRate: 'VAT',
    totalHt: 'Total excl. VAT',
    totalTtc: 'Total incl. VAT',
    subtotalHt: 'Subtotal excl. VAT',
    subtotalBeforeDeposit: 'Subtotal excl. VAT (before deposit)',
    totalTvaLabel: 'Total VAT',
    paymentSchedule: 'Payment schedule',
    bankDetails: 'Bank details',
    generalConditions: 'General conditions',
    page: 'Page',
    orderNumber: 'Order #',
    discount: 'Discount',
    comments: 'Comments',
    depositFor: 'Deposit for quote #',
    depositsHt: 'Deposit(s) excl. VAT',
    depositAtSignature: 'Deposit at signature',
    relatedQuote: 'Quote ref.',
    depositPercent: 'Deposit',
    balancePercent: 'Balance',
    companyName: 'Company name',
    name: 'Name',
    address: 'Address',
    siretSiren: 'Siret/Siren',
    vatNumber: 'VAT number',
    email: 'Email',
    phone: 'Phone',
    firstName: 'Name',
    billingAddress: 'Billing address',
    dateOf: 'Date of',
    dueDateLabel: 'Due date',
    iban: 'IBAN',
    bic: 'BIC',
    bankName: 'Bank',
    shareCapital: 'share capital of',
    additionalConditions: 'Special terms',
    finalInvoice: 'FINAL INVOICE',
    extras: 'Extras',
    paymentsReceived: 'Payments received',
    remainingBalance: 'Remaining balance',
    totalWithExtras: 'Total with extras',
    serviceItems: 'Service',
    subtotalPrestation: 'Service subtotal',
    subtotalExtras: 'Extras subtotal',
  },
}

// ── Shared sub-components ──

function DocumentHeader({ restaurant, docTitle, docNumber, date, dueDate, color, l }: {
  restaurant: any
  docTitle: string
  docNumber: string
  date: string
  dueDate: string
  color: string
  l: typeof labels['fr']
}) {
  return (
    <div className='flex items-center justify-between rounded-lg px-5 py-4' style={{ backgroundColor: color, color: 'white' }}>
      <div className='flex items-center gap-3'>
        {restaurant?.logo_url && (
          <img src={restaurant.logo_url} alt='' className='h-12 w-12 rounded-lg object-contain bg-white/20 p-1 shrink-0' />
        )}
        <h1 className='text-base font-bold text-white'>
          {restaurant?.name || 'Restaurant'}
        </h1>
      </div>
      <div className='text-right text-[10px] space-y-0.5 shrink-0'>
        <p className='text-xs font-bold'>{docTitle} n°{docNumber}</p>
        <p>{l.dateOf} {(docTitle || '').toLowerCase()} – {date}</p>
        <p>{l.dueDateLabel} – {dueDate}</p>
      </div>
    </div>
  )
}

function IssuerClientBlock({ restaurant, contact, l }: { restaurant: any; contact: QuotePreviewData['contact']; l: typeof labels['fr'] }) {
  return (
    <div className='grid grid-cols-2 gap-6'>
      <div className='space-y-1'>
        <h3 className='text-[10px] font-bold uppercase text-gray-400'>{l.issuer}</h3>
        {restaurant?.company_name && <p className='text-[10px] text-gray-500'>{l.companyName} – {restaurant.company_name}</p>}
        <p className='font-semibold'>{l.name} – {restaurant?.name || ''}</p>
        {restaurant?.address && <p className='text-gray-600'>{l.address} – {restaurant.address}</p>}
        {(restaurant?.postal_code || restaurant?.city) && (
          <p className='text-gray-600'>{restaurant?.postal_code} {restaurant?.city}</p>
        )}
        {restaurant?.siret && <p className='text-gray-500 text-[10px]'>{l.siretSiren} – {restaurant.siret}</p>}
        {restaurant?.tva_number && <p className='text-gray-500 text-[10px]'>{l.vatNumber} – {restaurant.tva_number}</p>}
        {restaurant?.email && <p className='text-gray-500 text-[10px]'>{l.email} – {restaurant.email}</p>}
      </div>
      <div className='space-y-1'>
        <h3 className='text-[10px] font-bold uppercase text-gray-400'>{l.client}</h3>
        {contact?.company && (
          <p className='font-semibold'>{contact.company.name}</p>
        )}
        <p className={contact?.company ? '' : 'font-semibold'}>
          {l.firstName} – {contact?.first_name} {contact?.last_name || ''}
        </p>
        {contact?.email && <p className='text-gray-600'>{l.email} – {contact.email}</p>}
        {contact?.phone && <p className='text-gray-600'>{l.phone} – {contact.phone}</p>}
        {contact?.company?.billing_address && (
          <p className='text-gray-600'>{l.billingAddress} – {contact.company.billing_address}</p>
        )}
        {(contact?.company?.billing_postal_code || contact?.company?.billing_city) && (
          <p className='text-gray-600'>
            {contact?.company?.billing_postal_code} {contact?.company?.billing_city}
          </p>
        )}
      </div>
    </div>
  )
}

function BankDetails({ restaurant, l }: { restaurant: any; l: typeof labels['fr'] }) {
  if (!restaurant?.iban && !restaurant?.bic) return null
  return (
    <div className='space-y-1'>
      <h3 className='text-[10px] font-bold uppercase text-gray-400'>{l.bankDetails}</h3>
      <div className='bg-gray-50 rounded px-3 py-2 text-[10px] space-y-0.5 border'>
        {restaurant?.bank_name && <p className='font-semibold'>{l.bankName} : {restaurant.bank_name}</p>}
        {restaurant?.iban && <p>{l.iban} : {restaurant.iban}</p>}
        {restaurant?.bic && <p>{l.bic} : {restaurant.bic}</p>}
      </div>
    </div>
  )
}

function DocumentFooter({ restaurant, l }: { restaurant: any; l: typeof labels['fr'] }) {
  return (
    <div className='border-t pt-2 text-[9px] text-gray-400 text-center space-y-0.5'>
      <p>
        {restaurant?.company_name || restaurant?.name}
        {restaurant?.legal_form && ` — ${restaurant.legal_form}`}
        {restaurant?.share_capital && ` ${l.shareCapital} ${restaurant.share_capital}`}
      </p>
      <p>
        {restaurant?.siren && `SIREN: ${restaurant.siren}`}
        {restaurant?.rcs && ` — RCS: ${restaurant.rcs}`}
        {restaurant?.siret && ` — SIRET: ${restaurant.siret}`}
        {restaurant?.tva_number && ` — ${l.vatNumber}: ${restaurant.tva_number}`}
      </p>
      {(restaurant?.email || restaurant?.phone) && (
        <p>
          {restaurant?.email}
          {restaurant?.email && restaurant?.phone && ' — '}
          {restaurant?.phone}
        </p>
      )}
    </div>
  )
}

function ConditionsPage({ title, conditions, color }: { title: string; conditions: string; color: string }) {
  if (!conditions) return null
  return (
    <div className='border-t-2 border-dashed border-gray-200 p-6 space-y-3'>
      <h2 className='text-xs font-bold' style={{ color }}>
        {title}
      </h2>
      <div className='text-[9px] text-gray-600 whitespace-pre-line leading-relaxed'>
        {conditions}
      </div>
    </div>
  )
}

// ── Main component ──

export function QuotePreview({ data, documentType = 'devis' }: Props) {
  const l = labels[data.language] || labels.fr
  const restaurant = data.restaurant as any
  const color = restaurant?.color || '#0d7377'

  // Compute item totals from raw fields (avoids stale DB values)
  function computeItemHt(item: { quantity?: number | null; unit_price?: number | null; discount_amount?: number | null }) {
    return Math.round(((item.quantity ?? 1) * (item.unit_price ?? 0) - (item.discount_amount ?? 0)) * 100) / 100
  }
  function computeItemTtc(item: { quantity?: number | null; unit_price?: number | null; discount_amount?: number | null; tva_rate?: number | null }) {
    const ht = computeItemHt(item)
    return Math.round(ht * (1 + (item.tva_rate ?? 20) / 100) * 100) / 100
  }

  // Group TVA by rate, applying quote-level discount
  const discountMult = data.discountPercentage > 0 ? (1 - data.discountPercentage / 100) : 1
  const tvaByRate: Record<number, { ht: number; tva: number }> = {}
  for (const item of data.items) {
    const rate = item.tva_rate || 20
    const ht = Math.round(computeItemHt(item) * discountMult * 100) / 100
    const tva = Math.round(ht * (rate / 100) * 100) / 100
    if (!tvaByRate[rate]) tvaByRate[rate] = { ht: 0, tva: 0 }
    tvaByRate[rate].ht = Math.round((tvaByRate[rate].ht + ht) * 100) / 100
    tvaByRate[rate].tva = Math.round((tvaByRate[rate].tva + tva) * 100) / 100
  }

  const quoteNumber = data.quote?.quote_number || '—'
  const comments = data.language === 'en' ? data.commentsEn : data.commentsFr

  // ── DEVIS ──
  if (documentType === 'devis') {
    return (
      <div id='quote-preview-content' className='bg-white text-black rounded-lg shadow-sm border text-[11px] leading-relaxed'>
        <div className='p-6 space-y-5'>
          <DocumentHeader
            restaurant={restaurant}
            docTitle={l.quote}
            docNumber={quoteNumber}
            date={formatDate(data.quoteDate)}
            dueDate={addDays(data.quoteDate, data.quoteDueDays)}

            color={color}
            l={l}
          />

          <IssuerClientBlock restaurant={restaurant} contact={data.contact} l={l} />

          {/* Event title */}
          {(data.title || data.dateStart) && (
            <div className='px-3 py-2 rounded border-l-4' style={{ borderColor: color, backgroundColor: '#faf5f0' }}>
              {data.title && <p className='font-semibold text-xs'>{data.title}</p>}
              {data.dateStart && (
                <p className='text-[10px] text-gray-600'>
                  {l.serviceDate}: {formatDate(data.dateStart)}
                  {data.startTime && ` à ${data.startTime}`}
                  {data.endTime && ` — ${data.endTime}`}
                  {data.dateEnd && data.dateEnd !== data.dateStart && ` | ${formatDate(data.dateEnd)}`}
                </p>
              )}
              {data.orderNumber && (
                <p className='text-[10px] text-gray-600'>{l.orderNumber}: {data.orderNumber}</p>
              )}
            </div>
          )}

          {/* Comments */}
          {comments && (
            <div className='bg-amber-50 border border-amber-200 rounded px-3 py-2'>
              <h3 className='text-[10px] font-bold text-amber-800'>{l.comments}</h3>
              <p className='text-[10px] text-gray-700 whitespace-pre-line'>{comments}</p>
            </div>
          )}

          {/* Products table */}
          {data.items.length > 0 && (
            <div className='border rounded overflow-hidden'>
              <table className='w-full text-[10px]'>
                <thead>
                  <tr style={{ backgroundColor: color, color: 'white' }}>
                    <th className='text-left px-2 py-1.5 font-medium'>{l.designation}</th>
                    <th className='text-center px-2 py-1.5 font-medium w-12'>{l.quantity}</th>
                    <th className='text-right px-2 py-1.5 font-medium w-20'>{l.unitPriceHt}</th>
                    <th className='text-center px-2 py-1.5 font-medium w-14'>{l.tvaRate}</th>
                    <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalHt}</th>
                    <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalTtc}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => {
                    const base = (item.quantity || 1) * (item.unit_price || 0)
                    const discountPct = (item.discount_amount || 0) > 0 && base > 0
                      ? Math.round((item.discount_amount! / base) * 1000) / 10
                      : 0
                    return (
                      <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className='px-2 py-1.5'>
                          <span className='font-medium'>{item.name}</span>
                          {discountPct > 0 && (
                            <span className='ml-1.5 inline-block bg-red-100 text-red-600 text-[8px] font-semibold px-1 py-0.5 rounded'>
                              -{discountPct}%
                            </span>
                          )}
                          {item.description && <span className='block text-gray-500 text-[9px]'>{item.description}</span>}
                        </td>
                        <td className='text-center px-2 py-1.5'>{item.quantity}</td>
                        <td className='text-right px-2 py-1.5'>
                          {discountPct > 0 ? (
                            <span className='line-through text-gray-400'>{(item.unit_price || 0).toFixed(2)} €</span>
                          ) : (
                            <span>{(item.unit_price || 0).toFixed(2)} €</span>
                          )}
                        </td>
                        <td className='text-center px-2 py-1.5'>{item.tva_rate}%</td>
                        <td className='text-right px-2 py-1.5'>{computeItemHt(item).toFixed(2)} €</td>
                        <td className='text-right px-2 py-1.5'>{computeItemTtc(item).toFixed(2)} €</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className='flex justify-end'>
            <div className='w-56 space-y-1'>
              {data.discountPercentage > 0 && data.rawTotalHt ? (
                <>
                  <div className='flex justify-between text-[10px]'>
                    <span className='text-gray-600'>{l.subtotalHt}</span>
                    <span className='font-medium line-through text-gray-400'>{data.rawTotalHt.toFixed(2)} €</span>
                  </div>
                  <div className='flex justify-between text-[10px]'>
                    <span className='text-red-600'>{l.discount} {data.discountPercentage}%</span>
                    <span className='font-medium text-red-600'>- {(data.rawTotalHt - data.totalHt).toFixed(2)} €</span>
                  </div>
                  <div className='flex justify-between text-[10px]'>
                    <span className='text-gray-600'>{l.subtotalHt} après remise</span>
                    <span className='font-medium'>{data.totalHt.toFixed(2)} €</span>
                  </div>
                </>
              ) : (
                <div className='flex justify-between text-[10px]'>
                  <span className='text-gray-600'>{l.subtotalHt}</span>
                  <span className='font-medium'>{data.totalHt.toFixed(2)} €</span>
                </div>
              )}
              {Object.entries(tvaByRate).map(([rate, val]) => (
                <div key={rate} className='flex justify-between text-[10px]'>
                  <span className='text-gray-600'>TVA {rate}%</span>
                  <span>{val.tva.toFixed(2)} €</span>
                </div>
              ))}
              <div className='flex justify-between text-[10px]'>
                <span className='text-gray-600'>{l.totalTvaLabel}</span>
                <span className='font-medium'>{data.totalTva.toFixed(2)} €</span>
              </div>
              <Separator className='bg-gray-300' />
              <div className='flex justify-between text-xs font-bold px-2 py-1 rounded' style={{ backgroundColor: color, color: 'white' }}>
                <span>{l.totalTtc}</span>
                <span>{data.totalTtc.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Payment schedule */}
          <div className='space-y-1.5'>
            <h3 className='text-[10px] font-bold uppercase text-gray-400'>{l.paymentSchedule}</h3>
            <div className='border rounded overflow-hidden'>
              <table className='w-full text-[10px]'>
                <tbody>
                  <tr className='bg-gray-50'>
                    <td className='px-2 py-1.5 font-medium'>{data.depositLabel}</td>
                    <td className='px-2 py-1.5 text-center'>{data.depositPercentage}%</td>
                    <td className='px-2 py-1.5 text-center'>J-{data.depositDays}</td>
                    <td className='px-2 py-1.5 text-right font-semibold'>{data.depositAmount.toFixed(2)} €</td>
                  </tr>
                  <tr>
                    <td className='px-2 py-1.5 font-medium'>{data.balanceLabel}</td>
                    <td className='px-2 py-1.5 text-center'>{(100 - data.depositPercentage).toFixed(0)}%</td>
                    <td className='px-2 py-1.5 text-center'>J-{data.balanceDays}</td>
                    <td className='px-2 py-1.5 text-right font-semibold'>{data.balanceAmount.toFixed(2)} €</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <BankDetails restaurant={restaurant} l={l} />
          <DocumentFooter restaurant={restaurant} l={l} />
        </div>

        <ConditionsPage title={l.generalConditions} conditions={data.conditionsDevis} color={color} />
        <ConditionsPage title={l.additionalConditions} conditions={data.additionalConditions} color={color} />
      </div>
    )
  }

  // ── ACOMPTE ──
  if (documentType === 'acompte') {
    const depositHt = data.totalHt * (data.depositPercentage / 100)
    const avgTvaRate = data.totalHt > 0 ? ((data.totalTtc - data.totalHt) / data.totalHt) * 100 : 20
    const depositTva = depositHt * (avgTvaRate / 100)
    const depositTtc = Math.ceil(depositHt + depositTva)

    return (
      <div id='quote-preview-content' className='bg-white text-black rounded-lg shadow-sm border text-[11px] leading-relaxed'>
        <div className='p-6 space-y-5'>
          <DocumentHeader
            restaurant={restaurant}
            docTitle={l.depositInvoice}
            docNumber={quoteNumber}
            date={formatDate(data.quoteDate)}
            dueDate={addDays(data.quoteDate, data.invoiceDueDays)}

            color={color}
            l={l}
          />

          {/* Quote reference */}
          <div className='text-[10px] text-gray-600 bg-gray-50 px-3 py-2 rounded border'>
            <span className='font-medium'>{l.relatedQuote}:</span> {quoteNumber} — {l.depositPercent} {data.depositPercentage}%
          </div>

          <IssuerClientBlock restaurant={restaurant} contact={data.contact} l={l} />

          {/* Event title */}
          {(data.title || data.dateStart) && (
            <div className='px-3 py-3 rounded border' style={{ borderColor: color + '40' }}>
              {data.title && <p className='font-semibold text-xs'>{data.title}</p>}
              {data.dateStart && (
                <div className='mt-1'>
                  <p className='text-[10px] font-semibold'>{l.serviceStart}</p>
                  <p className='text-[10px] text-gray-600'>{formatDate(data.dateStart)}{data.startTime && ` à ${data.startTime}`}{data.endTime && ` — ${data.endTime}`}</p>
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          {comments && (
            <div className='bg-amber-50 border border-amber-200 rounded px-3 py-2'>
              <h3 className='text-[10px] font-bold text-amber-800'>{l.comments}</h3>
              <p className='text-[10px] text-gray-700 whitespace-pre-line'>{comments}</p>
            </div>
          )}

          {/* Products table with details */}
          {data.items.length > 0 && (
            <div className='border rounded overflow-hidden'>
              <table className='w-full text-[10px]'>
                <thead>
                  <tr style={{ backgroundColor: color, color: 'white' }}>
                    <th className='text-left px-2 py-1.5 font-medium'>{l.designation}</th>
                    <th className='text-center px-2 py-1.5 font-medium w-12'>{l.quantity}</th>
                    <th className='text-right px-2 py-1.5 font-medium w-20'>{l.unitPriceHt}</th>
                    <th className='text-center px-2 py-1.5 font-medium w-14'>{l.tvaRate}</th>
                    <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalHt}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className='px-2 py-1.5'>
                        <span className='font-medium'>{item.name}</span>
                        {item.description && <span className='block text-gray-500 text-[9px]'>{item.description}</span>}
                      </td>
                      <td className='text-center px-2 py-1.5'>{item.quantity}</td>
                      <td className='text-right px-2 py-1.5'>{(item.unit_price || 0).toFixed(2)} €</td>
                      <td className='text-center px-2 py-1.5'>{item.tva_rate}%</td>
                      <td className='text-right px-2 py-1.5'>{computeItemHt(item).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className='flex items-end justify-between'>
            <BankDetails restaurant={restaurant} l={l} />
            <div className='w-56 space-y-1'>
              <div className='flex justify-between text-[10px]'>
                <span className='text-gray-600'>{l.subtotalHt} (before deposit)</span>
                <span className='text-[9px] text-gray-500'>{l.totalHt}: {data.totalHt.toFixed(2)} €</span>
              </div>
              <div className='flex justify-between text-xs font-bold px-2 py-1 rounded' style={{ backgroundColor: color, color: 'white' }}>
                <span>{l.totalTtc}</span>
                <span>{depositTtc.toFixed(2)} €</span>
              </div>
              <div className='text-[9px] text-gray-500 text-right'>
                {l.totalHt}: {depositHt.toFixed(2)} €
              </div>
            </div>
          </div>

          <DocumentFooter restaurant={restaurant} l={l} />
        </div>

        <ConditionsPage title={l.generalConditions} conditions={data.conditionsAcompte} color={color} />
      </div>
    )
  }

  // ── SOLDE ──

  return (
    <div id='quote-preview-content' className='bg-white text-black rounded-lg shadow-sm border text-[11px] leading-relaxed'>
      <div className='p-6 space-y-5'>
        <DocumentHeader
          restaurant={restaurant}
          docTitle={l.balanceInvoice}
          docNumber={quoteNumber}
          date={formatDate(data.quoteDate)}
          dueDate={addDays(data.quoteDate, data.invoiceDueDays)}
          color={color}
          l={l}
        />

        {/* Quote reference */}
        <div className='text-[10px] text-gray-600 bg-gray-50 px-3 py-2 rounded border'>
          <span className='font-medium'>{l.relatedQuote}:</span> {quoteNumber} — {l.balancePercent} {(100 - data.depositPercentage)}%
        </div>

        <IssuerClientBlock restaurant={restaurant} contact={data.contact} l={l} />

        {/* Event title */}
        {(data.title || data.dateStart) && (
          <div className='px-3 py-3 rounded border' style={{ borderColor: color + '40' }}>
            {data.title && <p className='font-semibold text-xs'>{data.title}</p>}
            {data.dateStart && (
              <div className='mt-1'>
                <p className='text-[10px] font-semibold'>{l.serviceStart}</p>
                <p className='text-[10px] text-gray-600'>{formatDate(data.dateStart)}{data.startTime && ` à ${data.startTime}`}{data.endTime && ` — ${data.endTime}`}</p>
              </div>
            )}
          </div>
        )}

        {/* Comments */}
        {comments && (
          <div className='bg-amber-50 border border-amber-200 rounded px-3 py-2'>
            <h3 className='text-[10px] font-bold text-amber-800'>{l.comments}</h3>
            <p className='text-[10px] text-gray-700 whitespace-pre-line'>{comments}</p>
          </div>
        )}

        {/* Combined products + extras table for Solde */}
        {(data.items.length > 0 || (data.extras || []).length > 0) && (
          <div className='border rounded overflow-hidden'>
            <table className='w-full text-[10px]'>
              <thead>
                <tr style={{ backgroundColor: color, color: 'white' }}>
                  <th className='text-left px-2 py-1.5 font-medium'>{l.designation}</th>
                  <th className='text-center px-2 py-1.5 font-medium w-12'>{l.quantity}</th>
                  <th className='text-right px-2 py-1.5 font-medium w-20'>{l.unitPriceHt}</th>
                  <th className='text-center px-2 py-1.5 font-medium w-14'>{l.tvaRate}</th>
                  <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalHt}</th>
                  <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalTtc}</th>
                </tr>
              </thead>
              <tbody>
                {/* Section: Prestation (quote items) */}
                {data.items.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={6} className='px-2 py-1.5 font-bold text-[10px] border-b bg-gray-100' style={{ color }}>
                        {l.serviceItems || 'Prestation'}
                        {data.dateStart && ` — ${formatDate(data.dateStart)}${data.startTime ? ` à ${data.startTime}` : ''}`}
                      </td>
                    </tr>
                    {data.items.map((item, i) => (
                      <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className='px-2 py-1.5'>
                          <span className='font-medium'>{item.name}</span>
                          {item.description && <span className='block text-gray-500 text-[9px]'>{item.description}</span>}
                        </td>
                        <td className='text-center px-2 py-1.5'>{item.quantity}</td>
                        <td className='text-right px-2 py-1.5'>{(item.unit_price || 0).toFixed(2)} €</td>
                        <td className='text-center px-2 py-1.5'>{item.tva_rate}%</td>
                        <td className='text-right px-2 py-1.5'>{computeItemHt(item).toFixed(2)} €</td>
                        <td className='text-right px-2 py-1.5'>{computeItemTtc(item).toFixed(2)} €</td>
                      </tr>
                    ))}
                    {/* Subtotal for prestation */}
                    <tr className='border-t'>
                      <td colSpan={4} className='px-2 py-1 text-right text-[9px] text-gray-600'>{l.subtotalPrestation || 'Sous-total prestation'}</td>
                      <td className='px-2 py-1 text-right text-[9px] font-medium'>{data.totalHt.toFixed(2)} €</td>
                      <td className='px-2 py-1 text-right text-[9px] font-medium'>{data.totalTtc.toFixed(2)} €</td>
                    </tr>
                  </>
                )}

                {/* Section: Extras */}
                {(data.extras || []).length > 0 && (
                  <>
                    <tr>
                      <td colSpan={6} className='px-2 py-1.5 font-bold text-[10px] border-b bg-amber-50' style={{ color }}>
                        {l.extras}
                      </td>
                    </tr>
                    {(data.extras || []).map((extra, i) => (
                      <tr key={extra.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className='px-2 py-1.5'>
                          <span className='font-medium'>{extra.name}</span>
                          {extra.description && <span className='block text-gray-500 text-[9px]'>{extra.description}</span>}
                        </td>
                        <td className='text-center px-2 py-1.5'>{extra.quantity}</td>
                        <td className='text-right px-2 py-1.5'>{(extra.unit_price || 0).toFixed(2)} €</td>
                        <td className='text-center px-2 py-1.5'>{extra.tva_rate}%</td>
                        <td className='text-right px-2 py-1.5'>{computeItemHt(extra).toFixed(2)} €</td>
                        <td className='text-right px-2 py-1.5'>{computeItemTtc(extra).toFixed(2)} €</td>
                      </tr>
                    ))}
                    {/* Subtotal for extras */}
                    <tr className='border-t'>
                      <td colSpan={4} className='px-2 py-1 text-right text-[9px] text-gray-600'>{l.subtotalExtras || 'Sous-total extras'}</td>
                      <td className='px-2 py-1 text-right text-[9px] font-medium'>{(data.extras || []).reduce((sum, e) => sum + computeItemHt(e), 0).toFixed(2)} €</td>
                      <td className='px-2 py-1 text-right text-[9px] font-medium'>{(data.extras || []).reduce((sum, e) => sum + computeItemTtc(e), 0).toFixed(2)} €</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals: Total HT, Total TTC, payments deducted, remaining balance */}
        {(() => {
          const extrasHt = (data.extras || []).reduce((sum, e) => sum + computeItemHt(e), 0)
          const extrasTtc = (data.extras || []).reduce((sum, e) => sum + computeItemTtc(e), 0)
          const grandTotalHt = data.totalHt + extrasHt
          const grandTotalTtc = Math.ceil(data.totalTtc + extrasTtc)
          const paidPayments = (data.payments || []).filter(p => p.status === 'paid' || p.status === 'completed')
          const totalPaid = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
          const remainingTtc = grandTotalTtc - totalPaid

          return (
            <div className='flex items-end justify-between'>
              <BankDetails restaurant={restaurant} l={l} />
              <div className='w-64 space-y-1'>
                <div className='flex justify-between text-[10px]'>
                  <span className='text-gray-600'>Total HT</span>
                  <span>{grandTotalHt.toFixed(2)} €</span>
                </div>
                <div className='flex justify-between text-[10px] font-semibold'>
                  <span>Total TTC</span>
                  <span>{grandTotalTtc.toFixed(2)} €</span>
                </div>
                {paidPayments.length > 0 && (
                  <>
                    <Separator className='bg-gray-300' />
                    {paidPayments.map((p, i) => {
                      const isEn = data.language === 'en'
                      const label = p.payment_modality === 'acompte' ? (isEn ? 'Deposit paid' : 'Acompte versé')
                        : p.payment_modality === 'solde' ? (isEn ? 'Balance paid' : 'Solde versé')
                        : (isEn ? 'Payment received' : 'Paiement reçu')
                      const dateStr = p.paid_at ? new Date(p.paid_at).toLocaleDateString(isEn ? 'en-US' : 'fr-FR') : ''
                      return (
                        <div key={i} className='flex justify-between text-[10px] text-green-600'>
                          <span>{label}{dateStr ? ` (${dateStr})` : ''}</span>
                          <span>- {(p.amount || 0).toFixed(2)} €</span>
                        </div>
                      )
                    })}
                  </>
                )}
                <Separator className='bg-gray-300' />
                <div className='flex justify-between text-xs font-bold px-2 py-1 rounded' style={{ backgroundColor: color, color: 'white' }}>
                  <span>{l.remainingBalance} TTC</span>
                  <span>{remainingTtc.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          )
        })()}

        <DocumentFooter restaurant={restaurant} l={l} />
      </div>

      <ConditionsPage title={l.generalConditions} conditions={data.conditionsSolde} color={color} />
    </div>
  )

  // ── FACTURE FINALE ──
  if (documentType === 'facture_finale') {
    const extras = data.extras || []
    const payments = data.payments || []
    
    // Calculate extras totals
    const extrasTotalHt = extras.reduce((sum, e) => sum + computeItemHt(e), 0)
    const extrasTotalTtc = extras.reduce((sum, e) => sum + computeItemTtc(e), 0)
    
    // Calculate payments received (completed only)
    const paymentsReceived = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
    
    // Grand totals
    const grandTotalHt = data.totalHt + extrasTotalHt
    const grandTotalTtc = Math.ceil(data.totalTtc + extrasTotalTtc)
    const remainingBalance = grandTotalTtc - paymentsReceived

    return (
      <div id='quote-preview-content' className='bg-white text-black rounded-lg shadow-sm border text-[11px] leading-relaxed'>
        <div className='p-6 space-y-5'>
          <DocumentHeader
            restaurant={restaurant}
            docTitle={l.finalInvoice}
            docNumber={quoteNumber}
            date={formatDate(data.quoteDate)}
            dueDate={addDays(data.quoteDate, data.invoiceDueDays)}

            color={color}
            l={l}
          />

          {/* Quote reference */}
          <div className='text-[10px] text-gray-600 bg-gray-50 px-3 py-2 rounded border'>
            <span className='font-medium'>{l.relatedQuote}:</span> {quoteNumber}
          </div>

          <IssuerClientBlock restaurant={restaurant} contact={data.contact} l={l} />

          {/* Event title */}
          {(data.title || data.dateStart) && (
            <div className='px-3 py-3 rounded border' style={{ borderColor: color + '40' }}>
              {data.title && <p className='font-semibold text-xs'>{data.title}</p>}
              {data.dateStart && (
                <div className='mt-1'>
                  <p className='text-[10px] font-semibold'>{l.serviceStart}</p>
                  <p className='text-[10px] text-gray-600'>{formatDate(data.dateStart)}{data.startTime && ` à ${data.startTime}`}{data.endTime && ` — ${data.endTime}`}</p>
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          {comments && (
            <div className='bg-amber-50 border border-amber-200 rounded px-3 py-2'>
              <h3 className='text-[10px] font-bold text-amber-800'>{l.comments}</h3>
              <p className='text-[10px] text-gray-700 whitespace-pre-line'>{comments}</p>
            </div>
          )}

          {/* Original Quote Items */}
          {data.items.length > 0 && (
            <div className='border rounded overflow-hidden'>
              <table className='w-full text-[10px]'>
                <thead>
                  <tr style={{ backgroundColor: color, color: 'white' }}>
                    <th className='text-left px-2 py-1.5 font-medium'>{l.designation}</th>
                    <th className='text-center px-2 py-1.5 font-medium w-12'>{l.quantity}</th>
                    <th className='text-right px-2 py-1.5 font-medium w-20'>{l.unitPriceHt}</th>
                    <th className='text-center px-2 py-1.5 font-medium w-14'>{l.tvaRate}</th>
                    <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalHt}</th>
                    <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalTtc}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className='px-2 py-1.5'>
                        <span className='font-medium'>{item.name}</span>
                        {item.description && <span className='block text-gray-500 text-[9px]'>{item.description}</span>}
                      </td>
                      <td className='text-center px-2 py-1.5'>{item.quantity}</td>
                      <td className='text-right px-2 py-1.5'>{(item.unit_price || 0).toFixed(2)} €</td>
                      <td className='text-center px-2 py-1.5'>{item.tva_rate}%</td>
                      <td className='text-right px-2 py-1.5'>{computeItemHt(item).toFixed(2)} €</td>
                      <td className='text-right px-2 py-1.5'>{computeItemTtc(item).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Extras Section */}
          {extras.length > 0 && (
            <div className='space-y-2'>
              <h3 className='text-[10px] font-bold uppercase text-gray-400'>{l.extras}</h3>
              <div className='border rounded overflow-hidden'>
                <table className='w-full text-[10px]'>
                  <thead>
                    <tr style={{ backgroundColor: color + '20' }}>
                      <th className='text-left px-2 py-1.5 font-medium'>{l.designation}</th>
                      <th className='text-center px-2 py-1.5 font-medium w-12'>{l.quantity}</th>
                      <th className='text-right px-2 py-1.5 font-medium w-20'>{l.unitPriceHt}</th>
                      <th className='text-center px-2 py-1.5 font-medium w-14'>{l.tvaRate}</th>
                      <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalHt}</th>
                      <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalTtc}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extras.map((extra, i) => (
                      <tr key={extra.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className='px-2 py-1.5'>
                          <span className='font-medium'>{extra.name}</span>
                          {extra.description && <span className='block text-gray-500 text-[9px]'>{extra.description}</span>}
                        </td>
                        <td className='text-center px-2 py-1.5'>{extra.quantity}</td>
                        <td className='text-right px-2 py-1.5'>{(extra.unit_price || 0).toFixed(2)} €</td>
                        <td className='text-center px-2 py-1.5'>{extra.tva_rate}%</td>
                        <td className='text-right px-2 py-1.5'>{computeItemHt(extra).toFixed(2)} €</td>
                        <td className='text-right px-2 py-1.5'>{computeItemTtc(extra).toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals with payments */}
          <div className='flex justify-end'>
            <div className='w-64 space-y-1'>
              <div className='flex justify-between text-[10px]'>
                <span className='text-gray-600'>{l.subtotalHt} (Devis)</span>
                <span>{data.totalHt.toFixed(2)} €</span>
              </div>
              {extras.length > 0 && (
                <>
                  <div className='flex justify-between text-[10px]'>
                    <span className='text-gray-600'>{l.subtotalHt} ({l.extras})</span>
                    <span>+ {extrasTotalHt.toFixed(2)} €</span>
                  </div>
                  <Separator className='bg-gray-300' />
                  <div className='flex justify-between text-[10px] font-medium'>
                    <span>{l.totalWithExtras} HT</span>
                    <span>{grandTotalHt.toFixed(2)} €</span>
                  </div>
                </>
              )}
              <div className='flex justify-between text-[10px]'>
                <span className='text-gray-600'>{l.totalTvaLabel}</span>
                <span>{(grandTotalTtc - grandTotalHt).toFixed(2)} €</span>
              </div>
              <div className='flex justify-between text-xs font-bold px-2 py-1 rounded' style={{ backgroundColor: color, color: 'white' }}>
                <span>{l.totalTtc}</span>
                <span>{grandTotalTtc.toFixed(2)} €</span>
              </div>

              {/* Payments received */}
              {paymentsReceived > 0 && (
                <>
                  <Separator className='bg-gray-300 my-2' />
                  <div className='border rounded px-2 py-1.5 space-y-0.5'>
                    <p className='text-[10px] font-semibold'>{l.paymentsReceived}</p>
                    {payments.filter(p => p.status === 'completed').map(p => (
                      <div key={p.id} className='flex justify-between text-[10px]'>
                        <span className='text-gray-600'>{p.payment_modality || 'Paiement'}</span>
                        <span className='text-green-600'>- {(p.amount || 0).toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                  <Separator className='bg-gray-300' />
                  <div className='flex justify-between text-xs font-bold px-2 py-1 rounded' style={{ backgroundColor: remainingBalance > 0 ? '#f97316' : '#22c55e', color: 'white' }}>
                    <span>{l.remainingBalance}</span>
                    <span>{remainingBalance.toFixed(2)} €</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <BankDetails restaurant={restaurant} l={l} />
          <DocumentFooter restaurant={restaurant} l={l} />
        </div>

        <ConditionsPage title={l.generalConditions} conditions={data.conditionsFacture} color={color} />
        <ConditionsPage title={l.additionalConditions} conditions={data.additionalConditions} color={color} />
      </div>
    )
  }
}
