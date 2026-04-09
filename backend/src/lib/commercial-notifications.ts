// ── Commercial Notification Emails ──
// Send styled email notifications to assigned commercial users
// when a quote is signed or a payment is received.

import { supabase } from './supabase.js'
import { sendEmail } from './resend.js'
import {
  buildSignatureNotificationHtml, buildSignatureNotificationSubject,
  buildPaymentNotificationHtml, buildPaymentNotificationSubject,
} from './email-templates.js'

interface CommercialUser {
  first_name: string
  last_name: string
  email: string
}

interface BookingContext {
  contactName: string
  eventDate: string | null
  eventTitle: string | null
  restaurant: any
}

// Fetch all commercial users assigned to a booking (assigned_user_ids + fallback assigned_to)
async function getCommercialUsers(bookingId: string): Promise<CommercialUser[]> {
  const { data: booking } = await supabase
    .from('bookings')
    .select('assigned_to, assigned_user_ids')
    .eq('id', bookingId)
    .single()

  if (!booking) return []

  const userIds: string[] = []

  // Primary: assigned_user_ids array
  if (Array.isArray((booking as any).assigned_user_ids) && (booking as any).assigned_user_ids.length > 0) {
    userIds.push(...(booking as any).assigned_user_ids)
  }
  // Fallback: assigned_to (single)
  if (booking.assigned_to && !userIds.includes(booking.assigned_to)) {
    userIds.push(booking.assigned_to)
  }

  if (userIds.length === 0) return []

  const { data: users } = await supabase
    .from('users')
    .select('first_name, last_name, email')
    .in('id', userIds)

  return (users || []).filter(u => u.email) as CommercialUser[]
}

// Fetch booking context (contact name, event info, restaurant branding)
async function getBookingContext(bookingId: string): Promise<BookingContext | null> {
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      event_date, event_type, occasion,
      contact:contacts(first_name, last_name),
      restaurant:restaurants(
        id, name, address, city, postal_code, phone, email,
        logo_url, color, siret, tva_number, iban, bic, bank_name,
        legal_name, legal_form, share_capital, rcs, siren
      )
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) return null

  const contact = booking.contact as any
  const contactName = contact
    ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    : 'Client'

  return {
    contactName,
    eventDate: booking.event_date || null,
    eventTitle: booking.occasion || booking.event_type || null,
    restaurant: booking.restaurant || { name: 'Restaurant' },
  }
}

// ═══════════════════════════════════════════════
// Notify commercial(s) that a quote was signed
// ═══════════════════════════════════════════════
export async function notifyCommercialSignature(params: {
  bookingId: string
  quoteNumber: string
  totalTtc: number
  eventTitle?: string | null
  eventDate?: string | null
}) {
  try {
    const { bookingId, quoteNumber, totalTtc } = params

    const [commercials, context] = await Promise.all([
      getCommercialUsers(bookingId),
      getBookingContext(bookingId),
    ])

    if (commercials.length === 0) {
      console.log(`[Notify] No commercial assigned to booking ${bookingId} — skipping signature notification`)
      return
    }
    if (!context) {
      console.log(`[Notify] Booking ${bookingId} not found — skipping signature notification`)
      return
    }

    const eventTitle = params.eventTitle || context.eventTitle
    const eventDate = params.eventDate || context.eventDate

    for (const commercial of commercials) {
      const html = buildSignatureNotificationHtml({
        restaurant: context.restaurant,
        commercialFirstName: commercial.first_name,
        contactName: context.contactName,
        quoteNumber,
        totalTtc,
        eventDate,
        eventTitle,
      })

      const subject = buildSignatureNotificationSubject(quoteNumber, context.contactName)

      await sendEmail({ to: commercial.email, subject, html })
      console.log(`[Notify] ✅ Signature notification sent to ${commercial.email} for quote ${quoteNumber}`)
    }
  } catch (error) {
    console.error('[Notify] Error sending signature notification:', error)
  }
}

// ═══════════════════════════════════════════════
// Notify commercial(s) that a payment was received
// ═══════════════════════════════════════════════
export async function notifyCommercialPayment(params: {
  bookingId: string
  amount: number
  paymentType: string
  paymentMethod: string | null
  quoteNumber?: string | null
}) {
  try {
    const { bookingId, amount, paymentType, paymentMethod } = params

    const [commercials, context] = await Promise.all([
      getCommercialUsers(bookingId),
      getBookingContext(bookingId),
    ])

    if (commercials.length === 0) {
      console.log(`[Notify] No commercial assigned to booking ${bookingId} — skipping payment notification`)
      return
    }
    if (!context) {
      console.log(`[Notify] Booking ${bookingId} not found — skipping payment notification`)
      return
    }

    // Try to get quote number if not provided
    let quoteNumber = params.quoteNumber || null
    if (!quoteNumber) {
      const { data: quote } = await supabase
        .from('quotes')
        .select('quote_number')
        .eq('booking_id', bookingId)
        .eq('primary_quote', true)
        .single()
      quoteNumber = quote?.quote_number || null
    }

    for (const commercial of commercials) {
      const html = buildPaymentNotificationHtml({
        restaurant: context.restaurant,
        commercialFirstName: commercial.first_name,
        contactName: context.contactName,
        amount,
        paymentType,
        quoteNumber,
        eventDate: context.eventDate,
        eventTitle: context.eventTitle,
        paymentMethod,
      })

      const subject = buildPaymentNotificationSubject(amount, context.contactName, paymentType)

      await sendEmail({ to: commercial.email, subject, html })
      console.log(`[Notify] ✅ Payment notification sent to ${commercial.email} — ${amount} € (${paymentType})`)
    }
  } catch (error) {
    console.error('[Notify] Error sending payment notification:', error)
  }
}
