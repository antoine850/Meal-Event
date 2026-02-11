import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Check, ChevronRight, Loader2, User } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/assets/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'

const steps = [
  { id: 1, title: 'Profil', icon: User },
  { id: 2, title: 'Organisation', icon: Building2 },
  { id: 3, title: 'Terminé', icon: Check },
]

const profileSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  phone: z.string().optional(),
})

const organizationSchema = z.object({
  organizationName: z.string().min(1, "Le nom de l'organisation est requis"),
  organizationSlug: z.string().min(1, 'Le slug est requis').regex(/^[a-z0-9-]+$/, 'Uniquement des lettres minuscules, chiffres et tirets'),
})

type ProfileFormData = z.infer<typeof profileSchema>
type OrganizationFormData = z.infer<typeof organizationSchema>

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [profileData, setProfileData] = useState<ProfileFormData | null>(null)
  const navigate = useNavigate()

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
    },
  })

  const organizationForm = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      organizationName: '',
      organizationSlug: '',
    },
  })

  const handleProfileSubmit = (data: ProfileFormData) => {
    setProfileData(data)
    setCurrentStep(2)
  }

  const handleOrganizationSubmit = async (data: OrganizationFormData) => {
    if (!profileData) return
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non connecté')

      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: data.organizationName,
          slug: data.organizationSlug,
          email: user.email,
        } as never)
        .select()
        .single()

      if (orgError) throw orgError
      const organization = orgData as { id: string; name: string; slug: string }

      // Create admin role for this organization
      const { data: newRole, error: roleError } = await supabase
        .from('roles')
        .insert({
          organization_id: organization.id,
          name: 'Administrateur',
          slug: 'admin',
          is_default: true,
        } as never)
        .select()
        .single()

      if (roleError) throw roleError
      const roleId = (newRole as { id: string })?.id

      // Create user profile
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          organization_id: organization.id,
          role_id: roleId,
          email: user.email || '',
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone || null,
        } as never)

      if (userError) throw userError

      // Create default settings
      await supabase
        .from('settings')
        .insert({
          organization_id: organization.id,
        } as never)

      // Create default contact statuses
      const defaultStatuses = [
        { name: 'Nouveau', slug: 'nouveau', color: '#ef4444', type: 'contact', position: 1 },
        { name: 'Qualification', slug: 'qualification', color: '#f97316', type: 'contact', position: 2 },
        { name: 'Proposition', slug: 'proposition', color: '#eab308', type: 'contact', position: 3 },
        { name: 'Négociation', slug: 'negociation', color: '#84cc16', type: 'contact', position: 4 },
        { name: 'Confirmé / Fonction à faire', slug: 'confirme', color: '#22c55e', type: 'contact', position: 5 },
        { name: 'Fonction envoyée', slug: 'fonction_envoyee', color: '#14b8a6', type: 'contact', position: 6 },
        { name: 'A facturer', slug: 'a_facturer', color: '#3b82f6', type: 'contact', position: 7 },
        { name: 'Attente paiement', slug: 'attente_paiement', color: '#8b5cf6', type: 'contact', position: 8 },
        { name: 'Relance paiement', slug: 'relance_paiement', color: '#ec4899', type: 'contact', position: 9 },
        // Booking statuses
        { name: 'En attente', slug: 'pending', color: '#eab308', type: 'booking', position: 1 },
        { name: 'Confirmée', slug: 'confirmed', color: '#22c55e', type: 'booking', position: 2 },
        { name: 'Annulée', slug: 'cancelled', color: '#ef4444', type: 'booking', position: 3 },
      ]

      await supabase
        .from('statuses')
        .insert(defaultStatuses.map(s => ({ ...s, organization_id: organization.id })) as never)

      setCurrentStep(3)
      toast.success('Organisation créée avec succès !')
    } catch (error) {
      console.error('Onboarding error:', error)
      toast.error("Erreur lors de la création de l'organisation")
    } finally {
      setIsLoading(false)
    }
  }

  const handleComplete = () => {
    navigate({ to: '/', replace: true })
  }

  const progress = (currentStep / steps.length) * 100

  return (
    <div className='min-h-svh bg-muted/30 flex flex-col'>
      {/* Header */}
      <header className='border-b bg-background px-6 py-4'>
        <div className='flex items-center gap-2'>
          <Logo className='h-8 w-8' />
          <span className='text-xl font-bold'>MealEvent</span>
        </div>
      </header>

      {/* Progress */}
      <div className='border-b bg-background px-6 py-4'>
        <div className='mx-auto max-w-2xl'>
          <div className='flex items-center justify-between mb-2'>
            {steps.map((step, index) => (
              <div key={step.id} className='flex items-center'>
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= step.id
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-muted-foreground/30 text-muted-foreground'
                  }`}
                >
                  <step.icon className='h-5 w-5' />
                </div>
                <span className={`ml-2 text-sm font-medium hidden sm:block ${
                  currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <ChevronRight className='mx-4 h-5 w-5 text-muted-foreground/50' />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className='h-2' />
        </div>
      </div>

      {/* Content */}
      <main className='flex-1 flex items-center justify-center p-6'>
        <Card className='w-full max-w-lg'>
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle>Bienvenue ! 👋</CardTitle>
                <CardDescription>
                  Commençons par quelques informations sur vous.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4'>
                      <FormField
                        control={profileForm.control}
                        name='firstName'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prénom</FormLabel>
                            <FormControl>
                              <Input placeholder='Jean' {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileForm.control}
                        name='lastName'
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
                    <FormField
                      control={profileForm.control}
                      name='phone'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Téléphone (optionnel)</FormLabel>
                          <FormControl>
                            <Input placeholder='+33 6 12 34 56 78' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type='submit' className='w-full'>
                      Continuer <ChevronRight className='ml-2 h-4 w-4' />
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </>
          )}

          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle>Votre organisation 🏢</CardTitle>
                <CardDescription>
                  Créez votre espace de travail pour gérer vos restaurants.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...organizationForm}>
                  <form onSubmit={organizationForm.handleSubmit(handleOrganizationSubmit)} className='space-y-4'>
                    <FormField
                      control={organizationForm.control}
                      name='organizationName'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom de l'organisation</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder='Mon Groupe de Restaurants' 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e)
                                // Auto-generate slug
                                const slug = e.target.value
                                  .toLowerCase()
                                  .normalize('NFD')
                                  .replace(/[\u0300-\u036f]/g, '')
                                  .replace(/[^a-z0-9]+/g, '-')
                                  .replace(/^-|-$/g, '')
                                organizationForm.setValue('organizationSlug', slug)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={organizationForm.control}
                      name='organizationSlug'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Identifiant unique</FormLabel>
                          <FormControl>
                            <Input placeholder='mon-groupe' {...field} />
                          </FormControl>
                          <p className='text-xs text-muted-foreground'>
                            Utilisé dans l'URL : mealevent.com/<strong>{field.value || 'mon-groupe'}</strong>
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className='flex gap-3'>
                      <Button 
                        type='button' 
                        variant='outline' 
                        onClick={() => setCurrentStep(1)}
                        className='flex-1'
                      >
                        Retour
                      </Button>
                      <Button type='submit' className='flex-1' disabled={isLoading}>
                        {isLoading ? <Loader2 className='animate-spin' /> : 'Créer'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </>
          )}

          {currentStep === 3 && (
            <>
              <CardHeader className='text-center'>
                <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900'>
                  <Check className='h-8 w-8 text-green-600 dark:text-green-400' />
                </div>
                <CardTitle>Tout est prêt ! 🎉</CardTitle>
                <CardDescription>
                  Votre organisation a été créée avec succès. Vous pouvez maintenant commencer à utiliser MealEvent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleComplete} className='w-full'>
                  Accéder au tableau de bord
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  )
}
