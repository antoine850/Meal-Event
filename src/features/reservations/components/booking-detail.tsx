import { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, Link, useBlocker } from '@tanstack/react-router'
import { toast } from 'sonner'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ExternalLink,
  FileText,
  History,
  Mail,
  Phone,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
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
import { Switch } from '@/components/ui/switch'
import {
  useUpdateBooking,
  useDeleteBooking,
  useCreateBookingEvent,
  useDeleteBookingEvent,
  useBookingStatuses,
  useQuotesByBooking,
  usePaymentsByBooking,
  type BookingWithRelations,
  type BookingEventRow,
} from '../hooks/use-bookings'
import { useDocumentsByBooking, useUploadDocument, useDeleteDocument } from '../hooks/use-documents'
import { useOrganizationUsers } from '@/features/contacts/hooks/use-contacts'
import { useSpaces } from '@/features/settings/hooks/use-settings'

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

// ─── Editable sub-event card ─────────────────────────────────────
function BookingEventCard({ event, spaces, onDirtyChange, bookingEvents, selectedEventId, onSelectEvent, onDeleteEvent }: { event: BookingEventRow; spaces: { id: string; name: string }[]; onDirtyChange?: (isDirty: boolean) => void; bookingEvents: BookingEventRow[]; selectedEventId: string; onSelectEvent: (value: string) => void; onDeleteEvent: (event: BookingEventRow) => void }) {
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [_dirty, setDirty] = useState(false)

  useEffect(() => {
    setForm({
      name: event.name || '',
      event_date: event.event_date || '',
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      guests_count: event.guests_count ?? '',
      space_id: event.space_id || '',
      occasion: event.occasion || '',
      is_date_flexible: event.is_date_flexible || false,
      is_restaurant_flexible: event.is_restaurant_flexible || false,
      client_preferred_time: event.client_preferred_time || '',
      menu_aperitif: event.menu_aperitif || '',
      menu_entree: event.menu_entree || '',
      menu_plat: event.menu_plat || '',
      menu_dessert: event.menu_dessert || '',
      menu_boissons: event.menu_boissons || '',
      mise_en_place: event.mise_en_place || '',
      deroulement: event.deroulement || '',
      is_privatif: event.is_privatif || false,
      allergies_regimes: event.allergies_regimes || '',
      prestations_souhaitees: event.prestations_souhaitees || '',
      budget_client: event.budget_client ?? '',
      format_souhaite: event.format_souhaite || '',
      contact_sur_place_nom: event.contact_sur_place_nom || '',
      contact_sur_place_tel: event.contact_sur_place_tel || '',
      contact_sur_place_societe: event.contact_sur_place_societe || '',
      instructions_speciales: event.instructions_speciales || '',
      commentaires: event.commentaires || '',
      date_signature_devis: event.date_signature_devis || '',
    })
    setDirty(false)
  }, [event])

  const update = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
    onDirtyChange?.(true)
  }

  const inputCls = 'flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  const textareaCls = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none min-h-[60px]'

  return (
    <Card>
      <CardContent className='space-y-3 pt-1'>
        <div className='max-w-sm'>
          <label className='text-xs font-medium'>Sous-événement</label>
          <div className='flex items-center gap-2'>
            <Select value={selectedEventId} onValueChange={onSelectEvent}>
              <SelectTrigger className='h-8'>
                <SelectValue placeholder='Sélectionner un sous-événement' />
              </SelectTrigger>
              <SelectContent>
                {bookingEvents.map((eventItem, index) => (
                  <SelectItem key={eventItem.id} value={eventItem.id}>
                    {eventItem.name || `Sous-événement ${index + 1}`}
                  </SelectItem>
                ))}
                <SelectItem value='__create__'>+ Créer un sous-événement</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type='button'
              size='icon'
              variant='outline'
              className='h-8 w-8 text-destructive hover:text-destructive'
              onClick={() => onDeleteEvent(event)}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        </div>

        {/* Nom */}
        <div>
          <label className='text-xs font-medium'>Nom</label>
          <input className={inputCls} value={form.name as string || ''} onChange={e => update('name', e.target.value)} />
        </div>

        {/* Date / Espace */}
        <div className='grid gap-3 md:grid-cols-2'>
          <div>
            <label className='text-xs font-medium'>Date</label>
            <input type='date' className={inputCls} value={form.event_date as string || ''} onChange={e => update('event_date', e.target.value)} />
          </div>
          <div>
            <label className='text-xs font-medium'>Espace</label>
            <select className={inputCls} value={form.space_id as string || ''} onChange={e => update('space_id', e.target.value)}>
              <option value=''>—</option>
              {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Horaires / Personnes */}
        <div className='grid gap-3 md:grid-cols-3'>
          <div>
            <label className='text-xs font-medium'>Début</label>
            <input type='time' className={inputCls} value={form.start_time as string || ''} onChange={e => update('start_time', e.target.value)} />
          </div>
          <div>
            <label className='text-xs font-medium'>Fin</label>
            <input type='time' className={inputCls} value={form.end_time as string || ''} onChange={e => update('end_time', e.target.value)} />
          </div>
          <div>
            <label className='text-xs font-medium'>Personnes</label>
            <input type='number' className={inputCls} value={form.guests_count as string || ''} onChange={e => update('guests_count', e.target.value)} />
          </div>
        </div>

        {/* Occasion / Heure préférée */}
        <div className='grid gap-3 md:grid-cols-2'>
          <div>
            <label className='text-xs font-medium'>Occasion</label>
            <input className={inputCls} value={form.occasion as string || ''} onChange={e => update('occasion', e.target.value)} />
          </div>
          <div>
            <label className='text-xs font-medium'>Heure préférée client</label>
            <input className={inputCls} value={form.client_preferred_time as string || ''} onChange={e => update('client_preferred_time', e.target.value)} />
          </div>
        </div>

        {/* Flexibilité / Privatif */}
        <div className='flex gap-6'>
          <label className='flex items-center gap-2 text-xs'>
            <Switch checked={form.is_date_flexible as boolean || false} onCheckedChange={v => update('is_date_flexible', v)} />
            Date flexible
          </label>
          <label className='flex items-center gap-2 text-xs'>
            <Switch checked={form.is_restaurant_flexible as boolean || false} onCheckedChange={v => update('is_restaurant_flexible', v)} />
            Restaurant flexible
          </label>
          <label className='flex items-center gap-2 text-xs'>
            <Switch checked={form.is_privatif as boolean || false} onCheckedChange={v => update('is_privatif', v)} />
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
              <textarea className={textareaCls} value={form.menu_aperitif as string || ''} onChange={e => update('menu_aperitif', e.target.value)} />
            </div>
            <div>
              <label className='text-xs font-medium'>Entrée</label>
              <textarea className={textareaCls} value={form.menu_entree as string || ''} onChange={e => update('menu_entree', e.target.value)} />
            </div>
            <div>
              <label className='text-xs font-medium'>Plat</label>
              <textarea className={textareaCls} value={form.menu_plat as string || ''} onChange={e => update('menu_plat', e.target.value)} />
            </div>
            <div>
              <label className='text-xs font-medium'>Dessert</label>
              <textarea className={textareaCls} value={form.menu_dessert as string || ''} onChange={e => update('menu_dessert', e.target.value)} />
            </div>
          </div>
          <div>
            <label className='text-xs font-medium'>Boissons</label>
            <textarea className={textareaCls} value={form.menu_boissons as string || ''} onChange={e => update('menu_boissons', e.target.value)} />
          </div>
        </div>

        <Separator />

        {/* Mise en place / Déroulé */}
        <div className='grid gap-3 md:grid-cols-2'>
          <div>
            <label className='text-xs font-medium'>Mise en place</label>
            <textarea className={textareaCls} value={form.mise_en_place as string || ''} onChange={e => update('mise_en_place', e.target.value)} />
          </div>
          <div>
            <label className='text-xs font-medium'>Déroulé</label>
            <textarea className={textareaCls} value={form.deroulement as string || ''} onChange={e => update('deroulement', e.target.value)} />
          </div>
        </div>

        {/* Allergies / Prestations */}
        <div className='grid gap-3 md:grid-cols-2'>
          <div>
            <label className='text-xs font-medium'>Allergies / Régimes</label>
            <textarea className={textareaCls} value={form.allergies_regimes as string || ''} onChange={e => update('allergies_regimes', e.target.value)} />
          </div>
          <div>
            <label className='text-xs font-medium'>Prestations souhaitées</label>
            <textarea className={textareaCls} value={form.prestations_souhaitees as string || ''} onChange={e => update('prestations_souhaitees', e.target.value)} />
          </div>
        </div>

        {/* Budget / Format */}
        <div className='grid gap-3 md:grid-cols-2'>
          <div>
            <label className='text-xs font-medium'>Budget client (€)</label>
            <input type='number' step='0.01' className={inputCls} value={form.budget_client as string || ''} onChange={e => update('budget_client', e.target.value)} />
          </div>
          <div>
            <label className='text-xs font-medium'>Format souhaité</label>
            <input className={inputCls} value={form.format_souhaite as string || ''} onChange={e => update('format_souhaite', e.target.value)} />
          </div>
        </div>

        <Separator />

        {/* Contact sur place */}
        <div className='space-y-2'>
          <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Contact sur place</p>
          <div className='grid gap-3 md:grid-cols-3'>
            <div>
              <label className='text-xs font-medium'>Nom</label>
              <input className={inputCls} value={form.contact_sur_place_nom as string || ''} onChange={e => update('contact_sur_place_nom', e.target.value)} />
            </div>
            <div>
              <label className='text-xs font-medium'>Téléphone</label>
              <input className={inputCls} value={form.contact_sur_place_tel as string || ''} onChange={e => update('contact_sur_place_tel', e.target.value)} />
            </div>
            <div>
              <label className='text-xs font-medium'>Société</label>
              <input className={inputCls} value={form.contact_sur_place_societe as string || ''} onChange={e => update('contact_sur_place_societe', e.target.value)} />
            </div>
          </div>
        </div>

        <Separator />

        {/* Instructions / Commentaires / Date signature */}
        <div>
          <label className='text-xs font-medium'>Instructions spéciales</label>
          <textarea className={textareaCls} value={form.instructions_speciales as string || ''} onChange={e => update('instructions_speciales', e.target.value)} />
        </div>
        <div>
          <label className='text-xs font-medium'>Commentaires</label>
          <textarea className={textareaCls} value={form.commentaires as string || ''} onChange={e => update('commentaires', e.target.value)} />
        </div>
        <div className='max-w-xs'>
          <label className='text-xs font-medium'>Date signature devis</label>
          <input type='date' className={inputCls} value={form.date_signature_devis as string || ''} onChange={e => update('date_signature_devis', e.target.value)} />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────
export const BookingDetail = forwardRef<
  { submitForm: () => void; deleteBooking: () => void; getIsDirty: () => boolean },
  BookingDetailProps & { onDirtyChange?: (isDirty: boolean) => void }
>(function BookingDetail({ booking, activeTab = 'evenementiel', onDirtyChange }, ref) {
  const navigate = useNavigate()
  const { mutate: updateBooking } = useUpdateBooking()
  const { mutate: deleteBookingMutation } = useDeleteBooking()
  const { mutate: createBookingEvent } = useCreateBookingEvent()
  const { mutate: deleteBookingEvent } = useDeleteBookingEvent()
  const { data: statuses = [] } = useBookingStatuses()
  const { data: users = [] } = useOrganizationUsers()
  const { data: spaces = [] } = useSpaces()
  const { data: quotes = [] } = useQuotesByBooking(booking.id)
  const { data: payments = [] } = usePaymentsByBooking(booking.id)
  const { data: documents = [] } = useDocumentsByBooking(booking.id)
  const { mutate: uploadDocument } = useUploadDocument()
  const { mutate: deleteDocument, isPending: isDeletingDocument } = useDeleteDocument()

  const bookingEvents = booking.booking_events || []
  const [selectedEventId, setSelectedEventId] = useState<string>(bookingEvents[0]?.id || '')
  const [eventToDelete, setEventToDelete] = useState<BookingEventRow | null>(null)
  const daysUntilEvent = differenceInDays(new Date(booking.event_date), new Date())

  useEffect(() => {
    if (!bookingEvents.length) {
      setSelectedEventId('')
      return
    }
    const exists = bookingEvents.some(e => e.id === selectedEventId)
    if (!exists) {
      setSelectedEventId(bookingEvents[0].id)
    }
  }, [bookingEvents, selectedEventId])

  const selectedEvent = bookingEvents.find(e => e.id === selectedEventId) || bookingEvents[0]

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

  // Notify parent when form dirty state changes
  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty)
  }, [form.formState.isDirty, onDirtyChange])

  const blocker = useBlocker({
    condition: form.formState.isDirty,
  })

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
      if (form.formState.isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [form.formState.isDirty])

  const onSubmit = (data: BookingDetailFormData) => {
    updateBooking(
      {
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
      } as never,
      {
        onSuccess: () => {
          toast.success('Événement mis à jour')
          form.reset(data, { keepValues: true })
          onDirtyChange?.(false)
        },
        onError: () => toast.error('Erreur lors de la mise à jour'),
      }
    )
  }

  const handleDeleteSubEvent = () => {
    if (!eventToDelete) return

    const deletedId = eventToDelete.id
    deleteBookingEvent(deletedId, {
      onSuccess: () => {
        const remaining = bookingEvents.filter(e => e.id !== deletedId)
        setSelectedEventId(remaining[0]?.id || '')
        setEventToDelete(null)
        toast.success('Sous-événement supprimé')
      },
      onError: () => {
        toast.error('Erreur lors de la suppression du sous-événement')
      },
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

  const handleCreateSubEvent = (eventData?: Partial<BookingEventRow>) => {
    createBookingEvent(
      {
        booking_id: booking.id,
        name: eventData?.name || `Sous-événement ${bookingEvents.length + 1}`,
        event_date: eventData?.event_date || booking.event_date,
        start_time: eventData?.start_time || booking.start_time || null,
        end_time: eventData?.end_time || booking.end_time || null,
        guests_count: eventData?.guests_count ?? booking.guests_count ?? null,
        space_id: eventData?.space_id || null,
        occasion: eventData?.occasion || null,
        is_date_flexible: Boolean(eventData?.is_date_flexible),
        is_restaurant_flexible: Boolean(eventData?.is_restaurant_flexible),
        client_preferred_time: eventData?.client_preferred_time || null,
        menu_aperitif: eventData?.menu_aperitif || null,
        menu_entree: eventData?.menu_entree || null,
        menu_plat: eventData?.menu_plat || null,
        menu_dessert: eventData?.menu_dessert || null,
        menu_boissons: eventData?.menu_boissons || null,
        mise_en_place: eventData?.mise_en_place || null,
        deroulement: eventData?.deroulement || null,
        is_privatif: Boolean(eventData?.is_privatif),
        allergies_regimes: eventData?.allergies_regimes || null,
        prestations_souhaitees: eventData?.prestations_souhaitees || null,
        budget_client: eventData?.budget_client ?? null,
        format_souhaite: eventData?.format_souhaite || null,
        contact_sur_place_nom: eventData?.contact_sur_place_nom || null,
        contact_sur_place_tel: eventData?.contact_sur_place_tel || null,
        contact_sur_place_societe: eventData?.contact_sur_place_societe || null,
        instructions_speciales: eventData?.instructions_speciales || null,
        commentaires: eventData?.commentaires || null,
        date_signature_devis: eventData?.date_signature_devis || null,
      },
      {
        onSuccess: (created) => {
          const createdId = (created as BookingEventRow | null)?.id
          if (createdId) setSelectedEventId(createdId)
          toast.success(eventData ? 'Sous-événement dupliqué' : 'Sous-événement créé')
        },
        onError: () => toast.error('Erreur lors de la création du sous-événement'),
      }
    )
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
                        window.open(`mailto:${booking.contact.email}`, '_blank')
                      }}>
                        <Mail className='mr-2 h-4 w-4' />
                        Envoyer un email
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <ExternalLink className='mr-2 h-4 w-4' />
                        Ouvrir l'espace client
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCreateSubEvent()}>
                        <svg className='mr-2 h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v1m6 11h2m-6 0h-2v4m6-5h-2m6 2v1m-6 4h-2m6-5h-2m-6 2v-1m6-6h2m-6 2v4m6-4h2m-6 2v-1m6-6h2m-6 2v1m-6-6h2m6-2v-1' />
                        </svg>
                        Créer un sous-événement
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
                        <Input type='date' className='h-8 text-sm' value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Assigné */}
                <FormField
                  control={form.control}
                  name='assigned_to'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Assigné</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className='h-8'>
                            <SelectValue placeholder='Sélectionnez' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map(u => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.first_name} {u.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                {/* Sub-events — the real event details */}
                {selectedEvent && (
                  <BookingEventCard
                    key={selectedEvent.id}
                    event={selectedEvent}
                    spaces={spaces}
                    onDirtyChange={onDirtyChange}
                    bookingEvents={bookingEvents}
                    selectedEventId={selectedEventId}
                    onSelectEvent={(value) => {
                      if (value === '__create__') {
                        handleCreateSubEvent()
                        return
                      }
                      setSelectedEventId(value)
                    }}
                    onDeleteEvent={setEventToDelete}
                  />
                )}

                {bookingEvents.length === 0 && (
                  <Card>
                    <CardContent className='py-8 text-center text-muted-foreground'>
                      Aucun sous-événement pour le moment.
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ── Tab: Facturation ── */}
            {activeTab === 'facturation' && (
              <div className='space-y-4'>
              {/* Devis / Factures Section */}
              <Card>
                <CardHeader className='pb-3'>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='text-base'>Devis / Factures</CardTitle>
                    <Button size='sm' variant='outline'>
                      + Offre
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {quotes.length > 0 ? (
                    <div className='space-y-3'>
                      {quotes.map(quote => (
                        <div key={quote.id} className='border rounded-lg p-3 space-y-2'>
                          <div className='flex items-center justify-between'>
                            <div>
                              <p className='font-medium text-sm'>Devis {quote.quote_number}</p>
                              <p className='text-xs text-muted-foreground'>
                                HT: {quote.total_ht?.toLocaleString('fr-FR')} € | TTC: {quote.total_ttc?.toLocaleString('fr-FR')} €
                              </p>
                            </div>
                            <div className='flex gap-2'>
                              <Button size='sm' variant='outline'>Devis</Button>
                              <Button size='sm' variant='outline'>Factures ({quote.status})</Button>
                              <Button size='sm' variant='outline'>Générer</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='py-6 text-center text-muted-foreground'>
                      <p className='text-sm'>Aucun devis pour le moment.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Paiements / Cautions Section */}
              <Card>
                <CardHeader className='pb-3'>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='text-base'>Paiements / Cautions</CardTitle>
                    <Button size='sm' variant='outline'>
                      + Paiement
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {payments.length > 0 ? (
                    <div className='overflow-x-auto'>
                      <table className='w-full text-sm'>
                        <thead>
                          <tr className='border-b'>
                            <th className='text-left py-2 px-2 font-medium'>Statut</th>
                            <th className='text-left py-2 px-2 font-medium'>Intitulé</th>
                            <th className='text-left py-2 px-2 font-medium'>Montant</th>
                            <th className='text-left py-2 px-2 font-medium'>Type de paiement</th>
                            <th className='text-left py-2 px-2 font-medium'>Caution</th>
                            <th className='text-left py-2 px-2 font-medium'>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map(payment => (
                            <tr key={payment.id} className='border-b hover:bg-muted/50'>
                              <td className='py-2 px-2'>
                                <span className='text-xs px-2 py-1 rounded-full bg-muted'>
                                  {payment.status}
                                </span>
                              </td>
                              <td className='py-2 px-2 text-xs'>Paiement</td>
                              <td className='py-2 px-2 font-medium'>{payment.amount?.toLocaleString('fr-FR')} €</td>
                              <td className='py-2 px-2 text-xs'>{payment.payment_type}</td>
                              <td className='py-2 px-2 text-xs'>—</td>
                              <td className='py-2 px-2'>
                                <Button size='sm' variant='ghost'>⋮</Button>
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

        <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce sous-événement ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction className='bg-destructive text-destructive-foreground hover:bg-destructive/90' onClick={handleDeleteSubEvent}>
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>
    </Form>
  )
})
