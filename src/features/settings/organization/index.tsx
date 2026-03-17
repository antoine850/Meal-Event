import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Separator } from '@/components/ui/separator'
import { ContentSection } from '../components/content-section'
import { useOrganization, useUpdateOrganization } from '../hooks/use-settings'

const organizationSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  slug: z.string().min(1, 'Le slug est requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  siret: z.string().optional(),
  tva_number: z.string().optional(),
  facturation_email: z.string().email('Email invalide').optional().or(z.literal('')),
  meta_pixel_id: z.string().optional(),
  meta_conversions_token: z.string().optional(),
})

type OrganizationFormData = z.infer<typeof organizationSchema>

export function OrganizationSettings() {
  const { data: organization, isLoading } = useOrganization()
  const { mutate: updateOrganization, isPending } = useUpdateOrganization()

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    values: {
      name: organization?.name || '',
      slug: organization?.slug || '',
      email: organization?.email || '',
      phone: organization?.phone || '',
      address: organization?.address || '',
      website: organization?.website || '',
      siret: organization?.siret || '',
      tva_number: organization?.tva_number || '',
      facturation_email: organization?.facturation_email || '',
      meta_pixel_id: organization?.meta_pixel_id || '',
      meta_conversions_token: organization?.meta_conversions_token || '',
    },
  })

  const onSubmit = (data: OrganizationFormData) => {
    updateOrganization(data, {
      onSuccess: () => {
        toast.success('Organisation mise à jour')
      },
      onError: () => {
        toast.error('Erreur lors de la mise à jour')
      },
    })
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-10'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <ContentSection
      title='Organisation'
      desc='Gérez les informations de votre organisation.'
    >
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>
            Ces informations apparaîtront sur vos documents (devis, factures, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de l'organisation *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='slug'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identifiant (slug) *</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                        <Input type='email' {...field} />
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='facturation_email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de facturation (reply-to)</FormLabel>
                    <FormControl>
                      <Input type='email' placeholder='facturation@votreorganisation.com' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='address'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='website'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site web</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='siret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SIRET</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator className='my-2' />

              {/* Meta / Facebook Tracking */}
              <div>
                <h3 className='text-sm font-medium mb-1'>Tracking Facebook (Meta)</h3>
                <p className='text-xs text-muted-foreground mb-3'>
                  Connectez votre Meta Pixel pour tracker automatiquement les conversions formulaire via la Conversions API.
                </p>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='meta_pixel_id'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meta Pixel ID</FormLabel>
                      <FormControl>
                        <Input placeholder='123456789012345' {...field} />
                      </FormControl>
                      <FormDescription>
                        Trouvable dans Meta Events Manager &gt; Paramètres
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='meta_conversions_token'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conversions API Token</FormLabel>
                      <FormControl>
                        <Input type='password' placeholder='EAAGxxxxx...' {...field} />
                      </FormControl>
                      <FormDescription>
                        Généré dans Events Manager &gt; Paramètres &gt; Conversions API
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='flex justify-end'>
                <Button type='submit' disabled={isPending}>
                  {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  Enregistrer
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </ContentSection>
  )
}
