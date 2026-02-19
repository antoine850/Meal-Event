import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Contact } from '@/lib/supabase/types'

export type ContactWithRelations = Contact & {
  company?: { id: string; name: string } | null
  assigned_user?: { id: string; first_name: string; last_name: string } | null
}

async function getCurrentOrganizationId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  return (data as { organization_id: string } | null)?.organization_id || null
}

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          company:companies(id, name),
          assigned_user:users!contacts_assigned_to_fkey(id, first_name, last_name)
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ContactWithRelations[]
    },
  })
}


export function useRestaurantsList() {
  return useQuery({
    queryKey: ['restaurants-list'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name', { ascending: true })

      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })
}

export function useOrganizationUsers() {
  return useQuery({
    queryKey: ['organization-users'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('organization_id', orgId)
        .order('first_name', { ascending: true })

      if (error) throw error
      return data as { id: string; first_name: string; last_name: string }[]
    },
  })
}

export function useCreateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contact: Partial<Contact>) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('contacts')
        .insert({ ...contact, organization_id: orgId } as never)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: string }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          company:companies(id, name),
          assigned_user:users!contacts_assigned_to_fkey(id, first_name, last_name),
          restaurant:restaurants(id, name)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as ContactWithRelations
    },
    enabled: !!id,
  })
}

export function useDeleteContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}
