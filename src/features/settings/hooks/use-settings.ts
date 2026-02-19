import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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

// ============================================
// Organization
// ============================================

export type Organization = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  siret: string | null
  tva_number: string | null
  created_at: string
  updated_at: string
}

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single()

      if (error) throw error
      return data as Organization
    },
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('organizations')
        .update(updates as never)
        .eq('id', orgId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] })
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
    },
  })
}

// ============================================
// Restaurants
// ============================================

export type Restaurant = {
  id: string
  organization_id: string
  name: string
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  phone: string | null
  email: string | null
  color: string | null
  logo_url: string | null
  is_active: boolean
  language: string | null
  translation_language: string | null
  currency: string | null
  siret: string | null
  tva_number: string | null
  website: string | null
  instagram: string | null
  facebook: string | null
  notification_emails: string[] | null
  recap_emails: string[] | null
  cc_export_emails: string[] | null
  event_reminder_enabled: boolean
  email_signature_enabled: boolean
  email_signature_text: string | null
  email_tracking_enabled: boolean
  client_portal_background_url: string | null
  sms_name: string | null
  sms_signature: string | null
  sms_signature_en: string | null
  company_name: string | null
  legal_form: string | null
  siren: string | null
  rcs: string | null
  share_capital: string | null
  billing_email: string | null
  billing_phone: string | null
  billing_address: string | null
  billing_postal_code: string | null
  billing_city: string | null
  billing_country: string | null
  billing_additional_text: string | null
  iban: string | null
  bic: string | null
  invoice_prefix: string | null
  quote_validity_days: number
  invoice_due_days: number | null
  payment_balance_days: number | null
  created_at: string
  updated_at: string
}

export function useRestaurants() {
  return useQuery({
    queryKey: ['settings-restaurants'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('organization_id', orgId)
        .order('name', { ascending: true })

      if (error) throw error
      return data as Restaurant[]
    },
  })
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100)
}

export function useCreateRestaurant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (restaurant: Partial<Restaurant>) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const slug = generateSlug(restaurant.name || 'restaurant') + '-' + Date.now().toString(36)

      const { data, error } = await supabase
        .from('restaurants')
        .insert({ ...restaurant, organization_id: orgId, slug } as never)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-restaurants'] })
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
    },
  })
}

export function useUpdateRestaurant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Restaurant> & { id: string }) => {
      const { data, error } = await supabase
        .from('restaurants')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-restaurants'] })
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
    },
  })
}

export function useDeleteRestaurant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-restaurants'], refetchType: 'all' })
      queryClient.invalidateQueries({ queryKey: ['restaurants'], refetchType: 'all' })
    },
  })
}

// ============================================
// Spaces
// ============================================

export type Space = {
  id: string
  organization_id: string
  restaurant_id: string | null
  name: string
  capacity: number | null
  description: string | null
  is_active: boolean
  created_at: string
}

export function useSpaces(restaurantId?: string) {
  return useQuery({
    queryKey: ['settings-spaces', restaurantId],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      let query = supabase
        .from('spaces')
        .select('*, restaurant:restaurants(id, name)')
        .eq('organization_id', orgId)
        .eq('is_active', true)

      if (restaurantId) {
        query = query.eq('restaurant_id', restaurantId)
      }

      const { data, error } = await query.order('name', { ascending: true })

      if (error) throw error
      return data as (Space & { restaurant: { id: string; name: string } | null })[]
    },
  })
}

export function useCreateSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (space: Partial<Space>) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('spaces')
        .insert({ ...space, organization_id: orgId } as never)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-spaces'] })
    },
  })
}

export function useUpdateSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Space> & { id: string }) => {
      const { data, error } = await supabase
        .from('spaces')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-spaces'] })
    },
  })
}

export function useDeleteSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('spaces')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-spaces'] })
    },
  })
}

// ============================================
// Statuses
// ============================================

export type Status = {
  id: string
  organization_id: string
  name: string
  slug: string
  color: string | null
  type: 'contact' | 'booking'
  position: number
  is_default: boolean
  created_at: string
}

export function useStatuses(type?: 'contact' | 'booking') {
  return useQuery({
    queryKey: ['settings-statuses', type],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      let query = supabase
        .from('statuses')
        .select('*')
        .eq('organization_id', orgId)
        .order('position', { ascending: true })

      if (type) {
        query = query.eq('type', type)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Status[]
    },
  })
}

export function useCreateStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (status: Partial<Status>) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('statuses')
        .insert({ ...status, organization_id: orgId } as never)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-statuses'] })
      queryClient.invalidateQueries({ queryKey: ['contact-statuses'] })
      queryClient.invalidateQueries({ queryKey: ['booking-statuses'] })
    },
  })
}

export function useUpdateStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Status> & { id: string }) => {
      const { data, error } = await supabase
        .from('statuses')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-statuses'] })
      queryClient.invalidateQueries({ queryKey: ['contact-statuses'] })
      queryClient.invalidateQueries({ queryKey: ['booking-statuses'] })
    },
  })
}

export function useDeleteStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('statuses')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-statuses'] })
      queryClient.invalidateQueries({ queryKey: ['contact-statuses'] })
      queryClient.invalidateQueries({ queryKey: ['booking-statuses'] })
    },
  })
}
