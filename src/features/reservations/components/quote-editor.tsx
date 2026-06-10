import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronDown,
  FileText,
  GripVertical,
  Loader2,
  Package,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  User,
  ExternalLink,
  RotateCcw,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { deriveHtFromTtc } from '@/lib/price'
import { supabase } from '@/lib/supabase'
import type { QuoteItem } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateCompany } from '@/features/companies/hooks/use-companies'
import {
  useContact,
  useContactSearch,
} from '@/features/contacts/hooks/use-contacts'
import {
  computeQuoteTotals,
  formatEuroWhole,
  formatEuroDecimal,
} from '@/features/reservations/lib/quote-rounding'
import type { Restaurant } from '@/features/settings/hooks/use-settings'
import type { BookingWithRelations } from '../hooks/use-bookings'
import { usePaymentsByBooking } from '../hooks/use-bookings'
import {
  useUpdateQuote,
  useAddQuoteItem,
  useUpdateQuoteItem,
  useDeleteQuoteItem,
  useReorderQuoteItems,
  useProductsByRestaurant,
  usePackagesByRestaurant,
  useQuoteWithItems,
  generateAllCGV,
  generateCGV,
  type RestaurantBillingInfo,
} from '../hooks/use-quotes'
import { QuotePreview, type DocumentType } from './quote-preview'

const API_BASE_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_API_URL || 'http://localhost:3001'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteId: string | null
  booking: BookingWithRelations
  restaurant: Restaurant | null
  contact: {
    id: string
    first_name: string
    last_name: string | null
    email: string | null
    phone: string | null
    company?: {
      name: string
      billing_address?: string | null
      billing_city?: string | null
      billing_postal_code?: string | null
    } | null
  } | null
}

// ─── Sortable item row for drag & drop ───
function SortableItemRow({
  item,
  onUpdateItem,
  onUpdateItemFields,
  onDeleteItem,
}: {
  item: QuoteItem
  onUpdateItem: (id: string, field: string, value: any) => void
  onUpdateItemFields: (id: string, updates: Partial<QuoteItem>) => void
  onDeleteItem: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [showDesc, setShowDesc] = useState(!!item.description)

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className='px-1'>
        <button
          type='button'
          className='cursor-grab p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing'
          {...attributes}
          {...listeners}
        >
          <GripVertical className='h-3.5 w-3.5' />
        </button>
      </TableCell>
      <TableCell>
        <div className='space-y-1'>
          <Input
            defaultValue={item.name}
            onBlur={(e) => {
              if (e.target.value !== item.name) {
                onUpdateItem(item.id, 'name', e.target.value)
              }
            }}
            className='h-7 border-0 p-0 text-xs shadow-none focus-visible:ring-0'
          />
          {showDesc ? (
            <Textarea
              defaultValue={item.description || ''}
              onBlur={(e) => {
                const val = e.target.value.trim()
                if (val !== (item.description || '')) {
                  onUpdateItem(item.id, 'description', val || null)
                }
                if (!val) setShowDesc(false)
              }}
              placeholder='Description du produit...'
              className='min-h-[40px] resize-none border-0 p-0 text-[10px] text-muted-foreground shadow-none focus-visible:ring-0'
            />
          ) : (
            <button
              type='button'
              onClick={() => setShowDesc(true)}
              className='text-[10px] text-muted-foreground/60 transition-colors hover:text-muted-foreground'
            >
              + Ajouter une description
            </button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Input
          type='number'
          min={1}
          defaultValue={item.quantity ?? 1}
          onBlur={(e) => {
            const v = parseInt(e.target.value) || 1
            if (v !== (item.quantity ?? 1)) {
              onUpdateItem(item.id, 'quantity', v)
            }
          }}
          className='h-7 w-16 border-0 p-0 text-xs shadow-none focus-visible:ring-0'
        />
      </TableCell>
      <TableCell>
        <Input
          key={`ttc-${item.tva_rate ?? 20}-${item.unit_price ?? 0}`}
          type='number'
          step='0.01'
          defaultValue={
            Math.round(
              (item.unit_price ?? 0) * (1 + (item.tva_rate ?? 20) / 100) * 100
            ) / 100
          }
          onBlur={(e) => {
            const ttc = parseFloat(e.target.value) || 0
            const ht = deriveHtFromTtc(ttc, item.tva_rate ?? 20)
            if (ht !== (item.unit_price ?? 0)) {
              onUpdateItem(item.id, 'unit_price', ht)
            }
          }}
          className='h-7 w-20 border-0 p-0 text-xs shadow-none focus-visible:ring-0'
        />
      </TableCell>
      <TableCell>
        <Input
          key={`ht-${item.unit_price ?? 0}`}
          type='number'
          step='0.01'
          defaultValue={item.unit_price ?? 0}
          onBlur={(e) => {
            const ht = parseFloat(e.target.value) || 0
            if (ht !== (item.unit_price ?? 0)) {
              onUpdateItem(item.id, 'unit_price', ht)
            }
          }}
          className='h-7 w-20 border-0 p-0 text-xs shadow-none focus-visible:ring-0'
        />
      </TableCell>
      <TableCell>
        <Input
          type='number'
          step='0.01'
          defaultValue={item.tva_rate ?? 20}
          onBlur={(e) => {
            const newTva = parseFloat(e.target.value) || 20
            const oldTva = item.tva_rate ?? 20
            if (newTva !== oldTva) {
              const ttc = (item.unit_price ?? 0) * (1 + oldTva / 100)
              onUpdateItemFields(item.id, {
                tva_rate: newTva,
                unit_price: deriveHtFromTtc(ttc, newTva),
              })
            }
          }}
          className='h-7 w-16 border-0 p-0 text-xs shadow-none focus-visible:ring-0'
        />
      </TableCell>
      <TableCell>
        <div className='relative w-16'>
          <Input
            type='number'
            min={0}
            max={100}
            step='0.1'
            defaultValue={
              (item.discount_amount ?? 0) > 0 &&
              (item.quantity ?? 1) * (item.unit_price ?? 0) > 0
                ? Math.round(
                    (item.discount_amount! /
                      ((item.quantity ?? 1) * (item.unit_price ?? 0))) *
                      1000
                  ) / 10
                : undefined
            }
            placeholder='0'
            onBlur={(e) => {
              const pct = parseFloat(e.target.value)
              const base = (item.quantity ?? 1) * (item.unit_price ?? 0)
              const newDiscount =
                !isNaN(pct) && pct > 0
                  ? Math.round(base * (pct / 100) * 100) / 100
                  : 0
              const currentDiscount = item.discount_amount ?? 0
              if (Math.abs(newDiscount - currentDiscount) > 0.001) {
                onUpdateItem(item.id, 'discount_amount', newDiscount)
              }
            }}
            className='h-7 w-14 border-0 p-0 text-xs text-red-600 shadow-none focus-visible:ring-0'
          />
        </div>
      </TableCell>
      <TableCell className='text-right text-xs'>
        {formatEuroDecimal((item.total_ht as number) || 0)}
      </TableCell>
      <TableCell className='text-right text-xs'>
        {formatEuroWhole((item.total_ttc as number) || 0)}
      </TableCell>
      <TableCell>
        <Button
          size='icon'
          variant='ghost'
          className='h-6 w-6 text-destructive hover:text-destructive'
          onClick={() => onDeleteItem(item.id)}
        >
          <Trash2 className='h-3 w-3' />
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function QuoteEditor({
  open,
  onOpenChange,
  quoteId,
  booking,
  restaurant,
  contact,
}: Props) {
  const { data: quoteData, isLoading } = useQuoteWithItems(quoteId)
  const { mutate: updateQuote } = useUpdateQuote()
  const { mutate: addQuoteItem, isPending: isAddingItem } = useAddQuoteItem()
  const { mutate: updateQuoteItem } = useUpdateQuoteItem()
  const { mutate: deleteQuoteItem } = useDeleteQuoteItem()
  const { mutate: reorderItems } = useReorderQuoteItems()
  const { data: catalogProducts = [] } = useProductsByRestaurant(
    restaurant?.id || null
  )
  const { data: catalogPackages = [] } = usePackagesByRestaurant(
    restaurant?.id || null
  )
  const { data: bookingPayments = [] } = usePaymentsByBooking(booking.id)
  const { mutate: updateCompany, isPending: isUpdatingCompany } =
    useUpdateCompany()

  // Extras state (using quote_items with item_type='extra')
  const [editingExtra, setEditingExtra] = useState<QuoteItem | null>(null)
  const [extraName, setExtraName] = useState('')
  const [extraDescription, setExtraDescription] = useState('')
  const [extraQuantity, setExtraQuantity] = useState(1)
  const [extraUnitPrice, setExtraUnitPrice] = useState(0)
  const [extraTvaRate, setExtraTvaRate] = useState(20)

  // B2B billing form state
  const [billingName, setBillingName] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [billingPostalCode, setBillingPostalCode] = useState('')
  const [billingCity, setBillingCity] = useState('')
  const [billingSiret, setBillingSiret] = useState('')
  const [billingTvaNumber, setBillingTvaNumber] = useState('')
  const [billingFormDirty, setBillingFormDirty] = useState(false)

  // Local state for quote fields
  const [title, setTitle] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [discountPercentage, setDiscountPercentage] = useState(0)
  const [depositPercentage, setDepositPercentage] = useState(80)
  const [depositMode, setDepositMode] = useState<'percentage' | 'amount'>(
    'percentage'
  )
  const [depositAmountOverride, setDepositAmountOverride] = useState('')
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
  const [additionalConditions, setAdditionalConditions] = useState('')
  const [language, setLanguage] = useState<'fr' | 'en'>('fr')
  const [activeTab, setActiveTab] = useState('general')
  const [activeCondition, setActiveCondition] = useState('devis')
  const [documentType, setDocumentType] = useState<DocumentType>('devis')
  const [productPopoverOpen, setProductPopoverOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [packagePopoverOpen, setPackagePopoverOpen] = useState(false)
  const [packageSearch, setPackageSearch] = useState('')
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)

  // Wrapper to mark dirty on any field change
  const dirty = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
      return (value: T | ((prev: T) => T)) => {
        setter(value)
        setIsDirty(true)
      }
    },
    []
  )

  // Recherche serveur (unaccent) : la liste complete depasse le cap PostgREST
  // de 1000 lignes et rendrait le filtre cmdk inutilisable sur 20k+ contacts.
  const [contactSearch, setContactSearch] = useState('')
  const debouncedContactSearch = useDebouncedValue(contactSearch, 250)
  const { data: contactResults = [] } = useContactSearch(
    debouncedContactSearch,
    contactPopoverOpen
  )

  // Resolve contact: use quote's contact_id if available, fallback to booking contact
  const quoteContactId = quoteData?.contact_id || null
  const { data: quoteContact } = useContact(quoteContactId || '')
  const resolvedContact = quoteContactId ? quoteContact || contact : contact

  // Get restaurant billing info for CGV generation
  const restaurantBillingInfo: RestaurantBillingInfo = useMemo(
    () => ({
      company_name: (restaurant as any)?.company_name || null,
      legal_form: (restaurant as any)?.legal_form || null,
      billing_address: (restaurant as any)?.billing_address || null,
      billing_postal_code: (restaurant as any)?.billing_postal_code || null,
      billing_city: (restaurant as any)?.billing_city || null,
      rcs: (restaurant as any)?.rcs || null,
      siren: (restaurant as any)?.siren || null,
      siret: (restaurant as any)?.siret || restaurant?.siret || null,
      share_capital: (restaurant as any)?.share_capital || null,
      billing_email:
        (restaurant as any)?.billing_email || restaurant?.email || null,
      name: restaurant?.name || null,
    }),
    [restaurant]
  )

  // Track which quote ID we already replaced placeholders for, to avoid infinite loop
  const replacedPlaceholdersRef = useRef<string | null>(null)

  // Initialize from quote data
  useEffect(() => {
    if (quoteData) {
      setTitle(quoteData.title || '')
      setDateStart(
        quoteData.date_start ? quoteData.date_start.split('T')[0] : ''
      )
      setDateEnd(quoteData.date_end ? quoteData.date_end.split('T')[0] : '')
      setOrderNumber(quoteData.order_number || '')
      setDiscountPercentage(quoteData.discount_percentage || 0)
      if ((quoteData as any).deposit_amount_override != null) {
        setDepositMode('amount')
        setDepositAmountOverride(
          String((quoteData as any).deposit_amount_override)
        )
        setDepositPercentage(0)
      } else {
        setDepositMode('percentage')
        setDepositAmountOverride('')
        setDepositPercentage(quoteData.deposit_percentage || 80)
      }
      setDepositLabel(quoteData.deposit_label || 'Acompte à signature')
      setDepositDays(quoteData.deposit_days || 7)
      setBalanceLabel(quoteData.balance_label || 'Solde')
      setBalanceDays(quoteData.balance_days || 0)
      setQuoteDate(quoteData.quote_date || '')
      setQuoteDueDays(quoteData.quote_due_days || 7)
      setInvoiceDueDays(quoteData.invoice_due_days || 0)
      setCommentsFr(quoteData.comments_fr || '')
      setCommentsEn(quoteData.comments_en || '')
      // If conditions still have {{placeholders}}, replace them with restaurant billing info
      // Use ref to avoid infinite loop: updateQuote invalidates quoteData → effect re-runs
      const needsReplacement = (s: string | null) => s?.includes('{{')
      const hasPlaceholders =
        needsReplacement(quoteData.conditions_devis) ||
        needsReplacement(quoteData.conditions_facture) ||
        needsReplacement(quoteData.conditions_acompte) ||
        needsReplacement(quoteData.conditions_solde)
      if (hasPlaceholders && replacedPlaceholdersRef.current !== quoteData.id) {
        replacedPlaceholdersRef.current = quoteData.id
        const cgv = {
          conditionsDevis: generateCGV(
            quoteData.conditions_devis || '',
            restaurantBillingInfo
          ),
          conditionsFacture: generateCGV(
            quoteData.conditions_facture || '',
            restaurantBillingInfo
          ),
          conditionsAcompte: generateCGV(
            quoteData.conditions_acompte || '',
            restaurantBillingInfo
          ),
          conditionsSolde: generateCGV(
            quoteData.conditions_solde || '',
            restaurantBillingInfo
          ),
        }
        setConditionsDevis(cgv.conditionsDevis)
        setConditionsFacture(cgv.conditionsFacture)
        setConditionsAcompte(cgv.conditionsAcompte)
        setConditionsSolde(cgv.conditionsSolde)
        // Also save replaced conditions to the database
        if (quoteData.id) {
          updateQuote({
            id: quoteData.id,
            conditions_devis: cgv.conditionsDevis,
            conditions_facture: cgv.conditionsFacture,
            conditions_acompte: cgv.conditionsAcompte,
            conditions_solde: cgv.conditionsSolde,
          } as any)
        }
      } else if (!hasPlaceholders) {
        setConditionsDevis(quoteData.conditions_devis || '')
        setConditionsFacture(quoteData.conditions_facture || '')
        setConditionsAcompte(quoteData.conditions_acompte || '')
        setConditionsSolde(quoteData.conditions_solde || '')
      }
      setAdditionalConditions(quoteData.additional_conditions || '')
      setLanguage((quoteData.language as 'fr' | 'en') || 'fr')
    }
  }, [quoteData, restaurantBillingInfo])

  // Initialize billing form from company data
  useEffect(() => {
    const company = (resolvedContact as any)?.company
    if (company) {
      setBillingName(company.name || '')
      setBillingAddress(company.billing_address || '')
      setBillingPostalCode(company.billing_postal_code || '')
      setBillingCity(company.billing_city || '')
      setBillingSiret(company.siret || '')
      setBillingTvaNumber(company.tva_number || '')
      setBillingFormDirty(false)
    }
  }, [resolvedContact])

  const items = quoteData?.quote_items || []

  // Save a single quote field (used for contact change, language change, conditions reload)
  const saveQuoteField = useCallback(
    (field: string, value: any) => {
      if (!quoteId) return
      updateQuote({ id: quoteId, [field]: value } as any, {
        onError: () => toast.error('Erreur lors de la sauvegarde'),
      })
    },
    [quoteId, updateQuote]
  )

  // Save all local fields at once
  const saveAllFields = useCallback(() => {
    if (!quoteId) return
    updateQuote(
      {
        id: quoteId,
        title,
        date_start: dateStart || null,
        date_end: dateEnd || null,
        order_number: orderNumber || null,
        discount_percentage: discountPercentage,
        deposit_percentage:
          depositMode === 'percentage' ? depositPercentage : 0,
        deposit_amount_override:
          depositMode === 'amount'
            ? parseFloat(depositAmountOverride) || 0
            : null,
        deposit_label: depositLabel,
        deposit_days: depositDays,
        balance_label: balanceLabel,
        balance_days: balanceDays,
        quote_date: quoteDate || null,
        quote_due_days: quoteDueDays,
        invoice_due_days: invoiceDueDays,
        comments_fr: commentsFr,
        comments_en: commentsEn,
        conditions_devis: conditionsDevis,
        conditions_facture: conditionsFacture,
        conditions_acompte: conditionsAcompte,
        conditions_solde: conditionsSolde,
        additional_conditions: additionalConditions,
        language,
      } as any,
      {
        onSuccess: () => {
          toast.success('Modifications enregistrées')
          setIsDirty(false)
        },
        onError: () => toast.error('Erreur lors de la sauvegarde'),
      }
    )
  }, [
    quoteId,
    updateQuote,
    title,
    dateStart,
    dateEnd,
    orderNumber,
    discountPercentage,
    depositPercentage,
    depositMode,
    depositAmountOverride,
    depositLabel,
    depositDays,
    balanceLabel,
    balanceDays,
    quoteDate,
    quoteDueDays,
    invoiceDueDays,
    commentsFr,
    commentsEn,
    conditionsDevis,
    conditionsFacture,
    conditionsAcompte,
    conditionsSolde,
    additionalConditions,
    language,
  ])

  // Handle quit with dirty check
  const handleQuit = useCallback(() => {
    if (isDirty) {
      setShowQuitConfirm(true)
    } else {
      onOpenChange(false)
    }
  }, [isDirty, onOpenChange])

  // Use a ref for items length to avoid unnecessary callback recreations
  const itemsLengthRef = useRef(items.length)
  itemsLengthRef.current = items.length

  // Add product from catalog (via combobox)
  const handleAddProductFromCatalog = useCallback(
    (productId: string) => {
      if (!quoteId) return
      const product = catalogProducts.find((p) => p.id === productId)
      if (!product) return

      addQuoteItem(
        {
          quoteId,
          name: product.name,
          description: product.description || undefined,
          quantity: product.price_per_person ? booking.guests_count || 1 : 1,
          unitPrice: product.unit_price_ht,
          tvaRate: product.tva_rate,
          position: itemsLengthRef.current,
        },
        {
          onSuccess: () => {
            setProductPopoverOpen(false)
            toast.success('Produit ajouté')
          },
          onError: () => toast.error("Erreur lors de l'ajout"),
        }
      )
    },
    [quoteId, catalogProducts, addQuoteItem, booking.guests_count]
  )

  // Add package from catalog (via combobox)
  const handleAddPackageFromCatalog = useCallback(
    (packageId: string) => {
      if (!quoteId) return
      const pkg = catalogPackages.find((p) => p.id === packageId)
      if (!pkg) return

      // Build description from package products
      const productsDesc =
        pkg.package_products
          ?.map((pp) => `${pp.product?.name || 'Produit'} ×${pp.quantity}`)
          .join(', ') || ''
      const fullDescription = [pkg.description, productsDesc]
        .filter(Boolean)
        .join(' — ')

      addQuoteItem(
        {
          quoteId,
          name: pkg.name,
          description: fullDescription || undefined,
          quantity: pkg.price_per_person ? booking.guests_count || 1 : 1,
          unitPrice: pkg.unit_price_ht,
          tvaRate: pkg.tva_rate,
          position: itemsLengthRef.current,
        },
        {
          onSuccess: () => {
            setPackagePopoverOpen(false)
            toast.success('Package ajouté')
          },
          onError: () => toast.error("Erreur lors de l'ajout"),
        }
      )
    },
    [quoteId, catalogPackages, addQuoteItem, booking.guests_count]
  )

  // Change contact on the quote
  const handleChangeContact = useCallback(
    (contactId: string) => {
      if (!quoteId) return
      saveQuoteField('contact_id', contactId)
      setContactPopoverOpen(false)
      toast.success('Contact mis à jour')
    },
    [quoteId, saveQuoteField]
  )

  // Update item field
  const handleUpdateItem = useCallback(
    (itemId: string, field: string, value: any) => {
      if (!quoteId) return
      updateQuoteItem({ id: itemId, quoteId, [field]: value } as any, {
        onError: () => toast.error('Erreur lors de la mise à jour'),
      })
    },
    [quoteId, updateQuoteItem]
  )

  // Maj multi-champs en une mutation (ex: TVA modifiee = on garde le TTC, on recalcule le HT)
  const handleUpdateItemFields = useCallback(
    (itemId: string, updates: Partial<QuoteItem>) => {
      if (!quoteId) return
      updateQuoteItem({ id: itemId, quoteId, ...updates } as any, {
        onError: () => toast.error('Erreur lors de la mise à jour'),
      })
    },
    [quoteId, updateQuoteItem]
  )

  // Delete item
  const handleDeleteItem = useCallback(
    (itemId: string) => {
      if (!quoteId) return
      deleteQuoteItem(
        { id: itemId, quoteId },
        {
          onSuccess: () => toast.success('Produit supprimé'),
          onError: () => toast.error('Erreur lors de la suppression'),
        }
      )
    },
    [quoteId, deleteQuoteItem]
  )

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !quoteId) return

      const oldIndex = items.findIndex((i: QuoteItem) => i.id === active.id)
      const newIndex = items.findIndex((i: QuoteItem) => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(items as QuoteItem[], oldIndex, newIndex)
      reorderItems({ quoteId, orderedIds: reordered.map((i) => i.id) })
    },
    [items, quoteId, reorderItems]
  )

  // Load default conditions with dynamic restaurant info
  const handleLoadDefaultConditions = useCallback(
    (lang: 'fr' | 'en' = language) => {
      const cgv = generateAllCGV(lang, restaurantBillingInfo)
      setConditionsDevis(cgv.conditionsDevis)
      setConditionsFacture(cgv.conditionsFacture)
      setConditionsAcompte(cgv.conditionsAcompte)
      setConditionsSolde(cgv.conditionsSolde)
      if (quoteId) {
        updateQuote(
          {
            id: quoteId,
            conditions_devis: cgv.conditionsDevis,
            conditions_facture: cgv.conditionsFacture,
            conditions_acompte: cgv.conditionsAcompte,
            conditions_solde: cgv.conditionsSolde,
          } as any,
          {
            onSuccess: () =>
              toast.success(
                lang === 'fr'
                  ? 'Conditions FR chargées'
                  : 'Conditions EN chargées'
              ),
          }
        )
      }
    },
    [quoteId, updateQuote, language, restaurantBillingInfo]
  )

  // Handle language change - regenerate CGV
  const handleLanguageChange = useCallback(
    (newLang: 'fr' | 'en') => {
      setLanguage(newLang)
      saveQuoteField('language', newLang)
      // Regenerate CGV with new language
      handleLoadDefaultConditions(newLang)
    },
    [saveQuoteField, handleLoadDefaultConditions]
  )

  // Filter items by type
  const products = items.filter((item) => item.item_type !== 'extra')
  const extras = items.filter((item) => item.item_type === 'extra')

  // Totaux calculés depuis les champs bruts via l'helper unifié (TTC = Math.ceil à l'euro).
  const rawTotals = computeQuoteTotals(products, 0)
  const finalTotals = computeQuoteTotals(products, discountPercentage)
  const rawTotalHt = rawTotals.totalHt
  const rawTotalTtc = rawTotals.totalTtc
  const totalHt = finalTotals.totalHt
  const totalTtc = finalTotals.totalTtc
  const depositAmount =
    depositMode === 'amount'
      ? parseFloat(depositAmountOverride) || 0
      : Math.ceil(totalTtc * (depositPercentage / 100))
  const balanceAmount = totalTtc - depositAmount

  // Build preview data
  const previewData = {
    quote: quoteData ?? null,
    items: products,
    booking,
    restaurant,
    contact: resolvedContact as any,
    title,
    dateStart,
    dateEnd,
    startTime: booking.start_time || '',
    endTime: booking.end_time || '',
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
    rawTotalHt,
    rawTotalTtc,
    discountPercentage,
    orderNumber,
    commentsFr,
    commentsEn,
    conditionsDevis,
    conditionsFacture,
    conditionsAcompte,
    conditionsSolde,
    additionalConditions,
    language,
    extras,
    payments: bookingPayments.filter(
      (p) => p.status === 'paid' || p.status === 'completed'
    ),
  }

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className='h-[95vh] gap-0 p-0 sm:max-w-[95vw]'
          aria-describedby={undefined}
        >
          <DialogTitle className='sr-only'>Chargement du devis</DialogTitle>
          <div className='flex h-full items-center justify-center'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleQuit()
          else onOpenChange(true)
        }}
      >
        <DialogContent
          className='h-[95vh] gap-0 p-0 sm:max-w-[95vw]'
          showCloseButton={false}
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className='flex items-center justify-between border-b px-6 py-3'>
            <div className='flex items-center gap-3'>
              <DialogTitle className='text-base'>
                {quoteData?.quote_number || 'Nouveau devis'}
              </DialogTitle>
              {(() => {
                const isQuoteSent = !!(quoteData as any)?.quote_sent_at
                const isQuoteSigned = !!(quoteData as any)?.quote_signed_at
                const isDepositPaid = !!(quoteData as any)?.deposit_paid_at
                const isBalanceSent = !!(quoteData as any)?.balance_sent_at
                const isBalancePaid = !!(quoteData as any)?.balance_paid_at
                return (
                  <div className='flex flex-wrap items-center gap-1.5'>
                    <Badge
                      variant='outline'
                      className={`h-5 px-1.5 py-0 text-[9px] ${isQuoteSent ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
                    >
                      {isQuoteSent ? '✓' : '○'} Devis envoyé
                    </Badge>
                    <Badge
                      variant='outline'
                      className={`h-5 px-1.5 py-0 text-[9px] ${isQuoteSigned ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
                    >
                      {isQuoteSigned ? '✓' : '○'} Signé
                    </Badge>
                    <Badge
                      variant='outline'
                      className={`h-5 px-1.5 py-0 text-[9px] ${isDepositPaid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
                    >
                      {isDepositPaid ? '✓' : '○'} Acompte payé
                    </Badge>
                    <Badge
                      variant='outline'
                      className={`h-5 px-1.5 py-0 text-[9px] ${isBalanceSent ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
                    >
                      {isBalanceSent ? '✓' : '○'} Solde envoyé
                    </Badge>
                    <Badge
                      variant='outline'
                      className={`h-5 px-1.5 py-0 text-[9px] ${isBalancePaid ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
                    >
                      {isBalancePaid ? '✓' : '○'} Soldé
                    </Badge>
                  </div>
                )
              })()}
            </div>
            <div className='flex items-center gap-2'>
              <span className='text-sm font-semibold'>
                Total TTC: {formatEuroWhole(totalTtc)}
              </span>
              {isDirty && (
                <Button size='sm' onClick={saveAllFields}>
                  <Save className='mr-1.5 h-3.5 w-3.5' />
                  Sauvegarder
                </Button>
              )}
              <Button variant='outline' size='sm' onClick={handleQuit}>
                Quitter
              </Button>
            </div>
          </div>

          {/* Body: 2 columns */}
          <div className='flex flex-1 overflow-hidden'>
            {/* Left: Tabs */}
            <div className='flex w-[55%] flex-col overflow-hidden border-r'>
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className='flex flex-1 flex-col overflow-hidden'
              >
                <TabsList className='mx-4 mt-3 mb-3 grid w-fit shrink-0 grid-cols-5'>
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
                      <Badge
                        variant='secondary'
                        className='ml-1 h-4 px-1 text-[10px]'
                      >
                        {items.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value='extras' className='gap-1.5 text-xs'>
                    <Plus className='h-3.5 w-3.5' />
                    Extras
                    {extras.length > 0 && (
                      <Badge
                        variant='secondary'
                        className='ml-1 h-4 px-1 text-[10px]'
                      >
                        {extras.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <div className='min-h-0 flex-1 overflow-auto'>
                  <div className='px-4 pb-3'>
                    {/* ── Tab Général ── */}
                    <TabsContent value='general' className='mt-0 space-y-4'>
                      <div>
                        <Label className='text-xs'>Titre</Label>
                        <Input
                          value={title}
                          onChange={(e) => dirty(setTitle)(e.target.value)}
                          placeholder={`Votre événement | ${booking.occasion || ''}`}
                          className='mt-1'
                        />
                      </div>

                      <div className='grid grid-cols-2 gap-3'>
                        <div>
                          <Label className='text-xs'>
                            Date début prestation
                          </Label>
                          <div className='mt-1'>
                            <DatePicker
                              value={dateStart}
                              onChange={(v) => {
                                setDateStart(v)
                                setIsDirty(true)
                              }}
                              placeholder='Début'
                            />
                          </div>
                        </div>
                        <div>
                          <Label className='text-xs'>Date fin prestation</Label>
                          <div className='mt-1'>
                            <DatePicker
                              value={dateEnd}
                              onChange={(v) => {
                                setDateEnd(v)
                                setIsDirty(true)
                              }}
                              placeholder='Fin'
                            />
                          </div>
                        </div>
                      </div>

                      <div className='grid grid-cols-2 gap-3'>
                        <div>
                          <Label className='text-xs'>N° bon de commande</Label>
                          <Input
                            value={orderNumber}
                            onChange={(e) =>
                              dirty(setOrderNumber)(e.target.value)
                            }
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
                            onChange={(e) =>
                              setDiscountPercentage(
                                parseFloat(e.target.value) || 0
                              )
                            }
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value) || 0
                              saveQuoteField('discount_percentage', v)
                            }}
                            className='mt-1'
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Acompte & Solde */}
                      <div className='space-y-3'>
                        <h4 className='text-xs font-semibold tracking-wider text-muted-foreground uppercase'>
                          Modalités de paiement
                        </h4>
                        <Card>
                          <CardContent className='space-y-3 p-3'>
                            <div className='flex items-center justify-between'>
                              <span className='text-sm font-medium'>
                                Acompte
                              </span>
                              <Badge variant='outline'>
                                {formatEuroWhole(depositAmount)}
                              </Badge>
                            </div>
                            <div className='grid grid-cols-3 gap-2'>
                              <div>
                                <Label className='text-[10px]'>Label</Label>
                                <Input
                                  value={depositLabel}
                                  onChange={(e) =>
                                    dirty(setDepositLabel)(e.target.value)
                                  }
                                  className='mt-0.5 h-8 text-xs'
                                />
                              </div>
                              <div>
                                <div className='mb-0.5 flex items-center justify-between'>
                                  <Label className='text-[10px]'>
                                    {depositMode === 'percentage'
                                      ? 'Pourcentage'
                                      : 'Montant fixe'}
                                  </Label>
                                  <div className='flex h-4 overflow-hidden rounded border border-input text-[10px]'>
                                    <button
                                      type='button'
                                      className={cn(
                                        'px-1.5 leading-none transition-colors',
                                        depositMode === 'percentage'
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-background hover:bg-accent'
                                      )}
                                      onClick={() =>
                                        dirty(setDepositMode)('percentage')
                                      }
                                    >
                                      %
                                    </button>
                                    <button
                                      type='button'
                                      className={cn(
                                        'border-l border-input px-1.5 leading-none transition-colors',
                                        depositMode === 'amount'
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-background hover:bg-accent'
                                      )}
                                      onClick={() =>
                                        dirty(setDepositMode)('amount')
                                      }
                                    >
                                      €
                                    </button>
                                  </div>
                                </div>
                                {depositMode === 'percentage' ? (
                                  <Input
                                    type='number'
                                    min={0}
                                    max={100}
                                    value={depositPercentage}
                                    onChange={(e) =>
                                      dirty(setDepositPercentage)(
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className='h-8 text-xs'
                                  />
                                ) : (
                                  <Input
                                    type='number'
                                    min={0}
                                    step='0.01'
                                    value={depositAmountOverride}
                                    onChange={(e) =>
                                      dirty(setDepositAmountOverride)(
                                        e.target.value
                                      )
                                    }
                                    placeholder='0.00'
                                    className='h-8 text-xs'
                                  />
                                )}
                              </div>
                              <div>
                                <Label className='text-[10px]'>
                                  Échéance (J-)
                                </Label>
                                <Input
                                  type='number'
                                  value={depositDays}
                                  onChange={(e) =>
                                    dirty(setDepositDays)(
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className='mt-0.5 h-8 text-xs'
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className='space-y-3 p-3'>
                            <div className='flex items-center justify-between'>
                              <span className='text-sm font-medium'>Solde</span>
                              <Badge variant='outline'>
                                {formatEuroWhole(balanceAmount)}
                              </Badge>
                            </div>
                            <div className='grid grid-cols-2 gap-2'>
                              <div>
                                <Label className='text-[10px]'>Label</Label>
                                <Input
                                  value={balanceLabel}
                                  onChange={(e) =>
                                    dirty(setBalanceLabel)(e.target.value)
                                  }
                                  className='mt-0.5 h-8 text-xs'
                                />
                              </div>
                              <div>
                                <Label className='text-[10px]'>
                                  Échéance (J-)
                                </Label>
                                <Input
                                  type='number'
                                  value={balanceDays}
                                  onChange={(e) =>
                                    dirty(setBalanceDays)(
                                      parseInt(e.target.value) || 0
                                    )
                                  }
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
                        <h4 className='text-xs font-semibold tracking-wider text-muted-foreground uppercase'>
                          Dates & échéances
                        </h4>
                        <div className='grid grid-cols-3 gap-3'>
                          <div>
                            <Label className='text-xs'>Date du devis</Label>
                            <div className='mt-1'>
                              <DatePicker
                                value={quoteDate}
                                onChange={(v) => {
                                  setQuoteDate(v)
                                  setIsDirty(true)
                                }}
                                placeholder='Date'
                              />
                            </div>
                          </div>
                          <div>
                            <Label className='text-xs'>
                              Échéance devis (J+)
                            </Label>
                            <Input
                              type='number'
                              value={quoteDueDays}
                              onChange={(e) =>
                                dirty(setQuoteDueDays)(
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className='mt-1'
                            />
                          </div>
                          <div>
                            <Label className='text-xs'>
                              Échéance facture (J)
                            </Label>
                            <Input
                              type='number'
                              value={invoiceDueDays}
                              onChange={(e) =>
                                dirty(setInvoiceDueDays)(
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className='mt-1'
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Comments */}
                      <div className='space-y-3'>
                        <h4 className='text-xs font-semibold tracking-wider text-muted-foreground uppercase'>
                          Commentaires
                        </h4>
                        <Tabs defaultValue='fr'>
                          <TabsList className='h-7'>
                            <TabsTrigger
                              value='fr'
                              className='h-5 px-2 text-xs'
                            >
                              FR
                            </TabsTrigger>
                            <TabsTrigger
                              value='en'
                              className='h-5 px-2 text-xs'
                            >
                              EN
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value='fr' className='mt-2'>
                            <Textarea
                              value={commentsFr}
                              onChange={(e) =>
                                dirty(setCommentsFr)(e.target.value)
                              }
                              placeholder='Commentaires en français...'
                              className='min-h-[80px] resize-none text-xs'
                            />
                          </TabsContent>
                          <TabsContent value='en' className='mt-2'>
                            <Textarea
                              value={commentsEn}
                              onChange={(e) =>
                                dirty(setCommentsEn)(e.target.value)
                              }
                              placeholder='Comments in English...'
                              className='min-h-[80px] resize-none text-xs'
                            />
                          </TabsContent>
                        </Tabs>
                      </div>
                    </TabsContent>

                    {/* ── Tab Contact ── */}
                    <TabsContent value='contact' className='mt-0 space-y-4'>
                      {resolvedContact ? (
                        <Card>
                          <CardContent className='space-y-3 p-4'>
                            {(resolvedContact as any).company && (
                              <div>
                                <Label className='text-[10px] text-muted-foreground'>
                                  Société
                                </Label>
                                <p className='text-sm font-medium'>
                                  {(resolvedContact as any).company.name}
                                </p>
                                {(resolvedContact as any).company
                                  .billing_address && (
                                  <p className='text-xs text-muted-foreground'>
                                    {
                                      (resolvedContact as any).company
                                        .billing_address
                                    }
                                    {(resolvedContact as any).company
                                      .billing_postal_code &&
                                      `, ${(resolvedContact as any).company.billing_postal_code}`}
                                    {(resolvedContact as any).company
                                      .billing_city &&
                                      ` ${(resolvedContact as any).company.billing_city}`}
                                  </p>
                                )}
                              </div>
                            )}
                            <Separator />
                            <div className='grid grid-cols-2 gap-3'>
                              <div>
                                <Label className='text-[10px] text-muted-foreground'>
                                  Nom
                                </Label>
                                <div className='flex items-center gap-2'>
                                  <p className='text-sm'>
                                    {resolvedContact.first_name}{' '}
                                    {resolvedContact.last_name || ''}
                                  </p>
                                  {(resolvedContact as any).company ? (
                                    <Badge className='h-5 bg-blue-500 px-1.5 py-0 text-[10px] text-white'>
                                      B2B
                                    </Badge>
                                  ) : (
                                    <Badge className='h-5 bg-gray-500 px-1.5 py-0 text-[10px] text-white'>
                                      B2C
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div>
                                <Label className='text-[10px] text-muted-foreground'>
                                  Email
                                </Label>
                                <p className='text-sm'>
                                  {resolvedContact.email || '—'}
                                </p>
                              </div>
                              <div>
                                <Label className='text-[10px] text-muted-foreground'>
                                  Téléphone
                                </Label>
                                <p className='text-sm'>
                                  {resolvedContact.phone || '—'}
                                </p>
                              </div>
                            </div>
                            {/* B2B Billing Info Section - Editable Form */}
                            {(resolvedContact as any).company && (
                              <>
                                <Separator />
                                <div className='space-y-3'>
                                  <div className='flex items-center justify-between'>
                                    <Label className='text-[10px] text-muted-foreground uppercase'>
                                      Informations de facturation
                                    </Label>
                                    {billingFormDirty && (
                                      <Badge
                                        variant='outline'
                                        className='border-amber-300 text-[9px] text-amber-600'
                                      >
                                        Non sauvegardé
                                      </Badge>
                                    )}
                                  </div>
                                  {(() => {
                                    const company = (resolvedContact as any)
                                      .company
                                    const hasMissing =
                                      !billingAddress &&
                                      !company.billing_address
                                    return (
                                      <div
                                        className={`space-y-3 rounded border p-3 ${hasMissing ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
                                      >
                                        {hasMissing && (
                                          <p className='text-[10px] font-medium text-red-600'>
                                            ⚠️ Veuillez compléter les
                                            informations de facturation
                                          </p>
                                        )}
                                        <div className='space-y-2'>
                                          <div>
                                            <Label className='text-[10px]'>
                                              Nom de la société
                                            </Label>
                                            <Input
                                              className='h-7 text-xs'
                                              placeholder='Nom de la société'
                                              value={billingName}
                                              onChange={(e) => {
                                                setBillingName(e.target.value)
                                                setBillingFormDirty(true)
                                              }}
                                            />
                                          </div>
                                          <div>
                                            <Label className='text-[10px]'>
                                              Adresse de facturation
                                            </Label>
                                            <Input
                                              className='h-7 text-xs'
                                              placeholder='123 rue de Paris'
                                              value={billingAddress}
                                              onChange={(e) => {
                                                setBillingAddress(
                                                  e.target.value
                                                )
                                                setBillingFormDirty(true)
                                              }}
                                            />
                                          </div>
                                          <div className='grid grid-cols-2 gap-2'>
                                            <div>
                                              <Label className='text-[10px]'>
                                                Code postal
                                              </Label>
                                              <Input
                                                className='h-7 text-xs'
                                                placeholder='75001'
                                                value={billingPostalCode}
                                                onChange={(e) => {
                                                  setBillingPostalCode(
                                                    e.target.value
                                                  )
                                                  setBillingFormDirty(true)
                                                }}
                                              />
                                            </div>
                                            <div>
                                              <Label className='text-[10px]'>
                                                Ville
                                              </Label>
                                              <Input
                                                className='h-7 text-xs'
                                                placeholder='Paris'
                                                value={billingCity}
                                                onChange={(e) => {
                                                  setBillingCity(e.target.value)
                                                  setBillingFormDirty(true)
                                                }}
                                              />
                                            </div>
                                          </div>
                                          <div className='grid grid-cols-2 gap-2'>
                                            <div>
                                              <Label className='text-[10px]'>
                                                SIRET
                                              </Label>
                                              <Input
                                                className='h-7 text-xs'
                                                placeholder='123 456 789 00012'
                                                value={billingSiret}
                                                onChange={(e) => {
                                                  setBillingSiret(
                                                    e.target.value
                                                  )
                                                  setBillingFormDirty(true)
                                                }}
                                              />
                                            </div>
                                            <div>
                                              <Label className='text-[10px]'>
                                                N° TVA
                                              </Label>
                                              <Input
                                                className='h-7 text-xs'
                                                placeholder='FR12345678901'
                                                value={billingTvaNumber}
                                                onChange={(e) => {
                                                  setBillingTvaNumber(
                                                    e.target.value
                                                  )
                                                  setBillingFormDirty(true)
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        <Button
                                          size='sm'
                                          className='h-7 w-full text-xs'
                                          disabled={
                                            isUpdatingCompany ||
                                            !billingFormDirty
                                          }
                                          onClick={() => {
                                            updateCompany(
                                              {
                                                id: company.id,
                                                name:
                                                  billingName.trim() ||
                                                  company.name,
                                                billing_address:
                                                  billingAddress || null,
                                                billing_postal_code:
                                                  billingPostalCode || null,
                                                billing_city:
                                                  billingCity || null,
                                                siret: billingSiret || null,
                                                tva_number:
                                                  billingTvaNumber || null,
                                              },
                                              {
                                                onSuccess: () => {
                                                  toast.success(
                                                    'Informations de facturation mises à jour'
                                                  )
                                                  setBillingFormDirty(false)
                                                },
                                                onError: () =>
                                                  toast.error(
                                                    'Erreur lors de la mise à jour'
                                                  ),
                                              }
                                            )
                                          }}
                                        >
                                          {isUpdatingCompany ? (
                                            <Loader2 className='mr-1 h-3 w-3 animate-spin' />
                                          ) : null}
                                          Enregistrer les informations
                                        </Button>
                                      </div>
                                    )
                                  })()}
                                </div>
                              </>
                            )}

                            <Separator />
                            <div className='flex gap-2'>
                              <Button
                                variant='outline'
                                size='sm'
                                className='gap-1.5 text-xs'
                                onClick={() =>
                                  window.open(
                                    `/contacts/${resolvedContact.id}`,
                                    '_blank'
                                  )
                                }
                              >
                                <ExternalLink className='h-3 w-3' />
                                Ouvrir la fiche
                              </Button>
                              <Popover
                                modal={false}
                                open={contactPopoverOpen}
                                onOpenChange={setContactPopoverOpen}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant='outline'
                                    size='sm'
                                    className='gap-1.5 text-xs'
                                  >
                                    <User className='h-3 w-3' />
                                    Changer le contact
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className='w-[350px] p-0'
                                  align='start'
                                >
                                  <Command shouldFilter={false}>
                                    <CommandInput
                                      placeholder='Rechercher un contact...'
                                      className='text-xs'
                                      value={contactSearch}
                                      onValueChange={setContactSearch}
                                    />
                                    <CommandList>
                                      <CommandEmpty className='py-3 text-center text-xs text-muted-foreground'>
                                        Aucun contact trouvé.
                                      </CommandEmpty>
                                      <CommandGroup>
                                        {contactResults.map((c) => (
                                          <CommandItem
                                            key={c.id}
                                            value={`${c.first_name} ${c.last_name || ''} ${c.email || ''} ${(c as any).company?.name || ''}`}
                                            onSelect={() =>
                                              handleChangeContact(c.id)
                                            }
                                            className='cursor-pointer text-xs'
                                          >
                                            <div className='flex w-full flex-col'>
                                              <div className='flex items-center gap-2'>
                                                <span className='font-medium'>
                                                  {c.first_name}{' '}
                                                  {c.last_name || ''}
                                                </span>
                                                {(c as any).company ? (
                                                  <Badge className='h-5 bg-blue-500 px-1.5 py-0 text-[10px] text-white'>
                                                    B2B
                                                  </Badge>
                                                ) : (
                                                  <Badge className='h-5 bg-gray-500 px-1.5 py-0 text-[10px] text-white'>
                                                    B2C
                                                  </Badge>
                                                )}
                                              </div>
                                              <span className='text-[10px] text-muted-foreground'>
                                                {c.email || ''}
                                                {(c as any).company?.name &&
                                                  ` — ${(c as any).company.name}`}
                                              </span>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card>
                          <CardContent className='space-y-3 p-4'>
                            <p className='text-center text-sm text-muted-foreground'>
                              Aucun contact associé.
                            </p>
                            <Popover
                              modal={false}
                              open={contactPopoverOpen}
                              onOpenChange={setContactPopoverOpen}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant='outline'
                                  size='sm'
                                  className='w-full gap-1.5 text-xs'
                                >
                                  <User className='h-3 w-3' />
                                  Assigner un contact
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className='w-[350px] p-0'
                                align='start'
                              >
                                <Command shouldFilter={false}>
                                  <CommandInput
                                    placeholder='Rechercher un contact...'
                                    className='text-xs'
                                    value={contactSearch}
                                    onValueChange={setContactSearch}
                                  />
                                  <CommandList>
                                    <CommandEmpty className='py-3 text-center text-xs text-muted-foreground'>
                                      Aucun contact trouvé.
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {contactResults.map((c) => (
                                        <CommandItem
                                          key={c.id}
                                          value={`${c.first_name} ${c.last_name || ''} ${c.email || ''} ${(c as any).company?.name || ''}`}
                                          onSelect={() =>
                                            handleChangeContact(c.id)
                                          }
                                          className='cursor-pointer text-xs'
                                        >
                                          <div className='flex w-full flex-col'>
                                            <div className='flex items-center gap-2'>
                                              <span className='font-medium'>
                                                {c.first_name}{' '}
                                                {c.last_name || ''}
                                              </span>
                                              {(c as any).company ? (
                                                <Badge className='h-5 bg-blue-500 px-1.5 py-0 text-[10px] text-white'>
                                                  B2B
                                                </Badge>
                                              ) : (
                                                <Badge className='h-5 bg-gray-500 px-1.5 py-0 text-[10px] text-white'>
                                                  B2C
                                                </Badge>
                                              )}
                                            </div>
                                            <span className='text-[10px] text-muted-foreground'>
                                              {c.email || ''}
                                              {(c as any).company?.name &&
                                                ` — ${(c as any).company.name}`}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    {/* ── Tab Conditions ── */}
                    <TabsContent
                      value='conditions'
                      className='mt-0 flex h-full gap-3'
                    >
                      {/* Left nav - fixed, not scrollable */}
                      <div className='w-32 shrink-0 space-y-1'>
                        {[
                          { key: 'devis', label: 'Devis' },
                          { key: 'facture', label: 'Facture' },
                          { key: 'acompte', label: 'Acompte' },
                          { key: 'solde', label: 'Solde' },
                          { key: 'additional', label: 'Conditions suppl.' },
                        ].map((item) => (
                          <button
                            key={item.key}
                            onClick={() => setActiveCondition(item.key)}
                            className={`w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                              activeCondition === item.key
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted'
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
                          onClick={() => handleLoadDefaultConditions(language)}
                        >
                          <RotateCcw className='h-3 w-3' />
                          Charger CGV
                        </Button>
                      </div>

                      {/* Right: textarea - scrollable */}
                      <div className='min-h-0 flex-1'>
                        {activeCondition === 'devis' && (
                          <Textarea
                            value={conditionsDevis}
                            onChange={(e) =>
                              dirty(setConditionsDevis)(e.target.value)
                            }
                            placeholder='Conditions générales de vente — Devis'
                            className='h-full resize-none font-mono text-xs'
                          />
                        )}
                        {activeCondition === 'facture' && (
                          <Textarea
                            value={conditionsFacture}
                            onChange={(e) =>
                              dirty(setConditionsFacture)(e.target.value)
                            }
                            placeholder='Conditions générales — Facture'
                            className='h-full resize-none font-mono text-xs'
                          />
                        )}
                        {activeCondition === 'acompte' && (
                          <Textarea
                            value={conditionsAcompte}
                            onChange={(e) =>
                              dirty(setConditionsAcompte)(e.target.value)
                            }
                            placeholder='Conditions — Acompte'
                            className='h-full resize-none font-mono text-xs'
                          />
                        )}
                        {activeCondition === 'solde' && (
                          <Textarea
                            value={conditionsSolde}
                            onChange={(e) =>
                              dirty(setConditionsSolde)(e.target.value)
                            }
                            placeholder='Conditions — Solde / Balance'
                            className='h-full resize-none font-mono text-xs'
                          />
                        )}
                        {activeCondition === 'additional' && (
                          <Textarea
                            value={additionalConditions}
                            onChange={(e) =>
                              dirty(setAdditionalConditions)(e.target.value)
                            }
                            placeholder='Conditions supplémentaires personnalisées...'
                            className='h-full resize-none font-mono text-xs'
                          />
                        )}
                      </div>
                    </TabsContent>

                    {/* ── Tab Produits ── */}
                    <TabsContent value='produits' className='mt-0 space-y-3'>
                      {/* Add product/package controls */}
                      <div className='flex items-center gap-2'>
                        <Popover
                          modal={false}
                          open={productPopoverOpen}
                          onOpenChange={(o) => {
                            setProductPopoverOpen(o)
                            if (!o) setProductSearch('')
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              size='sm'
                              className='h-8 flex-1 justify-start gap-1.5 text-xs'
                              variant='outline'
                              disabled={isAddingItem}
                            >
                              <Plus className='h-3 w-3' />
                              Produit
                              <ChevronDown className='ml-auto h-3 w-3 opacity-50' />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className='w-[400px] p-0'
                            align='start'
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <div className='border-b p-2'>
                              <Input
                                placeholder='Rechercher un produit...'
                                value={productSearch}
                                onChange={(e) =>
                                  setProductSearch(e.target.value)
                                }
                                className='h-8 text-xs'
                                autoFocus
                              />
                            </div>
                            <div
                              className='max-h-[280px] overflow-y-auto overscroll-contain p-1'
                              style={{ scrollbarColor: '#888 transparent' }}
                              onWheel={(e) => e.stopPropagation()}
                              onTouchMove={(e) => e.stopPropagation()}
                            >
                              {(() => {
                                const q = productSearch.toLowerCase()
                                const filtered = catalogProducts.filter(
                                  (p) =>
                                    !q ||
                                    p.name.toLowerCase().includes(q) ||
                                    (p.type || '').toLowerCase().includes(q) ||
                                    (p.description || '')
                                      .toLowerCase()
                                      .includes(q)
                                )
                                if (filtered.length === 0) {
                                  return (
                                    <p className='py-3 text-center text-xs text-muted-foreground'>
                                      Aucun produit trouvé.
                                    </p>
                                  )
                                }
                                return filtered.map((p) => (
                                  <button
                                    key={p.id}
                                    type='button'
                                    className='flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground'
                                    onClick={() =>
                                      handleAddProductFromCatalog(p.id)
                                    }
                                  >
                                    <div className='text-left'>
                                      <span className='font-medium'>
                                        {p.name}
                                      </span>
                                      {p.description && (
                                        <span className='block max-w-[250px] truncate text-[10px] text-muted-foreground'>
                                          {p.description}
                                        </span>
                                      )}
                                    </div>
                                    <span className='ml-2 shrink-0 text-muted-foreground'>
                                      {p.unit_price_ht.toFixed(2)}€ HT
                                    </span>
                                  </button>
                                ))
                              })()}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Popover
                          modal={false}
                          open={packagePopoverOpen}
                          onOpenChange={(o) => {
                            setPackagePopoverOpen(o)
                            if (!o) setPackageSearch('')
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              size='sm'
                              className='h-8 flex-1 justify-start gap-1.5 text-xs'
                              variant='outline'
                              disabled={isAddingItem}
                            >
                              <Package className='h-3 w-3' />
                              Package
                              <ChevronDown className='ml-auto h-3 w-3 opacity-50' />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className='w-[400px] p-0'
                            align='start'
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <div className='border-b p-2'>
                              <Input
                                placeholder='Rechercher un package...'
                                value={packageSearch}
                                onChange={(e) =>
                                  setPackageSearch(e.target.value)
                                }
                                className='h-8 text-xs'
                                autoFocus
                              />
                            </div>
                            <div
                              className='max-h-[280px] overflow-y-auto overscroll-contain p-1'
                              style={{ scrollbarColor: '#888 transparent' }}
                              onWheel={(e) => e.stopPropagation()}
                              onTouchMove={(e) => e.stopPropagation()}
                            >
                              {(() => {
                                const q = packageSearch.toLowerCase()
                                const filtered = catalogPackages.filter(
                                  (pkg) =>
                                    !q ||
                                    pkg.name.toLowerCase().includes(q) ||
                                    (pkg.description || '')
                                      .toLowerCase()
                                      .includes(q)
                                )
                                if (filtered.length === 0) {
                                  return (
                                    <p className='py-3 text-center text-xs text-muted-foreground'>
                                      Aucun package trouvé.
                                    </p>
                                  )
                                }
                                return filtered.map((pkg) => (
                                  <button
                                    key={pkg.id}
                                    type='button'
                                    className='flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground'
                                    onClick={() =>
                                      handleAddPackageFromCatalog(pkg.id)
                                    }
                                  >
                                    <div className='text-left'>
                                      <div className='flex items-center gap-1.5'>
                                        <span className='font-medium'>
                                          {pkg.name}
                                        </span>
                                        {pkg.price_per_person && (
                                          <span className='rounded bg-muted px-1 text-[9px]'>
                                            par pers.
                                          </span>
                                        )}
                                      </div>
                                      {pkg.description && (
                                        <span className='block max-w-[250px] truncate text-[10px] text-muted-foreground'>
                                          {pkg.description}
                                        </span>
                                      )}
                                      <span className='block text-[10px] text-muted-foreground'>
                                        {pkg.package_products?.length || 0}{' '}
                                        produits inclus
                                      </span>
                                    </div>
                                    <span className='ml-2 shrink-0 text-muted-foreground'>
                                      {pkg.unit_price_ht.toFixed(2)}€ HT
                                    </span>
                                  </button>
                                ))
                              })()}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button
                          size='sm'
                          variant='outline'
                          className='h-8 shrink-0 gap-1 text-xs'
                          disabled={isAddingItem}
                          onClick={() => {
                            if (!quoteId) return
                            addQuoteItem(
                              {
                                quoteId,
                                name: 'Nouveau produit',
                                quantity: booking.guests_count || 1,
                                unitPrice: 0,
                                tvaRate: 20,
                                position: items.length,
                              },
                              {
                                onSuccess: () =>
                                  toast.success('Produit ajouté'),
                                onError: () =>
                                  toast.error("Erreur lors de l'ajout"),
                              }
                            )
                          }}
                        >
                          <Plus className='h-3 w-3' />
                          Produit manuel
                        </Button>
                      </div>

                      {/* Items table */}
                      {items.length === 0 ? (
                        <Card>
                          <CardContent className='py-8 text-center text-sm text-muted-foreground'>
                            Aucun produit ajouté. Utilisez le catalogue ou
                            ajoutez un produit manuellement.
                          </CardContent>
                        </Card>
                      ) : (
                        <div className='rounded-md border'>
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                          >
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className='w-8' />
                                  <TableHead className='text-xs'>
                                    Désignation
                                  </TableHead>
                                  <TableHead className='w-20 text-xs'>
                                    Qté
                                  </TableHead>
                                  <TableHead className='w-24 text-xs'>
                                    Prix TTC
                                  </TableHead>
                                  <TableHead className='w-20 text-xs'>
                                    Prix HT
                                  </TableHead>
                                  <TableHead className='w-20 text-xs'>
                                    TVA %
                                  </TableHead>
                                  <TableHead className='w-16 text-xs text-red-600'>
                                    Remise %
                                  </TableHead>
                                  <TableHead className='w-24 text-right text-xs'>
                                    Total HT
                                  </TableHead>
                                  <TableHead className='w-24 text-right text-xs'>
                                    Total TTC
                                  </TableHead>
                                  <TableHead className='w-10' />
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <SortableContext
                                  items={items.map((i: QuoteItem) => i.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  {items.map((item: QuoteItem) => (
                                    <SortableItemRow
                                      key={item.id}
                                      item={item}
                                      onUpdateItem={handleUpdateItem}
                                      onUpdateItemFields={
                                        handleUpdateItemFields
                                      }
                                      onDeleteItem={handleDeleteItem}
                                    />
                                  ))}
                                </SortableContext>
                              </TableBody>
                            </Table>
                          </DndContext>

                          {/* Totals */}
                          <div className='space-y-1 border-t px-4 py-2'>
                            {discountPercentage > 0 ? (
                              <>
                                <div className='flex justify-between text-xs'>
                                  <span className='text-muted-foreground'>
                                    Sous-total HT
                                  </span>
                                  <span className='font-medium text-muted-foreground line-through'>
                                    {formatEuroDecimal(rawTotalHt)}
                                  </span>
                                </div>
                                <div className='flex justify-between text-xs'>
                                  <span className='text-muted-foreground text-red-600'>
                                    Remise {discountPercentage}%
                                  </span>
                                  <span className='font-medium text-red-600'>
                                    - {formatEuroDecimal(rawTotalHt - totalHt)}
                                  </span>
                                </div>
                                <div className='flex justify-between text-xs'>
                                  <span className='text-muted-foreground'>
                                    Total HT après remise
                                  </span>
                                  <span className='font-medium'>
                                    {formatEuroDecimal(totalHt)}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className='flex justify-between text-xs'>
                                <span className='text-muted-foreground'>
                                  Total HT
                                </span>
                                <span className='font-medium'>
                                  {formatEuroDecimal(totalHt)}
                                </span>
                              </div>
                            )}
                            <div className='flex justify-between text-xs'>
                              <span className='text-muted-foreground'>TVA</span>
                              <span className='font-medium'>
                                {formatEuroDecimal(totalTtc - totalHt)}
                              </span>
                            </div>
                            <Separator />
                            <div className='flex justify-between text-sm font-semibold'>
                              <span>Total TTC</span>
                              <span>{formatEuroWhole(totalTtc)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* ── Tab Extras ── */}
                    <TabsContent value='extras' className='mt-0 space-y-3'>
                      <p className='text-xs text-muted-foreground'>
                        Ajoutez des extras (consommations, services
                        supplémentaires) qui apparaîtront sur la facture de
                        solde.
                      </p>

                      {/* Add extra form */}
                      <Card>
                        <CardContent className='space-y-3 pt-4'>
                          <div className='grid grid-cols-2 gap-3'>
                            <div>
                              <Label className='text-xs'>Désignation</Label>
                              <Input
                                value={extraName}
                                onChange={(e) => setExtraName(e.target.value)}
                                placeholder='Ex: Bouteille de champagne'
                                className='mt-1 h-8 text-xs'
                              />
                            </div>
                            <div>
                              <Label className='text-xs'>
                                Description (optionnel)
                              </Label>
                              <Input
                                value={extraDescription}
                                onChange={(e) =>
                                  setExtraDescription(e.target.value)
                                }
                                placeholder='Détails...'
                                className='mt-1 h-8 text-xs'
                              />
                            </div>
                          </div>
                          <div className='grid grid-cols-4 gap-3'>
                            <div>
                              <Label className='text-xs'>Quantité</Label>
                              <Input
                                type='number'
                                min={1}
                                value={extraQuantity}
                                onChange={(e) =>
                                  setExtraQuantity(
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                className='mt-1 h-8 text-xs'
                              />
                            </div>
                            <div>
                              <Label className='text-xs'>
                                Prix unitaire TTC
                              </Label>
                              <Input
                                type='number'
                                min={0}
                                step={0.01}
                                value={extraUnitPrice}
                                onChange={(e) =>
                                  setExtraUnitPrice(
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className='mt-1 h-8 text-xs'
                              />
                              <p className='mt-0.5 text-[10px] text-muted-foreground'>
                                ={' '}
                                {deriveHtFromTtc(
                                  extraUnitPrice,
                                  extraTvaRate
                                ).toFixed(2)}{' '}
                                € HT
                              </p>
                            </div>
                            <div>
                              <Label className='text-xs'>TVA %</Label>
                              <Input
                                type='number'
                                min={0}
                                max={100}
                                value={extraTvaRate}
                                onChange={(e) =>
                                  setExtraTvaRate(
                                    parseFloat(e.target.value) || 20
                                  )
                                }
                                className='mt-1 h-8 text-xs'
                              />
                            </div>
                            <div className='flex items-end'>
                              <Button
                                size='sm'
                                className='h-8 w-full gap-1 text-xs'
                                disabled={
                                  !extraName || !quoteId || isAddingItem
                                }
                                onClick={() => {
                                  if (!quoteId || !extraName) return
                                  if (editingExtra) {
                                    updateQuoteItem(
                                      {
                                        id: editingExtra.id,
                                        quoteId,
                                        name: extraName,
                                        description: extraDescription || null,
                                        quantity: extraQuantity,
                                        unit_price: deriveHtFromTtc(
                                          extraUnitPrice,
                                          extraTvaRate
                                        ),
                                        tva_rate: extraTvaRate,
                                      } as any,
                                      {
                                        onSuccess: () => {
                                          toast.success('Extra modifié')
                                          setEditingExtra(null)
                                          setExtraName('')
                                          setExtraDescription('')
                                          setExtraQuantity(1)
                                          setExtraUnitPrice(0)
                                          setExtraTvaRate(20)
                                        },
                                        onError: () =>
                                          toast.error(
                                            'Erreur lors de la modification'
                                          ),
                                      }
                                    )
                                  } else {
                                    addQuoteItem(
                                      {
                                        quoteId,
                                        name: extraName,
                                        description: extraDescription,
                                        quantity: extraQuantity,
                                        unitPrice: deriveHtFromTtc(
                                          extraUnitPrice,
                                          extraTvaRate
                                        ),
                                        tvaRate: extraTvaRate,
                                        position: items.length,
                                        itemType: 'extra',
                                      },
                                      {
                                        onSuccess: () => {
                                          toast.success('Extra ajouté')
                                          setExtraName('')
                                          setExtraDescription('')
                                          setExtraQuantity(1)
                                          setExtraUnitPrice(0)
                                          setExtraTvaRate(20)
                                        },
                                        onError: () =>
                                          toast.error("Erreur lors de l'ajout"),
                                      }
                                    )
                                  }
                                }}
                              >
                                {isAddingItem ? (
                                  <Loader2 className='h-3 w-3 animate-spin' />
                                ) : (
                                  <Plus className='h-3 w-3' />
                                )}
                                {editingExtra ? 'Modifier' : 'Ajouter'}
                              </Button>
                            </div>
                          </div>
                          {editingExtra && (
                            <Button
                              variant='ghost'
                              size='sm'
                              className='text-xs'
                              onClick={() => {
                                setEditingExtra(null)
                                setExtraName('')
                                setExtraDescription('')
                                setExtraQuantity(1)
                                setExtraUnitPrice(0)
                                setExtraTvaRate(20)
                              }}
                            >
                              Annuler la modification
                            </Button>
                          )}
                        </CardContent>
                      </Card>

                      {/* Extras list */}
                      {extras.length === 0 ? (
                        <Card>
                          <CardContent className='py-8 text-center text-sm text-muted-foreground'>
                            Aucun extra ajouté. Les extras apparaîtront sur la
                            facture de solde.
                          </CardContent>
                        </Card>
                      ) : (
                        <div className='rounded-md border'>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className='text-xs'>
                                  Désignation
                                </TableHead>
                                <TableHead className='w-16 text-xs'>
                                  Qté
                                </TableHead>
                                <TableHead className='w-20 text-xs'>
                                  P.U. HT
                                </TableHead>
                                <TableHead className='w-16 text-xs'>
                                  TVA
                                </TableHead>
                                <TableHead className='w-24 text-right text-xs'>
                                  Total TTC
                                </TableHead>
                                <TableHead className='w-16' />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {extras.map((extra) => (
                                <TableRow key={extra.id}>
                                  <TableCell>
                                    <div className='space-y-0.5'>
                                      <span className='text-xs font-medium'>
                                        {extra.name}
                                      </span>
                                      {extra.description && (
                                        <p className='text-[10px] text-muted-foreground'>
                                          {extra.description}
                                        </p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className='text-xs'>
                                    {extra.quantity}
                                  </TableCell>
                                  <TableCell className='text-xs'>
                                    {formatEuroDecimal(extra.unit_price || 0)}
                                  </TableCell>
                                  <TableCell className='text-xs'>
                                    {extra.tva_rate}%
                                  </TableCell>
                                  <TableCell className='text-right text-xs font-medium'>
                                    {formatEuroWhole(extra.total_ttc || 0)}
                                  </TableCell>
                                  <TableCell>
                                    <div className='flex items-center gap-1'>
                                      <Button
                                        size='icon'
                                        variant='ghost'
                                        className='h-6 w-6'
                                        onClick={() => {
                                          setEditingExtra(extra)
                                          setExtraName(extra.name)
                                          setExtraDescription(
                                            extra.description || ''
                                          )
                                          setExtraQuantity(extra.quantity ?? 1)
                                          setExtraUnitPrice(
                                            Math.round(
                                              (extra.unit_price ?? 0) *
                                                (1 +
                                                  (extra.tva_rate ?? 20) /
                                                    100) *
                                                100
                                            ) / 100
                                          )
                                          setExtraTvaRate(extra.tva_rate ?? 20)
                                        }}
                                      >
                                        <ReceiptText className='h-3 w-3' />
                                      </Button>
                                      <Button
                                        size='icon'
                                        variant='ghost'
                                        className='h-6 w-6 text-destructive hover:text-destructive'
                                        onClick={() => {
                                          if (!quoteId) return
                                          deleteQuoteItem(
                                            { id: extra.id, quoteId },
                                            {
                                              onSuccess: () =>
                                                toast.success('Extra supprimé'),
                                              onError: () =>
                                                toast.error(
                                                  'Erreur lors de la suppression'
                                                ),
                                            }
                                          )
                                        }}
                                      >
                                        <Trash2 className='h-3 w-3' />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>

                          {/* Extras totals */}
                          <div className='space-y-1 border-t px-4 py-2'>
                            <div className='flex justify-between text-xs'>
                              <span className='text-muted-foreground'>
                                Total Extras HT
                              </span>
                              <span className='font-medium'>
                                {formatEuroDecimal(
                                  extras.reduce(
                                    (sum, e) =>
                                      sum +
                                      (e.quantity ?? 1) * (e.unit_price ?? 0),
                                    0
                                  )
                                )}
                              </span>
                            </div>
                            <div className='flex justify-between text-sm font-semibold'>
                              <span>Total Extras TTC</span>
                              <span>
                                {formatEuroWhole(
                                  extras.reduce(
                                    (sum, e) => sum + (e.total_ttc || 0),
                                    0
                                  )
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </div>
              </Tabs>
            </div>

            {/* Right: PDF Preview */}
            <div className='flex w-[45%] flex-col overflow-hidden bg-muted/30'>
              <div className='flex shrink-0 items-center justify-between border-b px-4 py-2'>
                <div className='flex items-center gap-2'>
                  <Select
                    value={documentType}
                    onValueChange={(v) => setDocumentType(v as DocumentType)}
                  >
                    <SelectTrigger className='h-7 w-[200px] text-xs'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='devis' className='text-xs'>
                        Devis
                      </SelectItem>
                      <SelectItem value='acompte' className='text-xs'>
                        Acompte à signature
                      </SelectItem>
                      <SelectItem value='solde' className='text-xs'>
                        Solde
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className='flex items-center gap-1'>
                    <Button
                      size='sm'
                      variant={language === 'fr' ? 'default' : 'outline'}
                      className='h-6 px-1.5 text-[10px]'
                      onClick={() => handleLanguageChange('fr')}
                    >
                      🇫🇷
                    </Button>
                    <Button
                      size='sm'
                      variant={language === 'en' ? 'default' : 'outline'}
                      className='h-6 px-1.5 text-[10px]'
                      onClick={() => handleLanguageChange('en')}
                    >
                      🇬🇧
                    </Button>
                  </div>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  className='h-7 gap-1.5 text-xs'
                  onClick={async () => {
                    if (!quoteData?.id) {
                      toast.error('Devis non disponible')
                      return
                    }
                    try {
                      toast.info('Génération du PDF...')
                      const {
                        data: { session },
                      } = await supabase.auth.getSession()
                      const response = await fetch(
                        `${API_BASE_URL}/api/quotes/${quoteData.id}/download-pdf?type=${documentType}`,
                        {
                          headers: session?.access_token
                            ? {
                                Authorization: `Bearer ${session.access_token}`,
                              }
                            : {},
                        }
                      )
                      if (!response.ok) throw new Error('Erreur serveur')
                      const blob = await response.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${quoteData.quote_number || 'devis'}-${documentType}.pdf`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                      toast.success('PDF téléchargé')
                    } catch {
                      toast.error("Erreur lors de l'export PDF")
                    }
                  }}
                >
                  <Download className='h-3 w-3' />
                  Télécharger PDF
                </Button>
              </div>
              <div className='flex-1 overflow-auto'>
                <div className='p-4'>
                  <QuotePreview
                    data={previewData}
                    documentType={documentType}
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quit confirmation - rendered OUTSIDE Dialog to avoid portal stacking issues */}
      <AlertDialog open={showQuitConfirm} onOpenChange={setShowQuitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitter sans sauvegarder ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous avez des modifications non sauvegardées. Voulez-vous quitter
              sans les enregistrer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowQuitConfirm(false)
                setIsDirty(false)
                // Delay closing dialog to let AlertDialog unmount first
                setTimeout(() => onOpenChange(false), 0)
              }}
              className='text-destructive-foreground bg-destructive hover:bg-destructive/90'
            >
              Quitter sans sauvegarder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
