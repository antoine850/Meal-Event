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

export type ContactsQueryParams = {
  page: number
  pageSize: number
  search?: string
  commercialIds?: string[]
  companyIds?: string[]
  sources?: string[]
  from?: string // created_at >= ISO
  to?: string // created_at <= ISO
  sort?: { field: string; dir: 'asc' | 'desc' }
}

// Liste paginee cote serveur : la table depasse 1000 lignes, on ne charge donc
// qu'une page a la fois. La recherche passe par le RPC unaccent (ids) puis on
// pagine/compte dans ces ids ; tous les filtres sont appliques en base.
export function useContactsPaged(params: ContactsQueryParams) {
  return useQuery({
    queryKey: ['contacts-paged', params],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) return { rows: [] as ContactWithRelations[], total: 0 }

      const term = params.search?.trim()
      let searchIds: string[] | null = null
      if (term) {
        const rpc = await (supabase as any).rpc('search_contacts', {
          search: term,
          org: orgId,
          lim: 1000,
        })
        if (!rpc.error) {
          searchIds = ((rpc.data as { id: string }[]) || []).map((c) => c.id)
          if (!searchIds.length) return { rows: [], total: 0 }
        }
      }

      let query = supabase
        .from('contacts')
        .select(contactSelect, { count: 'exact' })
        .eq('organization_id', orgId)

      if (searchIds) {
        query = query.in('id', searchIds)
      } else if (term) {
        // repli ilike si la migration RPC n'est pas appliquee
        const like = `%${term.replace(/["\\]/g, '')}%`
        query = query.or(
          `first_name.ilike."${like}",last_name.ilike."${like}",email.ilike."${like}"`
        )
      }
      if (params.commercialIds?.length)
        query = query.in('assigned_to', params.commercialIds)
      if (params.companyIds?.length)
        query = query.in('company_id', params.companyIds)
      if (params.sources?.length) query = query.in('source', params.sources)
      if (params.from) query = query.gte('created_at', params.from)
      if (params.to) query = query.lte('created_at', params.to)

      query = query.order(params.sort?.field ?? 'created_at', {
        ascending: params.sort?.dir === 'asc',
      })
      const from = params.page * params.pageSize
      query = query.range(from, from + params.pageSize - 1)

      const { data, error, count } = await query
      if (error) throw error
      return {
        rows: (data ?? []) as unknown as ContactWithRelations[],
        total: count ?? 0,
      }
    },
    placeholderData: (prev) => prev,
  })
}

// Options des filtres (source / societe). Echantillon borne : suffisant pour
// surfacer les valeurs courantes sans charger toute la table.
export function useContactFacetOptions() {
  return useQuery({
    queryKey: ['contact-facet-options'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId)
        return {
          sources: [] as string[],
          companies: [] as { id: string; name: string }[],
        }

      const { data, error } = await supabase
        .from('contacts')
        .select('source, company:companies(id, name)')
        .eq('organization_id', orgId)
        .limit(1000)
      if (error) throw error

      type FacetRow = {
        source: string | null
        company: { id: string; name: string } | null
      }
      const sources = new Set<string>()
      const companies = new Map<string, string>()
      for (const c of (data ?? []) as unknown as FacetRow[]) {
        if (c.source) sources.add(c.source)
        if (c.company?.id && c.company?.name)
          companies.set(c.company.id, c.company.name)
      }
      return {
        sources: Array.from(sources).sort((a, b) => a.localeCompare(b)),
        companies: Array.from(companies, ([id, name]) => ({ id, name })).sort(
          (a, b) => a.name.localeCompare(b.name)
        ),
      }
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
