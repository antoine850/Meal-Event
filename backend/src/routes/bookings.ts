import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'

export const bookingsRouter = Router()

// GET /api/bookings
bookingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organization_id as string
    const restaurantId = req.query.restaurant_id as string
    const statusId = req.query.status_id as string
    const assignedTo = req.query.assigned_to as string
    const startDate = req.query.start_date as string
    const endDate = req.query.end_date as string

    let query = supabase
      .from('bookings')
      .select(`
        *,
        contact:contacts (id, first_name, last_name, email, phone),
        restaurant:restaurants (id, name, color),
        status:statuses (*),
        space:spaces (id, name),
        time_slot:time_slots (id, name, start_time, end_time),
        assigned_user:users!bookings_assigned_to_fkey (id, first_name, last_name)
      `)
      .order('event_date', { ascending: true })

    if (organizationId) query = query.eq('organization_id', organizationId)
    if (restaurantId) query = query.eq('restaurant_id', restaurantId)
    if (statusId) query = query.eq('status_id', statusId)
    if (assignedTo) query = query.eq('assigned_to', assignedTo)
    if (startDate) query = query.gte('event_date', startDate)
    if (endDate) query = query.lte('event_date', endDate)

    const { data, error } = await query

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error fetching bookings:', error)
    res.status(500).json({ error: 'Failed to fetch bookings' })
  }
})

// GET /api/bookings/:id
bookingsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        contact:contacts (*),
        restaurant:restaurants (*),
        status:statuses (*),
        space:spaces (*),
        time_slot:time_slots (*),
        assigned_user:users!bookings_assigned_to_fkey (id, first_name, last_name, email),
        booking_products_services (*),
        quotes (
          *,
          quote_items (*)
        ),
        payments (*),
        receipts (*)
      `)
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Booking not found' })
    res.json(data)
  } catch (error) {
    console.error('Error fetching booking:', error)
    res.status(500).json({ error: 'Failed to fetch booking' })
  }
})

// POST /api/bookings
bookingsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .insert(req.body)
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating booking:', error)
    res.status(500).json({ error: 'Failed to create booking' })
  }
})

// PATCH /api/bookings/:id
bookingsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error updating booking:', error)
    res.status(500).json({ error: 'Failed to update booking' })
  }
})

// DELETE /api/bookings/:id
bookingsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting booking:', error)
    res.status(500).json({ error: 'Failed to delete booking' })
  }
})

// POST /api/bookings/:id/products-services
bookingsRouter.post('/:id/products-services', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('booking_products_services')
      .insert({ ...req.body, booking_id: req.params.id })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    console.error('Error adding product/service:', error)
    res.status(500).json({ error: 'Failed to add product/service' })
  }
})

