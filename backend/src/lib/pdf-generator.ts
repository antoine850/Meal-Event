import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces'
import { supabase } from './supabase.js'

// pdfmake uses a CJS default export — use require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake')

// ── Fonts (use standard fonts that don't require external files) ──
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
}

const printer = new PdfPrinter(fonts)

export type DocumentType = 'devis' | 'acompte' | 'solde'

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
    tva_rate: number
    discount_amount: number
    total_ht: number | null
    total_ttc: number | null
    item_type: string
  }>
  booking: {
    id: string
    event_date: string | null
    occasion: string | null
    guests_count: number | null
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
    comments: 'Commentaires',
    designation: 'Désignation',
    quantity: 'Qté',
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
    depositFor: "Acompte pour devis n°",
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
    comments: 'Comments',
    designation: 'Description',
    quantity: 'Qty',
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

function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} €`
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
    .select(`
      *,
      quote_items(*),
      booking:bookings(
        id, event_date, occasion, guests_count,
        contact:contacts(
          id, first_name, last_name, email, phone,
          company:companies(name, billing_address, billing_city, billing_postal_code, siret, tva_number)
        ),
        restaurant:restaurants(
          id, name, address, city, postal_code, phone, email,
          logo_url, color, siret, tva_number, iban, bic, bank_name,
          legal_name, legal_form, share_capital, rcs, siren
        )
      )
    `)
    .eq('id', quoteId)
    .single()

  if (error) throw new Error(`Failed to fetch quote: ${error.message}`)
  return data as unknown as QuoteData
}

export async function generateQuotePdf(quoteId: string, documentType: DocumentType, prefetchedData?: QuoteData): Promise<Buffer> {
  const quote = prefetchedData || await fetchQuoteFullData(quoteId)
  const booking = quote.booking
  const restaurant = booking?.restaurant ?? null
  const contact = booking?.contact ?? null
  const color = restaurant?.color || '#0d7377'
  const items = (quote.quote_items || []).filter(i => i.item_type === 'product')
  const extras = (quote.quote_items || []).filter(i => i.item_type === 'extra')
  const lang = (quote.language === 'en' ? 'en' : 'fr') as 'fr' | 'en'

  const docDefinition = buildDocDefinition(quote, restaurant, contact, items, extras, documentType, color, lang)

  return new Promise<Buffer>((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition)
    const chunks: Uint8Array[] = []
    pdfDoc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)
    pdfDoc.end()
  })
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
  lang: 'fr' | 'en'
): TDocumentDefinitions {
  const content: Content[] = []
  const l = labels[lang]

  // ── Document titles ──
  const docTitles: Record<DocumentType, string> = {
    devis: l.quote,
    acompte: l.depositInvoice,
    solde: l.balanceInvoice,
  }

  const dueDays = documentType === 'devis' ? quote.quote_due_days : quote.invoice_due_days
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
              { text: restaurant?.name || 'Restaurant', style: 'headerTitle', color: 'white' },
            ],
            fillColor: color,
            margin: [12, 10, 12, 10] as [number, number, number, number],
          },
          {
            stack: [
              { text: `${docTitle} n°${quote.quote_number}`, style: 'headerDocTitle', color: 'white', alignment: 'right' as const },
              { text: `${l.dateOf} ${docTitle.toLowerCase()} – ${formatDate(quote.quote_date)}`, style: 'headerSmall', color: 'white', alignment: 'right' as const },
              { text: `${l.dueDateLabel} – ${addDays(quote.quote_date, dueDays)}`, style: 'headerSmall', color: 'white', alignment: 'right' as const },
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
          ...(restaurant?.legal_name ? [{ text: `${l.companyName} – ${restaurant.legal_name}`, style: 'small' as const, color: '#666' }] : []),
          { text: `${l.name} – ${restaurant?.name || ''}`, style: 'bold' },
          ...(restaurant?.address ? [{ text: `${l.address} – ${restaurant.address}`, style: 'small' as const, color: '#666' }] : []),
          ...(restaurant?.postal_code || restaurant?.city
            ? [{ text: `${restaurant?.postal_code || ''} ${restaurant?.city || ''}`, style: 'small' as const, color: '#666' }]
            : []),
          ...(restaurant?.siret ? [{ text: `${l.siretSiren} – ${restaurant.siret}`, style: 'tiny' as const, color: '#888' }] : []),
          ...(restaurant?.tva_number ? [{ text: `${l.vatNumber} – ${restaurant.tva_number}`, style: 'tiny' as const, color: '#888' }] : []),
          ...(restaurant?.email ? [{ text: `${l.email} – ${restaurant.email}`, style: 'tiny' as const, color: '#888' }] : []),
        ],
      },
      {
        width: '50%',
        stack: [
          { text: l.client, style: 'sectionLabel' },
          ...(contact?.company ? [{ text: contact.company.name, style: 'bold' as const }] : []),
          { text: `${l.name} – ${contact?.first_name || ''} ${contact?.last_name || ''}`, style: contact?.company ? 'small' as const : 'bold' as const, color: contact?.company ? '#666' : undefined },
          ...(contact?.email ? [{ text: `${l.email} – ${contact.email}`, style: 'small' as const, color: '#666' }] : []),
          ...(contact?.phone ? [{ text: `${l.phone} – ${contact.phone}`, style: 'small' as const, color: '#666' }] : []),
          ...(contact?.company?.billing_address ? [{ text: `${l.billingAddress} – ${contact.company.billing_address}`, style: 'small' as const, color: '#666' }] : []),
          ...(contact?.company?.billing_postal_code || contact?.company?.billing_city
            ? [{ text: `${contact?.company?.billing_postal_code || ''} ${contact?.company?.billing_city || ''}`, style: 'small' as const, color: '#666' }]
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
                ...(quote.title ? [{ text: quote.title, style: 'bold' as const }] : []),
                ...(quote.date_start ? [{ text: `${l.serviceDate}: ${formatDate(quote.date_start)}${quote.date_end && quote.date_end !== quote.date_start ? ` — ${formatDate(quote.date_end)}` : ''}`, style: 'small' as const, color: '#666' }] : []),
                ...(quote.order_number ? [{ text: `${l.orderNumber}: ${quote.order_number}`, style: 'tiny' as const, color: '#888' }] : []),
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
                { text: l.comments, style: 'tiny' as const, bold: true, color: '#92400e' },
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
          { text: l.designation, style: 'tableHeader', fillColor: color, color: 'white' },
          { text: l.quantity, style: 'tableHeader', fillColor: color, color: 'white', alignment: 'center' as const },
          { text: l.unitPriceHt, style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
          { text: l.tvaRate, style: 'tableHeader', fillColor: color, color: 'white', alignment: 'center' as const },
          { text: l.totalHt, style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
          { text: l.totalTtc, style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
        ],
      ]

      items.forEach((item, i) => {
        const rowColor = i % 2 === 0 ? '#ffffff' : '#f9fafb'
        tableBody.push([
          {
            stack: [
              { text: item.name, style: 'tableCell', bold: true },
              ...(item.description ? [{ text: item.description, style: 'tiny' as const, color: '#888' }] : []),
            ],
            fillColor: rowColor,
          },
          { text: String(item.quantity), style: 'tableCell', alignment: 'center' as const, fillColor: rowColor },
          { text: formatCurrency(item.unit_price), style: 'tableCell', alignment: 'right' as const, fillColor: rowColor },
          { text: `${item.tva_rate}%`, style: 'tableCell', alignment: 'center' as const, fillColor: rowColor },
          { text: formatCurrency(item.total_ht || 0), style: 'tableCell', alignment: 'right' as const, fillColor: rowColor },
          { text: formatCurrency(item.total_ttc || 0), style: 'tableCell', alignment: 'right' as const, fillColor: rowColor },
        ])
      })

      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 35, 60, 35, 60, 60],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i: number) => (i === 0 || i === 1) ? color : '#e5e7eb',
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
        { text: l.designation, style: 'tableHeader', fillColor: color, color: 'white' },
        { text: l.quantity, style: 'tableHeader', fillColor: color, color: 'white', alignment: 'center' as const },
        { text: l.unitPriceHt, style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
        { text: l.tvaRate, style: 'tableHeader', fillColor: color, color: 'white', alignment: 'center' as const },
        { text: l.totalHt, style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
        { text: l.totalTtc, style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
      ],
    ]

    if (items.length > 0) {
      tableBody.push([
        { text: l.serviceItems, colSpan: 6, style: 'bold' as const, fillColor: '#f3f4f6', color } as TableCell,
        {}, {}, {}, {}, {},
      ])
      items.forEach((item) => {
        tableBody.push([
          { stack: [{ text: item.name, style: 'tableCell', bold: true }, ...(item.description ? [{ text: item.description, style: 'tiny' as const, color: '#888' }] : [])] },
          { text: String(item.quantity), style: 'tableCell', alignment: 'center' as const },
          { text: formatCurrency(item.unit_price), style: 'tableCell', alignment: 'right' as const },
          { text: `${item.tva_rate}%`, style: 'tableCell', alignment: 'center' as const },
          { text: formatCurrency(item.total_ht || 0), style: 'tableCell', alignment: 'right' as const },
          { text: formatCurrency(item.total_ttc || 0), style: 'tableCell', alignment: 'right' as const },
        ])
      })
    }

    if (extras.length > 0) {
      tableBody.push([
        { text: l.extras, colSpan: 6, style: 'bold' as const, fillColor: '#fef3c7', color } as TableCell,
        {}, {}, {}, {}, {},
      ])
      extras.forEach((extra) => {
        tableBody.push([
          { stack: [{ text: extra.name, style: 'tableCell', bold: true }, ...(extra.description ? [{ text: extra.description, style: 'tiny' as const, color: '#888' }] : [])] },
          { text: String(extra.quantity), style: 'tableCell', alignment: 'center' as const },
          { text: formatCurrency(extra.unit_price), style: 'tableCell', alignment: 'right' as const },
          { text: `${extra.tva_rate}%`, style: 'tableCell', alignment: 'center' as const },
          { text: formatCurrency(extra.total_ht || 0), style: 'tableCell', alignment: 'right' as const },
          { text: formatCurrency(extra.total_ttc || 0), style: 'tableCell', alignment: 'right' as const },
        ])
      })
    }

    if (tableBody.length > 1) {
      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 35, 60, 35, 60, 60],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i: number) => (i === 0 || i === 1) ? color : '#e5e7eb',
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
  
  // Calculate TVA by rate
  const tvaByRate: Record<number, { ht: number; tva: number }> = {}
  for (const item of items) {
    const rate = item.tva_rate || 20
    const ht = item.total_ht || 0
    const tva = ht * (rate / 100)
    if (!tvaByRate[rate]) tvaByRate[rate] = { ht: 0, tva: 0 }
    tvaByRate[rate].ht += ht
    tvaByRate[rate].tva += tva
  }

  if (documentType === 'devis') {
    const totalsStack: Content[] = [
      { columns: [{ text: l.subtotalHt, style: 'small', color: '#666' }, { text: formatCurrency(quote.total_ht), alignment: 'right' as const, style: 'bold' }], margin: [0, 0, 0, 2] as [number, number, number, number] },
    ]

    // Add TVA breakdown by rate
    Object.entries(tvaByRate).forEach(([rate, val]) => {
      totalsStack.push({
        columns: [
          { text: `TVA ${rate}%`, style: 'small', color: '#666' },
          { text: formatCurrency(val.tva), alignment: 'right' as const, style: 'small' },
        ],
        margin: [0, 0, 0, 2] as [number, number, number, number],
      })
    })

    totalsStack.push(
      { columns: [{ text: l.totalTvaLabel, style: 'small', color: '#666' }, { text: formatCurrency(quote.total_tva), alignment: 'right' as const, style: 'bold' }], margin: [0, 0, 0, 4] as [number, number, number, number] },
      { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1, lineColor: '#d1d5db' }], margin: [0, 0, 0, 4] as [number, number, number, number] },
      {
        table: {
          widths: ['*', 'auto'],
          body: [[
            { text: l.totalTtc, style: 'bold', color: 'white' },
            { text: formatCurrency(quote.total_ttc), style: 'bold', color: 'white', alignment: 'right' as const },
          ]],
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
    const depositTtc = Math.round(quote.total_ttc * (quote.deposit_percentage / 100) * 100) / 100
    const depositHt = Math.round(quote.total_ht * (quote.deposit_percentage / 100) * 100) / 100
    const depositTva = Math.round((depositTtc - depositHt) * 100) / 100

    content.push({
      columns: [
        { width: '*', text: '' },
        {
          width: 200,
          stack: [
            { columns: [{ text: `${l.depositPercent} ${quote.deposit_percentage}%`, style: 'small' }, { text: formatCurrency(depositHt), alignment: 'right' as const }], margin: [0, 0, 0, 2] as [number, number, number, number] },
            { columns: [{ text: 'TVA', style: 'small' }, { text: formatCurrency(depositTva), alignment: 'right' as const }], margin: [0, 0, 0, 4] as [number, number, number, number] },
            { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1, lineColor: '#d1d5db' }], margin: [0, 0, 0, 4] as [number, number, number, number] },
            {
              table: {
                widths: ['*', 'auto'],
                body: [[
                  { text: l.totalTtc, style: 'bold', color: 'white' },
                  { text: formatCurrency(depositTtc), style: 'bold', color: 'white', alignment: 'right' as const },
                ]],
              },
              layout: 'noBorders',
              fillColor: color,
            } as Content,
            { text: `${l.relatedQuote}: ${quote.quote_number} — Total: ${formatCurrency(quote.total_ttc)}`, style: 'tiny', color: '#888', margin: [0, 6, 0, 0] as [number, number, number, number] },
          ],
        },
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  } else {
    // Solde — use direct TTC calculation (consistent with send-balance route)
    const depositTtc = Math.round(quote.total_ttc * (quote.deposit_percentage / 100) * 100) / 100
    const extrasHt = extras.reduce((sum, e) => sum + (e.total_ht || 0), 0)
    const extrasTtc = extras.reduce((sum, e) => sum + (e.total_ttc || 0), 0)
    const totalWithExtrasTtc = quote.total_ttc + extrasTtc
    const balanceTtc = Math.round((totalWithExtrasTtc - depositTtc) * 100) / 100

    content.push({
      columns: [
        { width: '*', text: '' },
        {
          width: 220,
          stack: [
            { columns: [{ text: `Total ${l.serviceItems.toLowerCase()} HT`, style: 'small' }, { text: formatCurrency(quote.total_ht), alignment: 'right' as const }], margin: [0, 0, 0, 2] as [number, number, number, number] },
            ...(extras.length > 0
              ? [{ columns: [{ text: `Total ${l.extras.toLowerCase()} HT`, style: 'small' }, { text: formatCurrency(extrasHt), alignment: 'right' as const }], margin: [0, 0, 0, 2] as [number, number, number, number] }]
              : []),
            { columns: [{ text: l.totalWithExtras, style: 'small' }, { text: formatCurrency(totalWithExtrasTtc), alignment: 'right' as const }], margin: [0, 0, 0, 2] as [number, number, number, number] },
            { columns: [{ text: `${l.depositPaid} (${quote.deposit_percentage}%)`, style: 'small', color: '#16a34a' }, { text: `- ${formatCurrency(depositTtc)}`, alignment: 'right' as const, color: '#16a34a' }], margin: [0, 0, 0, 4] as [number, number, number, number] },
            { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 1, lineColor: '#d1d5db' }], margin: [0, 0, 0, 4] as [number, number, number, number] },
            {
              table: {
                widths: ['*', 'auto'],
                body: [[
                  { text: l.remainingBalance, style: 'bold', color: 'white' },
                  { text: formatCurrency(balanceTtc), style: 'bold', color: 'white', alignment: 'right' as const },
                ]],
              },
              layout: 'noBorders',
              fillColor: color,
            } as Content,
          ],
        },
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // PAYMENT SCHEDULE (devis only)
  // ══════════════════════════════════════════════════════════════════
  if (documentType === 'devis') {
    const depositAmount = quote.total_ttc * (quote.deposit_percentage / 100)
    const balanceAmount = quote.total_ttc - depositAmount

    content.push({
      stack: [
        { text: l.paymentSchedule, style: 'sectionLabel' },
        {
          table: {
            widths: ['*', 50, 40, 80],
            body: [
              [
                { text: quote.deposit_label || 'Acompte à signature', style: 'tableCell', fillColor: '#f9fafb' },
                { text: `${quote.deposit_percentage}%`, style: 'tableCell', alignment: 'center' as const, fillColor: '#f9fafb' },
                { text: `J-${quote.deposit_days}`, style: 'tableCell', alignment: 'center' as const, fillColor: '#f9fafb' },
                { text: formatCurrency(depositAmount), style: 'tableCell', alignment: 'right' as const, bold: true, fillColor: '#f9fafb' },
              ],
              [
                { text: quote.balance_label || 'Solde', style: 'tableCell' },
                { text: `${100 - quote.deposit_percentage}%`, style: 'tableCell', alignment: 'center' as const },
                { text: `J-${quote.balance_days}`, style: 'tableCell', alignment: 'center' as const },
                { text: formatCurrency(balanceAmount), style: 'tableCell', alignment: 'right' as const, bold: true },
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
            body: [[
              {
                stack: [
                  ...(restaurant.bank_name ? [{ text: `${l.bankName} : ${restaurant.bank_name}`, style: 'small' as const, bold: true }] : []),
                  ...(restaurant.iban ? [{ text: `${l.iban} : ${restaurant.iban}`, style: 'small' as const }] : []),
                  ...(restaurant.bic ? [{ text: `${l.bic} : ${restaurant.bic}`, style: 'small' as const }] : []),
                ],
                fillColor: '#f9fafb',
                margin: [8, 6, 8, 6] as [number, number, number, number],
              },
            ]],
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
        { text: quote.additional_conditions, style: 'conditions', color: '#666' },
      ],
      margin: [0, 10, 0, 0] as [number, number, number, number],
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════════════
  const footerLine1Parts: string[] = []
  if (restaurant?.legal_name || restaurant?.name) footerLine1Parts.push(restaurant.legal_name || restaurant.name || '')
  if (restaurant?.legal_form) footerLine1Parts.push(restaurant.legal_form)
  if (restaurant?.share_capital) footerLine1Parts.push(`${l.shareCapital} ${restaurant.share_capital}`)

  const footerLine2Parts: string[] = []
  if (restaurant?.siren) footerLine2Parts.push(`SIREN: ${restaurant.siren}`)
  if (restaurant?.rcs) footerLine2Parts.push(`RCS: ${restaurant.rcs}`)
  if (restaurant?.siret) footerLine2Parts.push(`SIRET: ${restaurant.siret}`)
  if (restaurant?.tva_number) footerLine2Parts.push(`${l.vatNumber}: ${restaurant.tva_number}`)

  const footerLine3Parts: string[] = []
  if (restaurant?.email) footerLine3Parts.push(restaurant.email)
  if (restaurant?.phone) footerLine3Parts.push(restaurant.phone)

  return {
    content,
    footer: {
      stack: [
        { canvas: [{ type: 'line' as const, x1: 30, y1: 0, x2: 565, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }] },
        { text: footerLine1Parts.join(' — '), style: 'footer', alignment: 'center' as const, margin: [0, 4, 0, 0] as [number, number, number, number] },
        { text: footerLine2Parts.join(' — '), style: 'footer', alignment: 'center' as const },
        ...(footerLine3Parts.length > 0 ? [{ text: footerLine3Parts.join(' — '), style: 'footer', alignment: 'center' as const }] : []),
      ],
      margin: [30, 0, 30, 10] as [number, number, number, number],
    },
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 9,
    },
    styles: {
      headerTitle: { fontSize: 14, bold: true },
      headerDocTitle: { fontSize: 10, bold: true },
      headerSmall: { fontSize: 8 },
      sectionLabel: { fontSize: 8, bold: true, color: '#9ca3af', margin: [0, 0, 0, 6] as [number, number, number, number] },
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
