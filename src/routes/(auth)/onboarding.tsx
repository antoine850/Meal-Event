import { createFileRoute } from '@tanstack/react-router'
import { Onboarding } from '@/features/auth/onboarding'

export const Route = createFileRoute('/(auth)/onboarding')({
  component: Onboarding,
})
