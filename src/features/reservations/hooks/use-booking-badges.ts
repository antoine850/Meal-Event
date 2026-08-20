import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BadgeType } from '../data/badges'
import { ACTION_LABELS, useLogActivity } from './use-activity-logs'

export type BookingBadge = {
  booking_id: string
  badge_type: BadgeType
  depuis: string
}

// Badges des lignes affichees : la vue booking_badges calcule l'eligibilite
// cote SQL (source de verite unique des regles), on ne fait que grouper.
export function useBookingBadges(bookingIds: string[]) {
  return useQuery({
    queryKey: ['booking-badges', bookingIds],
    queryFn: async () => {
      const map = new Map<string, BookingBadge[]>()
      if (!bookingIds.length) return map
      const { data, error } = await supabase
        .from('booking_badges')
        .select('booking_id, badge_type, depuis')
        .in('booking_id', bookingIds)
      if (error) throw error
      for (const row of (data ?? []) as BookingBadge[]) {
        const list = map.get(row.booking_id) ?? []
        list.push(row)
        map.set(row.booking_id, list)
      }
      return map
    },
    enabled: bookingIds.length > 0,
  })
}

function useMarkBadge(
  column: 'relance_traitee_le' | 'retour_experience_fait_le',
  actionType: 'booking.relance_traitee' | 'booking.retour_experience_fait'
) {
  const queryClient = useQueryClient()
  const { mutate: logActivity } = useLogActivity()
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await (supabase.from('bookings') as any)
        .update({ [column]: new Date().toISOString() })
        .eq('id', bookingId)
      if (error) throw error
      return bookingId
    },
    onSuccess: (bookingId: string) => {
      logActivity({
        bookingId,
        actionType,
        actionLabel: ACTION_LABELS[actionType],
        entityType: 'booking',
        entityId: bookingId,
      })
      queryClient.invalidateQueries({ queryKey: ['booking-badges'] })
      queryClient.invalidateQueries({ queryKey: ['bookings-paged'] })
      queryClient.invalidateQueries({ queryKey: ['bookings', bookingId] })
    },
  })
}

export function useMarkRelanceTraitee() {
  return useMarkBadge('relance_traitee_le', 'booking.relance_traitee')
}

export function useMarkRetourExperienceFait() {
  return useMarkBadge(
    'retour_experience_fait_le',
    'booking.retour_experience_fait'
  )
}
