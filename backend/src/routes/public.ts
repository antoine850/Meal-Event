import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { supabase } from '../lib/supabase.js'

export const publicRouter = Router()

// ============================================
// Simple in-memory rate limiting
// ============================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 10 // max 10 submissions per IP per hour

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }

  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip)
  }
}, 10 * 60 * 1000)

// ============================================
// Meta Conversions API helper
// ============================================
function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

async function sendMetaConversionEvent(params: {
  pixelId: string
  accessToken: string
  eventName: string
  eventTime: number
  eventSourceUrl?: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  fbc?: string
  fbclid?: string
  clientIp?: string
  clientUserAgent?: string
  customData?: Record<string, unknown>
}) {
  const { pixelId, accessToken, eventName, eventTime, eventSourceUrl, email, phone, firstName, lastName, fbc, fbclid, clientIp, clientUserAgent, customData } = params

  // Build user_data with hashed PII
  const userData: Record<string, string> = {}
  if (email) userData.em = sha256(email)
  if (phone) {
    // Normalize phone: remove spaces, dashes, dots — keep + and digits
    const normalizedPhone = phone.replace(/[\s.\-()]/g, '')
    userData.ph = sha256(normalizedPhone)
  }
  if (firstName) userData.fn = sha256(firstName)
  if (lastName) userData.ln = sha256(lastName)
  if (fbc) userData.fbc = fbc
  if (clientIp) userData.client_ip_address = clientIp
  if (clientUserAgent) userData.client_user_agent = clientUserAgent

  const eventData: Record<string, unknown> = {
    event_name: eventName,
    event_time: eventTime,
    action_source: 'website',
    user_data: userData,
  }

  if (eventSourceUrl) eventData.event_source_url = eventSourceUrl
  if (customData) eventData.custom_data = customData

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [eventData],
          access_token: accessToken,
          // Remove test_event_code in production once verified
          ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
        }),
      }
    )

    const result = await response.json()
    if (!response.ok) {
      console.error('[Meta CAPI] Error:', JSON.stringify(result))
    } else {
      console.log(`[Meta CAPI] Event '${eventName}' sent to pixel ${pixelId} — response:`, JSON.stringify(result))
    }
  } catch (error) {
    console.error('[Meta CAPI] Network error:', error)
  }
}

// ============================================
// GET /api/public/restaurants/:slug
// Returns restaurant info for the public form
// ============================================
publicRouter.get('/restaurants/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select('id, name, slug, color, logo_url, organization_id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' })
    }

    return res.json({
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      color: restaurant.color,
      logo_url: restaurant.logo_url,
    })
  } catch (error) {
    console.error('[Public] Error fetching restaurant:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================
// POST /api/public/booking-request
// Creates a contact (or finds existing) + booking
// Sends conversion event to Meta Conversions API
// ============================================
publicRouter.post('/booking-request', async (req: Request, res: Response) => {
  try {
    // Rate limiting
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'
    if (isRateLimited(clientIp)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' })
    }

    // Honeypot check — if this hidden field is filled, it's a bot
    if (req.body.website_url) {
      // Silently accept but do nothing
      return res.json({ success: true })
    }

    const {
      restaurant_slug,
      // Bloc 1
      event_type,
      reservation_type,
      occasion,
      time_slot,
      event_date,
      guests_count,
      allergies,
      budget,
      // Bloc 2
      client_type, // 'particulier' | 'professionnel'
      company_name,
      last_name,
      first_name,
      phone,
      email,
      // UTM tracking
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      fbclid,
      fbc,
      event_source_url,
    } = req.body

    // Validation
    if (!restaurant_slug || !event_type || !occasion || !event_date || !guests_count || !last_name || !first_name || !phone || !email) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (typeof guests_count !== 'number' || guests_count < 16) {
      return res.status(400).json({ error: 'Minimum 16 guests required' })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    // 1. Find restaurant by slug
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('id, organization_id, name')
      .eq('slug', restaurant_slug)
      .eq('is_active', true)
      .single()

    if (restError || !restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' })
    }

    const orgId = restaurant.organization_id

    // Determine source: if utm_source is present, use it (e.g. 'facebook'), otherwise 'website'
    // Normalize common abbreviations
    const normalizedUtmSource = utm_source === 'fb' ? 'facebook' : utm_source === 'ig' ? 'instagram' : utm_source
    const contactSource = normalizedUtmSource || 'website'

    // UTM fields to store on contact & booking
    const utmFields = {
      ...(utm_source ? { utm_source } : {}),
      ...(utm_medium ? { utm_medium } : {}),
      ...(utm_campaign ? { utm_campaign } : {}),
      ...(utm_content ? { utm_content } : {}),
      ...(utm_term ? { utm_term } : {}),
      ...(fbclid ? { fbclid } : {}),
      ...(fbc ? { fbc } : {}),
    }

    // 2. Find or create company (if professional)
    let companyId: string | null = null

    if (client_type === 'professionnel' && company_name?.trim()) {
      const companyNameTrimmed = company_name.trim()

      // Try to find existing company by name in same organization
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', companyNameTrimmed)
        .limit(1)
        .single()

      if (existingCompany) {
        companyId = existingCompany.id
      } else {
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            organization_id: orgId,
            name: companyNameTrimmed,
          } as never)
          .select('id')
          .single()

        if (!companyError && newCompany) {
          companyId = newCompany.id
        } else {
          console.error('[Public] Error creating company:', companyError)
        }
      }
    }

    // 3. Find or create contact
    let contactId: string

    // Try to find existing contact by email in same organization
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', email.toLowerCase().trim())
      .limit(1)
      .single()

    if (existingContact) {
      contactId = existingContact.id
      // Update contact info if needed
      await supabase
        .from('contacts')
        .update({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          phone: phone.trim(),
          source: contactSource,
          ...utmFields,
          ...(companyId ? { company_id: companyId } : {}),
        })
        .eq('id', contactId)
    } else {
      // Create new contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          organization_id: orgId,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          source: contactSource,
          ...utmFields,
          ...(companyId ? { company_id: companyId } : {}),
        } as never)
        .select('id')
        .single()

      if (contactError || !newContact) {
        console.error('[Public] Error creating contact:', contactError)
        return res.status(500).json({ error: 'Failed to create contact' })
      }

      contactId = newContact.id
    }

    // 4. Find "nouveau" status for this organization
    const { data: nouveauStatus } = await supabase
      .from('statuses')
      .select('id')
      .eq('organization_id', orgId)
      .eq('slug', 'nouveau')
      .single()

    // 5. Create booking
    // Map time_slot to start_time
    const startTimeMap: Record<string, string | null> = { midi: '12:00', soir: '19:00', 'hors-service': null }
    const startTime = time_slot ? (startTimeMap[time_slot] || null) : null

    // Map reservation_type to is_privatif and label
    const reservationTypeLabels: Record<string, string> = {
      'grande-tablee': 'Grande tablée',
      'semi-privatisation': 'Semi-privatisation',
      'privatisation': 'Privatisation totale',
    }
    const isPrivatif = reservation_type === 'semi-privatisation' || reservation_type === 'privatisation'

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        organization_id: orgId,
        restaurant_id: restaurant.id,
        contact_id: contactId,
        status_id: nouveauStatus?.id || null,
        event_date,
        guests_count,
        event_type,
        reservation_type: reservation_type || null,
        occasion: occasion.trim(),
        format_souhaite: event_type === 'repas-assis' ? 'Repas Assis' : event_type === 'cocktail' ? 'Cocktail' : event_type === 'autre' ? 'Autre' : event_type,
        is_privatif: isPrivatif,
        client_preferred_time: time_slot ? (time_slot === 'midi' ? 'Midi (12h)' : time_slot === 'soir' ? 'Soir (19h)' : 'Hors service') : null,
        start_time: startTime,
        budget_client: budget ? budget.trim() : null,
        source: contactSource,
        ...utmFields,
        allergies_regimes: allergies ? allergies.trim() : null,
        commentaires: client_type === 'professionnel' && company_name
          ? `Client professionnel - ${company_name.trim()}`
          : client_type === 'professionnel' ? 'Client professionnel' : null,
      } as never)
      .select('id')
      .single()

    if (bookingError || !booking) {
      console.error('[Public] Error creating booking:', bookingError)
      return res.status(500).json({ error: 'Failed to create booking' })
    }

    // 6. Log activity
    await supabase
      .from('activity_logs')
      .insert({
        organization_id: orgId,
        booking_id: booking.id,
        action_type: 'booking_created',
        action_label: `Nouvelle demande via le site web — ${event_type}, ${guests_count} invités${utm_source ? ` (source: ${utm_source}${utm_campaign ? `, campagne: ${utm_campaign}` : ''})` : ''}`,
        actor_type: 'system',
        actor_name: 'Formulaire public',
      } as never)
      .then(() => {}) // fire and forget

    console.log(`[Public] Booking request created: ${booking.id} for restaurant ${restaurant.name}${utm_source ? ` (utm_source: ${utm_source})` : ''}`)

    // 7. Send Meta Conversions API event (fire and forget)
    const { data: org } = await supabase
      .from('organizations')
      .select('meta_pixel_id, meta_conversions_token')
      .eq('id', orgId)
      .single()

    if (org?.meta_pixel_id && org?.meta_conversions_token) {
      sendMetaConversionEvent({
        pixelId: org.meta_pixel_id,
        accessToken: org.meta_conversions_token,
        eventName: 'Lead',
        eventTime: Math.floor(Date.now() / 1000),
        eventSourceUrl: event_source_url || undefined,
        email: email.trim(),
        phone: phone.trim(),
        firstName: first_name.trim(),
        lastName: last_name.trim(),
        fbc: fbc || undefined,
        fbclid: fbclid || undefined,
        clientIp: clientIp !== 'unknown' ? clientIp : undefined,
        clientUserAgent: req.headers['user-agent'] || undefined,
        customData: {
          content_name: restaurant.name,
          content_category: 'booking_request',
          event_type,
          guests_count,
        },
      }).catch(err => console.error('[Meta CAPI] Failed:', err))
    }

    return res.json({ success: true, booking_id: booking.id })
  } catch (error) {
    console.error('[Public] Error processing booking request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
