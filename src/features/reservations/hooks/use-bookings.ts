import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCurrentOrganizationId } from '@/lib/get-current-org'
import { supabase } from '@/lib/supabase'
import type { Quote, Payment } from '@/lib/supabase/types'

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

export type BookingWithRelations = {
  id: string
  organization_id: string | null
  restaurant_id: string | null
  contact_id: string | null
  status_id: string | null
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
  reservation_type: string | null
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
  read_at: string | null
  created_at: string
  updated_at: string
  restaurant?: { id: string; name: string; color: string | null } | null
  contact?: {
    id: string
    first_name: string
    last_name: string | null
    email: string | null
    phone: string | null
    source?: string | null
    created_at?: string | null
    company?: { id: string; name: string } | null
  } | null
  status?: { id: string; name: string; color: string; slug: string } | null
  payments?: {
    id: string
    amount: number
    status: string | null
    payment_modality: string | null
    paid_at: string | null
  }[]
  quotes?: {
    id: string
    total_ht: number | null
    total_ttc: number | null
    status: string | null
    primary_quote: boolean | null
    quote_number: string | null
    quote_sent_at: string | null
    signature_requested_at: string | null
    quote_signed_at: string | null
  }[]
}

// Permissions restaurant-scoped : admin = tout (null = pas de filtre),
// commercial/gérant = ses restaurants assignés uniquement.
async function getRestaurantScope(): Promise<string[] | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: dbUser } = await supabase
    .from('users')
    .select('role:roles(slug), user_restaurants(restaurant_id)')
    .eq('id', user.id)
    .single()
  const roleSlug = (dbUser as any)?.role?.slug || ''
  if (roleSlug === 'admin') return null
  return ((dbUser as any)?.user_restaurants || [])
    .map((ur: any) => ur.restaurant_id)
    .filter(Boolean)
}

const BOOKING_SELECT = `
  *,
  restaurant:restaurants(id, name, color),
  contact:contacts(id, first_name, last_name, email, phone, source, created_at, company:companies(id, name)),
  status:statuses(id, name, color, slug),
  payments(id, amount, status, payment_modality, paid_at),
  quotes(id, total_ht, total_ttc, status, primary_quote, quote_number, quote_sent_at, signature_requested_at, quote_signed_at)
`

// Charge TOUS les bookings (la table dépasse la limite PostgREST de 1000
// lignes) : un count puis les tranches de 1000 en parallèle. L'ordre
// event_date + id rend les bornes de tranches déterministes. Lourd (~15k
// lignes avec embeds) : réservé aux vues qui agrègent tout (facturation,
// calendrier, pipeline) ; passer enabled=false tant qu'elles n'en ont pas besoin.
export function useBookings(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const restaurantFilter = await getRestaurantScope()
      if (restaurantFilter !== null && restaurantFilter.length === 0)
        return [] as BookingWithRelations[]

      const baseQuery = () => {
        let q = supabase
          .from('bookings')
          .select(BOOKING_SELECT)
          .eq('organization_id', orgId)
        if (restaurantFilter !== null)
          q = q.in('restaurant_id', restaurantFilter)
        return q
          .order('event_date', { ascending: true })
          .order('id', { ascending: true })
      }

      let countQuery = supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
      if (restaurantFilter !== null)
        countQuery = countQuery.in('restaurant_id', restaurantFilter)
      const { count, error: countError } = await countQuery
      if (countError) throw countError

      const pageSize = 1000
      const offsets: number[] = []
      for (let from = 0; from < (count ?? 0); from += pageSize)
        offsets.push(from)

      // Toutes les tranches en simultané font tomber PostgREST (500 observés
      // à 16 requêtes) : on borne la concurrence à 6.
      const chunks: BookingWithRelations[][] = new Array(offsets.length)
      let next = 0
      const worker = async () => {
        while (next < offsets.length) {
          const i = next++
          const from = offsets[i]
          const { data, error } = await baseQuery().range(
            from,
            from + pageSize - 1
          )
          if (error) throw error
          chunks[i] = (data || []) as unknown as BookingWithRelations[]
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(6, offsets.length) }, worker)
      )
      return chunks.flat()
    },
    enabled: opts?.enabled ?? true,
  })
}

export type BookingsQueryParams = {
  page: number // 0-based
  pageSize: number
  sort: { field: string; dir: 'asc' | 'desc' }
  search?: string
  from?: string // event_date >= (ISO yyyy-mm-dd)
  to?: string // event_date <= (ISO yyyy-mm-dd)
  statuses?: string[]
  restaurants?: string[]
  commercials?: string[]
  fromSign?: string // quote_signed_at >= (ISO yyyy-mm-dd)
  toSign?: string // quote_signed_at <= (ISO yyyy-mm-dd)
  fromImport?: string // created_at >= (ISO)
  toImport?: string // created_at <= (ISO)
  source?: string // contact.source
  stale?: boolean // propositions sans reponse > 3j
}

export function useBookingsPaged(params: BookingsQueryParams) {
  return useQuery({
    queryKey: ['bookings-paged', params],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const restaurantScope = await getRestaurantScope()
      if (restaurantScope !== null && restaurantScope.length === 0) {
        return { rows: [] as BookingWithRelations[], total: 0 }
      }

      let searchOr: string | null = null
      if (params.search) {
        const term = params.search
          .replace(/["\\]/g, '') // neutralise ce qui casse la valeur entre guillemets
          .replace(/\s+/g, ' ')
          .trim()

        // RPC unaccent (insensible aux accents/espaces) avec repli sur le
        // ilike historique tant que la migration n'est pas appliquee.
        const rpc = await (supabase as any).rpc('search_booking_ids', {
          search: term,
          org: orgId,
          lim: 1000,
        })
        if (!rpc.error) {
          const ids = ((rpc.data as { id: string }[]) || []).map((r) => r.id)
          searchOr = `id.in.(${ids.length ? ids.join(',') : NIL_UUID})`
        } else {
          const like = `%${term}%`
          const [contactRes, restoRes] = await Promise.all([
            supabase
              .from('contacts')
              .select('id')
              .eq('organization_id', orgId)
              .or(
                `first_name.ilike."${like}",last_name.ilike."${like}",email.ilike."${like}"`
              )
              .limit(1000),
            supabase
              .from('restaurants')
              .select('id')
              .eq('organization_id', orgId)
              .ilike('name', like)
              .limit(1000),
          ])
          const contactIds = (contactRes.data || []).map(
            (c: { id: string }) => c.id
          )
          const restoIds = (restoRes.data || []).map(
            (r: { id: string }) => r.id
          )
          const parts = [
            `contact_sur_place_societe.ilike."${like}"`,
            `contact_sur_place_nom.ilike."${like}"`,
            `event_type.ilike."${like}"`,
          ]
          if (contactIds.length)
            parts.push(`contact_id.in.(${contactIds.join(',')})`)
          if (restoIds.length)
            parts.push(`restaurant_id.in.(${restoIds.join(',')})`)
          searchOr = parts.join(',')
        }
      }

      // Drill-down dashboard : source / date de signature / propositions stale.
      // Les trois résolutions sont indépendantes ; on les lance en parallèle.
      const sourceP = params.source
        ? supabase
            .from('contacts')
            .select('id')
            .eq('organization_id', orgId)
            .eq('source', params.source)
            .limit(2000)
        : null

      let signQ = supabase
        .from('quotes')
        .select('booking_id')
        .eq('organization_id', orgId)
        .not('quote_signed_at', 'is', null)
        .limit(5000)
      if (params.fromSign) signQ = signQ.gte('quote_signed_at', params.fromSign)
      if (params.toSign)
        signQ = signQ.lte('quote_signed_at', `${params.toSign}T23:59:59`)
      const signP = params.fromSign || params.toSign ? signQ : null

      const staleP = params.stale
        ? supabase
            .from('quotes')
            .select('booking_id, status, signature_requested_at, quote_sent_at')
            .eq('organization_id', orgId)
            .in('status', ['sent', 'signature_requested'])
            .limit(5000)
        : null

      const [sourceRes, signRes, staleRes] = await Promise.all([
        sourceP,
        signP,
        staleP,
      ])

      let sourceContactIds: string[] | null = null
      if (sourceRes)
        sourceContactIds = (sourceRes.data || []).map(
          (c: { id: string }) => c.id
        )

      // Si signature et stale sont demandés, on intersecte avant un seul .in('id', ...).
      let signBookingIds: string[] | null = null
      if (signRes) {
        signBookingIds = Array.from(
          new Set(
            (signRes.data || [])
              .map((r: { booking_id: string | null }) => r.booking_id)
              .filter((id): id is string => !!id)
          )
        )
      }

      let staleBookingIds: string[] | null = null
      if (staleRes) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 3)
        const ids = new Set<string>()
        for (const r of (staleRes.data || []) as {
          booking_id: string | null
          signature_requested_at: string | null
          quote_sent_at: string | null
        }[]) {
          const sentDate = r.signature_requested_at || r.quote_sent_at
          if (r.booking_id && sentDate && new Date(sentDate) < cutoff)
            ids.add(r.booking_id)
        }
        staleBookingIds = Array.from(ids)
      }

      let bookingIdFilter: string[] | null = null
      if (signBookingIds !== null && staleBookingIds !== null) {
        const staleSet = new Set(staleBookingIds)
        bookingIdFilter = signBookingIds.filter((id) => staleSet.has(id))
      } else if (signBookingIds !== null) {
        bookingIdFilter = signBookingIds
      } else if (staleBookingIds !== null) {
        bookingIdFilter = staleBookingIds
      }

      let query = supabase
        .from('bookings')
        .select(BOOKING_SELECT, { count: 'exact' })
        .eq('organization_id', orgId)

      if (restaurantScope !== null)
        query = query.in('restaurant_id', restaurantScope)
      if (params.from) query = query.gte('event_date', params.from)
      if (params.to) query = query.lte('event_date', params.to)
      if (params.statuses?.length)
        query = query.in('status_id', params.statuses)
      if (params.restaurants?.length)
        query = query.in('restaurant_id', params.restaurants)
      if (params.commercials?.length)
        query = query.overlaps('assigned_user_ids', params.commercials)
      if (params.fromImport) query = query.gte('created_at', params.fromImport)
      if (params.toImport) query = query.lte('created_at', params.toImport)
      if (sourceContactIds !== null)
        query = sourceContactIds.length
          ? query.in('contact_id', sourceContactIds)
          : query.in('contact_id', [NIL_UUID])
      if (bookingIdFilter !== null)
        query = query.in(
          'id',
          bookingIdFilter.length ? bookingIdFilter : [NIL_UUID]
        )
      if (searchOr) query = query.or(searchOr)

      query = query.order(params.sort.field, {
        ascending: params.sort.dir === 'asc',
      })
      const fromRow = params.page * params.pageSize
      query = query.range(fromRow, fromRow + params.pageSize - 1)

      const { data, error, count } = await query
      if (error) throw error
      return {
        rows: (data || []) as unknown as BookingWithRelations[],
        total: count || 0,
      }
    },
    placeholderData: (prev) => prev,
  })
}

export type BookingSearchHit = {
  id: string
  occasion: string | null
  event_type: string | null
  event_date: string
  restaurant?: { id: string; name: string } | null
}

// Recherche serveur pour le menu Cmd+K : la table dépasse la limite PostgREST
// de 1000 lignes, donc un select complet + filtre client raterait la plupart
// des bookings. RPC search_booking_ids (unaccent, multi-mots) puis fetch des
// bookings correspondants ; repli ilike sur occasion/event_type tant que la
// migration n'est pas appliquée.
export function useBookingSearch(term: string, enabled = true) {
  return useQuery({
    queryKey: ['bookings', 'search', term],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')
      const t = term.trim()

      const restaurantFilter = await getRestaurantScope()
      if (restaurantFilter !== null && restaurantFilter.length === 0)
        return [] as BookingSearchHit[]

      const select =
        'id, occasion, event_type, event_date, restaurant:restaurants(id, name)'

      const rpc = await (supabase as any).rpc('search_booking_ids', {
        search: t,
        org: orgId,
        lim: 20,
      })
      if (!rpc.error) {
        const ids = ((rpc.data as { id: string }[]) || []).map((r) => r.id)
        if (!ids.length) return [] as BookingSearchHit[]
        let q = supabase.from('bookings').select(select).in('id', ids)
        if (restaurantFilter !== null)
          q = q.in('restaurant_id', restaurantFilter)
        const { data, error } = await q
        if (error) throw error
        return ((data || []) as unknown as BookingSearchHit[]).sort((a, b) =>
          b.event_date.localeCompare(a.event_date)
        )
      }

      let q = supabase
        .from('bookings')
        .select(select)
        .eq('organization_id', orgId)
        .or(`occasion.ilike."%${t}%",event_type.ilike."%${t}%"`)
      if (restaurantFilter !== null) q = q.in('restaurant_id', restaurantFilter)
      const { data, error } = await q
        .order('event_date', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data || []) as unknown as BookingSearchHit[]
    },
    enabled,
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
        .select(
          `
          *,
          restaurant:restaurants(id, name, color),
          contact:contacts(id, first_name, last_name, email, phone, source, created_at, company:companies(id, name)),
          status:statuses(id, name, color, slug)
        `
        )
        .eq('id', id)
        .eq('organization_id', orgId)
        .single()

      if (error) throw error
      return data as unknown as BookingWithRelations
    },
    enabled: !!id,
  })
}

export function useBookingsByContact(contactId: string | null | undefined) {
  return useQuery({
    queryKey: ['bookings', 'contact', contactId],
    queryFn: async () => {
      if (!contactId) return []

      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('bookings')
        .select(
          `
          *,
          restaurant:restaurants(id, name, color),
          status:statuses(id, name, color, slug)
        `
        )
        .eq('contact_id', contactId)
        .eq('organization_id', orgId)
        .order('event_date', { ascending: false })

      if (error) throw error
      return data as unknown as BookingWithRelations[]
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
      return data as {
        id: string
        name: string
        slug: string
        color: string
        position: number
      }[]
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
    mutationFn: async ({
      id,
      ...updates
    }: Partial<BookingWithRelations> & { id: string }) => {
      // Auto-assignation : si, après application de cet update, le booking reste
      // sans commercial assigné, assigner l'utilisateur courant.
      const u = updates as Partial<BookingWithRelations>
      const { data: current } = await supabase
        .from('bookings')
        .select('assigned_user_ids')
        .eq('id', id)
        .single()

      const currentRow = current as {
        assigned_user_ids: string[] | null
      } | null

      const finalAssignedIds =
        'assigned_user_ids' in u
          ? u.assigned_user_ids
          : (currentRow?.assigned_user_ids ?? null)

      if ((finalAssignedIds?.length ?? 0) === 0) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          u.assigned_user_ids = [user.id]
        }
      }

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
      // Delete related email_logs first (FK without CASCADE)
      await supabase.from('email_logs').delete().eq('booking_id', id)

      const { error } = await supabase.from('bookings').delete().eq('id', id)

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
        .select('*, quote_items(*)')
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
      paymentModality,
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
      paymentModality?: string
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
          payment_modality: paymentModality || 'autre',
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

      // When a payment is created as "paid", update booking and quote status
      if (status === 'paid') {
        const modality = paymentModality || 'autre'

        if (modality === 'acompte' || paymentType === 'deposit') {
          // Deposit paid → booking status "acompte-paye"
          const { data: statusData } = await supabase
            .from('statuses')
            .select('id')
            .eq('organization_id', orgId)
            .eq('slug', 'confirme_fonctionnaire')
            .eq('type', 'booking')
            .single()

          if (statusData) {
            await supabase
              .from('bookings')
              .update({ status_id: statusData.id })
              .eq('id', bookingId)
          }

          if (quoteId) {
            await supabase
              .from('quotes')
              .update({
                status: 'deposit_paid',
                deposit_paid_at: new Date().toISOString(),
              })
              .eq('id', quoteId)
          }
        } else if (modality === 'solde' || paymentType === 'balance') {
          // Balance paid → update quote status only (booking status "Fonction envoyée" is manual)
          if (quoteId) {
            await supabase
              .from('quotes')
              .update({
                status: 'balance_paid',
                balance_paid_at: new Date().toISOString(),
              })
              .eq('id', quoteId)
            await supabase
              .from('quotes')
              .update({ status: 'completed' })
              .eq('id', quoteId)
              .eq('status', 'balance_paid')
          }
        }
      }

      return { ...(data as Payment), bookingId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['payments', (data as any).bookingId || data.booking_id],
      })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({
        queryKey: ['quotes', (data as any).bookingId || data.booking_id],
      })
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
      paymentModality,
      paymentMethod,
      status,
      paidAt,
      notes,
      file,
      removeAttachment,
      currentAttachmentPath,
      quoteId,
    }: {
      id: string
      bookingId: string
      amount?: number
      paymentType?: string
      paymentModality?: string
      paymentMethod?: string
      status?: string
      paidAt?: string | null
      notes?: string | null
      file?: File
      removeAttachment?: boolean
      currentAttachmentPath?: string | null
      quoteId?: string
    }) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const updates: Record<string, unknown> = {}
      if (amount !== undefined) updates.amount = amount
      if (paymentType !== undefined) updates.payment_type = paymentType
      if (paymentModality !== undefined)
        updates.payment_modality = paymentModality
      if (paymentMethod !== undefined) updates.payment_method = paymentMethod
      if (status !== undefined) updates.status = status
      if (paidAt !== undefined) updates.paid_at = paidAt
      if (notes !== undefined) updates.notes = notes
      // Backfill quote_id si un paiement existant n'en a pas (créé avant le fix).
      if (quoteId !== undefined) updates.quote_id = quoteId

      // Handle file upload
      if (file) {
        // Delete old file if exists
        if (currentAttachmentPath) {
          await supabase.storage
            .from('documents')
            .remove([currentAttachmentPath])
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
        .select('*, quote_id')
        .single()

      if (error) throw error

      const payment = data as Payment & { quote_id?: string }

      // When a payment is marked as "paid", update booking status and quote status
      // This handles the bank transfer flow where there's no Stripe webhook
      if (status === 'paid' && payment) {
        const paymentModality_ =
          paymentModality || (payment as any).payment_modality
        const resolvedQuoteId = payment.quote_id || quoteId

        // Update booking status based on payment modality
        if (
          paymentModality_ === 'acompte' ||
          (payment as any).payment_type === 'deposit'
        ) {
          // Deposit paid → update booking status to "acompte-paye"
          const { data: statusData } = await supabase
            .from('statuses')
            .select('id')
            .eq('organization_id', orgId)
            .eq('slug', 'confirme_fonctionnaire')
            .eq('type', 'booking')
            .single()

          if (statusData) {
            await supabase
              .from('bookings')
              .update({ status_id: statusData.id })
              .eq('id', bookingId)
          }

          // Update quote status to deposit_paid
          if (resolvedQuoteId) {
            await supabase
              .from('quotes')
              .update({
                status: 'deposit_paid',
                deposit_paid_at: new Date().toISOString(),
              })
              .eq('id', resolvedQuoteId)
          }
        } else if (
          paymentModality_ === 'solde' ||
          (payment as any).payment_type === 'balance'
        ) {
          // Balance paid → update quote status only (booking status "Fonction envoyée" is manual)
          if (resolvedQuoteId) {
            await supabase
              .from('quotes')
              .update({
                status: 'balance_paid',
                balance_paid_at: new Date().toISOString(),
              })
              .eq('id', resolvedQuoteId)

            // Auto-complete quote
            await supabase
              .from('quotes')
              .update({ status: 'completed' })
              .eq('id', resolvedQuoteId)
              .eq('status', 'balance_paid')
          }
        }
      }

      return { payment: data as Payment, bookingId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments', data.bookingId] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['quotes', data.bookingId] })
    },
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      bookingId,
    }: {
      id: string
      bookingId: string
    }) => {
      const { error } = await supabase.from('payments').delete().eq('id', id)
      if (error) throw error
      return { bookingId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments', data.bookingId] })
    },
  })
}

export function useMarkBookingAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bookings')
        .update({ read_at: new Date().toISOString() } as never)
        .eq('id', id)
        .is('read_at', null)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}
