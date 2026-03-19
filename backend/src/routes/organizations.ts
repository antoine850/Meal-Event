import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { supabase } from '../lib/supabase.js'

export const organizationsRouter = Router()

// GET /api/organizations
organizationsRouter.get('/', async (_req: Request, res: Response) => {
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
organizationsRouter.get('/:id', async (req: Request, res: Response) => {
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
organizationsRouter.post('/', async (req: Request, res: Response) => {
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
organizationsRouter.patch('/:id', async (req: Request, res: Response) => {
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

// POST /api/organizations/:id/generate-api-key
organizationsRouter.post('/:id/generate-api-key', async (req: Request, res: Response) => {
  try {
    const orgId = req.params.id

    // Generate a new API key
    const rawKey = 'sk_live_' + crypto.randomBytes(24).toString('hex')
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.substring(0, 12) + '...'

    const { error } = await supabase
      .from('organizations')
      .update({
        api_key_hash: keyHash,
        api_key_prefix: keyPrefix,
        api_key_last_used_at: null,
      })
      .eq('id', orgId)

    if (error) throw error

    // Return the full key ONCE — it will never be shown again
    res.json({ api_key: rawKey, prefix: keyPrefix })
  } catch (error) {
    console.error('Error generating API key:', error)
    res.status(500).json({ error: 'Failed to generate API key' })
  }
})

// DELETE /api/organizations/:id/revoke-api-key
organizationsRouter.delete('/:id/revoke-api-key', async (req: Request, res: Response) => {
  try {
    const orgId = req.params.id

    const { error } = await supabase
      .from('organizations')
      .update({
        api_key_hash: null,
        api_key_prefix: null,
        api_key_last_used_at: null,
      })
      .eq('id', orgId)

    if (error) throw error
    res.json({ success: true })
  } catch (error) {
    console.error('Error revoking API key:', error)
    res.status(500).json({ error: 'Failed to revoke API key' })
  }
})

// DELETE /api/organizations/:id
organizationsRouter.delete('/:id', async (req: Request, res: Response) => {
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
