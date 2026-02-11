import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

export const organizationsRouter = Router()

// GET /api/organizations
organizationsRouter.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error fetching organizations:', error)
    res.status(500).json({ error: 'Failed to fetch organizations' })
  }
})

// GET /api/organizations/:id
organizationsRouter.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Organization not found' })
    res.json(data)
  } catch (error) {
    console.error('Error fetching organization:', error)
    res.status(500).json({ error: 'Failed to fetch organization' })
  }
})

// POST /api/organizations
organizationsRouter.post('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .insert(req.body)
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating organization:', error)
    res.status(500).json({ error: 'Failed to create organization' })
  }
})

// PATCH /api/organizations/:id
organizationsRouter.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error updating organization:', error)
    res.status(500).json({ error: 'Failed to update organization' })
  }
})

// DELETE /api/organizations/:id
organizationsRouter.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting organization:', error)
    res.status(500).json({ error: 'Failed to delete organization' })
  }
})
