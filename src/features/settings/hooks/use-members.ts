import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: () => apiClient<{ members: Member[]; invitations: Invitation[] }>('/api/members'),
  })
}

export function useOrgRoles() {
  return useQuery({
    queryKey: ['org-roles'],
    queryFn: () => apiClient<MemberRole[]>('/api/members/roles'),
  })
}

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
