import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(auth)')({
  beforeLoad: async ({ context }) => {
    // If user is already authenticated and has completed onboarding, redirect to dashboard
    // This will be handled by the auth context
  },
  component: AuthLayout,
})

function AuthLayout() {
  return <Outlet />
}
