import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Save, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useBlocker, useNavigate, useSearch } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
import { ImageUpload } from '@/components/ui/image-upload'
import { useUpdateRestaurant, useSpaces, useDeleteSpace, type Restaurant, type Space } from '../hooks/use-settings'
import { SpaceDialog } from '../spaces/space-dialog'

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
  phone: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Numéro de téléphone invalide').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  color: z.string().optional(),
  logo_url: z.string().optional(),
  is_active: z.boolean(),
  language: z.string().optional(),
  translation_language: z.string().optional(),
  currency: z.string().optional(),
  siret: z.string().optional(),
  tva_number: z.string().optional(),
  website: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  notification_emails: z.string().optional().refine(val => {
    if (!val) return true;
    const emails = val.split(',').map(e => e.trim()).filter(e => e.length > 0);
    return emails.every(e => z.string().email().safeParse(e).success);
  }, { message: 'Une ou plusieurs adresses email sont invalides' }),
  recap_emails: z.string().optional().refine(val => {
    if (!val) return true;
    const emails = val.split(',').map(e => e.trim()).filter(e => e.length > 0);
    return emails.every(e => z.string().email().safeParse(e).success);
  }, { message: 'Une ou plusieurs adresses email sont invalides' }),
  cc_export_emails: z.string().optional().refine(val => {
    if (!val) return true;
    const emails = val.split(',').map(e => e.trim()).filter(e => e.length > 0);
    return emails.every(e => z.string().email().safeParse(e).success);
  }, { message: 'Une ou plusieurs adresses email sont invalides' }),
  event_reminder_enabled: z.boolean().optional(),
  email_signature_enabled: z.boolean().optional(),
  email_signature_text: z.string().optional(),
  email_tracking_enabled: z.boolean().optional(),
  client_portal_background_url: z.string().optional(),
  sms_name: z.string().optional(),
  sms_signature: z.string().optional(),
  sms_signature_en: z.string().optional(),
  // Billing fields
  company_name: z.string().optional(),
  legal_form: z.string().optional(),
  siren: z.string().optional(),
  rcs: z.string().optional(),
  share_capital: z.string().optional(),
  billing_email: z.string().email('Email invalide').optional().or(z.literal('')),
  billing_phone: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Numéro de téléphone invalide').optional().or(z.literal('')),
  billing_address: z.string().optional(),
  billing_postal_code: z.string().optional(),
  billing_city: z.string().optional(),
  billing_country: z.string().optional(),
  billing_additional_text: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  invoice_prefix: z.string().optional(),
  quote_validity_days: z.number().optional(),
  invoice_due_days: z.number().optional(),
  payment_balance_days: z.number().optional(),
})

type RestaurantDetailFormData = z.infer<typeof restaurantDetailSchema>

interface RestaurantDetailProps {
  restaurant: Restaurant
}

export function RestaurantDetail({ restaurant }: RestaurantDetailProps) {
  const { mutate: updateRestaurant, isPending } = useUpdateRestaurant()
  const { data: allSpaces = [] } = useSpaces()
  const { mutate: deleteSpace } = useDeleteSpace()
  const restaurantSpaces = allSpaces.filter(s => s.restaurant_id === restaurant.id)
  const [editingSpace, setEditingSpace] = useState<(Space & { restaurant: { id: string; name: string } | null }) | null>(null)
  const [isSpaceDialogOpen, setIsSpaceDialogOpen] = useState(false)
  const [spaceToDelete, setSpaceToDelete] = useState<string | null>(null)

  // Tab persistence
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/settings/restaurant/$id' }) as any
  const currentTab = search.tab || 'general'

  const handleTabChange = (value: string) => {
    navigate({
      to: '/settings/restaurant/$id',
      params: { id: restaurant.id },
      search: (prev: any) => ({ ...prev, tab: value }),
      replace: true,
    })
  }

  const handleDeleteSpace = () => {
    if (!spaceToDelete) return
    deleteSpace(spaceToDelete, {
      onSuccess: () => {
        toast.success('Espace supprimé')
        setSpaceToDelete(null)
      },
      onError: () => toast.error('Erreur lors de la suppression'),
    })
  }

  const formValues = useMemo(() => {
    const r = restaurant as Record<string, unknown>
    return {
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
      translation_language: (r.translation_language as string) || '',
      currency: (r.currency as string) || 'EUR',
      siret: (r.siret as string) || '',
      tva_number: (r.tva_number as string) || '',
      website: (r.website as string) || '',
      instagram: (r.instagram as string) || '',
      facebook: (r.facebook as string) || '',
      notification_emails: Array.isArray(r.notification_emails) ? (r.notification_emails as string[]).join(', ') : '',
      recap_emails: Array.isArray(r.recap_emails) ? (r.recap_emails as string[]).join(', ') : '',
      cc_export_emails: Array.isArray(r.cc_export_emails) ? (r.cc_export_emails as string[]).join(', ') : '',
      event_reminder_enabled: (r.event_reminder_enabled as boolean) ?? false,
      email_signature_enabled: (r.email_signature_enabled as boolean) ?? true,
      email_signature_text: (r.email_signature_text as string) || '',
      email_tracking_enabled: (r.email_tracking_enabled as boolean) ?? true,
      client_portal_background_url: (r.client_portal_background_url as string) || '',
      sms_name: (r.sms_name as string) || '',
      sms_signature: (r.sms_signature as string) || '',
      sms_signature_en: (r.sms_signature_en as string) || '',
      company_name: (r.company_name as string) || '',
      legal_form: (r.legal_form as string) || '',
      siren: (r.siren as string) || '',
      rcs: (r.rcs as string) || '',
      share_capital: (r.share_capital as string) || '',
      billing_email: (r.billing_email as string) || '',
      billing_phone: (r.billing_phone as string) || '',
      billing_address: (r.billing_address as string) || '',
      billing_postal_code: (r.billing_postal_code as string) || '',
      billing_city: (r.billing_city as string) || '',
      billing_country: (r.billing_country as string) || 'France',
      billing_additional_text: (r.billing_additional_text as string) || '',
      iban: (r.iban as string) || '',
      bic: (r.bic as string) || '',
      invoice_prefix: (r.invoice_prefix as string) || '',
      quote_validity_days: (r.quote_validity_days as number) ?? 7,
      invoice_due_days: (r.invoice_due_days as number) ?? undefined,
      payment_balance_days: (r.payment_balance_days as number) ?? undefined,
    }
  }, [restaurant])

  const form = useForm<RestaurantDetailFormData>({
    resolver: zodResolver(restaurantDetailSchema),
    values: formValues,
  })

  // Block navigation if there are unsaved changes
  // Read isDirty via a getter so useBlocker always sees the latest value
  const blocker = useBlocker({
    condition: form.formState.isDirty,
  })

  useEffect(() => {
    if (blocker.status === 'blocked') {
      toast.warning('Modifications non enregistrées', {
        description: 'Voulez-vous vraiment quitter sans enregistrer ?',
        action: {
          label: 'Quitter',
          onClick: () => {
            blocker.proceed?.()
          },
        },
        cancel: {
          label: 'Rester',
          onClick: () => {
            blocker.reset?.()
          },
        },
        duration: 10000,
      })
    }
  }, [blocker.status, blocker])

  // Warn on browser close/refresh
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

  const onSubmit = (data: RestaurantDetailFormData) => {
    // Convert comma-separated strings to arrays for PostgreSQL
    const parseEmailList = (str: string | undefined): string[] | null => {
      if (!str || str.trim() === '') return null
      return str.split(',').map(e => e.trim()).filter(e => e.length > 0)
    }

    const payload = {
      ...data,
      notification_emails: parseEmailList(data.notification_emails),
      recap_emails: parseEmailList(data.recap_emails),
      cc_export_emails: parseEmailList(data.cc_export_emails),
    }

    updateRestaurant(
      { id: restaurant.id, ...payload },
      {
        onSuccess: () => toast.success('Restaurant mis à jour'),
        onError: () => toast.error('Erreur lors de la mise à jour'),
      }
    )
  }

  return (
    <div className='space-y-6'>
      <Form {...form}>
        <form id='restaurant-form' onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <Tabs value={currentTab} onValueChange={handleTabChange} className='w-full'>
            <div className='flex items-center justify-between gap-4 mb-6'>
              <TabsList className='grid grid-cols-3 w-[300px] sm:w-[400px]'>
                <TabsTrigger value='general'>Général</TabsTrigger>
                <TabsTrigger value='facturation'>Facturation</TabsTrigger>
                <TabsTrigger value='espaces'>Espaces</TabsTrigger>
              </TabsList>
              
              <Button type='submit' disabled={isPending || !form.formState.isDirty} className='hidden sm:flex'>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                <Save className='mr-2 h-4 w-4' />
                Enregistrer
              </Button>
            </div>

            {/* TAB: Général */}
            <TabsContent value='general' className='space-y-6'>
              {/* Informations générales */}
              <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
              <CardDescription>Les informations de base de l'établissement</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
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
                      <FormLabel>Logo</FormLabel>
                      <FormControl>
                        <div className='max-w-[100px]'>
                          <ImageUpload
                            value={field.value}
                            onChange={field.onChange}
                            folder='logos'
                            placeholder='Logo'
                            maxSizeMB={0.5}
                            maxWidthOrHeight={128}
                            aspectRatio='square'
                          />
                        </div>
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

          {/* Localisation */}
          <Card>
            <CardHeader>
              <CardTitle>Localisation</CardTitle>
              <CardDescription>Adresse et paramètres régionaux</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
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

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
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
                  name='translation_language'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Langue de traduction</FormLabel>
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

          {/* Liens web */}
          <Card>
            <CardHeader>
              <CardTitle>Liens web</CardTitle>
              <CardDescription>Site web et réseaux sociaux</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
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

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Listes de diffusion et rappels</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <FormField
                control={form.control}
                name='notification_emails'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Liste Notification Évènements</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="email1@example.com, email2@example.com" 
                        className='min-h-[60px]'
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className='text-xs'>
                      Séparez les emails par des virgules
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='recap_emails'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Liste Récapitulatif Évènements</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="email@example.com" 
                        className='min-h-[60px]'
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className='text-xs'>
                      Séparez les emails par des virgules
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='cc_export_emails'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Liste CC exports</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='event_reminder_enabled'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                    <div>
                      <FormLabel className='text-sm'>Rappel évènement</FormLabel>
                      <FormDescription className='text-xs'>
                        Activer les rappels automatiques
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Communication */}
          <Card>
            <CardHeader>
              <CardTitle>Communication</CardTitle>
              <CardDescription>Paramètres email et SMS</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
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
                      <FormLabel>Signature Email</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="L'équipe du Restaurant&#10;Adresse&#10;Email" 
                          className='min-h-[100px]'
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
                        <FormLabel className='text-sm'>Suivi des ouvertures des emails</FormLabel>
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
                      <FormLabel>Signature SMS 🇫🇷</FormLabel>
                      <FormControl>
                        <Input placeholder='Restaurant • email@example.com' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='sms_signature_en'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signature SMS 🇺🇸</FormLabel>
                      <FormControl>
                        <Input placeholder='Restaurant • email@example.com' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

              {/* Affichage */}
              <Card>
                <CardHeader>
                  <CardTitle>Affichage</CardTitle>
                  <CardDescription>Options d'affichage et portail client</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <FormField
                    control={form.control}
                    name='client_portal_background_url'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fond espace client</FormLabel>
                        <FormControl>
                          <ImageUpload
                        value={field.value}
                        onChange={field.onChange}
                        folder='backgrounds'
                        placeholder='Cliquez pour ajouter une image de fond'
                        maxSizeMB={2}
                        maxWidthOrHeight={1920}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
            </TabsContent>

            {/* TAB: Facturation */}
            <TabsContent value='facturation' className='space-y-6'>
              {/* Informations légales */}
              <Card>
                <CardHeader>
                  <CardTitle>Informations légales</CardTitle>
                  <CardDescription>SIRET et numéro de TVA</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
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

              {/* Facturation */}
              <Card>
                <CardHeader>
                  <CardTitle>Facturation</CardTitle>
                  <CardDescription>Paramètres de facturation</CardDescription>
                </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <FormField
                    control={form.control}
                    name='company_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Raison sociale</FormLabel>
                        <FormControl>
                          <Input placeholder='MAKE IT HAPPEN 2' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='legal_form'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forme juridique</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='Sélectionner' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='SAS'>SAS</SelectItem>
                            <SelectItem value='SARL'>SARL</SelectItem>
                            <SelectItem value='EURL'>EURL</SelectItem>
                            <SelectItem value='SA'>SA</SelectItem>
                            <SelectItem value='SCI'>SCI</SelectItem>
                            <SelectItem value='EI'>EI</SelectItem>
                            <SelectItem value='SASU'>SASU</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='siren'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SIREN</FormLabel>
                        <FormControl>
                          <Input placeholder='534 085 857 00041' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='rcs'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RCS</FormLabel>
                        <FormControl>
                          <Input placeholder='534 085 857 Nanterre B' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='share_capital'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capital social</FormLabel>
                        <FormControl>
                          <Input placeholder='3 992,00 euros' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='billing_email'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email facturation</FormLabel>
                        <FormControl>
                          <Input type='email' placeholder='facturation@example.com' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='billing_phone'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone facturation</FormLabel>
                        <FormControl>
                          <Input placeholder='+33 1 23 45 67 89' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

              <Separator />

              <div className='space-y-4'>
                <h4 className='font-medium'>Adresse de facturation</h4>
                <FormField
                  control={form.control}
                  name='billing_address'
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
                    name='billing_postal_code'
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
                    name='billing_city'
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
                    name='billing_country'
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
                            <SelectItem value='France'>France</SelectItem>
                            <SelectItem value='Belgique'>Belgique</SelectItem>
                            <SelectItem value='Suisse'>Suisse</SelectItem>
                            <SelectItem value='Luxembourg'>Luxembourg</SelectItem>
                            <SelectItem value='Canada'>Canada</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <FormField
                    control={form.control}
                    name='billing_additional_text'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Texte complémentaire</FormLabel>
                        <FormControl>
                          <Textarea placeholder='Texte additionnel pour les factures...' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='iban'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IBAN</FormLabel>
                        <FormControl>
                          <Input placeholder='FR76 3000 4031 2000 0108 0479 516' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='bic'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BIC</FormLabel>
                        <FormControl>
                          <Input placeholder='BNPAFRPPXXX' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <FormField
                    control={form.control}
                    name='invoice_prefix'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Préfixe</FormLabel>
                        <FormControl>
                          <Input placeholder='LAHAUT' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='quote_validity_days'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Échéance devis (jours)</FormLabel>
                        <FormControl>
                          <Input 
                            type='number' 
                            placeholder='7' 
                            {...field}
                            onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='invoice_due_days'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Échéance facture (jours)</FormLabel>
                        <FormControl>
                          <Input 
                            type='number' 
                            placeholder='30' 
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='payment_balance_days'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paiement du solde (jours)</FormLabel>
                        <FormControl>
                          <Input 
                            type='number' 
                            placeholder='15' 
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
            </CardContent>
          </Card>

              {/* Bouton de sauvegarde en bas */}
              <div className='flex justify-end'>
                <Button type='submit' disabled={isPending || !form.formState.isDirty} size='lg'>
                  {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  <Save className='mr-2 h-4 w-4' />
                  Enregistrer les modifications
                </Button>
              </div>
            </TabsContent>

            {/* TAB: Espaces */}
            <TabsContent value='espaces' className='space-y-6'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between'>
                  <div>
                    <CardTitle>Espaces</CardTitle>
                    <CardDescription>Espaces liés à ce restaurant</CardDescription>
                  </div>
                  <Button 
                    type='button' 
                    size='sm' 
                    onClick={() => {
                      setEditingSpace(null)
                      setIsSpaceDialogOpen(true)
                    }}
                  >
                    <Plus className='mr-2 h-4 w-4' />
                    Ajouter
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className='rounded-md border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead className='hidden md:table-cell'>Capacité</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className='w-[70px]'></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {restaurantSpaces.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className='text-center text-muted-foreground py-8'>
                              Aucun espace configuré
                            </TableCell>
                          </TableRow>
                        ) : (
                          restaurantSpaces.map((space) => (
                            <TableRow key={space.id}>
                              <TableCell className='font-medium'>{space.name}</TableCell>
                              <TableCell className='hidden md:table-cell'>{space.capacity ? `${space.capacity} pers.` : '-'}</TableCell>
                              <TableCell>
                                <Badge variant={space.is_active ? 'default' : 'secondary'}>
                                  {space.is_active ? 'Actif' : 'Inactif'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant='ghost' size='icon' className='h-8 w-8'>
                                      <MoreHorizontal className='h-4 w-4' />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align='end'>
                                    <DropdownMenuItem onClick={() => {
                                      setEditingSpace(space as any)
                                      setIsSpaceDialogOpen(true)
                                    }}>
                                      <Pencil className='mr-2 h-4 w-4' />
                                      Modifier
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className='text-destructive'
                                      onClick={() => setSpaceToDelete(space.id)}
                                    >
                                      <Trash2 className='mr-2 h-4 w-4' />
                                      Supprimer
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </Form>

      <SpaceDialog
        open={isSpaceDialogOpen}
        onOpenChange={setIsSpaceDialogOpen}
        space={editingSpace}
        defaultRestaurantId={restaurant.id}
      />

      <AlertDialog open={!!spaceToDelete} onOpenChange={(open) => !open && setSpaceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'espace</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet espace ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSpace}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
