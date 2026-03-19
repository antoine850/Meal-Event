import { type Request, type Response, type NextFunction } from 'express'
import crypto from 'crypto'
import { supabase } from '../lib/supabase.js'

// ============================================
// Rate limiting (100 req/min per org)
// ============================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 100

function checkRateLimit(orgId: string): { allowed: boolean; limit: number; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(orgId)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW
    rateLimitMap.set(orgId, { count: 1, resetAt })
    return { allowed: true, limit: RATE_LIMIT_MAX, remaining: RATE_LIMIT_MAX - 1, resetAt }
  }

  entry.count++
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count)
  return { allowed: entry.count <= RATE_LIMIT_MAX, limit: RATE_LIMIT_MAX, remaining, resetAt: entry.resetAt }
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key)
  }
}, 5 * 60 * 1000)

// ============================================
// API Key authentication middleware
// ============================================
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  // Extract key from Authorization header or X-API-Key header
  let apiKey: string | undefined

  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer sk_live_')) {
    apiKey = authHeader.slice(7)
  } else {
    apiKey = req.headers['x-api-key'] as string | undefined
  }

  if (!apiKey || !apiKey.startsWith('sk_live_')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API key. Use Authorization: Bearer sk_live_xxx or X-API-Key header.' }
    })
  }

  // Hash the key and look up the organization
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

  const { data: org, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('api_key_hash', keyHash)
    .single()

  if (error || !org) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key.' }
    })
  }

  // Rate limiting
  const rateLimit = checkRateLimit(org.id)
  res.setHeader('X-RateLimit-Limit', rateLimit.limit)
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining)
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetAt / 1000))

  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please retry after the rate limit resets.' }
    })
  }

  // Attach org ID to request
  ;(req as any).organizationId = org.id

  // Update last_used_at (fire & forget)
  supabase
    .from('organizations')
    .update({ api_key_last_used_at: new Date().toISOString() })
    .eq('id', org.id)
    .then(() => {})

  next()
}
