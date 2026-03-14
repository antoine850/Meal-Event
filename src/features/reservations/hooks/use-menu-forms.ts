import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MenuForm, MenuFormField, MenuFormResponse, BookingMenuForm } from '@/lib/supabase/types'

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

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export type MenuFormWithFields = MenuForm & {
  menu_form_fields: MenuFormField[]
  restaurants?: { id: string; name: string } | null
}

export type MenuFormFull = MenuForm & {
  menu_form_fields: MenuFormField[]
}

// Booking-specific menu form link with form details
export type BookingMenuFormWithDetails = BookingMenuForm & {
  menu_forms: MenuFormWithFields
  menu_form_responses?: MenuFormResponse[]
}

// ══════════════════════════════════════════════════════════════════════════════
// MENU FORMS (Reusable templates - Settings > Menus)
// ══════════════════════════════════════════════════════════════════════════════

// Get all menu forms for the organization (for Settings > Menus page)
export function useAllMenuForms() {
  return useQuery({
    queryKey: ['menu_forms', 'all'],
    queryFn: async () => {
      const organizationId = await getCurrentOrganizationId()
      if (!organizationId) return []

      const { data, error } = await (supabase
        .from('menu_forms') as any)
        .select(`
          *,
          menu_form_fields(*),
          restaurants(id, name)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as MenuFormWithFields[]
    },
  })
}

// Get menu forms for a specific restaurant
export function useMenuFormsByRestaurant(restaurantId: string | null) {
  return useQuery({
    queryKey: ['menu_forms', 'restaurant', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const organizationId = await getCurrentOrganizationId()
      if (!organizationId) return []

      const { data, error } = await (supabase
        .from('menu_forms') as any)
        .select('*, menu_form_fields(*), restaurants(id, name)')
        .eq('organization_id', organizationId)
        .eq('restaurant_id', restaurantId!)
        .order('title')

      if (error) throw error
      return (data || []) as MenuFormWithFields[]
    },
  })
}

// Get a single menu form with fields
export function useMenuFormFull(formId: string | null) {
  return useQuery({
    queryKey: ['menu_forms', formId],
    enabled: !!formId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('menu_forms') as any)
        .select('*, menu_form_fields(*)')
        .eq('id', formId!)
        .single()

      if (error) throw error
      return data as MenuFormFull
    },
  })
}

// Create a new reusable menu form
export function useCreateMenuForm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ title, description, restaurantId }: { 
      title: string
      description?: string
      restaurantId?: string | null
    }) => {
      const organizationId = await getCurrentOrganizationId()

      const { data, error } = await (supabase
        .from('menu_forms') as any)
        .insert({
          organization_id: organizationId,
          restaurant_id: restaurantId || null,
          title: title || 'Choix de menu',
          description: description || null,
        })
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

// Update a menu form
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

// Delete a menu form
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

// ══════════════════════════════════════════════════════════════════════════════
// BOOKING MENU FORMS (Event-specific links - Page Événement > Tab Menu)
// ══════════════════════════════════════════════════════════════════════════════

// Get all menu forms linked to a booking
export function useBookingMenuForms(bookingId: string | null) {
  return useQuery({
    queryKey: ['booking_menu_forms', 'booking', bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('booking_menu_forms') as any)
        .select(`
          *,
          menu_forms(*, menu_form_fields(*))
        `)
        .eq('booking_id', bookingId!)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as BookingMenuFormWithDetails[]
    },
  })
}

// Link a menu form to a booking
export function useLinkMenuFormToBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ bookingId, menuFormId, guestsCount }: { 
      bookingId: string
      menuFormId: string
      guestsCount: number
    }) => {
      const { data, error } = await (supabase
        .from('booking_menu_forms') as any)
        .insert({
          booking_id: bookingId,
          menu_form_id: menuFormId,
          guests_count: guestsCount,
          status: 'draft',
        })
        .select(`*, menu_forms(*, menu_form_fields(*))`)
        .single()

      if (error) throw error
      return data as BookingMenuFormWithDetails
    },
    onSuccess: (_, { bookingId }) => {
      queryClient.invalidateQueries({ queryKey: ['booking_menu_forms', 'booking', bookingId] })
    },
  })
}

// Update a booking menu form (status, guests_count, etc.)
export function useUpdateBookingMenuForm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: { id: string; bookingId: string } & Partial<BookingMenuForm>) => {
      const { id, bookingId, ...rest } = updates
      const { data, error } = await (supabase
        .from('booking_menu_forms') as any)
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { ...data, bookingId } as BookingMenuForm & { bookingId: string }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking_menu_forms', 'booking', data.bookingId] })
      queryClient.invalidateQueries({ queryKey: ['booking_menu_forms', 'token'] })
    },
  })
}

// Unlink a menu form from a booking
export function useUnlinkMenuFormFromBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, bookingId }: { id: string; bookingId: string }) => {
      const { error } = await (supabase
        .from('booking_menu_forms') as any)
        .delete()
        .eq('id', id)

      if (error) throw error
      return { bookingId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking_menu_forms', 'booking', data.bookingId] })
    },
  })
}

// Public: fetch booking menu form by share token (for client access)
export function useBookingMenuFormByToken(token: string | null) {
  return useQuery({
    queryKey: ['booking_menu_forms', 'token', token],
    enabled: !!token,
    queryFn: async () => {
      // Fetch the booking_menu_form with form and fields
      const { data: bmfData, error: bmfError } = await (supabase
        .from('booking_menu_forms') as any)
        .select(`
          *,
          menu_forms(*, menu_form_fields(*))
        `)
        .eq('share_token', token!)
        .single()

      if (bmfError) throw bmfError

      // Fetch responses for this booking_menu_form
      const { data: responses } = await (supabase
        .from('menu_form_responses') as any)
        .select('*')
        .eq('booking_menu_form_id', bmfData.id)

      // Fetch the booking with contact information
      const { data: bookingData } = await (supabase
        .from('bookings') as any)
        .select(`
          restaurant_id,
          event_date,
          start_time,
          guests_count,
          occasion,
          event_type,
          contacts(first_name, last_name, email, phone)
        `)
        .eq('id', bmfData.booking_id)
        .single()

      // Fetch the restaurant
      let restaurant = null
      if (bookingData?.restaurant_id) {
        const { data: restaurantData } = await (supabase
          .from('restaurants') as any)
          .select('id, name, color, logo_url, address, city, postal_code, phone, email')
          .eq('id', bookingData.restaurant_id)
          .single()
        restaurant = restaurantData
      }

      return { 
        ...bmfData, 
        menu_form_responses: responses || [],
        restaurant, 
        booking: bookingData 
      } as BookingMenuFormWithDetails & { restaurant: any; booking: any }
    },
  })
}

// Submit booking menu form (client submission)
export function useSubmitBookingMenuForm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ bookingMenuFormId, clientComment, responses }: {
      bookingMenuFormId: string
      clientComment?: string
      responses: { field_id: string; guest_index: number; value: string | null }[]
    }) => {
      // Delete existing responses for this booking_menu_form
      await (supabase
        .from('menu_form_responses') as any)
        .delete()
        .eq('booking_menu_form_id', bookingMenuFormId)

      // Insert new responses
      if (responses.length > 0) {
        const { error: respError } = await (supabase
          .from('menu_form_responses') as any)
          .insert(responses.map(r => ({
            booking_menu_form_id: bookingMenuFormId,
            field_id: r.field_id,
            guest_index: r.guest_index,
            value: r.value,
          })))

        if (respError) throw respError
      }

      // Update booking_menu_form status to submitted
      const { data, error } = await (supabase
        .from('booking_menu_forms') as any)
        .update({
          status: 'submitted',
          client_comment: clientComment || null,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingMenuFormId)
        .select()
        .single()

      if (error) throw error
      return data as BookingMenuForm
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking_menu_forms'] })
    },
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// FIELD MUTATIONS
// ══════════════════════════════════════════════════════════════════════════════

export function useAddMenuFormField() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ menuFormId, label, fieldType, options, isPerPerson, isRequired, sortOrder }: {
      menuFormId: string
      label: string
      fieldType?: string
      options?: { label: string; description?: string }[]
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
