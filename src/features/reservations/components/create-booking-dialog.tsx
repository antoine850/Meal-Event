import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon, Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react'
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
import { useCreateBooking, useBookingStatuses, useRestaurants } from '../hooks/use-bookings'
import { useContacts } from '@/features/contacts/hooks/use-contacts'

const bookingSchema = z.object({
  contact_id: z.string().min(1, 'Le contact est requis'),
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
  const { mutate: createBooking, isPending } = useCreateBooking()
  const { data: contacts = [] } = useContacts()
  const { data: statuses = [] } = useBookingStatuses()
  const { data: restaurants = [] } = useRestaurants()

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      contact_id: defaultContactId || '',
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

  const onSubmit = (data: BookingFormData) => {
    createBooking(
      {
        contact_id: data.contact_id,
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
        onSuccess: (data: any) => {
          toast.success('Événement créé avec succès')
          setOpen(false)
          form.reset()
          if (data?.id) {
            navigate({ to: '/evenements/booking/$id', params: { id: data.id } })
          }
        },
        onError: (error) => {
          console.error('Error creating booking:', error)
          toast.error('Erreur lors de la création de l\'événement')
        },
      }
    )
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
            <span className='hidden md:inline'>Nouvel événement</span>
            <span className='md:hidden'>Nouveau</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='sm:max-w-[550px]'>
        <DialogHeader>
          <DialogTitle>Nouvel événement</DialogTitle>
          <DialogDescription>
            Créez un nouvel événement lié à un contact.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
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
                Créer l'événement
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
