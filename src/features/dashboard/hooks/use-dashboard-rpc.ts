import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { type DashboardFilters } from './use-dashboard-data'

// ─── Formes renvoyees par les RPC Postgres (cf supabase/migrations/20260605_*) ───

export type PipelineRow = {
  status_id: string
  name: string
  color: string
  slug: string
  count: number
  amount: number
}
export type RestaurantRow = {
  id: string | null
  name: string | null
  color: string | null
  revenue: number
  signed_count: number
  avg_ticket: number
}
export type CommercialRow = {
  id: string
  sales: number
  bookings: number
  signed: number
  conversion_rate: number
  avg_ticket: number
}
export type DayRow = { dow: number; reservations: number; guests: number }
export type TypeRow = { name: string; value: number }
export type MonthTrendRow = { month: string; reservations: number; revenue: number }
export type MonthRestaurantRow = { month: string; restaurant: string; revenue: number }
export type MonthCommercialRow = { month: string; user_id: string; revenue: number }

export type DashboardAggregates = {
  total: number
  signed_revenue: number
  signed_count: number
  signed_guests: number
  signed_without_quote: number
  avg_ticket_per_guest: number
  conversion_rate: number
  confirmed: number
  pending: number
  total_guests: number
  avg_guests: number
  pipeline: PipelineRow[]
  by_restaurant: RestaurantRow[]
  by_commercial: CommercialRow[]
  by_day_of_week: DayRow[]
  by_type: TypeRow[]
  monthly_trend: MonthTrendRow[]
  monthly_revenue_by_restaurant: MonthRestaurantRow[]
  monthly_revenue_by_commercial: MonthCommercialRow[]
}

export type SourceRow = {
  source: string
  leads: number
  bookings: number
  signed_count: number
  conversion_rate: number
  signature_rate: number
  revenue: number
}
export type MonthLeadsRow = { month: string; source: string; leads: number }
export type DashboardMarketing = {
  by_source: SourceRow[]
  monthly_leads_by_source: MonthLeadsRow[]
}

export type ActionItem = {
  type: 'urgent_upcoming' | 'overdue' | 'relance' | 'stale'
  booking_id: string
  title: string
  detail: string
  event_date: string | null
  restaurant: string | null
  status_name: string | null
  status_color: string | null
  guests: number
  amount: number
  severity: 'danger' | 'warning'
}
export type StaleProposal = {
  booking_id: string
  contact_name: string
  restaurant_name: string | null
  quote_number: string | null
  amount: number
  days_since: number
}
export type RecentBooking = {
  id: string
  contact_name: string
  restaurant_name: string | null
  kind: string | null
  status_name: string | null
  status_color: string | null
  amount: number
}
export type UpcomingBooking = RecentBooking & {
  event_date: string
  start_time: string | null
  guests: number
}
export type DashboardActionLists = {
  action_items: ActionItem[]
  stale_proposals: StaleProposal[]
  recent_bookings: RecentBooking[]
  upcoming_bookings: UpcomingBooking[]
}

export type ResponseTime = { avg_hours: number; count: number } | null

// ─── Conversion filtres dashboard -> arguments RPC ───

const iso = (d?: Date) => (d ? d.toISOString().slice(0, 10) : null)
const arr = (s: Set<string>) => (s.size > 0 ? [...s] : null)

/** clientType : un seul des deux ('b2b'|'b2c') filtre ; vide ou les deux = pas de filtre. */
function clientType(s: Set<string>): string | null {
  if (s.size !== 1) return null
  return s.has('b2b') ? 'b2b' : 'b2c'
}

export function toRpcArgs(f: DashboardFilters) {
  return {
    p_from_event: iso(f.eventDateRange?.from),
    p_to_event: iso(f.eventDateRange?.to),
    p_from_sign: iso(f.signDateRange?.from),
    p_to_sign: iso(f.signDateRange?.to),
    p_from_import: iso(f.importDateRange?.from),
    p_to_import: iso(f.importDateRange?.to),
    p_restaurants: arr(f.restaurants),
    p_statuses: arr(f.statuses),
    p_commercials: arr(f.commercials),
    p_client_type: clientType(f.clientType),
  }
}

// Cle de cache stable (les Set ne se serialisent pas en JSON).
const key = (f: DashboardFilters) => toRpcArgs(f)

// Les fonctions RPC ne sont pas dans les types generes (regenerer apres deploy) :
// on passe par un appel non type plutot que de polluer le client typed.
async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      f: string,
      a: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export function useDashboardAggregates(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard-aggregates', key(filters)],
    queryFn: () => callRpc<DashboardAggregates>('dashboard_aggregates', toRpcArgs(filters)),
    staleTime: 60_000,
  })
}

export function useDashboardMarketing(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard-marketing', key(filters)],
    queryFn: () => callRpc<DashboardMarketing>('dashboard_marketing', toRpcArgs(filters)),
    staleTime: 60_000,
  })
}

export function useDashboardActionLists(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard-action-lists', key(filters)],
    queryFn: () => callRpc<DashboardActionLists>('dashboard_action_lists', toRpcArgs(filters)),
    staleTime: 60_000,
  })
}

export function useDashboardResponseTime(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard-response-time', key(filters)],
    queryFn: () => callRpc<ResponseTime>('dashboard_response_time', toRpcArgs(filters)),
    staleTime: 60_000,
  })
}
