import { Router, type Request, type Response } from 'express'
import {
  getGmailAuthUrl,
  handleGmailCallback,
  getGmailAccountStatus,
  disconnectGmail,
} from '../lib/gmail.js'

export const gmailRouter = Router()
export const gmailPublicRouter = Router()

// Flag d'activation phase 1 : tant qu'il n'est pas 'true', le flux de connexion
// est eteint (Google Cloud pas encore configure).
function integrationEnabled(): boolean {
  return process.env.GMAIL_INTEGRATION_ENABLED === 'true'
}

// GET /api/gmail/auth-url — genere l'URL de consentement pour l'utilisateur courant.
gmailRouter.get('/auth-url', async (req: Request, res: Response) => {
  try {
    if (!integrationEnabled()) {
      return res.status(503).json({ error: 'Gmail integration disabled' })
    }
    const userId = (req as any).user?.id as string | undefined
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' })
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GMAIL_REDIRECT_URI) {
      return res.status(500).json({ error: 'Gmail integration is not configured' })
    }
    return res.json({ url: getGmailAuthUrl(userId) })
  } catch (error) {
    console.error('[Gmail] auth-url error:', error)
    return res.status(500).json({ error: 'Failed to generate auth URL' })
  }
})

// GET /api/gmail/status — statut de connexion de l'utilisateur courant.
gmailRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' })
    return res.json(await getGmailAccountStatus(userId))
  } catch (error) {
    console.error('[Gmail] status error:', error)
    return res.status(500).json({ error: 'Failed to get status' })
  }
})

// DELETE /api/gmail/disconnect — deconnecte le compte de l'utilisateur courant.
gmailRouter.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' })
    await disconnectGmail(userId)
    return res.json({ success: true })
  } catch (error) {
    console.error('[Gmail] disconnect error:', error)
    return res.status(500).json({ error: 'Failed to disconnect' })
  }
})

// GET /api/gmail/callback — retour OAuth Google (public, pas d'auth).
gmailPublicRouter.get('/callback', async (req: Request, res: Response) => {
  const frontendBase = process.env.FRONTEND_URL || 'https://app.mealevent.fr'
  const settingsUrl = `${frontendBase}/settings/integrations`
  try {
    const code = req.query.code as string
    const state = req.query.state as string
    const error = req.query.error as string

    if (error) return res.redirect(`${settingsUrl}?gmail_error=${encodeURIComponent(error)}`)
    if (!code || !state) return res.redirect(`${settingsUrl}?gmail_error=missing_params`)

    await handleGmailCallback(code, state)
    return res.redirect(`${settingsUrl}?gmail_connected=true`)
  } catch (error) {
    console.error('[Gmail] callback error:', error)
    return res.redirect(`${settingsUrl}?gmail_error=token_exchange_failed`)
  }
})
