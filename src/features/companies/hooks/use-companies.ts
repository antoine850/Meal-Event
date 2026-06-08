import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCurrentOrganizationId } from '@/lib/get-current-org'
import { supabase } from '@/lib/supabase'

export type Company = {
  id: string
  organization_id: string
  name: string
  phone: string | null
  billing_address: string | null
  billing_postal_code: string | null
  billing_city: string | null
  billing_country: string | null
  billing_email: string | null
  siret: string | null
  tva_number: string | null
  created_at: string
  updated_at: string
}

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await (supabase as any)
        .from('companies')
        .select('*')
        .eq('organization_id', orgId)
        .order('name')

      if (error) throw error
      return data as Company[]
    },
  })
}

// Recherche cote serveur : la table depasse la limite PostgREST de 1000 lignes,
// donc un select complet + filtre client raterait la plupart des societes.
// On passe par la RPC search_companies (insensible aux accents via unaccent) avec
// repli sur un ilike simple tant que la migration n'est pas appliquee.
export function useCompanySearch(term: string, enabled = true) {
  return useQuery({
    queryKey: ['companies', 'search', term],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')
      const t = term.trim()

      const rpc = await (supabase as any).rpc('search_companies', {
        search: t,
        org: orgId,
        lim: 50,
      })
      if (!rpc.error) return rpc.data as Company[]

      let query = (supabase as any)
        .from('companies')
        .select('*')
        .eq('organization_id', orgId)
        .order('name')
        .limit(50)
      if (t) query = query.ilike('name', `%${t}%`)

      const { data, error } = await query
      if (error) throw error
      return data as Company[]
    },
    enabled,
  })
}

// Charge toutes les societes en paginant au-dela de la limite de 1000 lignes.
// Pour les pages qui parcourent/exportent l'ensemble (table, CSV).
export function useAllCompanies() {
  return useQuery({
    queryKey: ['companies', 'all'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const all: Company[] = []
      const pageSize = 1000
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await (supabase as any)
          .from('companies')
          .select('*')
          .eq('organization_id', orgId)
          .order('name')
          .range(from, from + pageSize - 1)
        if (error) throw error
        all.push(...((data as Company[]) || []))
        if (!data || data.length < pageSize) break
      }
      return all
    },
  })
}

export function useCompany(id?: string | null) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('companies')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Company
    },
    enabled: !!id,
  })
}

export function useCreateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (company: Partial<Company> & { name: string }) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await (supabase as any)
        .from('companies')
        .insert([{ ...company, organization_id: orgId }])
        .select()
        .single()

      if (error) throw error
      return data as Company
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

export function useUpdateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Company> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('companies')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Company
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      // les vues facturation lisent la societe via le contact
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-for-quote'] })
    },
  })
}

export function useDeleteCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('companies')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}
