import { Separator } from '@/components/ui/separator'
import type { QuoteItem } from '@/lib/supabase/types'
import type { BookingWithRelations } from '../hooks/use-bookings'
import type { Restaurant } from '@/features/settings/hooks/use-settings'
import type { QuoteWithItems } from '../hooks/use-quotes'

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
    quoteNumber: 'Devis n°',
    date: 'Date',
    dueDate: 'Échéance',
    issuer: 'Émetteur',
    client: 'Client',
    eventTitle: 'Événement',
    serviceDate: 'Date de prestation',
    designation: 'Désignation',
    quantity: 'Qté',
    unitPriceHt: 'P.U. HT',
    tvaRate: 'TVA',
    totalHt: 'Total HT',
    totalTtc: 'Total TTC',
    subtotalHt: 'Sous-total HT',
    totalTvaLabel: 'Total TVA',
    paymentSchedule: 'Échéancier de paiement',
    bankDetails: 'Coordonnées bancaires',
    generalConditions: 'Conditions générales',
    page: 'Page',
    orderNumber: 'N° commande',
    discount: 'Remise',
    comments: 'Commentaires',
  },
  en: {
    quote: 'QUOTE',
    quoteNumber: 'Quote #',
    date: 'Date',
    dueDate: 'Due date',
    issuer: 'Issuer',
    client: 'Client',
    eventTitle: 'Event',
    serviceDate: 'Service date',
    designation: 'Description',
    quantity: 'Qty',
    unitPriceHt: 'Unit price',
    tvaRate: 'VAT',
    totalHt: 'Total excl. VAT',
    totalTtc: 'Total incl. VAT',
    subtotalHt: 'Subtotal excl. VAT',
    totalTvaLabel: 'Total VAT',
    paymentSchedule: 'Payment schedule',
    bankDetails: 'Bank details',
    generalConditions: 'General conditions',
    page: 'Page',
    orderNumber: 'Order #',
    discount: 'Discount',
    comments: 'Comments',
  },
}

export function QuotePreview({ data }: Props) {
  const l = labels[data.language]
  const restaurant = data.restaurant as any

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
  const conditions = data.conditionsDevis

  return (
    <div id='quote-preview-content' className='bg-white text-black rounded-lg shadow-sm border text-[11px] leading-relaxed'>
      {/* ── Page 1 ── */}
      <div className='p-6 space-y-5'>
        {/* Header */}
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            {restaurant?.logo_url && (
              <img src={restaurant.logo_url} alt='' className='h-10 w-10 rounded object-contain' />
            )}
            <div>
              <h1 className='text-sm font-bold' style={{ color: restaurant?.color || '#7c2d12' }}>
                {restaurant?.name || 'Restaurant'}
              </h1>
              {restaurant?.address && (
                <p className='text-[10px] text-gray-500'>
                  {restaurant.address}
                  {restaurant.postal_code && `, ${restaurant.postal_code}`}
                  {restaurant.city && ` ${restaurant.city}`}
                </p>
              )}
            </div>
          </div>
          <div className='text-right'>
            <div
              className='text-xs font-bold px-3 py-1 rounded'
              style={{ backgroundColor: restaurant?.color || '#7c2d12', color: 'white' }}
            >
              {l.quote}
            </div>
          </div>
        </div>

        {/* Quote info bar */}
        <div
          className='flex items-center justify-between px-3 py-2 rounded text-white text-[10px]'
          style={{ backgroundColor: restaurant?.color || '#7c2d12' }}
        >
          <span>{l.quoteNumber} <strong>{quoteNumber}</strong></span>
          <span>{l.date}: <strong>{formatDate(data.quoteDate)}</strong></span>
          <span>{l.dueDate}: <strong>{addDays(data.quoteDate, data.quoteDueDays)}</strong></span>
        </div>

        {/* Issuer / Client */}
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-1'>
            <h3 className='text-[10px] font-bold uppercase text-gray-400'>{l.issuer}</h3>
            <p className='font-semibold'>{restaurant?.company_name || restaurant?.name || ''}</p>
            {restaurant?.address && <p className='text-gray-600'>{restaurant.address}</p>}
            {(restaurant?.postal_code || restaurant?.city) && (
              <p className='text-gray-600'>{restaurant?.postal_code} {restaurant?.city}</p>
            )}
            {restaurant?.phone && <p className='text-gray-600'>Tél: {restaurant.phone}</p>}
            {restaurant?.email && <p className='text-gray-600'>{restaurant.email}</p>}
            {restaurant?.siret && <p className='text-gray-500 text-[10px]'>SIRET: {restaurant.siret}</p>}
            {restaurant?.tva_number && <p className='text-gray-500 text-[10px]'>TVA: {restaurant.tva_number}</p>}
          </div>
          <div className='space-y-1'>
            <h3 className='text-[10px] font-bold uppercase text-gray-400'>{l.client}</h3>
            {data.contact?.company && (
              <p className='font-semibold'>{data.contact.company.name}</p>
            )}
            <p className={data.contact?.company ? '' : 'font-semibold'}>
              {data.contact?.first_name} {data.contact?.last_name || ''}
            </p>
            {data.contact?.company?.billing_address && (
              <p className='text-gray-600'>{data.contact.company.billing_address}</p>
            )}
            {(data.contact?.company?.billing_postal_code || data.contact?.company?.billing_city) && (
              <p className='text-gray-600'>
                {data.contact?.company?.billing_postal_code} {data.contact?.company?.billing_city}
              </p>
            )}
            {data.contact?.email && <p className='text-gray-600'>{data.contact.email}</p>}
            {data.contact?.phone && <p className='text-gray-600'>{data.contact.phone}</p>}
          </div>
        </div>

        {/* Event title */}
        {(data.title || data.dateStart) && (
          <div
            className='px-3 py-2 rounded border-l-4'
            style={{ borderColor: restaurant?.color || '#7c2d12', backgroundColor: '#faf5f0' }}
          >
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

        {/* Products table */}
        {data.items.length > 0 && (
          <div className='border rounded overflow-hidden'>
            <table className='w-full text-[10px]'>
              <thead>
                <tr style={{ backgroundColor: restaurant?.color || '#7c2d12', color: 'white' }}>
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
            <div
              className='flex justify-between text-xs font-bold px-2 py-1 rounded'
              style={{ backgroundColor: restaurant?.color || '#7c2d12', color: 'white' }}
            >
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

        {/* Bank details */}
        {(restaurant?.iban || restaurant?.bic) && (
          <div className='space-y-1'>
            <h3 className='text-[10px] font-bold uppercase text-gray-400'>{l.bankDetails}</h3>
            <div className='bg-gray-50 rounded px-3 py-2 text-[10px] space-y-0.5'>
              {restaurant?.iban && <p><span className='text-gray-500'>IBAN:</span> {restaurant.iban}</p>}
              {restaurant?.bic && <p><span className='text-gray-500'>BIC:</span> {restaurant.bic}</p>}
            </div>
          </div>
        )}

        {/* Comments */}
        {comments && (
          <div className='space-y-1'>
            <h3 className='text-[10px] font-bold uppercase text-gray-400'>{l.comments}</h3>
            <p className='text-[10px] text-gray-600 whitespace-pre-line'>{comments}</p>
          </div>
        )}

        {/* Footer */}
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
      </div>

      {/* ── Page 2: Conditions ── */}
      {conditions && (
        <div className='border-t-2 border-dashed border-gray-200 p-6 space-y-3'>
          <h2
            className='text-xs font-bold'
            style={{ color: restaurant?.color || '#7c2d12' }}
          >
            {l.generalConditions}
          </h2>
          <div className='text-[9px] text-gray-600 whitespace-pre-line leading-relaxed'>
            {conditions}
          </div>
        </div>
      )}
    </div>
  )
}
