import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { notifyCommercialSignature } from '../lib/commercial-notifications.js'
import {
  buildQuoteEmailHtml,
  buildQuoteEmailSubject,
  buildDepositEmailHtml,
  buildDepositEmailSubject,
  buildBalanceEmailHtml,
  buildBalanceEmailSubject,
} from '../lib/email-templates.js'
import {
  generateQuotePdf,
  fetchQuoteFullData,
  generateCreditNotePdf,
} from '../lib/pdf-generator.js'
import {
  formatEuroWhole,
  computeQuoteAmounts,
  computeDepositAmounts,
  computeCreditNote,
  computeLineAmounts,
  round2,
} from '../lib/quote-rounding.js'

// Montant d'acompte TTC : montant fixe saisi (override) sinon pourcentage, au centime.
// Acompte et solde DOIVENT passer par cet helper pour que acompte + solde = total exactement.
function quoteDepositTtc(q: {
  total_ttc: number
  total_ht?: number | null
  deposit_amount_override?: number | null
  deposit_percentage?: number | null
}): number {
  return computeDepositAmounts(q.total_ttc, q.total_ht ?? 0, {
    overrideTtc: q.deposit_amount_override ?? null,
    percentage: q.deposit_percentage ?? null,
  }).ttc
}
import { sendEmail } from '../lib/resend.js'
import {
  uploadDocument,
  addSignatureField,
  createSigningInvite,
} from '../lib/signnow.js'
import {
  getRestaurantStripeContext,
  resolveStripeMode,
  stripeRequestOptions,
  getOrCreateStripeCustomerOnAccount,
} from '../lib/stripe-connect.js'
import { supabase } from '../lib/supabase.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

export const quotesRouter = Router()

// Helper: save a generated PDF to Supabase Storage and create a document record
async function savePdfAsDocument(
  pdfBuffer: Buffer,
  fileName: string,
  storagePath: string,
  docName: string,
  organizationId: string | null,
  bookingId: string | null,
  opts?: { doc_kind?: string; credit_note_id?: string }
) {
  try {
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error(
        `[PDF Save] Storage upload error for ${fileName}:`,
        uploadError
      )
      return
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(uploadData?.path || storagePath)

    const fileUrl = urlData?.publicUrl || ''

    // Create document record
    const { error: docError } = await supabase.from('documents').insert({
      organization_id: organizationId,
      booking_id: bookingId,
      name: docName,
      file_type: 'pdf',
      file_size: pdfBuffer.length,
      file_path: storagePath,
      file_url: fileUrl,
      ...(opts?.doc_kind ? { doc_kind: opts.doc_kind } : {}),
      ...(opts?.credit_note_id ? { credit_note_id: opts.credit_note_id } : {}),
    } as any)

    if (docError) {
      console.error(
        `[PDF Save] Document record error for ${fileName}:`,
        docError
      )
    } else {
      console.log(`[PDF Save] ✅ Saved ${docName} for booking ${bookingId}`)
    }
  } catch (err) {
    console.error(`[PDF Save] Error saving ${fileName}:`, err)
  }
}

// Helper: update booking status by slug
async function updateBookingStatusBySlug(
  bookingId: string | undefined | null,
  organizationId: string | undefined | null,
  slug: string
) {
  if (!bookingId || !organizationId) return
  const { data: statusData } = await supabase
    .from('statuses')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('slug', slug)
    .eq('type', 'booking')
    .single()

  if (statusData) {
    await supabase
      .from('bookings')
      .update({ status_id: statusData.id })
      .eq('id', bookingId)
    console.log(`[Status] ✅ Booking ${bookingId} → ${slug}`)
  } else {
    console.warn(`[Status] Slug '${slug}' not found for org ${organizationId}`)
  }
}

// Shared helper to get organization facturation email (used as reply-to)
async function getOrgFacturationEmail(
  organizationId: string | null
): Promise<string | null> {
  if (!organizationId) return null
  const { data } = await supabase
    .from('organizations')
    .select('facturation_email')
    .eq('id', organizationId)
    .single()
  return (data as any)?.facturation_email || null
}

// Shared helper to get commercial info from a booking
async function getCommercialInfo(
  bookingId: string
): Promise<{ name: string | null; email: string | null }> {
  const { data: bookingFull } = await supabase
    .from('bookings')
    .select('assigned_user_ids')
    .eq('id', bookingId)
    .single()

  const commercialId = (bookingFull as any)?.assigned_user_ids?.[0]
  if (commercialId) {
    const { data: user } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', commercialId)
      .single()
    if (user) {
      return { name: `${user.first_name} ${user.last_name}`, email: user.email }
    }
  }
  return { name: null, email: null }
}

// GET /api/quotes
quotesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organization_id as string
    const bookingId = req.query.booking_id as string
    const status = req.query.status as string

    let query = supabase
      .from('quotes')
      .select(
        `
        *,
        booking:bookings (
          id, event_type, event_date,
          contact:contacts (id, first_name, last_name, email),
          restaurant:restaurants (id, name)
        )
      `
      )
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
      .select(
        `
        *,
        booking:bookings (
          *,
          contact:contacts (*),
          restaurant:restaurants (*)
        ),
        quote_items (*),
        payments (*)
      `
      )
      .eq('id', req.params.id)
      .order('position', { referencedTable: 'quote_items', ascending: true })
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
// POST /api/quotes/:id/notify-signed — Notify commercial of manual signature
// ═══════════════════════════════════════════════════════════════
quotesRouter.post('/:id/notify-signed', async (req: Request, res: Response) => {
  try {
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('id, booking_id, quote_number, total_ttc, title, date_start')
      .eq('id', req.params.id)
      .single()

    if (error || !quote) {
      return res.status(404).json({ error: 'Quote not found' })
    }

    await notifyCommercialSignature({
      bookingId: quote.booking_id,
      quoteNumber: quote.quote_number,
      totalTtc: quote.total_ttc,
      eventTitle: quote.title,
      eventDate: quote.date_start,
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error sending signature notification:', error)
    res.status(500).json({ error: 'Failed to send notification' })
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
    console.log(
      `[send-email] Quote data fetched: ${quoteData.quote_number}, status: ${quoteData.status}`
    )
    const booking = quoteData.booking
    const restaurant = booking?.restaurant
    const contact = booking?.contact

    if (!contact?.email) {
      return res
        .status(400)
        .json({ error: "Le contact n'a pas d'adresse email" })
    }

    // B2B Validation: Check if contact has a company and if required fields are filled
    const company = (contact as any).company
    if (company) {
      const missingFields: string[] = []
      if (!company.name) missingFields.push('Raison sociale')
      if (!company.billing_address) missingFields.push('Adresse')
      if (!company.billing_postal_code) missingFields.push('Code postal')
      if (!company.billing_city) missingFields.push('Ville')
      if (!company.siret) missingFields.push('SIRET')

      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Informations société manquantes pour un devis B2B : ${missingFields.join(', ')}. Veuillez compléter les informations de la société avant d'envoyer le devis.`,
          missingFields,
        })
      }
    }

    // Allow resending quote from any status (no restriction)

    // Get commercial email for reply-to (premier de assigned_user_ids)
    const commercial = booking
      ? await getCommercialInfo(booking.id)
      : { name: null, email: null }
    const commercialName = commercial.name
    const commercialEmail = commercial.email

    // Generate PDF with pre-fetched data (avoids double fetch)
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateQuotePdf(quoteId, 'devis', quoteData)
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError)
      return res
        .status(500)
        .json({ error: 'Erreur lors de la génération du PDF' })
    }

    // Build email
    const html = buildQuoteEmailHtml({
      restaurant: restaurant as any,
      contact: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
      },
      quoteNumber: quoteData.quote_number,
      totalTtc: quoteData.total_ttc,
      eventDate: quoteData.date_start || booking?.event_date || null,
      eventTitle: quoteData.title,
      commercialName,
      orderNumber: quoteData.order_number,
    })

    const subject = buildQuoteEmailSubject(
      quoteData.quote_number,
      restaurant?.name || 'Restaurant'
    )

    // Get org-level facturation email for reply-to
    const facturationEmail = await getOrgFacturationEmail(
      quoteData.organization_id
    )

    // Send via Resend
    const emailResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      facturationEmail: facturationEmail || undefined,
      attachments: [
        {
          filename: `${quoteData.quote_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    // Save devis PDF to storage and documents table
    await savePdfAsDocument(
      pdfBuffer,
      `${quoteData.quote_number}.pdf`,
      `${quoteData.organization_id}/quotes/${quoteId}/devis-${quoteData.quote_number}.pdf`,
      `Devis - ${quoteData.quote_number}`,
      quoteData.organization_id,
      booking?.id || null
    )

    // Update quote status
    await supabase
      .from('quotes')
      .update({
        status: 'quote_sent',
        quote_sent_at: new Date().toISOString(),
      })
      .eq('id', quoteId)

    // Auto-update booking status → Proposition
    await updateBookingStatusBySlug(
      booking?.id,
      quoteData.organization_id,
      'proposition'
    )

    // Log email
    await supabase.from('email_logs').insert({
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

    console.log(
      `[send-email] ✅ Quote ${quoteData.quote_number} sent to ${contact.email}`
    )
    res.json({ success: true, emailId: emailResult.id })
  } catch (error) {
    console.error('Error sending quote email:', error)
    res.status(500).json({ error: 'Failed to send quote email' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/quotes/:id/send-signature — Upload to SignNow + send invite
// ═══════════════════════════════════════════════════════════════
quotesRouter.post(
  '/:id/send-signature',
  async (req: Request, res: Response) => {
    const quoteId = req.params.id
    console.log(`[send-signature] Starting for quote: ${quoteId}`)

    try {
      const quoteData = await fetchQuoteFullData(quoteId)
      console.log(
        `[send-signature] Quote data fetched: ${quoteData.quote_number}, status: ${quoteData.status}`
      )
      const booking = quoteData.booking
      const contact = booking?.contact

      if (!contact?.email) {
        return res
          .status(400)
          .json({ error: "Le contact n'a pas d'adresse email" })
      }

      // Allow resending signature from any status (no restriction)

      // Generate PDF with error handling
      let pdfBuffer: Buffer
      try {
        pdfBuffer = await generateQuotePdf(quoteId, 'devis')
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError)
        return res
          .status(500)
          .json({ error: 'Erreur lors de la génération du PDF' })
      }
      const fileName = `${quoteData.quote_number}.pdf`

      // Upload to SignNow
      const { id: documentId, pageCount } = await uploadDocument(
        pdfBuffer,
        fileName
      )

      // Add signature field above the footer on the LAST page
      // SignNow coordinates: y=0 is at the TOP of the page
      // A4 page is ~842 points tall
      // Footer takes ~80 points at bottom, so place signature above it
      // y = 842 - 80 (footer) - 50 (signature height) - 20 (margin) = 692
      // x=350 places it on the right side
      // pageNumber is 0-indexed, so last page = pageCount - 1
      await addSignatureField(documentId, {
        pageNumber: pageCount - 1,
        x: 350,
        y: 692,
        width: 200,
        height: 50,
      })

      // Create signing invite (SignNow sends its own email)
      const signerName =
        `${contact.first_name} ${contact.last_name || ''}`.trim()
      const { inviteId } = await createSigningInvite(
        documentId,
        contact.email,
        signerName,
        `Devis ${quoteData.quote_number} à signer`,
        `Bonjour ${signerName},\n\nVeuillez signer le devis n°${quoteData.quote_number} ci-joint.\n\nCordialement,\n${booking?.restaurant?.name || "L'équipe"}`
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
  }
)

// ═══════════════════════════════════════════════════════════════
// POST /api/quotes/:id/send-deposit — Create Stripe link + send deposit invoice email
// ═══════════════════════════════════════════════════════════════
quotesRouter.post('/:id/send-deposit', async (req: Request, res: Response) => {
  try {
    const quoteId = req.params.id
    console.log(`[send-deposit] Starting for quote: ${quoteId}`)
    const quoteData = await fetchQuoteFullData(quoteId)
    console.log(
      `[send-deposit] Quote data fetched: ${quoteData.quote_number}, status: ${quoteData.status}, total_ttc: ${quoteData.total_ttc}`
    )
    const booking = quoteData.booking
    const restaurant = booking?.restaurant
    const contact = booking?.contact

    if (!contact?.email) {
      console.warn(`[send-deposit] No contact email for quote ${quoteId}`)
      return res
        .status(400)
        .json({ error: "Le contact n'a pas d'adresse email" })
    }

    // Check if a pending deposit payment already exists with a valid Stripe invoice
    const { data: existingDeposit } = await supabase
      .from('payments')
      .select('id, created_at, stripe_payment_id')
      .eq('quote_id', quoteId)
      .eq('payment_type', 'deposit')
      .eq('status', 'pending')
      .maybeSingle()

    if (existingDeposit) {
      // Check if the invoice has expired (30 days)
      const createdAt = new Date(existingDeposit.created_at || 0)
      const daysOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)

      if (daysOld >= 30) {
        // Expire the old payment — a new Stripe invoice will be created below
        await supabase
          .from('payments')
          .update({ status: 'expired' })
          .eq('id', existingDeposit.id)
      } else {
        // Reuse the existing Stripe invoice URL — resend the email with the same link
        const { data: existingQuote } = await supabase
          .from('quotes')
          .select('stripe_deposit_url')
          .eq('id', quoteId)
          .single()

        if (existingQuote?.stripe_deposit_url) {
          console.log(
            `[send-deposit] Reusing existing Stripe deposit invoice for quote ${quoteId}`
          )
          // Just resend the email with existing invoice link — no new Stripe invoice
          // Acompte toujours arrondi au supérieur à l'euro entier
          const depositAmount = quoteDepositTtc(quoteData as any)
          const effectiveDepositPctResend =
            (quoteData as any).deposit_amount_override != null
              ? Math.round((depositAmount / quoteData.total_ttc) * 100)
              : quoteData.deposit_percentage
          const commercial = booking
            ? await getCommercialInfo(booking.id)
            : { name: null, email: null }

          const html = buildDepositEmailHtml({
            restaurant: restaurant as any,
            contact: {
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: contact.email,
            },
            quoteNumber: quoteData.quote_number,
            depositPercentage: effectiveDepositPctResend,
            depositAmount,
            totalTtc: quoteData.total_ttc,
            stripePaymentUrl: existingQuote.stripe_deposit_url,
            eventDate: quoteData.date_start || booking?.event_date || null,
            commercialName: commercial.name,
            stripeEnabled: (restaurant as any)?.stripe_enabled !== false,
            orderNumber: quoteData.order_number,
          })

          const subject = buildDepositEmailSubject(
            quoteData.quote_number,
            restaurant?.name || 'Restaurant'
          )
          const facturationEmail = await getOrgFacturationEmail(
            quoteData.organization_id
          )

          await sendEmail({
            to: contact.email,
            subject,
            html,
            replyTo: commercial.email || restaurant?.email || undefined,
            facturationEmail: facturationEmail || undefined,
          })

          console.log(
            `[send-deposit] ✅ Resent deposit invoice to ${contact.email}`
          )
          return res.json({
            success: true,
            sessionId: existingDeposit.stripe_payment_id,
            paymentUrl: existingQuote.stripe_deposit_url,
            resent: true,
          })
        }
      }
    }

    // Calculate deposit amount — montant fixe en priorité, sinon % du TTC.
    // Toujours arrondi au supérieur à l'euro entier.
    const depositAmount = quoteDepositTtc(quoteData as any)
    const effectiveDepositPct =
      (quoteData as any).deposit_amount_override != null
        ? Math.round((depositAmount / quoteData.total_ttc) * 100)
        : quoteData.deposit_percentage

    // Get commercial info
    const commercial = booking
      ? await getCommercialInfo(booking.id)
      : { name: null, email: null }
    const commercialName = commercial.name
    const commercialEmail = commercial.email

    // Connect-only architecture : on encaisse Stripe UNIQUEMENT sur le compte
    // Connect du restaurant. Si pas encore connecté → fallback virement bancaire
    // (soft fallback, aucune facture créée sur la plateforme).
    const restaurantId = (restaurant as any)?.id as string | undefined
    const stripeCtx = restaurantId
      ? await getRestaurantStripeContext(restaurantId)
      : null
    const stripeMode = stripeCtx
      ? resolveStripeMode(stripeCtx)
      : ({ mode: 'bank_transfer', reason: 'disabled' } as const)

    const isStripeEnabled = stripeMode.mode === 'connect'
    const connectAcctId =
      stripeMode.mode === 'connect' ? stripeMode.acctId : null
    const stripeOpts = stripeRequestOptions(connectAcctId)

    let invoiceUrl = ''
    let invoiceId = ''

    if (isStripeEnabled && connectAcctId) {
      console.log(
        `[send-deposit] Creating Stripe invoice on Connect account ${connectAcctId} for deposit: ${formatEuroWhole(depositAmount)}`
      )

      const customerId = await getOrCreateStripeCustomerOnAccount(
        contact.email,
        `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || null,
        connectAcctId
      )

      const invoice = await stripe.invoices.create(
        {
          customer: customerId,
          collection_method: 'send_invoice',
          days_until_due: 30,
          metadata: {
            booking_id: booking?.id || '',
            quote_id: quoteId,
            link_type: 'deposit',
            restaurant_id: restaurantId || '',
          },
          description:
            (quoteData as any).deposit_amount_override != null
              ? `Acompte ${formatEuroWhole(depositAmount)} - ${quoteData.quote_number}`
              : `Acompte ${effectiveDepositPct}% - ${quoteData.quote_number}`,
        },
        stripeOpts
      )

      // Stripe est appelé en cents : depositAmount est entier, donc × 100 = entier exact.
      await stripe.invoiceItems.create(
        {
          invoice: invoice.id,
          customer: customerId,
          amount: Math.round(depositAmount * 100),
          currency: 'eur',
          description:
            (quoteData as any).deposit_amount_override != null
              ? `Acompte ${formatEuroWhole(depositAmount)} pour ${restaurant?.name || 'événement'} le ${quoteData.date_start || booking?.event_date || ''}`
              : `Acompte ${effectiveDepositPct}% pour ${restaurant?.name || 'événement'} le ${quoteData.date_start || booking?.event_date || ''}`,
        },
        stripeOpts
      )

      const finalizedInvoice = await stripe.invoices.finalizeInvoice(
        invoice.id,
        undefined,
        stripeOpts
      )
      invoiceUrl = finalizedInvoice.hosted_invoice_url || ''
      invoiceId = invoice.id
    } else {
      const reason =
        stripeMode.mode === 'bank_transfer' ? stripeMode.reason : 'unknown'
      console.log(
        `[send-deposit] No Stripe Connect (reason=${reason}) — bank transfer fallback for ${formatEuroWhole(depositAmount)}`
      )
    }

    // Generate deposit invoice PDF with error handling
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateQuotePdf(quoteId, 'acompte', quoteData)
    } catch (pdfError) {
      console.error('Error generating deposit PDF:', pdfError)
      return res
        .status(500)
        .json({ error: "Erreur lors de la génération du PDF d'acompte" })
    }

    // Build email
    const html = buildDepositEmailHtml({
      restaurant: restaurant as any,
      contact: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
      },
      quoteNumber: quoteData.quote_number,
      depositPercentage: effectiveDepositPct,
      depositAmount,
      totalTtc: quoteData.total_ttc,
      stripePaymentUrl: invoiceUrl,
      eventDate: quoteData.date_start || booking?.event_date || null,
      commercialName,
      stripeEnabled: isStripeEnabled,
      orderNumber: quoteData.order_number,
    })

    const subject = buildDepositEmailSubject(
      quoteData.quote_number,
      restaurant?.name || 'Restaurant'
    )

    // Get org-level facturation email for reply-to
    const facturationEmail = await getOrgFacturationEmail(
      quoteData.organization_id
    )

    // Send email
    const emailResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      facturationEmail: facturationEmail || undefined,
      attachments: [
        {
          filename: `facture-acompte-${quoteData.quote_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    // Save acompte PDF to storage and documents table
    await savePdfAsDocument(
      pdfBuffer,
      `facture-acompte-${quoteData.quote_number}.pdf`,
      `${quoteData.organization_id}/quotes/${quoteId}/facture-acompte-${quoteData.quote_number}.pdf`,
      `Facture acompte - ${quoteData.quote_number}`,
      quoteData.organization_id,
      booking?.id || null
    )

    // Update quote
    await supabase
      .from('quotes')
      .update({
        status: 'deposit_sent',
        deposit_sent_at: new Date().toISOString(),
        ...(isStripeEnabled
          ? {
              stripe_deposit_session_id: invoiceId,
              stripe_deposit_url: invoiceUrl,
            }
          : {}),
      })
      .eq('id', quoteId)

    if (isStripeEnabled) {
      // Save payment link (Stripe)
      await supabase.from('payment_links').insert({
        booking_id: booking?.id,
        quote_id: quoteId,
        link_type: 'deposit',
        amount: depositAmount,
        percentage: quoteData.deposit_percentage,
        url: invoiceUrl,
        stripe_link_id: invoiceId,
        stripe_account_id: connectAcctId,
      })

      // Create pending payment record (will be updated to 'paid' by webhook)
      await supabase.from('payments').insert({
        organization_id: quoteData.organization_id,
        booking_id: booking?.id,
        quote_id: quoteId,
        amount: depositAmount,
        payment_type: 'deposit',
        payment_modality: 'acompte',
        payment_method: 'stripe',
        stripe_payment_id: invoiceId,
        stripe_account_id: connectAcctId,
        status: 'pending',
        notes: `Acompte ${quoteData.deposit_percentage}% - ${quoteData.quote_number}`,
      })
    } else {
      // Create pending bank transfer payment record (will be manually marked as paid)
      await supabase.from('payments').insert({
        organization_id: quoteData.organization_id,
        booking_id: booking?.id,
        quote_id: quoteId,
        amount: depositAmount,
        payment_type: 'deposit',
        payment_modality: 'acompte',
        payment_method: 'virement',
        status: 'pending',
        notes: `Acompte ${quoteData.deposit_percentage}% - ${quoteData.quote_number} (virement bancaire)`,
      })
    }

    // Log email
    await supabase.from('email_logs').insert({
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

    // Log activity
    await supabase.from('activity_logs').insert({
      organization_id: quoteData.organization_id,
      booking_id: booking?.id,
      action_type: 'payment.deposit_sent',
      action_label: `Facture acompte de ${depositAmount.toLocaleString('fr-FR')} \u20AC envoyée${isStripeEnabled ? ' avec lien de paiement' : ' (virement bancaire)'}`,
      actor_type: 'user',
      actor_id: req.body.userId || null,
      entity_type: 'quote',
      entity_id: quoteId,
      metadata: {
        amount: depositAmount,
        method: isStripeEnabled ? 'stripe' : 'virement',
      },
    })

    console.log(
      `[send-deposit] ✅ Deposit for quote ${quoteData.quote_number} sent to ${contact.email}, amount: ${depositAmount}€${isStripeEnabled ? `, Stripe invoice: ${invoiceId}` : ', bank transfer only'}`
    )
    res.json({
      success: true,
      sessionId: invoiceId || null,
      paymentUrl: invoiceUrl || null,
    })
  } catch (error) {
    console.error('[send-deposit] ❌ Error:', error)
    res.status(500).json({ error: 'Failed to send deposit invoice' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/quotes/:id/send-balance — Create Stripe link + send balance invoice email
// ═══════════════════════════════════════════════════════════════
quotesRouter.post('/:id/send-balance', async (req: Request, res: Response) => {
  try {
    const quoteId = req.params.id
    console.log(`[send-balance] Starting for quote: ${quoteId}`)
    const quoteData = await fetchQuoteFullData(quoteId)
    console.log(
      `[send-balance] Quote data fetched: ${quoteData.quote_number}, status: ${quoteData.status}, total_ttc: ${quoteData.total_ttc}`
    )
    const booking = quoteData.booking
    const restaurant = booking?.restaurant
    const contact = booking?.contact

    if (!contact?.email) {
      console.warn(`[send-balance] No contact email for quote ${quoteId}`)
      return res
        .status(400)
        .json({ error: "Le contact n'a pas d'adresse email" })
    }

    // Verify deposit has been paid before sending balance
    const { data: depositPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('quote_id', quoteId)
      .eq('payment_type', 'deposit')
      .eq('status', 'paid')
      .maybeSingle()

    if (!depositPayment) {
      return res.status(400).json({
        error:
          "L'acompte n'a pas encore été payé. Veuillez attendre le paiement de l'acompte avant d'envoyer le solde.",
      })
    }

    // Check if a pending balance payment already exists with a valid Stripe invoice
    const { data: existingBalance } = await supabase
      .from('payments')
      .select('id, created_at, stripe_payment_id')
      .eq('quote_id', quoteId)
      .eq('payment_type', 'balance')
      .eq('status', 'pending')
      .maybeSingle()

    if (existingBalance) {
      const createdAt = new Date(existingBalance.created_at || 0)
      const daysOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)

      if (daysOld >= 30) {
        // Expire the old payment — a new Stripe invoice will be created below
        await supabase
          .from('payments')
          .update({ status: 'expired' })
          .eq('id', existingBalance.id)
      } else {
        const { data: existingQuote } = await supabase
          .from('quotes')
          .select('stripe_balance_url')
          .eq('id', quoteId)
          .single()

        if (existingQuote?.stripe_balance_url) {
          console.log(
            `[send-balance] Reusing existing Stripe balance invoice for quote ${quoteId}`
          )
          const extras = (quoteData.quote_items || []).filter(
            (i: any) => i.item_type === 'extra'
          )
          const extrasTtc = extras.reduce(
            (sum: number, e: any) => sum + (e.total_ttc || 0),
            0
          )
          // total_ttc et extras.total_ttc sont des entiers, leur somme est entière
          const totalWithExtrasTtc = quoteData.total_ttc + extrasTtc
          const depositTtc = quoteDepositTtc(quoteData as any)
          const balanceAmount = totalWithExtrasTtc - depositTtc

          const commercial = booking
            ? await getCommercialInfo(booking.id)
            : { name: null, email: null }

          const html = buildBalanceEmailHtml({
            restaurant: restaurant as any,
            contact: {
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: contact.email,
            },
            quoteNumber: quoteData.quote_number,
            balanceAmount,
            totalTtc: totalWithExtrasTtc,
            stripePaymentUrl: existingQuote.stripe_balance_url,
            eventDate: quoteData.date_start || booking?.event_date || null,
            commercialName: commercial.name,
            stripeEnabled: (restaurant as any)?.stripe_enabled !== false,
            orderNumber: quoteData.order_number,
          })

          const subject = buildBalanceEmailSubject(
            quoteData.quote_number,
            restaurant?.name || 'Restaurant'
          )
          const facturationEmail = await getOrgFacturationEmail(
            quoteData.organization_id
          )

          await sendEmail({
            to: contact.email,
            subject,
            html,
            replyTo: commercial.email || restaurant?.email || undefined,
            facturationEmail: facturationEmail || undefined,
          })

          console.log(
            `[send-balance] ✅ Resent balance invoice to ${contact.email}`
          )
          return res.json({
            success: true,
            sessionId: existingBalance.stripe_payment_id,
            paymentUrl: existingQuote.stripe_balance_url,
            resent: true,
          })
        }
      }
    }

    // Calculate balance: total_ttc (products only, discount already applied) + extras - deposit
    // Tous les montants sont des entiers (post-helper), donc pas besoin de Math.round.
    const extras = (quoteData.quote_items || []).filter(
      (i: any) => i.item_type === 'extra'
    )
    const extrasTtc = extras.reduce(
      (sum: number, e: any) => sum + (e.total_ttc || 0),
      0
    )
    const totalWithExtrasTtc = quoteData.total_ttc + extrasTtc
    // MUST mirror send-deposit exactly so the balance subtracts the *actual*
    // amount that was invoiced as deposit (otherwise the customer over/under-pays).
    const depositTtc = quoteDepositTtc(quoteData as any)
    const balanceAmount = totalWithExtrasTtc - depositTtc

    // Get commercial info
    const commercial = booking
      ? await getCommercialInfo(booking.id)
      : { name: null, email: null }
    const commercialName = commercial.name
    const commercialEmail = commercial.email

    // Connect-only architecture (cf. send-deposit)
    const restaurantId = (restaurant as any)?.id as string | undefined
    const stripeCtx = restaurantId
      ? await getRestaurantStripeContext(restaurantId)
      : null
    const stripeMode = stripeCtx
      ? resolveStripeMode(stripeCtx)
      : ({ mode: 'bank_transfer', reason: 'disabled' } as const)

    const isStripeEnabled = stripeMode.mode === 'connect'
    const connectAcctId =
      stripeMode.mode === 'connect' ? stripeMode.acctId : null
    const stripeOpts = stripeRequestOptions(connectAcctId)

    let invoiceUrl = ''
    let invoiceId = ''

    if (isStripeEnabled && connectAcctId) {
      console.log(
        `[send-balance] Creating Stripe invoice on Connect account ${connectAcctId} for balance: ${formatEuroWhole(balanceAmount)}`
      )

      const customerId = await getOrCreateStripeCustomerOnAccount(
        contact.email,
        `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || null,
        connectAcctId
      )

      const invoice = await stripe.invoices.create(
        {
          customer: customerId,
          collection_method: 'send_invoice',
          days_until_due: 30,
          metadata: {
            booking_id: booking?.id || '',
            quote_id: quoteId,
            link_type: 'balance',
            restaurant_id: restaurantId || '',
          },
          description: `Solde - ${quoteData.quote_number}`,
        },
        stripeOpts
      )

      await stripe.invoiceItems.create(
        {
          invoice: invoice.id,
          customer: customerId,
          amount: Math.round(balanceAmount * 100),
          currency: 'eur',
          description: `Facture de solde pour ${restaurant?.name || 'événement'}`,
        },
        stripeOpts
      )

      const finalizedInvoice = await stripe.invoices.finalizeInvoice(
        invoice.id,
        undefined,
        stripeOpts
      )
      invoiceUrl = finalizedInvoice.hosted_invoice_url || ''
      invoiceId = invoice.id
    } else {
      const reason =
        stripeMode.mode === 'bank_transfer' ? stripeMode.reason : 'unknown'
      console.log(
        `[send-balance] No Stripe Connect (reason=${reason}) — bank transfer fallback for ${formatEuroWhole(balanceAmount)}`
      )
    }

    // Generate balance invoice PDF with error handling
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateQuotePdf(quoteId, 'solde', quoteData)
    } catch (pdfError) {
      console.error('Error generating balance PDF:', pdfError)
      return res
        .status(500)
        .json({ error: 'Erreur lors de la génération du PDF de solde' })
    }

    // Build email
    const html = buildBalanceEmailHtml({
      restaurant: restaurant as any,
      contact: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
      },
      quoteNumber: quoteData.quote_number,
      balanceAmount,
      totalTtc: totalWithExtrasTtc,
      stripePaymentUrl: invoiceUrl,
      eventDate: quoteData.date_start || booking?.event_date || null,
      commercialName,
      stripeEnabled: isStripeEnabled,
      orderNumber: quoteData.order_number,
    })

    const subject = buildBalanceEmailSubject(
      quoteData.quote_number,
      restaurant?.name || 'Restaurant'
    )

    // Get org-level facturation email for reply-to
    const facturationEmail = await getOrgFacturationEmail(
      quoteData.organization_id
    )

    // Send email
    const emailResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      facturationEmail: facturationEmail || undefined,
      attachments: [
        {
          filename: `facture-solde-${quoteData.quote_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    // Save solde PDF to storage and documents table
    await savePdfAsDocument(
      pdfBuffer,
      `facture-solde-${quoteData.quote_number}.pdf`,
      `${quoteData.organization_id}/quotes/${quoteId}/facture-solde-${quoteData.quote_number}.pdf`,
      `Facture solde - ${quoteData.quote_number}`,
      quoteData.organization_id,
      booking?.id || null
    )

    // Update quote
    await supabase
      .from('quotes')
      .update({
        status: 'balance_sent',
        balance_sent_at: new Date().toISOString(),
        ...(isStripeEnabled
          ? {
              stripe_balance_session_id: invoiceId,
              stripe_balance_url: invoiceUrl,
            }
          : {}),
      })
      .eq('id', quoteId)

    // Auto-update booking status → Attente paiement
    await updateBookingStatusBySlug(
      booking?.id,
      quoteData.organization_id,
      'attente_paiement'
    )

    if (isStripeEnabled) {
      // Save payment link (Stripe)
      await supabase.from('payment_links').insert({
        booking_id: booking?.id,
        quote_id: quoteId,
        link_type: 'balance',
        amount: balanceAmount,
        url: invoiceUrl,
        stripe_link_id: invoiceId,
        stripe_account_id: connectAcctId,
      })

      // Create pending payment record (will be updated to 'paid' by webhook)
      await supabase.from('payments').insert({
        organization_id: quoteData.organization_id,
        booking_id: booking?.id,
        quote_id: quoteId,
        amount: balanceAmount,
        payment_type: 'balance',
        payment_modality: 'solde',
        payment_method: 'stripe',
        stripe_payment_id: invoiceId,
        stripe_account_id: connectAcctId,
        status: 'pending',
        notes: `Solde - ${quoteData.quote_number}`,
      })
    } else {
      // Create pending bank transfer payment record (will be manually marked as paid)
      await supabase.from('payments').insert({
        organization_id: quoteData.organization_id,
        booking_id: booking?.id,
        quote_id: quoteId,
        amount: balanceAmount,
        payment_type: 'balance',
        payment_modality: 'solde',
        payment_method: 'virement',
        status: 'pending',
        notes: `Solde - ${quoteData.quote_number} (virement bancaire)`,
      })
    }

    // Log email
    await supabase.from('email_logs').insert({
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

    // Log activity
    await supabase.from('activity_logs').insert({
      organization_id: quoteData.organization_id,
      booking_id: booking?.id,
      action_type: 'payment.balance_sent',
      action_label: `Facture solde de ${balanceAmount.toLocaleString('fr-FR')} \u20AC envoyée${isStripeEnabled ? ' avec lien de paiement' : ' (virement bancaire)'}`,
      actor_type: 'user',
      actor_id: req.body.userId || null,
      entity_type: 'quote',
      entity_id: quoteId,
      metadata: {
        amount: balanceAmount,
        method: isStripeEnabled ? 'stripe' : 'virement',
      },
    })

    console.log(
      `[send-balance] ✅ Balance for quote ${quoteData.quote_number} sent to ${contact.email}, amount: ${balanceAmount}€${isStripeEnabled ? `, Stripe invoice: ${invoiceId}` : ', bank transfer only'}`
    )
    res.json({
      success: true,
      sessionId: invoiceId || null,
      paymentUrl: invoiceUrl || null,
    })
  } catch (error) {
    console.error('[send-balance] ❌ Error:', error)
    res.status(500).json({ error: 'Failed to send balance invoice' })
  }
})

// POST /api/quotes/:id/credit-note - Génère un avoir : crédite des prestations,
// réduit le devis (et son solde), fige l'acompte, émet un document immuable numéroté.
// Corps : { credits: [{ quote_item_id, credited_ttc }], reason? }
quotesRouter.post('/:id/credit-note', async (req: Request, res: Response) => {
  const quoteId = req.params.id
  const { credits, reason } = req.body as {
    credits: { quote_item_id: string; credited_ttc: number }[]
    reason?: string
  }
  if (!Array.isArray(credits) || credits.length === 0) {
    return res.status(400).json({ error: 'NO_CREDITS' })
  }

  // 1. Charge devis + lignes + booking (restaurant) + paiements encaissés
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('*, quote_items(*), booking:bookings(id, restaurant_id)')
    .eq('id', quoteId)
    .single()
  if (qErr || !quote)
    return res.status(404).json({ error: 'QUOTE_NOT_FOUND' })

  const q = quote as any
  const booking = q.booking

  const { data: payments } = await supabase
    .from('payments')
    .select('amount, payment_modality, payment_type, status')
    .eq('booking_id', booking?.id ?? null)
    .in('status', ['paid', 'completed'])

  const collectedAcompte = (payments ?? [])
    .filter(
      (p: any) =>
        p.payment_modality === 'acompte' || p.payment_type === 'deposit'
    )
    .reduce((s: number, p: any) => s + (p.amount || 0), 0)

  const items = (q.quote_items ?? []).map((i: any) => ({
    id: i.id,
    quantity: i.quantity,
    unit_price: i.unit_price,
    unit_price_ttc: i.unit_price_ttc,
    price_entry_mode: i.price_entry_mode,
    discount_amount: i.discount_amount,
    tva_rate: i.tva_rate,
    item_type: i.item_type,
  }))

  // 2. Calcul (lib partagée)
  const creditsById: Record<string, number> = {}
  for (const c of credits) creditsById[c.quote_item_id] = c.credited_ttc
  const result = computeCreditNote(
    items,
    creditsById,
    q.discount_percentage ?? 0,
    collectedAcompte
  )

  // Fige l'acompte au montant réellement encaissé (fallback : acompte sur l'ancien effectif)
  const frozenDeposit =
    collectedAcompte > 0
      ? round2(collectedAcompte)
      : quoteDepositTtc({ ...q, total_ttc: result.oldEffectiveTtc })

  // Nouveaux totaux du devis = produits seuls (extras hors quote.total_ttc)
  const productItemsAfter = items
    .filter(
      (i: any) => !result.creditedItems.find((c) => c.id === i.id && c.remove)
    )
    .map((i: any) => {
      const upd = result.creditedItems.find((c) => c.id === i.id && !c.remove)
      return upd ? { ...i, discount_amount: upd.newDiscountAmount } : i
    })
    .filter((i: any) => i.item_type !== 'extra')
  const newTotals = computeQuoteAmounts(
    productItemsAfter,
    q.discount_percentage ?? 0
  )

  // 3. Snapshot des lignes créditées pour credit_note_items
  const creditItems = result.creditedItems.map((c) => {
    const src = q.quote_items.find((i: any) => i.id === c.id)
    const line = computeLineAmounts(src)
    return {
      source_quote_item_id: c.id,
      name: src.name,
      description: src.description ?? null,
      quantity: src.quantity,
      unit_price: src.unit_price,
      tva_rate: src.tva_rate,
      item_type: src.item_type ?? 'product',
      total_ht: line.totalHt,
      total_ttc: line.totalTtc,
      credited_ttc: c.creditedTtc,
    }
  })

  // 4. Écriture atomique via RPC
  const { data: cn, error: rpcErr } = await supabase.rpc('create_credit_note', {
    p_organization_id: q.organization_id,
    p_restaurant_id: booking?.restaurant_id ?? null,
    p_booking_id: booking?.id ?? null,
    p_quote_id: quoteId,
    p_reason: reason ?? null,
    p_new_total_ht: newTotals.totalHt,
    p_new_total_tva: newTotals.totalTva,
    p_new_total_ttc: newTotals.totalTtc,
    p_deposit_override: frozenDeposit,
    p_avoir_ht: result.avoirHt,
    p_avoir_tva: result.avoirTva,
    p_avoir_ttc: result.avoirTtc,
    p_old_effective_ttc: result.oldEffectiveTtc,
    p_new_effective_ttc: result.newEffectiveTtc,
    p_overpaid_ttc: result.overpaidTtc,
    p_removed_item_ids: result.creditedItems
      .filter((c) => c.remove)
      .map((c) => c.id),
    p_updated_items: result.creditedItems
      .filter((c) => !c.remove)
      .map((c) => ({ id: c.id, discount_amount: c.newDiscountAmount })),
    p_credit_items: creditItems,
    p_created_by: (req as any).user?.id ?? null,
  } as any)
  if (rpcErr || !cn)
    return res
      .status(500)
      .json({ error: 'CREDIT_NOTE_FAILED', detail: rpcErr?.message })

  const creditNote = cn as any

  // 5. Effets de bord : PDF + ligne documents (avoir régénérable, pas de rollback)
  try {
    const pdf = await generateCreditNotePdf(creditNote.id)
    const path = `${q.organization_id}/quotes/${quoteId}/avoir-${creditNote.avoir_number}.pdf`
    await savePdfAsDocument(
      pdf,
      `avoir-${creditNote.avoir_number}.pdf`,
      path,
      `Avoir - ${creditNote.avoir_number}`,
      q.organization_id,
      booking?.id ?? null,
      { doc_kind: 'avoir', credit_note_id: creditNote.id }
    )
  } catch (e) {
    console.error('[credit-note] pdf/storage failed', e)
  }

  res.json({ credit_note: creditNote })
})

// GET /api/quotes/credit-notes/:id/download-pdf - Télécharge le PDF d'un avoir (inline)
quotesRouter.get(
  '/credit-notes/:id/download-pdf',
  async (req: Request, res: Response) => {
    try {
      const pdfBuffer = await generateCreditNotePdf(req.params.id)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'inline; filename="avoir.pdf"')
      res.send(pdfBuffer)
    } catch (error) {
      console.error('Error generating credit note PDF for download:', error)
      res.status(500).json({ error: 'Erreur lors de la génération du PDF' })
    }
  }
)

// GET /api/quotes/:id/download-pdf?type=devis|acompte|solde - Download PDF
quotesRouter.get('/:id/download-pdf', async (req: Request, res: Response) => {
  const quoteId = req.params.id
  const docType = (req.query.type as string) || 'devis'

  try {
    const pdfBuffer = await generateQuotePdf(quoteId, docType as any)
    const quoteData = await fetchQuoteFullData(quoteId)
    const filename = `${quoteData.quote_number || 'devis'}-${docType}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdfBuffer)
  } catch (error) {
    console.error('Error generating PDF for download:', error)
    res.status(500).json({ error: 'Erreur lors de la génération du PDF' })
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

// PATCH /api/quotes/:id/items/:itemId - Update a quote item
quotesRouter.patch(
  '/:id/items/:itemId',
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('quote_items')
        .update(req.body)
        .eq('id', req.params.itemId)
        .eq('quote_id', req.params.id)
        .select()
        .single()

      if (error) throw error

      await recalculateQuoteTotals(req.params.id)

      res.json(data)
    } catch (error) {
      console.error('Error updating quote item:', error)
      res.status(500).json({ error: 'Failed to update quote item' })
    }
  }
)

// DELETE /api/quotes/:id/items/:itemId - Remove a quote item
quotesRouter.delete(
  '/:id/items/:itemId',
  async (req: Request, res: Response) => {
    try {
      const { error } = await supabase
        .from('quote_items')
        .delete()
        .eq('id', req.params.itemId)
        .eq('quote_id', req.params.id)

      if (error) throw error

      await recalculateQuoteTotals(req.params.id)

      res.status(204).send()
    } catch (error) {
      console.error('Error deleting quote item:', error)
      res.status(500).json({ error: 'Failed to delete quote item' })
    }
  }
)

// Recalcule les totaux d'un devis (arrondi au centime, somme des lignes, remise en pied).
// Symétrique à recalculateQuoteTotals dans src/features/reservations/hooks/use-quotes.ts.
async function recalculateQuoteTotals(quoteId: string) {
  const { data: items } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quoteId)

  if (!items) return

  // Extras facturés séparément, exclus du total devis
  const productItems = items.filter((item: any) => item.item_type !== 'extra')

  const { data: quote } = await supabase
    .from('quotes')
    .select('discount_percentage')
    .eq('id', quoteId)
    .single()

  const totals = computeQuoteAmounts(
    productItems,
    (quote as any)?.discount_percentage
  )

  await supabase
    .from('quotes')
    .update({
      total_ht: totals.totalHt,
      total_tva: totals.totalTva,
      total_ttc: totals.totalTtc,
    })
    .eq('id', quoteId)
}
