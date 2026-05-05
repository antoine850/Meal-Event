import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useIsOrgAdmin() {
  return useQuery({
    queryKey: ['is-org-admin'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      const { data } = await supabase
        .from('users')
        .select('roles(slug)')
        .eq('id', user.id)
        .single()
      const slug = (data?.roles as any)?.slug as string | undefined
      return slug === 'admin' || slug === 'superadmin'
    },
    staleTime: 5 * 60 * 1000,
  })
}
