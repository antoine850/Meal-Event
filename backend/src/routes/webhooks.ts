import { Router, type Request, type Response } from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'
import { verifyWebhookSignature, downloadSignedDocument } from '../lib/signnow.js'
import { generateQuotePdf } from '../lib/pdf-generator.js'
import { sendEmail } from '../lib/resend.js'
import { buildDepositEmailHtml, buildDepositEmailSubject } from '../lib/email-templates.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

// Helper: get existing Stripe customer by email, or create one
async function getOrCreateStripeCustomer(email: string, name?: string | null): Promise<string> {
  const existing = await stripe.customers.list({ email, limit: 1 })
  if (existing.data.length > 0) return existing.data[0].id
  const customer = await stripe.customers.create({ email, ...(name ? { name } : {}) })
  return customer.id
}

export const webhooksRouter = Router()

// ═══════════════════════════════════════════════════════════════
// POST /api/webhooks/stripe
// ═══════════════════════════════════════════════════════════════
webhooksRouter.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string

  let event: Stripe.Event

  // Only verify signature if webhook secret is configured
  if (webhookSecret) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`)
    }
  } else {
    // No webhook secret configured - parse raw body manually (dev mode)
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET not configured - accepting webhook without verification')
    try {
      // req.body is a Buffer when using express.raw()
      const bodyString = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body
      event = typeof bodyString === 'string' ? JSON.parse(bodyString) : bodyString
      console.log(`[Stripe Webhook] Event type: ${event.type}`)
    } catch (parseErr) {
      console.error('Failed to parse Stripe webhook body:', parseErr)
      return res.status(400).send('Invalid webhook payload')
    }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      await handlePaymentSuccess(session)
      break
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      await handleInvoicePaymentSuccess(invoice)
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
    
    // SignNow webhook payload structure can vary - try multiple paths
    const eventType = payload.event || payload.action || payload.meta?.event || payload.content?.event || ''
    const documentId = payload.document_id || payload.data?.document_id || payload.content?.document_id || payload.meta?.document_id || ''

    console.log(`[SignNow Webhook] Event: ${eventType}, Document: ${documentId}`)

    // SignNow events that indicate document is signed:
    // - user.document.complete - when a user completes signing
    // - document.complete - alternative event name
    // - document.update with status change
    // - invite.update when signer completes
    if (eventType === 'user.document.complete' || eventType === 'document.complete' || eventType === 'document_complete') {
      console.log(`[SignNow Webhook] Processing document complete event for: ${documentId}`)
      await handleSignNowDocumentComplete(documentId)
    } else if (eventType === 'document.update' || eventType === 'invite.update') {
      // Check if the document is fully signed
      const status = payload.data?.status || payload.content?.status || payload.status || ''
      console.log(`[SignNow Webhook] Document status: ${status}`)
      
      // SignNow uses "completed" or "signed" status when all signatures are done
      if (status === 'completed' || status === 'signed' || status === 'document-signed') {
        await handleSignNowDocumentComplete(documentId)
      }
    } else {
      console.log(`[SignNow Webhook] Unhandled event type: ${eventType}`)
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

  console.log(`[Stripe] Payment success - booking: ${booking_id}, quote: ${quote_id}, type: ${link_type}`)

  if (!booking_id) {
    console.error('No booking_id in session metadata')
    return
  }

  try {
    // Get PaymentIntent to retrieve receipt URL
    let receiptUrl: string | null = null
    if (session.payment_intent) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string)
        // Get the latest charge to find receipt URL
        if (paymentIntent.latest_charge) {
          const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string)
          receiptUrl = charge.receipt_url || null
          console.log(`[Stripe] Receipt URL: ${receiptUrl}`)
        }
      } catch (err) {
        console.error('Error retrieving receipt URL:', err)
      }
    }

    // Update existing pending payment to paid (created when link was sent)
    console.log(`[Stripe] Looking for pending payment with stripe_payment_id: ${session.id}`)
    const { data: existingPayment, error: findError } = await supabase
      .from('payments')
      .select('id, status, stripe_payment_id')
      .eq('stripe_payment_id', session.id)
      .single()

    console.log(`[Stripe] Found payment:`, existingPayment, 'Error:', findError?.message)

    if (existingPayment) {
      // Update existing payment (regardless of current status)
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent as string,
          receipt_url: receiptUrl || null,
        })
        .eq('id', existingPayment.id)

      if (updateError) {
        console.error('Error updating payment:', updateError)
      } else {
        console.log(`[Stripe] Updated payment ${existingPayment.id} from ${existingPayment.status} to paid`)
      }
    } else {
      // Fallback: Create new payment if not found
      console.log('[Stripe] No existing payment found, creating new one')
      // Fetch org_id for fallback payment
      const { data: bookingForOrg } = await supabase
        .from('bookings')
        .select('organization_id')
        .eq('id', booking_id)
        .single()

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          organization_id: bookingForOrg?.organization_id || null,
          booking_id,
          quote_id: quote_id || null,
          amount: (session.amount_total || 0) / 100,
          payment_type: link_type || 'full',
          payment_method: 'stripe',
          stripe_payment_id: session.payment_intent as string,
          status: 'paid',
          paid_at: new Date().toISOString(),
          receipt_url: receiptUrl || null,
        })

      if (paymentError) throw paymentError
    }

    // Fetch booking org for downstream use
    const { data: booking } = await supabase
      .from('bookings')
      .select('organization_id')
      .eq('id', booking_id)
      .single()

    // Store receipt as document if URL available
    if (receiptUrl && booking_id) {
      const docName = link_type === 'deposit' ? 'Reçu Stripe - Acompte' : link_type === 'balance' ? 'Reçu Stripe - Solde' : 'Reçu Stripe'
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          organization_id: booking?.organization_id || null,
          booking_id,
          name: docName,
          file_type: 'receipt',
          file_path: receiptUrl,
          file_url: receiptUrl,
        })
      if (docError) {
        console.error(`[Stripe] Failed to store receipt document:`, docError)
      } else {
        console.log(`[Stripe] ✅ Stored receipt document for booking ${booking_id}`)
      }
    }

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
    console.log(`[Stripe] Looking for status slug '${newStatusSlug}' for org ${booking?.organization_id}`)

    if (booking) {
      // List all available booking statuses for debugging
      const { data: allStatuses } = await supabase
        .from('statuses')
        .select('id, slug, name')
        .eq('organization_id', booking.organization_id)
        .eq('type', 'booking')
      console.log(`[Stripe] Available booking statuses for org:`, allStatuses?.map(s => s.slug).join(', '))

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
        console.log(`[Stripe] ✅ Booking ${booking_id} status updated to '${newStatusSlug}'`)
      } else {
        console.warn(`[Stripe] Status slug '${newStatusSlug}' not found for org ${booking.organization_id} — booking status not updated`)
      }
    }

    // Auto-set quote to 'completed' after balance is paid
    if (quote_id && link_type === 'balance') {
      await supabase
        .from('quotes')
        .update({ status: 'completed' })
        .eq('id', quote_id)
        .eq('status', 'balance_paid')
      console.log(`[Stripe] Quote ${quote_id} marked as completed after balance payment`)
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      organization_id: booking?.organization_id,
      booking_id,
      action_type: 'payment.received',
      action_label: `Paiement de ${((session.amount_total || 0) / 100).toLocaleString('fr-FR')} \u20AC reçu via Stripe`,
      actor_type: 'webhook',
      actor_name: 'Stripe',
      entity_type: 'payment',
      entity_id: existingPayment?.id || null,
      metadata: { amount: (session.amount_total || 0) / 100, method: 'stripe', payment_type: link_type },
    })

    console.log(`Payment successful for booking ${booking_id}, type: ${link_type}`)
  } catch (error) {
    console.error('Error handling payment success:', error)
  }
}

// ═══════════════════════════════════════════════════════════════
// Stripe: Handle Invoice paid (Stripe Invoice flow)
// ═══════════════════════════════════════════════════════════════
async function handleInvoicePaymentSuccess(invoice: Stripe.Invoice) {
  const { booking_id, quote_id, link_type } = invoice.metadata || {}

  console.log(`[Stripe Invoice] Payment success - booking: ${booking_id}, quote: ${quote_id}, type: ${link_type}, invoice: ${invoice.id}`)

  if (!booking_id) {
    console.error('[Stripe Invoice] No booking_id in invoice metadata')
    return
  }

  try {
    // Get receipt URL from the charge linked to this invoice
    let receiptUrl: string | null = null
    if (invoice.charge) {
      try {
        const charge = await stripe.charges.retrieve(invoice.charge as string)
        receiptUrl = charge.receipt_url || null
        console.log(`[Stripe Invoice] Receipt URL: ${receiptUrl}`)
      } catch (err) {
        console.error('[Stripe Invoice] Error retrieving receipt URL:', err)
      }
    }

    // Update existing pending payment to paid (matched by invoice ID)
    console.log(`[Stripe Invoice] Looking for pending payment with stripe_payment_id: ${invoice.id}`)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('stripe_payment_id', invoice.id)
      .single()

    if (existingPayment) {
      await supabase
        .from('payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          receipt_url: receiptUrl || null,
        })
        .eq('id', existingPayment.id)
      console.log(`[Stripe Invoice] ✅ Updated payment ${existingPayment.id} to paid`)
    } else {
      // Fallback: create payment if missing
      const { data: bookingForOrg } = await supabase
        .from('bookings')
        .select('organization_id')
        .eq('id', booking_id)
        .single()

      await supabase.from('payments').insert({
        organization_id: bookingForOrg?.organization_id || null,
        booking_id,
        quote_id: quote_id || null,
        amount: (invoice.amount_paid || 0) / 100,
        payment_type: link_type === 'deposit' ? 'deposit' : 'balance',
        payment_modality: link_type === 'deposit' ? 'acompte' : 'solde',
        payment_method: 'stripe',
        stripe_payment_id: invoice.id,
        status: 'paid',
        paid_at: new Date().toISOString(),
        receipt_url: receiptUrl || null,
      })
      console.log(`[Stripe Invoice] ✅ Created new payment for booking ${booking_id}`)
    }

    // Fetch booking org
    const { data: booking } = await supabase
      .from('bookings')
      .select('organization_id')
      .eq('id', booking_id)
      .single()

    // Store receipt as document
    if (receiptUrl && booking_id) {
      const docName = link_type === 'deposit' ? 'Reçu Stripe - Acompte' : 'Reçu Stripe - Solde'
      await supabase.from('documents').insert({
        organization_id: booking?.organization_id || null,
        booking_id,
        name: docName,
        file_type: 'receipt',
        file_path: receiptUrl,
        file_url: receiptUrl,
      })
      console.log(`[Stripe Invoice] ✅ Stored receipt document`)
    }

    // Update payment link as used
    await supabase
      .from('payment_links')
      .update({ used_at: new Date().toISOString(), is_active: false })
      .eq('booking_id', booking_id)
      .eq('stripe_link_id', invoice.id)

    // Update quote status
    if (quote_id && link_type === 'deposit') {
      await supabase
        .from('quotes')
        .update({ status: 'deposit_paid', deposit_paid_at: new Date().toISOString() })
        .eq('id', quote_id)
    } else if (quote_id && link_type === 'balance') {
      await supabase
        .from('quotes')
        .update({ status: 'balance_paid', balance_paid_at: new Date().toISOString() })
        .eq('id', quote_id)
    }

    // Update booking status
    if (booking) {
      const newStatusSlug = link_type === 'balance' ? 'confirme' : 'acompte-paye'
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
        console.log(`[Stripe Invoice] ✅ Booking ${booking_id} status updated to '${newStatusSlug}'`)
      }
    }

    // Auto-complete quote after balance paid
    if (quote_id && link_type === 'balance') {
      await supabase
        .from('quotes')
        .update({ status: 'completed' })
        .eq('id', quote_id)
        .eq('status', 'balance_paid')
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      organization_id: booking?.organization_id,
      booking_id,
      action_type: 'payment.received',
      action_label: `Paiement de ${((invoice.amount_paid || 0) / 100).toLocaleString('fr-FR')} \u20AC reçu via Stripe`,
      actor_type: 'webhook',
      actor_name: 'Stripe',
      entity_type: 'payment',
      entity_id: existingPayment?.id || null,
      metadata: { amount: (invoice.amount_paid || 0) / 100, method: 'stripe', payment_type: link_type },
    })

    console.log(`[Stripe Invoice] ✅ Payment flow complete for booking ${booking_id}, type: ${link_type}`)
  } catch (error) {
    console.error('[Stripe Invoice] Error handling invoice payment success:', error)
  }
}

// ═══════════════════════════════════════════════════════════════
// Stripe: Handle failed payment
// ═══════════════════════════════════════════════════════════════
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  let bookingId = paymentIntent.metadata?.booking_id
  let quoteId = paymentIntent.metadata?.quote_id
  let linkType = paymentIntent.metadata?.link_type

  // PaymentIntent metadata may be empty — look up the checkout session that created it
  if (!bookingId) {
    try {
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntent.id,
        limit: 1,
      })
      const session = sessions.data[0]
      if (session?.metadata) {
        bookingId = session.metadata.booking_id
        quoteId = session.metadata.quote_id
        linkType = session.metadata.link_type
      }
    } catch (err) {
      console.error('Error looking up checkout session for failed payment:', err)
    }
  }

  if (!bookingId) {
    console.warn(`[Stripe] Payment failed but no booking_id found for PaymentIntent ${paymentIntent.id}`)
    return
  }

  try {
    await supabase
      .from('payments')
      .insert({
        booking_id: bookingId,
        quote_id: quoteId || null,
        amount: paymentIntent.amount / 100,
        payment_type: linkType || 'full',
        payment_method: 'stripe',
        stripe_payment_intent_id: paymentIntent.id,
        status: 'failed',
      })

    console.log(`Payment failed for booking ${bookingId}`)
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

    // Download signed document (optional - continue workflow even if it fails)
    let signedPdfUrl: string | null = null
    try {
      console.log(`[SignNow] Downloading signed document: ${signnowDocumentId}`)
      const signedPdf = await downloadSignedDocument(signnowDocumentId)
      
      // Upload to Supabase Storage
      const fileName = `signed-${quote.quote_number}.pdf`
      const storageDirPath = `${quote.organization_id}/quotes/${quote.id}`
      console.log(`[Storage] Uploading to: ${storageDirPath}/${fileName}`)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`${storageDirPath}/${fileName}`, signedPdf, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (uploadError) {
        console.error('[Storage] Upload error:', uploadError)
      } else if (uploadData?.path) {
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(uploadData.path)
        signedPdfUrl = urlData?.publicUrl || null
        console.log(`[Storage] Signed PDF uploaded successfully: ${signedPdfUrl}`)
      }
    } catch (downloadErr: any) {
      console.error('⚠️ Failed to download/store signed PDF (continuing workflow):', downloadErr?.message || downloadErr)
    }

    // Store signed PDF as document
    if (signedPdfUrl) {
      const storagePath = `${quote.organization_id}/quotes/${quote.id}/signed-${quote.quote_number}.pdf`
      const { error: docError } = await supabase.from('documents').insert({
        organization_id: quote.organization_id,
        booking_id: quote.booking_id,
        name: `Devis signé - ${quote.quote_number}`,
        file_type: 'pdf',
        file_path: storagePath,
        file_url: signedPdfUrl,
      })
      if (docError) {
        console.error(`[SignNow] Failed to store signed PDF document:`, docError)
      } else {
        console.log(`[SignNow] ✅ Stored signed PDF document for booking ${quote.booking_id}`)
      }
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

    // Log activity
    await supabase.from('activity_logs').insert({
      organization_id: quote.organization_id,
      booking_id: quote.booking_id,
      action_type: 'quote.signed',
      action_label: `Devis ${quote.quote_number} signé`,
      actor_type: 'client',
      actor_name: 'Client',
      entity_type: 'quote',
      entity_id: quote.id,
    })

    console.log(`Quote ${quote.quote_number} signed via SignNow`)

    // ── AUTO-TRIGGER: Send deposit invoice + Stripe payment link ──
    try {
      await autoSendDepositAfterSignature(quote.id)
    } catch (autoSendError) {
      console.error('⚠️ CRITICAL: Failed to auto-send deposit after signature:', autoSendError)
      // Quote is already marked as signed, so deposit can be sent manually
      console.warn(`Quote ${quote.quote_number} is signed but deposit email failed - manual send required`)
    }
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

    // Idempotency: skip if deposit was already sent or a pending deposit payment exists
    if (quote.status === 'deposit_sent' || quote.status === 'deposit_paid') {
      console.log(`[SignNow] Quote ${quote.quote_number} already has status ${quote.status} — skipping auto-deposit`)
      return
    }

    const { data: existingDeposit } = await supabase
      .from('payments')
      .select('id')
      .eq('quote_id', quoteId)
      .eq('payment_type', 'deposit')
      .in('status', ['pending', 'paid'])
      .maybeSingle()

    if (existingDeposit) {
      console.log(`[SignNow] Deposit payment already exists for quote ${quoteId} — skipping auto-deposit`)
      return
    }

    const booking = (quote as any).booking
    const restaurant = booking?.restaurant
    const contact = booking?.contact

    if (!contact?.email) {
      console.error('No contact email for auto-deposit after signature')
      return
    }

    const depositAmount = Math.round(quote.total_ttc * (quote.deposit_percentage / 100) * 100) / 100

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

    // Validate required data for Stripe
    if (!booking?.id) {
      throw new Error('Booking ID is required for Stripe payment link')
    }

    // Create Stripe Invoice (30-day expiration instead of Checkout Session's 24h max)
    console.log(`[Stripe] Creating deposit invoice for quote ${quote.quote_number}`)

    const customerId = await getOrCreateStripeCustomer(
      contact.email,
      `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || null
    )

    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 30, // 30-day expiration window
      metadata: {
        booking_id: booking.id,
        quote_id: quoteId,
        link_type: 'deposit',
      },
      description: `Acompte ${quote.deposit_percentage}% - ${quote.quote_number}`,
    })

    // Add invoice line item
    await stripe.invoiceItems.create({
      invoice: invoice.id,
      customer: customerId,
      amount: Math.round(depositAmount * 100),
      currency: 'eur',
      description: `Acompte ${quote.deposit_percentage}% pour ${restaurant?.name || 'événement'}`,
    })

    // Finalize invoice to make it payable
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id)
    const invoiceUrl = finalizedInvoice.hosted_invoice_url || ''

    console.log(`[Stripe] Invoice created: ${invoice.id}, URL: ${invoiceUrl}`)

    // Generate deposit PDF with error handling
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateQuotePdf(quoteId, 'acompte')
    } catch (pdfError) {
      console.error('Error generating deposit PDF in auto-send:', pdfError)
      throw new Error('Failed to generate deposit PDF')
    }

    // Build & send email
    const html = buildDepositEmailHtml({
      restaurant: restaurant as any,
      contact: { first_name: contact.first_name, last_name: contact.last_name, email: contact.email },
      quoteNumber: quote.quote_number,
      depositPercentage: quote.deposit_percentage,
      depositAmount,
      totalTtc: quote.total_ttc,
      stripePaymentUrl: invoiceUrl,
      eventDate: quote.date_start || booking?.event_date || null,
      commercialName,
    })

    const subject = buildDepositEmailSubject(quote.quote_number, restaurant?.name || 'Restaurant')

    // Get org-level facturation email for reply-to
    let facturationEmail: string | null = null
    if (quote.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('facturation_email')
        .eq('id', quote.organization_id)
        .single()
      facturationEmail = (org as any)?.facturation_email || null
    }

    const emailResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      facturationEmail: facturationEmail || undefined,
      attachments: [{
        filename: `facture-acompte-${quote.quote_number}.pdf`,
        content: pdfBuffer,
      }],
    })

    // Save acompte PDF to storage and documents table
    const storagePath = `${quote.organization_id}/quotes/${quoteId}/facture-acompte-${quote.quote_number}.pdf`
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
      if (uploadError) {
        console.error('[PDF Save] Auto-deposit storage upload error:', uploadError)
      } else {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(uploadData?.path || storagePath)
        await supabase.from('documents').insert({
          organization_id: quote.organization_id,
          booking_id: booking.id,
          name: `Facture acompte - ${quote.quote_number}`,
          file_type: 'pdf',
          file_size: pdfBuffer.length,
          file_path: storagePath,
          file_url: urlData?.publicUrl || '',
        })
        console.log(`[PDF Save] ✅ Saved acompte PDF for booking ${booking.id}`)
      }
    } catch (saveErr) {
      console.error('[PDF Save] Error saving auto-deposit PDF:', saveErr)
    }

    // Update quote
    await supabase
      .from('quotes')
      .update({
        status: 'deposit_sent',
        deposit_sent_at: new Date().toISOString(),
        stripe_deposit_session_id: invoice.id,
        stripe_deposit_url: invoiceUrl,
      })
      .eq('id', quoteId)

    // Save payment link
    await supabase
      .from('payment_links')
      .insert({
        booking_id: booking.id,
        quote_id: quoteId,
        link_type: 'deposit',
        amount: depositAmount,
        percentage: quote.deposit_percentage,
        url: invoiceUrl,
        stripe_link_id: invoice.id,
      })

    // Create pending payment record (will be updated to 'paid' by webhook)
    await supabase
      .from('payments')
      .insert({
        organization_id: quote.organization_id,
        booking_id: booking.id,
        quote_id: quoteId,
        amount: depositAmount,
        payment_type: 'deposit',
        payment_modality: 'acompte',
        payment_method: 'stripe',
        stripe_payment_id: invoice.id,
        status: 'pending',
        notes: `Acompte ${quote.deposit_percentage}% - ${quote.quote_number}`,
      })

    // Log email
    await supabase
      .from('email_logs')
      .insert({
        organization_id: quote.organization_id,
        quote_id: quoteId,
        booking_id: booking.id,
        email_type: 'deposit_invoice',
        recipient_email: contact.email,
        reply_to_email: commercialEmail || restaurant?.email,
        subject,
        resend_message_id: emailResult.id,
        status: 'sent',
      })

    // Log activity
    await supabase.from('activity_logs').insert({
      organization_id: quote.organization_id,
      booking_id: booking.id,
      action_type: 'payment.deposit_sent',
      action_label: `Lien acompte de ${depositAmount.toLocaleString('fr-FR')} \u20AC envoyé automatiquement après signature`,
      actor_type: 'system',
      actor_name: 'Système',
      entity_type: 'quote',
      entity_id: quoteId,
      metadata: { amount: depositAmount, auto: true },
    })

    console.log(`✅ Auto-sent deposit email for quote ${quote.quote_number} after signature`)
  } catch (error: any) {
    console.error('❌ Error auto-sending deposit after signature:', error?.message || error)
    throw error
  }
}
