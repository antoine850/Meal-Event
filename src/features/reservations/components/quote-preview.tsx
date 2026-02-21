import { Separator } from '@/components/ui/separator'
import type { QuoteItem } from '@/lib/supabase/types'
import type { BookingWithRelations } from '../hooks/use-bookings'
import type { Restaurant } from '@/features/settings/hooks/use-settings'
import type { QuoteWithItems } from '../hooks/use-quotes'

export type DocumentType = 'devis' | 'acompte' | 'solde'

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
  discountPercentage: number
  orderNumber: string
  commentsFr: string
  commentsEn: string
  conditionsDevis: string
  conditionsFacture: string
  conditionsAcompte: string
  conditionsSolde: string
  language: 'fr' | 'en'
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

function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  },
}

// ── Shared sub-components ──

function DocumentHeader({ restaurant, docTitle, docNumber, date, dueDate, color }: {
  restaurant: any
  docTitle: string
  docNumber: string
  date: string
  dueDate: string
  color: string
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
        <p>Date du {(docTitle || '').toLowerCase()} – {date}</p>
        <p>Date d'échéance – {dueDate}</p>
      </div>
    </div>
  )
}

function IssuerClientBlock({ restaurant, contact, l }: { restaurant: any; contact: QuotePreviewData['contact']; l: typeof labels['fr'] }) {
  return (
    <div className='grid grid-cols-2 gap-6'>
      <div className='space-y-1'>
        <h3 className='text-[10px] font-bold uppercase text-gray-400'>{l.issuer}</h3>
        {restaurant?.company_name && <p className='text-[10px] text-gray-500'>Raison sociale – {restaurant.company_name}</p>}
        <p className='font-semibold'>Nom – {restaurant?.name || ''}</p>
        {restaurant?.address && <p className='text-gray-600'>Adresse – {restaurant.address}</p>}
        {(restaurant?.postal_code || restaurant?.city) && (
          <p className='text-gray-600'>{restaurant?.postal_code} {restaurant?.city}</p>
        )}
        {restaurant?.siret && <p className='text-gray-500 text-[10px]'>Siret/Siren – {restaurant.siret}</p>}
        {restaurant?.tva_number && <p className='text-gray-500 text-[10px]'>Numéro de TVA – {restaurant.tva_number}</p>}
        {restaurant?.email && <p className='text-gray-500 text-[10px]'>Email – {restaurant.email}</p>}
      </div>
      <div className='space-y-1'>
        <h3 className='text-[10px] font-bold uppercase text-gray-400'>{l.client}</h3>
        {contact?.company && (
          <p className='font-semibold'>{contact.company.name}</p>
        )}
        <p className={contact?.company ? '' : 'font-semibold'}>
          Prénom Nom – {contact?.first_name} {contact?.last_name || ''}
        </p>
        {contact?.email && <p className='text-gray-600'>Email – {contact.email}</p>}
        {contact?.phone && <p className='text-gray-600'>Téléphone – {contact.phone}</p>}
        {contact?.company?.billing_address && (
          <p className='text-gray-600'>Adresse de facturation – {contact.company.billing_address}</p>
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
        {restaurant?.iban && <p>IBAN : {restaurant.iban}</p>}
        {restaurant?.bic && <p>BIC : {restaurant.bic}</p>}
      </div>
    </div>
  )
}

function DocumentFooter({ restaurant }: { restaurant: any }) {
  return (
    <div className='border-t pt-2 text-[9px] text-gray-400 text-center space-y-0.5'>
      <p>
        {restaurant?.company_name || restaurant?.name}
        {restaurant?.legal_form && ` — ${restaurant.legal_form}`}
        {restaurant?.share_capital && ` au capital de ${restaurant.share_capital}`}
      </p>
      <p>
        {restaurant?.siren && `SIREN: ${restaurant.siren}`}
        {restaurant?.rcs && ` — RCS: ${restaurant.rcs}`}
        {restaurant?.siret && ` — SIRET: ${restaurant.siret}`}
        {restaurant?.tva_number && ` — TVA: ${restaurant.tva_number}`}
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

  // Group TVA by rate
  const tvaByRate: Record<number, { ht: number; tva: number }> = {}
  for (const item of data.items) {
    const rate = item.tva_rate || 20
    const ht = (item.total_ht as number) || 0
    const tva = ht * (rate / 100)
    if (!tvaByRate[rate]) tvaByRate[rate] = { ht: 0, tva: 0 }
    tvaByRate[rate].ht += ht
    tvaByRate[rate].tva += tva
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
          />

          <IssuerClientBlock restaurant={restaurant} contact={data.contact} l={l} />

          {/* Event title */}
          {(data.title || data.dateStart) && (
            <div className='px-3 py-2 rounded border-l-4' style={{ borderColor: color, backgroundColor: '#faf5f0' }}>
              {data.title && <p className='font-semibold text-xs'>{data.title}</p>}
              {data.dateStart && (
                <p className='text-[10px] text-gray-600'>
                  {l.serviceDate}: {formatDate(data.dateStart)}
                  {data.dateEnd && data.dateEnd !== data.dateStart && ` — ${formatDate(data.dateEnd)}`}
                </p>
              )}
              {data.orderNumber && (
                <p className='text-[10px] text-gray-500'>{l.orderNumber}: {data.orderNumber}</p>
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
                  {data.items.map((item, i) => (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className='px-2 py-1.5'>
                        <span className='font-medium'>{item.name}</span>
                        {item.description && <span className='block text-gray-500 text-[9px]'>{item.description}</span>}
                      </td>
                      <td className='text-center px-2 py-1.5'>{item.quantity}</td>
                      <td className='text-right px-2 py-1.5'>{(item.unit_price || 0).toFixed(2)} €</td>
                      <td className='text-center px-2 py-1.5'>{item.tva_rate}%</td>
                      <td className='text-right px-2 py-1.5'>{((item.total_ht as number) || 0).toFixed(2)} €</td>
                      <td className='text-right px-2 py-1.5'>{((item.total_ttc as number) || 0).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Discount */}
          {data.discountPercentage > 0 && (
            <div className='flex justify-end'>
              <div className='text-right text-[10px] text-gray-600'>
                {l.discount}: -{data.discountPercentage}%
              </div>
            </div>
          )}

          {/* Totals */}
          <div className='flex justify-end'>
            <div className='w-56 space-y-1'>
              <div className='flex justify-between text-[10px]'>
                <span className='text-gray-600'>{l.subtotalHt}</span>
                <span className='font-medium'>{data.totalHt.toFixed(2)} €</span>
              </div>
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
          <DocumentFooter restaurant={restaurant} />
        </div>

        <ConditionsPage title={l.generalConditions} conditions={data.conditionsDevis} color={color} />
      </div>
    )
  }

  // ── ACOMPTE ──
  if (documentType === 'acompte') {
    const depositHt = data.totalHt * (data.depositPercentage / 100)
    const avgTvaRate = data.totalHt > 0 ? ((data.totalTtc - data.totalHt) / data.totalHt) * 100 : 20
    const depositTva = depositHt * (avgTvaRate / 100)
    const depositTtc = depositHt + depositTva

    return (
      <div id='quote-preview-content' className='bg-white text-black rounded-lg shadow-sm border text-[11px] leading-relaxed'>
        <div className='p-6 space-y-5'>
          <DocumentHeader
            restaurant={restaurant}
            docTitle={data.language === 'fr' ? "Facture d'acompte" : 'Deposit invoice'}
            docNumber={quoteNumber}
            date={formatDate(data.quoteDate)}
            dueDate={addDays(data.quoteDate, data.invoiceDueDays)}
            color={color}
          />

          <IssuerClientBlock restaurant={restaurant} contact={data.contact} l={l} />

          {/* Event title */}
          {(data.title || data.dateStart) && (
            <div className='px-3 py-3 rounded border' style={{ borderColor: color + '40' }}>
              {data.title && <p className='font-semibold text-xs'>{data.title}</p>}
              {data.dateStart && (
                <div className='mt-1'>
                  <p className='text-[10px] font-semibold'>{l.serviceStart}</p>
                  <p className='text-[10px] text-gray-600'>{formatDateLong(data.dateStart)}</p>
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

          {/* Single line: deposit */}
          <div className='border rounded overflow-hidden'>
            <table className='w-full text-[10px]'>
              <thead>
                <tr style={{ backgroundColor: color, color: 'white' }}>
                  <th className='text-left px-2 py-1.5 font-medium'>{l.designation}</th>
                  <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalHt}</th>
                  <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalTtc}</th>
                </tr>
              </thead>
              <tbody>
                <tr className='bg-white'>
                  <td className='px-2 py-1.5 font-medium'>
                    {l.depositFor}{quoteNumber} ({data.depositPercentage}%)
                  </td>
                  <td className='text-right px-2 py-1.5'>{depositHt.toFixed(2)} €</td>
                  <td className='text-right px-2 py-1.5'>{depositTtc.toFixed(2)} €</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className='flex items-end justify-between'>
            <BankDetails restaurant={restaurant} l={l} />
            <div className='w-56 space-y-1'>
              <div className='flex justify-between text-[10px]'>
                <span className='text-gray-600'>{l.totalHt}</span>
                <span className='font-medium' style={{ color }}>{depositHt.toFixed(2)} €</span>
              </div>
              <div className='flex justify-between text-[10px]'>
                <span className='text-gray-600'>TVA {avgTvaRate.toFixed(0)}%</span>
                <span>{depositTva.toFixed(2)} €</span>
              </div>
              <div className='flex justify-between text-xs font-bold px-2 py-1 rounded' style={{ backgroundColor: color, color: 'white' }}>
                <span>{l.totalTtc}</span>
                <span>{depositTtc.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          <DocumentFooter restaurant={restaurant} />
        </div>

        <ConditionsPage title={l.generalConditions} conditions={data.conditionsAcompte} color={color} />
      </div>
    )
  }

  // ── SOLDE ──
  const depositHt = data.totalHt * (data.depositPercentage / 100)
  const balanceHt = data.totalHt - depositHt
  const avgTvaRate = data.totalHt > 0 ? ((data.totalTtc - data.totalHt) / data.totalHt) * 100 : 20
  const balanceTva = balanceHt * (avgTvaRate / 100)
  const balanceTtc = balanceHt + balanceTva

  return (
    <div id='quote-preview-content' className='bg-white text-black rounded-lg shadow-sm border text-[11px] leading-relaxed'>
      <div className='p-6 space-y-5'>
        <DocumentHeader
          restaurant={restaurant}
          docTitle={data.language === 'fr' ? 'Facture de solde' : 'Balance invoice'}
          docNumber={quoteNumber}
          date={formatDate(data.quoteDate)}
          dueDate={addDays(data.quoteDate, data.invoiceDueDays)}
          color={color}
        />

        <IssuerClientBlock restaurant={restaurant} contact={data.contact} l={l} />

        {/* Event title */}
        {(data.title || data.dateStart) && (
          <div className='px-3 py-3 rounded border' style={{ borderColor: color + '40' }}>
            {data.title && <p className='font-semibold text-xs'>{data.title}</p>}
            {data.dateStart && (
              <div className='mt-1'>
                <p className='text-[10px] font-semibold'>{l.serviceStart}</p>
                <p className='text-[10px] text-gray-600'>{formatDateLong(data.dateStart)}</p>
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

        {/* Full products table */}
        {data.items.length > 0 && (
          <div className='border rounded overflow-hidden'>
            <table className='w-full text-[10px]'>
              <thead>
                <tr style={{ backgroundColor: color, color: 'white' }}>
                  <th className='text-left px-2 py-1.5 font-medium'>{l.designation}</th>
                  <th className='text-center px-2 py-1.5 font-medium w-12'>{l.quantity}</th>
                  <th className='text-right px-2 py-1.5 font-medium w-20'>{l.unitPriceTtc}</th>
                  <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalHt}</th>
                  <th className='text-right px-2 py-1.5 font-medium w-20'>{l.totalTtc}</th>
                  <th className='text-center px-2 py-1.5 font-medium w-14'>{l.tvaRate}</th>
                </tr>
              </thead>
              <tbody>
                {/* Date header row */}
                {data.dateStart && (
                  <tr>
                    <td colSpan={6} className='px-2 py-1.5 font-semibold text-[10px] border-b' style={{ color }}>
                      {formatDateLong(data.dateStart).replace(/^\w/, c => c.toUpperCase())}
                    </td>
                  </tr>
                )}
                {data.items.map((item, i) => (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className='px-2 py-1.5'>
                      <span className='font-medium'>{item.name}</span>
                      {item.description && <span className='block text-gray-500 text-[9px]'>{item.description}</span>}
                    </td>
                    <td className='text-center px-2 py-1.5'>{item.quantity}</td>
                    <td className='text-right px-2 py-1.5'>{((item.total_ttc as number) || 0).toFixed(2)} €</td>
                    <td className='text-right px-2 py-1.5'>{((item.total_ht as number) || 0).toFixed(2)} €</td>
                    <td className='text-right px-2 py-1.5'>{((item.total_ttc as number) || 0).toFixed(2)} €</td>
                    <td className='text-center px-2 py-1.5'>{item.tva_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals with deposit deduction */}
        <div className='flex items-end justify-between'>
          <BankDetails restaurant={restaurant} l={l} />
          <div className='w-64 space-y-1'>
            <div className='flex justify-between text-[10px]'>
              <span className='text-gray-600'>{l.subtotalBeforeDeposit}</span>
              <span className='font-medium'>{data.totalHt.toFixed(2)} €</span>
            </div>
            <div className='flex justify-between text-[10px]'>
              <span className='text-gray-500'>TTC : {data.totalTtc.toFixed(2)} €</span>
              <span />
            </div>
            <Separator className='bg-gray-300' />
            <div className='border rounded px-2 py-1.5 space-y-0.5'>
              <p className='text-[10px] font-semibold'>{l.depositsHt}</p>
              <div className='flex justify-between text-[10px]'>
                <span style={{ color }}>{l.depositAtSignature}</span>
                <span style={{ color }}>- {depositHt.toFixed(2)} €</span>
              </div>
            </div>
            <Separator className='bg-gray-300' />
            <div className='flex justify-between text-[10px]'>
              <span className='text-gray-600'>{l.totalHt}</span>
              <span className='font-medium'>{balanceHt.toFixed(2)} €</span>
            </div>
            {Object.entries(tvaByRate).map(([rate, val]) => {
              const ratioHt = val.ht / (data.totalHt || 1)
              const rateBalanceTva = (balanceHt * ratioHt) * (Number(rate) / 100)
              return (
                <div key={rate} className='flex justify-between text-[10px]'>
                  <span className='text-gray-600'>TVA {rate}%</span>
                  <span>{rateBalanceTva.toFixed(2)} €</span>
                </div>
              )
            })}
            <div className='flex justify-between text-xs font-bold px-2 py-1 rounded' style={{ backgroundColor: color, color: 'white' }}>
              <span>{l.totalTtc}</span>
              <span>{balanceTtc.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        <DocumentFooter restaurant={restaurant} />
      </div>

      <ConditionsPage title={l.generalConditions} conditions={data.conditionsSolde} color={color} />
    </div>
  )
}
