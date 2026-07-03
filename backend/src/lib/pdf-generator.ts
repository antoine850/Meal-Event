import { readFileSync } from 'fs'
import type {
  TDocumentDefinitions,
  Content,
  TableCell,
} from 'pdfmake/interfaces'
import {
  formatEuroAdaptive,
  formatEuroDecimal,
  computeDepositAmounts,
  displayUnitTtc,
} from './quote-rounding.js'
import { supabase } from './supabase.js'

// pdfmake uses a CJS default export — use require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake')

// ── Fonts : Roboto via @fontsource/roboto ──
// Roboto couvre tout Unicode Latin : accents français (é,è,ô…),
// guillemets typographiques («»,"",''…), symbole €, etc.
// Contrairement à Helvetica (police PDF standard), Roboto est embedée
// dans le PDF et rend correctement tous ces caractères.
// eslint-disable-next-line @typescript-eslint/no-var-requires
function robotoFile(name: string): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return readFileSync(require.resolve(`@fontsource/roboto/files/${name}`))
}

const fonts = {
  Roboto: {
    normal: robotoFile('roboto-latin-400-normal.woff'),
    bold: robotoFile('roboto-latin-700-normal.woff'),
    italics: robotoFile('roboto-latin-400-italic.woff'),
    bolditalics: robotoFile('roboto-latin-700-italic.woff'),
  },
}

const printer = new PdfPrinter(fonts)

export function renderPdfToBuffer(
  docDefinition: TDocumentDefinitions
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition)
    const chunks: Uint8Array[] = []
    pdfDoc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)
    pdfDoc.end()
  })
}

export type DocumentType = 'devis' | 'acompte' | 'solde' | 'avoir'

interface QuoteData {
  id: string
  organization_id: string | null
  quote_number: string
  title: string | null
  status: string
  total_ht: number
  total_tva: number
  total_ttc: number
  discount_percentage: number
  deposit_percentage: number
  deposit_amount_override?: number | null
  deposit_label: string | null
  deposit_days: number
  balance_label: string | null
  balance_days: number
  quote_date: string | null
  quote_due_days: number
  invoice_due_days: number
  comments_fr: string | null
  comments_en: string | null
  conditions_devis: string | null
  conditions_facture: string | null
  conditions_acompte: string | null
  conditions_solde: string | null
  additional_conditions: string | null
  language: string
  date_start: string | null
  date_end: string | null
  order_number: string | null
  quote_items: Array<{
    id: string
    name: string
    description: string | null
    quantity: number
    unit_price: number
    unit_price_ttc: number | null
    tva_rate: number
    discount_amount: number
    total_ht: number | null
    total_ttc: number | null
    item_type: string
  }>
  booking: {
    id: string
    event_date: string | null
    start_time: string | null
    end_time: string | null
    occasion: string | null
    guests_count: number | null
    deroulement: string | null
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
        siret?: string | null
        tva_number?: string | null
      } | null
    } | null
    restaurant: {
      id: string
      name: string
      address: string | null
      city: string | null
      postal_code: string | null
      phone: string | null
      email: string | null
      logo_url: string | null
      color: string | null
      siret: string | null
      tva_number: string | null
      iban: string | null
      bic: string | null
      bank_name: string | null
      legal_name: string | null
      legal_form: string | null
      share_capital: string | null
      rcs: string | null
      siren: string | null
    } | null
  } | null
}

// ── Labels by language (matching frontend) ──
const labels = {
  fr: {
    quote: 'DEVIS',
    depositInvoice: "FACTURE D'ACOMPTE",
    balanceInvoice: 'FACTURE DE SOLDE',
    creditNote: "FACTURE D'AVOIR",
    originalInvoiceRef: "Réf. facture d'origine",
    creditReason: 'Motif',
    totalCredited: 'TOTAL AVOIR TTC',
    overpaid: 'Trop-perçu',
    dateOf: 'Date du',
    dueDateLabel: 'Échéance',
    issuer: 'ÉMETTEUR',
    client: 'CLIENT',
    companyName: 'Société',
    name: 'Nom',
    address: 'Adresse',
    siretSiren: 'SIRET',
    vatNumber: 'N° TVA',
    email: 'Email',
    phone: 'Tél',
    billingAddress: 'Adresse facturation',
    serviceDate: 'Date de prestation',
    orderNumber: 'N° commande',
    schedule: 'Déroulé',
    comments: 'Commentaires',
    designation: 'Désignation',
    quantity: 'Qté',
    unitPriceTtc: 'P.U. TTC',
    unitPriceHt: 'P.U. HT',
    tvaRate: 'TVA',
    totalHt: 'Total HT',
    totalTtc: 'Total TTC',
    subtotalHt: 'Sous-total HT',
    totalTvaLabel: 'Total TVA',
    paymentSchedule: 'ÉCHÉANCIER DE PAIEMENT',
    bankDetails: 'COORDONNÉES BANCAIRES',
    generalConditions: 'CONDITIONS GÉNÉRALES',
    additionalConditions: 'CONDITIONS PARTICULIÈRES',
    bankName: 'Banque',
    iban: 'IBAN',
    bic: 'BIC',
    shareCapital: 'au capital de',
    depositFor: 'Acompte pour devis n°',
    relatedQuote: 'Réf. devis',
    depositPercent: 'Acompte',
    balancePercent: 'Solde',
    serviceItems: 'Prestation',
    extras: 'Extras',
    totalWithExtras: 'Total avec extras TTC',
    depositPaid: 'Acompte versé',
    remainingBalance: 'SOLDE RESTANT TTC',
  },
  en: {
    quote: 'QUOTE',
    depositInvoice: 'DEPOSIT INVOICE',
    balanceInvoice: 'BALANCE INVOICE',
    creditNote: 'CREDIT NOTE',
    originalInvoiceRef: 'Original invoice ref.',
    creditReason: 'Reason',
    totalCredited: 'TOTAL CREDIT INCL. VAT',
    overpaid: 'Overpaid',
    dateOf: 'Date of',
    dueDateLabel: 'Due date',
    issuer: 'ISSUER',
    client: 'CLIENT',
    companyName: 'Company',
    name: 'Name',
    address: 'Address',
    siretSiren: 'SIRET',
    vatNumber: 'VAT number',
    email: 'Email',
    phone: 'Phone',
    billingAddress: 'Billing address',
    serviceDate: 'Service date',
    orderNumber: 'Order #',
    schedule: 'Schedule',
    comments: 'Comments',
    designation: 'Description',
    quantity: 'Qty',
    unitPriceTtc: 'Price incl. VAT',
    unitPriceHt: 'Unit price',
    tvaRate: 'VAT',
    totalHt: 'Total excl. VAT',
    totalTtc: 'Total incl. VAT',
    subtotalHt: 'Subtotal excl. VAT',
    totalTvaLabel: 'Total VAT',
    paymentSchedule: 'PAYMENT SCHEDULE',
    bankDetails: 'BANK DETAILS',
    generalConditions: 'GENERAL CONDITIONS',
    additionalConditions: 'SPECIAL TERMS',
    bankName: 'Bank',
    iban: 'IBAN',
    bic: 'BIC',
    shareCapital: 'share capital of',
    depositFor: 'Deposit for quote #',
    relatedQuote: 'Quote ref.',
    depositPercent: 'Deposit',
    balancePercent: 'Balance',
    serviceItems: 'Service',
    extras: 'Extras',
    totalWithExtras: 'Total with extras incl. VAT',
    depositPaid: 'Deposit paid',
    remainingBalance: 'REMAINING BALANCE',
  },
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function addDays(dateStr: string | null | undefined, days: number): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

// Résout le montant TTC de l'acompte : montant fixe si défini, sinon % du TTC (au centime).
function resolveDepositTtc(
  quote: Pick<
    QuoteData,
    'total_ttc' | 'deposit_percentage' | 'deposit_amount_override'
  >
): number {
  return computeDepositAmounts(quote.total_ttc, 0, {
    overrideTtc: quote.deposit_amount_override ?? null,
    percentage: quote.deposit_percentage,
  }).ttc
}

// Résout le montant HT de l'acompte, ventilé au prorata du HT global (au centime).
function resolveDepositHt(
  quote: Pick<
    QuoteData,
    'total_ttc' | 'total_ht' | 'deposit_percentage' | 'deposit_amount_override'
  >
): number {
  return computeDepositAmounts(quote.total_ttc, quote.total_ht, {
    overrideTtc: quote.deposit_amount_override ?? null,
    percentage: quote.deposit_percentage,
  }).ht
}

// Libellé du % affiché sur la facture acompte / planning de paiement
function resolveDepositLabel(
  quote: Pick<
    QuoteData,
    'total_ttc' | 'deposit_percentage' | 'deposit_amount_override'
  >,
  prefix: string
): string {
  if (quote.deposit_amount_override != null) return prefix // "Acompte" sans %
  return `${prefix} ${quote.deposit_percentage}%`
}

// % effectif pour le tableau du planning (devis)
function resolveDepositPctDisplay(
  quote: Pick<
    QuoteData,
    'total_ttc' | 'deposit_percentage' | 'deposit_amount_override'
  >
): string {
  if (quote.deposit_amount_override != null) {
    if (quote.total_ttc === 0) return '—'
    return `${Math.round((quote.deposit_amount_override / quote.total_ttc) * 100)}%`
  }
  return `${quote.deposit_percentage}%`
}

function resolveBalancePctDisplay(
  quote: Pick<
    QuoteData,
    'total_ttc' | 'deposit_percentage' | 'deposit_amount_override'
  >
): string {
  if (quote.deposit_amount_override != null) {
    if (quote.total_ttc === 0) return '—'
    return `${Math.round(((quote.total_ttc - quote.deposit_amount_override) / quote.total_ttc) * 100)}%`
  }
  return `${100 - quote.deposit_percentage}%`
}

// Helper to lighten a hex color
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const G = ((num >> 8) & 0x00ff) + amt
  const B = (num & 0x0000ff) + amt
  return `#${(
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  )
    .toString(16)
    .slice(1)}`
}

export async function fetchQuoteFullData(quoteId: string): Promise<QuoteData> {
  const { data, error } = await supabase
    .from('quotes')
    .select(
      `
      *,
      quote_items(*),
      booking:bookings(
        id, event_date, start_time, end_time, occasion, guests_count, deroulement,
        contact:contacts(
          id, first_name, last_name, email, phone,
          company:companies(name, billing_address, billing_city, billing_postal_code, siret, tva_number)
        ),
        restaurant:restaurants(
          id, name, address, city, postal_code, phone, email,
          logo_url, color, siret, tva_number, iban, bic, bank_name,
          legal_name, legal_form, share_capital, rcs, siren,
          company_name, billing_address, billing_postal_code, billing_city, billing_email,
          stripe_enabled
        )
      )
    `
    )
    .eq('id', quoteId)
    .order('position', { referencedTable: 'quote_items', ascending: true })
    .single()

  if (error) throw new Error(`Failed to fetch quote: ${error.message}`)
  return data as unknown as QuoteData
}

export async function generateQuotePdf(
  quoteId: string,
  documentType: DocumentType,
  prefetchedData?: QuoteData
): Promise<Buffer> {
  const quote = prefetchedData || (await fetchQuoteFullData(quoteId))
  const booking = quote.booking
  const restaurant = booking?.restaurant ?? null
  const contact = booking?.contact ?? null
  const color = restaurant?.color || '#0d7377'
  const items = (quote.quote_items || []).filter(
    (i) => i.item_type === 'product'
  )
  const extras = (quote.quote_items || []).filter(
    (i) => i.item_type === 'extra'
  )
  const lang = (quote.language === 'en' ? 'en' : 'fr') as 'fr' | 'en'

  // Fetch paid payments for solde invoice
  let paidPayments: {
    amount: number
    payment_modality: string | null
    payment_type: string | null
    paid_at: string | null
  }[] = []
  if (documentType === 'solde' && booking?.id) {
    const { data } = await supabase
      .from('payments')
      .select('amount, payment_modality, payment_type, paid_at')
      .eq('booking_id', booking.id)
      .in('status', ['paid', 'completed'])
    paidPayments = (data || []) as any[]
  }

  const docDefinition = buildDocDefinition(
    quote,
    restaurant,
    contact,
    items,
    extras,
    documentType,
    color,
    lang,
    paidPayments
  )

  return renderPdfToBuffer(docDefinition)
}

type BookingData = NonNullable<QuoteData['booking']>

function buildDocDefinition(
  quote: QuoteData,
  restaurant: BookingData['restaurant'],
  contact: BookingData['contact'],
  items: QuoteData['quote_items'],
  extras: QuoteData['quote_items'],
  documentType: DocumentType,
  color: string,
  lang: 'fr' | 'en',
  paidPayments: {
    amount: number
    payment_modality: string | null
    payment_type: string | null
    paid_at: string | null
  }[] = []
): TDocumentDefinitions {
  const content: Content[] = []
  const l = labels[lang]

  // ── Document titles ──
  const docTitles: Record<DocumentType, string> = {
    devis: l.quote,
    acompte: l.depositInvoice,
    solde: l.balanceInvoice,
    avoir: l.creditNote,
  }

  const dueDays =
    documentType === 'devis' ? quote.quote_due_days : quote.invoice_due_days
  const docTitle = docTitles[documentType]

  // ══════════════════════════════════════════════════════════════════
  // HEADER - Colored banner with restaurant name and document info
  // ══════════════════════════════════════════════════════════════════
  content.push({
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          {
            stack: [
              {
                text: restaurant?.name || 'Restaurant',
                style: 'headerTitle',
                color: 'white',
              },
            ],
            fillColor: color,
            margin: [12, 10, 12, 10] as [number, number, number, number],
          },
          {
            stack: [
              {
                text: `${docTitle} n°${quote.quote_number}`,
                style: 'headerDocTitle',
                color: 'white',
                alignment: 'right' as const,
              },
              {
                text: `${l.dateOf} ${docTitle.toLowerCase()} – ${formatDate(quote.quote_date)}`,
                style: 'headerSmall',
                color: 'white',
                alignment: 'right' as const,
              },
              {
                text: `${l.dueDateLabel} – ${addDays(quote.quote_date, dueDays)}`,
                style: 'headerSmall',
                color: 'white',
                alignment: 'right' as const,
              },
            ],
            fillColor: color,
            margin: [12, 10, 12, 10] as [number, number, number, number],
          },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 15] as [number, number, number, number],
  })

  // ══════════════════════════════════════════════════════════════════
  // ISSUER / CLIENT BLOCK
  // ══════════════════════════════════════════════════════════════════
  content.push({
    columns: [
      {
        width: '50%',
        stack: [
          { text: l.issuer, style: 'sectionLabel' },
          ...(restaurant?.legal_name
            ? [
                {
                  text: `${l.companyName} – ${restaurant.legal_name}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
          { text: `${l.name} – ${restaurant?.name || ''}`, style: 'bold' },
          ...(restaurant?.address
            ? [
                {
                  text: `${l.address} – ${restaurant.address}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
          ...(restaurant?.postal_code || restaurant?.city
            ? [
                {
                  text: `${restaurant?.postal_code || ''} ${restaurant?.city || ''}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
          ...(restaurant?.siret
            ? [
                {
                  text: `${l.siretSiren} – ${restaurant.siret}`,
                  style: 'tiny' as const,
                  color: '#888',
                },
              ]
            : []),
          ...(restaurant?.tva_number
            ? [
                {
                  text: `${l.vatNumber} – ${restaurant.tva_number}`,
                  style: 'tiny' as const,
                  color: '#888',
                },
              ]
            : []),
          ...(restaurant?.email
            ? [
                {
                  text: `${l.email} – ${restaurant.email}`,
                  style: 'tiny' as const,
                  color: '#888',
                },
              ]
            : []),
        ],
      },
      {
        width: '50%',
        stack: [
          { text: l.client, style: 'sectionLabel' },
          ...(contact?.company
            ? [{ text: contact.company.name, style: 'bold' as const }]
            : []),
          {
            text: `${l.name} – ${contact?.first_name || ''} ${contact?.last_name || ''}`,
            style: contact?.company ? ('small' as const) : ('bold' as const),
            color: contact?.company ? '#666' : undefined,
          },
          ...(contact?.email
            ? [
                {
                  text: `${l.email} – ${contact.email}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
          ...(contact?.phone
            ? [
                {
                  text: `${l.phone} – ${contact.phone}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
          ...(contact?.company?.billing_address
            ? [
                {
                  text: `${l.billingAddress} – ${contact.company.billing_address}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
          ...(contact?.company?.billing_postal_code ||
          contact?.company?.billing_city
            ? [
                {
                  text: `${contact?.company?.billing_postal_code || ''} ${contact?.company?.billing_city || ''}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
        ],
      },
    ],
    margin: [0, 0, 0, 15] as [number, number, number, number],
  })

  // ══════════════════════════════════════════════════════════════════
  // EVENT TITLE BLOCK (with left border)
  // ══════════════════════════════════════════════════════════════════
  if (quote.title || quote.date_start) {
    content.push({
      table: {
        widths: [3, '*'],
        body: [
          [
            { text: '', fillColor: color },
            {
              stack: [
                ...(quote.title
                  ? [{ text: quote.title, style: 'bold' as const }]
                  : []),
                ...(quote.date_start
                  ? [
                      {
                        text: `${l.serviceDate}: ${formatDate(quote.date_start)}${quote.booking?.start_time ? ` à ${quote.booking.start_time}` : ''}${quote.booking?.end_time ? ` — ${quote.booking.end_time}` : ''}${quote.date_end && quote.date_end !== quote.date_start ? ` | ${formatDate(quote.date_end)}` : ''}`,
                        style: 'small' as const,
                        color: '#666',
                      },
                    ]
                  : []),
                ...(quote.order_number
                  ? [
                      {
                        text: `${l.orderNumber}: ${quote.order_number}`,
                        style: 'small' as const,
                        color: '#666',
                      },
                    ]
                  : []),
              ],
              fillColor: '#faf5f0',
              margin: [8, 6, 8, 6] as [number, number, number, number],
            },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 10] as [number, number, number, number],
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // SCHEDULE / DÉROULÉ BLOCK
  // ══════════════════════════════════════════════════════════════════
  if (quote.booking?.deroulement) {
    content.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                {
                  text: l.schedule,
                  style: 'tiny' as const,
                  bold: true,
                  color: '#9ca3af',
                },
                {
                  text: quote.booking.deroulement,
                  style: 'small' as const,
                  color: '#666',
                },
              ],
              margin: [8, 6, 8, 6] as [number, number, number, number],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => '#e5e7eb',
        vLineColor: () => '#e5e7eb',
      },
      margin: [0, 0, 0, 10] as [number, number, number, number],
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // COMMENTS BLOCK (amber/yellow background)
  // ══════════════════════════════════════════════════════════════════
  const comments = lang === 'en' ? quote.comments_en : quote.comments_fr
  if (comments) {
    content.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                {
                  text: l.comments,
                  style: 'tiny' as const,
                  bold: true,
                  color: '#92400e',
                },
                { text: comments, style: 'small' as const, color: '#666' },
              ],
              fillColor: '#fef3c7',
              margin: [8, 6, 8, 6] as [number, number, number, number],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => '#fcd34d',
        vLineColor: () => '#fcd34d',
      },
      margin: [0, 0, 0, 10] as [number, number, number, number],
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // PRODUCTS TABLE
  // ══════════════════════════════════════════════════════════════════
  if (documentType === 'devis' || documentType === 'acompte') {
    if (items.length > 0) {
      const tableBody: TableCell[][] = [
        [
          {
            text: l.designation,
            style: 'tableHeader',
            fillColor: color,
            color: 'white',
          },
          {
            text: l.quantity,
            style: 'tableHeader',
            fillColor: color,
            color: 'white',
            alignment: 'center' as const,
          },
          {
            text: l.unitPriceHt,
            style: 'tableHeader',
            fillColor: color,
            color: 'white',
            alignment: 'right' as const,
          },
          {
            text: l.unitPriceTtc,
            style: 'tableHeader',
            fillColor: color,
            color: 'white',
            alignment: 'right' as const,
          },
          {
            text: l.tvaRate,
            style: 'tableHeader',
            fillColor: color,
            color: 'white',
            alignment: 'center' as const,
          },
          {
            text: l.totalHt,
            style: 'tableHeader',
            fillColor: color,
            color: 'white',
            alignment: 'right' as const,
          },
          {
            text: l.totalTtc,
            style: 'tableHeader',
            fillColor: color,
            color: 'white',
            alignment: 'right' as const,
          },
        ],
      ]

      items.forEach((item, i) => {
        const rowColor = i % 2 === 0 ? '#ffffff' : '#f9fafb'
        const base = (item.quantity || 1) * (item.unit_price || 0)
        const discountAmt = item.discount_amount || 0
        const discountPct =
          discountAmt > 0 && base > 0
            ? Math.round((discountAmt / base) * 1000) / 10
            : 0
        const discountWord = lang === 'fr' ? 'Remise' : 'Discount'
        tableBody.push([
          {
            stack: [
              discountPct > 0
                ? {
                    text: [
                      { text: item.name, bold: true },
                      {
                        text: `   -${discountPct}%`,
                        color: '#dc2626',
                        bold: true,
                        fontSize: 7,
                      },
                    ],
                    style: 'tableCell',
                  }
                : { text: item.name, style: 'tableCell', bold: true },
              ...(item.description
                ? [
                    {
                      text: item.description,
                      style: 'tiny' as const,
                      color: '#888',
                    },
                  ]
                : []),
              ...(discountPct > 0
                ? [
                    {
                      text: `${discountWord} -${formatEuroDecimal(discountAmt)} HT`,
                      fontSize: 7,
                      color: '#dc2626' as const,
                    },
                  ]
                : []),
            ],
            fillColor: rowColor,
          },
          {
            text: String(item.quantity),
            style: 'tableCell',
            alignment: 'center' as const,
            fillColor: rowColor,
          },
          {
            text: formatEuroDecimal(item.unit_price),
            style: 'tableCell',
            alignment: 'right' as const,
            fillColor: rowColor,
            ...(discountPct > 0
              ? { decoration: 'lineThrough' as const, color: '#9ca3af' }
              : {}),
          },
          {
            text: formatEuroDecimal(displayUnitTtc(item)),
            style: 'tableCell',
            alignment: 'right' as const,
            fillColor: rowColor,
            ...(discountPct > 0
              ? { decoration: 'lineThrough' as const, color: '#9ca3af' }
              : {}),
          },
          {
            text: `${item.tva_rate}%`,
            style: 'tableCell',
            alignment: 'center' as const,
            fillColor: rowColor,
          },
          {
            text: formatEuroDecimal(item.total_ht || 0),
            style: 'tableCell',
            alignment: 'right' as const,
            fillColor: rowColor,
          },
          {
            text: formatEuroAdaptive(item.total_ttc || 0),
            style: 'tableCell',
            alignment: 'right' as const,
            fillColor: rowColor,
          },
        ])
      })

      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 35, 60, 60, 35, 60, 60],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: any) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i: number) => (i === 0 || i === 1 ? color : '#e5e7eb'),
          vLineColor: () => '#e5e7eb',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 10] as [number, number, number, number],
      })
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // SOLDE: Combined products + extras table
  // ══════════════════════════════════════════════════════════════════
  if (documentType === 'solde') {
    const tableBody: TableCell[][] = [
      [
        {
          text: l.designation,
          style: 'tableHeader',
          fillColor: color,
          color: 'white',
        },
        {
          text: l.quantity,
          style: 'tableHeader',
          fillColor: color,
          color: 'white',
          alignment: 'center' as const,
        },
        {
          text: l.unitPriceHt,
          style: 'tableHeader',
          fillColor: color,
          color: 'white',
          alignment: 'right' as const,
        },
        {
          text: l.unitPriceTtc,
          style: 'tableHeader',
          fillColor: color,
          color: 'white',
          alignment: 'right' as const,
        },
        {
          text: l.tvaRate,
          style: 'tableHeader',
          fillColor: color,
          color: 'white',
          alignment: 'center' as const,
        },
        {
          text: l.totalHt,
          style: 'tableHeader',
          fillColor: color,
          color: 'white',
          alignment: 'right' as const,
        },
        {
          text: l.totalTtc,
          style: 'tableHeader',
          fillColor: color,
          color: 'white',
          alignment: 'right' as const,
        },
      ],
    ]

    if (items.length > 0) {
      tableBody.push([
        {
          text: l.serviceItems,
          colSpan: 7,
          style: 'bold' as const,
          fillColor: '#f3f4f6',
          color,
        } as TableCell,
        {},
        {},
        {},
        {},
        {},
        {},
      ])
      items.forEach((item) => {
        const base = (item.quantity || 1) * (item.unit_price || 0)
        const discountAmt = item.discount_amount || 0
        const discountPct =
          discountAmt > 0 && base > 0
            ? Math.round((discountAmt / base) * 1000) / 10
            : 0
        const discountWord = lang === 'fr' ? 'Remise' : 'Discount'
        tableBody.push([
          {
            stack: [
              discountPct > 0
                ? {
                    text: [
                      { text: item.name, bold: true },
                      {
                        text: `   -${discountPct}%`,
                        color: '#dc2626',
                        bold: true,
                        fontSize: 7,
                      },
                    ],
                    style: 'tableCell',
                  }
                : { text: item.name, style: 'tableCell', bold: true },
              ...(item.description
                ? [
                    {
                      text: item.description,
                      style: 'tiny' as const,
                      color: '#888',
                    },
                  ]
                : []),
              ...(discountPct > 0
                ? [
                    {
                      text: `${discountWord} -${formatEuroDecimal(discountAmt)} HT`,
                      fontSize: 7,
                      color: '#dc2626' as const,
                    },
                  ]
                : []),
            ],
          },
          {
            text: String(item.quantity),
            style: 'tableCell',
            alignment: 'center' as const,
          },
          {
            text: formatEuroDecimal(item.unit_price),
            style: 'tableCell',
            alignment: 'right' as const,
            ...(discountPct > 0
              ? { decoration: 'lineThrough' as const, color: '#9ca3af' }
              : {}),
          },
          {
            text: formatEuroDecimal(displayUnitTtc(item)),
            style: 'tableCell',
            alignment: 'right' as const,
            ...(discountPct > 0
              ? { decoration: 'lineThrough' as const, color: '#9ca3af' }
              : {}),
          },
          {
            text: `${item.tva_rate}%`,
            style: 'tableCell',
            alignment: 'center' as const,
          },
          {
            text: formatEuroDecimal(item.total_ht || 0),
            style: 'tableCell',
            alignment: 'right' as const,
          },
          {
            text: formatEuroAdaptive(item.total_ttc || 0),
            style: 'tableCell',
            alignment: 'right' as const,
          },
        ])
      })
    }

    if (extras.length > 0) {
      tableBody.push([
        {
          text: l.extras,
          colSpan: 7,
          style: 'bold' as const,
          fillColor: '#fef3c7',
          color,
        } as TableCell,
        {},
        {},
        {},
        {},
        {},
        {},
      ])
      extras.forEach((extra) => {
        const base = (extra.quantity || 1) * (extra.unit_price || 0)
        const discountAmt = extra.discount_amount || 0
        const discountPct =
          discountAmt > 0 && base > 0
            ? Math.round((discountAmt / base) * 1000) / 10
            : 0
        const discountWord = lang === 'fr' ? 'Remise' : 'Discount'
        tableBody.push([
          {
            stack: [
              discountPct > 0
                ? {
                    text: [
                      { text: extra.name, bold: true },
                      {
                        text: `   -${discountPct}%`,
                        color: '#dc2626',
                        bold: true,
                        fontSize: 7,
                      },
                    ],
                    style: 'tableCell',
                  }
                : { text: extra.name, style: 'tableCell', bold: true },
              ...(extra.description
                ? [
                    {
                      text: extra.description,
                      style: 'tiny' as const,
                      color: '#888',
                    },
                  ]
                : []),
              ...(discountPct > 0
                ? [
                    {
                      text: `${discountWord} -${formatEuroDecimal(discountAmt)} HT`,
                      fontSize: 7,
                      color: '#dc2626' as const,
                    },
                  ]
                : []),
            ],
          },
          {
            text: String(extra.quantity),
            style: 'tableCell',
            alignment: 'center' as const,
          },
          {
            text: formatEuroDecimal(extra.unit_price),
            style: 'tableCell',
            alignment: 'right' as const,
            ...(discountPct > 0
              ? { decoration: 'lineThrough' as const, color: '#9ca3af' }
              : {}),
          },
          {
            text: formatEuroDecimal(displayUnitTtc(extra)),
            style: 'tableCell',
            alignment: 'right' as const,
            ...(discountPct > 0
              ? { decoration: 'lineThrough' as const, color: '#9ca3af' }
              : {}),
          },
          {
            text: `${extra.tva_rate}%`,
            style: 'tableCell',
            alignment: 'center' as const,
          },
          {
            text: formatEuroDecimal(extra.total_ht || 0),
            style: 'tableCell',
            alignment: 'right' as const,
          },
          {
            text: formatEuroAdaptive(extra.total_ttc || 0),
            style: 'tableCell',
            alignment: 'right' as const,
          },
        ])
      })
    }

    if (tableBody.length > 1) {
      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 35, 60, 60, 35, 60, 60],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: any) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i: number) => (i === 0 || i === 1 ? color : '#e5e7eb'),
          vLineColor: () => '#e5e7eb',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 10] as [number, number, number, number],
      })
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // TOTALS SECTION with TVA breakdown
  // ══════════════════════════════════════════════════════════════════

  // Regroupement TVA par taux. TVA = TTC - HT par ligne (verbatim), pas HT * taux ;
  // le taux ne sert qu'au regroupement.
  const tvaByRate: Record<number, { ht: number; tva: number }> = {}
  for (const item of items) {
    const rate = item.tva_rate || 20
    const ht = item.total_ht || 0
    const tva = (item.total_ttc || 0) - ht
    if (!tvaByRate[rate]) tvaByRate[rate] = { ht: 0, tva: 0 }
    tvaByRate[rate].ht += ht
    tvaByRate[rate].tva += tva
  }

  if (documentType === 'devis') {
    const totalsStack: Content[] = []
    const discountPct = quote.discount_percentage || 0

    if (discountPct > 0) {
      // Show pre-discount subtotal, then discount line
      const rawHt = quote.total_ht / (1 - discountPct / 100)
      const discountAmount = rawHt - quote.total_ht
      totalsStack.push(
        {
          columns: [
            { text: l.subtotalHt, style: 'small', color: '#666' },
            {
              text: formatEuroDecimal(rawHt),
              alignment: 'right' as const,
              style: 'small',
              decoration: 'lineThrough' as const,
            },
          ],
          margin: [0, 0, 0, 2] as [number, number, number, number],
        },
        {
          columns: [
            {
              text: `${lang === 'fr' ? 'Remise' : 'Discount'} ${discountPct}%`,
              style: 'small',
              color: '#dc2626',
            },
            {
              text: `- ${formatEuroDecimal(discountAmount)}`,
              alignment: 'right' as const,
              style: 'small',
              color: '#dc2626',
            },
          ],
          margin: [0, 0, 0, 2] as [number, number, number, number],
        },
        {
          columns: [
            {
              text: `${l.subtotalHt} ${lang === 'fr' ? 'après remise' : 'after discount'}`,
              style: 'small',
              color: '#666',
            },
            {
              text: formatEuroDecimal(quote.total_ht),
              alignment: 'right' as const,
              style: 'bold',
            },
          ],
          margin: [0, 0, 0, 2] as [number, number, number, number],
        }
      )
    } else {
      totalsStack.push({
        columns: [
          { text: l.subtotalHt, style: 'small', color: '#666' },
          {
            text: formatEuroDecimal(quote.total_ht),
            alignment: 'right' as const,
            style: 'bold',
          },
        ],
        margin: [0, 0, 0, 2] as [number, number, number, number],
      })
    }

    // TVA par taux après application de la remise globale
    Object.entries(tvaByRate).forEach(([rate, val]) => {
      const discountMult = discountPct > 0 ? 1 - discountPct / 100 : 1
      const tvaAmount = val.tva * discountMult
      totalsStack.push({
        columns: [
          { text: `TVA ${rate}%`, style: 'small', color: '#666' },
          {
            text: formatEuroDecimal(tvaAmount),
            alignment: 'right' as const,
            style: 'small',
          },
        ],
        margin: [0, 0, 0, 2] as [number, number, number, number],
      })
    })

    totalsStack.push(
      {
        columns: [
          { text: l.totalTvaLabel, style: 'small', color: '#666' },
          {
            text: formatEuroDecimal(quote.total_tva),
            alignment: 'right' as const,
            style: 'bold',
          },
        ],
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      {
        canvas: [
          {
            type: 'line' as const,
            x1: 0,
            y1: 0,
            x2: 180,
            y2: 0,
            lineWidth: 1,
            lineColor: '#d1d5db',
          },
        ],
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: l.totalTtc, style: 'bold', color: 'white' },
              {
                text: formatEuroAdaptive(quote.total_ttc),
                style: 'bold',
                color: 'white',
                alignment: 'right' as const,
              },
            ],
          ],
        },
        layout: 'noBorders',
        fillColor: color,
        margin: [0, 0, 0, 0] as [number, number, number, number],
      } as Content
    )

    content.push({
      columns: [
        { width: '*', text: '' },
        { width: 180, stack: totalsStack },
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  } else if (documentType === 'acompte') {
    // Direct TTC calculation (consistent with send-deposit route)
    const depositTtc = resolveDepositTtc(quote)
    const depositHt = resolveDepositHt(quote)
    const depositTva = depositTtc - depositHt
    const discountPct = quote.discount_percentage || 0

    const acompteStack: Content[] = []

    // Show discount context if applicable
    if (discountPct > 0) {
      const rawTtc = quote.total_ttc / (1 - discountPct / 100)
      acompteStack.push(
        {
          columns: [
            {
              text: `Total ${lang === 'fr' ? 'avant remise' : 'before discount'}`,
              style: 'small',
              color: '#999',
            },
            {
              text: formatEuroDecimal(rawTtc),
              alignment: 'right' as const,
              style: 'small',
              color: '#999',
              decoration: 'lineThrough' as const,
            },
          ],
          margin: [0, 0, 0, 2] as [number, number, number, number],
        },
        {
          columns: [
            {
              text: `${lang === 'fr' ? 'Remise' : 'Discount'} ${discountPct}%`,
              style: 'small',
              color: '#dc2626',
            },
            {
              text: `- ${formatEuroDecimal(rawTtc - quote.total_ttc)}`,
              alignment: 'right' as const,
              style: 'small',
              color: '#dc2626',
            },
          ],
          margin: [0, 0, 0, 2] as [number, number, number, number],
        },
        {
          columns: [
            {
              text: `Total TTC ${lang === 'fr' ? 'après remise' : 'after discount'}`,
              style: 'small',
            },
            {
              text: formatEuroAdaptive(quote.total_ttc),
              alignment: 'right' as const,
              style: 'small',
            },
          ],
          margin: [0, 0, 0, 4] as [number, number, number, number],
        }
      )
    }

    acompteStack.push(
      {
        columns: [
          {
            text: resolveDepositLabel(quote, l.depositPercent),
            style: 'small',
          },
          { text: formatEuroDecimal(depositHt), alignment: 'right' as const },
        ],
        margin: [0, 0, 0, 2] as [number, number, number, number],
      },
      {
        columns: [
          { text: 'TVA', style: 'small' },
          { text: formatEuroDecimal(depositTva), alignment: 'right' as const },
        ],
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      {
        canvas: [
          {
            type: 'line' as const,
            x1: 0,
            y1: 0,
            x2: 200,
            y2: 0,
            lineWidth: 1,
            lineColor: '#d1d5db',
          },
        ],
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: l.totalTtc, style: 'bold', color: 'white' },
              {
                text: formatEuroAdaptive(depositTtc),
                style: 'bold',
                color: 'white',
                alignment: 'right' as const,
              },
            ],
          ],
        },
        layout: 'noBorders',
        fillColor: color,
      } as Content,
      {
        text: `${l.relatedQuote}: ${quote.quote_number} — Total: ${formatEuroAdaptive(quote.total_ttc)}`,
        style: 'tiny',
        color: '#888',
        margin: [0, 6, 0, 0] as [number, number, number, number],
      }
    )

    content.push({
      columns: [
        { width: '*', text: '' },
        {
          width: 200,
          stack: acompteStack,
        },
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  } else {
    // Solde — simplified: Total HT, Total TTC, paid payments, remaining balance
    const extrasHt = extras.reduce((sum, e) => sum + (e.total_ht || 0), 0)
    const extrasTtc = extras.reduce((sum, e) => sum + (e.total_ttc || 0), 0)
    const totalHt = quote.total_ht + extrasHt
    const totalTtc = quote.total_ttc + extrasTtc
    const totalPaid = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
    const balanceTtc = totalTtc - totalPaid

    const soldeStack: Content[] = []

    // Total HT (décimal — dérivé du TTC arrondi)
    soldeStack.push({
      columns: [
        { text: 'Total HT', style: 'small' },
        { text: formatEuroDecimal(totalHt), alignment: 'right' as const },
      ],
      margin: [0, 0, 0, 2] as [number, number, number, number],
    })

    // Total TTC
    soldeStack.push({
      columns: [
        { text: 'Total TTC', style: 'small', bold: true },
        {
          text: formatEuroAdaptive(totalTtc),
          alignment: 'right' as const,
          bold: true,
        },
      ],
      margin: [0, 0, 0, 4] as [number, number, number, number],
    })

    // List each paid payment (les anciens paiements peuvent avoir des centimes)
    if (paidPayments.length > 0) {
      for (const p of paidPayments) {
        const label =
          p.payment_modality === 'acompte'
            ? lang === 'fr'
              ? 'Acompte versé'
              : 'Deposit paid'
            : p.payment_modality === 'solde'
              ? lang === 'fr'
                ? 'Solde versé'
                : 'Balance paid'
              : lang === 'fr'
                ? 'Paiement reçu'
                : 'Payment received'
        const dateStr = p.paid_at
          ? new Date(p.paid_at).toLocaleDateString(
              lang === 'fr' ? 'fr-FR' : 'en-US'
            )
          : ''
        soldeStack.push({
          columns: [
            {
              text: `${label}${dateStr ? ` (${dateStr})` : ''}`,
              style: 'small',
              color: '#16a34a',
            },
            {
              text: `- ${formatEuroDecimal(p.amount)}`,
              alignment: 'right' as const,
              color: '#16a34a',
            },
          ],
          margin: [0, 0, 0, 2] as [number, number, number, number],
        })
      }
    }

    // Separator + remaining balance
    soldeStack.push(
      {
        canvas: [
          {
            type: 'line' as const,
            x1: 0,
            y1: 0,
            x2: 240,
            y2: 0,
            lineWidth: 1,
            lineColor: '#d1d5db',
          },
        ],
        margin: [0, 4, 0, 4] as [number, number, number, number],
      },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: l.remainingBalance, style: 'bold', color: 'white' },
              {
                text: formatEuroAdaptive(balanceTtc),
                style: 'bold',
                color: 'white',
                alignment: 'right' as const,
              },
            ],
          ],
        },
        layout: 'noBorders',
        fillColor: color,
      } as Content
    )

    content.push({
      columns: [
        { width: '*', text: '' },
        {
          width: 240,
          stack: soldeStack,
        },
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // PAYMENT SCHEDULE (devis only)
  // ══════════════════════════════════════════════════════════════════
  if (documentType === 'devis') {
    const depositAmount = resolveDepositTtc(quote)
    const balanceAmount = quote.total_ttc - depositAmount

    content.push({
      stack: [
        { text: l.paymentSchedule, style: 'sectionLabel' },
        {
          table: {
            widths: ['*', 50, 40, 80],
            body: [
              [
                {
                  text: quote.deposit_label || 'Acompte à signature',
                  style: 'tableCell',
                  fillColor: '#f9fafb',
                },
                {
                  text: resolveDepositPctDisplay(quote),
                  style: 'tableCell',
                  alignment: 'center' as const,
                  fillColor: '#f9fafb',
                },
                {
                  text: `J-${quote.deposit_days}`,
                  style: 'tableCell',
                  alignment: 'center' as const,
                  fillColor: '#f9fafb',
                },
                {
                  text: formatEuroAdaptive(depositAmount),
                  style: 'tableCell',
                  alignment: 'right' as const,
                  bold: true,
                  fillColor: '#f9fafb',
                },
              ],
              [
                { text: quote.balance_label || 'Solde', style: 'tableCell' },
                {
                  text: resolveBalancePctDisplay(quote),
                  style: 'tableCell',
                  alignment: 'center' as const,
                },
                {
                  text: `J-${quote.balance_days}`,
                  style: 'tableCell',
                  alignment: 'center' as const,
                },
                {
                  text: formatEuroAdaptive(balanceAmount),
                  style: 'tableCell',
                  alignment: 'right' as const,
                  bold: true,
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#e5e7eb',
            vLineColor: () => '#e5e7eb',
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        },
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // BANK DETAILS
  // ══════════════════════════════════════════════════════════════════
  if (restaurant?.iban || restaurant?.bic) {
    content.push({
      stack: [
        { text: l.bankDetails, style: 'sectionLabel' },
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    ...(restaurant.bank_name
                      ? [
                          {
                            text: `${l.bankName} : ${restaurant.bank_name}`,
                            style: 'small' as const,
                            bold: true,
                          },
                        ]
                      : []),
                    ...(restaurant.iban
                      ? [
                          {
                            text: `${l.iban} : ${restaurant.iban}`,
                            style: 'small' as const,
                          },
                        ]
                      : []),
                    ...(restaurant.bic
                      ? [
                          {
                            text: `${l.bic} : ${restaurant.bic}`,
                            style: 'small' as const,
                          },
                        ]
                      : []),
                  ],
                  fillColor: '#f9fafb',
                  margin: [8, 6, 8, 6] as [number, number, number, number],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#e5e7eb',
            vLineColor: () => '#e5e7eb',
          },
        },
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // CONDITIONS
  // ══════════════════════════════════════════════════════════════════
  let conditions = ''
  if (documentType === 'devis') {
    conditions = quote.conditions_devis || ''
  } else if (documentType === 'acompte') {
    conditions = quote.conditions_acompte || ''
  } else {
    conditions = quote.conditions_solde || ''
  }

  // Safety: replace any remaining {{placeholders}} with restaurant data
  if (conditions.includes('{{')) {
    const r = quote.booking?.restaurant
    conditions = conditions
      .replace(
        /\{\{company_name\}\}/g,
        (r as any)?.company_name || (r as any)?.legal_name || r?.name || ''
      )
      .replace(/\{\{legal_form\}\}/g, r?.legal_form || '')
      .replace(
        /\{\{billing_address\}\}/g,
        (r as any)?.billing_address || r?.address || ''
      )
      .replace(
        /\{\{billing_postal_code\}\}/g,
        (r as any)?.billing_postal_code || r?.postal_code || ''
      )
      .replace(
        /\{\{billing_city\}\}/g,
        (r as any)?.billing_city || r?.city || ''
      )
      .replace(/\{\{rcs\}\}/g, r?.rcs || '')
      .replace(/\{\{siren\}\}/g, r?.siren || '')
      .replace(/\{\{siret\}\}/g, r?.siret || '')
      .replace(/\{\{share_capital\}\}/g, r?.share_capital || '')
      .replace(
        /\{\{billing_email\}\}/g,
        (r as any)?.billing_email || r?.email || ''
      )
  }

  if (conditions) {
    content.push({
      stack: [
        { text: l.generalConditions, style: 'sectionLabel', color },
        { text: conditions, style: 'conditions', color: '#666' },
      ],
      margin: [0, 10, 0, 0] as [number, number, number, number],
    })
  }

  if (quote.additional_conditions) {
    content.push({
      stack: [
        { text: l.additionalConditions, style: 'sectionLabel', color },
        {
          text: quote.additional_conditions,
          style: 'conditions',
          color: '#666',
        },
      ],
      margin: [0, 10, 0, 0] as [number, number, number, number],
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════════════
  const footerLine1Parts: string[] = []
  if (restaurant?.legal_name || restaurant?.name)
    footerLine1Parts.push(restaurant.legal_name || restaurant.name || '')
  if (restaurant?.legal_form) footerLine1Parts.push(restaurant.legal_form)
  if (restaurant?.share_capital)
    footerLine1Parts.push(`${l.shareCapital} ${restaurant.share_capital}`)

  const footerLine2Parts: string[] = []
  if (restaurant?.siren) footerLine2Parts.push(`SIREN: ${restaurant.siren}`)
  if (restaurant?.rcs) footerLine2Parts.push(`RCS: ${restaurant.rcs}`)
  if (restaurant?.siret) footerLine2Parts.push(`SIRET: ${restaurant.siret}`)
  if (restaurant?.tva_number)
    footerLine2Parts.push(`${l.vatNumber}: ${restaurant.tva_number}`)

  const footerLine3Parts: string[] = []
  if (restaurant?.email) footerLine3Parts.push(restaurant.email)
  if (restaurant?.phone) footerLine3Parts.push(restaurant.phone)

  return {
    content,
    footer: {
      stack: [
        {
          canvas: [
            {
              type: 'line' as const,
              x1: 30,
              y1: 0,
              x2: 565,
              y2: 0,
              lineWidth: 0.5,
              lineColor: '#e5e7eb',
            },
          ],
        },
        {
          text: footerLine1Parts.join(' — '),
          style: 'footer',
          alignment: 'center' as const,
          margin: [0, 4, 0, 0] as [number, number, number, number],
        },
        {
          text: footerLine2Parts.join(' — '),
          style: 'footer',
          alignment: 'center' as const,
        },
        ...(footerLine3Parts.length > 0
          ? [
              {
                text: footerLine3Parts.join(' — '),
                style: 'footer',
                alignment: 'center' as const,
              },
            ]
          : []),
      ],
      margin: [30, 0, 30, 10] as [number, number, number, number],
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      lineHeight: 1.35,
    },
    styles: {
      headerTitle: { fontSize: 14, bold: true },
      headerDocTitle: { fontSize: 10, bold: true },
      headerSmall: { fontSize: 8 },
      sectionLabel: {
        fontSize: 8,
        bold: true,
        color: '#9ca3af',
        margin: [0, 0, 0, 6] as [number, number, number, number],
      },
      bold: { bold: true, fontSize: 9 },
      small: { fontSize: 8 },
      tiny: { fontSize: 7 },
      normal: { fontSize: 9 },
      tableHeader: { fontSize: 8, bold: true },
      tableCell: { fontSize: 8 },
      conditions: { fontSize: 7, lineHeight: 1.3 },
      footer: { fontSize: 7, color: '#9ca3af' },
    },
    pageMargins: [30, 30, 30, 50] as [number, number, number, number],
  }
}

// ══════════════════════════════════════════════════════════════════
// FACTURE D'AVOIR
// ══════════════════════════════════════════════════════════════════

interface CreditNoteData {
  id: string
  avoir_number: string
  reason: string | null
  issued_at: string | null
  total_ht: number
  total_tva: number
  total_ttc: number
  overpaid_ttc: number
  quote_id: string | null
  credit_note_items: Array<{
    name: string
    description: string | null
    quantity: number
    unit_price: number
    tva_rate: number
    item_type: string
    total_ht: number
    total_ttc: number
    credited_ttc: number
  }>
}

export async function generateCreditNotePdf(
  creditNoteId: string
): Promise<Buffer> {
  const { data, error } = await supabase
    .from('credit_notes')
    .select('*, credit_note_items(*)')
    .eq('id', creditNoteId)
    .single()
  if (error || !data)
    throw new Error(
      `Failed to fetch credit note: ${error?.message || 'not found'}`
    )
  const cn = data as unknown as CreditNoteData

  // Reuse the parent quote for issuer (restaurant legal) + client blocks + origin number.
  const quote = cn.quote_id ? await fetchQuoteFullData(cn.quote_id) : null
  const restaurant = quote?.booking?.restaurant ?? null
  const contact = quote?.booking?.contact ?? null
  const color = restaurant?.color || '#0d7377'
  const lang = (quote?.language === 'en' ? 'en' : 'fr') as 'fr' | 'en'

  const docDefinition = buildCreditNoteDocDefinition(
    cn,
    quote,
    restaurant,
    contact,
    color,
    lang
  )

  return renderPdfToBuffer(docDefinition)
}

function buildCreditNoteDocDefinition(
  cn: CreditNoteData,
  quote: QuoteData | null,
  restaurant: BookingData['restaurant'],
  contact: BookingData['contact'],
  color: string,
  lang: 'fr' | 'en'
): TDocumentDefinitions {
  const content: Content[] = []
  const l = labels[lang]
  const docTitle = l.creditNote

  // ── HEADER ──
  content.push({
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          {
            stack: [
              {
                text: restaurant?.name || 'Restaurant',
                style: 'headerTitle',
                color: 'white',
              },
            ],
            fillColor: color,
            margin: [12, 10, 12, 10] as [number, number, number, number],
          },
          {
            stack: [
              {
                text: `${docTitle} n°${cn.avoir_number}`,
                style: 'headerDocTitle',
                color: 'white',
                alignment: 'right' as const,
              },
              {
                text: `${l.dateOf} ${docTitle.toLowerCase()} – ${formatDate(cn.issued_at)}`,
                style: 'headerSmall',
                color: 'white',
                alignment: 'right' as const,
              },
              ...(quote?.quote_number
                ? [
                    {
                      text: `${l.originalInvoiceRef} – ${quote.quote_number}`,
                      style: 'headerSmall' as const,
                      color: 'white',
                      alignment: 'right' as const,
                    },
                  ]
                : []),
            ],
            fillColor: color,
            margin: [12, 10, 12, 10] as [number, number, number, number],
          },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 15] as [number, number, number, number],
  })

  // ── ISSUER / CLIENT BLOCK ──
  content.push({
    columns: [
      {
        width: '50%',
        stack: [
          { text: l.issuer, style: 'sectionLabel' },
          ...(restaurant?.legal_name
            ? [
                {
                  text: `${l.companyName} – ${restaurant.legal_name}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
          { text: `${l.name} – ${restaurant?.name || ''}`, style: 'bold' },
          ...(restaurant?.address
            ? [
                {
                  text: `${l.address} – ${restaurant.address}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
          ...(restaurant?.postal_code || restaurant?.city
            ? [
                {
                  text: `${restaurant?.postal_code || ''} ${restaurant?.city || ''}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
          ...(restaurant?.siret
            ? [
                {
                  text: `${l.siretSiren} – ${restaurant.siret}`,
                  style: 'tiny' as const,
                  color: '#888',
                },
              ]
            : []),
          ...(restaurant?.tva_number
            ? [
                {
                  text: `${l.vatNumber} – ${restaurant.tva_number}`,
                  style: 'tiny' as const,
                  color: '#888',
                },
              ]
            : []),
          ...(restaurant?.email
            ? [
                {
                  text: `${l.email} – ${restaurant.email}`,
                  style: 'tiny' as const,
                  color: '#888',
                },
              ]
            : []),
        ],
      },
      {
        width: '50%',
        stack: [
          { text: l.client, style: 'sectionLabel' },
          ...(contact?.company
            ? [{ text: contact.company.name, style: 'bold' as const }]
            : []),
          {
            text: `${l.name} – ${contact?.first_name || ''} ${contact?.last_name || ''}`,
            style: contact?.company ? ('small' as const) : ('bold' as const),
            color: contact?.company ? '#666' : undefined,
          },
          ...(contact?.email
            ? [
                {
                  text: `${l.email} – ${contact.email}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
          ...(contact?.company?.billing_address
            ? [
                {
                  text: `${l.billingAddress} – ${contact.company.billing_address}`,
                  style: 'small' as const,
                  color: '#666',
                },
              ]
            : []),
        ],
      },
    ],
    margin: [0, 0, 0, 15] as [number, number, number, number],
  })

  // ── MOTIF ──
  if (cn.reason) {
    content.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                {
                  text: l.creditReason,
                  style: 'tiny' as const,
                  bold: true,
                  color: '#9ca3af',
                },
                { text: cn.reason, style: 'small' as const, color: '#666' },
              ],
              margin: [8, 6, 8, 6] as [number, number, number, number],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => '#e5e7eb',
        vLineColor: () => '#e5e7eb',
      },
      margin: [0, 0, 0, 10] as [number, number, number, number],
    })
  }

  // ── CREDITED LINES TABLE (montants en négatif) ──
  const items = cn.credit_note_items || []
  const tableBody: TableCell[][] = [
    [
      {
        text: l.designation,
        style: 'tableHeader',
        fillColor: color,
        color: 'white',
      },
      {
        text: l.quantity,
        style: 'tableHeader',
        fillColor: color,
        color: 'white',
        alignment: 'center' as const,
      },
      {
        text: l.tvaRate,
        style: 'tableHeader',
        fillColor: color,
        color: 'white',
        alignment: 'center' as const,
      },
      {
        text: l.totalHt,
        style: 'tableHeader',
        fillColor: color,
        color: 'white',
        alignment: 'right' as const,
      },
      {
        text: l.totalTtc,
        style: 'tableHeader',
        fillColor: color,
        color: 'white',
        alignment: 'right' as const,
      },
    ],
  ]

  // HT crédité par ligne, dérivé du credited_ttc (couvre le crédit partiel où total_ht
  // reste le montant plein de la ligne d'origine).
  const creditedHt = (item: CreditNoteData['credit_note_items'][number]) =>
    item.tva_rate <= -100 ? 0 : item.credited_ttc / (1 + item.tva_rate / 100)

  items.forEach((item, i) => {
    const rowColor = i % 2 === 0 ? '#ffffff' : '#f9fafb'
    tableBody.push([
      {
        stack: [
          { text: item.name, style: 'tableCell', bold: true },
          ...(item.description
            ? [
                {
                  text: item.description,
                  style: 'tiny' as const,
                  color: '#888',
                },
              ]
            : []),
        ],
        fillColor: rowColor,
      },
      {
        text: String(item.quantity),
        style: 'tableCell',
        alignment: 'center' as const,
        fillColor: rowColor,
      },
      {
        text: `${item.tva_rate}%`,
        style: 'tableCell',
        alignment: 'center' as const,
        fillColor: rowColor,
      },
      {
        text: formatEuroDecimal(creditedHt(item)),
        style: 'tableCell',
        alignment: 'right' as const,
        fillColor: rowColor,
      },
      {
        text: formatEuroAdaptive(item.credited_ttc),
        style: 'tableCell',
        alignment: 'right' as const,
        fillColor: rowColor,
      },
    ])
  })

  if (tableBody.length > 1) {
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 35, 35, 70, 70],
        body: tableBody,
      },
      layout: {
        hLineWidth: (i: number, node: any) =>
          i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
        vLineWidth: () => 0.5,
        hLineColor: (i: number) => (i === 0 || i === 1 ? color : '#e5e7eb'),
        vLineColor: () => '#e5e7eb',
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 10] as [number, number, number, number],
    })
  }

  // ── TOTALS BOX (crédité, en positif) ──
  // Regroupement TVA par taux : TVA = crédité TTC - crédité HT par ligne (verbatim),
  // pas ht*taux. Le taux ne sert qu'au regroupement.
  const tvaByRate: Record<number, number> = {}
  for (const item of items) {
    const rate = item.tva_rate || 20
    const tva = item.credited_ttc - creditedHt(item)
    tvaByRate[rate] = (tvaByRate[rate] || 0) + tva
  }

  const totalsStack: Content[] = []
  totalsStack.push({
    columns: [
      { text: l.subtotalHt, style: 'small', color: '#666' },
      {
        text: formatEuroDecimal(cn.total_ht),
        alignment: 'right' as const,
        style: 'bold',
      },
    ],
    margin: [0, 0, 0, 2] as [number, number, number, number],
  })
  Object.entries(tvaByRate).forEach(([rate, tva]) => {
    totalsStack.push({
      columns: [
        { text: `TVA ${rate}%`, style: 'small', color: '#666' },
        {
          text: formatEuroDecimal(tva),
          alignment: 'right' as const,
          style: 'small',
        },
      ],
      margin: [0, 0, 0, 2] as [number, number, number, number],
    })
  })
  totalsStack.push(
    {
      columns: [
        { text: l.totalTvaLabel, style: 'small', color: '#666' },
        {
          text: formatEuroDecimal(cn.total_tva),
          alignment: 'right' as const,
          style: 'bold',
        },
      ],
      margin: [0, 0, 0, 4] as [number, number, number, number],
    },
    {
      canvas: [
        {
          type: 'line' as const,
          x1: 0,
          y1: 0,
          x2: 200,
          y2: 0,
          lineWidth: 1,
          lineColor: '#d1d5db',
        },
      ],
      margin: [0, 0, 0, 4] as [number, number, number, number],
    },
    {
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: l.totalCredited, style: 'bold', color: 'white' },
            {
              text: formatEuroAdaptive(cn.total_ttc),
              style: 'bold',
              color: 'white',
              alignment: 'right' as const,
            },
          ],
        ],
      },
      layout: 'noBorders',
      fillColor: color,
    } as Content
  )

  if (cn.overpaid_ttc > 0) {
    totalsStack.push({
      columns: [
        { text: l.overpaid, style: 'small', bold: true, color: '#dc2626' },
        {
          text: formatEuroAdaptive(cn.overpaid_ttc),
          alignment: 'right' as const,
          bold: true,
          color: '#dc2626',
        },
      ],
      margin: [0, 6, 0, 0] as [number, number, number, number],
    })
  }

  content.push({
    columns: [
      { width: '*', text: '' },
      { width: 200, stack: totalsStack },
    ],
    margin: [0, 0, 0, 15] as [number, number, number, number],
  })

  // ── FOOTER (légal émetteur, identique aux autres documents) ──
  const footerLine1Parts: string[] = []
  if (restaurant?.legal_name || restaurant?.name)
    footerLine1Parts.push(restaurant.legal_name || restaurant.name || '')
  if (restaurant?.legal_form) footerLine1Parts.push(restaurant.legal_form)
  if (restaurant?.share_capital)
    footerLine1Parts.push(`${l.shareCapital} ${restaurant.share_capital}`)

  const footerLine2Parts: string[] = []
  if (restaurant?.siren) footerLine2Parts.push(`SIREN: ${restaurant.siren}`)
  if (restaurant?.rcs) footerLine2Parts.push(`RCS: ${restaurant.rcs}`)
  if (restaurant?.siret) footerLine2Parts.push(`SIRET: ${restaurant.siret}`)
  if (restaurant?.tva_number)
    footerLine2Parts.push(`${l.vatNumber}: ${restaurant.tva_number}`)

  const footerLine3Parts: string[] = []
  if (restaurant?.email) footerLine3Parts.push(restaurant.email)
  if (restaurant?.phone) footerLine3Parts.push(restaurant.phone)

  return {
    content,
    footer: {
      stack: [
        {
          canvas: [
            {
              type: 'line' as const,
              x1: 30,
              y1: 0,
              x2: 565,
              y2: 0,
              lineWidth: 0.5,
              lineColor: '#e5e7eb',
            },
          ],
        },
        {
          text: footerLine1Parts.join(' — '),
          style: 'footer',
          alignment: 'center' as const,
          margin: [0, 4, 0, 0] as [number, number, number, number],
        },
        {
          text: footerLine2Parts.join(' — '),
          style: 'footer',
          alignment: 'center' as const,
        },
        ...(footerLine3Parts.length > 0
          ? [
              {
                text: footerLine3Parts.join(' — '),
                style: 'footer',
                alignment: 'center' as const,
              },
            ]
          : []),
      ],
      margin: [30, 0, 30, 10] as [number, number, number, number],
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      lineHeight: 1.35,
    },
    styles: {
      headerTitle: { fontSize: 14, bold: true },
      headerDocTitle: { fontSize: 10, bold: true },
      headerSmall: { fontSize: 8 },
      sectionLabel: {
        fontSize: 8,
        bold: true,
        color: '#9ca3af',
        margin: [0, 0, 0, 6] as [number, number, number, number],
      },
      bold: { bold: true, fontSize: 9 },
      small: { fontSize: 8 },
      tiny: { fontSize: 7 },
      normal: { fontSize: 9 },
      tableHeader: { fontSize: 8, bold: true },
      tableCell: { fontSize: 8 },
      conditions: { fontSize: 7, lineHeight: 1.3 },
      footer: { fontSize: 7, color: '#9ca3af' },
    },
    pageMargins: [30, 30, 30, 50] as [number, number, number, number],
  }
}
