import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '@/features/dashboard'

const dashboardSearchSchema = z.object({
  tab: z
    .enum(['general', 'commercial', 'marketing', 'reservations'])
    .optional()
    .catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  restaurants: z.string().optional().catch(undefined),
  statuses: z.string().optional().catch(undefined),
  commercials: z.string().optional().catch(undefined),
  clientType: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/')({
  validateSearch: dashboardSearchSchema,
  component: Dashboard,
})
