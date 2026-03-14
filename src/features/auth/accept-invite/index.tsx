import { useState, useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2, UserPlus } from 'lucide-react'
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

const profileSchema = z.object({
  first_name: z.string().min(1, 'Le prénom est requis'),
  last_name: z.string().optional(),
  phone: z.string().optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

export function AcceptInvite() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { token?: string }
  const token = search.token || ''

  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: '', last_name: '', phone: '' },
  })

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Token d\'invitation manquant')
      return
    }

    // Check if user is authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // User needs to sign in first — redirect to sign-in with redirect back here
        navigate({
          to: '/sign-in',
          search: { redirect: `/accept-invite?token=${token}` },
        })
        return
      }

      // Check if user already has a profile (already in an org)
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('id', session.user.id)
        .single()

      if (existingUser && existingUser.organization_id) {
        // User already in an org — try to accept directly
        try {
          await apiClient('/api/members/accept-invite', {
            method: 'POST',
            body: { token },
          })
          setStatus('success')
        } catch (err: any) {
          setStatus('error')
          setErrorMessage(err.message || 'Erreur lors de l\'acceptation')
        }
        return
      }

      // Show profile form for new users
      setStatus('form')
    }

    checkAuth()
  }, [token, navigate])

  const handleSubmit = async (values: ProfileFormData) => {
    setIsSubmitting(true)
    try {
      await apiClient('/api/members/accept-invite', {
        method: 'POST',
        body: { token, ...values },
      })
      setStatus('success')
      toast.success('Bienvenue dans l\'organisation !')
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'acceptation')
      setErrorMessage(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='min-h-svh bg-muted/30 flex flex-col'>
      <header className='border-b bg-background px-6 py-4'>
        <div className='flex items-center gap-2'>
          <Logo className='h-8 w-8' />
          <span className='text-xl font-bold'>MealEvent</span>
        </div>
      </header>

      <main className='flex-1 flex items-center justify-center p-6'>
        <Card className='w-full max-w-lg'>
          {status === 'loading' && (
            <CardContent className='flex items-center justify-center py-16'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </CardContent>
          )}

          {status === 'form' && (
            <>
              <CardHeader>
                <div className='mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10'>
                  <UserPlus className='h-6 w-6 text-primary' />
                </div>
                <CardTitle className='text-center'>Complétez votre profil</CardTitle>
                <CardDescription className='text-center'>
                  Quelques informations pour finaliser votre inscription
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4'>
                      <FormField
                        control={form.control}
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
                        control={form.control}
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
                      control={form.control}
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
                  Vous avez rejoint l'organisation avec succès.
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
