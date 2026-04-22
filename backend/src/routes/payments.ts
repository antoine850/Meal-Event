import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'
import { notifyCommercialPayment } from '../lib/commercial-notifications.js'
import { sendEmail } from '../lib/resend.js'
import { buildPaymentLinkEmailHtml, buildPaymentLinkEmailSubject } from '../lib/email-templates.js'

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

    // Notify commercial(s) of the manual payment
    if (data?.booking_id && data?.amount) {
      notifyCommercialPayment({
        bookingId: data.booking_id,
        amount: data.amount,
        paymentType: data.payment_type || data.payment_modality || 'full',
        paymentMethod: data.payment_method || 'manual',
      }).catch(err => console.error('[Manual Payment] Commercial notification error:', err))
    }

    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating payment:', error)
    res.status(500).json({ error: 'Failed to create payment' })
  }
})

// POST /api/payments/create-link - Create Stripe payment link (optionally send by email)
paymentsRouter.post('/create-link', async (req: Request, res: Response) => {
  try {
    const {
      booking_id,
      quote_id,
      amount,
      link_type,
      percentage,
      payment_modality,
      send_email,
      contact_email_override,
      notes,
    }: {
      booking_id: string
      quote_id?: string | null
      amount: number
      link_type?: 'deposit' | 'balance' | 'full' | string
      percentage?: number | null
      payment_modality?: 'acompte' | 'solde' | 'autre'
      send_email?: boolean
      contact_email_override?: string | null
      notes?: string | null
    } = req.body

    // Normalize modality
    const modality: 'acompte' | 'solde' | 'autre' =
      payment_modality || (link_type === 'deposit' ? 'acompte' : link_type === 'balance' ? 'solde' : 'autre')

    // Get booking details with full restaurant branding for the email
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        *,
        contact:contacts (first_name, last_name, email),
        restaurant:restaurants (
          name, logo_url, color, address, city, postal_code, phone, email,
          siret, tva_number, iban, bic, bank_name, legal_name, legal_form,
          share_capital, rcs, siren
        )
      `)
      .eq('id', booking_id)
      .single()

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' })
    }

    const bookingAny = booking as any
    const restaurantBranding = bookingAny.restaurant || { name: 'Restaurant' }
    const contactFromDb = bookingAny.contact as { first_name: string; last_name: string | null; email: string | null } | null

    // Resolve quote number (if quote_id provided)
    let quoteNumber: string | null = null
    let quoteOrderNumber: string | null = null
    if (quote_id) {
      const { data: q } = await supabase
        .from('quotes')
        .select('quote_number, order_number')
        .eq('id', quote_id)
        .single()
      quoteNumber = (q as any)?.quote_number ?? null
      quoteOrderNumber = (q as any)?.order_number ?? null
    }

    // Product label (for Stripe Checkout)
    const productLabel = modality === 'acompte' ? 'Acompte' : modality === 'solde' ? 'Solde' : 'Paiement'

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${productLabel} - ${booking.event_type}`,
              description: `Réservation chez ${restaurantBranding.name} le ${booking.event_date}`,
            },
            unit_amount: Math.round(amount * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        booking_id,
        quote_id: quote_id || '',
        link_type: link_type || 'full',
        payment_modality: modality,
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?type=${link_type || 'full'}&booking=${booking_id}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?status=cancelled`,
    })

    const paymentLink = { url: session.url || '', id: session.id }

    // Save payment link to database
    const { data, error } = await supabase
      .from('payment_links')
      .insert({
        booking_id,
        quote_id: quote_id || null,
        link_type: link_type || 'full',
        amount,
        percentage: percentage ?? null,
        url: paymentLink.url,
        stripe_link_id: paymentLink.id,
      })
      .select()
      .single()

    if (error) throw error

    // Create pending payment record so Stripe webhook can find and update it
    await supabase
      .from('payments')
      .insert({
        organization_id: bookingAny.organization_id,
        booking_id,
        quote_id: quote_id || null,
        amount,
        payment_type: link_type || 'full',
        payment_modality: modality,
        payment_method: 'stripe',
        stripe_payment_id: session.id,
        status: 'pending',
        notes: notes || null,
      })

    // Log activity
    await supabase.from('activity_logs').insert({
      organization_id: bookingAny.organization_id,
      booking_id,
      action_type: modality === 'acompte' ? 'payment.deposit_sent' : 'payment.balance_sent',
      action_label: `Lien de paiement ${modality} de ${amount} \u20AC créé`,
      actor_type: 'user',
      entity_type: 'payment',
      metadata: { amount, link_type, modality },
    })

    // Optionally send the payment link by email
    let emailSent = false
    let emailError: string | null = null
    if (send_email) {
      const toEmail = (contact_email_override && contact_email_override.trim()) || contactFromDb?.email || null
      if (!toEmail) {
        emailError = 'Aucune adresse email destinataire disponible'
      } else {
        try {
          // Commercial info (for reply-to + signature)
          let commercialName: string | null = null
          let commercialEmail: string | null = null
          if (bookingAny.assigned_to) {
            const { data: user } = await supabase
              .from('users')
              .select('first_name, last_name, email')
              .eq('id', bookingAny.assigned_to)
              .single()
            if (user) {
              commercialName = `${(user as any).first_name} ${(user as any).last_name}`
              commercialEmail = (user as any).email
            }
          }

          // Org-level facturation email (for reply-to)
          let facturationEmail: string | null = null
          if (bookingAny.organization_id) {
            const { data: org } = await supabase
              .from('organizations')
              .select('facturation_email')
              .eq('id', bookingAny.organization_id)
              .single()
            facturationEmail = (org as any)?.facturation_email || null
          }

          const html = buildPaymentLinkEmailHtml({
            restaurant: restaurantBranding,
            contact: {
              first_name: contactFromDb?.first_name || '',
              last_name: contactFromDb?.last_name || null,
              email: toEmail,
            },
            quoteNumber,
            modality,
            amount,
            stripePaymentUrl: paymentLink.url,
            eventDate: bookingAny.event_date || null,
            commercialName,
            orderNumber: quoteOrderNumber,
          })

          const subject = buildPaymentLinkEmailSubject(modality, restaurantBranding.name || 'Restaurant', quoteNumber)

          await sendEmail({
            to: toEmail,
            subject,
            html,
            replyTo: commercialEmail || restaurantBranding.email || undefined,
            facturationEmail: facturationEmail || undefined,
          })

          emailSent = true
          console.log(`[create-link] ✅ Email sent to ${toEmail}`)
        } catch (err) {
          console.error('[create-link] Email send error:', err)
          emailError = err instanceof Error ? err.message : 'Email send failed'
        }
      }
    }

    res.status(201).json({ ...data, email_sent: emailSent, email_error: emailError, url: paymentLink.url })
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

    // Auto-update booking status → Relance paiement
    if (payment.booking_id) {
      const { data: booking } = await supabase.from('bookings').select('organization_id').eq('id', payment.booking_id).single()
      if (booking?.organization_id) {
        const { data: statusData } = await supabase
          .from('statuses')
          .select('id')
          .eq('organization_id', booking.organization_id)
          .eq('slug', 'relance_paiement')
          .eq('type', 'booking')
          .single()
        if (statusData) {
          await supabase.from('bookings').update({ status_id: statusData.id }).eq('id', payment.booking_id)
          console.log(`[Remind] ✅ Booking ${payment.booking_id} status → relance_paiement`)
        }
      }
    }

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
