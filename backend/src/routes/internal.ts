import { Router, Request, Response } from 'express'
import {
  handleGcalSyncRequest,
  GcalSyncPayload,
} from '../lib/google-calendar.js'

export const internalRouter = Router()

// Appelé par le trigger pg_net sur bookings. Auth par secret partagé, pas de JWT.
internalRouter.post('/gcal-sync', (req: Request, res: Response) => {
  const secret = process.env.GCAL_SYNC_SECRET
  if (!secret || req.headers['x-internal-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const payload = req.body as GcalSyncPayload
  if (!payload?.booking_id || !payload?.action) {
    return res.status(400).json({ error: 'booking_id and action are required' })
  }
  // 200 immédiat : pg_net timeout à 5 s, l'aller-retour Google se fait en fond.
  res.json({ ok: true })
  void handleGcalSyncRequest(payload)
  return
})
