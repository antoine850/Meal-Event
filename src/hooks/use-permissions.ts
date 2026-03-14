import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/get-current-org'

export type UserPermissions = {
  role: { id: string; name: string; slug: string } | null
  permissions: string[]
  restaurantIds: string[]
  isAdmin: boolean
  isCommercial: boolean
  isGerant: boolean
}

export function usePermissions(): UserPermissions & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // Get user with role
      const { data: dbUser } = await supabase
        .from('users')
        .select(`
          role_id,
          role:roles(id, name, slug),
          user_restaurants(restaurant_id)
        `)
        .eq('id', user.id)
        .single()

      if (!dbUser) return null

      const userData = dbUser as any
      const roleId = userData.role_id

      // Get permissions for this role
      let permissions: string[] = []
      if (roleId) {
        const { data: rolePerms } = await supabase
          .from('role_permissions')
          .select('permission:permissions(slug)')
          .eq('role_id', roleId)

        permissions = (rolePerms || [])
          .map((rp: any) => rp.permission?.slug)
          .filter(Boolean) as string[]
      }

      const roleSlug = userData.role?.slug || ''
      const restaurantIds = (userData.user_restaurants || []).map((ur: any) => ur.restaurant_id).filter(Boolean)

      return {
        role: userData.role || null,
        permissions,
        restaurantIds,
        isAdmin: roleSlug === 'admin',
        isCommercial: roleSlug === 'commercial',
        isGerant: roleSlug === 'gerant',
      } as UserPermissions
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    role: data?.role || null,
    permissions: data?.permissions || [],
    restaurantIds: data?.restaurantIds || [],
    isAdmin: data?.isAdmin || false,
    isCommercial: data?.isCommercial || false,
    isGerant: data?.isGerant || false,
    isLoading,
  }
}

export function hasPermission(permissions: string[], slug: string): boolean {
  return permissions.includes(slug)
}
