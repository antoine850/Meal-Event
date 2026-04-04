import { useMemo } from 'react'
import { startOfMonth, endOfMonth, subMonths, format, getDay, isAfter, isBefore, startOfDay, endOfDay, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useBookings, useBookingStatuses, useRestaurants, type BookingWithRelations } from '@/features/reservations/hooks/use-bookings'
import { useContacts, useOrganizationUsers, type ContactWithRelations } from '@/features/contacts/hooks/use-contacts'
import { usePermissions } from '@/hooks/use-permissions'

export type DashboardFilters = {
  dateRange?: { from: Date; to: Date }
  restaurants: Set<string>
  statuses: Set<string>
  commercials: Set<string>
  clientType: Set<string> // 'b2b' | 'b2c'
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

    // Date range filter
    if (filters.dateRange?.from) {
      const from = startOfDay(filters.dateRange.from)
      result = result.filter(b => {
        const eventDate = parseISO(b.event_date)
        return !isBefore(eventDate, from)
      })
    }
    if (filters.dateRange?.to) {
      const to = endOfDay(filters.dateRange.to)
      result = result.filter(b => {
        const eventDate = parseISO(b.event_date)
        return !isAfter(eventDate, to)
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

    // Commercial filter
    if (filters.commercials.size > 0) {
      result = result.filter(b => b.assigned_to && filters.commercials.has(b.assigned_to))
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

const CONFIRMED_SLUGS = ['confirme_fonctionnaire', 'fonction_envoyee', 'a_facturer', 'cloture']
const SIGNED_SLUGS = ['attente_paiement', 'relance_paiement', ...CONFIRMED_SLUGS]

// ─── Helper functions for KPI calculations ───

export function calcRevenue(bookings: BookingWithRelations[]) {
  return bookings
    .filter(b => CONFIRMED_SLUGS.includes(b.status?.slug || ''))
    .reduce((sum, b) => sum + (b.total_amount || 0), 0)
}

export function calcAvgTicket(bookings: BookingWithRelations[]) {
  const confirmed = bookings.filter(b => CONFIRMED_SLUGS.includes(b.status?.slug || ''))
  if (confirmed.length === 0) return 0
  return Math.round(calcRevenue(bookings) / confirmed.length)
}

export function calcConversionRate(bookings: BookingWithRelations[]) {
  const nonCancelled = bookings.filter(b => b.status?.slug !== 'cancelled')
  if (nonCancelled.length === 0) return 0
  const confirmed = nonCancelled.filter(b => CONFIRMED_SLUGS.includes(b.status?.slug || '')).length
  return Math.round((confirmed / nonCancelled.length) * 1000) / 10
}

export function calcSignatureRate(bookings: BookingWithRelations[]) {
  const nonCancelled = bookings.filter(b => b.status?.slug !== 'cancelled')
  if (nonCancelled.length === 0) return 0
  const signed = nonCancelled.filter(b => SIGNED_SLUGS.includes(b.status?.slug || '')).length
  return Math.round((signed / nonCancelled.length) * 1000) / 10
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

export function groupByUser(bookings: BookingWithRelations[]) {
  const groups: Record<string, { user: { id: string; first_name: string; last_name: string } | null; bookings: BookingWithRelations[] }> = {}
  bookings.forEach(b => {
    const userId = b.assigned_to || 'unassigned'
    if (!groups[userId]) {
      groups[userId] = { user: b.assigned_user || null, bookings: [] }
    }
    groups[userId].bookings.push(b)
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
        .filter(b => b.restaurant?.name === name && CONFIRMED_SLUGS.includes(b.status?.slug || ''))
        .reduce((sum, b) => sum + (b.total_amount || 0), 0)
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
        .filter(b => CONFIRMED_SLUGS.includes(b.status?.slug || ''))
        .reduce((sum, b) => sum + (b.total_amount || 0), 0),
    }
  })
}

export function getMonthlyRevenueByCommercial(bookings: BookingWithRelations[]) {
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
    bookings
      .filter(b => b.assigned_user)
      .map(b => `${b.assigned_user!.first_name} ${b.assigned_user!.last_name}`)
  )]

  return months.map(m => {
    const monthBookings = bookings.filter(b => {
      const d = parseISO(b.event_date)
      return !isBefore(d, m.from) && !isAfter(d, m.to)
    })

    const row: Record<string, string | number> = { month: m.label }
    commercialNames.forEach(name => {
      row[name] = monthBookings
        .filter(b => `${b.assigned_user?.first_name} ${b.assigned_user?.last_name}` === name && CONFIRMED_SLUGS.includes(b.status?.slug || ''))
        .reduce((sum, b) => sum + (b.total_amount || 0), 0)
    })
    return row
  })
}

export function getContactsBySource(contacts: ContactWithRelations[], bookings: BookingWithRelations[]) {
  const sourceGroups: Record<string, { leads: number; bookings: number; revenue: number }> = {}

  contacts.forEach(c => {
    const source = (c as any).source || 'Autre'
    if (!sourceGroups[source]) sourceGroups[source] = { leads: 0, bookings: 0, revenue: 0 }
    sourceGroups[source].leads++
  })

  // Count bookings per source via contact (revenue only from confirmed)
  bookings.forEach(b => {
    const contact = contacts.find(c => c.id === b.contact_id)
    const source = (contact as any)?.source || 'Autre'
    if (!sourceGroups[source]) sourceGroups[source] = { leads: 0, bookings: 0, revenue: 0 }
    sourceGroups[source].bookings++
    if (CONFIRMED_SLUGS.includes(b.status?.slug || '')) {
      sourceGroups[source].revenue += b.total_amount || 0
    }
  })

  return Object.entries(sourceGroups)
    .map(([source, data]) => ({
      source,
      leads: data.leads,
      bookings: data.bookings,
      conversionRate: data.leads > 0 ? Math.round((data.bookings / data.leads) * 1000) / 10 : 0,
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
