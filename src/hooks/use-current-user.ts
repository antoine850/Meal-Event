import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type CurrentUser = {
  id: string
  email: string
  first_name: string
  last_name: string | null
  phone: string | null
  avatar_url: string | null
  organization: {
    id: string
    name: string
    slug: string
    logo_url: string | null
  } | null
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          first_name,
          last_name,
          phone,
          avatar_url,
          organization:organizations(id, name, slug, logo_url)
        `)
        .eq('id', user.id)
        .single()

      if (error) throw error
      
      return data as CurrentUser
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
