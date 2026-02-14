import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useBlocker } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarDays, ExternalLink, Loader2, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import type { Contact } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { ContactWithRelations } from '../types'
import { CompanyCombobox } from './company-combobox'
import {
  useUpdateContact,
  useDeleteContact,
  useContactStatuses,
  useOrganizationUsers,
  useRestaurantsList,
} from '../hooks/use-contacts'
import { useBookingsByContact } from '@/features/reservations/hooks/use-bookings'
import { CreateBookingDialog } from '@/features/reservations/components/create-booking-dialog'

const contactDetailSchema = z.object({
  first_name: z.string().min(1, 'Le prénom est requis'),
  last_name: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  job_title: z.string().optional(),
  company_id: z.string().nullable().optional(),
  status_id: z.string().optional(),
  assigned_to: z.string().optional(),
  restaurant_id: z.string().optional(),
  source: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  notes: z.string().optional(),
})

type ContactDetailFormData = z.infer<typeof contactDetailSchema>

type ContactDetailProps = {
  contact: ContactWithRelations
}

export function ContactDetail({ contact }: ContactDetailProps) {
  const { mutate: updateContact, isPending } = useUpdateContact()
  const { data: bookings = [], isLoading: isLoadingBookings } = useBookingsByContact(contact.id)
  const { mutate: deleteContact, isPending: isDeleting } = useDeleteContact()
  const { data: statuses = [] } = useContactStatuses()
  const { data: users = [] } = useOrganizationUsers()
  const { data: restaurants = [] } = useRestaurantsList()

  const formValues = useMemo(() => ({
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    mobile: contact.mobile || '',
    job_title: contact.job_title || '',
    company_id: contact.company_id || null,
    status_id: contact.status_id || '',
    assigned_to: contact.assigned_to || '',
    restaurant_id: (contact as Record<string, unknown>).restaurant_id as string || '',
    source: contact.source || '',
    address: contact.address || '',
    city: contact.city || '',
    postal_code: contact.postal_code || '',
    notes: contact.notes || '',
  }), [contact])

  const form = useForm<ContactDetailFormData>({
    resolver: zodResolver(contactDetailSchema),
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

  const onSubmit = (data: ContactDetailFormData) => {
    updateContact(
      {
        ...{
          id: contact.id,
          first_name: data.first_name,
          last_name: data.last_name || null,
          email: data.email || null,
          phone: data.phone || null,
          mobile: data.mobile || null,
          job_title: data.job_title || null,
          company_id: data.company_id || null,
          status_id: data.status_id || null,
          assigned_to: data.assigned_to || null,
          source: data.source || null,
          address: data.address || null,
          city: data.city || null,
          postal_code: data.postal_code || null,
          notes: data.notes || null,
        },
        restaurant_id: data.restaurant_id || null,
      } as Partial<Contact> & { id: string; restaurant_id?: string | null },
      {
        onSuccess: () => {
          toast.success('Contact mis à jour')
          form.reset(data)
        },
        onError: () => toast.error('Erreur lors de la mise à jour'),
      }
    )
  }

  const handleDelete = () => {
    deleteContact(contact.id, {
      onSuccess: () => {
        toast.success('Contact supprimé')
        window.history.back()
      },
      onError: () => toast.error('Erreur lors de la suppression'),
    })
  }

  const sources = [
    'website',
    'referral',
    'phone',
    'email',
    'social',
    'event',
    'other',
  ]

  return (
    <Form {...form}>
      <form
        id='contact-form'
        onSubmit={form.handleSubmit(onSubmit)}
        className='space-y-6 pb-8'
      >
        <div className='flex items-center justify-between'>
          <div />
          <div className='flex items-center gap-2'>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type='button' variant='destructive' size='sm'>
                  <Trash2 className='mr-2 h-4 w-4' />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Le contact sera définitivement supprimé.
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
            <Button type='submit' form='contact-form' disabled={isPending || !form.formState.isDirty} className='hidden sm:flex'>
              {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              <Save className='mr-2 h-4 w-4' />
              Enregistrer
            </Button>
          </div>
        </div>

        <div className='grid gap-6 lg:grid-cols-2'>
          {/* Informations personnelles */}
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='first_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='last_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type='email' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='job_title'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fonction</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='phone'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input type='tel' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='mobile'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile</FormLabel>
                      <FormControl>
                        <Input type='tel' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Société & Attribution */}
          <Card>
            <CardHeader>
              <CardTitle>Société & Attribution</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <FormField
                control={form.control}
                name='company_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Société</FormLabel>
                    <FormControl>
                      <CompanyCombobox
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='status_id'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statut</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Sélectionner...' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statuses.map((status: any) => (
                            <SelectItem key={status.id} value={status.id}>
                              {status.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='assigned_to'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commercial</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Sélectionner...' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((user: any) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.first_name} {user.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='restaurant_id'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restaurant privilégié</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Sélectionner...' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {restaurants.map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='source'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Sélectionner...' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sources.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Adresse */}
          <Card>
            <CardHeader>
              <CardTitle>Adresse</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <FormField
                control={form.control}
                name='address'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='postal_code'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code postal</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='city'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name='notes'
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder='Notes sur le contact...'
                        className='min-h-[120px] resize-none'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        {/* Événements */}
        <Card className='lg:col-span-2'>
          <CardHeader>
            <div className='flex items-center justify-between w-full'>
              <div className='flex items-center gap-2'>
                <CalendarDays className='h-5 w-5' />
                Événements ({bookings.length})
              </div>
              <CreateBookingDialog defaultContactId={contact.id} iconOnly />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingBookings ? (
              <div className='flex items-center justify-center py-6'>
                <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
              </div>
            ) : bookings.length === 0 ? (
              <p className='text-sm text-muted-foreground py-4 text-center'>
                Aucun événement pour ce contact.
              </p>
            ) : (
              <div className='divide-y rounded-md border'>
                {bookings.map((booking) => (
                  <Link
                    key={booking.id}
                    to='/reservations'
                    className='flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors'
                  >
                    <div className='flex items-center gap-4 min-w-0'>
                      <div className='flex flex-col'>
                        <span className='text-sm font-medium'>
                          {format(new Date(booking.event_date), 'dd MMMM yyyy', { locale: fr })}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          {booking.start_time || ''}{booking.end_time ? ` - ${booking.end_time}` : ''}
                        </span>
                      </div>
                      {booking.restaurant && (
                        <div className='flex items-center gap-1.5'>
                          {booking.restaurant.color && (
                            <div
                              className='h-2 w-2 rounded-full shrink-0'
                              style={{ backgroundColor: booking.restaurant.color }}
                            />
                          )}
                          <span className='text-sm text-muted-foreground truncate'>
                            {booking.restaurant.name}
                          </span>
                        </div>
                      )}
                      {booking.event_type && (
                        <span className='text-xs text-muted-foreground hidden sm:inline'>
                          {booking.event_type}
                        </span>
                      )}
                      {booking.guests_count && (
                        <span className='text-xs text-muted-foreground'>
                          {booking.guests_count} pers.
                        </span>
                      )}
                    </div>
                    <div className='flex items-center gap-3 shrink-0'>
                      {booking.total_amount > 0 && (
                        <span className='text-sm font-medium'>
                          {booking.total_amount.toLocaleString('fr-FR')} €
                        </span>
                      )}
                      {booking.status && (
                        <Badge variant='outline' className={cn('text-xs', booking.status.color)}>
                          {booking.status.name}
                        </Badge>
                      )}
                      <ExternalLink className='h-4 w-4 text-muted-foreground' />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile save button */}
        <div className='sm:hidden'>
          <Button type='submit' form='contact-form' disabled={isPending || !form.formState.isDirty} className='w-full'>
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            <Save className='mr-2 h-4 w-4' />
            Enregistrer
          </Button>
        </div>
      </form>
    </Form>
  )
}
