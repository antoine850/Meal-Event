import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Quote, Payment } from '@/lib/supabase/types'

export type BookingEventRow = {
  id: string
  booking_id: string | null
  space_id: string | null
  name: string
  event_date: string
  start_time: string | null
  end_time: string | null
  guests_count: number | null
  occasion: string | null
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
  created_at: string
  updated_at: string
  space?: { id: string; name: string } | null
}

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
  created_at: string
  updated_at: string
  restaurant?: { id: string; name: string; color: string | null } | null
  contact?: { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; company?: { id: string; name: string } | null } | null
  status?: { id: string; name: string; color: string; slug: string } | null
  space?: { id: string; name: string } | null
  assigned_user?: { id: string; first_name: string; last_name: string } | null
  booking_events?: BookingEventRow[]
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
          contact:contacts(id, first_name, last_name, email, phone),
          status:statuses(id, name, color, slug),
          assigned_user:users!bookings_assigned_to_fkey(id, first_name, last_name),
          booking_events(*)
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
          assigned_user:users!bookings_assigned_to_fkey(id, first_name, last_name),
          booking_events(*, space:spaces(id, name))
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

export function useBookingsByContact(contactId: string) {
  return useQuery({
    queryKey: ['bookings', 'contact', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          restaurant:restaurants(id, name, color),
          status:statuses(id, name, color, slug),
          assigned_user:users!bookings_assigned_to_fkey(id, first_name, last_name),
          booking_events(*)
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

      // 1. Créer le booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({ ...booking, organization_id: orgId } as never)
        .select()
        .single()

      if (bookingError) throw bookingError
      if (!bookingData) throw new Error('Booking creation failed')

      // 2. Créer automatiquement un sous-événement par défaut
      const { error: eventError } = await supabase
        .from('booking_events')
        .insert({
          booking_id: (bookingData as any).id,
          name: 'Événement principal',
          event_date: booking.event_date,
          start_time: booking.start_time || null,
          end_time: booking.end_time || null,
          guests_count: booking.guests_count || null,
          space_id: booking.space_id || null,
          is_date_flexible: false,
          is_restaurant_flexible: false,
          is_privatif: false,
        } as never)

      if (eventError) {
        console.error('Error creating default booking event:', eventError)
        // On ne throw pas l'erreur pour ne pas bloquer la création du booking
      }

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

export function useCreateBookingEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (event: Partial<BookingEventRow> & { booking_id: string }) => {
      const { data, error } = await supabase
        .from('booking_events')
        .insert(event as never)
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

export function useUpdateBookingEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BookingEventRow> & { id: string }) => {
      const { data, error } = await supabase
        .from('booking_events')
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

export function useDeleteBookingEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('booking_events')
        .delete()
        .eq('id', id)

      if (error) throw error
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

      if (error) throw error
      return (data as Payment[]) || []
    },
    enabled: !!bookingId,
  })
}
