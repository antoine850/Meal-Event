import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Key, Copy, Check, AlertTriangle } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { ContentSection } from '../components/content-section'
import { useOrganization, useUpdateOrganization, useGenerateApiKey, useRevokeApiKey } from '../hooks/use-settings'

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

      {/* API Key Section */}
      {organization && <ApiKeySection organizationId={organization.id} apiKeyPrefix={organization.api_key_prefix} lastUsedAt={organization.api_key_last_used_at} />}
    </ContentSection>
  )
}

function ApiKeySection({ organizationId, apiKeyPrefix, lastUsedAt }: { organizationId: string; apiKeyPrefix: string | null; lastUsedAt: string | null }) {
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { mutate: generateKey, isPending: isGenerating } = useGenerateApiKey()
  const { mutate: revokeKey, isPending: isRevoking } = useRevokeApiKey()

  const handleGenerate = () => {
    generateKey(organizationId, {
      onSuccess: (data) => {
        setGeneratedKey(data.api_key)
        toast.success('Cl\u00e9 API g\u00e9n\u00e9r\u00e9e')
      },
      onError: () => {
        toast.error('Erreur lors de la g\u00e9n\u00e9ration')
      },
    })
  }

  const handleRevoke = () => {
    revokeKey(organizationId, {
      onSuccess: () => {
        toast.success('Cl\u00e9 API r\u00e9voqu\u00e9e')
      },
      onError: () => {
        toast.error('Erreur lors de la r\u00e9vocation')
      },
    })
  }

  const handleCopy = async () => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <>
      <Card className='mt-6'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Key className='h-5 w-5' />
            Cl\u00e9 API
          </CardTitle>
          <CardDescription>
            Utilisez une cl\u00e9 API pour int\u00e9grer votre CRM avec des services tiers (Zapier, Make, apps mobiles, sites web).
            Les requ\u00eates s'authentifient via le header <code className='text-xs bg-muted px-1 py-0.5 rounded'>Authorization: Bearer sk_live_xxx</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeyPrefix ? (
            <div className='space-y-4'>
              <div className='flex items-center justify-between rounded-lg border p-4'>
                <div>
                  <p className='text-sm font-medium'>Cl\u00e9 active</p>
                  <p className='text-sm text-muted-foreground font-mono'>{apiKeyPrefix}</p>
                  {lastUsedAt && (
                    <p className='text-xs text-muted-foreground mt-1'>
                      Derni\u00e8re utilisation : {new Date(lastUsedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className='flex gap-2'>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant='outline' size='sm'>
                        Reg\u00e9n\u00e9rer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reg\u00e9n\u00e9rer la cl\u00e9 API ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          L'ancienne cl\u00e9 sera imm\u00e9diatement invalid\u00e9e. Toutes les int\u00e9grations utilisant l'ancienne cl\u00e9 cesseront de fonctionner.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleGenerate} disabled={isGenerating}>
                          {isGenerating && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                          Reg\u00e9n\u00e9rer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant='destructive' size='sm'>
                        R\u00e9voquer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>R\u00e9voquer la cl\u00e9 API ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          La cl\u00e9 sera d\u00e9finitivement supprim\u00e9e. Toutes les int\u00e9grations cesseront de fonctionner.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRevoke} disabled={isRevoking} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
                          {isRevoking && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                          R\u00e9voquer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ) : (
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              <Key className='mr-2 h-4 w-4' />
              G\u00e9n\u00e9rer une cl\u00e9 API
            </Button>
          )}

          <div className='mt-4 text-xs text-muted-foreground'>
            <p>Documentation des endpoints disponibles :</p>
            <ul className='list-disc list-inside mt-1 space-y-0.5'>
              <li><code className='bg-muted px-1 rounded'>GET /api/v1/restaurants</code> — Lister les restaurants</li>
              <li><code className='bg-muted px-1 rounded'>GET /api/v1/contacts</code> — Lister les contacts</li>
              <li><code className='bg-muted px-1 rounded'>POST /api/v1/contacts</code> — Cr\u00e9er un contact</li>
              <li><code className='bg-muted px-1 rounded'>GET /api/v1/bookings</code> — Lister les \u00e9v\u00e9nements</li>
              <li><code className='bg-muted px-1 rounded'>POST /api/v1/bookings</code> — Cr\u00e9er un \u00e9v\u00e9nement</li>
              <li><code className='bg-muted px-1 rounded'>GET /api/v1/quotes</code> — Lister les devis</li>
              <li><code className='bg-muted px-1 rounded'>GET /api/v1/payments</code> — Lister les paiements</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Dialog showing the generated key */}
      <Dialog open={!!generatedKey} onOpenChange={() => setGeneratedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Votre cl\u00e9 API</DialogTitle>
            <DialogDescription>
              Copiez cette cl\u00e9 maintenant. Elle ne sera plus affich\u00e9e apr\u00e8s fermeture de cette fen\u00eatre.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='flex items-center gap-2'>
              <code className='flex-1 bg-muted p-3 rounded text-sm font-mono break-all'>
                {generatedKey}
              </code>
              <Button variant='outline' size='icon' onClick={handleCopy}>
                {copied ? <Check className='h-4 w-4 text-green-600' /> : <Copy className='h-4 w-4' />}
              </Button>
            </div>
            <div className='flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200'>
              <AlertTriangle className='h-4 w-4 text-yellow-600 mt-0.5 shrink-0' />
              <p className='text-xs text-yellow-800'>
                Conservez cette cl\u00e9 en lieu s\u00fbr. Elle ne pourra plus \u00eatre affich\u00e9e. Si vous la perdez, vous devrez en g\u00e9n\u00e9rer une nouvelle.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
