import { useSearch } from '@tanstack/react-router'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout
      title='Connexion'
      subtitle='Entrez vos identifiants pour accéder à votre compte'
    >
      <UserAuthForm redirectTo={redirect} />
      <p className='text-center text-sm text-muted-foreground'>
        En vous connectant, vous acceptez nos{' '}
        <a
          href='/terms'
          className='underline underline-offset-4 hover:text-primary'
        >
          Conditions d'utilisation
        </a>{' '}
        et notre{' '}
        <a
          href='/privacy'
          className='underline underline-offset-4 hover:text-primary'
        >
          Politique de confidentialité
        </a>
        .
      </p>
    </AuthLayout>
  )
}
