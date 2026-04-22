import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, Paperclip, X, ExternalLink, Mail, CheckCircle2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Payment } from '@/lib/supabase/types'
import { apiClient } from '@/lib/api-client'
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
  { value: 'paid', label: 'Payé' },
  { value: 'failed', label: 'Échoué' },
]

const PAYMENT_MODALITIES = [
  { value: 'acompte', label: 'Acompte' },
  { value: 'solde', label: 'Solde' },
  { value: 'caution', label: 'Caution' },
  { value: 'extra', label: 'Extra' },
  { value: 'autre', label: 'Autre' },
]

type StripeMode = 'link' | 'collected' | null

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  payment?: Payment | null
  contactEmail?: string | null
  primaryQuoteId?: string | null
}

export function PaymentDialog({ open, onOpenChange, bookingId, payment, contactEmail, primaryQuoteId }: Props) {
  const queryClient = useQueryClient()
  const { mutate: createPayment, isPending: isCreating } = useCreatePayment()
  const { mutate: updatePayment, isPending: isUpdating } = useUpdatePayment()
  const { mutate: deletePayment, isPending: isDeleting } = useDeletePayment()

  const [amount, setAmount] = useState('')
  const [paymentType, setPaymentType] = useState('virement')
  const [paymentModality, setPaymentModality] = useState('acompte')
  const [status, setStatus] = useState('pending')
  const [paidAt, setPaidAt] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Stripe-specific state (only used when paymentType === 'stripe' and creating)
  const [stripeMode, setStripeMode] = useState<StripeMode>(null)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkModality, setLinkModality] = useState<'acompte' | 'solde' | 'autre'>('acompte')
  const [isCreatingLink, setIsCreatingLink] = useState(false)

  const isEditing = !!payment
  const isStripePayment = isEditing && payment?.payment_method === 'stripe'
  const isStripeCreate = !isEditing && paymentType === 'stripe'
  const isPending = isCreating || isUpdating || isDeleting || isCreatingLink

  // Reset form when dialog opens or payment changes
  useEffect(() => {
    if (open) {
      if (payment) {
        setAmount(String(payment.amount || ''))
        setPaymentType(payment.payment_type || 'virement')
        setPaymentModality(payment.payment_modality || 'acompte')
        setStatus(payment.status || 'pending')
        setPaidAt(payment.paid_at ? payment.paid_at.split('T')[0] : '')
        setNotes(payment.notes || '')
        setFile(null)
        setRemoveAttachment(false)
        setStripeMode(null)
      } else {
        setAmount('')
        setPaymentType('virement')
        setPaymentModality('acompte')
        setStatus('pending')
        setPaidAt(new Date().toISOString().split('T')[0])
        setNotes('')
        setFile(null)
        setRemoveAttachment(false)
        setStripeMode(null)
        setLinkEmail(contactEmail || '')
        setLinkModality('acompte')
      }
    }
  }, [open, payment, contactEmail])

  // When user picks Stripe for a new payment, keep modality in sync
  useEffect(() => {
    if (isStripeCreate && stripeMode === 'link') {
      const current = paymentModality === 'acompte' || paymentModality === 'solde' ? paymentModality : 'autre'
      setLinkModality(current)
    }
  }, [stripeMode, paymentModality, isStripeCreate])

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
        paymentModality,
        status,
        paidAt: paidAt || null,
        notes: notes || null,
        file: file || undefined,
        removeAttachment,
        currentAttachmentPath: (payment as any).attachment_path,
      }, {
        onSuccess: () => {
          toast.success('Paiement mis à jour')
          onOpenChange(false)
        },
        onError: () => toast.error('Erreur lors de la mise à jour'),
      })
      return
    }

    // Create mode: if Stripe is selected, require a sub-choice
    if (isStripeCreate && stripeMode === null) {
      toast.error('Choisissez d\'abord une option Stripe')
      return
    }

    if (isStripeCreate && stripeMode === 'link') {
      handleCreateStripeLink(amountNum)
      return
    }

    // Default: record the payment directly (collected cases and non-stripe types)
    createPayment({
      bookingId,
      amount: amountNum,
      paymentType,
      paymentModality,
      paymentMethod: isStripeCreate ? 'stripe' : undefined,
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

  const handleCreateStripeLink = async (amountNum: number) => {
    const email = linkEmail.trim()
    if (!email) {
      toast.error('Veuillez renseigner l\'adresse email du client')
      return
    }

    const linkType = linkModality === 'acompte' ? 'deposit' : linkModality === 'solde' ? 'balance' : 'full'

    setIsCreatingLink(true)
    try {
      await apiClient('/api/payments/create-link', {
        method: 'POST',
        body: {
          booking_id: bookingId,
          quote_id: primaryQuoteId || null,
          amount: amountNum,
          link_type: linkType,
          payment_modality: linkModality,
          send_email: true,
          contact_email_override: email,
          notes: notes || null,
        },
      })

      toast.success(`Lien de paiement envoyé à ${email}`)
      // Refresh payments list and bookings
      queryClient.invalidateQueries({ queryKey: ['payments', bookingId] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      onOpenChange(false)
    } catch (err) {
      console.error('[PaymentDialog] create-link error:', err)
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création du lien')
    } finally {
      setIsCreatingLink(false)
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

  // Stripe "link" mode: show a simpler form
  const showStripeLinkForm = isStripeCreate && stripeMode === 'link'
  // Stripe "collected" mode: show full form with payment_method='stripe' forced
  const showStripeCollectedForm = isStripeCreate && stripeMode === 'collected'
  // Stripe with no mode selected yet: show the radio choice
  const showStripeChoice = isStripeCreate && stripeMode === null
  // Non-stripe or edit: show the standard form
  const showStandardForm = !isStripeCreate || stripeMode === 'collected'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>
            {isStripePayment
              ? 'Détails du paiement Stripe'
              : isEditing
              ? 'Modifier le paiement'
              : showStripeLinkForm
              ? 'Nouveau lien de paiement'
              : 'Ajouter un paiement'}
          </DialogTitle>
        </DialogHeader>

        {isStripePayment && (
          <p className='text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2'>
            Ce paiement a été créé automatiquement via Stripe et ne peut pas être modifié.
          </p>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Amount — shown in all creation modes except the pure choice step */}
          {(!showStripeChoice || true) && (
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
                disabled={isStripePayment}
              />
            </div>
          )}

          {/* Payment Type — hidden when we're on the Stripe link-flow fields */}
          {!showStripeLinkForm && (
            <div className='space-y-2'>
              <Label>Type de paiement *</Label>
              <Select
                value={paymentType}
                onValueChange={(v) => {
                  setPaymentType(v)
                  // Reset stripe mode if we toggle away from / back to stripe
                  if (v !== 'stripe') setStripeMode(null)
                }}
                disabled={isStripePayment}
              >
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
          )}

          {/* Stripe choice UI — appears right under the Stripe type, before the rest of the form */}
          {showStripeChoice && (
            <div className='space-y-2 rounded-md border border-dashed border-input bg-muted/30 px-3 py-3'>
              <Label className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                Paiement Stripe
              </Label>
              <RadioGroup
                value={stripeMode || ''}
                onValueChange={(v) => setStripeMode(v as StripeMode)}
                className='gap-2'
              >
                <label className='flex items-start gap-3 rounded-md border border-input bg-background px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors'>
                  <RadioGroupItem value='link' id='stripe-mode-link' className='mt-0.5' />
                  <div className='flex-1 space-y-0.5'>
                    <div className='flex items-center gap-1.5 text-sm font-medium'>
                      <Mail className='h-3.5 w-3.5' />
                      Créer un lien et l'envoyer par email
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      Génère un lien Stripe Checkout et l'envoie au client. Le paiement sera marqué comme payé automatiquement une fois réglé.
                    </p>
                  </div>
                </label>
                <label className='flex items-start gap-3 rounded-md border border-input bg-background px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors'>
                  <RadioGroupItem value='collected' id='stripe-mode-collected' className='mt-0.5' />
                  <div className='flex-1 space-y-0.5'>
                    <div className='flex items-center gap-1.5 text-sm font-medium'>
                      <CheckCircle2 className='h-3.5 w-3.5' />
                      Paiement Stripe déjà encaissé
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      Enregistre manuellement un paiement déjà reçu via Stripe (hors lien généré depuis l'application).
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}

          {/* Stripe link form — minimal fields */}
          {showStripeLinkForm && (
            <>
              <div className='space-y-2'>
                <Label>Modalité *</Label>
                <Select value={linkModality} onValueChange={(v) => setLinkModality(v as 'acompte' | 'solde' | 'autre')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='acompte'>Acompte</SelectItem>
                    <SelectItem value='solde'>Solde</SelectItem>
                    <SelectItem value='autre'>Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='link-email'>Email du destinataire *</Label>
                <Input
                  id='link-email'
                  type='email'
                  value={linkEmail}
                  onChange={e => setLinkEmail(e.target.value)}
                  placeholder='client@example.com'
                  required
                />
                {!contactEmail && (
                  <p className='text-xs text-muted-foreground'>
                    Le contact n'a pas d'email enregistré. Renseignez une adresse pour l'envoi.
                  </p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='link-notes'>Note interne (optionnel)</Label>
                <Textarea
                  id='link-notes'
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder='Visible uniquement par votre équipe...'
                  className='min-h-[60px]'
                />
              </div>

              <p className='text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2'>
                Un email avec le lien de paiement sécurisé sera envoyé au client. Un paiement en attente sera créé et passera automatiquement au statut « Payé » dès le règlement.
              </p>
            </>
          )}

          {/* Standard form fields — hidden during the Stripe link flow */}
          {(showStandardForm || isEditing) && (
            <>
              {/* Payment Modality */}
              <div className='space-y-2'>
                <Label>Modalité *</Label>
                <Select value={paymentModality} onValueChange={setPaymentModality} disabled={isStripePayment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODALITIES.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className='space-y-2'>
                <Label>Statut *</Label>
                <Select value={status} onValueChange={setStatus} disabled={isStripePayment}>
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
                <Label>Date de paiement</Label>
                <DatePicker
                  value={paidAt}
                  onChange={setPaidAt}
                  placeholder='Sélectionner...'
                  disabled={isStripePayment}
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
                  disabled={isStripePayment}
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
                {((payment as any)?.attachment_url && !removeAttachment && !file) ? (
                  <div className='flex items-center gap-2 p-2 border rounded-md bg-muted/50'>
                    <Paperclip className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm flex-1 truncate'>Fichier attaché</span>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='h-7 w-7 p-0'
                      onClick={() => window.open((payment as any).attachment_url!, '_blank')}
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

              {showStripeCollectedForm && (
                <p className='text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2'>
                  Ce paiement sera enregistré avec la méthode « Stripe ». Aucun lien ne sera envoyé.
                </p>
              )}
            </>
          )}

          {/* Actions */}
          <div className='flex justify-between pt-4'>
            {isStripePayment ? (
              <>
                <div />
                <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                  Fermer
                </Button>
              </>
            ) : (
              <>
                {isEditing ? (
                  <Button
                    type='button'
                    variant='destructive'
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    {isDeleting ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Supprimer'}
                  </Button>
                ) : showStripeLinkForm || showStripeCollectedForm ? (
                  <Button
                    type='button'
                    variant='ghost'
                    onClick={() => setStripeMode(null)}
                    disabled={isPending}
                  >
                    Retour
                  </Button>
                ) : (
                  <div />
                )}
                <div className='flex gap-2'>
                  <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
                    Annuler
                  </Button>
                  <Button type='submit' disabled={isPending || (isStripeCreate && stripeMode === null)}>
                    {isCreating || isUpdating || isCreatingLink ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : isEditing ? (
                      'Mettre à jour'
                    ) : showStripeLinkForm ? (
                      'Générer et envoyer'
                    ) : (
                      'Ajouter'
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
