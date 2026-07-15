import Stripe from 'stripe'
import {
  sendClientEmail,
  getCommercialInfo,
  getOrgFacturationEmail,
} from './client-email.js'
import {
  buildDocumentName,
  clientNameOf,
  savePdfAsDocument,
} from './documents.js'
import {
  buildDepositEmailHtml,
  buildDepositEmailSubject,
} from './email-templates.js'
import { generateQuotePdf, fetchQuoteFullData } from './pdf-generator.js'
import { computeDepositAmounts, formatEuroAdaptive } from './quote-rounding.js'
import {
  getRestaurantStripeContext,
  resolveStripeMode,
  stripeRequestOptions,
  getOrCreateStripeCustomerOnAccount,
} from './stripe-connect.js'
import { supabase } from './supabase.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

// Montant d'acompte TTC : montant fixe saisi (override) sinon pourcentage, au centime.
// Acompte et solde DOIVENT passer par cet helper pour que acompte + solde = total exactement.
export function quoteDepositTtc(q: {
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

export interface DepositSendResult {
  invoiceId: string
  invoiceUrl: string
  depositAmount: number
}

// Flux complet d'envoi d'acompte : facture Stripe Connect (ou fallback virement),
// PDF, email, écritures quotes/payment_links/payments/activity_logs.
// Partagé entre la route send-deposit (source 'manual') et le webhook SignNow
// (source 'auto_signature'). quoteData optionnel pour éviter un double fetch.
export async function createAndSendDeposit(
  quoteId: string,
  opts: {
    source: 'manual' | 'auto_signature'
    actorUserId?: string | null
    quoteData?: any
  }
): Promise<DepositSendResult> {
  const quoteData = opts.quoteData ?? (await fetchQuoteFullData(quoteId))
  const booking = quoteData.booking
  const restaurant = booking?.restaurant
  const contact = booking?.contact

  if (!contact?.email) {
    throw new Error("Le contact n'a pas d'adresse email")
  }

  const isAuto = opts.source === 'auto_signature'

  // Montant fixe en priorité, sinon % du TTC — toujours via le helper partagé.
  const depositAmount = quoteDepositTtc(quoteData)
  const effectiveDepositPct =
    quoteData.deposit_amount_override != null
      ? Math.round((depositAmount / quoteData.total_ttc) * 100)
      : quoteData.deposit_percentage

  const commercial = booking
    ? await getCommercialInfo(booking.id)
    : { name: null, email: null }

  // Connect-only : on encaisse Stripe UNIQUEMENT sur le compte Connect du
  // restaurant. Sinon → fallback virement bancaire (aucune facture plateforme).
  const restaurantId = (restaurant as any)?.id as string | undefined
  const stripeCtx = restaurantId
    ? await getRestaurantStripeContext(restaurantId)
    : null
  const stripeMode = stripeCtx
    ? resolveStripeMode(stripeCtx)
    : ({ mode: 'bank_transfer', reason: 'disabled' } as const)

  const isStripeEnabled = stripeMode.mode === 'connect'
  const connectAcctId = stripeMode.mode === 'connect' ? stripeMode.acctId : null
  const stripeOpts = stripeRequestOptions(connectAcctId)

  let invoiceUrl = ''
  let invoiceId = ''

  if (isStripeEnabled && connectAcctId) {
    console.log(
      `[deposit-flow] Creating Stripe invoice on Connect account ${connectAcctId} for deposit: ${formatEuroAdaptive(depositAmount)}`
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
          quoteData.deposit_amount_override != null
            ? `Acompte ${formatEuroAdaptive(depositAmount)} - ${quoteData.quote_number}`
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
          quoteData.deposit_amount_override != null
            ? `Acompte ${formatEuroAdaptive(depositAmount)} pour ${restaurant?.name || 'événement'} le ${quoteData.date_start || booking?.event_date || ''}`
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
      `[deposit-flow] No Stripe Connect (reason=${reason}) — bank transfer fallback for ${formatEuroAdaptive(depositAmount)}`
    )
  }

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generateQuotePdf(quoteId, 'acompte', quoteData)
  } catch (pdfError) {
    console.error('[deposit-flow] Error generating deposit PDF:', pdfError)
    throw new Error("Erreur lors de la génération du PDF d'acompte")
  }

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
    commercialName: commercial.name,
    stripeEnabled: isStripeEnabled,
    orderNumber: quoteData.order_number,
  })

  const subject = buildDepositEmailSubject(
    quoteData.quote_number,
    restaurant?.name || 'Restaurant'
  )

  const facturationEmail = await getOrgFacturationEmail(
    quoteData.organization_id
  )

  const acompteDocName = buildDocumentName(
    'facture_acompte',
    restaurant?.name,
    clientNameOf(contact)
  )

  await sendClientEmail({
    organizationId: quoteData.organization_id,
    bookingId: booking?.id || null,
    quoteId,
    emailType: 'deposit_invoice',
    actorUserId: opts.actorUserId ?? null,
    to: contact.email,
    subject,
    html,
    replyTo: commercial.email || restaurant?.email || undefined,
    facturationEmail: facturationEmail || undefined,
    ccFacturation: true,
    attachments: [
      {
        filename: `${acompteDocName}.pdf`,
        content: pdfBuffer,
      },
    ],
  })

  await savePdfAsDocument(
    pdfBuffer,
    `${acompteDocName}.pdf`,
    `${quoteData.organization_id}/quotes/${quoteId}/facture-acompte-${quoteData.quote_number}.pdf`,
    acompteDocName,
    quoteData.organization_id,
    booking?.id || null,
    { doc_kind: 'facture_acompte' }
  )

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

  await supabase.from('activity_logs').insert({
    organization_id: quoteData.organization_id,
    booking_id: booking?.id,
    action_type: 'payment.deposit_sent',
    action_label: `Facture acompte de ${depositAmount.toLocaleString('fr-FR')} € envoyée${
      isAuto
        ? ` automatiquement après signature${isStripeEnabled ? '' : ' (virement bancaire)'}`
        : isStripeEnabled
          ? ' avec lien de paiement'
          : ' (virement bancaire)'
    }`,
    actor_type: isAuto ? 'system' : 'user',
    ...(isAuto
      ? { actor_name: 'Système' }
      : { actor_id: opts.actorUserId || null }),
    entity_type: 'quote',
    entity_id: quoteId,
    metadata: {
      amount: depositAmount,
      method: isStripeEnabled ? 'stripe' : 'virement',
      ...(isAuto ? { auto: true } : {}),
    },
  })

  return { invoiceId, invoiceUrl, depositAmount }
}
