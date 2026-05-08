import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '@/features/dashboard'

const dashboardSearchSchema = z.object({
  tab: z
    .enum(['general', 'commercial', 'marketing', 'reservations'])
    .optional()
    .catch(undefined),
  fromEvent: z.string().optional().catch(undefined),
  toEvent: z.string().optional().catch(undefined),
  fromSign: z.string().optional().catch(undefined),
  toSign: z.string().optional().catch(undefined),
  fromImport: z.string().optional().catch(undefined),
  toImport: z.string().optional().catch(undefined),
  restaurants: z.string().optional().catch(undefined),
  statuses: z.string().optional().catch(undefined),
  commercials: z.string().optional().catch(undefined),
  clientType: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/')({
  validateSearch: dashboardSearchSchema,
  component: Dashboard,
})
