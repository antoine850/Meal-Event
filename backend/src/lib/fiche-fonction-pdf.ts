import type { Column, Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { renderPdfToBuffer } from './pdf-generator.js'
import { formatEuroAdaptive, formatEuroDecimal } from './quote-rounding.js'
import { supabase } from './supabase.js'

const DASH = '—'

interface FicheQuoteItem {
  id: string
  name: string
  description: string | null
  quantity: number | null
  unit_price: number | null
  unit_price_ttc: number | null
  tva_rate: number | null
  total_ht: number | null
  total_ttc: number | null
}

interface FicheQuote {
  id: string
  quote_number: string | null
  status: string | null
  primary_quote: boolean | null
  total_ttc: number | null
  quote_items: FicheQuoteItem[]
}

interface FichePayment {
  id: string
  amount: number | null
  status: string | null
  payment_modality: string | null
  payment_type: string | null
  quote_id: string | null
}

export interface FicheBookingData {
  id: string
  organization_id: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  guests_count: number | null
  internal_notes: string | null
  mise_en_place: string | null
  deroulement: string | null
  menu_aperitif: string | null
  menu_entree: string | null
  menu_plat: string | null
  menu_dessert: string | null
  menu_boissons: string | null
  allergies_regimes: string | null
  prestations_souhaitees: string | null
  commentaires: string | null
  instructions_speciales: string | null
  contact_sur_place_nom: string | null
  contact_sur_place_tel: string | null
  contact_sur_place_societe: string | null
  source: string | null
  occasion: string | null
  option: string | null
  relance: string | null
  date_signature_devis: string | null
  budget_client: number | null
  assigned_user_ids: string[] | null
  contact: {
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    company: { name: string | null } | null
  } | null
  restaurant: { id: string; name: string | null; color: string | null } | null
  space: { name: string | null } | null
  quotes: FicheQuote[]
  payments: FichePayment[]
}

export async function fetchBookingFullData(bookingId: string): Promise<{
  booking: FicheBookingData
  assignedNames: string[]
}> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      contact:contacts(id, first_name, last_name, email, phone, company:companies(name)),
      restaurant:restaurants(id, name, color),
      space:spaces(id, name),
      quotes(*, quote_items(*)),
      payments(*)
    `
    )
    .eq('id', bookingId)
    .order('position', { referencedTable: 'quotes.quote_items', ascending: true })
    .single()

  if (error) throw new Error(`Failed to fetch booking: ${error.message}`)
  const booking = data as unknown as FicheBookingData

  const ids = booking.assigned_user_ids || []
  let assignedNames: string[] = []
  if (ids.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', ids)
    assignedNames = (users || [])
      .map((u) => `${u.first_name || ''} ${u.last_name || ''}`.trim())
      .filter(Boolean)
  }

  return { booking, assignedNames }
}

// ── Helpers dupliqués de src/features/reservations/lib/booking-totals.ts ──

function formatBookingId(id: string): string {
  return id.replace(/-/g, '').slice(-10).toUpperCase()
}

function getActiveQuote(quotes: FicheQuote[]): FicheQuote | null {
  if (!quotes.length) return null
  return (
    quotes.find((q) =>
      ['deposit_paid', 'balance_sent', 'balance_paid', 'completed'].includes(
        q.status || ''
      )
    ) ||
    quotes.find((q) => q.status === 'quote_signed') ||
    quotes.find((q) => q.status === 'deposit_sent') ||
    quotes.find((q) => q.primary_quote) ||
    quotes[0] ||
    null
  )
}

function computeVatBreakdown(items: FicheQuoteItem[]) {
  let totalHt = 0
  let totalTtc = 0
  let vat10 = 0
  let vat20 = 0
  for (const item of items) {
    const ht = item.total_ht || 0
    const ttc = item.total_ttc || 0
    totalHt += ht
    totalTtc += ttc
    const tva = ttc - ht
    if (item.tva_rate === 10) vat10 += tva
    else if (item.tva_rate === 20) vat20 += tva
  }
  return { totalHt, vat10, vat20, totalTtc }
}

function getRemainingBalance(totalTtc: number, payments: FichePayment[]): number {
  const paid = payments
    .filter((p) => p.status === 'paid' || p.status === 'completed')
    .reduce((s, p) => s + (p.amount || 0), 0)
  return Math.max(0, totalTtc - paid)
}

// ── Formatters (équivalents backend des helpers de fiche-fonction.tsx) ──

function formatDateLong(v: string | null | undefined): string {
  if (!v) return DASH
  try {
    return new Date(v).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return String(v)
  }
}

function formatHorairesGlobal(
  eventDate: string | null,
  startTime: string | null,
  endTime: string | null
): string {
  if (!eventDate) return DASH
  try {
    const dateStr = new Date(eventDate).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    const start = (startTime || '').slice(0, 5)
    const end = (endTime || '').slice(0, 5)
    if (start && end) return `${dateStr} – ${start}–${end}`
    if (start) return `${dateStr} – ${start}`
    return dateStr
  } catch {
    return String(eventDate)
  }
}

// ── Builders de sections ──

const GRAY = '#6b7280'
const LIGHT_GRAY = '#9ca3af'
const BORDER = '#e5e7eb'

const ficheTableLayout = {
  hLineWidth: (i: number, node: any) =>
    i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25,
  vLineWidth: () => 0,
  hLineColor: () => BORDER,
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 3,
  paddingBottom: () => 3,
}

function sectionTitle(text: string, color: string): Content {
  return {
    text: text.toUpperCase(),
    style: 'ficheSectionTitle',
    color,
    headlineLevel: 1,
    margin: [0, 8, 0, 3] as [number, number, number, number],
  }
}

function labelValue(label: string, value: string | null | undefined): Content {
  return {
    stack: [
      { text: label.toUpperCase(), style: 'ficheLabel' },
      { text: value || DASH, style: 'ficheValue' },
    ],
  }
}

// Ligne d'infos en 2-3 colonnes, insécable
function infoRow(cells: Content[]): Content {
  return {
    columns: cells.map((c) => ({ width: '*', ...(c as object) })) as Column[],
    columnGap: 10,
    unbreakable: true,
    margin: [0, 4, 0, 0] as [number, number, number, number],
  }
}

function headerCell(text: string, color: string, alignment?: 'right'): TableCell {
  return {
    text,
    style: 'ficheTableHeader',
    fillColor: color,
    color: 'white',
    ...(alignment ? { alignment } : {}),
  }
}

function itemsTable(
  title: string,
  items: FicheQuoteItem[],
  color: string
): Content {
  const body: TableCell[][] = [
    [
      headerCell('Titre', color),
      headerCell('Qté', color, 'right'),
      headerCell('TVA', color, 'right'),
      headerCell('Prix U HT', color, 'right'),
      headerCell('Prix U TTC', color, 'right'),
      headerCell('Total HT', color, 'right'),
      headerCell('Total TTC', color, 'right'),
    ],
  ]

  if (items.length === 0) {
    body.push([
      { text: 'Aucune ligne', colSpan: 7, alignment: 'center', color: GRAY },
      {}, {}, {}, {}, {}, {},
    ])
  } else {
    for (const item of items) {
      const tvaRate = item.tva_rate || 0
      // PU TTC stocké en priorité (cf. fix 66803d4), dérivé en secours
      const unitTtc =
        item.unit_price_ttc ?? (item.unit_price || 0) * (1 + tvaRate / 100)
      body.push([
        {
          stack: [
            { text: item.name, bold: true },
            ...(item.description
              ? [{ text: item.description, style: 'ficheDesc' as const, color: GRAY }]
              : []),
          ],
        },
        { text: item.quantity != null ? String(item.quantity) : DASH, alignment: 'right' },
        { text: `${tvaRate.toFixed(2)}%`, alignment: 'right' },
        { text: formatEuroDecimal(item.unit_price || 0), alignment: 'right' },
        { text: formatEuroDecimal(unitTtc), alignment: 'right' },
        { text: formatEuroDecimal(item.total_ht || 0), alignment: 'right' },
        { text: formatEuroDecimal(item.total_ttc || 0), alignment: 'right' },
      ])
    }
  }

  return {
    stack: [
      sectionTitle(title, color),
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          keepWithHeaderRows: 1,
          widths: ['*', 28, 38, 56, 56, 56, 56],
          body,
        },
        layout: ficheTableLayout,
        style: 'ficheTableCell',
      },
    ],
  }
}

// Petite table de montants (Total / Reste / Acomptes), insécable avec son titre
function amountsTable(
  title: string,
  headers: string[],
  rows: TableCell[][],
  color: string
): Content {
  return {
    stack: [
      sectionTitle(title, color),
      {
        table: {
          headerRows: 1,
          widths: headers.map(() => '*'),
          body: [
            headers.map((h, i) =>
              headerCell(h, color, i >= headers.length - 4 ? 'right' : undefined)
            ),
            ...rows,
          ],
        },
        layout: ficheTableLayout,
        style: 'ficheTableCell',
      },
    ],
    unbreakable: true,
  }
}

function textSection(
  title: string,
  text: string | null | undefined,
  color: string
): Content {
  return {
    stack: [
      sectionTitle(title, color),
      { text: text || DASH, style: 'ficheText' },
    ],
  }
}

export function buildFicheFonctionDocDefinition(
  booking: FicheBookingData,
  assignedNames: string[]
): TDocumentDefinitions {
  const color = booking.restaurant?.color || '#0d7377'
  const bookingRef = formatBookingId(booking.id)
  const now = new Date()
  const printedAt = `${now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })} à ${now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })}`

  const quotes = booking.quotes || []
  const payments = booking.payments || []
  const activeQuote = getActiveQuote(quotes)
  const items = activeQuote?.quote_items || []
  const totals = computeVatBreakdown(items)
  const foodItems = items.filter((i) => i.tva_rate === 10)
  const prestationItems = items.filter((i) => i.tva_rate !== 10)

  const content: Content[] = []

  // ── Bandeau header (même style que les autres documents) ──
  content.push({
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          {
            stack: [
              {
                text: booking.restaurant?.name || 'Restaurant',
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
                text: `FICHE DE FONCTION n°${bookingRef}`,
                style: 'headerDocTitle',
                color: 'white',
                alignment: 'right' as const,
              },
              {
                text: `Imprimé le ${printedAt}`,
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
    margin: [0, 0, 0, 10] as [number, number, number, number],
  })

  // ── Horaires ──
  content.push(
    infoRow([
      labelValue(
        'Horaires (Global)',
        formatHorairesGlobal(booking.event_date, booking.start_time, booking.end_time)
      ),
    ])
  )

  // ── Compte / Contact / Coordonnées ──
  const contactName = booking.contact
    ? [booking.contact.first_name, booking.contact.last_name].filter(Boolean).join(' ')
    : ''
  const coordonnees = [booking.contact?.phone, booking.contact?.email]
    .filter(Boolean)
    .join('\n')
  content.push(
    infoRow([
      labelValue('Nom du compte', booking.contact?.company?.name),
      labelValue('Contact', contactName),
      labelValue('Coordonnées', coordonnees),
    ])
  )

  // ── Devis : items / Total / Acomptes / Reste ──
  if (!activeQuote) {
    content.push({
      text: 'Aucun devis associé',
      alignment: 'center',
      color: GRAY,
      margin: [0, 14, 0, 14] as [number, number, number, number],
    })
  } else {
    if (prestationItems.length > 0) {
      content.push(itemsTable('Prestations', prestationItems, color))
    }
    if (foodItems.length > 0) {
      content.push(itemsTable('Food', foodItems, color))
    }
    if (prestationItems.length === 0 && foodItems.length === 0) {
      content.push(itemsTable('Prestations', [], color))
    }

    // Total
    content.push(
      amountsTable(
        'Total',
        ['Total HT', 'TVA 10%', 'TVA 20%', 'Total TTC'],
        [
          [
            { text: formatEuroDecimal(totals.totalHt), alignment: 'right' },
            { text: formatEuroDecimal(totals.vat10), alignment: 'right' },
            { text: formatEuroDecimal(totals.vat20), alignment: 'right' },
            { text: formatEuroDecimal(totals.totalTtc), alignment: 'right', bold: true },
          ],
        ],
        color
      )
    )

    // Acomptes (payés + en attente, prorata HT/TVA par ratio TTC — comme l'écran)
    const allDeposits = payments.filter(
      (p) => p.payment_modality === 'acompte' || p.payment_type === 'deposit'
    )
    const quoteNumberById = new Map<string, string>()
    for (const q of quotes) {
      if (q.id && q.quote_number) quoteNumberById.set(q.id, q.quote_number)
    }
    const depositRows: TableCell[][] =
      allDeposits.length === 0
        ? [[{ text: 'Aucun acompte', colSpan: 6, alignment: 'center', color: GRAY }, {}, {}, {}, {}, {}]]
        : allDeposits.map((p) => {
            const isPaid = p.status === 'paid' || p.status === 'completed'
            const totalRatio =
              (activeQuote.total_ttc || 0) > 0
                ? (p.amount || 0) / (activeQuote.total_ttc || 1)
                : 0
            const quoteNum = p.quote_id
              ? quoteNumberById.get(p.quote_id) || DASH
              : DASH
            return [
              { text: isPaid ? 'Payé' : 'En attente', color: isPaid ? '#15803d' : GRAY },
              { text: quoteNum },
              { text: formatEuroDecimal(totals.totalHt * totalRatio), alignment: 'right' },
              { text: formatEuroDecimal(totals.vat10 * totalRatio), alignment: 'right' },
              { text: formatEuroDecimal(totals.vat20 * totalRatio), alignment: 'right' },
              { text: formatEuroDecimal(p.amount || 0), alignment: 'right', bold: true },
            ]
          })
    content.push(
      amountsTable(
        'Acomptes',
        ['Statut', 'Facture', 'Total HT', 'TVA 10%', 'TVA 20%', 'Total TTC'],
        depositRows,
        color
      )
    )

    // Reste (ventilation TVA au prorata du ratio restant — comme l'écran)
    const remainingTtc =
      activeQuote.total_ttc != null
        ? getRemainingBalance(activeQuote.total_ttc || 0, payments)
        : 0
    const ratio =
      (activeQuote.total_ttc || 0) > 0 ? remainingTtc / (activeQuote.total_ttc || 1) : 0
    content.push(
      amountsTable(
        'Reste',
        ['Total HT', 'TVA 10%', 'TVA 20%', 'Total TTC'],
        [
          [
            { text: formatEuroDecimal(totals.totalHt * ratio), alignment: 'right' },
            { text: formatEuroDecimal(totals.vat10 * ratio), alignment: 'right' },
            { text: formatEuroDecimal(totals.vat20 * ratio), alignment: 'right' },
            { text: formatEuroDecimal(remainingTtc), alignment: 'right', bold: true },
          ],
        ],
        color
      )
    )
  }

  // ── Textes libres ──
  content.push(textSection('Commentaires facturation', booking.internal_notes, color))
  content.push(
    infoRow([
      labelValue('Espace', booking.space?.name),
      labelValue(
        'Nombre de personnes',
        booking.guests_count != null ? String(booking.guests_count) : null
      ),
    ])
  )
  content.push(textSection('Mise en place', booking.mise_en_place, color))
  content.push(textSection('Déroulé', booking.deroulement, color))

  // Menu : 2 colonnes (plats / boissons)
  content.push({
    stack: [
      sectionTitle('Menu', color),
      {
        columns: [
          {
            width: '*',
            stack: [
              labelValue('Apéritif', booking.menu_aperitif),
              labelValue('Entrée', booking.menu_entree),
              labelValue('Plat', booking.menu_plat),
              labelValue('Dessert', booking.menu_dessert),
            ].map((c, i) => ({
              ...(c as object),
              margin: [0, i === 0 ? 0 : 4, 0, 0] as [number, number, number, number],
            })),
          },
          { width: '*', ...(labelValue('Boissons', booking.menu_boissons) as object) },
        ] as Column[],
        columnGap: 14,
      },
    ],
  })

  // Champs TEXT illimités : pas d'unbreakable (pdfmake tronque les blocs insécables > 1 page)
  content.push({
    columns: [
      labelValue('Allergies et Régimes', booking.allergies_regimes),
      labelValue('Prestations souhaitées', booking.prestations_souhaitees),
    ].map((c) => ({ width: '*', ...(c as object) })) as Column[],
    columnGap: 10,
    margin: [0, 4, 0, 0] as [number, number, number, number],
  })

  // Commentaires combinés (commentaires + instructions spéciales + contact sur place)
  const contactSurPlaceLines: string[] = []
  if (booking.contact_sur_place_nom)
    contactSurPlaceLines.push(`Contact sur place : ${booking.contact_sur_place_nom}`)
  if (booking.contact_sur_place_tel)
    contactSurPlaceLines.push(`Tél : ${booking.contact_sur_place_tel}`)
  if (booking.contact_sur_place_societe)
    contactSurPlaceLines.push(`Société : ${booking.contact_sur_place_societe}`)
  const commentairesBlocks: string[] = []
  if (booking.commentaires) commentairesBlocks.push(booking.commentaires)
  if (booking.instructions_speciales)
    commentairesBlocks.push(`Instructions spéciales :\n${booking.instructions_speciales}`)
  if (contactSurPlaceLines.length > 0)
    commentairesBlocks.push(contactSurPlaceLines.join('\n'))
  content.push(
    textSection('Commentaires', commentairesBlocks.join('\n\n').trim() || null, color)
  )

  // Suivi commercial (2 colonnes, insécable)
  content.push({
    stack: [
      sectionTitle('Suivi commercial', color),
      {
        columns: [
          {
            width: '*',
            stack: [
              labelValue('Commerciaux assignés', assignedNames.join(', ') || null),
              { ...(labelValue('Occasion', booking.occasion) as object), margin: [0, 4, 0, 0] },
              { ...(labelValue('Relance', booking.relance) as object), margin: [0, 4, 0, 0] },
              {
                ...(labelValue(
                  'Budget client',
                  booking.budget_client != null
                    ? formatEuroAdaptive(booking.budget_client)
                    : null
                ) as object),
                margin: [0, 4, 0, 0],
              },
            ],
          },
          {
            width: '*',
            stack: [
              labelValue('Source', booking.source),
              { ...(labelValue('Option', booking.option) as object), margin: [0, 4, 0, 0] },
              {
                ...(labelValue(
                  'Date signature devis',
                  formatDateLong(booking.date_signature_devis)
                ) as object),
                margin: [0, 4, 0, 0],
              },
            ],
          },
        ] as Column[],
        columnGap: 14,
      },
    ],
    unbreakable: true,
  })

  return {
    content,
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `Fiche de fonction n°${bookingRef} — imprimé le ${printedAt}`, style: 'footer' },
        { text: `Page ${currentPage}/${pageCount}`, style: 'footer', alignment: 'right' as const },
      ],
      margin: [30, 8, 30, 0] as [number, number, number, number],
    }),
    // Un titre de section ne reste jamais seul en bas de page.
    // Cast : @types/pdfmake 0.3 déclare (currentNode, nodeQueries) mais le runtime 0.2.23 passe des arguments positionnels, on garde la signature positionnelle.
    pageBreakBefore: ((currentNode: any, followingNodesOnPage: any[]) =>
      currentNode.headlineLevel === 1 &&
      followingNodesOnPage.length === 0) as unknown as TDocumentDefinitions['pageBreakBefore'],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      lineHeight: 1.35,
    },
    styles: {
      headerTitle: { fontSize: 14, bold: true },
      headerDocTitle: { fontSize: 10, bold: true },
      headerSmall: { fontSize: 8 },
      ficheSectionTitle: { fontSize: 9, bold: true },
      ficheLabel: { fontSize: 7, bold: true, color: LIGHT_GRAY },
      ficheValue: { fontSize: 9 },
      ficheText: { fontSize: 9 },
      ficheDesc: { fontSize: 8 },
      ficheTableHeader: { fontSize: 8, bold: true },
      ficheTableCell: { fontSize: 8 },
      footer: { fontSize: 7, color: LIGHT_GRAY },
    },
    pageMargins: [30, 30, 30, 50] as [number, number, number, number],
  }
}

export async function generateFicheFonctionPdf(bookingId: string): Promise<{
  buffer: Buffer
  booking: FicheBookingData
}> {
  const { booking, assignedNames } = await fetchBookingFullData(bookingId)
  const docDefinition = buildFicheFonctionDocDefinition(booking, assignedNames)
  const buffer = await renderPdfToBuffer(docDefinition)
  return { buffer, booking }
}
