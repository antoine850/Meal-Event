import { useMemo } from 'react'
import { startOfMonth, endOfMonth, subMonths, format, getDay, isAfter, isBefore, startOfDay, endOfDay, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useBookings, useBookingStatuses, useRestaurants, type BookingWithRelations } from '@/features/reservations/hooks/use-bookings'
import { useContacts, useOrganizationUsers, type ContactWithRelations } from '@/features/contacts/hooks/use-contacts'
import { usePermissions } from '@/hooks/use-permissions'

export type DashboardDateField = 'event_date' | 'signed_at' | 'created_at'

export type DashboardFilters = {
  dateRange?: { from: Date; to: Date }
  restaurants: Set<string>
  statuses: Set<string>
  commercials: Set<string>
  clientType: Set<string> // 'b2b' | 'b2c'
  /** Quelle date de référence utiliser pour filtrer (défaut: event_date) */
  dateField?: DashboardDateField
}

/** Récupère la date effective d'un booking selon le champ demandé */
export function getBookingRefDate(b: BookingWithRelations, field: DashboardDateField): Date | null {
  if (field === 'event_date') return b.event_date ? parseISO(b.event_date) : null
  if (field === 'created_at') return b.created_at ? parseISO(b.created_at) : null
  if (field === 'signed_at') {
    const primary = b.quotes?.find(q => q.primary_quote) || b.quotes?.find(q => q.quote_signed_at)
    const signedAt = primary?.quote_signed_at
    return signedAt ? parseISO(signedAt) : null
  }
  return null
}

export type DashboardTabProps = {
  bookings: BookingWithRelations[]
  contacts: ContactWithRelations[]
  restaurants: { id: string; name: string; color: string | null }[]
  users: { id: string; first_name: string; last_name: string }[]
  isLoading: boolean
}

export function useDashboardData(filters: DashboardFilters) {
  const { data: allBookings = [], isLoading: bookingsLoading } = useBookings()
  const { data: allContacts = [], isLoading: contactsLoading } = useContacts()
  const { data: restaurants = [] } = useRestaurants()
  const { data: users = [] } = useOrganizationUsers()
  const { data: statuses = [] } = useBookingStatuses()
  const { isAdmin } = usePermissions()

  // Get current user's first name for greeting (without AuthProvider dependency)
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-name'],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return null
      const { data: dbUser } = await supabase
        .from('users')
        .select('first_name, email')
        .eq('id', authUser.id)
        .single()
      return { firstName: dbUser?.first_name || authUser.email?.split('@')[0] || '', email: authUser.email || '' }
    },
    staleTime: 10 * 60 * 1000,
  })

  const filteredBookings = useMemo(() => {
    let result = allBookings
    const dateField: DashboardDateField = filters.dateField || 'event_date'

    // Date range filter (sur le champ de référence du tab)
    if (filters.dateRange?.from) {
      const from = startOfDay(filters.dateRange.from)
      result = result.filter(b => {
        const ref = getBookingRefDate(b, dateField)
        return ref !== null && !isBefore(ref, from)
      })
    }
    if (filters.dateRange?.to) {
      const to = endOfDay(filters.dateRange.to)
      result = result.filter(b => {
        const ref = getBookingRefDate(b, dateField)
        return ref !== null && !isAfter(ref, to)
      })
    }

    // Restaurant filter
    if (filters.restaurants.size > 0) {
      result = result.filter(b => b.restaurant_id && filters.restaurants.has(b.restaurant_id))
    }

    // Status filter
    if (filters.statuses.size > 0) {
      result = result.filter(b => b.status_id && filters.statuses.has(b.status_id))
    }

    // Commercial filter sur assigned_user_ids (array)
    if (filters.commercials.size > 0) {
      result = result.filter(b =>
        (b.assigned_user_ids || []).some(id => filters.commercials.has(id))
      )
    }

    // B2B / B2C filter
    if (filters.clientType.size > 0 && filters.clientType.size < 2) {
      const wantB2B = filters.clientType.has('b2b')
      const wantB2C = filters.clientType.has('b2c')
      result = result.filter(b => {
        const hasCompany = !!b.contact?.company
        if (wantB2B && hasCompany) return true
        if (wantB2C && !hasCompany) return true
        return false
      })
    }

    return result
  }, [allBookings, filters])

  const filteredContacts = useMemo(() => {
    let result = allContacts

    // Date range filter on contacts
    if (filters.dateRange?.from) {
      const from = startOfDay(filters.dateRange.from)
      result = result.filter(c => {
        if (!c.created_at) return false
        const createdAt = parseISO(c.created_at)
        return !isBefore(createdAt, from)
      })
    }
    if (filters.dateRange?.to) {
      const to = endOfDay(filters.dateRange.to)
      result = result.filter(c => {
        if (!c.created_at) return false
        const createdAt = parseISO(c.created_at)
        return !isAfter(createdAt, to)
      })
    }

    // Commercial filter
    if (filters.commercials.size > 0) {
      result = result.filter(c => c.assigned_to && filters.commercials.has(c.assigned_to))
    }

    // B2B / B2C filter
    if (filters.clientType.size > 0 && filters.clientType.size < 2) {
      const wantB2B = filters.clientType.has('b2b')
      const wantB2C = filters.clientType.has('b2c')
      result = result.filter(c => {
        const hasCompany = !!c.company
        if (wantB2B && hasCompany) return true
        if (wantB2C && !hasCompany) return true
        return false
      })
    }

    return result
  }, [allContacts, filters])

  return {
    bookings: filteredBookings,
    contacts: filteredContacts,
    restaurants,
    users,
    statuses,
    isAdmin,
    userName: currentUser?.firstName || '',
    isLoading: bookingsLoading || contactsLoading,
  }
}

// ─── Status constants ───

export const CONFIRMED_SLUGS = ['confirme_fonctionnaire', 'fonction_envoyee', 'a_facturer', 'cloture']
export const SIGNED_SLUGS = ['attente_paiement', 'relance_paiement', ...CONFIRMED_SLUGS]

// ─── Helper functions for KPI calculations ───

/** CA signé: sum of primary quote total_ttc for signed bookings */
export function calcSignedRevenue(bookings: BookingWithRelations[]) {
  return bookings
    .filter(b => SIGNED_SLUGS.includes(b.status?.slug || ''))
    .reduce((sum, b) => sum + getSignedQuoteTtc(b), 0)
}

/** Count of signed events */
export function calcSignedCount(bookings: BookingWithRelations[]) {
  return bookings.filter(b => SIGNED_SLUGS.includes(b.status?.slug || '')).length
}

/** Get primary quote total_ttc for a booking */
function getSignedQuoteTtc(b: BookingWithRelations) {
  const primaryQuote = b.quotes?.find(q => q.primary_quote)
  if (primaryQuote) return primaryQuote.total_ttc || 0
  // Fallback: first signed quote
  const signedQuote = b.quotes?.find(q => q.status === 'quote_signed' || q.status === 'deposit_paid' || q.status === 'balance_paid' || q.status === 'completed')
  return signedQuote?.total_ttc || 0
}

/** Sum of all paid payments (acompte + solde + extras) for confirmed bookings */
export function calcRevenue(bookings: BookingWithRelations[]) {
  return bookings
    .filter(b => CONFIRMED_SLUGS.includes(b.status?.slug || ''))
    .reduce((sum, b) => sum + getPaidAmount(b), 0)
}

/** Sum of paid payments for a single booking */
export function getPaidAmount(b: BookingWithRelations) {
  if (!b.payments?.length) return 0
  return b.payments
    .filter(p => p.status === 'paid' || p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0)
}

/** Ticket moyen par événement signé (legacy) */
export function calcAvgTicket(bookings: BookingWithRelations[]) {
  const signedCount = calcSignedCount(bookings)
  if (signedCount === 0) return 0
  return Math.round(calcSignedRevenue(bookings) / signedCount)
}

/** Ticket moyen par convive (CA signé / nombre total de convives signés) */
export function calcAvgTicketPerGuest(bookings: BookingWithRelations[]) {
  const signed = bookings.filter(b => SIGNED_SLUGS.includes(b.status?.slug || ''))
  const totalGuests = signed.reduce((sum, b) => sum + (b.guests_count || 0), 0)
  if (totalGuests === 0) return 0
  const total = signed.reduce((sum, b) => sum + getSignedQuoteTtc(b), 0)
  return Math.round(total / totalGuests)
}

/** Total CA (TTC) d'un booking en incluant les extras — prend total_amount si défini, sinon fallback quote */
export function getBookingTotalCA(b: BookingWithRelations) {
  const ta = (b as any).total_amount
  if (ta && ta > 0) return ta as number
  return getSignedQuoteTtc(b)
}

/** Taux de conversion based on signatures (signed / total hors annulés) */
export function calcConversionRate(bookings: BookingWithRelations[]) {
  const nonCancelled = bookings.filter(b => b.status?.slug !== 'cancelled')
  if (nonCancelled.length === 0) return 0
  const signed = nonCancelled.filter(b => SIGNED_SLUGS.includes(b.status?.slug || '')).length
  return Math.round((signed / nonCancelled.length) * 1000) / 10
}

export function calcSignatureRate(bookings: BookingWithRelations[]) {
  return calcConversionRate(bookings)
}

/** Pipeline: group bookings by status with counts and amounts */
export function calcPipeline(bookings: BookingWithRelations[], statuses: { id: string; name: string; color: string; slug: string }[]) {
  const pipeline: { statusId: string; name: string; color: string; slug: string; count: number; amount: number }[] = []

  statuses.forEach(s => {
    const statusBookings = bookings.filter(b => b.status_id === s.id)
    if (statusBookings.length > 0 || true) { // show all statuses
      pipeline.push({
        statusId: s.id,
        name: s.name,
        color: s.color,
        slug: s.slug,
        count: statusBookings.length,
        amount: statusBookings.reduce((sum, b) => sum + getSignedQuoteTtc(b), 0),
      })
    }
  })

  return pipeline.filter(p => p.count > 0)
}

/** Stale proposals: quotes sent/signature_requested with no action for >3 days */
export function getStaleProposals(bookings: BookingWithRelations[]) {
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  const results: { bookingId: string; contactName: string; restaurantName: string; quoteNumber: string; amount: number; sentAt: string; daysSince: number }[] = []

  bookings.forEach(b => {
    if (!b.quotes) return
    b.quotes.forEach(q => {
      const isSent = q.status === 'sent' || q.status === 'signature_requested'
      if (!isSent) return

      const sentDate = q.signature_requested_at || q.quote_sent_at
      if (!sentDate) return

      const sent = new Date(sentDate)
      if (sent > threeDaysAgo) return

      const daysSince = Math.floor((Date.now() - sent.getTime()) / (1000 * 60 * 60 * 24))
      const contactName = b.contact ? `${b.contact.first_name} ${b.contact.last_name || ''}`.trim() : 'Sans contact'

      results.push({
        bookingId: b.id,
        contactName,
        restaurantName: b.restaurant?.name || '',
        quoteNumber: q.quote_number || '',
        amount: q.total_ttc || 0,
        sentAt: sentDate,
        daysSince,
      })
    })
  })

  return results.sort((a, b) => b.daysSince - a.daysSince)
}

export function groupByMonth(bookings: BookingWithRelations[]) {
  const groups: Record<string, BookingWithRelations[]> = {}
  bookings.forEach(b => {
    const key = format(parseISO(b.event_date), 'MMM yyyy', { locale: fr })
    if (!groups[key]) groups[key] = []
    groups[key].push(b)
  })
  return groups
}

export function groupByRestaurant(bookings: BookingWithRelations[]) {
  const groups: Record<string, BookingWithRelations[]> = {}
  bookings.forEach(b => {
    const name = b.restaurant?.name || 'Sans restaurant'
    if (!groups[name]) groups[name] = []
    groups[name].push(b)
  })
  return groups
}

/** Performance par restaurant: uniquement les bookings signés (CA uniquement sur affaires signées) */
export function groupBySignedRestaurant(bookings: BookingWithRelations[]) {
  const signed = bookings.filter(b => SIGNED_SLUGS.includes(b.status?.slug || ''))
  return groupByRestaurant(signed)
}

export function groupByUser(bookings: BookingWithRelations[], users: { id: string; first_name: string; last_name: string }[]) {
  const userMap = new Map(users.map(u => [u.id, u]))
  const groups: Record<string, { user: { id: string; first_name: string; last_name: string } | null; bookings: BookingWithRelations[] }> = {}
  bookings.forEach(b => {
    const ids = b.assigned_user_ids || []
    if (ids.length === 0) {
      if (!groups['unassigned']) groups['unassigned'] = { user: null, bookings: [] }
      groups['unassigned'].bookings.push(b)
      return
    }
    ids.forEach(userId => {
      if (!groups[userId]) {
        groups[userId] = { user: userMap.get(userId) || null, bookings: [] }
      }
      groups[userId].bookings.push(b)
    })
  })
  return groups
}

export function getMonthlyRevenueByRestaurant(bookings: BookingWithRelations[]) {
  // Get last 6 months
  const now = new Date()
  const months: { key: string; label: string; from: Date; to: Date }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i)
    months.push({
      key: format(d, 'yyyy-MM'),
      label: format(d, 'MMM', { locale: fr }),
      from: startOfMonth(d),
      to: endOfMonth(d),
    })
  }

  const restaurantNames = [...new Set(bookings.map(b => b.restaurant?.name).filter(Boolean))] as string[]

  return months.map(m => {
    const monthBookings = bookings.filter(b => {
      const d = parseISO(b.event_date)
      return !isBefore(d, m.from) && !isAfter(d, m.to)
    })

    const row: Record<string, string | number> = { month: m.label }
    restaurantNames.forEach(name => {
      row[name] = monthBookings
        .filter(b => b.restaurant?.name === name && SIGNED_SLUGS.includes(b.status?.slug || ''))
        .reduce((sum, b) => sum + getSignedQuoteTtc(b), 0)
    })
    return row
  })
}

export function getReservationsByDayOfWeek(bookings: BookingWithRelations[]) {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const counts = Array(7).fill(0)
  const guests = Array(7).fill(0)

  bookings.forEach(b => {
    const dayIndex = getDay(parseISO(b.event_date))
    counts[dayIndex]++
    guests[dayIndex] += b.guests_count || 0
  })

  // Reorder to start from Monday
  const orderedDays = [1, 2, 3, 4, 5, 6, 0]
  return orderedDays.map(i => ({
    day: days[i],
    reservations: counts[i],
    guests: guests[i],
  }))
}

export function getReservationsByType(bookings: BookingWithRelations[]) {
  const groups: Record<string, number> = {}
  const colors = ['#f97316', '#ec4899', '#3b82f6', '#22c55e', '#8b5cf6', '#14b8a6', '#f43f5e', '#a855f7']

  bookings.forEach(b => {
    const type = b.occasion || b.event_type || 'Autre'
    groups[type] = (groups[type] || 0) + 1
  })

  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
    }))
}

export function getMonthlyTrend(bookings: BookingWithRelations[]) {
  const now = new Date()
  const months: { key: string; label: string; from: Date; to: Date }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i)
    months.push({
      key: format(d, 'yyyy-MM'),
      label: format(d, 'MMM', { locale: fr }),
      from: startOfMonth(d),
      to: endOfMonth(d),
    })
  }

  return months.map(m => {
    const monthBookings = bookings.filter(b => {
      const d = parseISO(b.event_date)
      return !isBefore(d, m.from) && !isAfter(d, m.to)
    })
    return {
      month: m.label,
      reservations: monthBookings.length,
      revenue: monthBookings
        .filter(b => SIGNED_SLUGS.includes(b.status?.slug || ''))
        .reduce((sum, b) => sum + getSignedQuoteTtc(b), 0),
    }
  })
}

export function getMonthlyRevenueByCommercial(bookings: BookingWithRelations[], users: { id: string; first_name: string; last_name: string }[]) {
  const userMap = new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`]))
  const now = new Date()
  const months: { label: string; from: Date; to: Date }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i)
    months.push({
      label: format(d, 'MMM', { locale: fr }),
      from: startOfMonth(d),
      to: endOfMonth(d),
    })
  }

  const commercialNames = [...new Set(
    bookings.flatMap(b => {
      const ids = b.assigned_user_ids || []
      return ids.map(id => userMap.get(id)).filter(Boolean) as string[]
    })
  )]

  return months.map(m => {
    const monthBookings = bookings.filter(b => {
      const d = parseISO(b.event_date)
      return !isBefore(d, m.from) && !isAfter(d, m.to)
    })

    const row: Record<string, string | number> = { month: m.label }
    commercialNames.forEach(name => {
      row[name] = monthBookings
        .filter(b => {
          const ids = b.assigned_user_ids || []
          return ids.some(id => userMap.get(id) === name) && SIGNED_SLUGS.includes(b.status?.slug || '')
        })
        .reduce((sum, b) => sum + getSignedQuoteTtc(b), 0)
    })
    return row
  })
}

export function getContactsBySource(contacts: ContactWithRelations[], bookings: BookingWithRelations[]) {
  const sourceGroups: Record<string, { leads: number; bookings: number; signed: number; revenue: number }> = {}

  contacts.forEach(c => {
    const source = (c as any).source || 'Autre'
    if (!sourceGroups[source]) sourceGroups[source] = { leads: 0, bookings: 0, signed: 0, revenue: 0 }
    sourceGroups[source].leads++
  })

  // Count bookings per source via contact
  // revenue = total CA (avec extras) pour TOUS les bookings (pas seulement signés) pour cohérence avec dashboard
  bookings.forEach(b => {
    const contact = contacts.find(c => c.id === b.contact_id)
    const source = (contact as any)?.source || 'Autre'
    if (!sourceGroups[source]) sourceGroups[source] = { leads: 0, bookings: 0, signed: 0, revenue: 0 }
    sourceGroups[source].bookings++
    const isSigned = SIGNED_SLUGS.includes(b.status?.slug || '')
    if (isSigned) {
      sourceGroups[source].signed++
      sourceGroups[source].revenue += getBookingTotalCA(b)
    }
  })

  return Object.entries(sourceGroups)
    .map(([source, data]) => ({
      source,
      leads: data.leads,
      bookings: data.bookings,
      signedCount: data.signed,
      conversionRate: data.leads > 0 ? Math.round((data.bookings / data.leads) * 1000) / 10 : 0,
      /** Taux de signature = signés / leads (pour identifier la "meilleure source") */
      signatureRate: data.leads > 0 ? Math.round((data.signed / data.leads) * 1000) / 10 : 0,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.leads - a.leads)
}

export function getMonthlyLeadsBySource(contacts: ContactWithRelations[]) {
  const now = new Date()
  const months: { label: string; from: Date; to: Date }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i)
    months.push({
      label: format(d, 'MMM', { locale: fr }),
      from: startOfMonth(d),
      to: endOfMonth(d),
    })
  }

  const sources = [...new Set(contacts.map(c => (c as any).source || 'Autre'))]

  return months.map(m => {
    const monthContacts = contacts.filter(c => {
      if (!c.created_at) return false
      const d = parseISO(c.created_at)
      return !isBefore(d, m.from) && !isAfter(d, m.to)
    })

    const row: Record<string, string | number> = { month: m.label }
    sources.forEach(source => {
      row[source] = monthContacts.filter(c => ((c as any).source || 'Autre') === source).length
    })
    return row
  })
}
