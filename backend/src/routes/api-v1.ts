import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireApiKey } from '../middleware/api-auth.js'

export const apiV1Router = Router()

// All routes require API key authentication
apiV1Router.use(requireApiKey)

// ============================================
// Helpers
// ============================================

function getOrgId(req: Request): string {
  return (req as any).organizationId
}

function parsePagination(query: any): { page: number; perPage: number; from: number; to: number } {
  const page = Math.max(1, parseInt(query.page) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(query.per_page) || 20))
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  return { page, perPage, from, to }
}

function paginatedResponse(data: any[], total: number, page: number, perPage: number) {
  return {
    data,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  }
}

function errorResponse(res: Response, code: string, message: string, status = 400) {
  return res.status(status).json({ error: { code, message } })
}

// ============================================
// RESTAURANTS
// ============================================

// GET /api/v1/restaurants
apiV1Router.get('/restaurants', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, slug, address, city, postal_code, country, phone, email, is_active, created_at')
      .eq('organization_id', orgId)
      .order('name', { ascending: true })

    if (error) throw error
    return res.json({ data })
  } catch (err) {
    console.error('[API v1] Error fetching restaurants:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to fetch restaurants', 500)
  }
})

// GET /api/v1/restaurants/:id
apiV1Router.get('/restaurants/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, slug, address, city, postal_code, country, phone, email, is_active, website, instagram, facebook, created_at, updated_at')
      .eq('organization_id', orgId)
      .eq('id', req.params.id)
      .single()

    if (error || !data) return errorResponse(res, 'NOT_FOUND', 'Restaurant not found', 404)
    return res.json({ data })
  } catch (err) {
    console.error('[API v1] Error fetching restaurant:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to fetch restaurant', 500)
  }
})

// ============================================
// CONTACTS
// ============================================

// GET /api/v1/contacts
apiV1Router.get('/contacts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { page, perPage, from, to } = parsePagination(req.query)

    let query = supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, source, client_type, company_id, created_at, updated_at', { count: 'exact' })
      .eq('organization_id', orgId)

    // Filters
    if (req.query.email) query = query.eq('email', req.query.email as string)
    if (req.query.phone) query = query.eq('phone', req.query.phone as string)
    if (req.query.search) {
      const search = req.query.search as string
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    return res.json(paginatedResponse(data || [], count || 0, page, perPage))
  } catch (err) {
    console.error('[API v1] Error fetching contacts:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to fetch contacts', 500)
  }
})

// GET /api/v1/contacts/:id
apiV1Router.get('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data, error } = await supabase
      .from('contacts')
      .select('*, company:companies(id, name)')
      .eq('organization_id', orgId)
      .eq('id', req.params.id)
      .single()

    if (error || !data) return errorResponse(res, 'NOT_FOUND', 'Contact not found', 404)
    return res.json({ data })
  } catch (err) {
    console.error('[API v1] Error fetching contact:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to fetch contact', 500)
  }
})

// POST /api/v1/contacts
apiV1Router.post('/contacts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { first_name, last_name, email, phone, client_type, company_name } = req.body

    if (!first_name || !last_name || !email) {
      return errorResponse(res, 'VALIDATION_ERROR', 'first_name, last_name, and email are required')
    }

    // Find or create company if provided
    let companyId: string | null = null
    if (company_name?.trim()) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', company_name.trim())
        .limit(1)
        .single()

      if (existingCompany) {
        companyId = existingCompany.id
      } else {
        const { data: newCompany } = await supabase
          .from('companies')
          .insert({ organization_id: orgId, name: company_name.trim() } as never)
          .select('id')
          .single()
        if (newCompany) companyId = newCompany.id
      }
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        organization_id: orgId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        client_type: client_type || 'particulier',
        source: 'api',
        ...(companyId ? { company_id: companyId } : {}),
      } as never)
      .select('id, first_name, last_name, email, phone, source, created_at')
      .single()

    if (error) {
      if (error.code === '23505') return errorResponse(res, 'DUPLICATE', 'A contact with this email already exists')
      throw error
    }
    return res.status(201).json({ data })
  } catch (err) {
    console.error('[API v1] Error creating contact:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to create contact', 500)
  }
})

// PATCH /api/v1/contacts/:id
apiV1Router.patch('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const allowed = ['first_name', 'last_name', 'email', 'phone', 'client_type']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse(res, 'VALIDATION_ERROR', 'No valid fields to update')
    }

    const { data, error } = await supabase
      .from('contacts')
      .update(updates as never)
      .eq('organization_id', orgId)
      .eq('id', req.params.id)
      .select('id, first_name, last_name, email, phone, client_type, updated_at')
      .single()

    if (error || !data) return errorResponse(res, 'NOT_FOUND', 'Contact not found', 404)
    return res.json({ data })
  } catch (err) {
    console.error('[API v1] Error updating contact:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to update contact', 500)
  }
})

// DELETE /api/v1/contacts/:id
apiV1Router.delete('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const contactId = req.params.id

    // Verify contact belongs to org
    const { data: existing, error: findErr } = await supabase
      .from('contacts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('id', contactId)
      .single()

    if (findErr || !existing) return errorResponse(res, 'NOT_FOUND', 'Contact not found', 404)

    // Unlink bookings from this contact (set contact_id to null instead of failing)
    await supabase.from('bookings').update({ contact_id: null } as never).eq('contact_id', contactId)

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)

    if (error) throw error
    return res.json({ success: true })
  } catch (err) {
    console.error('[API v1] Error deleting contact:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to delete contact', 500)
  }
})

// ============================================
// BOOKINGS
// ============================================

// GET /api/v1/bookings
apiV1Router.get('/bookings', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { page, perPage, from, to } = parsePagination(req.query)

    let query = supabase
      .from('bookings')
      .select(`
        id, event_date, guests_count, event_type, occasion, source, status_id, restaurant_id,
        created_at, updated_at,
        contact:contacts(id, first_name, last_name, email, phone),
        restaurant:restaurants(id, name),
        status:statuses(id, name, slug, color)
      `, { count: 'exact' })
      .eq('organization_id', orgId)

    // Filters
    if (req.query.restaurant_id) query = query.eq('restaurant_id', req.query.restaurant_id as string)
    if (req.query.status_id) query = query.eq('status_id', req.query.status_id as string)
    if (req.query.contact_id) query = query.eq('contact_id', req.query.contact_id as string)
    if (req.query.date_from) query = query.gte('event_date', req.query.date_from as string)
    if (req.query.date_to) query = query.lte('event_date', req.query.date_to as string)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    return res.json(paginatedResponse(data || [], count || 0, page, perPage))
  } catch (err) {
    console.error('[API v1] Error fetching bookings:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to fetch bookings', 500)
  }
})

// GET /api/v1/bookings/:id
apiV1Router.get('/bookings/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email, phone, client_type),
        restaurant:restaurants(id, name, slug),
        status:statuses(id, name, slug, color)
      `)
      .eq('organization_id', orgId)
      .eq('id', req.params.id)
      .single()

    if (error || !data) return errorResponse(res, 'NOT_FOUND', 'Booking not found', 404)
    return res.json({ data })
  } catch (err) {
    console.error('[API v1] Error fetching booking:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to fetch booking', 500)
  }
})

// POST /api/v1/bookings
apiV1Router.post('/bookings', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const {
      restaurant_id,
      event_type,
      occasion,
      event_date,
      guests_count,
      contact,
      client_type,
      company_name,
      allergies,
      special_requests,
      reservation_type,
      time_slot,
      budget,
    } = req.body

    // Validation
    if (!restaurant_id || !event_type || !occasion || !event_date || !guests_count || !contact) {
      return errorResponse(res, 'VALIDATION_ERROR', 'restaurant_id, event_type, occasion, event_date, guests_count, and contact are required')
    }

    if (!contact.first_name || !contact.last_name || !contact.email) {
      return errorResponse(res, 'VALIDATION_ERROR', 'contact.first_name, contact.last_name, and contact.email are required')
    }

    // Verify restaurant belongs to this org
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('id', restaurant_id)
      .single()

    if (restError || !restaurant) {
      return errorResponse(res, 'NOT_FOUND', 'Restaurant not found in your organization', 404)
    }

    // Find or create company (if professional)
    let companyId: string | null = null
    if (client_type === 'professionnel' && company_name?.trim()) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', company_name.trim())
        .limit(1)
        .single()

      if (existingCompany) {
        companyId = existingCompany.id
      } else {
        const { data: newCompany } = await supabase
          .from('companies')
          .insert({ organization_id: orgId, name: company_name.trim() } as never)
          .select('id')
          .single()
        if (newCompany) companyId = newCompany.id
      }
    }

    // Find or create contact
    let contactId: string
    const email = contact.email.toLowerCase().trim()

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', email)
      .limit(1)
      .single()

    if (existingContact) {
      contactId = existingContact.id
      await supabase
        .from('contacts')
        .update({
          first_name: contact.first_name.trim(),
          last_name: contact.last_name.trim(),
          ...(contact.phone ? { phone: contact.phone.trim() } : {}),
          ...(companyId ? { company_id: companyId } : {}),
        })
        .eq('id', contactId)
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          organization_id: orgId,
          first_name: contact.first_name.trim(),
          last_name: contact.last_name.trim(),
          email,
          phone: contact.phone?.trim() || null,
          source: 'api',
          ...(companyId ? { company_id: companyId } : {}),
        } as never)
        .select('id')
        .single()

      if (contactError || !newContact) {
        return errorResponse(res, 'INTERNAL_ERROR', 'Failed to create contact', 500)
      }
      contactId = newContact.id
    }

    // Find "nouveau" status
    const { data: nouveauStatus } = await supabase
      .from('statuses')
      .select('id')
      .eq('organization_id', orgId)
      .eq('slug', 'nouveau')
      .single()

    // Map time_slot to start_time
    const startTimeMap: Record<string, string | null> = { midi: '12:00', soir: '19:00', 'hors-service': null }
    const startTime = time_slot ? (startTimeMap[time_slot] || null) : null

    // Map reservation_type to is_privatif
    const isPrivatif = reservation_type === 'semi-privatisation' || reservation_type === 'privatisation'

    // Map event_type to format_souhaite
    const formatMap: Record<string, string> = { 'repas-assis': 'Repas Assis', 'cocktail': 'Cocktail', 'autre': 'Autre' }

    // Create booking
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
        occasion: occasion?.trim() || null,
        format_souhaite: formatMap[event_type] || event_type,
        is_privatif: isPrivatif,
        client_preferred_time: time_slot ? (time_slot === 'midi' ? 'Midi (12h)' : time_slot === 'soir' ? 'Soir (19h)' : 'Hors service') : null,
        start_time: startTime,
        budget_client: budget?.trim() || null,
        source: 'api',
        allergies_regimes: allergies?.trim() || null,
        special_requests: special_requests?.trim() || null,
        commentaires: client_type === 'professionnel' && company_name
          ? `Client professionnel - ${company_name.trim()}`
          : client_type === 'professionnel' ? 'Client professionnel' : null,
      } as never)
      .select('id, event_date, guests_count, event_type, occasion, reservation_type, budget_client, source, created_at')
      .single()

    if (bookingError || !booking) {
      console.error('[API v1] Error creating booking:', bookingError)
      return errorResponse(res, 'INTERNAL_ERROR', 'Failed to create booking', 500)
    }

    // Log activity (fire & forget)
    supabase
      .from('activity_logs')
      .insert({
        organization_id: orgId,
        booking_id: booking.id,
        action_type: 'booking_created',
        action_label: `Nouvelle demande via API — ${event_type}, ${guests_count} invités`,
        actor_type: 'system',
        actor_name: 'API v1',
      } as never)
      .then(() => {})

    console.log(`[API v1] Booking created: ${booking.id} for restaurant ${restaurant.name}`)
    return res.status(201).json({ data: { ...booking, contact_id: contactId } })
  } catch (err) {
    console.error('[API v1] Error creating booking:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to create booking', 500)
  }
})

// PATCH /api/v1/bookings/:id
apiV1Router.patch('/bookings/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const allowed = ['event_date', 'guests_count', 'event_type', 'occasion', 'status_id', 'allergies_regimes', 'special_requests', 'commentaires', 'reservation_type', 'budget_client', 'format_souhaite']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse(res, 'VALIDATION_ERROR', 'No valid fields to update')
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updates as never)
      .eq('organization_id', orgId)
      .eq('id', req.params.id)
      .select('id, event_date, guests_count, event_type, occasion, status_id, updated_at')
      .single()

    if (error || !data) return errorResponse(res, 'NOT_FOUND', 'Booking not found', 404)
    return res.json({ data })
  } catch (err) {
    console.error('[API v1] Error updating booking:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to update booking', 500)
  }
})

// DELETE /api/v1/bookings/:id
apiV1Router.delete('/bookings/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const bookingId = req.params.id

    // Verify booking belongs to org
    const { data: existing, error: findErr } = await supabase
      .from('bookings')
      .select('id')
      .eq('organization_id', orgId)
      .eq('id', bookingId)
      .single()

    if (findErr || !existing) return errorResponse(res, 'NOT_FOUND', 'Booking not found', 404)

    // Delete related records that have FK constraints
    await supabase.from('email_logs').delete().eq('booking_id', bookingId)
    await supabase.from('activity_logs').delete().eq('booking_id', bookingId)

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)

    if (error) throw error
    return res.json({ success: true })
  } catch (err) {
    console.error('[API v1] Error deleting booking:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to delete booking', 500)
  }
})

// ============================================
// QUOTES
// ============================================

// GET /api/v1/quotes
apiV1Router.get('/quotes', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { page, perPage, from, to } = parsePagination(req.query)

    let query = supabase
      .from('quotes')
      .select(`
        id, quote_number, status, total_ht, total_ttc, tva_amount, deposit_percentage,
        created_at, updated_at,
        booking:bookings(id, event_date, event_type),
        restaurant:restaurants(id, name)
      `, { count: 'exact' })
      .eq('organization_id', orgId)

    if (req.query.booking_id) query = query.eq('booking_id', req.query.booking_id as string)
    if (req.query.status) query = query.eq('status', req.query.status as string)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    return res.json(paginatedResponse(data || [], count || 0, page, perPage))
  } catch (err) {
    console.error('[API v1] Error fetching quotes:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to fetch quotes', 500)
  }
})

// GET /api/v1/quotes/:id
apiV1Router.get('/quotes/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        booking:bookings(id, event_date, event_type, guests_count, contact:contacts(id, first_name, last_name, email)),
        restaurant:restaurants(id, name)
      `)
      .eq('organization_id', orgId)
      .eq('id', req.params.id)
      .single()

    if (error || !data) return errorResponse(res, 'NOT_FOUND', 'Quote not found', 404)
    return res.json({ data })
  } catch (err) {
    console.error('[API v1] Error fetching quote:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to fetch quote', 500)
  }
})

// ============================================
// PAYMENTS
// ============================================

// GET /api/v1/payments
apiV1Router.get('/payments', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { page, perPage, from, to } = parsePagination(req.query)

    let query = supabase
      .from('payments')
      .select(`
        id, type, method, status, amount, currency, due_date, paid_at,
        created_at, updated_at,
        booking:bookings(id, event_date, event_type),
        quote:quotes(id, quote_number)
      `, { count: 'exact' })
      .eq('organization_id', orgId)

    if (req.query.booking_id) query = query.eq('booking_id', req.query.booking_id as string)
    if (req.query.status) query = query.eq('status', req.query.status as string)
    if (req.query.type) query = query.eq('type', req.query.type as string)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    return res.json(paginatedResponse(data || [], count || 0, page, perPage))
  } catch (err) {
    console.error('[API v1] Error fetching payments:', err)
    return errorResponse(res, 'INTERNAL_ERROR', 'Failed to fetch payments', 500)
  }
})
