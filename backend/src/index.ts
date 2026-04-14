import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'

import { requireAuth } from './lib/auth.js'
import { organizationsRouter } from './routes/organizations.js'
import { restaurantsRouter } from './routes/restaurants.js'
import { contactsRouter } from './routes/contacts.js'
import { bookingsRouter } from './routes/bookings.js'
import { quotesRouter } from './routes/quotes.js'
import { paymentsRouter } from './routes/payments.js'
import { webhooksRouter } from './routes/webhooks.js'
import { membersRouter, membersPublicRouter } from './routes/members.js'
import { publicRouter } from './routes/public.js'
import { apiV1Router } from './routes/api-v1.js'
import { googleCalendarRouter } from './routes/google-calendar.js'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })
dotenv.config() // Fallback to .env if .env.local doesn't exist

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())

// CORS configuration for production
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://mealevent.netlify.app',
  'https://charming-dragon-3e7915.netlify.app',
  'https://app.mealevent.fr',
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean)

// Public API routes have open CORS (embeddable from any restaurant website)
app.use('/api/public', cors({ origin: true, credentials: false }))

// API v1 routes have open CORS (used by third-party integrations)
app.use('/api/v1', cors({ origin: true, credentials: false }))

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
      return callback(null, true)
    }
    console.warn(`CORS blocked origin: ${origin}`)
    return callback(new Error(`Origin ${origin} not allowed by CORS`))
  },
  credentials: true,
}))

// Request logging for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// Stripe webhooks need raw body for signature verification
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }))

// Sanitizing JSON parser for /api/v1 — handles malformed payloads from third-party
// integrations (e.g. Make/n8n sending `"guests_count": +` when the source value is
// a string like "+ de 60 personnes" and parseInt() returns NaN).
app.use('/api/v1', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.headers['content-type']?.includes('application/json')) {
    express.text({ type: 'application/json' })(req, res, () => {
      const raw = (req as express.Request & { text?: string }).text || ''
      if (!raw) return next()
      try {
        // Replace bare + or - (not followed by a digit) used as JSON values
        // e.g. "guests_count": +,  →  "guests_count": null,
        const sanitized = raw
          .replace(/:\s*[+\-](?!\d)/g, ': null')
          .replace(/:\s*NaN\b/g, ': null')
          .replace(/:\s*undefined\b/g, ': null')
        req.body = JSON.parse(sanitized)
        next()
      } catch (err) {
        console.error('[API v1] Failed to parse request body after sanitization:', err)
        res.status(400).json({ error: 'INVALID_JSON', message: 'Request body is not valid JSON' })
      }
    })
  } else {
    next()
  }
})

// All other routes use standard JSON parsing
app.use(express.json())

// Health check
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Public routes (no auth required)
app.use('/api/webhooks', webhooksRouter)
app.use('/api/invitations', membersPublicRouter)
app.use('/api/public', publicRouter)
app.use('/api/v1', apiV1Router)

// Google Calendar OAuth callback (no auth — redirect from Google)
app.get('/api/google-calendar/callback', googleCalendarRouter)

// All other API routes require authentication
app.use('/api/google-calendar', requireAuth, googleCalendarRouter)
app.use('/api/organizations', requireAuth, organizationsRouter)
app.use('/api/restaurants', requireAuth, restaurantsRouter)
app.use('/api/contacts', requireAuth, contactsRouter)
app.use('/api/bookings', requireAuth, bookingsRouter)
app.use('/api/quotes', requireAuth, quotesRouter)
app.use('/api/payments', requireAuth, paymentsRouter)
app.use('/api/members', requireAuth, membersRouter)

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

export default app
