import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'

import { organizationsRouter } from './routes/organizations.js'
import { restaurantsRouter } from './routes/restaurants.js'
import { contactsRouter } from './routes/contacts.js'
import { bookingsRouter } from './routes/bookings.js'
import { quotesRouter } from './routes/quotes.js'
import { paymentsRouter } from './routes/payments.js'
import { webhooksRouter } from './routes/webhooks.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))

// Webhooks need raw body for signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }))
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/organizations', organizationsRouter)
app.use('/api/restaurants', restaurantsRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/quotes', quotesRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/webhooks', webhooksRouter)

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

export default app
