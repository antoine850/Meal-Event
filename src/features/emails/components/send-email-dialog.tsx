import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// Composer generique gate par l'appelant (integration_enabled). Cible un
// booking OU un contact ; pre-remplissable (menu templates).
export function SendEmailDialog({
  open,
  onOpenChange,
  bookingId,
  contactId,
  defaultSubject = '',
  defaultMessage = '',
  onSent,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  bookingId?: string
  contactId?: string
  defaultSubject?: string
  defaultMessage?: string
  onSent?: () => void
}) {
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState(defaultMessage)
  const qc = useQueryClient()

  useEffect(() => {
    if (open) {
      setSubject(defaultSubject)
      setMessage(defaultMessage)
    }
  }, [open, defaultSubject, defaultMessage])

  const send = useMutation({
    mutationFn: () =>
      apiClient('/api/emails/send', {
        method: 'POST',
        body: { bookingId, contactId, subject, message },
      }),
    onSuccess: () => {
      toast.success('Email envoyé')
      if (bookingId) {
        qc.invalidateQueries({ queryKey: ['email_thread', bookingId] })
        qc.invalidateQueries({ queryKey: ['email_logs', bookingId] })
      }
      onOpenChange(false)
      onSent?.()
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi"),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Envoyer un email</DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder='Objet'
          />
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='Message...'
            rows={8}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={!subject.trim() || !message.trim() || send.isPending}
            onClick={() => send.mutate()}
          >
            {send.isPending ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <Send className='mr-2 h-4 w-4' />
            )}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
