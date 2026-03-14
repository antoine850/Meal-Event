import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/get-current-org'
import { apiClient } from '@/lib/api-client'

export type MemberRole = {
  id: string
  name: string
  slug: string
  description?: string | null
}

export type Member = {
  id: string
  email: string
  first_name: string
  last_name: string | null
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  role: MemberRole | null
  user_restaurants: { restaurant_id: string }[]
}

export type Invitation = {
  id: string
  email: string
  status: string
  restaurant_ids: string[]
  created_at: string
  expires_at: string
  role: MemberRole | null
  invited_by_user: { first_name: string; last_name: string | null } | null
}

// ─── READ hooks: use Supabase directly (like all other settings hooks) ───

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      // Fetch members with role and restaurants
      const { data: members, error: membersError } = await supabase
        .from('users')
        .select(`
          id, email, first_name, last_name, phone, avatar_url, is_active, created_at,
          role:roles(id, name, slug),
          user_restaurants(restaurant_id)
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true })

      if (membersError) throw membersError

      // Fetch pending invitations (cast to any because 'invitations' table may not be in generated types)
      const { data: invitations, error: invError } = await (supabase as any)
        .from('invitations')
        .select(`
          id, email, status, restaurant_ids, created_at, expires_at,
          role:roles(id, name, slug),
          invited_by_user:users!invitations_invited_by_fkey(first_name, last_name)
        `)
        .eq('organization_id', orgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (invError) throw invError

      return {
        members: (members || []) as Member[],
        invitations: (invitations || []) as unknown as Invitation[],
      }
    },
  })
}

export function useOrgRoles() {
  return useQuery({
    queryKey: ['org-roles'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('roles')
        .select('id, name, slug, description')
        .eq('organization_id', orgId)
        .order('slug')

      if (error) throw error
      return (data || []) as MemberRole[]
    },
  })
}

// ─── WRITE hooks: use apiClient (backend needed for email sending, admin checks) ───

export function useInviteMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { email: string; role_id: string; restaurant_ids?: string[] }) =>
      apiClient('/api/members/invite', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; role_id?: string; restaurant_ids?: string[] }) =>
      apiClient(`/api/members/${id}/role`, { method: 'PATCH', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/members/invitations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

export function useResendInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/members/invitations/${id}/resend`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}
