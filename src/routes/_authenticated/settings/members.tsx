import { createFileRoute } from '@tanstack/react-router'
import { MembersSettings } from '@/features/settings/members'

export const Route = createFileRoute('/_authenticated/settings/members')({
  component: MembersSettings,
})
