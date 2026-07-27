import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Paperclip, Send, X } from 'lucide-react'
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

// Caps alignes sur parseAttachments cote backend.
const MAX_ATTACHMENTS = 5
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_TOTAL_BYTES = 15 * 1024 * 1024

const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(bytes / 1024))} Ko`

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    // readAsDataURL -> "data:<mime>;base64,<contenu>" : on ne garde que le contenu
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

// Composer generique gate par l'appelant (integration_enabled + connected).
// Cible un booking OU un contact ; pre-remplissable (menu templates).
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
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  useEffect(() => {
    if (open) {
      setSubject(defaultSubject)
      setMessage(defaultMessage)
      setFiles([])
    }
  }, [open, defaultSubject, defaultMessage])

  const addFiles = (picked: FileList | null) => {
    if (!picked?.length) return
    const next = [...files]
    for (const f of Array.from(picked)) {
      if (next.length >= MAX_ATTACHMENTS) {
        toast.error(`${MAX_ATTACHMENTS} pièces jointes maximum`)
        break
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name} dépasse 10 Mo`)
        continue
      }
      if (next.reduce((s, x) => s + x.size, 0) + f.size > MAX_TOTAL_BYTES) {
        toast.error('Pièces jointes : 15 Mo maximum au total')
        break
      }
      next.push(f)
    }
    setFiles(next)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const send = useMutation({
    mutationFn: async () => {
      const attachments = await Promise.all(
        files.map(async (f) => ({
          filename: f.name,
          contentBase64: await toBase64(f),
          contentType: f.type || undefined,
        }))
      )
      return apiClient('/api/emails/send', {
        method: 'POST',
        body: {
          bookingId,
          contactId,
          subject,
          message,
          attachments: attachments.length ? attachments : undefined,
        },
      })
    },
    onSuccess: () => {
      toast.success('Email envoyé')
      if (bookingId) {
        qc.invalidateQueries({ queryKey: ['email_thread', bookingId] })
        qc.invalidateQueries({ queryKey: ['email_logs', bookingId] })
      }
      if (contactId) {
        qc.invalidateQueries({ queryKey: ['email_thread_contact', contactId] })
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
          {files.length > 0 && (
            <ul className='space-y-1'>
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className='flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-sm'
                >
                  <Paperclip className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                  <span className='min-w-0 flex-1 truncate'>{f.name}</span>
                  <span className='shrink-0 text-xs text-muted-foreground'>
                    {fmtSize(f.size)}
                  </span>
                  <button
                    type='button'
                    aria-label={`Retirer ${f.name}`}
                    className='shrink-0 text-muted-foreground hover:text-foreground'
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileInputRef}
            type='file'
            multiple
            className='hidden'
            onChange={(e) => addFiles(e.target.files)}
          />
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className='mr-2 h-4 w-4' />
            Joindre un fichier
          </Button>
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
