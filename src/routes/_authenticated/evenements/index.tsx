import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Reservations } from '@/features/reservations'

const reservationsSearchSchema = z.object({
  q: z.string().optional().catch(''),
  commercial: z.string().optional().catch(undefined),
  restaurant: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  view: z.enum(['calendar', 'list']).optional().catch('calendar'),
  calendarMode: z.enum(['month', 'week', 'day']).optional().catch('week'),
})

export const Route = createFileRoute('/_authenticated/evenements/')({
  validateSearch: reservationsSearchSchema,
  component: Reservations,
})
