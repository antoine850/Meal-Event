import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MenuForm, MenuFormField, MenuFormResponse, MenuDimension, MenuDimensionOption } from '@/lib/supabase/types'

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

// ── Types ──

export type MenuFormWithFields = MenuForm & {
  menu_form_fields: MenuFormField[]
}

export type MenuFormFull = MenuForm & {
  menu_form_fields: MenuFormField[]
  menu_form_responses: MenuFormResponse[]
}

// ── Queries ──

export function useMenuFormsByBooking(bookingId: string | null) {
  return useQuery({
    queryKey: ['menu_forms', 'booking', bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('menu_forms') as any)
        .select('*, menu_form_fields(*)') 
        .eq('booking_id', bookingId!)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as MenuFormWithFields[]
    },
  })
}

export function useMenuFormFull(formId: string | null) {
  return useQuery({
    queryKey: ['menu_forms', formId],
    enabled: !!formId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('menu_forms') as any)
        .select('*, menu_form_fields(*), menu_form_responses(*)')
        .eq('id', formId!)
        .single()

      if (error) throw error
      return data as MenuFormFull
    },
  })
}

// Public: fetch form by share token (no auth required)
export function useMenuFormByToken(token: string | null) {
  return useQuery({
    queryKey: ['menu_forms', 'token', token],
    enabled: !!token,
    queryFn: async () => {
      // First fetch the form with fields and responses
      const { data: formData, error: formError } = await (supabase
        .from('menu_forms') as any)
        .select('*, menu_form_fields(*), menu_form_responses(*)')
        .eq('share_token', token!)
        .single()

      if (formError) throw formError

      // Then fetch the booking with contact information
      const { data: bookingData } = await (supabase
        .from('bookings') as any)
        .select(`
          restaurant_id,
          event_date,
          start_time,
          guests_count,
          occasion,
          event_type,
          contacts(
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('id', formData.booking_id)
        .single()

      // Finally fetch the restaurant
      let restaurant = null
      if (bookingData?.restaurant_id) {
        const { data: restaurantData } = await (supabase
          .from('restaurants') as any)
          .select('id, name, color, logo_url, address, city, postal_code, phone, email')
          .eq('id', bookingData.restaurant_id)
          .single()
        restaurant = restaurantData
      }

      return { ...formData, restaurant, booking: bookingData } as MenuFormFull & { restaurant: any; booking: any }
    },
  })
}

// ── Mutations ──

export function useCreateMenuForm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ bookingId, title, guestsCount }: { bookingId: string; title?: string; guestsCount: number }) => {
      const organizationId = await getCurrentOrganizationId()

      const { data, error } = await (supabase
        .from('menu_forms') as any)
        .insert({
          booking_id: bookingId,
          organization_id: organizationId,
          title: title || 'Choix de menu',
          guests_count: guestsCount,
          status: 'draft',
        })
        .select()
        .single()

      if (error) throw error
      return data as MenuForm
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['menu_forms', 'booking', data.booking_id] })
    },
  })
}

export function useUpdateMenuForm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: { id: string } & Partial<MenuForm>) => {
      const { id, ...rest } = updates
      const { data, error } = await (supabase
        .from('menu_forms') as any)
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as MenuForm
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_forms'] })
    },
  })
}

export function useDeleteMenuForm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (formId: string) => {
      const { error } = await (supabase
        .from('menu_forms') as any)
        .delete()
        .eq('id', formId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_forms'] })
    },
  })
}

// ── Field mutations ──

export function useAddMenuFormField() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ menuFormId, label, fieldType, options, isPerPerson, isRequired, sortOrder }: {
      menuFormId: string
      label: string
      fieldType?: string
      options?: string[]
      isPerPerson?: boolean
      isRequired?: boolean
      sortOrder?: number
    }) => {
      const { data, error } = await (supabase
        .from('menu_form_fields') as any)
        .insert({
          menu_form_id: menuFormId,
          label,
          field_type: fieldType || 'select',
          options: JSON.stringify(options || []),
          is_per_person: isPerPerson ?? true,
          is_required: isRequired ?? false,
          sort_order: sortOrder ?? 0,
        })
        .select()
        .single()

      if (error) throw error
      return data as MenuFormField
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_forms'] })
    },
  })
}

export function useUpdateMenuFormField() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: { id: string } & Partial<MenuFormField>) => {
      const { id, ...rest } = updates
      const { data, error } = await (supabase
        .from('menu_form_fields') as any)
        .update(rest)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as MenuFormField
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_forms'] })
    },
  })
}

export function useDeleteMenuFormField() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await (supabase
        .from('menu_form_fields') as any)
        .delete()
        .eq('id', fieldId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_forms'] })
    },
  })
}

// ── Response mutations ──

export function useUpsertMenuFormResponses() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ menuFormId, responses }: {
      menuFormId: string
      responses: { field_id: string; guest_index: number; value: string | null }[]
    }) => {
      // Delete existing responses for this form
      await (supabase
        .from('menu_form_responses') as any)
        .delete()
        .eq('menu_form_id', menuFormId)

      // Insert new responses
      if (responses.length > 0) {
        const { error } = await (supabase
          .from('menu_form_responses') as any)
          .insert(responses.map(r => ({
            menu_form_id: menuFormId,
            field_id: r.field_id,
            guest_index: r.guest_index,
            value: r.value,
          })))

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_forms'] })
    },
  })
}

// Submit form (lock it)
export function useSubmitMenuForm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ formId, clientComment, responses }: {
      formId: string
      clientComment?: string
      responses: { field_id: string; guest_index: number; value: string | null }[]
    }) => {
      // Delete existing responses
      await (supabase
        .from('menu_form_responses') as any)
        .delete()
        .eq('menu_form_id', formId)

      // Insert new responses
      if (responses.length > 0) {
        const { error: respError } = await (supabase
          .from('menu_form_responses') as any)
          .insert(responses.map(r => ({
            menu_form_id: formId,
            field_id: r.field_id,
            guest_index: r.guest_index,
            value: r.value,
          })))

        if (respError) throw respError
      }

      // Update form status to submitted
      const { data, error } = await (supabase
        .from('menu_forms') as any)
        .update({
          status: 'submitted',
          client_comment: clientComment || null,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', formId)
        .select()
        .single()

      if (error) throw error
      return data as MenuForm
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_forms'] })
    },
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// Menu Dimensions: Reusable menu choice templates linked to restaurants
// ══════════════════════════════════════════════════════════════════════════════

export type MenuDimensionWithOptions = MenuDimension & {
  menu_dimension_options: MenuDimensionOption[]
  menu_dimension_restaurants?: { restaurant_id: string }[]
}

// Get all menu dimensions for a specific restaurant
export function useMenuDimensionsByRestaurant(restaurantId: string | null) {
  return useQuery({
    queryKey: ['menu_dimensions', 'restaurant', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: links, error: linksError } = await (supabase
        .from('menu_dimension_restaurants') as any)
        .select('menu_dimension_id')
        .eq('restaurant_id', restaurantId!)

      if (linksError) throw linksError

      const dimensionIds = (links || []).map((l: any) => l.menu_dimension_id)
      if (dimensionIds.length === 0) return []

      const { data, error } = await (supabase
        .from('menu_dimensions') as any)
        .select('*, menu_dimension_options(*)')
        .in('id', dimensionIds)
        .order('name')

      if (error) throw error
      return (data || []) as MenuDimensionWithOptions[]
    },
  })
}

// Get all menu dimensions for the organization
export function useMenuDimensions() {
  return useQuery({
    queryKey: ['menu_dimensions'],
    queryFn: async () => {
      const organizationId = await getCurrentOrganizationId()
      if (!organizationId) return []

      const { data, error } = await (supabase
        .from('menu_dimensions') as any)
        .select('*, menu_dimension_options(*), menu_dimension_restaurants(restaurant_id)')
        .eq('organization_id', organizationId)
        .order('name')

      if (error) throw error
      return (data || []) as MenuDimensionWithOptions[]
    },
  })
}

export function useCreateMenuDimension() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, description, restaurantIds, options }: {
      name: string
      description?: string
      restaurantIds: string[]
      options: { label: string; description?: string }[]
    }) => {
      const organizationId = await getCurrentOrganizationId()

      const { data: dimension, error: dimError } = await (supabase
        .from('menu_dimensions') as any)
        .insert({
          organization_id: organizationId,
          name,
          description: description || null,
        })
        .select()
        .single()

      if (dimError) throw dimError

      if (restaurantIds.length > 0) {
        const { error: linkError } = await (supabase
          .from('menu_dimension_restaurants') as any)
          .insert(restaurantIds.map(rid => ({
            menu_dimension_id: dimension.id,
            restaurant_id: rid,
          })))
        if (linkError) throw linkError
      }

      if (options.length > 0) {
        const { error: optError } = await (supabase
          .from('menu_dimension_options') as any)
          .insert(options.map((opt, idx) => ({
            menu_dimension_id: dimension.id,
            label: opt.label,
            description: opt.description || null,
            sort_order: idx,
          })))
        if (optError) throw optError
      }

      return dimension as MenuDimension
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_dimensions'] })
    },
  })
}

export function useDeleteMenuDimension() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from('menu_dimensions') as any)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_dimensions'] })
    },
  })
}
