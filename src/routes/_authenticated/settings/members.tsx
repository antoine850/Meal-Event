import { createFileRoute } from '@tanstack/react-router'
import { MembersPage } from '@/features/settings/members/page'

export const Route = createFileRoute('/_authenticated/settings/members')({
  component: MembersPage,
})
