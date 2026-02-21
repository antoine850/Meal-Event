import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, Paperclip, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Payment } from '@/lib/supabase/types'
import { useCreatePayment, useUpdatePayment, useDeletePayment } from '../hooks/use-bookings'

const PAYMENT_TYPES = [
  { value: 'lien_paiement', label: 'Lien de Paiement' },
  { value: 'virement', label: 'Virement Bancaire' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'cb_restaurant', label: 'CB Restaurant' },
  { value: 'cash', label: 'Cash Restaurant' },
]

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'completed', label: 'Payé' },
  { value: 'failed', label: 'Échoué' },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  payment?: Payment | null
}

export function PaymentDialog({ open, onOpenChange, bookingId, payment }: Props) {
  const { mutate: createPayment, isPending: isCreating } = useCreatePayment()
  const { mutate: updatePayment, isPending: isUpdating } = useUpdatePayment()
  const { mutate: deletePayment, isPending: isDeleting } = useDeletePayment()

  const [amount, setAmount] = useState('')
  const [paymentType, setPaymentType] = useState('virement')
  const [status, setStatus] = useState('pending')
  const [paidAt, setPaidAt] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEditing = !!payment
  const isPending = isCreating || isUpdating || isDeleting

  // Reset form when dialog opens or payment changes
  useEffect(() => {
    if (open) {
      if (payment) {
        setAmount(String(payment.amount || ''))
        setPaymentType(payment.payment_type || 'virement')
        setStatus(payment.status || 'pending')
        setPaidAt(payment.paid_at ? payment.paid_at.split('T')[0] : '')
        setNotes(payment.notes || '')
        setFile(null)
        setRemoveAttachment(false)
      } else {
        setAmount('')
        setPaymentType('virement')
        setStatus('pending')
        setPaidAt(new Date().toISOString().split('T')[0])
        setNotes('')
        setFile(null)
        setRemoveAttachment(false)
      }
    }
  }, [open, payment])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Veuillez entrer un montant valide')
      return
    }

    if (isEditing && payment) {
      updatePayment({
        id: payment.id,
        bookingId,
        amount: amountNum,
        paymentType,
        status,
        paidAt: paidAt || null,
        notes: notes || null,
        file: file || undefined,
        removeAttachment,
        currentAttachmentPath: payment.attachment_path,
      }, {
        onSuccess: () => {
          toast.success('Paiement mis à jour')
          onOpenChange(false)
        },
        onError: () => toast.error('Erreur lors de la mise à jour'),
      })
    } else {
      createPayment({
        bookingId,
        amount: amountNum,
        paymentType,
        status,
        paidAt: paidAt || undefined,
        notes: notes || undefined,
        file: file || undefined,
      }, {
        onSuccess: () => {
          toast.success('Paiement ajouté')
          onOpenChange(false)
        },
        onError: () => toast.error('Erreur lors de la création'),
      })
    }
  }

  const handleDelete = () => {
    if (!payment) return
    deletePayment({ id: payment.id, bookingId }, {
      onSuccess: () => {
        toast.success('Paiement supprimé')
        onOpenChange(false)
      },
      onError: () => toast.error('Erreur lors de la suppression'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifier le paiement' : 'Ajouter un paiement'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Amount */}
          <div className='space-y-2'>
            <Label htmlFor='amount'>Montant (€) *</Label>
            <Input
              id='amount'
              type='number'
              step='0.01'
              min='0'
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder='0.00'
              required
            />
          </div>

          {/* Payment Type */}
          <div className='space-y-2'>
            <Label>Type de paiement *</Label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className='space-y-2'>
            <Label>Statut *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Paid At */}
          <div className='space-y-2'>
            <Label htmlFor='paidAt'>Date de paiement</Label>
            <Input
              id='paidAt'
              type='date'
              value={paidAt}
              onChange={e => setPaidAt(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className='space-y-2'>
            <Label htmlFor='notes'>Notes</Label>
            <Textarea
              id='notes'
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder='Notes optionnelles...'
              className='min-h-[80px]'
            />
          </div>

          {/* File Attachment */}
          <div className='space-y-2'>
            <Label>Pièce jointe (reçu, photo...)</Label>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*,.pdf'
              className='hidden'
              onChange={e => {
                const selectedFile = e.target.files?.[0]
                if (selectedFile) {
                  setFile(selectedFile)
                  setRemoveAttachment(false)
                }
              }}
            />
            
            {/* Show existing attachment or new file */}
            {(payment?.attachment_url && !removeAttachment && !file) ? (
              <div className='flex items-center gap-2 p-2 border rounded-md bg-muted/50'>
                <Paperclip className='h-4 w-4 text-muted-foreground' />
                <span className='text-sm flex-1 truncate'>Fichier attaché</span>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-7 w-7 p-0'
                  onClick={() => window.open(payment.attachment_url!, '_blank')}
                >
                  <ExternalLink className='h-3.5 w-3.5' />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-7 w-7 p-0 text-destructive hover:text-destructive'
                  onClick={() => setRemoveAttachment(true)}
                >
                  <X className='h-3.5 w-3.5' />
                </Button>
              </div>
            ) : file ? (
              <div className='flex items-center gap-2 p-2 border rounded-md bg-muted/50'>
                <Paperclip className='h-4 w-4 text-muted-foreground' />
                <span className='text-sm flex-1 truncate'>{file.name}</span>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-7 w-7 p-0 text-destructive hover:text-destructive'
                  onClick={() => {
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  <X className='h-3.5 w-3.5' />
                </Button>
              </div>
            ) : (
              <Button
                type='button'
                variant='outline'
                className='w-full gap-2'
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className='h-4 w-4' />
                Ajouter un fichier
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className='flex justify-between pt-4'>
            {isEditing ? (
              <Button
                type='button'
                variant='destructive'
                onClick={handleDelete}
                disabled={isPending}
              >
                {isDeleting ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Supprimer'}
              </Button>
            ) : (
              <div />
            )}
            <div className='flex gap-2'>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
                Annuler
              </Button>
              <Button type='submit' disabled={isPending}>
                {(isCreating || isUpdating) ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : isEditing ? 'Mettre à jour' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
