import { createFileRoute } from '@tanstack/react-router'
import { TimeSlotsPage } from '@/features/settings/time-slots/page'

export const Route = createFileRoute('/_authenticated/settings/time-slots')({
  component: TimeSlotsPage,
})
