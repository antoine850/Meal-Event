import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Contacts } from '@/features/contacts'

const contactsSearchSchema = z.object({
  q: z.string().optional().catch(''),
  status: z.string().optional().catch(undefined),
  commercial: z.string().optional().catch(undefined),
  restaurant: z.string().optional().catch(undefined),
  company: z.string().optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  view: z.enum(['table', 'kanban', 'cards']).optional().catch('table'),
})

export const Route = createFileRoute('/_authenticated/tasks/')({
  validateSearch: contactsSearchSchema,
  component: Contacts,
})
