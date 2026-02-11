import { AuthLayout } from '../auth-layout'
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  return (
    <AuthLayout
      title='Créer un compte'
      subtitle='Commencez votre essai gratuit de 14 jours'
    >
      <SignUpForm />
      <p className='text-center text-sm text-muted-foreground'>
        En créant un compte, vous acceptez nos{' '}
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
