import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useBlocker, useNavigate, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  CalendarIcon,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Mail,
  Phone,
  Receipt,
  Save,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  useUpdateBooking,
  useDeleteBooking,
  useBookingStatuses,
  type BookingWithRelations,
  type BookingEventRow,
} from '../hooks/use-bookings'
import { useOrganizationUsers } from '@/features/contacts/hooks/use-contacts'
import { useSpaces } from '@/features/settings/hooks/use-settings'

const bookingDetailSchema = z.object({
  contact_id: z.string().min(1, 'Le contact est requis'),
  restaurant_id: z.string().min(1, 'Le restaurant est requis'),
  occasion: z.string().optional(),
  option: z.string().optional(),
  relance: z.string().optional(),
  source: z.string().optional(),
  status_id: z.string().optional(),
  assigned_to: z.string().optional(),
  total_amount: z.number().optional(),
  deposit_amount: z.number().optional(),
  is_table_blocked: z.boolean().optional(),
  has_extra_provider: z.boolean().optional(),
  internal_notes: z.string().optional(),
  client_notes: z.string().optional(),
  special_requests: z.string().optional(),
})

type BookingDetailFormData = z.infer<typeof bookingDetailSchema>

type BookingDetailProps = {
  booking: BookingWithRelations
}

// ─── Sub-event card ───────────────────────────────────────────────
function BookingEventCard({ event, spaces }: { event: BookingEventRow; spaces: { id: string; name: string }[] }) {
  const spaceName = event.space?.name || spaces.find(s => s.id === event.space_id)?.name || ''
  const flexValue = [
    event.is_date_flexible ? 'Date flexible' : 'Date non-flexible',
    event.is_restaurant_flexible ? 'Restaurant flexible' : 'Restaurant non-flexible',
  ].join(' • ')

  const menuValue = [
    event.menu_aperitif ? `APERITIF\n${event.menu_aperitif}` : null,
    event.menu_entree ? `ENTREE\n${event.menu_entree}` : null,
    event.menu_plat ? `PLAT\n${event.menu_plat}` : null,
    event.menu_dessert ? `DESSERT\n${event.menu_dessert}` : null,
    event.menu_boissons ? `BOISSONS\n${event.menu_boissons}` : null,
  ].filter(Boolean).join('\n\n')

  const commentairesValue = [
    event.commentaires,
    event.contact_sur_place_nom ? `Contact sur place : ${event.contact_sur_place_nom}` : null,
    event.contact_sur_place_tel ? `Tél : ${event.contact_sur_place_tel}` : null,
    event.contact_sur_place_societe ? `Société : ${event.contact_sur_place_societe}` : null,
    event.instructions_speciales,
  ].filter(Boolean).join('\n')

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base'>Sous-événement</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <FieldDisplay label="Nom de l'événement" value={event.name || ''} />

        <div className='grid gap-4 md:grid-cols-2'>
          <FieldDisplay label='Date' value={event.event_date ? format(new Date(event.event_date), 'EEEE d MMMM yyyy', { locale: fr }) : ''} />
          <FieldDisplay label='Espace' value={spaceName} />
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <FieldDisplay label='Horaires' value={[event.start_time, event.end_time].filter(Boolean).join(' > ')} />
          <FieldDisplay label='Pax' value={event.guests_count != null ? String(event.guests_count) : ''} />
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <FieldDisplay label='Date / Restaurant flexible' value={flexValue} />
          <FieldDisplay label='Menu' value={menuValue} multiline />
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <FieldDisplay label='Boissons' value={event.menu_boissons || ''} />
          <FieldDisplay label='Mise en place' value={event.mise_en_place || ''} />
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <FieldDisplay label='Déroulé' value={event.deroulement || ''} />
          <FieldDisplay label='Privatif ?' value={event.is_privatif ? 'Privatif' : 'Non privatif'} />
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <FieldDisplay label='Horaires souhaités client' value={event.client_preferred_time || ''} />
          <FieldDisplay label='Format souhaité' value={event.format_souhaite || ''} />
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <FieldDisplay label='Allergies et Régimes' value={event.allergies_regimes || ''} multiline />
          <FieldDisplay label='Prestations souhaitées' value={event.prestations_souhaitees || ''} multiline />
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <FieldDisplay label='Budget client' value={event.budget_client != null ? `${event.budget_client.toLocaleString('fr-FR')} €` : ''} />
          <FieldDisplay label='Date signature devis' value={event.date_signature_devis || ''} />
        </div>

        <FieldDisplay label='Commentaires' value={commentairesValue} multiline />
      </CardContent>
    </Card>
  )
}

function FieldDisplay({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <span className='mb-1 block text-xs font-medium text-muted-foreground'>{label}</span>
      <div className={`rounded-md border bg-muted/20 px-3 py-2 text-sm whitespace-pre-wrap ${multiline ? 'min-h-[88px]' : 'min-h-[40px]'}`}>
        {value || '—'}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────
export function BookingDetail({ booking }: BookingDetailProps) {
  const navigate = useNavigate()
  const { mutate: updateBooking, isPending } = useUpdateBooking()
  const { mutate: deleteBooking, isPending: isDeleting } = useDeleteBooking()
  const { data: statuses = [] } = useBookingStatuses()
  const { data: users = [] } = useOrganizationUsers()
  const { data: spaces = [] } = useSpaces()

  const bookingEvents = booking.booking_events || []
  const daysUntilEvent = differenceInDays(new Date(booking.event_date), new Date())

  const formValues = useMemo(() => ({
    contact_id: booking.contact_id || '',
    restaurant_id: booking.restaurant_id || '',
    occasion: booking.occasion || '',
    option: booking.option || '',
    relance: booking.relance || '',
    source: booking.source || '',
    status_id: booking.status_id || '',
    assigned_to: booking.assigned_to || '',
    total_amount: booking.total_amount || 0,
    deposit_amount: booking.deposit_amount || 0,
    is_table_blocked: booking.is_table_blocked || false,
    has_extra_provider: booking.has_extra_provider || false,
    internal_notes: booking.internal_notes || '',
    client_notes: booking.client_notes || '',
    special_requests: booking.special_requests || '',
  }), [booking])

  const form = useForm<BookingDetailFormData>({
    resolver: zodResolver(bookingDetailSchema),
    values: formValues,
  })

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
        occasion: data.occasion || null,
        option: data.option || null,
        relance: data.relance || null,
        source: data.source || null,
        status_id: data.status_id || null,
        assigned_to: data.assigned_to || null,
        total_amount: data.total_amount || 0,
        deposit_amount: data.deposit_amount || 0,
        is_table_blocked: data.is_table_blocked || false,
        has_extra_provider: data.has_extra_provider || false,
        internal_notes: data.internal_notes || null,
        client_notes: data.client_notes || null,
        special_requests: data.special_requests || null,
      } as never,
      {
        onSuccess: () => {
          toast.success('Événement mis à jour')
          form.reset(data)
        },
        onError: () => toast.error('Erreur lors de la mise à jour'),
      }
    )
  }

  const handleDelete = () => {
    deleteBooking(booking.id, {
      onSuccess: () => {
        toast.success('Événement supprimé')
        navigate({ to: '/reservations' })
      },
      onError: () => toast.error('Erreur lors de la suppression'),
    })
  }

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
              <CardContent className='pt-4 space-y-3'>
                {/* Restaurant name */}
                <div className='flex items-center gap-2'>
                  {booking.restaurant?.color && (
                    <div className='h-3 w-3 rounded-full shrink-0' style={{ backgroundColor: booking.restaurant.color }} />
                  )}
                  <span className='font-semibold text-lg'>{booking.restaurant?.name || '—'}</span>
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
              <CardContent className='pt-4 space-y-2'>
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
                    <Link to='/tasks/contact/$id' params={{ id: booking.contact_id }}>
                      Voir la fiche contact <ExternalLink className='ml-1 h-3 w-3' />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Sidebar form fields */}
            <Card>
              <CardContent className='pt-4 space-y-3'>
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

                {/* Relance */}
                <FormField
                  control={form.control}
                  name='relance'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Relance</FormLabel>
                      <FormControl>
                        <Input type='date' className='h-8 text-sm' {...field} />
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

            {/* Actions */}
            <div className='flex flex-col gap-2'>
              <Button type='submit' form='booking-form' disabled={isPending || !form.formState.isDirty} className='w-full'>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                <Save className='mr-2 h-4 w-4' />
                Enregistrer
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant='outline' className='w-full text-destructive'>
                    <Trash2 className='mr-2 h-4 w-4' />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{"Supprimer l'événement ?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* ═══════ RIGHT CONTENT — TABS ═══════ */}
          <Tabs defaultValue='evenementiel' className='flex-1'>
            <TabsList>
              <TabsTrigger value='evenementiel' className='gap-1.5'>
                <CalendarIcon className='h-4 w-4' />
                Événementiel
                <Badge variant='secondary' className='ml-1 h-5 px-1.5 text-[10px]'>{bookingEvents.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value='facturation' className='gap-1.5'>
                <Receipt className='h-4 w-4' />
                Facturation
                <Badge variant='secondary' className='ml-1 h-5 px-1.5 text-[10px]'>0</Badge>
              </TabsTrigger>
              <TabsTrigger value='fichiers' className='gap-1.5'>
                <FileText className='h-4 w-4' />
                Fichiers
                <Badge variant='secondary' className='ml-1 h-5 px-1.5 text-[10px]'>0</Badge>
              </TabsTrigger>
              <TabsTrigger value='historique' className='gap-1.5'>
                <History className='h-4 w-4' />
                Historique
                <Badge variant='secondary' className='ml-1 h-5 px-1.5 text-[10px]'>0</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Événementiel ── */}
            <TabsContent value='evenementiel' className='mt-4 space-y-4'>
              {/* Sub-events — the real event details */}
              {bookingEvents.map(event => (
                <BookingEventCard key={event.id} event={event} spaces={spaces} />
              ))}

              {bookingEvents.length === 0 && (
                <Card>
                  <CardContent className='py-8 text-center text-muted-foreground'>
                    Aucun sous-événement pour le moment.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Tab: Facturation ── */}
            <TabsContent value='facturation' className='mt-4'>
              <Card>
                <CardContent className='py-8 text-center text-muted-foreground'>
                  <Receipt className='mx-auto h-8 w-8 mb-2 opacity-50' />
                  La facturation sera disponible prochainement.
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Fichiers ── */}
            <TabsContent value='fichiers' className='mt-4'>
              <Card>
                <CardContent className='py-8 text-center text-muted-foreground'>
                  <FileText className='mx-auto h-8 w-8 mb-2 opacity-50' />
                  La gestion des fichiers sera disponible prochainement.
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Historique ── */}
            <TabsContent value='historique' className='mt-4'>
              <Card>
                <CardContent className='py-8 text-center text-muted-foreground'>
                  <History className='mx-auto h-8 w-8 mb-2 opacity-50' />
                  {"L'historique sera disponible prochainement."}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </div>
      </form>
    </Form>
  )
}
