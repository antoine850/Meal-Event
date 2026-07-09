import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EmailMessage, EmailThread } from '@/lib/supabase/types'

export interface EmailThreadData {
  thread: Pick<EmailThread, 'id' | 'subject' | 'last_message_at'> | null
  messages: EmailMessage[]
}

// Fil du booking (kind='booking', unique par booking) + messages ordonnes.
// RLS select_org fait l'isolation. Refetch periodique : les reponses arrivent
// par polling backend (~3 min), pas besoin de realtime.
export function useBookingEmailThread(bookingId: string | null) {
  return useQuery<EmailThreadData>({
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
      return loadMessages(thread)
    },
  })
}

// Fil contact-only ouvert (emails ponctuels hors evenement). Memes filtres que
// getOrCreateThread cote backend : kind='contact', booking_id null, status open.
export function useContactEmailThread(contactId: string | null) {
  return useQuery<EmailThreadData>({
    queryKey: ['email_thread_contact', contactId],
    enabled: !!contactId,
    refetchInterval: 45_000,
    queryFn: async () => {
      const { data: thread, error } = await supabase
        .from('email_threads')
        .select('id, subject, last_message_at')
        .eq('contact_id', contactId!)
        .eq('kind', 'contact')
        .is('booking_id', null)
        .eq('status', 'open')
        .maybeSingle()
      if (error) throw error
      return loadMessages(thread)
    },
  })
}

async function loadMessages(
  thread: EmailThreadData['thread']
): Promise<EmailThreadData> {
  if (!thread) return { thread: null, messages: [] }
  const { data: messages, error } = await supabase
    .from('email_messages')
    .select('*')
    .eq('thread_id', thread.id)
    .order('sent_at', { ascending: true, nullsFirst: true })
  if (error) throw error
  return { thread, messages: (messages ?? []) as EmailMessage[] }
}
