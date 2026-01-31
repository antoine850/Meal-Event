import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar, CalendarDays, CalendarRange, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { CalendarView } from './components/calendar-view'
import { reservations } from './data/reservations'

type ViewMode = 'month' | 'week' | 'day'

export function Reservations() {
  const [viewMode, setViewMode] = useState<ViewMode>('month')

  const handleAddReservation = (date: Date) => {
    toast.info(`Nouvelle réservation`, {
      description: `Créer une réservation pour le ${format(date, 'EEEE d MMMM yyyy', { locale: fr })}`,
      action: {
        label: 'Créer',
        onClick: () => {
          toast.success('Formulaire de réservation ouvert')
        },
      },
    })
  }

  return (
    <>
      <Header fixed>
        <h1 className='text-lg font-semibold'>Réservations</h1>
        <div className='ms-auto flex items-center space-x-2 sm:space-x-4'>
          <ToggleGroup 
            type='single' 
            value={viewMode} 
            onValueChange={(value) => value && setViewMode(value as ViewMode)}
            className='hidden sm:flex'
          >
            <ToggleGroupItem value='month' aria-label='Vue mois' className='px-2 sm:px-3 gap-1'>
              <CalendarRange className='h-4 w-4' />
              <span className='hidden md:inline'>30 jours</span>
            </ToggleGroupItem>
            <ToggleGroupItem value='week' aria-label='Vue semaine' className='px-2 sm:px-3 gap-1'>
              <CalendarDays className='h-4 w-4' />
              <span className='hidden md:inline'>7 jours</span>
            </ToggleGroupItem>
            <ToggleGroupItem value='day' aria-label='Vue jour' className='px-2 sm:px-3 gap-1'>
              <Calendar className='h-4 w-4' />
              <span className='hidden md:inline'>Journée</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <Button size='sm' className='hidden sm:flex'>
            <Plus className='mr-2 h-4 w-4' />
            <span className='hidden md:inline'>Nouvelle réservation</span>
            <span className='md:hidden'>Nouveau</span>
          </Button>
          <Button size='icon' className='sm:hidden h-8 w-8'>
            <Plus className='h-4 w-4' />
          </Button>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col overflow-hidden'>
        <CalendarView 
          reservations={reservations} 
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAddReservation={handleAddReservation}
        />
      </Main>
    </>
  )
}
