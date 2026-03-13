import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'
import { generateQuotePdf, fetchQuoteFullData } from '../lib/pdf-generator.js'
import { sendEmail } from '../lib/resend.js'
import {
  buildQuoteEmailHtml, buildQuoteEmailSubject,
  buildDepositEmailHtml, buildDepositEmailSubject,
  buildBalanceEmailHtml, buildBalanceEmailSubject,
} from '../lib/email-templates.js'
import {
  uploadDocument, addSignatureField, createSigningInvite,
} from '../lib/signnow.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

export const quotesRouter = Router()

// GET /api/quotes
quotesRouter.get('/', async (req: Request, res: Response) => {
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
quotesRouter.get('/:id', async (req: Request, res: Response) => {
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
quotesRouter.post('/', async (req: Request, res: Response) => {
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
quotesRouter.patch('/:id', async (req: Request, res: Response) => {
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

// ═══════════════════════════════════════════════════════════════
// POST /api/quotes/:id/send-email — Send quote PDF by email
// ═══════════════════════════════════════════════════════════════
quotesRouter.post('/:id/send-email', async (req: Request, res: Response) => {
  const quoteId = req.params.id
  console.log(`[send-email] Starting for quote: ${quoteId}`)
  
  try {
    const quoteData = await fetchQuoteFullData(quoteId)
    console.log(`[send-email] Quote data fetched: ${quoteData.quote_number}, status: ${quoteData.status}`)
    const booking = quoteData.booking
    const restaurant = booking?.restaurant
    const contact = booking?.contact

    if (!contact?.email) {
      return res.status(400).json({ error: 'Le contact n\'a pas d\'adresse email' })
    }

    // Allow resending quote from any status (no restriction)

    // Get commercial (assigned_to) email for reply-to
    let commercialName: string | null = null
    let commercialEmail: string | null = null
    if (booking) {
      const { data: bookingFull } = await supabase
        .from('bookings')
        .select('assigned_to')
        .eq('id', booking.id)
        .single()

      if (bookingFull?.assigned_to) {
        const { data: user } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', bookingFull.assigned_to)
          .single()
        if (user) {
          commercialName = `${user.first_name} ${user.last_name}`
          commercialEmail = user.email
        }
      }
    }

    // Generate PDF with error handling
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateQuotePdf(quoteId, 'devis')
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError)
      return res.status(500).json({ error: 'Erreur lors de la génération du PDF' })
    }

    // Build email
    const html = buildQuoteEmailHtml({
      restaurant: restaurant as any,
      contact: { first_name: contact.first_name, last_name: contact.last_name, email: contact.email },
      quoteNumber: quoteData.quote_number,
      totalTtc: quoteData.total_ttc,
      eventDate: quoteData.date_start || booking?.event_date || null,
      eventTitle: quoteData.title,
      commercialName,
    })

    const subject = buildQuoteEmailSubject(quoteData.quote_number, restaurant?.name || 'Restaurant')

    // Send via Resend
    const emailResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      attachments: [{
        filename: `${quoteData.quote_number}.pdf`,
        content: pdfBuffer,
      }],
    })

    // Update quote status
    await supabase
      .from('quotes')
      .update({
        status: 'quote_sent',
        quote_sent_at: new Date().toISOString(),
      })
      .eq('id', quoteId)

    // Log email
    await supabase
      .from('email_logs')
      .insert({
        organization_id: quoteData.organization_id,
        quote_id: quoteId,
        booking_id: booking?.id,
        email_type: 'quote_sent',
        recipient_email: contact.email,
        reply_to_email: commercialEmail || restaurant?.email,
        subject,
        resend_message_id: emailResult.id,
        status: 'sent',
      })

    res.json({ success: true, emailId: emailResult.id })
  } catch (error) {
    console.error('Error sending quote email:', error)
    res.status(500).json({ error: 'Failed to send quote email' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/quotes/:id/send-signature — Upload to SignNow + send invite
// ═══════════════════════════════════════════════════════════════
quotesRouter.post('/:id/send-signature', async (req: Request, res: Response) => {
  const quoteId = req.params.id
  console.log(`[send-signature] Starting for quote: ${quoteId}`)
  
  try {
    const quoteData = await fetchQuoteFullData(quoteId)
    console.log(`[send-signature] Quote data fetched: ${quoteData.quote_number}, status: ${quoteData.status}`)
    const booking = quoteData.booking
    const contact = booking?.contact

    if (!contact?.email) {
      return res.status(400).json({ error: 'Le contact n\'a pas d\'adresse email' })
    }

    // Allow resending signature from any status (no restriction)

    // Generate PDF with error handling
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateQuotePdf(quoteId, 'devis')
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError)
      return res.status(500).json({ error: 'Erreur lors de la génération du PDF' })
    }
    const fileName = `${quoteData.quote_number}.pdf`

    // Upload to SignNow
    const { id: documentId, pageCount } = await uploadDocument(pdfBuffer, fileName)

    // Add signature field at the bottom of the LAST page
    // SignNow coordinates: y=0 is at the TOP of the page (not bottom!)
    // A4 page is ~842 points tall, so y=750 places signature near bottom
    // x=350 places it on the right side
    // pageNumber is 0-indexed, so last page = pageCount - 1
    await addSignatureField(documentId, {
      pageNumber: pageCount - 1,
      x: 350,
      y: 750,
      width: 200,
      height: 50,
    })

    // Create signing invite (SignNow sends its own email)
    const signerName = `${contact.first_name} ${contact.last_name || ''}`.trim()
    const { inviteId } = await createSigningInvite(
      documentId,
      contact.email,
      signerName,
      `Devis ${quoteData.quote_number} à signer`,
      `Bonjour ${signerName},\n\nVeuillez signer le devis n°${quoteData.quote_number} ci-joint.\n\nCordialement,\n${booking?.restaurant?.name || 'L\'équipe'}`
    )

    // Update quote
    await supabase
      .from('quotes')
      .update({
        signnow_document_id: documentId,
        signnow_invite_id: inviteId,
        signature_requested_at: new Date().toISOString(),
        signer_email: contact.email,
        signer_name: signerName,
      })
      .eq('id', quoteId)

    res.json({ success: true, documentId, inviteId })
  } catch (error) {
    console.error('Error sending signature request:', error)
    res.status(500).json({ error: 'Failed to send signature request' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/quotes/:id/send-deposit — Create Stripe link + send deposit invoice email
// ═══════════════════════════════════════════════════════════════
quotesRouter.post('/:id/send-deposit', async (req: Request, res: Response) => {
  try {
    const quoteId = req.params.id
    const quoteData = await fetchQuoteFullData(quoteId)
    const booking = quoteData.booking
    const restaurant = booking?.restaurant
    const contact = booking?.contact

    if (!contact?.email) {
      return res.status(400).json({ error: 'Le contact n\'a pas d\'adresse email' })
    }

    // Allow resending deposit from any status (no restriction)

    // Calculate deposit amount
    const depositAmount = quoteData.total_ttc * (quoteData.deposit_percentage / 100)

    // Get commercial info
    let commercialName: string | null = null
    let commercialEmail: string | null = null
    if (booking) {
      const { data: bookingFull } = await supabase
        .from('bookings')
        .select('assigned_to')
        .eq('id', booking.id)
        .single()

      if (bookingFull?.assigned_to) {
        const { data: user } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', bookingFull.assigned_to)
          .single()
        if (user) {
          commercialName = `${user.first_name} ${user.last_name}`
          commercialEmail = user.email
        }
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Acompte — ${quoteData.title || quoteData.quote_number}`,
            description: `Acompte ${quoteData.deposit_percentage}% pour ${restaurant?.name || 'événement'} le ${quoteData.date_start || booking?.event_date || ''}`,
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

    // Generate deposit invoice PDF with error handling
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateQuotePdf(quoteId, 'acompte')
    } catch (pdfError) {
      console.error('Error generating deposit PDF:', pdfError)
      return res.status(500).json({ error: 'Erreur lors de la génération du PDF d\'acompte' })
    }

    // Build email
    const html = buildDepositEmailHtml({
      restaurant: restaurant as any,
      contact: { first_name: contact.first_name, last_name: contact.last_name, email: contact.email },
      quoteNumber: quoteData.quote_number,
      depositPercentage: quoteData.deposit_percentage,
      depositAmount,
      totalTtc: quoteData.total_ttc,
      stripePaymentUrl: session.url || '',
      eventDate: quoteData.date_start || booking?.event_date || null,
      commercialName,
    })

    const subject = buildDepositEmailSubject(quoteData.quote_number, restaurant?.name || 'Restaurant')

    // Send email
    const emailResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      attachments: [{
        filename: `facture-acompte-${quoteData.quote_number}.pdf`,
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
        percentage: quoteData.deposit_percentage,
        url: session.url,
        stripe_link_id: session.id,
      })

    // Log email
    await supabase
      .from('email_logs')
      .insert({
        organization_id: quoteData.organization_id,
        quote_id: quoteId,
        booking_id: booking?.id,
        email_type: 'deposit_invoice',
        recipient_email: contact.email,
        reply_to_email: commercialEmail || restaurant?.email,
        subject,
        resend_message_id: emailResult.id,
        status: 'sent',
      })

    res.json({ success: true, sessionId: session.id, paymentUrl: session.url })
  } catch (error) {
    console.error('Error sending deposit:', error)
    res.status(500).json({ error: 'Failed to send deposit invoice' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/quotes/:id/send-balance — Create Stripe link + send balance invoice email
// ═══════════════════════════════════════════════════════════════
quotesRouter.post('/:id/send-balance', async (req: Request, res: Response) => {
  try {
    const quoteId = req.params.id
    const quoteData = await fetchQuoteFullData(quoteId)
    const booking = quoteData.booking
    const restaurant = booking?.restaurant
    const contact = booking?.contact

    if (!contact?.email) {
      return res.status(400).json({ error: 'Le contact n\'a pas d\'adresse email' })
    }

    // Allow resending balance from any status (no restriction)

    // Calculate balance: total + extras - deposit already paid
    const items = (quoteData.quote_items || []).filter((i: any) => i.item_type === 'product')
    const extras = (quoteData.quote_items || []).filter((i: any) => i.item_type === 'extra')
    const extrasHt = extras.reduce((sum: number, e: any) => sum + (e.total_ht || 0), 0)
    const extrasTtc = extras.reduce((sum: number, e: any) => sum + (e.total_ttc || 0), 0)
    const totalWithExtrasTtc = quoteData.total_ttc + extrasTtc
    const depositTtc = quoteData.total_ttc * (quoteData.deposit_percentage / 100)
    const balanceAmount = totalWithExtrasTtc - depositTtc

    // Get commercial info
    let commercialName: string | null = null
    let commercialEmail: string | null = null
    if (booking) {
      const { data: bookingFull } = await supabase
        .from('bookings')
        .select('assigned_to')
        .eq('id', booking.id)
        .single()

      if (bookingFull?.assigned_to) {
        const { data: user } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', bookingFull.assigned_to)
          .single()
        if (user) {
          commercialName = `${user.first_name} ${user.last_name}`
          commercialEmail = user.email
        }
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Solde — ${quoteData.title || quoteData.quote_number}`,
            description: `Facture de solde pour ${restaurant?.name || 'événement'}`,
          },
          unit_amount: Math.round(balanceAmount * 100),
        },
        quantity: 1,
      }],
      metadata: {
        booking_id: booking?.id || '',
        quote_id: quoteId,
        link_type: 'balance',
      },
      customer_email: contact.email,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/evenements/booking/${booking?.id}?payment=success&type=balance`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/evenements/booking/${booking?.id}?payment=cancelled`,
    })

    // Generate balance invoice PDF with error handling
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateQuotePdf(quoteId, 'solde')
    } catch (pdfError) {
      console.error('Error generating balance PDF:', pdfError)
      return res.status(500).json({ error: 'Erreur lors de la génération du PDF de solde' })
    }

    // Build email
    const html = buildBalanceEmailHtml({
      restaurant: restaurant as any,
      contact: { first_name: contact.first_name, last_name: contact.last_name, email: contact.email },
      quoteNumber: quoteData.quote_number,
      balanceAmount,
      totalTtc: totalWithExtrasTtc,
      stripePaymentUrl: session.url || '',
      eventDate: quoteData.date_start || booking?.event_date || null,
      commercialName,
    })

    const subject = buildBalanceEmailSubject(quoteData.quote_number, restaurant?.name || 'Restaurant')

    // Send email
    const emailResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      attachments: [{
        filename: `facture-solde-${quoteData.quote_number}.pdf`,
        content: pdfBuffer,
      }],
    })

    // Update quote
    await supabase
      .from('quotes')
      .update({
        status: 'balance_sent',
        balance_sent_at: new Date().toISOString(),
        stripe_balance_session_id: session.id,
        stripe_balance_url: session.url,
      })
      .eq('id', quoteId)

    // Save payment link
    await supabase
      .from('payment_links')
      .insert({
        booking_id: booking?.id,
        quote_id: quoteId,
        link_type: 'balance',
        amount: balanceAmount,
        url: session.url,
        stripe_link_id: session.id,
      })

    // Log email
    await supabase
      .from('email_logs')
      .insert({
        organization_id: quoteData.organization_id,
        quote_id: quoteId,
        booking_id: booking?.id,
        email_type: 'balance_invoice',
        recipient_email: contact.email,
        reply_to_email: commercialEmail || restaurant?.email,
        subject,
        resend_message_id: emailResult.id,
        status: 'sent',
      })

    res.json({ success: true, sessionId: session.id, paymentUrl: session.url })
  } catch (error) {
    console.error('Error sending balance:', error)
    res.status(500).json({ error: 'Failed to send balance invoice' })
  }
})

// POST /api/quotes/:id/items - Add item to quote
quotesRouter.post('/:id/items', async (req: Request, res: Response) => {
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
