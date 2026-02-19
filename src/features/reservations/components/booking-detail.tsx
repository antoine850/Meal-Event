import { useEffect, useMemo, useState, forwardRef, useImperativeHandle, useRef } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, Link, useBlocker } from '@tanstack/react-router'
import { toast } from 'sonner'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Edit,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Mail,
  Phone,
  Plus,
  Trash2 as TrashIcon,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  useUpdateBooking,
  useDeleteBooking,
  useDuplicateBooking,
  useBookingStatuses,
  useQuotesByBooking,
  usePaymentsByBooking,
  type BookingWithRelations,
} from '../hooks/use-bookings'
import { useDocumentsByBooking, useUploadDocument, useDeleteDocument } from '../hooks/use-documents'
import { useOrganizationUsers } from '@/features/contacts/hooks/use-contacts'
import { useSpaces } from '@/features/settings/hooks/use-settings'
import { useCreateQuote, useDeleteQuote, useRestaurantById, useContactWithCompany } from '../hooks/use-quotes'
import { QuoteEditor } from './quote-editor'

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
  const { data: payments = [] } = usePaymentsByBooking(booking.id)
  const { data: documents = [] } = useDocumentsByBooking(booking.id)
  const { mutate: uploadDocument } = useUploadDocument()
  const { mutate: deleteDocument, isPending: isDeletingDocument } = useDeleteDocument()
  const { mutate: createQuote, isPending: isCreatingQuote } = useCreateQuote()
  const { mutate: deleteQuoteMutation } = useDeleteQuote()
  const { data: fullRestaurant } = useRestaurantById(booking.restaurant_id)
  const { data: fullContact } = useContactWithCompany(booking.contact_id)

  // Quote editor state
  const [quoteEditorOpen, setQuoteEditorOpen] = useState(false)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)

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
      ...eventForm,
    }

    updateBooking(updateData as never, {
      onSuccess: () => {
        toast.success('Événement mis à jour')
        form.reset(data, { keepValues: true })
        // Mark current eventForm as the new baseline
        initialEventFormRef.current = { ...eventForm }
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
            <Card>
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
            <Card>
              <CardContent className='pt-1 space-y-2'>
                {booking.contact?.company?.name && (
                  <div className='text-xs text-muted-foreground'>{booking.contact.company.name}</div>
                )}
                <div className='font-semibold'>
                  {booking.contact
                    ? `${booking.contact.first_name} ${booking.contact.last_name || ''}`
                    : '—'}
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

            {/* Sidebar form fields */}
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

                    {/* Budget / Format */}
                    <div className='grid gap-3 md:grid-cols-2'>
                      <div>
                        <label className='text-xs font-medium'>Budget client (€)</label>
                        <Input type='number' step='0.01' min='0' value={eventForm.budget_client as string || ''} onChange={e => updateEventField('budget_client', e.target.value ? Number(e.target.value) : null)} className='h-8 text-sm' />
                      </div>
                      <div>
                        <label className='text-xs font-medium'>Format souhaité</label>
                        <Input value={eventForm.format_souhaite as string || ''} onChange={e => updateEventField('format_souhaite', e.target.value)} className='h-8 text-sm' />
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
              {/* Devis / Factures Section */}
              <Card>
                <CardHeader className='pb-3'>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='text-base'>Devis / Offres</CardTitle>
                    <Button
                      size='sm'
                      className='gap-1.5'
                      disabled={isCreatingQuote}
                      onClick={() => {
                        createQuote({
                          bookingId: booking.id,
                          restaurantId: booking.restaurant_id || '',
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
                    <div className='space-y-2'>
                      {quotes.map(quote => (
                        <div key={quote.id} className='border rounded-lg p-3 hover:bg-muted/30 transition-colors'>
                          <div className='flex items-center justify-between'>
                            <div className='space-y-1'>
                              <div className='flex items-center gap-2'>
                                <p className='font-medium text-sm'>{quote.quote_number}</p>
                                <Badge variant={
                                  quote.status === 'draft' ? 'secondary' :
                                  quote.status === 'sent' ? 'default' :
                                  quote.status === 'signed' ? 'default' :
                                  'outline'
                                } className='text-[10px]'>
                                  {quote.status === 'draft' ? 'Brouillon' :
                                   quote.status === 'sent' ? 'Envoyé' :
                                   quote.status === 'signed' ? 'Signé' :
                                   quote.status === 'expired' ? 'Expiré' :
                                   quote.status === 'cancelled' ? 'Annulé' :
                                   quote.status}
                                </Badge>
                              </div>
                              <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                                <span>HT: {(quote.total_ht || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                                <span>TTC: {(quote.total_ttc || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                                {quote.title && <span className='truncate max-w-[200px]'>{quote.title}</span>}
                              </div>
                            </div>
                            <div className='flex items-center gap-1'>
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
                              <Button
                                size='icon'
                                variant='ghost'
                                className='h-7 w-7 text-destructive hover:text-destructive'
                                title='Supprimer'
                                onClick={() => {
                                  if (confirm('Supprimer ce devis ?')) {
                                    deleteQuoteMutation({ id: quote.id, bookingId: booking.id }, {
                                      onSuccess: () => toast.success('Devis supprimé'),
                                      onError: () => toast.error('Erreur lors de la suppression'),
                                    })
                                  }
                                }}
                              >
                                <TrashIcon className='h-3.5 w-3.5' />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
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
                    <Button size='sm' variant='outline' className='gap-1.5'>
                      <Plus className='h-3.5 w-3.5' />
                      Paiement
                    </Button>
                  </div>
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
                            <th className='text-left py-2 px-2 font-medium text-xs'>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map(payment => (
                            <tr key={payment.id} className='border-b hover:bg-muted/50'>
                              <td className='py-2 px-2'>
                                <Badge variant={
                                  payment.status === 'completed' ? 'default' :
                                  payment.status === 'pending' ? 'secondary' :
                                  'outline'
                                } className='text-[10px]'>
                                  {payment.status === 'completed' ? 'Payé' :
                                   payment.status === 'pending' ? 'En attente' :
                                   payment.status === 'failed' ? 'Échoué' :
                                   payment.status}
                                </Badge>
                              </td>
                              <td className='py-2 px-2 text-xs capitalize'>{payment.payment_type}</td>
                              <td className='py-2 px-2 text-sm font-medium'>{(payment.amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                              <td className='py-2 px-2 text-xs capitalize'>{payment.payment_method || '—'}</td>
                              <td className='py-2 px-2 text-xs text-muted-foreground'>
                                {payment.created_at ? format(new Date(payment.created_at), 'dd/MM/yyyy', { locale: fr }) : '—'}
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

            {/* ── Tab: Historique ── */}
            {activeTab === 'historique' && (
              <div>
                <Card>
                  <CardContent className='py-8 text-center text-muted-foreground'>
                    <History className='mx-auto h-8 w-8 mb-2 opacity-50' />
                    {"L'historique sera disponible prochainement."}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

        </div>
      </form>
    </Form>
  )
})
