import { type Request, type Response, type NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Express middleware that verifies the Supabase JWT from the Authorization header.
 * Attaches `req.user` with `{ id, email }` on success.
 * Returns 401 if no valid token is found.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }

  const token = authHeader.slice(7)

  try {
    // Create a temporary client with the user's JWT to validate it
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error } = await userClient.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Attach user info to request for downstream handlers
    ;(req as any).user = { id: user.id, email: user.email }
    next()
  } catch {
    return res.status(401).json({ error: 'Authentication failed' })
  }
}
