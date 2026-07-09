import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'

function isUnread(
  lastInbound: string | null,
  lastRead: string | null
): boolean {
  if (!lastInbound) return false
  return !lastRead || new Date(lastInbound) > new Date(lastRead)
}

// Set des booking_id ayant une reponse non lue. Une requete partagee (React
// Query dedupe entre les lignes de la liste). Ne porte que sur les fils avec
// un entrant : volume faible.
export function useUnreadBookingThreads() {
  return useQuery({
    queryKey: ['email_threads_unread'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_threads')
        .select('booking_id, last_inbound_at, last_read_at')
        .eq('kind', 'booking')
        .not('booking_id', 'is', null)
        .not('last_inbound_at', 'is', null)
      if (error) throw error
      const unread = new Set<string>()
      for (const t of data ?? []) {
        if (t.booking_id && isUnread(t.last_inbound_at, t.last_read_at)) {
          unread.add(t.booking_id)
        }
      }
      return unread
    },
  })
}

// Meta du fil booking pour le badge de l'onglet + la decision de marquer lu.
export function useThreadMeta(bookingId: string | null) {
  return useQuery({
    queryKey: ['email_thread_meta', bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data } = await supabase
        .from('email_threads')
        .select('id, last_inbound_at, last_read_at')
        .eq('booking_id', bookingId!)
        .eq('kind', 'booking')
        .maybeSingle()
      if (!data) return null
      return {
        ...data,
        unread: isUnread(data.last_inbound_at, data.last_read_at),
      }
    },
  })
}

// Meta du fil contact-only (pastille onglet fiche contact + marquage lu).
// Prefixe 'email_thread_meta' partage : invalide par useMarkThreadRead.
export function useContactThreadMeta(contactId: string | null) {
  return useQuery({
    queryKey: ['email_thread_meta', 'contact', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data } = await supabase
        .from('email_threads')
        .select('id, last_inbound_at, last_read_at')
        .eq('contact_id', contactId!)
        .eq('kind', 'contact')
        .is('booking_id', null)
        .eq('status', 'open')
        .maybeSingle()
      if (!data) return null
      return {
        ...data,
        unread: isUnread(data.last_inbound_at, data.last_read_at),
      }
    },
  })
}

export function useMarkThreadRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (threadId: string) =>
      apiClient(`/api/emails/threads/${threadId}/read`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email_threads_unread'] })
      qc.invalidateQueries({ queryKey: ['email_thread_meta'] })
    },
  })
}
