import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }

    // Check if user has completed onboarding (has a user record in the database)
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('id', session.user.id)
      .single()

    const user = dbUser as { id: string; organization_id: string | null } | null
    if (!user || !user.organization_id) {
      throw redirect({
        to: '/onboarding',
      })
    }

    return { session, dbUser }
  },
  component: AuthenticatedLayout,
})
