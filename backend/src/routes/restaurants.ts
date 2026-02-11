import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

export const restaurantsRouter = Router()

// GET /api/restaurants
restaurantsRouter.get('/', async (req, res) => {
  try {
    const organizationId = req.query.organization_id as string

    let query = supabase
      .from('restaurants')
      .select('*')
      .order('name')

    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    }

    const { data, error } = await query

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error fetching restaurants:', error)
    res.status(500).json({ error: 'Failed to fetch restaurants' })
  }
})

// GET /api/restaurants/:id
restaurantsRouter.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select(`
        *,
        spaces (*),
        restaurant_time_slots (
          time_slot:time_slots (*)
        )
      `)
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Restaurant not found' })
    res.json(data)
  } catch (error) {
    console.error('Error fetching restaurant:', error)
    res.status(500).json({ error: 'Failed to fetch restaurant' })
  }
})

// POST /api/restaurants
restaurantsRouter.post('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .insert(req.body)
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating restaurant:', error)
    res.status(500).json({ error: 'Failed to create restaurant' })
  }
})

// PATCH /api/restaurants/:id
restaurantsRouter.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error updating restaurant:', error)
    res.status(500).json({ error: 'Failed to update restaurant' })
  }
})

// DELETE /api/restaurants/:id
restaurantsRouter.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('restaurants')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting restaurant:', error)
    res.status(500).json({ error: 'Failed to delete restaurant' })
  }
})
