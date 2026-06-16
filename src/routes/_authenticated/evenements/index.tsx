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
  fromSign: z.string().optional().catch(undefined),
  toSign: z.string().optional().catch(undefined),
  fromImport: z.string().optional().catch(undefined),
  toImport: z.string().optional().catch(undefined),
  // Drill-down depuis le dashboard
  signed: z.enum(['1']).optional().catch(undefined), // n'afficher que les événements signés
  stale: z.enum(['1']).optional().catch(undefined), // propositions sans réponse >3j
  source: z.string().optional().catch(undefined), // source du contact (Instagram, Site web…)
  allDates: z.enum(['1']).optional().catch(undefined), // drill-down dashboard : ignore le défaut "à venir"
  view: z.enum(['calendar', 'list', 'pipeline']).optional().catch('list'),
  calendarMode: z.enum(['month', 'week', 'day']).optional().catch('week'),
})

export const Route = createFileRoute('/_authenticated/evenements/')({
  validateSearch: reservationsSearchSchema,
  component: Reservations,
})
