import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'

export const contactsRouter = Router()

// GET /api/contacts
contactsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organization_id as string
    const statusId = req.query.status_id as string
    const assignedTo = req.query.assigned_to as string

    let query = supabase
      .from('contacts')
      .select(`
        *,
        company:companies (*),
        status:statuses (*),
        assigned_user:users!contacts_assigned_to_fkey (id, first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })

    if (organizationId) query = query.eq('organization_id', organizationId)
    if (statusId) query = query.eq('status_id', statusId)
    if (assignedTo) query = query.eq('assigned_to', assignedTo)

    const { data, error } = await query

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error fetching contacts:', error)
    res.status(500).json({ error: 'Failed to fetch contacts' })
  }
})

// GET /api/contacts/:id
contactsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        *,
        company:companies (*),
        status:statuses (*),
        assigned_user:users!contacts_assigned_to_fkey (id, first_name, last_name, email),
        bookings (
          id, event_type, event_date, guests_count, total_amount,
          status:statuses (*),
          restaurant:restaurants (id, name, color)
        )
      `)
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Contact not found' })
    res.json(data)
  } catch (error) {
    console.error('Error fetching contact:', error)
    res.status(500).json({ error: 'Failed to fetch contact' })
  }
})

// POST /api/contacts
contactsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert(req.body)
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating contact:', error)
    res.status(500).json({ error: 'Failed to create contact' })
  }
})

// PATCH /api/contacts/:id
contactsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error updating contact:', error)
    res.status(500).json({ error: 'Failed to update contact' })
  }
})

// DELETE /api/contacts/:id
contactsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting contact:', error)
    res.status(500).json({ error: 'Failed to delete contact' })
  }
})

// GET /api/contacts/stats - Get contact statistics
contactsRouter.get('/stats/pipeline', async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organization_id as string

    const { data, error } = await supabase
      .from('contacts')
      .select('status_id, statuses!inner(name, slug, color, position)')
      .eq('organization_id', organizationId)

    if (error) throw error

    // Group by status
    const stats = data.reduce((acc: Record<string, number>, contact) => {
      const statusId = contact.status_id || 'no_status'
      acc[statusId] = (acc[statusId] || 0) + 1
      return acc
    }, {})

    res.json(stats)
  } catch (error) {
    console.error('Error fetching contact stats:', error)
    res.status(500).json({ error: 'Failed to fetch contact stats' })
  }
})
