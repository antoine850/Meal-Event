import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCurrentOrganizationId } from '@/lib/get-current-org'
import { supabase } from '@/lib/supabase'
import type { Contact } from '@/lib/supabase/types'

export type ContactWithRelations = Contact & {
  company?: { id: string; name: string } | null
  assigned_user?: { id: string; first_name: string; last_name: string } | null
}

const contactSelect = `
          *,
          company:companies(id, name, billing_address, billing_city, billing_postal_code, siret, tva_number),
          assigned_user:users!contacts_assigned_to_fkey(id, first_name, last_name)
        `

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('contacts')
        .select(contactSelect)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ContactWithRelations[]
    },
  })
}

// Recherche cote serveur : la table depasse la limite PostgREST de 1000 lignes,
// donc le filtre client sur useContacts() rate la plupart des fiches.
// RPC search_contacts (insensible aux accents/espaces via unaccent, cherche aussi
// le nom de societe) avec repli sur un ilike simple tant que la migration
// n'est pas appliquee.
export function useContactSearch(term: string, enabled = true) {
  return useQuery({
    queryKey: ['contacts', 'search', term],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')
      const t = term.trim()

      const rpc = await (supabase as any).rpc('search_contacts', {
        search: t,
        org: orgId,
        lim: 50,
      })
      if (!rpc.error) {
        const ids = ((rpc.data as { id: string }[]) || []).map((c) => c.id)
        if (!ids.length) return [] as ContactWithRelations[]
        const { data, error } = await supabase
          .from('contacts')
          .select(contactSelect)
          .in('id', ids)
          .order('first_name')
        if (error) throw error
        return data as ContactWithRelations[]
      }

      let query = supabase
        .from('contacts')
        .select(contactSelect)
        .eq('organization_id', orgId)
        .order('first_name')
        .limit(50)
      if (t) {
        const like = `%${t.replace(/["\\]/g, '')}%`
        query = query.or(
          `first_name.ilike."${like}",last_name.ilike."${like}",email.ilike."${like}"`
        )
      }
      const { data, error } = await query
      if (error) throw error
      return data as ContactWithRelations[]
    },
    enabled,
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
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Contact> & { id: string }) => {
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
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('contacts')
        .select(
          `
          *,
          company:companies(id, name, billing_address, billing_city, billing_postal_code, siret, tva_number),
          assigned_user:users!contacts_assigned_to_fkey(id, first_name, last_name)
        `
        )
        .eq('id', id)
        .eq('organization_id', orgId)
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
      const { error } = await supabase.from('contacts').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}
