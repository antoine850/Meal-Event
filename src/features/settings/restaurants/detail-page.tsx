import { useParams, Link } from '@tanstack/react-router'
import { Loader2, ArrowLeft } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { RestaurantDetail } from './restaurant-detail'
import { useRestaurants } from '../hooks/use-settings'
import { Button } from '@/components/ui/button'

export function RestaurantDetailPage() {
  const { id } = useParams({ from: '/_authenticated/settings/restaurant/$id' })
  const { data: restaurants = [], isLoading } = useRestaurants()
  
  const restaurant = restaurants.find(r => r.id === id)

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
          <h1 className='text-2xl font-bold tracking-tight'>Restaurant non trouvé</h1>
        </Header>
        <Main className='flex flex-1 flex-col items-center justify-center'>
          <p className='text-muted-foreground'>Ce restaurant n'existe pas ou a été supprimé.</p>
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
              className='w-8 h-8 rounded-full border-2' 
              style={{ backgroundColor: restaurant.color || '#3b82f6' }}
            />
            <h1 className='text-xl font-bold tracking-tight'>{restaurant.name}</h1>
          </div>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col'>
        <RestaurantDetail restaurant={restaurant} />
      </Main>
    </>
  )
}
