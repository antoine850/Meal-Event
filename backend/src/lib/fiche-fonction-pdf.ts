import type {
  Column,
  Content,
  ContentCanvas,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces'
import sharp from 'sharp'
import { renderPdfToBuffer } from './pdf-generator.js'
import { formatEuroAdaptive, formatEuroDecimal } from './quote-rounding.js'
import { supabase } from './supabase.js'

const DASH = '—'

interface FicheQuoteItem {
  id: string
  name: string
  description: string | null
  quantity: number | null
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

export interface FicheAssignedUser {
  name: string
  phone: string | null
  email: string | null
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
  budget_client: number | string | null
  space_id: string | null
  assigned_user_ids: string[] | null
  contact: {
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    company: { name: string | null } | null
  } | null
  restaurant: {
    id: string
    name: string | null
    color: string | null
    logo_url: string | null
    address: string | null
    postal_code: string | null
    city: string | null
  } | null
  status: { name: string | null; color: string | null } | null
  space: { name: string | null } | null
  quotes: FicheQuote[]
  payments: FichePayment[]
}

export async function fetchBookingFullData(bookingId: string): Promise<{
  booking: FicheBookingData
  assignedUsers: FicheAssignedUser[]
}> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      contact:contacts(id, first_name, last_name, email, phone, company:companies(name)),
      restaurant:restaurants(id, name, color, logo_url, address, postal_code, city),
      status:statuses(name, color),
      quotes(*, quote_items(*)),
      payments(*)
    `
    )
    .eq('id', bookingId)
    .order('position', {
      referencedTable: 'quotes.quote_items',
      ascending: true,
    })
    .single()

  if (error) throw new Error(`Failed to fetch booking: ${error.message}`)
  const booking = data as unknown as FicheBookingData

  // Pas de FK bookings->spaces exposé côté PostgREST en prod : l'embed échoue, on résout à part (comme le frontend)
  booking.space = null
  if (booking.space_id) {
    const { data: space } = await supabase
      .from('spaces')
      .select('name')
      .eq('id', booking.space_id)
      .single()
    booking.space = space ?? null
  }

  const ids = booking.assigned_user_ids || []
  let assignedUsers: FicheAssignedUser[] = []
  if (ids.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, phone, email')
      .in('id', ids)
    assignedUsers = (users || [])
      .map((u) => ({
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        phone: u.phone as string | null,
        email: u.email as string | null,
      }))
      .filter((u) => u.name)
  }

  return { booking, assignedUsers }
}

// Logos convertis en data URL pour pdfmake ; toute erreur réseau rend le logo
// absent sans bloquer la génération (boundary externe)
async function fetchImageDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const type = (res.headers.get('content-type') || '').split(';')[0]
    const buf = Buffer.from(await res.arrayBuffer())
    if (/^image\/(png|jpeg)$/.test(type)) {
      return `data:${type};base64,${buf.toString('base64')}`
    }
    if (type === 'image/webp') {
      // pdfmake ne lit que PNG/JPEG ; les logos uploadés sont stockés en webp
      const png = await sharp(buf).png().toBuffer()
      return `data:image/png;base64,${png.toString('base64')}`
    }
    return null
  } catch {
    return null
  }
}

export interface FicheImages {
  orgLogo: string | null
  restoLogo: string | null
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

function getRemainingBalance(
  totalTtc: number,
  payments: FichePayment[]
): number {
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

function contactFullName(booking: FicheBookingData): string | null {
  if (!booking.contact) return null
  return (
    [booking.contact.first_name, booking.contact.last_name]
      .filter(Boolean)
      .join(' ') || null
  )
}

// ── Builders de sections ──

// Palette du template client
const INK = '#161412'
const INK_SOFT = '#4A413A'
const INK_MUTE = '#8A8278'
const RULE = '#E0D8CB'
const RULE_SOFT = '#ECE5DA'
const OK = '#2D5F3F'
const OK_BG = '#ECF1ED'
const ALERT = '#B8341A'
const ALERT_BG = '#FBE9E5'
const CREAM = '#FBF9F5'
// Largeur utile : A4 (595.28pt) moins marges latérales de 34pt
const CONTENT_WIDTH = 595.28 - 2 * 34

function hairline(
  color: string,
  width: number,
  length = CONTENT_WIDTH
): ContentCanvas {
  return {
    canvas: [
      {
        type: 'line',
        x1: 0,
        y1: 0,
        x2: length,
        y2: 0,
        lineWidth: width,
        lineColor: color,
      },
    ],
  }
}

// Entête de bloc numéroté : "01  CONTACTS" + filet noir
function blockHead(num: string, title: string, accent: string): Content {
  return {
    stack: [
      {
        columns: [
          {
            width: 'auto',
            text: num,
            font: 'IvyOra',
            italics: true,
            fontSize: 9.5,
            color: accent,
          },
          {
            width: '*',
            text: title.toUpperCase(),
            fontSize: 7.5,
            bold: true,
            characterSpacing: 1.6,
            margin: [8, 1.5, 0, 0] as [number, number, number, number],
          },
        ],
      },
      {
        ...hairline(INK, 0.75),
        margin: [0, 3, 0, 0] as [number, number, number, number],
      },
    ],
    headlineLevel: 1,
    margin: [0, 16, 0, 8] as [number, number, number, number],
  }
}

function topstrip(orgLogo: string | null): Content {
  return {
    stack: [
      {
        columns: [
          orgLogo
            ? {
                width: 'auto',
                image: orgLogo,
                fit: [150, 16] as [number, number],
              }
            : { width: 'auto', text: '' },
          {
            width: '*',
            text: 'PÔLE ÉVÉNEMENTIEL',
            fontSize: 6.5,
            bold: true,
            color: INK_MUTE,
            characterSpacing: 1.6,
            alignment: 'right' as const,
            margin: [0, 5, 0, 0] as [number, number, number, number],
          },
        ] as Column[],
      },
      {
        ...hairline(RULE, 0.5),
        margin: [0, 6, 0, 0] as [number, number, number, number],
      },
    ],
  }
}

function masthead(
  booking: FicheBookingData,
  restoLogo: string | null,
  accent: string,
  bookingRef: string
): Content {
  const statusName = booking.status?.name || null
  const badgeColor = booking.status?.color || accent

  const identity: Content = {
    columns: [
      ...(restoLogo
        ? [{ width: 58, image: restoLogo, fit: [52, 52] as [number, number] }]
        : []),
      {
        width: '*',
        stack: [
          {
            text: "L'ÉTABLISSEMENT",
            fontSize: 6.5,
            bold: true,
            color: INK_MUTE,
            characterSpacing: 1.6,
          },
          {
            text: booking.restaurant?.name || 'Restaurant',
            font: 'IvyOra',
            bold: true,
            fontSize: 21,
            margin: [0, 3, 0, 0] as [number, number, number, number],
          },
        ],
        margin: [restoLogo ? 10 : 0, 6, 0, 0] as [
          number,
          number,
          number,
          number,
        ],
      },
    ],
  }

  const meta: Content = {
    stack: [
      {
        text: 'FICHE DE FONCTION',
        fontSize: 7.5,
        bold: true,
        characterSpacing: 1.6,
        alignment: 'right' as const,
      },
      {
        text: `RÉF · ${bookingRef}`,
        fontSize: 7,
        color: INK_MUTE,
        characterSpacing: 0.5,
        alignment: 'right' as const,
        margin: [0, 3, 0, 0] as [number, number, number, number],
      },
      ...(statusName
        ? [
            {
              columns: [
                { width: '*', text: '' },
                {
                  width: 'auto',
                  table: {
                    body: [
                      [
                        {
                          text: statusName.toUpperCase(),
                          fontSize: 6.5,
                          bold: true,
                          color: 'white',
                          characterSpacing: 1,
                          fillColor: badgeColor,
                          margin: [6, 3, 6, 3] as [
                            number,
                            number,
                            number,
                            number,
                          ],
                        },
                      ],
                    ],
                  },
                  layout: 'noBorders' as const,
                },
              ],
              margin: [0, 8, 0, 0] as [number, number, number, number],
            },
          ]
        : []),
    ],
  }

  return {
    stack: [
      {
        columns: [
          { width: '*', ...identity } as Column,
          { width: 'auto', ...meta } as Column,
        ],
      },
      {
        ...hairline(INK, 1),
        margin: [0, 10, 0, 0] as [number, number, number, number],
      },
    ],
    unbreakable: true,
    margin: [0, 12, 0, 0] as [number, number, number, number],
  }
}

function essentialCell(
  labelText: string,
  value: string | null,
  sub: string | null
): TableCell {
  return {
    stack: [
      {
        text: labelText.toUpperCase(),
        fontSize: 6.5,
        bold: true,
        color: INK_MUTE,
        characterSpacing: 1.2,
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      { text: value || DASH, font: 'IvyOra', bold: true, fontSize: 13 },
      ...(sub
        ? [
            {
              text: sub,
              fontSize: 7.5,
              color: INK_SOFT,
              margin: [0, 2, 0, 0] as [number, number, number, number],
            },
          ]
        : []),
    ],
  }
}

function essentialGrid(booking: FicheBookingData): Content {
  let dateMain: string | null = null
  let dateSub: string | null = null
  if (booking.event_date) {
    const d = new Date(booking.event_date)
    const s = d.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    })
    dateMain = s.charAt(0).toUpperCase() + s.slice(1)
    dateSub = String(d.getFullYear())
  }
  const start = (booking.start_time || '').slice(0, 5)
  const end = (booking.end_time || '').slice(0, 5)
  const contactName = contactFullName(booking)

  return {
    table: {
      widths: ['*', '*', '*', '*'],
      body: [
        [
          essentialCell('Date', dateMain, dateSub),
          essentialCell(
            'Arrivée',
            start || null,
            end ? `jusqu'à ${end}` : null
          ),
          essentialCell(
            'Invités',
            booking.guests_count != null ? `${booking.guests_count} pax` : null,
            contactName
          ),
          essentialCell(
            'Occasion',
            booking.occasion,
            booking.source ? `Source · ${booking.source}` : null
          ),
        ],
      ],
    },
    layout: {
      hLineWidth: (i: number, node: any) =>
        i === node.table.body.length ? 0.5 : 0,
      vLineWidth: (i: number, node: any) =>
        i === 0 || i === node.table.widths.length ? 0 : 0.5,
      hLineColor: () => RULE,
      vLineColor: () => RULE_SOFT,
      paddingLeft: (i: number) => (i === 0 ? 0 : 10),
      paddingRight: () => 10,
      paddingTop: () => 8,
      paddingBottom: () => 10,
    },
    unbreakable: true,
    margin: [0, 10, 0, 0] as [number, number, number, number],
  }
}

function contactCard(
  role: string,
  name: string | null,
  infoLines: (string | null | undefined)[]
): Content {
  return {
    stack: [
      {
        text: role.toUpperCase(),
        fontSize: 6.5,
        bold: true,
        color: INK_MUTE,
        characterSpacing: 1.2,
        margin: [0, 0, 0, 3] as [number, number, number, number],
      },
      { text: name || DASH, font: 'IvyOra', bold: true, fontSize: 11.5 },
      {
        text: infoLines.filter(Boolean).join('\n'),
        fontSize: 8.5,
        color: INK_SOFT,
        lineHeight: 1.4,
        margin: [0, 3, 0, 0] as [number, number, number, number],
      },
    ],
  }
}

// Grille de cartes 2 colonnes
function contactsBlock(
  booking: FicheBookingData,
  commercial: FicheAssignedUser | null,
  accent: string
): Content {
  const contactName = contactFullName(booking)
  const cards: Content[] = [
    contactCard('Client référent', contactName, [
      booking.contact?.phone,
      booking.contact?.email,
    ]),
    contactCard('Société', booking.contact?.company?.name || null, []),
    contactCard('Commercial', commercial?.name || null, [
      commercial?.phone,
      commercial?.email,
    ]),
  ]
  if (
    booking.contact_sur_place_nom ||
    booking.contact_sur_place_tel ||
    booking.contact_sur_place_societe
  ) {
    cards.push(
      contactCard('Contact sur place', booking.contact_sur_place_nom, [
        booking.contact_sur_place_tel,
        booking.contact_sur_place_societe,
      ])
    )
  }
  const rows: Content[] = []
  for (let i = 0; i < cards.length; i += 2) {
    rows.push({
      columns: cards
        .slice(i, i + 2)
        .map((c) => ({ width: '*', ...(c as object) })) as Column[],
      columnGap: 24,
      margin: [0, i === 0 ? 0 : 10, 0, 0] as [number, number, number, number],
    })
  }
  return {
    stack: [blockHead('01', 'Client & contacts', accent), ...rows],
    unbreakable: true,
  }
}

function menuBlock(booking: FicheBookingData, accent: string): Content {
  const courses: [string, string | null][] = [
    ['Apéritif', booking.menu_aperitif],
    ['Entrée', booking.menu_entree],
    ['Plat', booking.menu_plat],
    ['Dessert', booking.menu_dessert],
  ]
  return {
    stack: [
      blockHead('02', 'Menu', accent),
      {
        table: {
          widths: [95, '*'],
          dontBreakRows: true,
          body: courses.map(([course, value]) => [
            {
              text: course.toUpperCase(),
              fontSize: 7,
              bold: true,
              color: accent,
              characterSpacing: 1.4,
              margin: [0, 2, 0, 0] as [number, number, number, number],
            },
            {
              text: value || DASH,
              font: 'IvyOra',
              fontSize: 10.5,
              lineHeight: 1.3,
            },
          ]),
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 0,
          paddingRight: () => 8,
          paddingTop: () => 0,
          paddingBottom: () => 6,
        },
      },
    ],
  }
}

function allergiesBanner(text: string | null): Content {
  const filled = !!(text && text.trim())
  const bar = filled ? ALERT : OK
  const bg = filled ? ALERT_BG : OK_BG
  return {
    table: {
      widths: [3, 'auto', '*'],
      body: [
        [
          { text: '', fillColor: bar },
          {
            text: 'ALLERGIES & RÉGIMES',
            fontSize: 7,
            bold: true,
            color: bar,
            characterSpacing: 1.4,
            fillColor: bg,
            margin: [8, 8, 4, 8] as [number, number, number, number],
          },
          {
            text: filled
              ? text!.trim()
              : "Aucune allergie déclarée. À reconfirmer à l'accueil le jour J.",
            fontSize: 9,
            fillColor: bg,
            lineHeight: 1.4,
            margin: [4, 7, 8, 7] as [number, number, number, number],
          },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 12, 0, 0] as [number, number, number, number],
  }
}

// Bloc titre + texte libre (sécable : les TEXT longs ne doivent pas être unbreakable)
function freetextBlock(
  num: string,
  title: string,
  text: string | null,
  accent: string
): Content {
  return {
    stack: [
      blockHead(num, title, accent),
      { text: text || DASH, fontSize: 9, lineHeight: 1.55 },
    ],
  }
}

const CGV_TEXT =
  'Le client signataire reconnaît avoir pris connaissance et accepté les conditions générales de privatisation jointes au devis, et valide le présent brief comme bon à exécuter. Toute modification du nombre de couverts ou du menu doit être communiquée au commercial au plus tard 48 heures avant la prestation.'

function facturationBlock(
  quote: FicheQuote | null,
  quotes: FicheQuote[],
  payments: FichePayment[],
  accent: string
): Content {
  if (!quote) {
    return {
      stack: [
        blockHead('06', 'Facturation', accent),
        {
          text: 'Aucun devis associé',
          alignment: 'center',
          color: INK_MUTE,
          margin: [0, 6, 0, 6] as [number, number, number, number],
        },
      ],
    }
  }

  const items = quote.quote_items || []
  const totalTtc =
    quote.total_ttc ?? items.reduce((s, i) => s + (i.total_ttc || 0), 0)
  const deposits = payments.filter(
    (p) => p.payment_modality === 'acompte' || p.payment_type === 'deposit'
  )
  const quoteNumberById = new Map<string, string>()
  for (const q of quotes) {
    if (q.id && q.quote_number) quoteNumberById.set(q.id, q.quote_number)
  }
  const remaining = getRemainingBalance(totalTtc, payments)

  const body: TableCell[][] = items.map((item) => [
    {
      stack: [
        { text: item.name, fontSize: 9, color: INK_SOFT },
        ...(item.description
          ? [
              {
                text: item.description,
                fontSize: 7.5,
                color: INK_MUTE,
                margin: [0, 1, 0, 0] as [number, number, number, number],
              },
            ]
          : []),
      ],
    },
    {
      text: item.quantity != null ? `×${item.quantity}` : '',
      fontSize: 8,
      color: INK_MUTE,
      alignment: 'right' as const,
    },
    {
      text: formatEuroDecimal(item.total_ttc || 0),
      fontSize: 9,
      bold: true,
      alignment: 'right' as const,
    },
  ])
  if (items.length === 0) {
    body.push([
      {
        text: 'Aucune ligne',
        colSpan: 3,
        alignment: 'center' as const,
        color: INK_MUTE,
      },
      {},
      {},
    ])
  }

  const totalIdx = body.length
  body.push([
    {
      text: 'TOTAL TTC',
      fontSize: 8,
      bold: true,
      characterSpacing: 1,
      margin: [0, 4, 0, 0] as [number, number, number, number],
    },
    { text: '' },
    {
      text: formatEuroDecimal(totalTtc),
      font: 'IvyOra',
      bold: true,
      fontSize: 14,
      alignment: 'right' as const,
    },
  ])

  for (const p of deposits) {
    const isPaid = p.status === 'paid' || p.status === 'completed'
    const num = p.quote_id ? quoteNumberById.get(p.quote_id) : null
    const label = ['Acompte', num, isPaid ? 'payé' : 'en attente']
      .filter(Boolean)
      .join(' · ')
    body.push([
      { text: label, fontSize: 9, color: isPaid ? OK : INK_MUTE },
      { text: '' },
      {
        text: `${isPaid ? '− ' : ''}${formatEuroDecimal(p.amount || 0)}`,
        fontSize: 9,
        bold: true,
        color: isPaid ? OK : INK_MUTE,
        alignment: 'right' as const,
      },
    ])
  }

  const soldeIdx = body.length
  body.push([
    { text: 'Solde', fontSize: 9, bold: true },
    { text: '' },
    {
      text: formatEuroDecimal(remaining),
      font: 'IvyOra',
      bold: true,
      fontSize: 11,
      color: accent,
      alignment: 'right' as const,
    },
  ])

  return {
    stack: [
      blockHead('06', 'Facturation', accent),
      {
        table: { widths: ['*', 30, 78], body, dontBreakRows: true },
        layout: {
          hLineWidth: (i: number) => {
            if (i === 0 || i === body.length) return 0.75
            if (i === totalIdx) return 0.75
            if (i === soldeIdx) return 0.5
            return 0
          },
          hLineColor: (i: number) => (i === totalIdx ? INK : RULE),
          vLineWidth: (i: number, node: any) =>
            i === 0 || i === node.table.widths.length ? 0.75 : 0,
          vLineColor: () => RULE,
          fillColor: () => CREAM,
          paddingLeft: () => 12,
          paddingRight: () => 12,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },
    ],
  }
}

function signatureBlock(): Content {
  return {
    stack: [
      hairline(INK, 1.5),
      {
        text: CGV_TEXT,
        fontSize: 8,
        color: INK_SOFT,
        lineHeight: 1.45,
        margin: [0, 8, 0, 14] as [number, number, number, number],
      },
      hairline(INK, 0.75),
      {
        text: 'BON POUR ACCORD · LE CLIENT',
        fontSize: 7.5,
        bold: true,
        characterSpacing: 1.4,
        margin: [0, 8, 0, 0] as [number, number, number, number],
      },
      {
        text: 'Mention « lu et approuvé » manuscrite, date et signature',
        font: 'IvyOra',
        italics: true,
        fontSize: 8,
        color: INK_MUTE,
        margin: [0, 2, 0, 48] as [number, number, number, number],
      },
      {
        columns: ['Fait à', 'Le', 'Signature'].map((t) => ({
          width: '*' as const,
          stack: [
            {
              text: t,
              fontSize: 8,
              color: INK_SOFT,
              margin: [0, 0, 0, 2] as [number, number, number, number],
            },
            hairline(RULE, 0.5, (CONTENT_WIDTH - 2 * 14) / 3),
          ],
        })),
        columnGap: 14,
      },
    ],
    unbreakable: true,
    margin: [0, 20, 0, 0] as [number, number, number, number],
  }
}

function labelValue(label: string, value: string | null | undefined): Content {
  return {
    stack: [
      {
        text: label.toUpperCase(),
        fontSize: 6.5,
        bold: true,
        color: INK_MUTE,
        characterSpacing: 1.2,
        margin: [0, 0, 0, 2] as [number, number, number, number],
      },
      { text: value || DASH, fontSize: 9, lineHeight: 1.4 },
    ],
  }
}

export function buildFicheFonctionDocDefinition(
  booking: FicheBookingData,
  assignedUsers: FicheAssignedUser[],
  images: FicheImages
): TDocumentDefinitions {
  const assignedNames = assignedUsers.map((u) => u.name)
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

  const content: Content[] = []

  content.push(topstrip(images.orgLogo))
  content.push(masthead(booking, images.restoLogo, color, bookingRef))
  content.push(essentialGrid(booking))

  content.push(contactsBlock(booking, assignedUsers[0] || null, color))
  content.push(menuBlock(booking, color))
  content.push(allergiesBanner(booking.allergies_regimes))
  content.push(freetextBlock('03', 'Boissons', booking.menu_boissons, color))
  content.push({
    stack: [
      blockHead('04', 'Mise en place', color),
      ...(booking.space?.name
        ? [
            {
              text: `Espace · ${booking.space.name}`,
              fontSize: 8.5,
              bold: true,
              color: INK_SOFT,
              margin: [0, 0, 0, 6] as [number, number, number, number],
            },
          ]
        : []),
      { text: booking.mise_en_place || DASH, fontSize: 9, lineHeight: 1.55 },
    ],
  })
  content.push(freetextBlock('05', 'Déroulé', booking.deroulement, color))

  content.push(facturationBlock(activeQuote, quotes, payments, color))

  // Bloc 07 : textes internes conservés
  const commentairesBlocks: string[] = []
  if (booking.commentaires) commentairesBlocks.push(booking.commentaires)
  if (booking.instructions_speciales)
    commentairesBlocks.push(
      `Instructions spéciales :\n${booking.instructions_speciales}`
    )
  content.push({
    stack: [
      blockHead('07', 'Commentaires', color),
      labelValue('Commentaires facturation', booking.internal_notes),
      {
        ...(labelValue(
          'Commentaires',
          commentairesBlocks.join('\n\n').trim() || null
        ) as object),
        margin: [0, 6, 0, 0] as [number, number, number, number],
      },
      {
        ...(labelValue(
          'Prestations souhaitées',
          booking.prestations_souhaitees
        ) as object),
        margin: [0, 6, 0, 0] as [number, number, number, number],
      },
    ] as Content[],
  })

  // Bloc 08 : suivi commercial
  content.push({
    stack: [
      blockHead('08', 'Suivi commercial', color),
      {
        columns: [
          {
            width: '*',
            stack: [
              labelValue(
                'Commerciaux assignés',
                assignedNames.join(', ') || null
              ),
              {
                ...(labelValue('Relance', booking.relance) as object),
                margin: [0, 6, 0, 0] as [number, number, number, number],
              },
              {
                ...(labelValue(
                  'Budget client',
                  typeof booking.budget_client === 'number' &&
                    Number.isFinite(booking.budget_client)
                    ? formatEuroAdaptive(booking.budget_client)
                    : booking.budget_client
                      ? String(booking.budget_client).trim()
                      : null
                ) as object),
                margin: [0, 6, 0, 0] as [number, number, number, number],
              },
            ],
          },
          {
            width: '*',
            stack: [
              labelValue('Option', booking.option),
              {
                ...(labelValue(
                  'Date signature devis',
                  formatDateLong(booking.date_signature_devis)
                ) as object),
                margin: [0, 6, 0, 0] as [number, number, number, number],
              },
            ],
          },
        ] as Column[],
        columnGap: 24,
      },
    ],
    unbreakable: true,
  })

  content.push(signatureBlock())

  return {
    content,
    footer: (currentPage: number, pageCount: number) => {
      const address = booking.restaurant?.address || ''
      const cp = (booking.restaurant?.postal_code || '').trim()
      const cpVille = [cp, booking.restaurant?.city].filter(Boolean).join(' ')
      // certaines adresses en base contiennent déjà "CP Ville" : on ne l'ajoute que s'il manque
      const addr = [address, cp && address.includes(cp) ? '' : cpVille]
        .filter(Boolean)
        .join(', ')
      return {
        columns: [
          {
            text: [
              {
                text: (booking.restaurant?.name || '').toUpperCase(),
                bold: true,
              },
              { text: addr ? ` · ${addr}` : '' },
            ],
            style: 'footer',
          },
          {
            text: `Émis le ${printedAt} · Page ${currentPage}/${pageCount}`,
            style: 'footer',
            alignment: 'right' as const,
          },
        ],
        style: 'footer',
        margin: [34, 10, 34, 0] as [number, number, number, number],
      }
    },
    // Un titre de section ne reste jamais seul en bas de page.
    // Les nœuds du footer figurent dans followingNodesOnPage sur chaque page : on les ignore via leur style.
    // Cast : @types/pdfmake 0.3 déclare (currentNode, nodeQueries) mais le runtime 0.2.23 passe des arguments positionnels, on garde la signature positionnelle.
    pageBreakBefore: ((currentNode: any, followingNodesOnPage: any[]) =>
      currentNode.headlineLevel === 1 &&
      followingNodesOnPage.filter((n) => n.style !== 'footer').length ===
        0) as unknown as TDocumentDefinitions['pageBreakBefore'],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      lineHeight: 1.35,
    },
    styles: {
      footer: { fontSize: 6.5, color: INK_MUTE },
    },
    pageMargins: [34, 28, 34, 48] as [number, number, number, number],
  }
}

export async function generateFicheFonctionPdf(bookingId: string): Promise<{
  buffer: Buffer
  booking: FicheBookingData
}> {
  const { booking, assignedUsers } = await fetchBookingFullData(bookingId)

  let orgLogoUrl: string | null = null
  if (booking.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('logo_url')
      .eq('id', booking.organization_id)
      .single()
    orgLogoUrl = (org?.logo_url as string | null) ?? null
  }
  const [orgLogo, restoLogo] = await Promise.all([
    fetchImageDataUrl(orgLogoUrl),
    fetchImageDataUrl(booking.restaurant?.logo_url ?? null),
  ])

  const docDefinition = buildFicheFonctionDocDefinition(
    booking,
    assignedUsers,
    {
      orgLogo,
      restoLogo,
    }
  )
  const buffer = await renderPdfToBuffer(docDefinition)
  return { buffer, booking }
}
