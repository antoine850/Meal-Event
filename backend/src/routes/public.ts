import { Router, Request, Response } from 'express'
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
      occasion,
      event_date,
      guests_count,
      allergies,
      // Bloc 2
      client_type, // 'particulier' | 'professionnel'
      company_name,
      last_name,
      first_name,
      phone,
      email,
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
          source: 'website',
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
        occasion: occasion.trim(),
        source: 'website',
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
        action_label: `Nouvelle demande via le site web — ${event_type}, ${guests_count} invités`,
        actor_type: 'system',
        actor_name: 'Formulaire public',
      } as never)
      .then(() => {}) // fire and forget

    console.log(`[Public] Booking request created: ${booking.id} for restaurant ${restaurant.name}`)

    return res.json({ success: true, booking_id: booking.id })
  } catch (error) {
    console.error('[Public] Error processing booking request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
