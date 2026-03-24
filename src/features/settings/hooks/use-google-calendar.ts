import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

type CalendarStatus = {
  connected: boolean
  sync_enabled: boolean
  email: string | null
  calendar_id: string | null
}

type GoogleCalendar = {
  id: string
  summary: string
  primary: boolean
}

export function useGoogleCalendarStatus(restaurantId: string) {
  return useQuery({
    queryKey: ['google-calendar-status', restaurantId],
    queryFn: () =>
      apiClient<CalendarStatus>(`/api/google-calendar/status?restaurant_id=${restaurantId}`),
    enabled: !!restaurantId,
  })
}

export function useGoogleCalendarAuthUrl(restaurantId: string) {
  return useMutation({
    mutationFn: () =>
      apiClient<{ url: string }>(`/api/google-calendar/auth-url?restaurant_id=${restaurantId}`),
  })
}

export function useGoogleCalendars(restaurantId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['google-calendars', restaurantId],
    queryFn: () =>
      apiClient<{ calendars: GoogleCalendar[] }>(`/api/google-calendar/calendars?restaurant_id=${restaurantId}`),
    enabled: enabled && !!restaurantId,
  })
}

export function useSelectGoogleCalendar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { restaurant_id: string; calendar_id: string }) =>
      apiClient('/api/google-calendar/select-calendar', {
        method: 'POST',
        body: params,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status', variables.restaurant_id] })
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
    },
  })
}

export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (restaurantId: string) =>
      apiClient(`/api/google-calendar/disconnect?restaurant_id=${restaurantId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, restaurantId) => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status', restaurantId] })
      queryClient.invalidateQueries({ queryKey: ['google-calendars', restaurantId] })
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
    },
  })
}
