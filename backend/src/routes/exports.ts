import { Router, Request, Response } from 'express'
import { computeDepositAmounts } from '../lib/quote-rounding.js'
import { supabase } from '../lib/supabase.js'

export const exportsRouter = Router()

// Echappement CSV : on entoure de guillemets si le champ contient le separateur,
// un guillemet ou un saut de ligne (et on double les guillemets internes).
function csvField(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// Gere les dates seules (YYYY-MM-DD) et les timestamps ISO -> JJ/MM/AAAA.
function fmtDate(v: string | null | undefined): string {
  if (!v) return ''
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// Virgule decimale pour qu'Excel FR lise un nombre (separateur de colonnes = ;).
function fmtAmount(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : v.toFixed(2).replace('.', ',')
}

function primaryQuote(b: any): any | null {
  const quotes = b.quotes || []
  return quotes.find((q: any) => q.primary_quote) || quotes[0] || null
}

function depositAmount(q: any): number | null {
  if (!q) return null
  if (q.deposit_amount_override != null) return q.deposit_amount_override
  if (q.total_ttc != null && q.deposit_percentage)
    return computeDepositAmounts(q.total_ttc, q.total_ht ?? 0, {
      percentage: q.deposit_percentage,
    }).ttc
  return null
}

// GET /api/exports/events.csv — admin only (organizationId monte par requireOrgAdmin)
exportsRouter.get('/events.csv', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).organizationId as string
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const statusIds = (req.query.status as string | undefined)
      ?.split(',')
      .filter(Boolean)
    const restaurantIds = (req.query.restaurant as string | undefined)
      ?.split(',')
      .filter(Boolean)
    const commercialIds = (req.query.commercial as string | undefined)
      ?.split(',')
      .filter(Boolean)

    let query = supabase
      .from('bookings')
      .select(
        `
        event_date, start_time, end_time, event_type, occasion, guests_count,
        internal_notes, assigned_user_ids, status_id, restaurant_id,
        contact:contacts (first_name, last_name, email, phone,
          company:companies (name, billing_address, billing_city, billing_postal_code, siret, tva_number)),
        restaurant:restaurants (name),
        status:statuses (name),
        space:spaces (name),
        quotes (quote_number, status, total_ht, total_ttc, discount_percentage,
          deposit_amount_override, deposit_percentage, quote_sent_at, quote_signed_at, primary_quote)
      `
      )
      .eq('organization_id', organizationId)
      .order('event_date', { ascending: true })

    if (from) query = query.gte('event_date', from)
    if (to) query = query.lte('event_date', to)
    if (statusIds?.length) query = query.in('status_id', statusIds)
    if (restaurantIds?.length) query = query.in('restaurant_id', restaurantIds)
    if (commercialIds?.length)
      query = query.overlaps('assigned_user_ids', commercialIds)

    const { data: bookings, error } = await query
    if (error) throw error

    // assigned_user_ids = tableau d'IDs -> on resout les noms via la table users.
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('organization_id', organizationId)
    const userName = new Map(
      (users || []).map((u: any) => [
        u.id,
        `${u.first_name || ''} ${u.last_name || ''}`.trim(),
      ])
    )

    const columns: Array<[string, (b: any) => string]> = [
      ['Date évènement', (b) => fmtDate(b.event_date)],
      ['Heure début', (b) => b.start_time || ''],
      ['Heure fin', (b) => b.end_time || ''],
      ['Type', (b) => b.event_type || ''],
      ['Occasion', (b) => b.occasion || ''],
      [
        'Convives',
        (b) => (b.guests_count != null ? String(b.guests_count) : ''),
      ],
      ['Espace', (b) => b.space?.name || ''],
      ['Statut', (b) => b.status?.name || ''],
      ['Notes internes', (b) => b.internal_notes || ''],
      ['Prénom client', (b) => b.contact?.first_name || ''],
      ['Nom client', (b) => b.contact?.last_name || ''],
      ['Email client', (b) => b.contact?.email || ''],
      ['Téléphone client', (b) => b.contact?.phone || ''],
      ['Société', (b) => b.contact?.company?.name || ''],
      [
        'Adresse facturation',
        (b) => {
          const c = b.contact?.company
          if (!c) return ''
          return [c.billing_address, c.billing_postal_code, c.billing_city]
            .filter(Boolean)
            .join(' ')
        },
      ],
      ['SIRET', (b) => b.contact?.company?.siret || ''],
      ['N° TVA', (b) => b.contact?.company?.tva_number || ''],
      ['Restaurant', (b) => b.restaurant?.name || ''],
      [
        'Commercial(aux)',
        (b) =>
          (b.assigned_user_ids || [])
            .map((id: string) => userName.get(id))
            .filter(Boolean)
            .join(' / '),
      ],
      ['N° devis', (b) => primaryQuote(b)?.quote_number || ''],
      ['Statut devis', (b) => primaryQuote(b)?.status || ''],
      ['Total HT', (b) => fmtAmount(primaryQuote(b)?.total_ht)],
      ['Total TTC', (b) => fmtAmount(primaryQuote(b)?.total_ttc)],
      [
        'Remise %',
        (b) => {
          const p = primaryQuote(b)?.discount_percentage
          return p ? String(p).replace('.', ',') : ''
        },
      ],
      ['Acompte', (b) => fmtAmount(depositAmount(primaryQuote(b)))],
      ['Date envoi devis', (b) => fmtDate(primaryQuote(b)?.quote_sent_at)],
      [
        'Date signature devis',
        (b) => fmtDate(primaryQuote(b)?.quote_signed_at),
      ],
    ]

    const header = columns.map(([label]) => csvField(label)).join(';')
    const rows = (bookings || []).map((b: any) =>
      columns.map(([, fn]) => csvField(fn(b))).join(';')
    )
    const csv = [header, ...rows].join('\r\n')

    const today = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="evenements-${today}.csv"`
    )
    // BOM UTF-8 pour qu'Excel detecte l'encodage et affiche les accents.
    res.send('\uFEFF' + csv)
  } catch (error) {
    console.error('Error exporting events:', error)
    res.status(500).json({ error: 'Failed to export events' })
  }
})
