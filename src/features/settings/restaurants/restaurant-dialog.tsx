import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

const RESTAURANT_COLORS = [
  { value: '#ef4444', label: 'Rouge' },
  { value: '#f97316', label: 'Orange' },
  { value: '#f59e0b', label: 'Ambre' },
  { value: '#eab308', label: 'Jaune' },
  { value: '#84cc16', label: 'Lime' },
  { value: '#22c55e', label: 'Vert' },
  { value: '#10b981', label: 'Émeraude' },
  { value: '#14b8a6', label: 'Turquoise' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#0ea5e9', label: 'Bleu ciel' },
  { value: '#3b82f6', label: 'Bleu' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#a855f7', label: 'Pourpre' },
  { value: '#d946ef', label: 'Fuchsia' },
  { value: '#ec4899', label: 'Rose' },
]

import { useCreateRestaurant, useUpdateRestaurant, type Restaurant } from '../hooks/use-settings'

const COUNTRIES = [
  { value: 'France', label: 'France' },
  { value: 'Belgique', label: 'Belgique' },
  { value: 'Suisse', label: 'Suisse' },
  { value: 'Luxembourg', label: 'Luxembourg' },
  { value: 'Canada', label: 'Canada' },
]

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
]

const CURRENCIES = [
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'CHF', label: 'Franc suisse (CHF)' },
  { value: 'CAD', label: 'Dollar canadien (CAD)' },
]

const restaurantSchema = z.object({
  // Informations générales
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  color: z.string().optional(),
  logo_url: z.string().optional(),
  is_active: z.boolean(),
  // Paramètres régionaux
  language: z.string().optional(),
  currency: z.string().optional(),
  // Informations légales
  siret: z.string().optional(),
  tva_number: z.string().optional(),
  // Liens web
  website: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  // Paramètres email
  email_signature_enabled: z.boolean().optional(),
  email_signature_text: z.string().optional(),
  email_tracking_enabled: z.boolean().optional(),
  // SMS
  sms_name: z.string().optional(),
  sms_signature: z.string().optional(),
})

type RestaurantFormData = z.infer<typeof restaurantSchema>

interface RestaurantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurant: Restaurant | null
}

export function RestaurantDialog({ open, onOpenChange, restaurant }: RestaurantDialogProps) {
  const { mutate: createRestaurant, isPending: isCreating } = useCreateRestaurant()
  const { mutate: updateRestaurant, isPending: isUpdating } = useUpdateRestaurant()
  const isPending = isCreating || isUpdating

  const form = useForm<RestaurantFormData>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      postal_code: '',
      country: 'France',
      color: '#3b82f6',
      logo_url: '',
      is_active: true,
      language: 'fr',
      currency: 'EUR',
      siret: '',
      tva_number: '',
      website: '',
      instagram: '',
      facebook: '',
      email_signature_enabled: true,
      email_signature_text: '',
      email_tracking_enabled: true,
      sms_name: '',
      sms_signature: '',
    },
  })

  useEffect(() => {
    if (restaurant) {
      form.reset({
        name: restaurant.name,
        email: restaurant.email || '',
        phone: restaurant.phone || '',
        address: restaurant.address || '',
        city: (restaurant as Record<string, unknown>).city as string || '',
        postal_code: (restaurant as Record<string, unknown>).postal_code as string || '',
        country: (restaurant as Record<string, unknown>).country as string || 'France',
        color: restaurant.color || '#3b82f6',
        logo_url: (restaurant as Record<string, unknown>).logo_url as string || '',
        is_active: restaurant.is_active,
        language: (restaurant as Record<string, unknown>).language as string || 'fr',
        currency: (restaurant as Record<string, unknown>).currency as string || 'EUR',
        siret: (restaurant as Record<string, unknown>).siret as string || '',
        tva_number: (restaurant as Record<string, unknown>).tva_number as string || '',
        website: (restaurant as Record<string, unknown>).website as string || '',
        instagram: (restaurant as Record<string, unknown>).instagram as string || '',
        facebook: (restaurant as Record<string, unknown>).facebook as string || '',
        email_signature_enabled: (restaurant as Record<string, unknown>).email_signature_enabled as boolean ?? true,
        email_signature_text: (restaurant as Record<string, unknown>).email_signature_text as string || '',
        email_tracking_enabled: (restaurant as Record<string, unknown>).email_tracking_enabled as boolean ?? true,
        sms_name: (restaurant as Record<string, unknown>).sms_name as string || '',
        sms_signature: (restaurant as Record<string, unknown>).sms_signature as string || '',
      })
    } else {
      form.reset({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        postal_code: '',
        country: 'France',
        color: '#3b82f6',
        logo_url: '',
        is_active: true,
        language: 'fr',
        currency: 'EUR',
        siret: '',
        tva_number: '',
        website: '',
        instagram: '',
        facebook: '',
        email_signature_enabled: true,
        email_signature_text: '',
        email_tracking_enabled: true,
        sms_name: '',
        sms_signature: '',
      })
    }
  }, [restaurant, form])

  const onSubmit = (data: RestaurantFormData) => {
    if (restaurant) {
      updateRestaurant(
        { id: restaurant.id, ...data },
        {
          onSuccess: () => {
            toast.success('Restaurant mis à jour')
            onOpenChange(false)
          },
          onError: () => toast.error('Erreur lors de la mise à jour'),
        }
      )
    } else {
      createRestaurant(data, {
        onSuccess: () => {
          toast.success('Restaurant créé')
          onOpenChange(false)
        },
        onError: () => toast.error('Erreur lors de la création'),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[700px] max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle>
            {restaurant ? 'Modifier le restaurant' : 'Nouveau restaurant'}
          </DialogTitle>
          <DialogDescription>
            {restaurant
              ? 'Modifiez les informations du restaurant.'
              : 'Ajoutez un nouveau restaurant à votre organisation.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue='general' className='w-full'>
              <TabsList className='grid w-full grid-cols-4'>
                <TabsTrigger value='general'>Général</TabsTrigger>
                <TabsTrigger value='location'>Localisation</TabsTrigger>
                <TabsTrigger value='legal'>Légal</TabsTrigger>
                <TabsTrigger value='communication'>Communication</TabsTrigger>
              </TabsList>

              <ScrollArea className='h-[400px] mt-4 pr-4'>
                {/* Onglet Général */}
                <TabsContent value='general' className='space-y-4 mt-0'>
                  <FormField
                    control={form.control}
                    name='name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de l'établissement *</FormLabel>
                        <FormControl>
                          <Input placeholder='Le Petit Bistro' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='logo_url'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL du logo</FormLabel>
                        <FormControl>
                          <Input placeholder='https://...' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className='grid grid-cols-2 gap-4'>
                    <FormField
                      control={form.control}
                      name='email'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type='email' placeholder='contact@restaurant.com' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='phone'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Téléphone</FormLabel>
                          <FormControl>
                            <Input placeholder='+33 1 23 45 67 89' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className='grid grid-cols-2 gap-4'>
                    <FormField
                      control={form.control}
                      name='color'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Couleur</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder='Choisir une couleur'>
                                  {field.value && (
                                    <div className='flex items-center gap-2'>
                                      <div 
                                        className='w-4 h-4 rounded-full border' 
                                        style={{ backgroundColor: field.value }}
                                      />
                                      <span>
                                        {RESTAURANT_COLORS.find(c => c.value === field.value)?.label || field.value}
                                      </span>
                                    </div>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {RESTAURANT_COLORS.map((color) => (
                                <SelectItem key={color.value} value={color.value}>
                                  <div className='flex items-center gap-2'>
                                    <div 
                                      className='w-4 h-4 rounded-full border' 
                                      style={{ backgroundColor: color.value }}
                                    />
                                    <span>{color.label}</span>
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
                      name='is_active'
                      render={({ field }) => (
                        <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3 h-[42px] mt-8'>
                          <FormLabel className='text-sm'>Actif</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className='grid grid-cols-3 gap-4'>
                    <FormField
                      control={form.control}
                      name='country'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pays</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder='Pays' />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {COUNTRIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='language'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Langue</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder='Langue' />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {LANGUAGES.map((l) => (
                                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='currency'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Devise</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder='Devise' />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CURRENCIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* Onglet Localisation */}
                <TabsContent value='location' className='space-y-4 mt-0'>
                  <FormField
                    control={form.control}
                    name='address'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse</FormLabel>
                        <FormControl>
                          <Input placeholder='123 Rue de la Paix' {...field} />
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
                            <Input placeholder='75001' {...field} />
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
                            <Input placeholder='Paris' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name='website'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site web</FormLabel>
                        <FormControl>
                          <Input placeholder='https://www.restaurant.com' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className='grid grid-cols-2 gap-4'>
                    <FormField
                      control={form.control}
                      name='instagram'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instagram</FormLabel>
                          <FormControl>
                            <Input placeholder='@restaurant' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='facebook'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Facebook</FormLabel>
                          <FormControl>
                            <Input placeholder='facebook.com/restaurant' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* Onglet Légal */}
                <TabsContent value='legal' className='space-y-4 mt-0'>
                  <FormField
                    control={form.control}
                    name='siret'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SIRET</FormLabel>
                        <FormControl>
                          <Input placeholder='123 456 789 00012' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='tva_number'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro de TVA</FormLabel>
                        <FormControl>
                          <Input placeholder='FR12345678901' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Onglet Communication */}
                <TabsContent value='communication' className='space-y-4 mt-0'>
                  <div className='space-y-4'>
                    <h4 className='font-medium'>Paramètres Email</h4>
                    
                    <FormField
                      control={form.control}
                      name='email_signature_enabled'
                      render={({ field }) => (
                        <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                          <div>
                            <FormLabel className='text-sm'>Signature électronique</FormLabel>
                            <FormDescription className='text-xs'>
                              Activer la signature dans les emails
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='email_signature_text'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Texte de signature</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="L'équipe du Restaurant" 
                              className='min-h-[80px]'
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='email_tracking_enabled'
                      render={({ field }) => (
                        <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                          <div>
                            <FormLabel className='text-sm'>Suivi des ouvertures</FormLabel>
                            <FormDescription className='text-xs'>
                              Suivre l'ouverture des emails
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className='space-y-4 pt-4 border-t'>
                    <h4 className='font-medium'>Paramètres SMS</h4>
                    
                    <FormField
                      control={form.control}
                      name='sms_name'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom SMS</FormLabel>
                          <FormControl>
                            <Input placeholder='MonRestaurant' maxLength={11} {...field} />
                          </FormControl>
                          <FormDescription className='text-xs'>
                            Maximum 11 caractères, sans espaces
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='sms_signature'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Signature SMS</FormLabel>
                          <FormControl>
                            <Input placeholder='Restaurant + email' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <DialogFooter className='mt-4'>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {restaurant ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
