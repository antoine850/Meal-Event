import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

export const paymentsRouter = Router()

// GET /api/payments
paymentsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organization_id as string
    const bookingId = req.query.booking_id as string
    const status = req.query.status as string

    let query = supabase
      .from('payments')
      .select(`
        *,
        booking:bookings (
          id, event_type, event_date,
          contact:contacts (id, first_name, last_name),
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
    console.error('Error fetching payments:', error)
    res.status(500).json({ error: 'Failed to fetch payments' })
  }
})

// POST /api/payments - Create manual payment
paymentsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        ...req.body,
        status: req.body.status || 'paid',
        paid_at: req.body.paid_at || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating payment:', error)
    res.status(500).json({ error: 'Failed to create payment' })
  }
})

// POST /api/payments/create-link - Create Stripe payment link
paymentsRouter.post('/create-link', async (req: Request, res: Response) => {
  try {
    const { booking_id, quote_id, amount, link_type, percentage } = req.body

    // Get booking details
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        *,
        contact:contacts (first_name, last_name, email),
        restaurant:restaurants (name)
      `)
      .eq('id', booking_id)
      .single()

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' })
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${link_type === 'deposit' ? 'Acompte' : 'Paiement'} - ${booking.event_type}`,
              description: `Réservation chez ${(booking as { restaurant?: { name: string } }).restaurant?.name} le ${booking.event_date}`,
            },
            unit_amount: Math.round(amount * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        booking_id,
        quote_id: quote_id || '',
        link_type,
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/bookings/${booking_id}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/bookings/${booking_id}?payment=cancelled`,
    })

    const paymentLink = { url: session.url, id: session.id }

    // Save payment link to database
    const { data, error } = await supabase
      .from('payment_links')
      .insert({
        booking_id,
        quote_id,
        link_type,
        amount,
        percentage,
        url: paymentLink.url,
        stripe_link_id: paymentLink.id,
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating payment link:', error)
    res.status(500).json({ error: 'Failed to create payment link' })
  }
})

// POST /api/payments/:id/remind - Send payment reminder
paymentsRouter.post('/:id/remind', async (req: Request, res: Response) => {
  try {
    const { reminder_type, subject, message } = req.body

    // Get payment details
    const { data: payment } = await supabase
      .from('payments')
      .select('booking_id')
      .eq('id', req.params.id)
      .single()

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    // Create reminder record
    const { data, error } = await supabase
      .from('payment_reminders')
      .insert({
        booking_id: payment.booking_id,
        payment_id: req.params.id,
        reminder_type: reminder_type || 'payment',
        subject,
        message,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // TODO: Send email reminder

    res.status(201).json(data)
  } catch (error) {
    console.error('Error sending reminder:', error)
    res.status(500).json({ error: 'Failed to send reminder' })
  }
})

// POST /api/payments/receipts - Upload receipt
paymentsRouter.post('/receipts', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .insert(req.body)
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating receipt:', error)
    res.status(500).json({ error: 'Failed to create receipt' })
  }
})
