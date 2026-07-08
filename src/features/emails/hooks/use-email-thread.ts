import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EmailMessage, EmailThread } from '@/lib/supabase/types'

export interface BookingEmailThread {
  thread: Pick<EmailThread, 'id' | 'subject' | 'last_message_at'> | null
  messages: EmailMessage[]
}

// Fil du booking (kind='booking', unique par booking) + messages ordonnes.
// RLS select_org fait l'isolation. Refetch periodique : les reponses arrivent
// par polling backend (~3 min), pas besoin de realtime.
export function useBookingEmailThread(bookingId: string | null) {
  return useQuery<BookingEmailThread>({
    queryKey: ['email_thread', bookingId],
    enabled: !!bookingId,
    refetchInterval: 45_000,
    queryFn: async () => {
      const { data: thread, error } = await supabase
        .from('email_threads')
        .select('id, subject, last_message_at')
        .eq('booking_id', bookingId!)
        .eq('kind', 'booking')
        .maybeSingle()
      if (error) throw error
      if (!thread) return { thread: null, messages: [] }

      const { data: messages, error: msgError } = await supabase
        .from('email_messages')
        .select('*')
        .eq('thread_id', thread.id)
        .order('sent_at', { ascending: true, nullsFirst: true })
      if (msgError) throw msgError
      return { thread, messages: (messages ?? []) as EmailMessage[] }
    },
  })
}
