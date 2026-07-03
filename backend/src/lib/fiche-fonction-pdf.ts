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

