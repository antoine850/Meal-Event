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
import { membersRouter } from './routes/members.js'

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
].filter(Boolean)

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
// All other routes (including SignNow webhook) use JSON parsing
app.use(express.json())

// Health check
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Webhooks (no auth — verified via their own signature mechanisms)
app.use('/api/webhooks', webhooksRouter)

// All other API routes require authentication
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
