import { useEffect, useMemo, useState, forwardRef, useImperativeHandle, useRef } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, Link, useBlocker } from '@tanstack/react-router'
import { toast } from 'sonner'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Download,
  Edit,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Mail,
  MoreVertical,
  Phone,
  Plus,
  Trash2 as TrashIcon,
  Send,
  FileSignature,
  CreditCard,
  Receipt,
  CheckCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  useUpdateBooking,
  useDeleteBooking,
  useDuplicateBooking,
  useBookingStatuses,
  type BookingWithRelations,
  useQuotesByBooking,
  usePaymentsByBooking,
} from '../hooks/use-bookings'
import {
  useSetPrimaryQuote,
  useCreateQuote,
  useDeleteQuote,
  useRestaurantById,
  useContactWithCompany,
  useSendQuoteEmail,
  useSendSignature,
  useSendDeposit,
  useSendBalance,
} from '../hooks/use-quotes'
import {
  useDocumentsByBooking,
  useUploadDocument,
  useDeleteDocument,
} from '../hooks/use-documents'
import { useOrganizationUsers } from '@/features/contacts/hooks/use-contacts'
import { useSpaces } from '@/features/settings/hooks/use-settings'
import { useMenuFormsByBooking, useCreateMenuForm, useDeleteMenuForm } from '../hooks/use-menu-forms'
import { useActivityLogs, useLogActivity, createActivityLogger, ACTION_ICONS, type ActivityActionType } from '../hooks/use-activity-logs'
import { QuoteEditor } from './quote-editor'
import { MenuFormBuilder } from './menu-form-builder'
import { PaymentDialog } from './payment-dialog'
import type { Payment, Quote } from '@/lib/supabase/types'

const bookingDetailSchema = z.object({
  contact_id: z.string().min(1, 'Le contact est requis'),
  restaurant_id: z.string().min(1, 'Le restaurant est requis'),
  status_id: z.string().optional(),
  assigned_to: z.string().optional(),
  occasion: z.string().optional(),
  option: z.string().optional(),
  relance: z.string().optional().nullable(),
  source: z.string().optional(),
  is_table_blocked: z.boolean().optional(),
  has_extra_provider: z.boolean().optional(),
})

type BookingDetailFormData = z.infer<typeof bookingDetailSchema>

type BookingDetailProps = {
  booking: BookingWithRelations
  activeTab?: string
  onTabChange?: (tab: string) => void
}

// ─── Main component ───────────────────────────────────────────────
export const BookingDetail = forwardRef<
  { submitForm: () => void; deleteBooking: () => void; getIsDirty: () => boolean },
  BookingDetailProps & { onDirtyChange?: (isDirty: boolean) => void }
>(function BookingDetail({ booking, activeTab = 'evenementiel', onDirtyChange }, ref) {
  const navigate = useNavigate()
  const { mutate: updateBooking } = useUpdateBooking()
  const { mutate: deleteBookingMutation } = useDeleteBooking()
  const { mutate: duplicateBooking } = useDuplicateBooking()
  const { data: statuses = [] } = useBookingStatuses()
  const { data: users = [] } = useOrganizationUsers()
  const { data: spaces = [] } = useSpaces(booking.restaurant_id || undefined)
  const { data: quotes = [] } = useQuotesByBooking(booking.id)
  const { mutate: setPrimaryQuote, isPending: isSettingPrimary } = useSetPrimaryQuote()
  const { data: payments = [] } = usePaymentsByBooking(booking.id)
  const { data: documents = [] } = useDocumentsByBooking(booking.id)
  const { mutate: uploadDocument } = useUploadDocument()
  const { mutate: deleteDocument, isPending: isDeletingDocument } = useDeleteDocument()
  const { mutate: createQuote, isPending: isCreatingQuote } = useCreateQuote()
  const { mutate: deleteQuoteMutation } = useDeleteQuote()
  const { mutate: sendQuoteEmail, isPending: isSendingEmail } = useSendQuoteEmail()
  const { mutate: sendSignature, isPending: isSendingSignature } = useSendSignature()
  const { mutate: sendDeposit, isPending: isSendingDeposit } = useSendDeposit()
  const { mutate: sendBalance, isPending: isSendingBalance } = useSendBalance()
  const { data: fullRestaurant } = useRestaurantById(booking.restaurant_id)
  const { data: fullContact } = useContactWithCompany(booking.contact_id)

  // Quote editor state
  const [quoteEditorOpen, setQuoteEditorOpen] = useState(false)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)

  // Menu forms state
  const { data: menuForms = [] } = useMenuFormsByBooking(booking.id)
  const { mutate: createMenuForm, isPending: isCreatingMenuForm } = useCreateMenuForm()
  const { mutate: deleteMenuForm } = useDeleteMenuForm()
  const [menuFormBuilderOpen, setMenuFormBuilderOpen] = useState(false)
  const [editingMenuFormId, setEditingMenuFormId] = useState<string | null>(null)
  const [showMenuFormSourceDialog, setShowMenuFormSourceDialog] = useState(false)

  // Activity logs
  const { data: activityLogs = [], isLoading: isLoadingLogs } = useActivityLogs(booking.id)
  const { mutate: logActivity } = useLogActivity()
  const activityLogger = createActivityLogger(logActivity)

  const daysUntilEvent = differenceInDays(new Date(booking.event_date), new Date())

  const formValues = useMemo(() => ({
    contact_id: booking.contact_id || '',
    restaurant_id: booking.restaurant_id || '',
    status_id: booking.status_id || '',
    assigned_to: booking.assigned_to || '',
    occasion: booking.occasion || '',
    option: booking.option || '',
    relance: booking.relance || '',
    source: booking.source || '',
    is_table_blocked: booking.is_table_blocked || false,
    has_extra_provider: booking.has_extra_provider || false,
  }), [booking])

  const form = useForm<BookingDetailFormData>({
    resolver: zodResolver(bookingDetailSchema),
    values: formValues,
  })

  // ── Event form state (right panel fields) ──
  const buildEventFormValues = (b: BookingWithRelations) => ({
    event_date: b.event_date || '',
    start_time: b.start_time || '',
    end_time: b.end_time || '',
    guests_count: b.guests_count ?? '',
    space_id: b.space_id || '',
    is_date_flexible: b.is_date_flexible || false,
    is_restaurant_flexible: b.is_restaurant_flexible || false,
    client_preferred_time: b.client_preferred_time || '',
    menu_aperitif: b.menu_aperitif || '',
    menu_entree: b.menu_entree || '',
    menu_plat: b.menu_plat || '',
    menu_dessert: b.menu_dessert || '',
    menu_boissons: b.menu_boissons || '',
    mise_en_place: b.mise_en_place || '',
    deroulement: b.deroulement || '',
    is_privatif: b.is_privatif || false,
    allergies_regimes: b.allergies_regimes || '',
    prestations_souhaitees: b.prestations_souhaitees || '',
    budget_client: b.budget_client ?? '',
    format_souhaite: b.format_souhaite || '',
    contact_sur_place_nom: b.contact_sur_place_nom || '',
    contact_sur_place_tel: b.contact_sur_place_tel || '',
    contact_sur_place_societe: b.contact_sur_place_societe || '',
    instructions_speciales: b.instructions_speciales || '',
    commentaires: b.commentaires || '',
    date_signature_devis: b.date_signature_devis || '',
    assigned_user_ids: b.assigned_user_ids || [],
  })

  const initialEventFormRef = useRef<Record<string, unknown>>(buildEventFormValues(booking))
  const [eventForm, setEventForm] = useState<Record<string, unknown>>(buildEventFormValues(booking))

  useEffect(() => {
    const vals = buildEventFormValues(booking)
    initialEventFormRef.current = vals
    setEventForm(vals)
  }, [booking])

  // ── Dirty detection ──
  const isEventFormDirty = useMemo(() => {
    const initial = initialEventFormRef.current
    return Object.keys(initial).some(key => {
      const a = eventForm[key]
      const b = initial[key]
      if (Array.isArray(a) && Array.isArray(b)) {
        return a.length !== b.length || a.some((v, i) => v !== b[i])
      }
      return a !== b
    })
  }, [eventForm])

  const isDirty = form.formState.isDirty || isEventFormDirty

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const blocker = useBlocker({ condition: isDirty })

  useEffect(() => {
    if (blocker.status === 'blocked') {
      toast.warning('Modifications non enregistrées', {
        description: 'Voulez-vous vraiment quitter sans enregistrer ?',
        action: {
          label: 'Quitter',
          onClick: () => blocker.proceed?.(),
        },
        cancel: {
          label: 'Rester',
          onClick: () => blocker.reset?.(),
        },
        duration: 10000,
      })
    }
  }, [blocker.status, blocker])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const updateEventField = (key: string, value: unknown) => {
    setEventForm(prev => ({ ...prev, [key]: value }))
  }

  const onSubmit = (data: BookingDetailFormData) => {
    // Convert empty strings to null for numeric fields
    const cleanEventForm = {
      ...eventForm,
      guests_count: eventForm.guests_count === '' ? null : eventForm.guests_count,
      budget_client: eventForm.budget_client === '' ? null : eventForm.budget_client,
    }

    // Check if anything actually changed
    const hasChanges = form.formState.isDirty || isEventFormDirty
    if (!hasChanges) {
      return
    }

    // Detect status change for logging
    const oldStatusId = booking.status_id
    const newStatusId = data.status_id || null
    const statusChanged = oldStatusId !== newStatusId

    // Detect assignment change for logging
    const oldAssignedTo = booking.assigned_to
    const newAssignedTo = data.assigned_to || null
    const assignmentChanged = oldAssignedTo !== newAssignedTo

    const updateData = {
      id: booking.id,
      contact_id: data.contact_id,
      restaurant_id: data.restaurant_id,
      status_id: data.status_id || null,
      assigned_to: data.assigned_to || null,
      occasion: data.occasion || null,
      option: data.option || null,
      relance: data.relance || null,
      source: data.source || null,
      is_table_blocked: data.is_table_blocked || false,
      has_extra_provider: data.has_extra_provider || false,
      ...cleanEventForm,
    }

    updateBooking(updateData as never, {
      onSuccess: () => {
        toast.success('Événement mis à jour')
        form.reset(data, { keepValues: true })
        // Mark current eventForm as the new baseline
        initialEventFormRef.current = { ...eventForm }

        // Log status change
        if (statusChanged) {
          const oldStatusName = statuses.find(s => s.id === oldStatusId)?.name || 'Non défini'
          const newStatusName = statuses.find(s => s.id === newStatusId)?.name || 'Non défini'
          activityLogger.bookingStatusChanged(booking.id, oldStatusName, newStatusName)
        }
        // Log assignment change
        else if (assignmentChanged) {
          const newUserName = users.find(u => u.id === newAssignedTo)?.first_name || null
          activityLogger.bookingAssigned(booking.id, newUserName)
        }
        // Log general update if no specific change detected
        else {
          // Build changes object for detailed logging (skip if both values are empty/null)
          const changes: Record<string, { old: unknown; new: unknown }> = {}
          if (booking.guests_count !== eventForm.guests_count) {
            changes['Convives'] = { old: booking.guests_count, new: eventForm.guests_count }
          }
          if (booking.event_date !== eventForm.event_date) {
            changes['Date'] = { old: booking.event_date, new: eventForm.event_date }
          }
          // Only log occasion if there's an actual change (not empty to empty)
          const oldOccasion = booking.occasion || ''
          const newOccasion = data.occasion || ''
          if (oldOccasion !== newOccasion && (oldOccasion || newOccasion)) {
            changes['Occasion'] = { old: oldOccasion || null, new: newOccasion || null }
          }
          if (Object.keys(changes).length > 0) {
            activityLogger.bookingUpdated(booking.id, changes)
          }
        }
      },
      onError: () => toast.error('Erreur lors de la mise à jour'),
    })
  }

  const handleDelete = () => {
    deleteBookingMutation(booking.id, {
      onSuccess: () => {
        toast.success('Événement supprimé')
        navigate({ to: '/evenements' })
      },
      onError: () => toast.error('Erreur lors de la suppression'),
    })
  }

  const handleDuplicate = () => {
    duplicateBooking(booking, {
      onSuccess: (data) => {
        toast.success('Événement dupliqué')
        navigate({ to: '/evenements/booking/$id', params: { id: (data as { id: string }).id } })
      },
      onError: () => toast.error('Erreur lors de la duplication'),
    })
  }

  // Expose submitForm, deleteBooking, and getIsDirty methods via ref
  useImperativeHandle(ref, () => ({
    submitForm: () => form.handleSubmit(onSubmit)(),
    deleteBooking: () => handleDelete(),
    getIsDirty: () => form.formState.isDirty,
  }), [form, onSubmit])

  const sourceOptions = [
    'Google Ads',
    'Facebook',
    'Instagram',
    'Bouche à oreille',
    'Parrainage',
    'Site web',
    'WhatsApp',
    'Téléphone',
    'Email',
    'Guestonline',
  ]

  return (
    <Form {...form}>
      <form id='booking-form' onSubmit={form.handleSubmit(onSubmit)}>
        <div className='grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6'>

          {/* ═══════ LEFT SIDEBAR ═══════ */}
          <div className='space-y-4'>
            {/* Restaurant badge + dates */}
            <Card className='bg-muted/50'>
              <CardContent className='pt-1 space-y-3'>
                {/* Restaurant name + Actions */}
                <div className='flex items-center justify-between gap-2'>
                  <div className='flex items-center gap-2'>
                    {booking.restaurant?.color && (
                      <div className='h-3 w-3 rounded-full shrink-0' style={{ backgroundColor: booking.restaurant.color }} />
                    )}
                    <span className='font-semibold text-lg'>{booking.restaurant?.name || '—'}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size='sm' className='gap-1'>
                        Actions
                        <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 14l-7 7m0 0l-7-7m7 7V3' />
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end' className='w-56'>
                      <DropdownMenuItem onClick={() => {
                        if (!booking.contact?.email) {
                          toast.error('Le contact n\'a pas d\'adresse email')
                          return
                        }
                        window.location.href = `mailto:${booking.contact.email}`
                      }}>
                        <Mail className='mr-2 h-4 w-4' />
                        Envoyer un email
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        if (!booking.contact_id) {
                          toast.error('Aucun contact associé')
                          return
                        }
                        navigate({ to: '/contacts/contact/$id', params: { id: booking.contact_id } })
                      }}>
                        <ExternalLink className='mr-2 h-4 w-4' />
                        Ouvrir l'espace client
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDuplicate}>
                        <svg className='mr-2 h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' />
                        </svg>
                        Dupliquer l'événement
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled className='opacity-50'>
                        <FileText className='mr-2 h-4 w-4' />
                        Voir la fiche de fonction
                        <Badge variant='secondary' className='ml-auto text-[9px] px-1.5 py-0'>Soon</Badge>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Created / Updated */}
                <div className='text-xs text-muted-foreground space-y-0.5'>
                  <div>Créé le {format(new Date(booking.created_at), "d MMM yyyy HH:mm", { locale: fr })}</div>
                  <div>Dernière modif {format(new Date(booking.updated_at), "d MMM yyyy HH:mm", { locale: fr })}</div>
                </div>

                {/* Days until event */}
                <Badge variant={daysUntilEvent < 0 ? 'destructive' : daysUntilEvent <= 7 ? 'default' : 'secondary'}>
                  {daysUntilEvent < 0
                    ? `Passé (${Math.abs(daysUntilEvent)} jours)`
                    : daysUntilEvent === 0
                      ? "Aujourd'hui"
                      : `${daysUntilEvent} Jours`}
                </Badge>
              </CardContent>
            </Card>

            {/* Contact info */}
            <Card className='bg-muted/50'>
              <CardContent className='pt-1 space-y-2'>
                {booking.contact?.company?.name && (
                  <div className='text-xs text-muted-foreground'>{booking.contact.company.name}</div>
                )}
                <div className='flex items-center gap-2'>
                  <div className='font-semibold'>
                    {booking.contact
                      ? `${booking.contact.first_name} ${booking.contact.last_name || ''}`
                      : '—'}
                  </div>
                  {booking.contact && (
                    booking.contact.company
                      ? <Badge className='bg-blue-500 text-white text-[10px] px-1.5 py-0 h-5'>B2B</Badge>
                      : <Badge className='bg-gray-500 text-white text-[10px] px-1.5 py-0 h-5'>B2C</Badge>
                  )}
                </div>
                {booking.contact?.phone && (
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Phone className='h-3.5 w-3.5' />
                    {booking.contact.phone}
                  </div>
                )}
                {booking.contact?.email && (
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Mail className='h-3.5 w-3.5' />
                    {booking.contact.email}
                  </div>
                )}
                {booking.contact_id && (
                  <Button variant='link' size='sm' asChild className='px-0 h-auto text-xs'>
                    <Link to='/contacts/contact/$id' params={{ id: booking.contact_id }}>
                      Voir la fiche contact <ExternalLink className='ml-1 h-3 w-3' />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Sidebar form fields - only on evenementiel tab */}
            {activeTab === 'evenementiel' && (
            <Card>
              <CardContent className='pt-1 space-y-3'>
                {/* Commerciaux assignés */}
                <div>
                  <label className='text-xs font-medium'>Commerciaux assignés</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant='outline' className='w-full h-8 justify-start text-xs mt-2'>
                        {((eventForm.assigned_user_ids as string[]) || []).length > 0
                          ? users
                              .filter(u => ((eventForm.assigned_user_ids as string[]) || []).includes(u.id))
                              .map(u => `${u.first_name} ${u.last_name}`)
                              .join(', ')
                          : 'Sélectionnez des commerciaux'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className='w-56 p-3'>
                      <div className='space-y-2'>
                        {users.map((user: { id: string; first_name: string; last_name: string }) => (
                          <div key={user.id} className='flex items-center gap-2'>
                            <Checkbox
                              id={`user-${user.id}`}
                              checked={((eventForm.assigned_user_ids as string[]) || []).includes(user.id)}
                              onCheckedChange={(checked) => {
                                const currentIds = (eventForm.assigned_user_ids as string[]) || []
                                const newIds = checked
                                  ? [...currentIds, user.id]
                                  : currentIds.filter((id: string) => id !== user.id)
                                updateEventField('assigned_user_ids', newIds)
                              }}
                            />
                            <label htmlFor={`user-${user.id}`} className='text-xs cursor-pointer'>
                              {user.first_name} {user.last_name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <Separator />

                {/* Statut */}
                <FormField
                  control={form.control}
                  name='status_id'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Statut</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className='h-8'>
                            <SelectValue placeholder='Statut' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statuses.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className='flex items-center gap-2'>
                                <div className='h-2 w-2 rounded-full' style={{ backgroundColor: s.color }} />
                                {s.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {booking.status && (
                        <div className='text-xs text-muted-foreground'>
                          {booking.status.name} ({formatDistanceToNow(new Date(booking.updated_at), { locale: fr, addSuffix: true })})
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Relance */}
                <FormField
                  control={form.control}
                  name='relance'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Relance</FormLabel>
                      <FormControl>
                        <DatePicker value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Occasion */}
                <FormField
                  control={form.control}
                  name='occasion'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Occasion</FormLabel>
                      <FormControl>
                        <Input placeholder={"Dîner d'équipe - Société ORANGE"} className='h-8 text-sm' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Option */}
                <FormField
                  control={form.control}
                  name='option'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Option</FormLabel>
                      <FormControl>
                        <Input placeholder='Option commerciale' className='h-8 text-sm' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Source */}
                <FormField
                  control={form.control}
                  name='source'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className='h-8'>
                            <SelectValue placeholder='Source' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sourceOptions.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Budget client */}
                <div>
                  <label className='text-xs font-medium'>Budget client (€)</label>
                  <Input
                    type='number'
                    min='0'
                    step='0.01'
                    placeholder='0.00'
                    value={eventForm.budget_client as number || ''}
                    onChange={e => updateEventField('budget_client', e.target.value ? Number(e.target.value) : null)}
                    className='h-8 text-sm'
                  />
                </div>

                <Separator />

                {/* Format souhaité */}
                <div>
                  <label className='text-xs font-medium'>Format souhaité</label>
                  <Input
                    placeholder='Cocktail, Assis, Buffet...'
                    value={eventForm.format_souhaite as string || ''}
                    onChange={e => updateEventField('format_souhaite', e.target.value)}
                    className='h-8 text-sm'
                  />
                </div>

                <Separator />

                {/* Switches */}
                <div className='space-y-2'>
                  <FormField
                    control={form.control}
                    name='is_table_blocked'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between space-y-0'>
                        <FormLabel className='text-xs font-normal'>Table bloquée</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='has_extra_provider'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between space-y-0'>
                        <FormLabel className='text-xs font-normal'>Prestataire externe</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
            )}

          </div>

          {/* ═══════ RIGHT CONTENT — TAB CONTENT ═══════ */}
          <div className='flex-1'>
            {/* ── Tab: Événementiel ── */}
            {activeTab === 'evenementiel' && (
              <div className='space-y-4'>
                <Card>
                  <CardContent className='space-y-3 pt-1'>
                    {/* Date / Espace */}
                    <div className='grid gap-3 md:grid-cols-2'>
                      <div>
                        <label className='text-xs font-medium'>Date</label>
                        <DatePicker value={eventForm.event_date as string || ''} onChange={(value) => updateEventField('event_date', value)} />
                      </div>
                      <div>
                        <label className='text-xs font-medium'>Espace</label>
                        <Select value={eventForm.space_id as string || ''} onValueChange={(value) => updateEventField('space_id', value)}>
                          <SelectTrigger className='h-8'>
                            <SelectValue placeholder='Sélectionnez un espace' />
                          </SelectTrigger>
                          <SelectContent>
                            {spaces.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Horaires / Personnes */}
                    <div className='grid gap-3 md:grid-cols-3'>
                      <div>
                        <label className='text-xs font-medium'>Début</label>
                        <TimePicker value={eventForm.start_time as string || ''} onChange={(value) => updateEventField('start_time', value)} />
                      </div>
                      <div>
                        <label className='text-xs font-medium'>Fin</label>
                        <TimePicker value={eventForm.end_time as string || ''} onChange={(value) => updateEventField('end_time', value)} />
                      </div>
                      <div>
                        <label className='text-xs font-medium'>Personnes</label>
                        <Input type='number' min='1' value={eventForm.guests_count as string || ''} onChange={e => updateEventField('guests_count', e.target.value ? Number(e.target.value) : null)} className='h-8 text-sm' />
                      </div>
                    </div>

                    {/* Heure préférée */}
                    <div>
                      <label className='text-xs font-medium'>Heure préférée client</label>
                      <Input value={eventForm.client_preferred_time as string || ''} onChange={e => updateEventField('client_preferred_time', e.target.value)} className='h-8 text-sm' />
                    </div>

                    {/* Flexibilité / Privatif */}
                    <div className='flex gap-6'>
                      <label className='flex items-center gap-2 text-xs'>
                        <Switch checked={eventForm.is_date_flexible as boolean || false} onCheckedChange={v => updateEventField('is_date_flexible', v)} />
                        Date flexible
                      </label>
                      <label className='flex items-center gap-2 text-xs'>
                        <Switch checked={eventForm.is_restaurant_flexible as boolean || false} onCheckedChange={v => updateEventField('is_restaurant_flexible', v)} />
                        Restaurant flexible
                      </label>
                      <label className='flex items-center gap-2 text-xs'>
                        <Switch checked={eventForm.is_privatif as boolean || false} onCheckedChange={v => updateEventField('is_privatif', v)} />
                        Privatif
                      </label>
                    </div>

                    <Separator />

                    {/* Menu */}
                    <div className='space-y-2'>
                      <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Menu</p>
                      <div className='grid gap-3 md:grid-cols-2'>
                        <div>
                          <label className='text-xs font-medium'>Apéritif</label>
                          <Textarea value={eventForm.menu_aperitif as string || ''} onChange={e => updateEventField('menu_aperitif', e.target.value)} className='text-sm min-h-[60px]' />
                        </div>
                        <div>
                          <label className='text-xs font-medium'>Entrée</label>
                          <Textarea value={eventForm.menu_entree as string || ''} onChange={e => updateEventField('menu_entree', e.target.value)} className='text-sm min-h-[60px]' />
                        </div>
                        <div>
                          <label className='text-xs font-medium'>Plat</label>
                          <Textarea value={eventForm.menu_plat as string || ''} onChange={e => updateEventField('menu_plat', e.target.value)} className='text-sm min-h-[60px]' />
                        </div>
                        <div>
                          <label className='text-xs font-medium'>Dessert</label>
                          <Textarea value={eventForm.menu_dessert as string || ''} onChange={e => updateEventField('menu_dessert', e.target.value)} className='text-sm min-h-[60px]' />
                        </div>
                      </div>
                      <div>
                        <label className='text-xs font-medium'>Boissons</label>
                        <Textarea value={eventForm.menu_boissons as string || ''} onChange={e => updateEventField('menu_boissons', e.target.value)} className='text-sm min-h-[60px]' />
                      </div>
                    </div>

                    <Separator />

                    {/* Mise en place / Déroulé */}
                    <div className='grid gap-3 md:grid-cols-2'>
                      <div>
                        <label className='text-xs font-medium'>Mise en place</label>
                        <Textarea value={eventForm.mise_en_place as string || ''} onChange={e => updateEventField('mise_en_place', e.target.value)} className='text-sm min-h-[60px]' />
                      </div>
                      <div>
                        <label className='text-xs font-medium'>Déroulé</label>
                        <Textarea value={eventForm.deroulement as string || ''} onChange={e => updateEventField('deroulement', e.target.value)} className='text-sm min-h-[60px]' />
                      </div>
                    </div>

                    {/* Allergies / Prestations */}
                    <div className='grid gap-3 md:grid-cols-2'>
                      <div>
                        <label className='text-xs font-medium'>Allergies / Régimes</label>
                        <Textarea value={eventForm.allergies_regimes as string || ''} onChange={e => updateEventField('allergies_regimes', e.target.value)} className='text-sm min-h-[60px]' />
                      </div>
                      <div>
                        <label className='text-xs font-medium'>Prestations souhaitées</label>
                        <Textarea value={eventForm.prestations_souhaitees as string || ''} onChange={e => updateEventField('prestations_souhaitees', e.target.value)} className='text-sm min-h-[60px]' />
                      </div>
                    </div>

                    <Separator />

                    {/* Contact sur place */}
                    <div className='space-y-2'>
                      <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Contact sur place</p>
                      <div className='grid gap-3 md:grid-cols-3'>
                        <div>
                          <label className='text-xs font-medium'>Nom</label>
                          <Input value={eventForm.contact_sur_place_nom as string || ''} onChange={e => updateEventField('contact_sur_place_nom', e.target.value)} className='h-8 text-sm' />
                        </div>
                        <div>
                          <label className='text-xs font-medium'>Téléphone</label>
                          <Input value={eventForm.contact_sur_place_tel as string || ''} onChange={e => updateEventField('contact_sur_place_tel', e.target.value)} className='h-8 text-sm' />
                        </div>
                        <div>
                          <label className='text-xs font-medium'>Société</label>
                          <Input value={eventForm.contact_sur_place_societe as string || ''} onChange={e => updateEventField('contact_sur_place_societe', e.target.value)} className='h-8 text-sm' />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Instructions / Commentaires / Date signature */}
                    <div>
                      <label className='text-xs font-medium'>Instructions spéciales</label>
                      <Textarea value={eventForm.instructions_speciales as string || ''} onChange={e => updateEventField('instructions_speciales', e.target.value)} className='text-sm min-h-[60px]' />
                    </div>
                    <div>
                      <label className='text-xs font-medium'>Commentaires</label>
                      <Textarea value={eventForm.commentaires as string || ''} onChange={e => updateEventField('commentaires', e.target.value)} className='text-sm min-h-[60px]' />
                    </div>
                    <div className='max-w-xs'>
                      <label className='text-xs font-medium'>Date signature devis</label>
                      <DatePicker value={eventForm.date_signature_devis as string || ''} onChange={(value) => updateEventField('date_signature_devis', value)} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Tab: Facturation ── */}
            {activeTab === 'facturation' && (
              <div className='space-y-4'>
              {/* B2B Billing Info Warning */}
              {fullContact?.company && (
                (() => {
                  const company = fullContact.company
                  const missingFields: string[] = []
                  if (!company.billing_address) missingFields.push('Adresse de facturation')
                  if (!company.billing_postal_code) missingFields.push('Code postal')
                  if (!company.billing_city) missingFields.push('Ville')
                  if (!company.siret) missingFields.push('SIRET')
                  if (!company.tva_number) missingFields.push('N° TVA')
                  
                  if (missingFields.length > 0) {
                    return (
                      <Card className='border-amber-300 bg-amber-50'>
                        <CardHeader className='pb-2'>
                          <div className='flex items-center gap-2'>
                            <Badge className='bg-blue-500 text-white'>B2B</Badge>
                            <CardTitle className='text-base text-amber-800'>Informations de facturation incomplètes</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className='space-y-3'>
                          <p className='text-sm text-amber-700'>
                            La société <strong>{company.name}</strong> a des informations de facturation manquantes :
                          </p>
                          <ul className='text-sm text-amber-700 list-disc list-inside'>
                            {missingFields.map(field => (
                              <li key={field}>{field}</li>
                            ))}
                          </ul>
                          <Button
                            variant='outline'
                            size='sm'
                            className='gap-1.5 border-amber-400 text-amber-800 hover:bg-amber-100'
                            onClick={() => {
                              navigate({ to: '/companies' })
                              toast.info(`Recherchez "${company.name}" pour compléter les informations`)
                            }}
                          >
                            <Edit className='h-3.5 w-3.5' />
                            Compléter les informations
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  }
                  return null
                })()
              )}

              {/* B2C Info - No billing info required */}
              {booking.contact && !booking.contact.company && (
                <Card className='border-gray-200 bg-gray-50'>
                  <CardContent className='py-3'>
                    <div className='flex items-center gap-2'>
                      <Badge className='bg-gray-500 text-white'>B2C</Badge>
                      <span className='text-sm text-muted-foreground'>
                        Contact particulier — Aucune information de facturation société requise
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Devis / Factures Section */}
              <Card>
                <CardHeader className='pb-3'>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='text-base'>Devis / Offres / Factures</CardTitle>
                    <Button
                      size='sm'
                      className='gap-1.5'
                      disabled={isCreatingQuote}
                      onClick={() => {
                        createQuote({
                          bookingId: booking.id,
                          restaurantId: booking.restaurant_id || '',
                          contactId: booking.contact_id || undefined,
                          title: `Votre événement | ${booking.occasion || ''}`,
                          dateStart: booking.event_date || undefined,
                          dateEnd: booking.event_date || undefined,
                        }, {
                          onSuccess: (newQuote) => {
                            setEditingQuoteId(newQuote.id)
                            setQuoteEditorOpen(true)
                            toast.success('Devis créé')
                          },
                          onError: () => toast.error('Erreur lors de la création du devis'),
                        })
                      }}
                    >
                      {isCreatingQuote ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Plus className='h-3.5 w-3.5' />}
                      Nouvelle offre
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {quotes.length > 0 ? (
                    <div className='space-y-3'>
                      {quotes.map((quote: Quote) => {
                        // Workflow state checks
                        const isQuoteSent = !!(quote as any).quote_sent_at
                        const isQuoteSigned = !!(quote as any).quote_signed_at
                        const isDepositPaid = !!(quote as any).deposit_paid_at
                        const isBalanceSent = !!(quote as any).balance_sent_at
                        const isBalancePaid = !!(quote as any).balance_paid_at
                        const isPrimary = !!(quote as any).primary_quote
                        
                        // Conditions for actions
                        // Allow resending quote email anytime (no restriction)
                        const canSendQuote = true
                        // Allow resending signature as long as quote is not yet signed
                        const canSendSignature = !isQuoteSigned
                        const canSendDepositLink = isQuoteSigned && !isDepositPaid
                        const canSendBalanceInvoice = isQuoteSigned && isDepositPaid && !isBalanceSent
                        const canMarkComplete = isBalanceSent && !isBalancePaid
                        
                        return (
                          <div key={quote.id} className='border rounded-lg p-3 hover:bg-muted/30 transition-colors'>
                            {/* Header row */}
                            <div className='flex items-start justify-between mb-2'>
                              <div className='space-y-1'>
                                <div className='flex items-center gap-2'>
                                  <p className='font-medium text-sm'>{quote.quote_number}</p>
                                  <Badge variant='outline' className='text-[10px] text-muted-foreground'>
                                    {format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: fr })}
                                  </Badge>
                                  {isPrimary && (
                                    <Badge variant='default' className='text-[10px] bg-emerald-600 hover:bg-emerald-600'>Actif</Badge>
                                  )}
                                </div>
                                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                                  <span className='font-medium'>TTC: {(quote.total_ttc || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                                  {quote.title && <><span>•</span><span className='truncate max-w-[150px]'>{quote.title}</span></>}
                                </div>
                              </div>
                              <div className='flex items-center gap-1'>
                                <Button
                                  size='sm'
                                  variant={isPrimary ? 'secondary' : 'outline'}
                                  className='h-7 text-xs gap-1'
                                  disabled={isPrimary || isSettingPrimary}
                                  onClick={() => {
                                    setPrimaryQuote({ quoteId: quote.id, bookingId: booking.id }, {
                                      onSuccess: () => {
                                        toast.success('Devis défini comme actif')
                                        activityLogger.quoteSetPrimary(booking.id, quote.id, quote.title || undefined)
                                      },
                                      onError: () => toast.error('Impossible de définir le devis actif'),
                                    })
                                  }}
                                >
                                  <CheckCircle className='h-3 w-3' />
                                  {isPrimary ? 'Actif' : isSettingPrimary ? '…' : 'Utiliser'}
                                </Button>
                                <Button
                                  size='icon'
                                  variant='ghost'
                                  className='h-7 w-7'
                                  title='Éditer'
                                  onClick={() => {
                                    setEditingQuoteId(quote.id)
                                    setQuoteEditorOpen(true)
                                  }}
                                >
                                  <Edit className='h-3.5 w-3.5' />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size='icon' variant='ghost' className='h-7 w-7' title='Actions'>
                                      <MoreVertical className='h-3.5 w-3.5' />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align='end' className='w-64'>
                                    {/* PDF Downloads */}
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditingQuoteId(quote.id)
                                        setQuoteEditorOpen(true)
                                      }}
                                    >
                                      <Download className='h-3.5 w-3.5 mr-2' />
                                      Télécharger Devis PDF
                                    </DropdownMenuItem>
                                    
                                    {/* Workflow Actions with conditions */}
                                    <DropdownMenuItem
                                      disabled={isSendingEmail}
                                      onClick={() => {
                                        // B2B Validation: Check if company info is complete
                                        const company = fullContact?.company
                                        if (company) {
                                          const missingFields: string[] = []
                                          if (!company.name) missingFields.push('Raison sociale')
                                          if (!company.billing_address) missingFields.push('Adresse')
                                          if (!company.billing_postal_code) missingFields.push('Code postal')
                                          if (!company.billing_city) missingFields.push('Ville')
                                          if (!company.siret) missingFields.push('SIRET')
                                          
                                          if (missingFields.length > 0) {
                                            toast.error(`Informations société manquantes : ${missingFields.join(', ')}. Veuillez compléter les informations de la société avant d'envoyer le devis.`)
                                            return
                                          }
                                        }
                                        
                                        sendQuoteEmail(
                                          { quoteId: quote.id, bookingId: booking.id },
                                          {
                                            onSuccess: () => {
                                              toast.success('Devis envoyé par email')
                                              activityLogger.quoteEmailSent(booking.id, quote.id, fullContact?.email || undefined)
                                            },
                                            onError: (err) => toast.error(`Erreur: ${err.message}`),
                                          }
                                        )
                                      }}
                                    >
                                      <Send className='h-3.5 w-3.5 mr-2' />
                                      <span>{isSendingEmail ? 'Envoi en cours...' : 'Envoyer Devis par Email'}</span>
                                    </DropdownMenuItem>
                                  
                                    <DropdownMenuItem
                                      disabled={!canSendSignature || isSendingSignature}
                                      onClick={() => {
                                        if (canSendSignature) {
                                          sendSignature(
                                            { quoteId: quote.id, bookingId: booking.id },
                                            {
                                              onSuccess: () => {
                                                toast.success('Lien de signature envoyé')
                                                activityLogger.quoteSignatureSent(booking.id, quote.id)
                                              },
                                              onError: (err) => toast.error(`Erreur: ${err.message}`),
                                            }
                                          )
                                        }
                                      }}
                                      className={!canSendSignature ? 'opacity-50' : ''}
                                    >
                                      <FileSignature className='h-3.5 w-3.5 mr-2' />
                                      <div className='flex flex-col'>
                                        <span>{isSendingSignature ? 'Envoi en cours...' : 'Envoyer Lien de Signature'}</span>
                                        {!canSendSignature && <span className='text-[10px] text-muted-foreground'>Déjà signé</span>}
                                      </div>
                                    </DropdownMenuItem>
                                  
                                    <DropdownMenuItem
                                      disabled={!canSendDepositLink || isSendingDeposit}
                                      onClick={() => {
                                        if (canSendDepositLink) {
                                          sendDeposit(
                                            { quoteId: quote.id, bookingId: booking.id },
                                            {
                                              onSuccess: () => {
                                                toast.success('Facture d\'acompte envoyée avec lien de paiement')
                                                activityLogger.paymentDepositSent(booking.id, quote.id, (quote as any).deposit_amount || 0)
                                              },
                                              onError: (err) => toast.error(`Erreur: ${err.message}`),
                                            }
                                          )
                                        }
                                      }}
                                      className={!canSendDepositLink ? 'opacity-50' : ''}
                                    >
                                      <CreditCard className='h-3.5 w-3.5 mr-2' />
                                      <div className='flex flex-col'>
                                        <span>{isSendingDeposit ? 'Envoi en cours...' : 'Envoyer Lien Paiement Acompte'}</span>
                                        {!canSendDepositLink && !isQuoteSigned && <span className='text-[10px] text-muted-foreground'>Devis non signé</span>}
                                        {!canSendDepositLink && isDepositPaid && <span className='text-[10px] text-muted-foreground'>Acompte déjà payé</span>}
                                      </div>
                                    </DropdownMenuItem>
                                  
                                    <DropdownMenuItem
                                      disabled={!canSendBalanceInvoice || isSendingBalance}
                                      onClick={() => {
                                        if (canSendBalanceInvoice) {
                                          sendBalance(
                                            { quoteId: quote.id, bookingId: booking.id },
                                            {
                                              onSuccess: () => {
                                                toast.success('Facture de solde envoyée')
                                                activityLogger.paymentBalanceSent(booking.id, quote.id, quote.total_ttc - ((quote as any).deposit_amount || 0))
                                              },
                                              onError: (err) => toast.error(`Erreur: ${err.message}`),
                                            }
                                          )
                                        }
                                      }}
                                      className={!canSendBalanceInvoice ? 'opacity-50' : ''}
                                    >
                                      <Receipt className='h-3.5 w-3.5 mr-2' />
                                      <div className='flex flex-col'>
                                        <span>{isSendingBalance ? 'Envoi en cours...' : 'Envoyer Facture de Solde'}</span>
                                        {!canSendBalanceInvoice && !isQuoteSigned && <span className='text-[10px] text-muted-foreground'>Devis non signé</span>}
                                        {!canSendBalanceInvoice && isQuoteSigned && !isDepositPaid && <span className='text-[10px] text-muted-foreground'>Acompte non payé</span>}
                                        {!canSendBalanceInvoice && isBalanceSent && <span className='text-[10px] text-muted-foreground'>Déjà envoyée</span>}
                                      </div>
                                    </DropdownMenuItem>
                                  
                                    <DropdownMenuItem
                                      disabled={!canMarkComplete}
                                      onClick={() => {
                                        if (canMarkComplete) {
                                          toast.info('Marqué comme terminé... (à implémenter)')
                                        }
                                      }}
                                      className={!canMarkComplete ? 'opacity-50' : ''}
                                    >
                                      <CheckCircle className='h-3.5 w-3.5 mr-2' />
                                      <div className='flex flex-col'>
                                        <span>Marquer comme Terminé</span>
                                        {!canMarkComplete && !isBalanceSent && <span className='text-[10px] text-muted-foreground'>Facture de solde non envoyée</span>}
                                        {!canMarkComplete && isBalancePaid && <span className='text-[10px] text-muted-foreground'>Déjà terminé</span>}
                                      </div>
                                    </DropdownMenuItem>
                                  
                                  <DropdownMenuItem
                                    className='text-destructive focus:text-destructive'
                                    onClick={() => {
                                      if (confirm('Supprimer ce devis ?')) {
                                        deleteQuoteMutation({ id: quote.id, bookingId: booking.id }, {
                                          onSuccess: () => toast.success('Devis supprimé'),
                                          onError: () => toast.error('Erreur lors de la suppression'),
                                        })
                                      }
                                    }}
                                  >
                                    <TrashIcon className='h-3.5 w-3.5 mr-2' />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          
                          {/* Workflow Status Tags */}
                          <div className='flex items-center gap-1.5 flex-wrap'>
                            <Badge 
                              variant='outline' 
                              className={`text-[9px] px-1.5 py-0 h-5 ${isQuoteSent ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                            >
                              {isQuoteSent ? '✓' : '○'} Devis envoyé
                            </Badge>
                            <Badge 
                              variant='outline' 
                              className={`text-[9px] px-1.5 py-0 h-5 ${isQuoteSigned ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                            >
                              {isQuoteSigned ? '✓' : '○'} Signé
                            </Badge>
                            <Badge 
                              variant='outline' 
                              className={`text-[9px] px-1.5 py-0 h-5 ${isDepositPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                            >
                              {isDepositPaid ? '✓' : '○'} Acompte payé
                            </Badge>
                            <Badge 
                              variant='outline' 
                              className={`text-[9px] px-1.5 py-0 h-5 ${isBalanceSent ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                            >
                              {isBalanceSent ? '✓' : '○'} Solde envoyé
                            </Badge>
                            <Badge 
                              variant='outline' 
                              className={`text-[9px] px-1.5 py-0 h-5 ${isBalancePaid ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                            >
                              {isBalancePaid ? '✓' : '○'} Soldé
                            </Badge>
                          </div>
                        </div>
                      )
                      })}
                    </div>
                  ) : (
                    <div className='py-8 text-center text-muted-foreground'>
                      <FileText className='h-8 w-8 mx-auto mb-2 opacity-50' />
                      <p className='text-sm'>Aucun devis pour le moment.</p>
                      <p className='text-xs mt-1'>Cliquez sur &quot;Nouvelle offre&quot; pour créer un devis.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Paiements / Cautions Section */}
              <Card>
                <CardHeader className='pb-3'>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='text-base'>Paiements / Cautions</CardTitle>
                    <Button size='sm' variant='outline' className='gap-1.5' onClick={() => {
                      setEditingPayment(null)
                      setPaymentDialogOpen(true)
                    }}>
                      <Plus className='h-3.5 w-3.5' />
                      Paiement
                    </Button>
                  </div>
                  {/* Payment Balance Summary */}
                  {(() => {
                    // Get the most advanced quote (by status progression)
                    const primaryQuote = quotes.find(q => ['deposit_paid', 'balance_sent', 'balance_paid'].includes(q.status)) || quotes.find(q => q.status === 'quote_signed') || quotes.find(q => q.status === 'deposit_sent') || quotes[0]
                    const totalDevisTtc = primaryQuote?.total_ttc || 0
                    // Only count payments with status 'paid' (from Stripe webhook) or 'completed' (manual)
                    const paiementsRecus = payments
                      .filter(p => p.status === 'paid' || p.status === 'completed')
                      .reduce((sum, p) => sum + (p.amount || 0), 0)
                    const soldeRestant = totalDevisTtc - paiementsRecus

                    if (totalDevisTtc > 0 || paiementsRecus > 0) {
                      return (
                        <div className='mt-3 p-2 sm:p-3 bg-muted/50 rounded-lg space-y-1 text-xs'>
                          <div className='flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-2'>
                            <span className='text-muted-foreground'>Total Devis TTC</span>
                            <span className='font-medium'>{totalDevisTtc.toFixed(2)} €</span>
                          </div>
                          <div className='flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-2'>
                            <span className='text-muted-foreground'>Paiements reçus</span>
                            <span className='font-medium text-green-600'>- {paiementsRecus.toFixed(2)} €</span>
                          </div>
                          <Separator className='my-1' />
                          <div className='flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-2 font-semibold'>
                            <span>Solde restant</span>
                            <span className={soldeRestant > 0 ? 'text-orange-600' : 'text-green-600'}>{soldeRestant.toFixed(2)} €</span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </CardHeader>
                <CardContent>
                  {payments.length > 0 ? (
                    <div className='overflow-x-auto'>
                      <table className='w-full text-sm'>
                        <thead>
                          <tr className='border-b'>
                            <th className='text-left py-2 px-2 font-medium text-xs'>Statut</th>
                            <th className='text-left py-2 px-2 font-medium text-xs'>Type</th>
                            <th className='text-left py-2 px-2 font-medium text-xs'>Montant</th>
                            <th className='text-left py-2 px-2 font-medium text-xs'>Méthode</th>
                            <th className='text-left py-2 px-2 font-medium text-xs'>Payé le</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map(payment => (
                            <tr key={payment.id} className='border-b hover:bg-muted/50 cursor-pointer' onClick={() => {
                              setEditingPayment(payment)
                              setPaymentDialogOpen(true)
                            }}>
                              <td className='py-2 px-2'>
                                <Badge variant={
                                  (payment.status === 'paid' || payment.status === 'completed') ? 'default' :
                                  payment.status === 'pending' ? 'secondary' :
                                  'outline'
                                } className={`text-[10px] ${(payment.status === 'paid' || payment.status === 'completed') ? 'bg-green-600' : ''}`}>
                                  {(payment.status === 'paid' || payment.status === 'completed') ? 'Payé' :
                                   payment.status === 'pending' ? 'En attente' :
                                   payment.status === 'failed' ? 'Échoué' :
                                   payment.status}
                                </Badge>
                              </td>
                              <td className='py-2 px-2 text-xs capitalize'>{payment.payment_modality || payment.payment_type}</td>
                              <td className='py-2 px-2 text-sm font-medium'>{(payment.amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                              <td className='py-2 px-2 text-xs capitalize'>{payment.payment_method || payment.payment_type || '—'}</td>
                              <td className='py-2 px-2 text-xs text-muted-foreground'>
                                {payment.paid_at ? format(new Date(payment.paid_at), 'dd/MM/yyyy', { locale: fr }) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className='py-6 text-center text-muted-foreground'>
                      <p className='text-sm'>Aucune donnée de paiement pour le moment.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Dialog */}
              <PaymentDialog
                open={paymentDialogOpen}
                onOpenChange={setPaymentDialogOpen}
                bookingId={booking.id}
                payment={editingPayment}
              />

              {/* Quote Editor Dialog */}
              <QuoteEditor
                open={quoteEditorOpen}
                onOpenChange={setQuoteEditorOpen}
                quoteId={editingQuoteId}
                booking={booking}
                restaurant={fullRestaurant}
                contact={fullContact}
              />
              </div>
            )}

            {/* ── Tab: Fichiers ── */}
            {activeTab === 'fichiers' && (
              <div className='space-y-4'>
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>Fichiers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-4'>
                    {/* Upload area */}
                    <div className='border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer' onClick={() => document.getElementById('file-input')?.click()}>
                      <FileText className='mx-auto h-8 w-8 mb-2 text-muted-foreground' />
                      <p className='text-sm font-medium'>Cliquez pour uploader des fichiers</p>
                      <p className='text-xs text-muted-foreground'>ou glissez-déposez vos fichiers ici</p>
                      <input
                        id='file-input'
                        type='file'
                        multiple
                        className='hidden'
                        onChange={(e) => {
                          const files = e.currentTarget.files
                          if (files) {
                            Array.from(files).forEach(file => {
                              uploadDocument(
                                { file, bookingId: booking.id },
                                {
                                  onSuccess: () => {
                                    toast.success(`${file.name} uploadé avec succès`)
                                  },
                                  onError: (error) => {
                                    console.error('Error uploading file:', error)
                                    toast.error(`Erreur lors de l'upload de ${file.name}`)
                                  },
                                }
                              )
                            })
                          }
                        }}
                      />
                    </div>

                    {/* Documents list */}
                    {documents.length > 0 ? (
                      <div className='space-y-2'>
                        {documents.map(doc => (
                          <div key={doc.id} className='flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50'>
                            <div className='flex items-center gap-3 flex-1 min-w-0'>
                              <FileText className='h-5 w-5 text-muted-foreground flex-shrink-0' />
                              <div className='min-w-0 flex-1'>
                                <a href={doc.file_url} target='_blank' rel='noopener noreferrer' className='text-sm font-medium hover:underline truncate block'>
                                  {doc.name}
                                </a>
                                <p className='text-xs text-muted-foreground'>
                                  {doc.file_size ? `${(doc.file_size / 1024).toFixed(2)} KB` : ''} • {doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : ''}
                                </p>
                              </div>
                            </div>
                            <Button
                              size='sm'
                              variant='ghost'
                              onClick={() => {
                                deleteDocument(doc.id, {
                                  onSuccess: () => {
                                    toast.success('Fichier supprimé')
                                  },
                                  onError: (error) => {
                                    console.error('Error deleting file:', error)
                                    toast.error('Erreur lors de la suppression')
                                  },
                                })
                              }}
                              disabled={isDeletingDocument}
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className='py-6 text-center text-muted-foreground'>
                        <p className='text-sm'>Aucun fichier uploadé pour le moment.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </div>
            )}

            {/* ── Tab: Menu ── */}
            {activeTab === 'menu' && (
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-lg font-semibold'>Formulaires de menu</h3>
                  <Button
                    size='sm'
                    className='gap-1.5'
                    onClick={() => setShowMenuFormSourceDialog(true)}
                  >
                    <Plus className='h-3.5 w-3.5' />
                    Nouveau formulaire
                  </Button>
                </div>

                {menuForms.length === 0 ? (
                  <Card>
                    <CardContent className='py-8 text-center text-muted-foreground'>
                      <FileText className='mx-auto h-8 w-8 mb-2 opacity-50' />
                      <p className='text-sm'>Aucun formulaire de menu.</p>
                      <p className='text-xs mt-1'>Créez un formulaire pour permettre au client de choisir ses menus.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className='space-y-2'>
                    {menuForms.map(form => {
                      const fieldCount = form.menu_form_fields?.length || 0
                      const statusMap: Record<string, { label: string; color: string }> = {
                        draft: { label: 'Brouillon', color: 'bg-gray-500' },
                        shared: { label: 'Partagé', color: 'bg-blue-500' },
                        submitted: { label: 'Soumis', color: 'bg-green-500' },
                        locked: { label: 'Verrouillé', color: 'bg-gray-700' },
                      }
                      const st = statusMap[form.status] || statusMap.draft

                      return (
                        <Card key={form.id} className='hover:shadow-sm transition-shadow'>
                          <CardContent className='p-4'>
                            <div className='flex items-center justify-between'>
                              <div className='flex-1 space-y-1'>
                                <div className='flex items-center gap-2'>
                                  <span className='font-medium text-sm'>{form.title}</span>
                                  <Badge className={`${st.color} text-white text-[10px]`}>{st.label}</Badge>
                                  <Badge variant='outline' className='text-[10px]'>{fieldCount} champ{fieldCount > 1 ? 's' : ''}</Badge>
                                  <Badge variant='outline' className='text-[10px]'>{form.guests_count} convive{form.guests_count > 1 ? 's' : ''}</Badge>
                                </div>
                                <p className='text-[10px] text-muted-foreground'>
                                  Modifié le {format(new Date(form.updated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                                  {form.submitted_at && ` · Soumis le ${format(new Date(form.submitted_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}`}
                                </p>
                              </div>
                              <div className='flex items-center gap-1'>
                                <Button
                                  variant='outline'
                                  size='sm'
                                  className='h-7 text-xs gap-1'
                                  onClick={() => {
                                    setEditingMenuFormId(form.id)
                                    setMenuFormBuilderOpen(true)
                                  }}
                                >
                                  <Edit className='h-3 w-3' />
                                  {form.status === 'submitted' || form.status === 'locked' ? 'Voir' : 'Éditer'}
                                </Button>
                                {(form.status === 'shared' || form.status === 'submitted') && (
                                  <Button
                                    variant='outline'
                                    size='sm'
                                    className='h-7 text-xs gap-1'
                                    onClick={() => {
                                      const url = `${window.location.origin}/menu-form/${form.share_token}`
                                      navigator.clipboard.writeText(url)
                                      toast.success('Lien copié !')
                                    }}
                                  >
                                    <ExternalLink className='h-3 w-3' />
                                    Lien
                                  </Button>
                                )}
                                {form.status === 'draft' && (
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-7 w-7 p-0 text-destructive hover:text-destructive'
                                    onClick={() => {
                                      deleteMenuForm(form.id, {
                                        onSuccess: () => toast.success('Formulaire supprimé'),
                                        onError: () => toast.error('Erreur'),
                                      })
                                    }}
                                  >
                                    <TrashIcon className='h-3 w-3' />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}

                <MenuFormBuilder
                  formId={editingMenuFormId}
                  open={menuFormBuilderOpen}
                  onOpenChange={(open) => {
                    setMenuFormBuilderOpen(open)
                    if (!open) setEditingMenuFormId(null)
                  }}
                  restaurantId={booking.restaurant_id}
                />

                {/* Menu Form Source Selection Dialog - simplified to just create empty form */}
                <Dialog open={showMenuFormSourceDialog} onOpenChange={setShowMenuFormSourceDialog}>
                  <DialogContent className='max-w-md'>
                    <DialogHeader>
                      <DialogTitle>Nouveau formulaire de menu</DialogTitle>
                      <DialogDescription>
                        Créez un formulaire pour permettre au client de choisir ses menus.
                      </DialogDescription>
                    </DialogHeader>
                    <div className='space-y-4 py-4'>
                      <p className='text-sm text-muted-foreground'>
                        Le formulaire sera créé avec {booking.guests_count || 1} convive{(booking.guests_count || 1) > 1 ? 's' : ''}.
                        Vous pourrez ensuite ajouter les champs de choix (entrées, plats, desserts, etc.).
                      </p>
                      <Button
                        className='w-full'
                        onClick={() => {
                          createMenuForm({
                            bookingId: booking.id,
                            guestsCount: booking.guests_count || 1,
                          }, {
                            onSuccess: (form) => {
                              setEditingMenuFormId(form.id)
                              setMenuFormBuilderOpen(true)
                              setShowMenuFormSourceDialog(false)
                              toast.success('Formulaire créé')
                            },
                            onError: () => toast.error('Erreur lors de la création'),
                          })
                        }}
                        disabled={isCreatingMenuForm}
                      >
                        {isCreatingMenuForm ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : <Plus className='h-4 w-4 mr-2' />}
                        Créer le formulaire
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* ── Tab: Historique ── */}
            {activeTab === 'historique' && (
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-lg font-semibold'>Historique des actions</h3>
                  <Badge variant='secondary'>{activityLogs.length} action{activityLogs.length > 1 ? 's' : ''}</Badge>
                </div>

                {isLoadingLogs ? (
                  <Card>
                    <CardContent className='py-8 flex items-center justify-center'>
                      <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
                    </CardContent>
                  </Card>
                ) : activityLogs.length === 0 ? (
                  <Card>
                    <CardContent className='py-8 text-center text-muted-foreground'>
                      <History className='mx-auto h-8 w-8 mb-2 opacity-50' />
                      <p className='text-sm'>Aucune action enregistrée.</p>
                      <p className='text-xs mt-1'>Les actions sur cet événement apparaîtront ici.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className='py-4'>
                      <div className='relative'>
                        {/* Timeline line */}
                        <div className='absolute left-4 top-0 bottom-0 w-px bg-border' />
                        
                        {/* Timeline items */}
                        <div className='space-y-4'>
                          {activityLogs.map((log, index) => {
                            const iconName = ACTION_ICONS[log.action_type as ActivityActionType] || 'Circle'
                            const isFirst = index === 0
                            
                            // Determine icon color based on action type
                            let iconColorClass = 'bg-muted text-muted-foreground'
                            if (log.action_type.includes('created')) iconColorClass = 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                            else if (log.action_type.includes('deleted')) iconColorClass = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            else if (log.action_type.includes('sent') || log.action_type.includes('email')) iconColorClass = 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            else if (log.action_type.includes('signed') || log.action_type.includes('received')) iconColorClass = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            else if (log.action_type.includes('updated') || log.action_type.includes('changed')) iconColorClass = 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'

                            return (
                              <div key={log.id} className='relative pl-10'>
                                {/* Icon */}
                                <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${iconColorClass} ${isFirst ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                                  {iconName === 'Plus' && <Plus className='h-4 w-4' />}
                                  {iconName === 'Edit' && <Edit className='h-4 w-4' />}
                                  {iconName === 'Trash2' && <TrashIcon className='h-4 w-4' />}
                                  {iconName === 'Mail' && <Mail className='h-4 w-4' />}
                                  {iconName === 'Send' && <Send className='h-4 w-4' />}
                                  {iconName === 'FileText' && <FileText className='h-4 w-4' />}
                                  {iconName === 'FileSignature' && <FileSignature className='h-4 w-4' />}
                                  {iconName === 'CheckCircle' && <CheckCircle className='h-4 w-4' />}
                                  {iconName === 'CreditCard' && <CreditCard className='h-4 w-4' />}
                                  {iconName === 'History' && <History className='h-4 w-4' />}
                                  {!['Plus', 'Edit', 'Trash2', 'Mail', 'Send', 'FileText', 'FileSignature', 'CheckCircle', 'CreditCard', 'History'].includes(iconName) && <History className='h-4 w-4' />}
                                </div>
                                
                                {/* Content */}
                                <div className='min-h-[2rem] pb-2'>
                                  <p className='text-sm font-medium leading-tight'>{log.action_label}</p>
                                  <div className='flex items-center gap-2 mt-1 text-xs text-muted-foreground'>
                                    <span>
                                      {log.actor_type === 'user' && log.actor_name ? `par ${log.actor_name}` : 
                                       log.actor_type === 'client' ? 'par le client' :
                                       log.actor_type === 'webhook' ? `via ${log.actor_name || 'webhook'}` :
                                       log.actor_type === 'system' ? 'automatique' : ''}
                                    </span>
                                    <span>·</span>
                                    <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}</span>
                                  </div>
                                  
                                  {/* Show metadata details if available */}
                                  {log.metadata && typeof log.metadata === 'object' && Object.keys(log.metadata as object).length > 0 && (log.metadata as Record<string, unknown>).changes && (
                                    <div className='mt-2 text-xs bg-muted/50 rounded p-2'>
                                      <div className='space-y-1'>
                                        {Object.entries((log.metadata as Record<string, unknown>).changes as Record<string, { old: unknown; new: unknown }>)
                                          .filter(([, change]) => {
                                            // Skip if both old and new are empty/null
                                            const oldVal = change.old === null || change.old === undefined || change.old === '' ? null : change.old
                                            const newVal = change.new === null || change.new === undefined || change.new === '' ? null : change.new
                                            return oldVal !== null || newVal !== null
                                          })
                                          .slice(0, 3)
                                          .map(([field, change]) => {
                                            const oldDisplay = change.old === null || change.old === undefined || change.old === '' ? '(vide)' : String(change.old)
                                            const newDisplay = change.new === null || change.new === undefined || change.new === '' ? '(vide)' : String(change.new)
                                            return (
                                              <div key={field} className='flex items-center gap-1 flex-wrap'>
                                                <span className='text-muted-foreground'>{field}:</span>
                                                <span className='line-through text-muted-foreground'>{oldDisplay}</span>
                                                <span>→</span>
                                                <span className='font-medium'>{newDisplay}</span>
                                              </div>
                                            )
                                          })}
                                        {Object.keys((log.metadata as Record<string, unknown>).changes as object).length > 3 && (
                                          <span className='text-muted-foreground'>+{Object.keys((log.metadata as Record<string, unknown>).changes as object).length - 3} autres modifications</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

        </div>
      </form>
    </Form>
  )
})
