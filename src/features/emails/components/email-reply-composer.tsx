import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// Rendu uniquement quand integration_enabled (gate dans booking-emails-tab).
export function EmailReplyComposer({ bookingId }: { bookingId: string }) {
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()

  const reply = useMutation({
    mutationFn: () =>
      apiClient('/api/emails/reply', {
        method: 'POST',
        body: { bookingId, message },
      }),
    onSuccess: () => {
      setMessage('')
      toast.success('Réponse envoyée')
      queryClient.invalidateQueries({ queryKey: ['email_thread', bookingId] })
      queryClient.invalidateQueries({ queryKey: ['email_logs', bookingId] })
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi"),
  })

  return (
    <div className='space-y-2'>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder='Répondre au client...'
        rows={4}
      />
      <div className='flex justify-end'>
        <Button
          size='sm'
          disabled={!message.trim() || reply.isPending}
          onClick={() => reply.mutate()}
        >
          {reply.isPending ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Send className='mr-2 h-4 w-4' />
          )}
          Envoyer
        </Button>
      </div>
    </div>
  )
}
