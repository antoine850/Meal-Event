import { createFileRoute, Link } from '@tanstack/react-router'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Logo } from '@/assets/logo'

type PaymentSearchParams = {
  type?: 'deposit' | 'balance' | 'full'
  booking?: string
  status?: 'cancelled'
}

export const Route = createFileRoute('/payment-success')({
  validateSearch: (search: Record<string, unknown>): PaymentSearchParams => ({
    type: search.type as PaymentSearchParams['type'],
    booking: search.booking as string | undefined,
    status: search.status as PaymentSearchParams['status'],
  }),
  component: PaymentSuccessPage,
})

function PaymentSuccessPage() {
  const { type, status } = Route.useSearch()

  const isCancelled = status === 'cancelled'

  const typeLabels: Record<string, string> = {
    deposit: 'Acompte',
    balance: 'Solde',
    full: 'Paiement intégral',
  }

  const paymentLabel = type ? typeLabels[type] || type : 'Paiement'

  return (
    <div className='flex min-h-screen flex-col bg-gray-50'>
      <header className='border-b bg-white px-6 py-4'>
        <Link to='/sign-in' className='inline-flex items-center gap-2 hover:opacity-80 transition-opacity'>
          <Logo className='h-8 w-8' />
          <span className='text-xl font-bold'>MealEvent</span>
        </Link>
      </header>

      <div className='flex flex-1 items-center justify-center p-6'>
      <div className='w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg'>
        {isCancelled ? (
          <>
            <div className='mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100'>
              <XCircle className='h-12 w-12 text-orange-500' />
            </div>
            <h1 className='mb-2 text-2xl font-bold text-gray-900'>
              Paiement annulé
            </h1>
            <p className='mb-6 text-gray-600'>
              Le paiement n'a pas été effectué. Vous pouvez réessayer en
              utilisant le lien de paiement reçu par email.
            </p>
          </>
        ) : (
          <>
            <div className='mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100'>
              <CheckCircle2 className='h-12 w-12 text-green-500' />
            </div>
            <h1 className='mb-2 text-2xl font-bold text-gray-900'>
              Merci pour votre paiement !
            </h1>
            <p className='mb-6 text-gray-600'>
              Votre {paymentLabel.toLowerCase()} a bien été enregistré.
              Vous recevrez une confirmation par email.
            </p>
          </>
        )}

        <div className='rounded-lg bg-gray-50 p-4'>
          <p className='text-sm text-gray-500'>
            Vous pouvez fermer cette page
          </p>
        </div>

        <p className='mt-6 text-xs text-gray-400'>MealEvent</p>
      </div>
      </div>
    </div>
  )
}
