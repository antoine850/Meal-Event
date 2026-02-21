import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Quote, Payment } from '@/lib/supabase/types'

export type BookingWithRelations = {
  id: string
  organization_id: string | null
  restaurant_id: string | null
  contact_id: string | null
  status_id: string | null
  assigned_to: string | null
  space_id: string | null
  time_slot_id: string | null
  event_type: string | null
  occasion: string | null
  option: string | null
  relance: string | null
  source: string | null
  event_date: string
  start_time: string | null
  end_time: string | null
  guests_count: number | null
  total_amount: number
  deposit_amount: number
  deposit_percentage: number
  is_table_blocked: boolean
  has_extra_provider: boolean
  internal_notes: string | null
  client_notes: string | null
  special_requests: string | null
  notion_url: string | null
  is_date_flexible: boolean
  is_restaurant_flexible: boolean
  client_preferred_time: string | null
  menu_aperitif: string | null
  menu_entree: string | null
  menu_plat: string | null
  menu_dessert: string | null
  menu_boissons: string | null
  menu_details: unknown | null
  mise_en_place: string | null
  deroulement: string | null
  is_privatif: boolean
  allergies_regimes: string | null
  prestations_souhaitees: string | null
  budget_client: number | null
  format_souhaite: string | null
  contact_sur_place_nom: string | null
  contact_sur_place_tel: string | null
  contact_sur_place_societe: string | null
  instructions_speciales: string | null
  commentaires: string | null
  date_signature_devis: string | null
  assigned_user_ids: string[] | null
  created_at: string
  updated_at: string
  restaurant?: { id: string; name: string; color: string | null } | null
  contact?: { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; company?: { id: string; name: string } | null } | null
  status?: { id: string; name: string; color: string; slug: string } | null
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

export function useBookings() {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          restaurant:restaurants(id, name, color),
          contact:contacts(id, first_name, last_name, email, phone, company:companies(id, name)),
          status:statuses(id, name, color, slug),
          assigned_user:users!bookings_assigned_to_fkey(id, first_name, last_name)
        `)
        .eq('organization_id', orgId)
        .order('event_date', { ascending: true })

      if (error) throw error
      return data as BookingWithRelations[]
    },
  })
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          restaurant:restaurants(id, name, color),
          contact:contacts(id, first_name, last_name, email, phone, company:companies(id, name)),
          status:statuses(id, name, color, slug),
          assigned_user:users!bookings_assigned_to_fkey(id, first_name, last_name)
        `)
        .eq('id', id)
        .eq('organization_id', orgId)
        .single()

      if (error) throw error
      return data as BookingWithRelations
    },
    enabled: !!id,
  })
}

export function useBookingsByContact(contactId: string | null | undefined) {
  return useQuery({
    queryKey: ['bookings', 'contact', contactId],
    queryFn: async () => {
      if (!contactId) return []

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          restaurant:restaurants(id, name, color),
          status:statuses(id, name, color, slug),
          assigned_user:users!bookings_assigned_to_fkey(id, first_name, last_name)
        `)
        .eq('contact_id', contactId)
        .order('event_date', { ascending: false })

      if (error) throw error
      return data as BookingWithRelations[]
    },
    enabled: !!contactId,
  })
}

export function useBookingStatuses() {
  return useQuery({
    queryKey: ['booking-statuses'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('statuses')
        .select('*')
        .eq('organization_id', orgId)
        .eq('type', 'booking')
        .order('position', { ascending: true })

      if (error) throw error
      return data as { id: string; name: string; slug: string; color: string; position: number }[]
    },
  })
}

export function useRestaurants() {
  return useQuery({
    queryKey: ['restaurants'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, color')
        .eq('organization_id', orgId)
        .order('name', { ascending: true })

      if (error) throw error
      return data as { id: string; name: string; color: string | null }[]
    },
  })
}

export function useCreateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (booking: Partial<BookingWithRelations>) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({ ...booking, organization_id: orgId } as never)
        .select()
        .single()

      if (bookingError) throw bookingError
      if (!bookingData) throw new Error('Booking creation failed')

      return bookingData
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

export function useUpdateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BookingWithRelations> & { id: string }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

export function useDeleteBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

export function useDuplicateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sourceBooking: BookingWithRelations) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          organization_id: orgId,
          restaurant_id: sourceBooking.restaurant_id,
          contact_id: sourceBooking.contact_id,
          status_id: sourceBooking.status_id,
          assigned_to: sourceBooking.assigned_to,
          space_id: sourceBooking.space_id,
          occasion: sourceBooking.occasion,
          option: sourceBooking.option,
          source: sourceBooking.source,
          event_date: sourceBooking.event_date,
          start_time: sourceBooking.start_time,
          end_time: sourceBooking.end_time,
          guests_count: sourceBooking.guests_count,
          is_table_blocked: sourceBooking.is_table_blocked,
          has_extra_provider: sourceBooking.has_extra_provider,
          is_date_flexible: sourceBooking.is_date_flexible,
          is_restaurant_flexible: sourceBooking.is_restaurant_flexible,
          client_preferred_time: sourceBooking.client_preferred_time,
          menu_aperitif: sourceBooking.menu_aperitif,
          menu_entree: sourceBooking.menu_entree,
          menu_plat: sourceBooking.menu_plat,
          menu_dessert: sourceBooking.menu_dessert,
          menu_boissons: sourceBooking.menu_boissons,
          mise_en_place: sourceBooking.mise_en_place,
          deroulement: sourceBooking.deroulement,
          is_privatif: sourceBooking.is_privatif,
          allergies_regimes: sourceBooking.allergies_regimes,
          prestations_souhaitees: sourceBooking.prestations_souhaitees,
          budget_client: sourceBooking.budget_client,
          format_souhaite: sourceBooking.format_souhaite,
          contact_sur_place_nom: sourceBooking.contact_sur_place_nom,
          contact_sur_place_tel: sourceBooking.contact_sur_place_tel,
          contact_sur_place_societe: sourceBooking.contact_sur_place_societe,
          instructions_speciales: sourceBooking.instructions_speciales,
          commentaires: sourceBooking.commentaires,
          date_signature_devis: sourceBooking.date_signature_devis,
          assigned_user_ids: sourceBooking.assigned_user_ids,
          event_type: sourceBooking.event_type,
          internal_notes: sourceBooking.internal_notes,
          total_amount: sourceBooking.total_amount,
          deposit_amount: sourceBooking.deposit_amount,
          relance: sourceBooking.relance,
        } as never)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

export function useQuotesByBooking(bookingId: string) {
  return useQuery<Quote[]>({
    queryKey: ['quotes', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('booking_id', bookingId)

      if (error) throw error
      return (data as Quote[]) || []
    },
    enabled: !!bookingId,
  })
}

export function usePaymentsByBooking(bookingId: string) {
  return useQuery<Payment[]>({
    queryKey: ['payments', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as Payment[]) || []
    },
    enabled: !!bookingId,
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      bookingId,
      quoteId,
      amount,
      paymentType,
      paymentMethod,
      status,
      paidAt,
      notes,
      file,
    }: {
      bookingId: string
      quoteId?: string
      amount: number
      paymentType: string
      paymentMethod?: string
      status: string
      paidAt?: string
      notes?: string
      file?: File
    }) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      let attachmentUrl: string | null = null
      let attachmentPath: string | null = null

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        attachmentPath = `${orgId}/payments/${bookingId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(attachmentPath, file)

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(attachmentPath)

        attachmentUrl = publicUrlData.publicUrl
      }

      const { data, error } = await supabase
        .from('payments')
        .insert({
          organization_id: orgId,
          booking_id: bookingId,
          quote_id: quoteId || null,
          amount,
          payment_type: paymentType,
          payment_method: paymentMethod || null,
          status,
          paid_at: paidAt || null,
          notes: notes || null,
          attachment_url: attachmentUrl,
          attachment_path: attachmentPath,
        } as never)
        .select()
        .single()

      if (error) throw error
      return data as Payment
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments', data.booking_id] })
    },
  })
}

export function useUpdatePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      bookingId,
      amount,
      paymentType,
      paymentMethod,
      status,
      paidAt,
      notes,
      file,
      removeAttachment,
      currentAttachmentPath,
    }: {
      id: string
      bookingId: string
      amount?: number
      paymentType?: string
      paymentMethod?: string
      status?: string
      paidAt?: string | null
      notes?: string | null
      file?: File
      removeAttachment?: boolean
      currentAttachmentPath?: string | null
    }) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const updates: Record<string, unknown> = {}
      if (amount !== undefined) updates.amount = amount
      if (paymentType !== undefined) updates.payment_type = paymentType
      if (paymentMethod !== undefined) updates.payment_method = paymentMethod
      if (status !== undefined) updates.status = status
      if (paidAt !== undefined) updates.paid_at = paidAt
      if (notes !== undefined) updates.notes = notes

      // Handle file upload
      if (file) {
        // Delete old file if exists
        if (currentAttachmentPath) {
          await supabase.storage.from('documents').remove([currentAttachmentPath])
        }

        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const attachmentPath = `${orgId}/payments/${bookingId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(attachmentPath, file)

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(attachmentPath)

        updates.attachment_url = publicUrlData.publicUrl
        updates.attachment_path = attachmentPath
      } else if (removeAttachment && currentAttachmentPath) {
        // Remove attachment without replacing
        await supabase.storage.from('documents').remove([currentAttachmentPath])
        updates.attachment_url = null
        updates.attachment_path = null
      }

      const { data, error } = await supabase
        .from('payments')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { payment: data as Payment, bookingId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments', data.bookingId] })
    },
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, bookingId }: { id: string; bookingId: string }) => {
      const { error } = await supabase.from('payments').delete().eq('id', id)
      if (error) throw error
      return { bookingId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments', data.bookingId] })
    },
  })
}

