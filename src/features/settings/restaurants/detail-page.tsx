import { useEffect } from 'react'
import { useParams, useSearch, useRouter, Link } from '@tanstack/react-router'
import { Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useRestaurants } from '../hooks/use-settings'
import { StripeConnectSection } from './components/stripe-connect-section'
import { RestaurantDetail } from './restaurant-detail'

export function RestaurantDetailPage() {
  const { id } = useParams({ from: '/_authenticated/settings/restaurant/$id' })
  const search = useSearch({ from: '/_authenticated/settings/restaurant/$id' })
  const router = useRouter()
  const { data: restaurants = [], isLoading } = useRestaurants()

  const restaurant = restaurants.find((r) => r.id === id)

  // Gestion du retour OAuth Stripe
  useEffect(() => {
    if (search.stripe_success === 1) {
      toast.success('Compte Stripe connecté avec succès')
      router.navigate({
        to: '/settings/restaurant/$id',
        params: { id },
        search: {},
        replace: true,
      })
    } else if (search.stripe_error) {
      toast.error(`Erreur Stripe : ${search.stripe_error}`)
      router.navigate({
        to: '/settings/restaurant/$id',
        params: { id },
        search: {},
        replace: true,
      })
    }
  }, [search.stripe_success, search.stripe_error, id, router])

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <>
        <Header>
          <h1 className='text-2xl font-bold tracking-tight'>
            Restaurant non trouvé
          </h1>
        </Header>
        <Main className='flex flex-1 flex-col items-center justify-center'>
          <p className='text-muted-foreground'>
            Ce restaurant n'existe pas ou a été supprimé.
          </p>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header>
        <div className='flex items-center gap-4'>
          <Button variant='ghost' size='icon' asChild className='-ml-2'>
            <Link to='/settings/restaurants'>
              <ArrowLeft className='h-4 w-4' />
            </Link>
          </Button>
          <div className='flex items-center gap-3'>
            <div
              className='h-8 w-8 rounded-full border-2'
              style={{ backgroundColor: restaurant.color || '#3b82f6' }}
            />
            <Header fixed>
              <h1 className='text-lg font-semibold'>{restaurant.name}</h1>
            </Header>
          </div>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col'>
        <StripeConnectSection restaurant={restaurant} />
        <RestaurantDetail restaurant={restaurant} />
      </Main>
    </>
  )
}
