import { useState, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Payment } from '@/lib/supabase/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  computeCreditNote,
  computeLineAmounts,
  formatEuroAdaptive,
  type CreditItemInput,
  type LineAmountsInput,
} from '@/features/reservations/lib/quote-rounding'
import { useCreateCreditNote, type QuoteWithItems } from '../hooks/use-quotes'

type Props = {
  quote: QuoteWithItems
  payments: Payment[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreditNoteDialog({
  quote,
  payments,
  open,
  onOpenChange,
}: Props) {
  const { mutate: createCreditNote, isPending } = useCreateCreditNote()

  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const items = useMemo(() => quote.quote_items ?? [], [quote.quote_items])

  // Somme des paiements encaisses (acompte + solde), pour le solde restant et le trop-percu.
  const collected = useMemo(
    () =>
      payments
        .filter((p) => p.status === 'paid' || p.status === 'completed')
        .reduce((s, p) => s + (p.amount || 0), 0),
    [payments]
  )

  useEffect(() => {
    if (open) {
      setChecked({})
      setAmounts({})
      setReason('')
      setConfirmOpen(false)
    }
  }, [open])

  const lineTtc = (item: LineAmountsInput) => computeLineAmounts(item).totalTtc

  const toggle = (item: (typeof items)[number]) => {
    const id = item.id
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      return next
    })
    setAmounts((prev) =>
      prev[id] != null ? prev : { ...prev, [id]: String(lineTtc(item)) }
    )
  }

  // Credits actifs = lignes cochees avec un montant > 0.
  const creditsByItemId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of items) {
      if (!checked[item.id]) continue
      const raw = amounts[item.id]
      const value = raw != null ? parseFloat(raw) : lineTtc(item)
      if (!isNaN(value) && value > 0) map[item.id] = value
    }
    return map
  }, [items, checked, amounts])

  const result = useMemo(
    () =>
      computeCreditNote(
        items as unknown as CreditItemInput[],
        creditsByItemId,
        quote.discount_percentage ?? 0,
        collected
      ),
    [items, creditsByItemId, quote.discount_percentage, collected]
  )

  const hasCredits = Object.keys(creditsByItemId).length > 0
  const newSolde = Math.max(0, result.newEffectiveTtc - collected)
  const engaged = collected > 0

  const handleConfirm = () => {
    const credits = Object.entries(creditsByItemId).map(
      ([quote_item_id, credited_ttc]) => ({ quote_item_id, credited_ttc })
    )
    createCreditNote(
      { quoteId: quote.id, bookingId: quote.booking_id!, credits, reason },
      {
        onSuccess: () => {
          toast.success('Avoir émis')
          setConfirmOpen(false)
          onOpenChange(false)
        },
        onError: () => toast.error("Erreur lors de l'émission de l'avoir"),
      }
    )
  }

  const confirmText = engaged
    ? `Avoir de ${formatEuroAdaptive(result.avoirTtc)} sur ${quote.quote_number} : devis ramené à ${formatEuroAdaptive(result.newEffectiveTtc)}, ${
        result.overpaidTtc > 0
          ? `trop-perçu ${formatEuroAdaptive(result.overpaidTtc)}`
          : `solde réduit à ${formatEuroAdaptive(newSolde)}`
      }. Document fiscal, irréversible.`
    : 'Aucune facture émise, tu peux simplement modifier le devis. Émettre un avoir quand même ?'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-[560px]'>
          <DialogHeader>
            <DialogTitle>Générer une facture d'avoir</DialogTitle>
            <DialogDescription>
              Sélectionne les prestations à créditer. Le montant de l'avoir est
              la réduction réelle du devis.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-3'>
            <div className='space-y-2'>
              {items.map((item) => {
                const isExtra = item.item_type === 'extra'
                const isChecked = !!checked[item.id]
                return (
                  <div
                    key={item.id}
                    className='flex items-center gap-3 rounded-md border px-3 py-2'
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggle(item)}
                    />
                    <div className='flex-1 space-y-0.5'>
                      <div className='flex items-center gap-2 text-sm font-medium'>
                        {item.name}
                        {isExtra && (
                          <span className='rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground'>
                            Extra
                          </span>
                        )}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {formatEuroAdaptive(lineTtc(item))} TTC
                      </div>
                    </div>
                    {isChecked && (
                      <div className='flex items-center gap-1'>
                        <Input
                          type='number'
                          step='0.01'
                          min='0'
                          className='h-8 w-28'
                          value={amounts[item.id] ?? String(lineTtc(item))}
                          onChange={(e) =>
                            setAmounts((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                        />
                        <span className='text-xs text-muted-foreground'>€</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='credit-reason'>Motif</Label>
              <Textarea
                id='credit-reason'
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motif de l'avoir..."
                className='min-h-[60px]'
              />
            </div>

            <div className='space-y-1 rounded-md bg-muted/50 px-3 py-3 text-sm'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>
                  Montant de l'avoir
                </span>
                <span className='font-medium'>
                  {formatEuroAdaptive(result.avoirTtc)}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Nouveau total</span>
                <span>{formatEuroAdaptive(result.newEffectiveTtc)}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Nouveau solde</span>
                <span>{formatEuroAdaptive(newSolde)}</span>
              </div>
              {result.overpaidTtc > 0 && (
                <div className='flex justify-between text-destructive'>
                  <span>Trop-perçu</span>
                  <span className='font-medium'>
                    {formatEuroAdaptive(result.overpaidTtc)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              type='button'
              onClick={() => setConfirmOpen(true)}
              disabled={!hasCredits || isPending}
            >
              Émettre l'avoir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!o) setConfirmOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Émettre cette facture d'avoir ?</AlertDialogTitle>
            <AlertDialogDescription>{confirmText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirm()
              }}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                "Émettre l'avoir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
