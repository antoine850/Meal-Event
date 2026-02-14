import { useParams, Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useBooking } from '../hooks/use-bookings'
import { BookingDetail } from './booking-detail'

export function BookingDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const { data: booking, isLoading } = useBooking(id)

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4'>
        <p className='text-muted-foreground'>Événement introuvable</p>
        <Button asChild variant='outline'>
          <Link to='/reservations'>Retour aux événements</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <Header fixed>
        <Button variant='ghost' size='sm' asChild className='gap-2'>
          <Link to='/reservations'>
            <ArrowLeft className='h-4 w-4' />
            Événements
          </Link>
        </Button>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      <Main className='flex flex-1 flex-col'>
        <BookingDetail booking={booking} />
      </Main>
    </>
  )
}
