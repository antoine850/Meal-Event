import { createFileRoute } from '@tanstack/react-router'
import { StatusesPage } from '@/features/settings/statuses/page'

export const Route = createFileRoute('/_authenticated/settings/statuses')({
  component: StatusesPage,
})
