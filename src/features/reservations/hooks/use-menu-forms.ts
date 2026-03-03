import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MenuForm, MenuFormField, MenuFormResponse } from '@/lib/supabase/types'

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
      const { data, error } = await (supabase
        .from('menu_forms') as any)
        .select('*, menu_form_fields(*), menu_form_responses(*)')
        .eq('share_token', token!)
        .single()

      if (error) throw error
      return data as MenuFormFull
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
