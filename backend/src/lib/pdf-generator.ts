import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces'
import { supabase } from './supabase.js'
import path from 'path'

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

export async function generateQuotePdf(quoteId: string, documentType: DocumentType): Promise<Buffer> {
  const quote = await fetchQuoteFullData(quoteId)
  const booking = quote.booking
  const restaurant = booking?.restaurant ?? null
  const contact = booking?.contact ?? null
  const color = restaurant?.color || '#0d7377'
  const items = (quote.quote_items || []).filter(i => i.item_type === 'product')
  const extras = (quote.quote_items || []).filter(i => i.item_type === 'extra')

  const docDefinition = buildDocDefinition(quote, restaurant, contact, items, extras, documentType, color)

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
  color: string
): TDocumentDefinitions {
  const content: Content[] = []

  // ── Header ──
  const docTitles: Record<DocumentType, string> = {
    devis: 'DEVIS',
    acompte: "FACTURE D'ACOMPTE",
    solde: 'FACTURE DE SOLDE',
  }

  const dueDays = documentType === 'devis' ? quote.quote_due_days : quote.invoice_due_days

  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: restaurant?.name || 'Restaurant', style: 'headerTitle', color },
          { text: restaurant?.address || '', style: 'small', color: '#666' },
          { text: `${restaurant?.postal_code || ''} ${restaurant?.city || ''}`, style: 'small', color: '#666' },
        ],
      },
      {
        width: 'auto',
        stack: [
          { text: `${docTitles[documentType]} n°${quote.quote_number}`, style: 'docTitle', alignment: 'right' as const, color },
          { text: `Date: ${formatDate(quote.quote_date)}`, style: 'small', alignment: 'right' as const },
          { text: `Échéance: ${addDays(quote.quote_date, dueDays)}`, style: 'small', alignment: 'right' as const },
        ],
      },
    ],
    margin: [0, 0, 0, 15] as [number, number, number, number],
  })

  // ── Issuer / Client ──
  content.push({
    columns: [
      {
        width: '50%',
        stack: [
          { text: 'ÉMETTEUR', style: 'sectionLabel' },
          { text: restaurant?.legal_name || restaurant?.name || '', style: 'bold' },
          { text: restaurant?.address || '', style: 'small' },
          { text: `${restaurant?.postal_code || ''} ${restaurant?.city || ''}`, style: 'small' },
          ...(restaurant?.siret ? [{ text: `SIRET: ${restaurant.siret}`, style: 'tiny' as const }] : []),
          ...(restaurant?.tva_number ? [{ text: `TVA: ${restaurant.tva_number}`, style: 'tiny' as const }] : []),
          ...(restaurant?.email ? [{ text: `Email: ${restaurant.email}`, style: 'tiny' as const }] : []),
        ],
      },
      {
        width: '50%',
        stack: [
          { text: 'CLIENT', style: 'sectionLabel' },
          ...(contact?.company ? [{ text: contact.company.name, style: 'bold' as const }] : []),
          { text: `${contact?.first_name || ''} ${contact?.last_name || ''}`, style: contact?.company ? 'normal' as const : 'bold' as const },
          ...(contact?.email ? [{ text: `Email: ${contact.email}`, style: 'small' as const }] : []),
          ...(contact?.phone ? [{ text: `Tél: ${contact.phone}`, style: 'small' as const }] : []),
          ...(contact?.company?.billing_address ? [{ text: contact.company.billing_address, style: 'small' as const }] : []),
          ...(contact?.company?.billing_postal_code || contact?.company?.billing_city
            ? [{ text: `${contact?.company?.billing_postal_code || ''} ${contact?.company?.billing_city || ''}`, style: 'small' as const }]
            : []),
        ],
      },
    ],
    margin: [0, 0, 0, 15] as [number, number, number, number],
  })

  // ── Event title ──
  if (quote.title || quote.date_start) {
    content.push({
      stack: [
        ...(quote.title ? [{ text: quote.title, style: 'bold' as const }] : []),
        ...(quote.date_start ? [{ text: `Date de prestation: ${formatDate(quote.date_start)}`, style: 'small' as const }] : []),
        ...(quote.order_number ? [{ text: `N° commande: ${quote.order_number}`, style: 'small' as const }] : []),
      ],
      margin: [0, 0, 0, 10] as [number, number, number, number],
      fillColor: '#faf5f0',
      padding: [8, 6, 8, 6] as unknown as number,
    } as Content)
  }

  // ── Comments ──
  const comments = quote.language === 'en' ? quote.comments_en : quote.comments_fr
  if (comments) {
    content.push({
      text: comments,
      style: 'small',
      margin: [0, 0, 0, 10] as [number, number, number, number],
      italics: true,
      color: '#666',
    })
  }

  // ── Products table ──
  if (documentType === 'devis' || documentType === 'acompte') {
    if (items.length > 0) {
      const tableBody: TableCell[][] = [
        [
          { text: 'Désignation', style: 'tableHeader', fillColor: color, color: 'white' },
          { text: 'Qté', style: 'tableHeader', fillColor: color, color: 'white', alignment: 'center' as const },
          { text: 'P.U. HT', style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
          { text: 'TVA', style: 'tableHeader', fillColor: color, color: 'white', alignment: 'center' as const },
          { text: 'Total HT', style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
          { text: 'Total TTC', style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
        ],
      ]

      items.forEach((item, i) => {
        tableBody.push([
          {
            stack: [
              { text: item.name, style: 'tableCell' },
              ...(item.description ? [{ text: item.description, style: 'tiny' as const, color: '#999' }] : []),
            ],
            fillColor: i % 2 === 0 ? '#fff' : '#f9f9f9',
          },
          { text: String(item.quantity), style: 'tableCell', alignment: 'center' as const, fillColor: i % 2 === 0 ? '#fff' : '#f9f9f9' },
          { text: formatCurrency(item.unit_price), style: 'tableCell', alignment: 'right' as const, fillColor: i % 2 === 0 ? '#fff' : '#f9f9f9' },
          { text: `${item.tva_rate}%`, style: 'tableCell', alignment: 'center' as const, fillColor: i % 2 === 0 ? '#fff' : '#f9f9f9' },
          { text: formatCurrency(item.total_ht || 0), style: 'tableCell', alignment: 'right' as const, fillColor: i % 2 === 0 ? '#fff' : '#f9f9f9' },
          { text: formatCurrency(item.total_ttc || 0), style: 'tableCell', alignment: 'right' as const, fillColor: i % 2 === 0 ? '#fff' : '#f9f9f9' },
        ])
      })

      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 35, 60, 35, 60, 60],
          body: tableBody,
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 10] as [number, number, number, number],
      })
    }
  }

  // ── Solde: combined products + extras ──
  if (documentType === 'solde') {
    const allItems = [...items, ...extras]
    if (allItems.length > 0) {
      const tableBody: TableCell[][] = [
        [
          { text: 'Désignation', style: 'tableHeader', fillColor: color, color: 'white' },
          { text: 'Qté', style: 'tableHeader', fillColor: color, color: 'white', alignment: 'center' as const },
          { text: 'P.U. HT', style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
          { text: 'TVA', style: 'tableHeader', fillColor: color, color: 'white', alignment: 'center' as const },
          { text: 'Total HT', style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
          { text: 'Total TTC', style: 'tableHeader', fillColor: color, color: 'white', alignment: 'right' as const },
        ],
      ]

      if (items.length > 0) {
        tableBody.push([{ text: 'Prestation', colSpan: 6, style: 'bold' as const, fillColor: '#f0f0f0', color } as TableCell, {}, {}, {}, {}, {}])
        items.forEach((item, i) => {
          tableBody.push([
            { stack: [{ text: item.name, style: 'tableCell' }, ...(item.description ? [{ text: item.description, style: 'tiny' as const, color: '#999' }] : [])] },
            { text: String(item.quantity), style: 'tableCell', alignment: 'center' as const },
            { text: formatCurrency(item.unit_price), style: 'tableCell', alignment: 'right' as const },
            { text: `${item.tva_rate}%`, style: 'tableCell', alignment: 'center' as const },
            { text: formatCurrency(item.total_ht || 0), style: 'tableCell', alignment: 'right' as const },
            { text: formatCurrency(item.total_ttc || 0), style: 'tableCell', alignment: 'right' as const },
          ])
        })
      }

      if (extras.length > 0) {
        tableBody.push([{ text: 'Extras', colSpan: 6, style: 'bold' as const, fillColor: '#fff8e1', color } as TableCell, {}, {}, {}, {}, {}])
        extras.forEach((extra) => {
          tableBody.push([
            { stack: [{ text: extra.name, style: 'tableCell' }, ...(extra.description ? [{ text: extra.description, style: 'tiny' as const, color: '#999' }] : [])] },
            { text: String(extra.quantity), style: 'tableCell', alignment: 'center' as const },
            { text: formatCurrency(extra.unit_price), style: 'tableCell', alignment: 'right' as const },
            { text: `${extra.tva_rate}%`, style: 'tableCell', alignment: 'center' as const },
            { text: formatCurrency(extra.total_ht || 0), style: 'tableCell', alignment: 'right' as const },
            { text: formatCurrency(extra.total_ttc || 0), style: 'tableCell', alignment: 'right' as const },
          ])
        })
      }

      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 35, 60, 35, 60, 60],
          body: tableBody,
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 10] as [number, number, number, number],
      })
    }
  }

  // ── Totals ──
  if (documentType === 'devis') {
    content.push({
      columns: [
        { width: '*', text: '' },
        {
          width: 200,
          stack: [
            { columns: [{ text: 'Total HT', style: 'small' }, { text: formatCurrency(quote.total_ht), alignment: 'right' as const, style: 'bold' }] },
            { columns: [{ text: 'Total TVA', style: 'small' }, { text: formatCurrency(quote.total_tva), alignment: 'right' as const }] },
            { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5, lineColor: '#ccc' }], margin: [0, 3, 0, 3] as [number, number, number, number] },
            {
              columns: [
                { text: 'TOTAL TTC', style: 'bold', color },
                { text: formatCurrency(quote.total_ttc), alignment: 'right' as const, style: 'bold', color },
              ],
              fillColor: color + '15',
              margin: [4, 4, 4, 4] as [number, number, number, number],
            },
          ],
        },
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  } else if (documentType === 'acompte') {
    const depositHt = quote.total_ht * (quote.deposit_percentage / 100)
    const avgTvaRate = quote.total_ht > 0 ? ((quote.total_ttc - quote.total_ht) / quote.total_ht) * 100 : 20
    const depositTva = depositHt * (avgTvaRate / 100)
    const depositTtc = depositHt + depositTva

    content.push({
      columns: [
        { width: '*', text: '' },
        {
          width: 200,
          stack: [
            { columns: [{ text: `Acompte ${quote.deposit_percentage}%`, style: 'small' }, { text: formatCurrency(depositHt), alignment: 'right' as const }] },
            { columns: [{ text: 'TVA', style: 'small' }, { text: formatCurrency(depositTva), alignment: 'right' as const }] },
            { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5, lineColor: '#ccc' }], margin: [0, 3, 0, 3] as [number, number, number, number] },
            {
              columns: [
                { text: 'TOTAL TTC', style: 'bold', color },
                { text: formatCurrency(depositTtc), alignment: 'right' as const, style: 'bold', color },
              ],
            },
            { text: `Réf. devis: ${quote.quote_number} — Total devis: ${formatCurrency(quote.total_ttc)}`, style: 'tiny', color: '#999', margin: [0, 4, 0, 0] as [number, number, number, number] },
          ],
        },
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  } else {
    // Solde
    const depositHt = quote.total_ht * (quote.deposit_percentage / 100)
    const avgTvaRate = quote.total_ht > 0 ? ((quote.total_ttc - quote.total_ht) / quote.total_ht) * 100 : 20
    const depositTtc = depositHt + depositHt * (avgTvaRate / 100)
    const extrasHt = extras.reduce((sum, e) => sum + (e.total_ht || 0), 0)
    const extrasTtc = extras.reduce((sum, e) => sum + (e.total_ttc || 0), 0)
    const totalWithExtrasHt = quote.total_ht + extrasHt
    const totalWithExtrasTtc = quote.total_ttc + extrasTtc
    const balanceTtc = totalWithExtrasTtc - depositTtc

    content.push({
      columns: [
        { width: '*', text: '' },
        {
          width: 220,
          stack: [
            { columns: [{ text: 'Total prestation HT', style: 'small' }, { text: formatCurrency(quote.total_ht), alignment: 'right' as const }] },
            ...(extras.length > 0
              ? [{ columns: [{ text: 'Total extras HT', style: 'small' }, { text: formatCurrency(extrasHt), alignment: 'right' as const }] }]
              : []),
            { columns: [{ text: 'Total avec extras TTC', style: 'small' }, { text: formatCurrency(totalWithExtrasTtc), alignment: 'right' as const }] },
            { columns: [{ text: `Acompte versé (${quote.deposit_percentage}%)`, style: 'small', color: '#4caf50' }, { text: `- ${formatCurrency(depositTtc)}`, alignment: 'right' as const, color: '#4caf50' }] },
            { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5, lineColor: '#ccc' }], margin: [0, 3, 0, 3] as [number, number, number, number] },
            {
              columns: [
                { text: 'SOLDE RESTANT TTC', style: 'bold', color },
                { text: formatCurrency(balanceTtc), alignment: 'right' as const, style: 'bold', color },
              ],
            },
          ],
        },
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  }

  // ── Payment schedule (devis only) ──
  if (documentType === 'devis') {
    const depositAmount = quote.total_ttc * (quote.deposit_percentage / 100)
    const balanceAmount = quote.total_ttc - depositAmount

    content.push({
      stack: [
        { text: 'ÉCHÉANCIER DE PAIEMENT', style: 'sectionLabel' },
        {
          table: {
            widths: ['*', 50, 40, 80],
            body: [
              [
                { text: quote.deposit_label || 'Acompte à signature', style: 'tableCell' },
                { text: `${quote.deposit_percentage}%`, style: 'tableCell', alignment: 'center' as const },
                { text: `J-${quote.deposit_days}`, style: 'tableCell', alignment: 'center' as const },
                { text: formatCurrency(depositAmount), style: 'tableCell', alignment: 'right' as const, bold: true },
              ],
              [
                { text: quote.balance_label || 'Solde', style: 'tableCell' },
                { text: `${100 - quote.deposit_percentage}%`, style: 'tableCell', alignment: 'center' as const },
                { text: `J-${quote.balance_days}`, style: 'tableCell', alignment: 'center' as const },
                { text: formatCurrency(balanceAmount), style: 'tableCell', alignment: 'right' as const, bold: true },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  }

  // ── Bank details ──
  if (restaurant?.iban || restaurant?.bic) {
    content.push({
      stack: [
        { text: 'COORDONNÉES BANCAIRES', style: 'sectionLabel' },
        ...(restaurant.bank_name ? [{ text: `Banque: ${restaurant.bank_name}`, style: 'small' as const }] : []),
        ...(restaurant.iban ? [{ text: `IBAN: ${restaurant.iban}`, style: 'small' as const }] : []),
        ...(restaurant.bic ? [{ text: `BIC: ${restaurant.bic}`, style: 'small' as const }] : []),
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    })
  }

  // ── Conditions ──
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
        { text: 'CONDITIONS GÉNÉRALES', style: 'sectionLabel' },
        { text: conditions, style: 'tiny', color: '#666' },
      ],
      margin: [0, 10, 0, 0] as [number, number, number, number],
    })
  }

  if (quote.additional_conditions) {
    content.push({
      stack: [
        { text: 'CONDITIONS PARTICULIÈRES', style: 'sectionLabel' },
        { text: quote.additional_conditions, style: 'tiny', color: '#666' },
      ],
      margin: [0, 10, 0, 0] as [number, number, number, number],
    })
  }

  // ── Footer ──
  const footerParts: string[] = []
  if (restaurant?.legal_name || restaurant?.name) footerParts.push(restaurant.legal_name || restaurant.name || '')
  if (restaurant?.legal_form) footerParts.push(restaurant.legal_form)
  if (restaurant?.share_capital) footerParts.push(`Capital: ${restaurant.share_capital}`)
  if (restaurant?.siren) footerParts.push(`SIREN: ${restaurant.siren}`)
  if (restaurant?.rcs) footerParts.push(`RCS: ${restaurant.rcs}`)
  if (restaurant?.siret) footerParts.push(`SIRET: ${restaurant.siret}`)
  if (restaurant?.tva_number) footerParts.push(`TVA: ${restaurant.tva_number}`)

  return {
    content,
    footer: {
      text: footerParts.join(' — '),
      style: 'tiny',
      alignment: 'center' as const,
      color: '#999',
      margin: [20, 0, 20, 10] as [number, number, number, number],
    },
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 9,
    },
    styles: {
      headerTitle: { fontSize: 14, bold: true },
      docTitle: { fontSize: 11, bold: true },
      sectionLabel: { fontSize: 7, bold: true, color: '#999', margin: [0, 0, 0, 4] as [number, number, number, number] },
      bold: { bold: true },
      small: { fontSize: 8 },
      tiny: { fontSize: 7 },
      normal: { fontSize: 9 },
      tableHeader: { fontSize: 8, bold: true },
      tableCell: { fontSize: 8 },
    },
    pageMargins: [30, 30, 30, 40] as [number, number, number, number],
  }
}
