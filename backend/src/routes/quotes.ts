import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

export const quotesRouter = Router()

// GET /api/quotes
quotesRouter.get('/', async (req, res) => {
  try {
    const organizationId = req.query.organization_id as string
    const bookingId = req.query.booking_id as string
    const status = req.query.status as string

    let query = supabase
      .from('quotes')
      .select(`
        *,
        booking:bookings (
          id, event_type, event_date,
          contact:contacts (id, first_name, last_name, email),
          restaurant:restaurants (id, name)
        )
      `)
      .order('created_at', { ascending: false })

    if (organizationId) query = query.eq('organization_id', organizationId)
    if (bookingId) query = query.eq('booking_id', bookingId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error fetching quotes:', error)
    res.status(500).json({ error: 'Failed to fetch quotes' })
  }
})

// GET /api/quotes/:id
quotesRouter.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        booking:bookings (
          *,
          contact:contacts (*),
          restaurant:restaurants (*)
        ),
        quote_items (*),
        payments (*)
      `)
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Quote not found' })
    res.json(data)
  } catch (error) {
    console.error('Error fetching quote:', error)
    res.status(500).json({ error: 'Failed to fetch quote' })
  }
})

// POST /api/quotes
quotesRouter.post('/', async (req, res) => {
  try {
    // Generate quote number
    const { data: settings } = await supabase
      .from('settings')
      .select('quote_prefix')
      .eq('organization_id', req.body.organization_id)
      .single()

    const prefix = settings?.quote_prefix || 'DEV'
    const timestamp = Date.now().toString(36).toUpperCase()
    const quoteNumber = `${prefix}-${timestamp}`

    const { data, error } = await supabase
      .from('quotes')
      .insert({ ...req.body, quote_number: quoteNumber })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating quote:', error)
    res.status(500).json({ error: 'Failed to create quote' })
  }
})

// PATCH /api/quotes/:id
quotesRouter.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error updating quote:', error)
    res.status(500).json({ error: 'Failed to update quote' })
  }
})

// POST /api/quotes/:id/send - Send quote for signature
quotesRouter.post('/:id/send', async (req, res) => {
  try {
    const { signer_email, signer_name } = req.body

    const { data, error } = await supabase
      .from('quotes')
      .update({
        status: 'sent',
        signature_requested_at: new Date().toISOString(),
        signer_email,
        signer_name,
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error

    // TODO: Send email with signature link

    res.json(data)
  } catch (error) {
    console.error('Error sending quote:', error)
    res.status(500).json({ error: 'Failed to send quote' })
  }
})

// POST /api/quotes/:id/sign - Sign quote
quotesRouter.post('/:id/sign', async (req, res) => {
  try {
    const { signature_url } = req.body

    const { data, error } = await supabase
      .from('quotes')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_url,
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error signing quote:', error)
    res.status(500).json({ error: 'Failed to sign quote' })
  }
})

// POST /api/quotes/:id/items - Add item to quote
quotesRouter.post('/:id/items', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quote_items')
      .insert({ ...req.body, quote_id: req.params.id })
      .select()
      .single()

    if (error) throw error

    // Recalculate quote totals
    await recalculateQuoteTotals(req.params.id)

    res.status(201).json(data)
  } catch (error) {
    console.error('Error adding quote item:', error)
    res.status(500).json({ error: 'Failed to add quote item' })
  }
})

// Helper function to recalculate quote totals
async function recalculateQuoteTotals(quoteId: string) {
  const { data: items } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quoteId)

  if (!items) return

  let totalHt = 0
  let totalTva = 0

  for (const item of items) {
    const itemTotalHt = (item.unit_price * item.quantity) - (item.discount_amount || 0)
    const itemTva = itemTotalHt * (item.tva_rate / 100)
    totalHt += itemTotalHt
    totalTva += itemTva
  }

  await supabase
    .from('quotes')
    .update({
      total_ht: totalHt,
      total_tva: totalTva,
      total_ttc: totalHt + totalTva,
    })
    .eq('id', quoteId)
}
