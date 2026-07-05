import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EmailLog } from '@/lib/supabase/types'

export function useEmailLogsByBooking(bookingId: string | null) {
  return useQuery({
    queryKey: ['email_logs', bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('email_logs') as any)
        .select('*')
        .eq('booking_id', bookingId!)
        .order('sent_at', { ascending: false })

      if (error) throw error
      return data as EmailLog[]
    },
  })
}
