import { createFileRoute } from '@tanstack/react-router'
import { AcceptInvite } from '@/features/auth/accept-invite'

export const Route = createFileRoute('/(auth)/accept-invite')({
  component: AcceptInvite,
})
