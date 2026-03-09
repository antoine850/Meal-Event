import { Router, type Request, type Response } from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'
import { verifyWebhookSignature, downloadSignedDocument } from '../lib/signnow.js'
import { generateQuotePdf } from '../lib/pdf-generator.js'
import { sendEmail } from '../lib/resend.js'
import { buildDepositEmailHtml, buildDepositEmailSubject } from '../lib/email-templates.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

export const webhooksRouter = Router()

// ═══════════════════════════════════════════════════════════════
// POST /api/webhooks/stripe
// ═══════════════════════════════════════════════════════════════
webhooksRouter.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`)
  }

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

// ═══════════════════════════════════════════════════════════════
// POST /api/webhooks/signnow — Handle SignNow document events
// ═══════════════════════════════════════════════════════════════
webhooksRouter.post('/signnow', async (req: Request, res: Response) => {
  try {
    // Verify webhook signature if secret is configured
    const signature = req.headers['x-signnow-signature'] as string || ''
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)

    if (process.env.SIGNNOW_WEBHOOK_SECRET && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature)
      if (!isValid) {
        console.error('SignNow webhook signature verification failed')
        return res.status(400).json({ error: 'Invalid signature' })
      }
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const eventType = payload.event || payload.action || ''
    const documentId = payload.document_id || payload.data?.document_id || ''

    console.log(`SignNow webhook: ${eventType} for document ${documentId}`)

    if (eventType === 'document.complete' || eventType === 'document_complete') {
      await handleSignNowDocumentComplete(documentId)
    }

    res.json({ received: true })
  } catch (error) {
    console.error('Error handling SignNow webhook:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

// ═══════════════════════════════════════════════════════════════
// Stripe: Handle successful payment
// ═══════════════════════════════════════════════════════════════
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

    // Update quote timestamps based on link_type
    if (quote_id && link_type === 'deposit') {
      await supabase
        .from('quotes')
        .update({
          status: 'deposit_paid',
          deposit_paid_at: new Date().toISOString(),
        })
        .eq('id', quote_id)
    } else if (quote_id && link_type === 'balance') {
      await supabase
        .from('quotes')
        .update({
          status: 'balance_paid',
          balance_paid_at: new Date().toISOString(),
        })
        .eq('id', quote_id)
    }

    // Update booking status based on payment type
    let newStatusSlug = 'acompte-paye'
    if (link_type === 'balance' || link_type === 'full') {
      newStatusSlug = 'confirme'
    }

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

    console.log(`Payment successful for booking ${booking_id}, type: ${link_type}`)
  } catch (error) {
    console.error('Error handling payment success:', error)
  }
}

// ═══════════════════════════════════════════════════════════════
// Stripe: Handle failed payment
// ═══════════════════════════════════════════════════════════════
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { booking_id } = paymentIntent.metadata || {}

  if (!booking_id) return

  try {
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

// ═══════════════════════════════════════════════════════════════
// SignNow: Handle document complete (signed)
// Auto-triggers deposit email + Stripe payment link
// ═══════════════════════════════════════════════════════════════
async function handleSignNowDocumentComplete(signnowDocumentId: string) {
  try {
    // Find quote by signnow_document_id
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, booking_id, organization_id, quote_number, total_ttc, deposit_percentage, title, date_start')
      .eq('signnow_document_id', signnowDocumentId)
      .single()

    if (quoteError || !quote) {
      console.error('Quote not found for SignNow document:', signnowDocumentId)
      return
    }

    // Download signed document
    let signedPdfUrl: string | null = null
    try {
      const signedPdf = await downloadSignedDocument(signnowDocumentId)
      // Upload to Supabase Storage
      const fileName = `signed-${quote.quote_number}.pdf`
      const { data: uploadData } = await supabase.storage
        .from('documents')
        .upload(`quotes/${quote.id}/${fileName}`, signedPdf, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (uploadData?.path) {
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(uploadData.path)
        signedPdfUrl = urlData?.publicUrl || null
      }
    } catch (downloadErr) {
      console.error('Error downloading signed document:', downloadErr)
    }

    // Update quote as signed
    await supabase
      .from('quotes')
      .update({
        status: 'quote_signed',
        quote_signed_at: new Date().toISOString(),
        signed_pdf_url: signedPdfUrl,
      })
      .eq('id', quote.id)

    console.log(`Quote ${quote.quote_number} signed via SignNow`)

    // ── AUTO-TRIGGER: Send deposit invoice + Stripe payment link ──
    await autoSendDepositAfterSignature(quote.id)
  } catch (error) {
    console.error('Error handling SignNow document complete:', error)
  }
}

async function autoSendDepositAfterSignature(quoteId: string) {
  try {
    // Fetch full quote data for PDF generation and email
    const { data: quote } = await supabase
      .from('quotes')
      .select(`
        *,
        booking:bookings(
          id, event_date, assigned_to,
          contact:contacts(id, first_name, last_name, email, phone),
          restaurant:restaurants(
            id, name, address, city, postal_code, phone, email,
            logo_url, color, siret, tva_number, iban, bic, bank_name,
            legal_name, legal_form, share_capital, rcs, siren
          )
        )
      `)
      .eq('id', quoteId)
      .single()

    if (!quote) return

    const booking = (quote as any).booking
    const restaurant = booking?.restaurant
    const contact = booking?.contact

    if (!contact?.email) {
      console.error('No contact email for auto-deposit after signature')
      return
    }

    const depositAmount = quote.total_ttc * (quote.deposit_percentage / 100)

    // Get commercial info
    let commercialName: string | null = null
    let commercialEmail: string | null = null
    if (booking?.assigned_to) {
      const { data: user } = await supabase
        .from('users')
        .select('first_name, last_name, email')
        .eq('id', booking.assigned_to)
        .single()
      if (user) {
        commercialName = `${user.first_name} ${user.last_name}`
        commercialEmail = user.email
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Acompte — ${quote.title || quote.quote_number}`,
            description: `Acompte ${quote.deposit_percentage}% pour ${restaurant?.name || 'événement'}`,
          },
          unit_amount: Math.round(depositAmount * 100),
        },
        quantity: 1,
      }],
      metadata: {
        booking_id: booking?.id || '',
        quote_id: quoteId,
        link_type: 'deposit',
      },
      customer_email: contact.email,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/evenements/booking/${booking?.id}?payment=success&type=deposit`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/evenements/booking/${booking?.id}?payment=cancelled`,
    })

    // Generate deposit PDF
    const pdfBuffer = await generateQuotePdf(quoteId, 'acompte')

    // Build & send email
    const html = buildDepositEmailHtml({
      restaurant: restaurant as any,
      contact: { first_name: contact.first_name, last_name: contact.last_name, email: contact.email },
      quoteNumber: quote.quote_number,
      depositPercentage: quote.deposit_percentage,
      depositAmount,
      totalTtc: quote.total_ttc,
      stripePaymentUrl: session.url || '',
      eventDate: quote.date_start || booking?.event_date || null,
      commercialName,
    })

    const subject = buildDepositEmailSubject(quote.quote_number, restaurant?.name || 'Restaurant')

    const emailResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      attachments: [{
        filename: `facture-acompte-${quote.quote_number}.pdf`,
        content: pdfBuffer,
      }],
    })

    // Update quote
    await supabase
      .from('quotes')
      .update({
        status: 'deposit_sent',
        deposit_sent_at: new Date().toISOString(),
        stripe_deposit_session_id: session.id,
        stripe_deposit_url: session.url,
      })
      .eq('id', quoteId)

    // Save payment link
    await supabase
      .from('payment_links')
      .insert({
        booking_id: booking?.id,
        quote_id: quoteId,
        link_type: 'deposit',
        amount: depositAmount,
        percentage: quote.deposit_percentage,
        url: session.url,
        stripe_link_id: session.id,
      })

    // Log email
    await supabase
      .from('email_logs')
      .insert({
        organization_id: quote.organization_id,
        quote_id: quoteId,
        booking_id: booking?.id,
        email_type: 'deposit_invoice',
        recipient_email: contact.email,
        reply_to_email: commercialEmail || restaurant?.email,
        subject,
        resend_message_id: emailResult.id,
        status: 'sent',
      })

    console.log(`Auto-sent deposit email for quote ${quote.quote_number} after signature`)
  } catch (error) {
    console.error('Error auto-sending deposit after signature:', error)
  }
}
