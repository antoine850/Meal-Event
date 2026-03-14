import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2, LogIn, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const signUpSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  first_name: z.string().min(1, 'Le prénom est requis'),
  last_name: z.string().optional(),
  phone: z.string().optional(),
})

const signInSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
})

const profileSchema = z.object({
  first_name: z.string().min(1, 'Le prénom est requis'),
  last_name: z.string().optional(),
  phone: z.string().optional(),
})

type SignUpFormData = z.infer<typeof signUpSchema>
type SignInFormData = z.infer<typeof signInSchema>
type ProfileFormData = z.infer<typeof profileSchema>

export function AcceptInvite() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { token?: string }
  const token = search.token || ''

  const [status, setStatus] = useState<'loading' | 'auth' | 'profile' | 'accepting' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [invitationEmail, setInvitationEmail] = useState('')
  const [orgName, setOrgName] = useState('')

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', first_name: '', last_name: '', phone: '' },
  })

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: '', last_name: '', phone: '' },
  })

  // Fetch invitation info (no auth required — direct Supabase query on public fields)
  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage("Token d'invitation manquant")
      return
    }

    const init = async () => {
      // Fetch invitation details via public API (no auth required)
      let inv: { email: string; status: string; expires_at: string; organization_name: string | null; is_expired: boolean }
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
        const response = await fetch(`${API_URL}/api/invitations/${token}`)
        if (!response.ok) {
          setStatus('error')
          setErrorMessage('Invitation invalide ou expirée')
          return
        }
        inv = await response.json()
      } catch {
        setStatus('error')
        setErrorMessage('Erreur de connexion au serveur')
        return
      }

      if (inv.status !== 'pending') {
        setStatus('error')
        setErrorMessage('Invitation invalide ou déjà utilisée')
        return
      }

      if (inv.is_expired) {
        setStatus('error')
        setErrorMessage('Cette invitation a expiré')
        return
      }

      setInvitationEmail(inv.email)
      setOrgName(inv.organization_name || 'Organisation')
      signUpForm.setValue('email', inv.email)
      signInForm.setValue('email', inv.email)

      // Check if user is already authenticated
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        // User is logged in — check if email matches
        if (session.user.email?.toLowerCase() === inv.email.toLowerCase()) {
          // Email matches — check if user already has a profile
          const { data: existingUser } = await supabase
            .from('users')
            .select('id, organization_id')
            .eq('id', session.user.id)
            .single()

          if (existingUser && existingUser.organization_id) {
            // Already has profile — accept directly
            await acceptInvitation(token)
          } else {
            // Needs profile info
            setStatus('profile')
          }
        } else {
          // Logged in with different email — sign out first
          await supabase.auth.signOut()
          setStatus('auth')
        }
      } else {
        setStatus('auth')
      }
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const acceptInvitation = async (invToken: string, profileData?: { first_name: string; last_name?: string; phone?: string }) => {
    setStatus('accepting')
    try {
      await apiClient('/api/members/accept-invite', {
        method: 'POST',
        body: { token: invToken, ...profileData },
      })
      setStatus('success')
      toast.success("Bienvenue dans l'organisation !")
    } catch (err: any) {
      setStatus('error')
      setErrorMessage(err.message || "Erreur lors de l'acceptation")
    }
  }

  const handleSignUp = async (values: SignUpFormData) => {
    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
          data: {
            first_name: values.first_name,
            last_name: values.last_name,
          },
        },
      })

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Cet email est déjà enregistré. Connectez-vous plutôt.')
          return
        }
        throw error
      }

      // After sign up, try to accept immediately (Supabase might auto-confirm)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await acceptInvitation(token, {
          first_name: values.first_name,
          last_name: values.last_name,
          phone: values.phone,
        })
      } else {
        // Email confirmation required — tell user to check email
        toast.success('Vérifiez votre email pour confirmer votre compte, puis revenez sur ce lien.')
        setStatus('error')
        setErrorMessage('Vérifiez votre email pour confirmer votre compte, puis cliquez à nouveau sur le lien d\'invitation.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création du compte')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignIn = async (values: SignInFormData) => {
    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })

      if (error) throw error

      // Check if email matches invitation
      if (values.email.toLowerCase() !== invitationEmail.toLowerCase()) {
        await supabase.auth.signOut()
        toast.error("Cet email ne correspond pas à l'invitation")
        return
      }

      // Check if user already has a profile
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session non trouvée')

      const { data: existingUser } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('id', session.user.id)
        .single()

      if (existingUser && existingUser.organization_id) {
        await acceptInvitation(token)
      } else {
        setStatus('profile')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur de connexion')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleProfileSubmit = async (values: ProfileFormData) => {
    setIsSubmitting(true)
    try {
      await acceptInvitation(token, values)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='min-h-svh bg-muted/30 flex flex-col'>
      <header className='border-b bg-background px-6 py-4'>
        <Link to='/sign-in' className='flex items-center gap-2 hover:opacity-80 transition-opacity'>
          <Logo className='h-8 w-8' />
          <span className='text-xl font-bold'>MealEvent</span>
        </Link>
      </header>

      <main className='flex-1 flex items-center justify-center p-6'>
        <Card className='w-full max-w-lg'>
          {status === 'loading' && (
            <CardContent className='flex items-center justify-center py-16'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </CardContent>
          )}

          {status === 'accepting' && (
            <CardContent className='flex flex-col items-center justify-center py-16 gap-3'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>Traitement en cours...</p>
            </CardContent>
          )}

          {status === 'auth' && (
            <>
              <CardHeader>
                <div className='mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10'>
                  <UserPlus className='h-6 w-6 text-primary' />
                </div>
                <CardTitle className='text-center'>Rejoindre {orgName}</CardTitle>
                <CardDescription className='text-center'>
                  Vous avez été invité(e) à rejoindre <strong>{orgName}</strong> sur MealEvent.
                  {invitationEmail && (
                    <span className='block mt-1 text-xs'>
                      Invitation pour : <strong>{invitationEmail}</strong>
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue='signin' className='w-full'>
                  <TabsList className='grid w-full grid-cols-2'>
                    <TabsTrigger value='signin'>
                      <LogIn className='h-3.5 w-3.5 mr-1.5' />
                      Se connecter
                    </TabsTrigger>
                    <TabsTrigger value='signup'>
                      <UserPlus className='h-3.5 w-3.5 mr-1.5' />
                      Créer un compte
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value='signin' className='mt-4'>
                    <Form {...signInForm}>
                      <form onSubmit={signInForm.handleSubmit(handleSignIn)} className='space-y-4'>
                        <FormField
                          control={signInForm.control}
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
                          control={signInForm.control}
                          name='password'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mot de passe</FormLabel>
                              <FormControl>
                                <Input type='password' {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type='submit' className='w-full' disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
                          Se connecter et rejoindre
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>

                  <TabsContent value='signup' className='mt-4'>
                    <Form {...signUpForm}>
                      <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className='space-y-4'>
                        <FormField
                          control={signUpForm.control}
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
                          control={signUpForm.control}
                          name='password'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mot de passe</FormLabel>
                              <FormControl>
                                <Input type='password' placeholder='8 caractères minimum' {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className='grid grid-cols-2 gap-4'>
                          <FormField
                            control={signUpForm.control}
                            name='first_name'
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
                            control={signUpForm.control}
                            name='last_name'
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
                          control={signUpForm.control}
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
                        <Button type='submit' className='w-full' disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
                          Créer mon compte et rejoindre
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}

          {status === 'profile' && (
            <>
              <CardHeader>
                <div className='mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10'>
                  <UserPlus className='h-6 w-6 text-primary' />
                </div>
                <CardTitle className='text-center'>Complétez votre profil</CardTitle>
                <CardDescription className='text-center'>
                  Quelques informations pour finaliser votre inscription à <strong>{orgName}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4'>
                      <FormField
                        control={profileForm.control}
                        name='first_name'
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
                        name='last_name'
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
                    <Button type='submit' className='w-full' disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
                      Rejoindre l'organisation
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </>
          )}

          {status === 'success' && (
            <>
              <CardHeader className='text-center'>
                <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900'>
                  <Check className='h-8 w-8 text-green-600 dark:text-green-400' />
                </div>
                <CardTitle>Bienvenue !</CardTitle>
                <CardDescription>
                  Vous avez rejoint <strong>{orgName}</strong> avec succès.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => navigate({ to: '/', replace: true })}
                  className='w-full'
                >
                  Accéder au tableau de bord
                </Button>
              </CardContent>
            </>
          )}

          {status === 'error' && (
            <>
              <CardHeader className='text-center'>
                <CardTitle className='text-destructive'>Erreur</CardTitle>
                <CardDescription>{errorMessage}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant='outline'
                  onClick={() => navigate({ to: '/sign-in' })}
                  className='w-full'
                >
                  Retour à la connexion
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  )
}
