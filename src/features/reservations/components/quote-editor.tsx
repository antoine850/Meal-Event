import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  FileText,
  Loader2,
  Package,
  Plus,
  ReceiptText,
  Trash2,
  User,
  ExternalLink,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { QuoteItem } from '@/lib/supabase/types'
import type { BookingWithRelations } from '../hooks/use-bookings'
import type { Restaurant } from '@/features/settings/hooks/use-settings'
import {
  useUpdateQuote,
  useAddQuoteItem,
  useUpdateQuoteItem,
  useDeleteQuoteItem,
  useProductsByRestaurant,
  useQuoteWithItems,
  DEFAULT_CONDITIONS_DEVIS,
  DEFAULT_CONDITIONS_FACTURE,
  DEFAULT_CONDITIONS_ACOMPTE,
  DEFAULT_CONDITIONS_SOLDE,
} from '../hooks/use-quotes'
import { QuotePreview } from './quote-preview'
import { QuotePdfExportButton } from './quote-pdf-export'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteId: string | null
  booking: BookingWithRelations
  restaurant: Restaurant | null
  contact: { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; company?: { name: string; billing_address?: string | null; billing_city?: string | null; billing_postal_code?: string | null } | null } | null
}

export function QuoteEditor({ open, onOpenChange, quoteId, booking, restaurant, contact }: Props) {
  const { data: quoteData, isLoading } = useQuoteWithItems(quoteId)
  const { mutate: updateQuote } = useUpdateQuote()
  const { mutate: addQuoteItem, isPending: isAddingItem } = useAddQuoteItem()
  const { mutate: updateQuoteItem } = useUpdateQuoteItem()
  const { mutate: deleteQuoteItem } = useDeleteQuoteItem()
  const { data: catalogProducts = [] } = useProductsByRestaurant(restaurant?.id || null)

  // Local state for quote fields
  const [title, setTitle] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [discountPercentage, setDiscountPercentage] = useState(0)
  const [depositPercentage, setDepositPercentage] = useState(80)
  const [depositLabel, setDepositLabel] = useState('Acompte à signature')
  const [depositDays, setDepositDays] = useState(7)
  const [balanceLabel, setBalanceLabel] = useState('Solde')
  const [balanceDays, setBalanceDays] = useState(0)
  const [quoteDate, setQuoteDate] = useState('')
  const [quoteDueDays, setQuoteDueDays] = useState(7)
  const [invoiceDueDays, setInvoiceDueDays] = useState(0)
  const [commentsFr, setCommentsFr] = useState('')
  const [commentsEn, setCommentsEn] = useState('')
  const [conditionsDevis, setConditionsDevis] = useState('')
  const [conditionsFacture, setConditionsFacture] = useState('')
  const [conditionsAcompte, setConditionsAcompte] = useState('')
  const [conditionsSolde, setConditionsSolde] = useState('')
  const [language, setLanguage] = useState<'fr' | 'en'>('fr')
  const [activeTab, setActiveTab] = useState('general')
  const [activeCondition, setActiveCondition] = useState('devis')
  const [selectedProductId, setSelectedProductId] = useState('')

  // Initialize from quote data
  useEffect(() => {
    if (quoteData) {
      setTitle(quoteData.title || '')
      setDateStart(quoteData.date_start ? quoteData.date_start.split('T')[0] : '')
      setDateEnd(quoteData.date_end ? quoteData.date_end.split('T')[0] : '')
      setOrderNumber(quoteData.order_number || '')
      setDiscountPercentage(quoteData.discount_percentage || 0)
      setDepositPercentage(quoteData.deposit_percentage || 80)
      setDepositLabel(quoteData.deposit_label || 'Acompte à signature')
      setDepositDays(quoteData.deposit_days || 7)
      setBalanceLabel(quoteData.balance_label || 'Solde')
      setBalanceDays(quoteData.balance_days || 0)
      setQuoteDate(quoteData.quote_date || '')
      setQuoteDueDays(quoteData.quote_due_days || 7)
      setInvoiceDueDays(quoteData.invoice_due_days || 0)
      setCommentsFr(quoteData.comments_fr || '')
      setCommentsEn(quoteData.comments_en || '')
      setConditionsDevis(quoteData.conditions_devis || '')
      setConditionsFacture(quoteData.conditions_facture || '')
      setConditionsAcompte(quoteData.conditions_acompte || '')
      setConditionsSolde(quoteData.conditions_solde || '')
      setLanguage((quoteData.language as 'fr' | 'en') || 'fr')
    }
  }, [quoteData])

  const items = quoteData?.quote_items || []

  // Auto-save quote fields on blur
  const saveQuoteField = useCallback((field: string, value: any) => {
    if (!quoteId) return
    updateQuote({ id: quoteId, [field]: value } as any, {
      onError: () => toast.error('Erreur lors de la sauvegarde'),
    })
  }, [quoteId, updateQuote])

  // Add product from catalog
  const handleAddProduct = useCallback(() => {
    if (!quoteId || !selectedProductId) return
    const product = catalogProducts.find(p => p.id === selectedProductId)
    if (!product) return

    addQuoteItem({
      quoteId,
      name: product.name,
      description: product.description || undefined,
      quantity: 1,
      unitPrice: product.unit_price_ht,
      tvaRate: product.tva_rate,
      position: items.length,
    }, {
      onSuccess: () => {
        setSelectedProductId('')
        toast.success('Produit ajouté')
      },
      onError: () => toast.error('Erreur lors de l\'ajout'),
    })
  }, [quoteId, selectedProductId, catalogProducts, addQuoteItem, items.length])

  // Add manual product
  const handleAddManualProduct = useCallback(() => {
    if (!quoteId) return
    addQuoteItem({
      quoteId,
      name: 'Nouveau produit',
      quantity: 1,
      unitPrice: 0,
      tvaRate: 20,
      position: items.length,
    }, {
      onSuccess: () => toast.success('Produit ajouté'),
      onError: () => toast.error('Erreur lors de l\'ajout'),
    })
  }, [quoteId, addQuoteItem, items.length])

  // Update item field
  const handleUpdateItem = useCallback((itemId: string, field: string, value: any) => {
    if (!quoteId) return
    updateQuoteItem({ id: itemId, quoteId, [field]: value } as any, {
      onError: () => toast.error('Erreur lors de la mise à jour'),
    })
  }, [quoteId, updateQuoteItem])

  // Delete item
  const handleDeleteItem = useCallback((itemId: string) => {
    if (!quoteId) return
    deleteQuoteItem({ id: itemId, quoteId }, {
      onSuccess: () => toast.success('Produit supprimé'),
      onError: () => toast.error('Erreur lors de la suppression'),
    })
  }, [quoteId, deleteQuoteItem])

  // Load default conditions
  const handleLoadDefaultConditions = useCallback(() => {
    setConditionsDevis(DEFAULT_CONDITIONS_DEVIS)
    setConditionsFacture(DEFAULT_CONDITIONS_FACTURE)
    setConditionsAcompte(DEFAULT_CONDITIONS_ACOMPTE)
    setConditionsSolde(DEFAULT_CONDITIONS_SOLDE)
    if (quoteId) {
      updateQuote({
        id: quoteId,
        conditions_devis: DEFAULT_CONDITIONS_DEVIS,
        conditions_facture: DEFAULT_CONDITIONS_FACTURE,
        conditions_acompte: DEFAULT_CONDITIONS_ACOMPTE,
        conditions_solde: DEFAULT_CONDITIONS_SOLDE,
      } as any, {
        onSuccess: () => toast.success('Conditions par défaut chargées'),
      })
    }
  }, [quoteId, updateQuote])

  // Calculate totals
  const totalHt = items.reduce((sum, item) => sum + ((item.total_ht as number) || 0), 0)
  const totalTtc = items.reduce((sum, item) => sum + ((item.total_ttc as number) || 0), 0)
  const depositAmount = totalTtc * (depositPercentage / 100)
  const balanceAmount = totalTtc - depositAmount

  // Build preview data
  const previewData = {
    quote: quoteData ?? null,
    items,
    booking,
    restaurant,
    contact,
    title,
    dateStart,
    dateEnd,
    quoteDate,
    quoteDueDays,
    invoiceDueDays,
    depositPercentage,
    depositLabel,
    depositDays,
    balanceLabel,
    balanceDays,
    depositAmount,
    balanceAmount,
    totalHt,
    totalTtc,
    totalTva: totalTtc - totalHt,
    discountPercentage,
    orderNumber,
    commentsFr,
    commentsEn,
    conditionsDevis,
    conditionsFacture,
    conditionsAcompte,
    conditionsSolde,
    language,
  }

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-[95vw] h-[95vh] p-0 gap-0'>
          <div className='flex items-center justify-center h-full'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[95vw] h-[95vh] p-0 gap-0' showCloseButton={false}>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-3 border-b'>
          <div className='flex items-center gap-3'>
            <DialogTitle className='text-base'>
              {quoteData?.quote_number || 'Nouveau devis'}
            </DialogTitle>
            <Badge variant={quoteData?.status === 'draft' ? 'secondary' : quoteData?.status === 'sent' ? 'default' : 'outline'}>
              {quoteData?.status === 'draft' ? 'Brouillon' : quoteData?.status === 'sent' ? 'Envoyé' : quoteData?.status === 'signed' ? 'Signé' : quoteData?.status || 'Brouillon'}
            </Badge>
            <div className='flex items-center gap-1 ml-2'>
              <Button
                size='sm'
                variant={language === 'fr' ? 'default' : 'outline'}
                className='h-6 px-2 text-xs'
                onClick={() => { setLanguage('fr'); saveQuoteField('language', 'fr') }}
              >
                FR
              </Button>
              <Button
                size='sm'
                variant={language === 'en' ? 'default' : 'outline'}
                className='h-6 px-2 text-xs'
                onClick={() => { setLanguage('en'); saveQuoteField('language', 'en') }}
              >
                EN
              </Button>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-semibold'>
              Total TTC: {totalTtc.toFixed(2)} €
            </span>
            <Button variant='outline' size='sm' onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        </div>

        {/* Body: 2 columns */}
        <div className='flex flex-1 overflow-hidden'>
          {/* Left: Tabs */}
          <div className='w-[55%] border-r flex flex-col'>
            <Tabs value={activeTab} onValueChange={setActiveTab} className='flex flex-col flex-1'>
              <TabsList className='mx-4 mt-3 grid w-fit grid-cols-4'>
                <TabsTrigger value='general' className='gap-1.5 text-xs'>
                  <ReceiptText className='h-3.5 w-3.5' />
                  Général
                </TabsTrigger>
                <TabsTrigger value='contact' className='gap-1.5 text-xs'>
                  <User className='h-3.5 w-3.5' />
                  Contact
                </TabsTrigger>
                <TabsTrigger value='conditions' className='gap-1.5 text-xs'>
                  <FileText className='h-3.5 w-3.5' />
                  Conditions
                </TabsTrigger>
                <TabsTrigger value='produits' className='gap-1.5 text-xs'>
                  <Package className='h-3.5 w-3.5' />
                  Produits
                  {items.length > 0 && (
                    <Badge variant='secondary' className='ml-1 h-4 px-1 text-[10px]'>{items.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <ScrollArea className='flex-1 px-4 py-3'>
                {/* ── Tab Général ── */}
                <TabsContent value='general' className='mt-0 space-y-4'>
                  <div>
                    <Label className='text-xs'>Titre</Label>
                    <Input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      onBlur={() => saveQuoteField('title', title)}
                      placeholder={`Votre événement | ${booking.occasion || ''}`}
                      className='mt-1'
                    />
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <Label className='text-xs'>Date début prestation</Label>
                      <Input
                        type='date'
                        value={dateStart}
                        onChange={e => setDateStart(e.target.value)}
                        onBlur={() => saveQuoteField('date_start', dateStart || null)}
                        className='mt-1'
                      />
                    </div>
                    <div>
                      <Label className='text-xs'>Date fin prestation</Label>
                      <Input
                        type='date'
                        value={dateEnd}
                        onChange={e => setDateEnd(e.target.value)}
                        onBlur={() => saveQuoteField('date_end', dateEnd || null)}
                        className='mt-1'
                      />
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <Label className='text-xs'>N° bon de commande</Label>
                      <Input
                        value={orderNumber}
                        onChange={e => setOrderNumber(e.target.value)}
                        onBlur={() => saveQuoteField('order_number', orderNumber || null)}
                        placeholder='Optionnel'
                        className='mt-1'
                      />
                    </div>
                    <div>
                      <Label className='text-xs'>Remise (%)</Label>
                      <Input
                        type='number'
                        min={0}
                        max={100}
                        step={0.01}
                        value={discountPercentage}
                        onChange={e => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                        onBlur={() => saveQuoteField('discount_percentage', discountPercentage)}
                        className='mt-1'
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Acompte & Solde */}
                  <div className='space-y-3'>
                    <h4 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Modalités de paiement</h4>
                    <Card>
                      <CardContent className='p-3 space-y-3'>
                        <div className='flex items-center justify-between'>
                          <span className='text-sm font-medium'>Acompte</span>
                          <Badge variant='outline'>{depositAmount.toFixed(2)} €</Badge>
                        </div>
                        <div className='grid grid-cols-3 gap-2'>
                          <div>
                            <Label className='text-[10px]'>Label</Label>
                            <Input
                              value={depositLabel}
                              onChange={e => setDepositLabel(e.target.value)}
                              onBlur={() => saveQuoteField('deposit_label', depositLabel)}
                              className='mt-0.5 h-8 text-xs'
                            />
                          </div>
                          <div>
                            <Label className='text-[10px]'>Pourcentage (%)</Label>
                            <Input
                              type='number'
                              min={0}
                              max={100}
                              value={depositPercentage}
                              onChange={e => setDepositPercentage(parseFloat(e.target.value) || 0)}
                              onBlur={() => saveQuoteField('deposit_percentage', depositPercentage)}
                              className='mt-0.5 h-8 text-xs'
                            />
                          </div>
                          <div>
                            <Label className='text-[10px]'>Échéance (J-)</Label>
                            <Input
                              type='number'
                              value={depositDays}
                              onChange={e => setDepositDays(parseInt(e.target.value) || 0)}
                              onBlur={() => saveQuoteField('deposit_days', depositDays)}
                              className='mt-0.5 h-8 text-xs'
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className='p-3 space-y-3'>
                        <div className='flex items-center justify-between'>
                          <span className='text-sm font-medium'>Solde</span>
                          <Badge variant='outline'>{balanceAmount.toFixed(2)} €</Badge>
                        </div>
                        <div className='grid grid-cols-2 gap-2'>
                          <div>
                            <Label className='text-[10px]'>Label</Label>
                            <Input
                              value={balanceLabel}
                              onChange={e => setBalanceLabel(e.target.value)}
                              onBlur={() => saveQuoteField('balance_label', balanceLabel)}
                              className='mt-0.5 h-8 text-xs'
                            />
                          </div>
                          <div>
                            <Label className='text-[10px]'>Échéance (J-)</Label>
                            <Input
                              type='number'
                              value={balanceDays}
                              onChange={e => setBalanceDays(parseInt(e.target.value) || 0)}
                              onBlur={() => saveQuoteField('balance_days', balanceDays)}
                              className='mt-0.5 h-8 text-xs'
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  {/* Dates */}
                  <div className='space-y-3'>
                    <h4 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Dates & échéances</h4>
                    <div className='grid grid-cols-3 gap-3'>
                      <div>
                        <Label className='text-xs'>Date du devis</Label>
                        <Input
                          type='date'
                          value={quoteDate}
                          onChange={e => setQuoteDate(e.target.value)}
                          onBlur={() => saveQuoteField('quote_date', quoteDate || null)}
                          className='mt-1'
                        />
                      </div>
                      <div>
                        <Label className='text-xs'>Échéance devis (J+)</Label>
                        <Input
                          type='number'
                          value={quoteDueDays}
                          onChange={e => setQuoteDueDays(parseInt(e.target.value) || 0)}
                          onBlur={() => saveQuoteField('quote_due_days', quoteDueDays)}
                          className='mt-1'
                        />
                      </div>
                      <div>
                        <Label className='text-xs'>Échéance facture (J)</Label>
                        <Input
                          type='number'
                          value={invoiceDueDays}
                          onChange={e => setInvoiceDueDays(parseInt(e.target.value) || 0)}
                          onBlur={() => saveQuoteField('invoice_due_days', invoiceDueDays)}
                          className='mt-1'
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Comments */}
                  <div className='space-y-3'>
                    <h4 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Commentaires</h4>
                    <Tabs defaultValue='fr'>
                      <TabsList className='h-7'>
                        <TabsTrigger value='fr' className='text-xs h-5 px-2'>FR</TabsTrigger>
                        <TabsTrigger value='en' className='text-xs h-5 px-2'>EN</TabsTrigger>
                      </TabsList>
                      <TabsContent value='fr' className='mt-2'>
                        <Textarea
                          value={commentsFr}
                          onChange={e => setCommentsFr(e.target.value)}
                          onBlur={() => saveQuoteField('comments_fr', commentsFr || null)}
                          placeholder='Commentaires en français...'
                          className='min-h-[80px] text-xs resize-none'
                        />
                      </TabsContent>
                      <TabsContent value='en' className='mt-2'>
                        <Textarea
                          value={commentsEn}
                          onChange={e => setCommentsEn(e.target.value)}
                          onBlur={() => saveQuoteField('comments_en', commentsEn || null)}
                          placeholder='Comments in English...'
                          className='min-h-[80px] text-xs resize-none'
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

                {/* ── Tab Contact ── */}
                <TabsContent value='contact' className='mt-0 space-y-4'>
                  {contact ? (
                    <Card>
                      <CardContent className='p-4 space-y-3'>
                        {contact.company && (
                          <div>
                            <Label className='text-[10px] text-muted-foreground'>Société</Label>
                            <p className='text-sm font-medium'>{contact.company.name}</p>
                            {contact.company.billing_address && (
                              <p className='text-xs text-muted-foreground'>
                                {contact.company.billing_address}
                                {contact.company.billing_postal_code && `, ${contact.company.billing_postal_code}`}
                                {contact.company.billing_city && ` ${contact.company.billing_city}`}
                              </p>
                            )}
                          </div>
                        )}
                        <Separator />
                        <div className='grid grid-cols-2 gap-3'>
                          <div>
                            <Label className='text-[10px] text-muted-foreground'>Nom</Label>
                            <p className='text-sm'>{contact.first_name} {contact.last_name || ''}</p>
                          </div>
                          <div>
                            <Label className='text-[10px] text-muted-foreground'>Email</Label>
                            <p className='text-sm'>{contact.email || '—'}</p>
                          </div>
                          <div>
                            <Label className='text-[10px] text-muted-foreground'>Téléphone</Label>
                            <p className='text-sm'>{contact.phone || '—'}</p>
                          </div>
                        </div>
                        <Separator />
                        <div className='flex gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            className='gap-1.5 text-xs'
                            onClick={() => window.open(`/contacts/${contact.id}`, '_blank')}
                          >
                            <ExternalLink className='h-3 w-3' />
                            Ouvrir la fiche
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className='p-6 text-center text-muted-foreground text-sm'>
                        Aucun contact associé à cet événement.
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* ── Tab Conditions ── */}
                <TabsContent value='conditions' className='mt-0'>
                  <div className='flex gap-3'>
                    {/* Left nav */}
                    <div className='w-32 shrink-0 space-y-1'>
                      {[
                        { key: 'devis', label: 'Devis' },
                        { key: 'facture', label: 'Facture' },
                        { key: 'acompte', label: 'Acompte' },
                        { key: 'solde', label: 'Solde' },
                      ].map(item => (
                        <button
                          key={item.key}
                          onClick={() => setActiveCondition(item.key)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            activeCondition === item.key
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                      <Separator className='my-2' />
                      <Button
                        variant='outline'
                        size='sm'
                        className='w-full gap-1.5 text-xs'
                        onClick={handleLoadDefaultConditions}
                      >
                        <RotateCcw className='h-3 w-3' />
                        Charger CGV
                      </Button>
                    </div>

                    {/* Right: textarea */}
                    <div className='flex-1'>
                      {activeCondition === 'devis' && (
                        <Textarea
                          value={conditionsDevis}
                          onChange={e => setConditionsDevis(e.target.value)}
                          onBlur={() => saveQuoteField('conditions_devis', conditionsDevis || null)}
                          placeholder='Conditions générales de vente — Devis'
                          className='min-h-[400px] text-xs resize-none font-mono'
                        />
                      )}
                      {activeCondition === 'facture' && (
                        <Textarea
                          value={conditionsFacture}
                          onChange={e => setConditionsFacture(e.target.value)}
                          onBlur={() => saveQuoteField('conditions_facture', conditionsFacture || null)}
                          placeholder='Conditions générales — Facture'
                          className='min-h-[400px] text-xs resize-none font-mono'
                        />
                      )}
                      {activeCondition === 'acompte' && (
                        <Textarea
                          value={conditionsAcompte}
                          onChange={e => setConditionsAcompte(e.target.value)}
                          onBlur={() => saveQuoteField('conditions_acompte', conditionsAcompte || null)}
                          placeholder='Conditions — Acompte'
                          className='min-h-[400px] text-xs resize-none font-mono'
                        />
                      )}
                      {activeCondition === 'solde' && (
                        <Textarea
                          value={conditionsSolde}
                          onChange={e => setConditionsSolde(e.target.value)}
                          onBlur={() => saveQuoteField('conditions_solde', conditionsSolde || null)}
                          placeholder='Conditions — Solde / Balance'
                          className='min-h-[400px] text-xs resize-none font-mono'
                        />
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* ── Tab Produits ── */}
                <TabsContent value='produits' className='mt-0 space-y-3'>
                  {/* Add product controls */}
                  <div className='flex items-end gap-2'>
                    <div className='flex-1'>
                      <Label className='text-xs'>Ajouter un produit du catalogue</Label>
                      <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                        <SelectTrigger className='mt-1 h-8 text-xs'>
                          <SelectValue placeholder='Sélectionner un produit...' />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogProducts.map(p => (
                            <SelectItem key={p.id} value={p.id} className='text-xs'>
                              {p.name} — {p.unit_price_ht}€ HT (TVA {p.tva_rate}%)
                            </SelectItem>
                          ))}
                          {catalogProducts.length === 0 && (
                            <div className='px-2 py-1.5 text-xs text-muted-foreground'>Aucun produit dans le catalogue</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size='sm'
                      className='h-8 gap-1 text-xs'
                      onClick={handleAddProduct}
                      disabled={!selectedProductId || isAddingItem}
                    >
                      <Plus className='h-3 w-3' />
                      Ajouter
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      className='h-8 gap-1 text-xs'
                      onClick={handleAddManualProduct}
                      disabled={isAddingItem}
                    >
                      <Plus className='h-3 w-3' />
                      Produit manuel
                    </Button>
                  </div>

                  {/* Items table */}
                  {items.length === 0 ? (
                    <Card>
                      <CardContent className='py-8 text-center text-muted-foreground text-sm'>
                        Aucun produit ajouté. Utilisez le catalogue ou ajoutez un produit manuellement.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className='border rounded-md'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className='text-xs'>Désignation</TableHead>
                            <TableHead className='text-xs w-20'>Qté</TableHead>
                            <TableHead className='text-xs w-24'>Prix HT</TableHead>
                            <TableHead className='text-xs w-20'>TVA %</TableHead>
                            <TableHead className='text-xs w-24 text-right'>Total HT</TableHead>
                            <TableHead className='text-xs w-24 text-right'>Total TTC</TableHead>
                            <TableHead className='w-10' />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item: QuoteItem) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Input
                                  defaultValue={item.name}
                                  onBlur={e => {
                                    if (e.target.value !== item.name) {
                                      handleUpdateItem(item.id, 'name', e.target.value)
                                    }
                                  }}
                                  className='h-7 text-xs border-0 p-0 shadow-none focus-visible:ring-0'
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type='number'
                                  min={1}
                                  defaultValue={item.quantity}
                                  onBlur={e => {
                                    const v = parseInt(e.target.value) || 1
                                    if (v !== item.quantity) {
                                      handleUpdateItem(item.id, 'quantity', v)
                                    }
                                  }}
                                  className='h-7 text-xs border-0 p-0 shadow-none focus-visible:ring-0 w-16'
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type='number'
                                  step='0.01'
                                  defaultValue={item.unit_price}
                                  onBlur={e => {
                                    const v = parseFloat(e.target.value) || 0
                                    if (v !== item.unit_price) {
                                      handleUpdateItem(item.id, 'unit_price', v)
                                    }
                                  }}
                                  className='h-7 text-xs border-0 p-0 shadow-none focus-visible:ring-0 w-20'
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type='number'
                                  step='0.01'
                                  defaultValue={item.tva_rate}
                                  onBlur={e => {
                                    const v = parseFloat(e.target.value) || 20
                                    if (v !== item.tva_rate) {
                                      handleUpdateItem(item.id, 'tva_rate', v)
                                    }
                                  }}
                                  className='h-7 text-xs border-0 p-0 shadow-none focus-visible:ring-0 w-16'
                                />
                              </TableCell>
                              <TableCell className='text-right text-xs'>
                                {((item.total_ht as number) || 0).toFixed(2)} €
                              </TableCell>
                              <TableCell className='text-right text-xs'>
                                {((item.total_ttc as number) || 0).toFixed(2)} €
                              </TableCell>
                              <TableCell>
                                <Button
                                  size='icon'
                                  variant='ghost'
                                  className='h-6 w-6 text-destructive hover:text-destructive'
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  <Trash2 className='h-3 w-3' />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Totals */}
                      <div className='border-t px-4 py-2 space-y-1'>
                        <div className='flex justify-between text-xs'>
                          <span className='text-muted-foreground'>Total HT</span>
                          <span className='font-medium'>{totalHt.toFixed(2)} €</span>
                        </div>
                        <div className='flex justify-between text-xs'>
                          <span className='text-muted-foreground'>TVA</span>
                          <span className='font-medium'>{(totalTtc - totalHt).toFixed(2)} €</span>
                        </div>
                        <Separator />
                        <div className='flex justify-between text-sm font-semibold'>
                          <span>Total TTC</span>
                          <span>{totalTtc.toFixed(2)} €</span>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>

          {/* Right: PDF Preview */}
          <div className='w-[45%] bg-muted/30 flex flex-col'>
            <div className='px-4 py-2 border-b flex items-center justify-between'>
              <span className='text-xs font-medium text-muted-foreground'>Aperçu du devis</span>
              <QuotePdfExportButton quoteNumber={quoteData?.quote_number || 'devis'} />
            </div>
            <ScrollArea className='flex-1'>
              <div className='p-4'>
                <QuotePreview data={previewData} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
