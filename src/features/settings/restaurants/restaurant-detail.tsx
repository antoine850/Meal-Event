import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUpdateRestaurant, type Restaurant } from '../hooks/use-settings'

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

const restaurantDetailSchema = z.object({
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
  language: z.string().optional(),
  currency: z.string().optional(),
  siret: z.string().optional(),
  tva_number: z.string().optional(),
  website: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  email_signature_enabled: z.boolean().optional(),
  email_signature_text: z.string().optional(),
  email_tracking_enabled: z.boolean().optional(),
  sms_name: z.string().optional(),
  sms_signature: z.string().optional(),
})

type RestaurantDetailFormData = z.infer<typeof restaurantDetailSchema>

interface RestaurantDetailProps {
  restaurant: Restaurant
}

export function RestaurantDetail({ restaurant }: RestaurantDetailProps) {
  const { mutate: updateRestaurant, isPending } = useUpdateRestaurant()

  const form = useForm<RestaurantDetailFormData>({
    resolver: zodResolver(restaurantDetailSchema),
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
    const r = restaurant as Record<string, unknown>
    form.reset({
      name: restaurant.name,
      email: restaurant.email || '',
      phone: restaurant.phone || '',
      address: restaurant.address || '',
      city: (r.city as string) || '',
      postal_code: (r.postal_code as string) || '',
      country: (r.country as string) || 'France',
      color: restaurant.color || '#3b82f6',
      logo_url: (r.logo_url as string) || '',
      is_active: restaurant.is_active,
      language: (r.language as string) || 'fr',
      currency: (r.currency as string) || 'EUR',
      siret: (r.siret as string) || '',
      tva_number: (r.tva_number as string) || '',
      website: (r.website as string) || '',
      instagram: (r.instagram as string) || '',
      facebook: (r.facebook as string) || '',
      email_signature_enabled: (r.email_signature_enabled as boolean) ?? true,
      email_signature_text: (r.email_signature_text as string) || '',
      email_tracking_enabled: (r.email_tracking_enabled as boolean) ?? true,
      sms_name: (r.sms_name as string) || '',
      sms_signature: (r.sms_signature as string) || '',
    })
  }, [restaurant, form])

  const onSubmit = (data: RestaurantDetailFormData) => {
    updateRestaurant(
      { id: restaurant.id, ...data },
      {
        onSuccess: () => toast.success('Restaurant mis à jour'),
        onError: () => toast.error('Erreur lors de la mise à jour'),
      }
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button variant='ghost' size='icon' asChild>
            <Link to='/settings/restaurants'>
              <ArrowLeft className='h-4 w-4' />
            </Link>
          </Button>
          <div className='flex items-center gap-3'>
            <div 
              className='w-10 h-10 rounded-full border-2' 
              style={{ backgroundColor: restaurant.color || '#3b82f6' }}
            />
            <div>
              <h1 className='text-2xl font-bold'>{restaurant.name}</h1>
              <p className='text-sm text-muted-foreground'>{restaurant.email}</p>
            </div>
          </div>
        </div>
        <Button type='submit' form='restaurant-form' disabled={isPending}>
          {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          <Save className='mr-2 h-4 w-4' />
          Enregistrer
        </Button>
      </div>

      <Form {...form}>
        <form id='restaurant-form' onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs defaultValue='general' className='w-full'>
            <TabsList className='grid w-full grid-cols-5'>
              <TabsTrigger value='general'>Général</TabsTrigger>
              <TabsTrigger value='location'>Localisation</TabsTrigger>
              <TabsTrigger value='web'>Web</TabsTrigger>
              <TabsTrigger value='legal'>Légal</TabsTrigger>
              <TabsTrigger value='communication'>Communication</TabsTrigger>
            </TabsList>

            {/* Onglet Général */}
            <TabsContent value='general'>
              <Card>
                <CardContent className='pt-6 space-y-4'>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
                        <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3 mt-8'>
                          <FormLabel className='text-sm'>Établissement actif</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Onglet Localisation */}
            <TabsContent value='location'>
              <Card>
                <CardContent className='pt-6 space-y-4'>
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

                  <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
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
                  </div>

                  <Separator />

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
                </CardContent>
              </Card>
            </TabsContent>

            {/* Onglet Web */}
            <TabsContent value='web'>
              <Card>
                <CardContent className='pt-6 space-y-4'>
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
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
                </CardContent>
              </Card>
            </TabsContent>

            {/* Onglet Légal */}
            <TabsContent value='legal'>
              <Card>
                <CardContent className='pt-6 space-y-4'>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Onglet Communication */}
            <TabsContent value='communication'>
              <Card>
                <CardContent className='pt-6 space-y-6'>
                  <div className='space-y-4'>
                    <h4 className='font-medium'>Email</h4>
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

                  <Separator />

                  <div className='space-y-4'>
                    <h4 className='font-medium'>SMS</h4>
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  )
}
