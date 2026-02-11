import { Router, type Request, type Response } from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

export const webhooksRouter = Router()

// POST /api/webhooks/stripe
webhooksRouter.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`)
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      await handlePaymentSuccess(session)
      break
    }
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      console.log('PaymentIntent succeeded:', paymentIntent.id)
      break
    }
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      await handlePaymentFailed(paymentIntent)
      break
    }
    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  res.json({ received: true })
})

async function handlePaymentSuccess(session: Stripe.Checkout.Session) {
  const { booking_id, quote_id, link_type } = session.metadata || {}

  if (!booking_id) {
    console.error('No booking_id in session metadata')
    return
  }

  try {
    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id,
        quote_id: quote_id || null,
        amount: (session.amount_total || 0) / 100,
        payment_type: link_type || 'full',
        payment_method: 'stripe',
        stripe_payment_id: session.payment_intent as string,
        status: 'paid',
        paid_at: new Date().toISOString(),
      })

    if (paymentError) throw paymentError

    // Update payment link as used
    await supabase
      .from('payment_links')
      .update({ used_at: new Date().toISOString(), is_active: false })
      .eq('booking_id', booking_id)
      .eq('stripe_link_id', session.id)

    // Update booking status based on payment type
    let newStatusSlug = 'acompte-paye'
    if (link_type === 'full') {
      newStatusSlug = 'confirme'
    }

    // Get the status ID
    const { data: booking } = await supabase
      .from('bookings')
      .select('organization_id')
      .eq('id', booking_id)
      .single()

    if (booking) {
      const { data: status } = await supabase
        .from('statuses')
        .select('id')
        .eq('organization_id', booking.organization_id)
        .eq('slug', newStatusSlug)
        .eq('type', 'booking')
        .single()

      if (status) {
        await supabase
          .from('bookings')
          .update({ status_id: status.id })
          .eq('id', booking_id)
      }
    }

    console.log(`Payment successful for booking ${booking_id}`)
  } catch (error) {
    console.error('Error handling payment success:', error)
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { booking_id } = paymentIntent.metadata || {}

  if (!booking_id) return

  try {
    // Create failed payment record
    await supabase
      .from('payments')
      .insert({
        booking_id,
        amount: paymentIntent.amount / 100,
        payment_type: 'full',
        payment_method: 'stripe',
        stripe_payment_intent_id: paymentIntent.id,
        status: 'failed',
      })

    console.log(`Payment failed for booking ${booking_id}`)
  } catch (error) {
    console.error('Error handling payment failure:', error)
  }
}
