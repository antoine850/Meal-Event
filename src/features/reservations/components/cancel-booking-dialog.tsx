import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CANCELLATION_REASONS } from '../data/cancellation-reasons'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  count?: number
  defaultReason?: string | null
  defaultComment?: string | null
  onConfirm: (reason: string, comment: string | null) => void
}

export function CancelBookingDialog({
  open,
  onOpenChange,
  count = 1,
  defaultReason,
  defaultComment,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')

  // Ne pas mettre defaultReason/defaultComment en dep : un refetch cote
  // parent pendant que la modale est ouverte ecraserait la saisie en cours.
  useEffect(() => {
    if (open) {
      setReason(defaultReason || '')
      setComment(defaultComment || '')
    }
  }, [open])

  // "Autre" sans commentaire devient la case fourre-tout qu'on coche pour
  // passer, et la repartition ne vaut plus rien.
  const canConfirm = reason !== '' && (reason !== 'autre' || comment.trim() !== '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Motif d'annulation</DialogTitle>
          <DialogDescription>
            {count > 1
              ? `${count} événements vont être annulés avec ce motif.`
              : 'Le motif est obligatoire pour annuler un événement.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='cancel-reason'>Motif</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id='cancel-reason'>
                <SelectValue placeholder='Choisir un motif' />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='cancel-comment'>
              Commentaire {reason === 'autre' ? '(obligatoire)' : '(facultatif)'}
            </Label>
            <Textarea
              id='cancel-comment'
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder='Précisions utiles au suivi'
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Retour
          </Button>
          <Button
            disabled={!canConfirm}
            onClick={() => {
              onConfirm(reason, comment.trim() || null)
              onOpenChange(false)
            }}
          >
            Confirmer l'annulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
