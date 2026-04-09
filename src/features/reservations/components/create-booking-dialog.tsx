import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon, Check, ChevronsUpDown, Loader2, Plus, UserPlus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { TimePicker } from '@/components/ui/time-picker'
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
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useCreateBooking, useBookingStatuses, useRestaurants } from '../hooks/use-bookings'
import { useContacts, useCreateContact } from '@/features/contacts/hooks/use-contacts'
import { CompanyCombobox } from '@/features/contacts/components/company-combobox'

const bookingSchema = z.object({
  // Contact mode: 'existing' or 'new'
  contact_mode: z.enum(['existing', 'new']),
  // Existing contact
  contact_id: z.string().optional(),
  // New contact fields
  new_first_name: z.string().optional(),
  new_last_name: z.string().optional(),
  new_email: z.string().email('Email invalide').optional().or(z.literal('')),
  new_phone: z.string().optional(),
  is_b2b: z.boolean(),
  company_id: z.string().optional().nullable(),
  // Booking fields
  restaurant_id: z.string().min(1, 'Le restaurant est requis'),
  event_date: z.date({ message: 'La date est requise' }),
  start_time: z.string().min(1, "L'heure de début est requise"),
  end_time: z.string().optional(),
  guests_count: z.number().min(1, 'Le nombre de personnes est requis'),
  event_type: z.string().optional(),
  status_id: z.string().optional(),
  internal_notes: z.string().optional(),
})

type BookingFormData = z.infer<typeof bookingSchema>

interface CreateBookingDialogProps {
  defaultDate?: Date
  defaultContactId?: string
  iconOnly?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateBookingDialog({ defaultDate, defaultContactId, iconOnly, open: controlledOpen, onOpenChange }: CreateBookingDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const navigate = useNavigate()
  const { mutate: createBooking, isPending: isBookingPending } = useCreateBooking()
  const { mutate: createContact, isPending: isContactPending } = useCreateContact()
  const { data: contacts = [] } = useContacts()
  const { data: statuses = [] } = useBookingStatuses()
  const { data: restaurants = [] } = useRestaurants()

  const isPending = isBookingPending || isContactPending

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      contact_mode: defaultContactId ? 'existing' : 'existing',
      contact_id: defaultContactId || '',
      new_first_name: '',
      new_last_name: '',
      new_email: '',
      new_phone: '',
      is_b2b: false,
      company_id: '',
      restaurant_id: '',
      event_date: defaultDate || new Date(),
      start_time: '12:00',
      end_time: '14:00',
      guests_count: 10,
      event_type: '',
      status_id: '',
      internal_notes: '',
    },
  })

  const contactMode = form.watch('contact_mode')
  const isB2B = form.watch('is_b2b')

  useEffect(() => {
    if (defaultDate) {
      form.setValue('event_date', defaultDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultDate])

  // Set default status to "nouveau" when statuses load
  useEffect(() => {
    if (statuses.length > 0 && !form.getValues('status_id')) {
      const nouveau = statuses.find(s => s.name.toLowerCase() === 'nouveau')
      if (nouveau) {
        form.setValue('status_id', nouveau.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses])

  const doCreateBooking = (contactId: string, data: BookingFormData) => {
    createBooking(
      {
        contact_id: contactId,
        restaurant_id: data.restaurant_id,
        event_date: format(data.event_date, 'yyyy-MM-dd'),
        start_time: data.start_time,
        end_time: data.end_time || null,
        guests_count: data.guests_count,
        event_type: data.event_type || null,
        status_id: data.status_id || null,
        internal_notes: data.internal_notes || null,
        total_amount: 0,
        deposit_amount: 0,
      },
      {
        onSuccess: (result: any) => {
          toast.success('Événement créé avec succès')
          setOpen(false)
          form.reset()
          if (result?.id) {
            navigate({ to: '/evenements/booking/$id', params: { id: result.id } })
          }
        },
        onError: (error) => {
          console.error('Error creating booking:', error)
          toast.error("Erreur lors de la création de l'événement")
        },
      }
    )
  }

  const onSubmit = (data: BookingFormData) => {
    if (data.contact_mode === 'existing') {
      if (!data.contact_id) {
        form.setError('contact_id', { message: 'Le contact est requis' })
        return
      }
      doCreateBooking(data.contact_id, data)
    } else {
      if (!data.new_first_name?.trim()) {
        form.setError('new_first_name', { message: 'Le prénom est requis' })
        return
      }
      // Create contact first, then booking
      createContact(
        {
          first_name: data.new_first_name!.trim(),
          last_name: data.new_last_name?.trim() || null,
          email: data.new_email?.trim() || null,
          phone: data.new_phone?.trim() || null,
          company_id: data.is_b2b && data.company_id ? data.company_id : null,
        },
        {
          onSuccess: (contact) => {
            toast.success('Contact créé')
            doCreateBooking(contact.id, data)
          },
          onError: (error: any) => {
            console.error('Error creating contact:', error)
            toast.error('Erreur lors de la création du contact')
          },
        }
      )
    }
  }

  const eventTypes = [
    'Anniversaire',
    'Mariage',
    'Séminaire',
    "Dîner d'équipe",
    'Cocktail',
    'Baptême',
    'Communion',
    'Soirée privée',
    'Événement corporate',
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <Button size='sm' variant='outline'>
            <Plus className='mr-2 h-4 w-4' />
            Ajouter
          </Button>
        ) : (
          <Button size='sm'>
            <Plus className='mr-2 h-4 w-4' />
            Nouveau
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='sm:max-w-[600px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Nouvel événement</DialogTitle>
          <DialogDescription>
            Créez un nouvel événement lié à un contact existant ou nouveau.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            {/* Contact mode toggle */}
            <div className='flex gap-2'>
              <Button
                type='button'
                variant={contactMode === 'existing' ? 'default' : 'outline'}
                size='sm'
                className='flex-1'
                onClick={() => {
                  form.setValue('contact_mode', 'existing')
                  form.clearErrors('contact_id')
                }}
              >
                <Search className='mr-2 h-4 w-4' />
                Contact existant
              </Button>
              <Button
                type='button'
                variant={contactMode === 'new' ? 'default' : 'outline'}
                size='sm'
                className='flex-1'
                onClick={() => {
                  form.setValue('contact_mode', 'new')
                  form.clearErrors('contact_id')
                }}
              >
                <UserPlus className='mr-2 h-4 w-4' />
                Nouveau contact
              </Button>
            </div>

            {/* Existing contact selector */}
            {contactMode === 'existing' && (
              <FormField
                control={form.control}
                name='contact_id'
                render={({ field }) => {
                  const selectedContact = contacts.find(c => c.id === field.value)
                  return (
                    <FormItem className='flex flex-col'>
                      <FormLabel>Contact *</FormLabel>
                      <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant='outline'
                              role='combobox'
                              aria-expanded={contactPopoverOpen}
                              className={cn(
                                'w-full justify-between font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {selectedContact ? (
                                <span className='flex items-center gap-2 truncate'>
                                  <span>{selectedContact.first_name} {selectedContact.last_name || ''}</span>
                                  {selectedContact.company?.name
                                    ? <span className='text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded'>B2B</span>
                                    : <span className='text-xs bg-gray-500 text-white px-1.5 py-0.5 rounded'>B2C</span>
                                  }
                                </span>
                              ) : (
                                'Rechercher un contact...'
                              )}
                              <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className='w-[--radix-popover-trigger-width] p-0' align='start'>
                          <Command>
                            <CommandInput placeholder='Rechercher par nom, email...' />
                            <CommandList className='max-h-[200px]'>
                              <CommandEmpty>Aucun contact trouvé.</CommandEmpty>
                              <CommandGroup>
                                {contacts.map((contact) => (
                                  <CommandItem
                                    key={contact.id}
                                    value={`${contact.first_name} ${contact.last_name || ''} ${contact.email || ''} ${contact.company?.name || ''}`}
                                    onSelect={() => {
                                      field.onChange(contact.id)
                                      setContactPopoverOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        field.value === contact.id ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    <div className='flex items-center gap-2 min-w-0'>
                                      <span className='font-medium truncate'>{contact.first_name} {contact.last_name || ''}</span>
                                      {contact.company?.name
                                        ? <span className='text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded shrink-0'>B2B</span>
                                        : <span className='text-xs bg-gray-500 text-white px-1.5 py-0.5 rounded shrink-0'>B2C</span>
                                      }
                                      {contact.company?.name && (
                                        <span className='text-muted-foreground text-xs truncate'>- {contact.company.name}</span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            )}

            {/* New contact inline form */}
            {contactMode === 'new' && (
              <div className='space-y-3 rounded-lg border p-4 bg-muted/30'>
                <div className='grid grid-cols-2 gap-3'>
                  <FormField
                    control={form.control}
                    name='new_first_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom *</FormLabel>
                        <FormControl>
                          <Input placeholder='Jean' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='new_last_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input placeholder='Dupont' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid grid-cols-2 gap-3'>
                  <FormField
                    control={form.control}
                    name='new_email'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type='email' placeholder='jean@exemple.com' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='new_phone'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <Input placeholder='+33 6 12 34 56 78' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* B2B / B2C toggle */}
                <div className='flex items-center justify-between pt-1'>
                  <div className='flex items-center gap-3'>
                    <span className={cn(
                      'text-sm font-medium px-2 py-0.5 rounded',
                      !isB2B ? 'bg-gray-500 text-white' : 'text-muted-foreground'
                    )}>
                      B2C
                    </span>
                    <FormField
                      control={form.control}
                      name='is_b2b'
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked)
                                if (!checked) {
                                  form.setValue('company_id', '')
                                }
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <span className={cn(
                      'text-sm font-medium px-2 py-0.5 rounded',
                      isB2B ? 'bg-blue-500 text-white' : 'text-muted-foreground'
                    )}>
                      B2B
                    </span>
                  </div>
                </div>

                {/* Company selector (B2B only) */}
                {isB2B && (
                  <FormField
                    control={form.control}
                    name='company_id'
                    render={({ field }) => (
                      <FormItem className='flex flex-col'>
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
                )}
              </div>
            )}

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='event_date'
                render={({ field }) => (
                  <FormItem className='flex flex-col'>
                    <FormLabel>Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant='outline'
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP', { locale: fr })
                            ) : (
                              <span>Choisir une date</span>
                            )}
                            <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className='w-auto p-0' align='start'>
                        <Calendar
                          mode='single'
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={fr}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='guests_count'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de personnes *</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='start_time'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure début *</FormLabel>
                    <FormControl>
                      <TimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder='HH:MM'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='end_time'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure fin</FormLabel>
                    <FormControl>
                      <TimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder='HH:MM'
                      />
                    </FormControl>
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
                    <FormLabel>Restaurant *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Sélectionner...' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {restaurants.map((restaurant) => (
                          <SelectItem key={restaurant.id} value={restaurant.id}>
                            <div className='flex items-center gap-2'>
                              {restaurant.color && (
                                <div
                                  className='w-2 h-2 rounded-full'
                                  style={{ backgroundColor: restaurant.color }}
                                />
                              )}
                              {restaurant.name}
                            </div>
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
                name='event_type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type d'événement</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Sélectionner...' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eventTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                      {statuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          <div className='flex items-center gap-2'>
                            <div
                              className='w-2 h-2 rounded-full'
                              style={{ backgroundColor: status.color }}
                            />
                            {status.name}
                          </div>
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
              name='internal_notes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes internes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={"Notes sur l'événement..."}
                      className='resize-none'
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {contactMode === 'new' ? "Créer le contact et l'événement" : "Créer l'événement"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
