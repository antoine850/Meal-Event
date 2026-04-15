import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import {
  getAuthUrl,
  handleOAuthCallback,
  listCalendars,
  disconnectCalendar,
} from '../lib/google-calendar.js'

export const googleCalendarRouter = Router()

// Public router: contains only the OAuth callback (no auth required — redirect from Google)
export const googleCalendarPublicRouter = Router()

// ============================================
// Helper: verify restaurant belongs to user's org
// ============================================
async function verifyRestaurantAccess(req: Request, restaurantId: string): Promise<boolean> {
  const user = (req as any).user
  if (!user?.id) return false

  // Get user's organization_id from the users table
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) return false

  // Check restaurant belongs to that org
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('organization_id', userData.organization_id)
    .single()

  return !!restaurant
}

// ============================================
// GET /api/google-calendar/auth-url?restaurant_id=xxx
// Returns the Google OAuth URL to start connection
// ============================================
googleCalendarRouter.get('/auth-url', async (req: Request, res: Response) => {
  try {
    const restaurantId = req.query.restaurant_id as string
    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurant_id is required' })
    }

    if (!await verifyRestaurantAccess(req, restaurantId)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google Calendar integration is not configured' })
    }

    const url = getAuthUrl(restaurantId)
    return res.json({ url })
  } catch (error) {
    console.error('[GCal] Error generating auth URL:', error)
    return res.status(500).json({ error: 'Failed to generate auth URL' })
  }
})

// ============================================
// GET /api/google-calendar/callback
// OAuth callback — exchanges code for tokens (NO AUTH — redirect from Google)
// Mounted on googleCalendarPublicRouter so it bypasses requireAuth middleware.
// ============================================
googleCalendarPublicRouter.get('/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string
    const restaurantId = req.query.state as string
    const error = req.query.error as string

    // Frontend URL to redirect back to
    const frontendBase = process.env.FRONTEND_URL || 'https://app.mealevent.fr'
    const settingsUrl = `${frontendBase}/settings/restaurant/${restaurantId}`

    if (error) {
      console.error('[GCal] OAuth error:', error)
      return res.redirect(`${settingsUrl}?gcal_error=${encodeURIComponent(error)}`)
    }

    if (!code || !restaurantId) {
      return res.redirect(`${settingsUrl}?gcal_error=missing_params`)
    }

    const result = await handleOAuthCallback(code, restaurantId)
    console.log(`[GCal] Connected Google account ${result.email} to restaurant ${restaurantId}`)

    return res.redirect(`${settingsUrl}?gcal_connected=true`)
  } catch (error) {
    console.error('[GCal] OAuth callback error:', error)
    const restaurantId = req.query.state as string
    const frontendBase = process.env.FRONTEND_URL || 'https://app.mealevent.fr'
    return res.redirect(`${frontendBase}/settings/restaurant/${restaurantId}?gcal_error=token_exchange_failed`)
  }
})

// ============================================
// GET /api/google-calendar/calendars?restaurant_id=xxx
// Lists available Google calendars for selection
// ============================================
googleCalendarRouter.get('/calendars', async (req: Request, res: Response) => {
  try {
    const restaurantId = req.query.restaurant_id as string
    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurant_id is required' })
    }

    if (!await verifyRestaurantAccess(req, restaurantId)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const calendars = await listCalendars(restaurantId)
    return res.json({ calendars })
  } catch (error) {
    console.error('[GCal] Error listing calendars:', error)
    return res.status(500).json({ error: 'Failed to list calendars' })
  }
})

// ============================================
// POST /api/google-calendar/select-calendar
// Select which calendar to sync with
// ============================================
googleCalendarRouter.post('/select-calendar', async (req: Request, res: Response) => {
  try {
    const { restaurant_id, calendar_id } = req.body
    if (!restaurant_id || !calendar_id) {
      return res.status(400).json({ error: 'restaurant_id and calendar_id are required' })
    }

    if (!await verifyRestaurantAccess(req, restaurant_id)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const { error } = await supabase
      .from('restaurants')
      .update({
        google_calendar_id: calendar_id,
        google_calendar_sync_enabled: true,
      } as never)
      .eq('id', restaurant_id)

    if (error) throw error

    return res.json({ success: true })
  } catch (error) {
    console.error('[GCal] Error selecting calendar:', error)
    return res.status(500).json({ error: 'Failed to select calendar' })
  }
})

// ============================================
// DELETE /api/google-calendar/disconnect?restaurant_id=xxx
// Disconnects Google Calendar from restaurant
// ============================================
googleCalendarRouter.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const restaurantId = req.query.restaurant_id as string
    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurant_id is required' })
    }

    if (!await verifyRestaurantAccess(req, restaurantId)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await disconnectCalendar(restaurantId)
    return res.json({ success: true })
  } catch (error) {
    console.error('[GCal] Error disconnecting:', error)
    return res.status(500).json({ error: 'Failed to disconnect' })
  }
})

// ============================================
// GET /api/google-calendar/status?restaurant_id=xxx
// Returns the current connection status
// ============================================
googleCalendarRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const restaurantId = req.query.restaurant_id as string
    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurant_id is required' })
    }

    if (!await verifyRestaurantAccess(req, restaurantId)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('google_calendar_id, google_calendar_sync_enabled, google_calendar_email')
      .eq('id', restaurantId)
      .single()

    return res.json({
      connected: !!restaurant?.google_calendar_email,
      sync_enabled: restaurant?.google_calendar_sync_enabled || false,
      email: restaurant?.google_calendar_email || null,
      calendar_id: restaurant?.google_calendar_id || null,
    })
  } catch (error) {
    console.error('[GCal] Error fetching status:', error)
    return res.status(500).json({ error: 'Failed to fetch status' })
  }
})
