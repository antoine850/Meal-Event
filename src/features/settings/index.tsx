import { useState } from 'react'
import { Building2, Clock, MapPin, Store, Tags } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { OrganizationSettings } from './organization'
import { RestaurantsSettings } from './restaurants'
import { SpacesSettings } from './spaces'
import { TimeSlotsSettings } from './time-slots'
import { StatusesSettings } from './statuses'

export function Settings() {
  const [activeTab, setActiveTab] = useState('organization')

  return (
    <>
      <Header>
        <h1 className='text-2xl font-bold tracking-tight'>Paramètres</h1>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <Tabs value={activeTab} onValueChange={setActiveTab} className='flex-1 flex flex-col'>
          <TabsList className='w-full justify-start h-auto flex-wrap gap-1 bg-transparent p-0'>
            <TabsTrigger value='organization' className='gap-2 data-[state=active]:bg-muted'>
              <Building2 className='h-4 w-4' />
              Organisation
            </TabsTrigger>
            <TabsTrigger value='restaurants' className='gap-2 data-[state=active]:bg-muted'>
              <Store className='h-4 w-4' />
              Restaurants
            </TabsTrigger>
            <TabsTrigger value='spaces' className='gap-2 data-[state=active]:bg-muted'>
              <MapPin className='h-4 w-4' />
              Espaces
            </TabsTrigger>
            <TabsTrigger value='time-slots' className='gap-2 data-[state=active]:bg-muted'>
              <Clock className='h-4 w-4' />
              Créneaux
            </TabsTrigger>
            <TabsTrigger value='statuses' className='gap-2 data-[state=active]:bg-muted'>
              <Tags className='h-4 w-4' />
              Statuts
            </TabsTrigger>
          </TabsList>

          <div className='flex-1 mt-4'>
            <TabsContent value='organization' className='m-0 h-full'>
              <OrganizationSettings />
            </TabsContent>
            <TabsContent value='restaurants' className='m-0 h-full'>
              <RestaurantsSettings />
            </TabsContent>
            <TabsContent value='spaces' className='m-0 h-full'>
              <SpacesSettings />
            </TabsContent>
            <TabsContent value='time-slots' className='m-0 h-full'>
              <TimeSlotsSettings />
            </TabsContent>
            <TabsContent value='statuses' className='m-0 h-full'>
              <StatusesSettings />
            </TabsContent>
          </div>
        </Tabs>
      </Main>
    </>
  )
}
