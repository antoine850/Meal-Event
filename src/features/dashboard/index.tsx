import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { GeneralTab } from './components/general-tab'
import { CommercialTab } from './components/commercial-tab'
import { MarketingTab } from './components/marketing-tab'
import { ReservationsTab } from './components/reservations-tab'
import { CalendarDays, Download } from 'lucide-react'

const tabs = [
  { value: 'general', label: 'Vue d\'ensemble' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'reservations', label: 'Réservations' },
]

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('general')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className='flex flex-col h-full'>
      {/* ===== Top Heading ===== */}
      <Header>
        <h1 className='text-lg font-semibold'>Dashboard</h1>

        {/* Desktop: Tabs */}
        <TabsList className='ml-4 bg-transparent hidden lg:flex'>
          {tabs.map(tab => (
            <TabsTrigger 
              key={tab.value} 
              value={tab.value} 
              className='data-[state=active]:bg-muted'
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className='mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <h2 className='text-2xl font-bold tracking-tight'>👋 Bonjour, Antoine !</h2>
          <div className='flex items-center space-x-2'>
            <Button variant='outline'>
              <CalendarDays className='mr-2 h-4 w-4' />
              Janvier 2024
            </Button>
            <Button>
              <Download className='mr-2 h-4 w-4' />
              Exporter
            </Button>
          </div>
        </div>
        
        {/* Mobile: Dropdown tabs */}
        <div className='mb-4 lg:hidden'>
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className='w-[180px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tabs.map(tab => (
                <SelectItem key={tab.value} value={tab.value}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TabsContent value='general' className='space-y-4 mt-0'>
          <GeneralTab />
        </TabsContent>
        <TabsContent value='commercial' className='space-y-4 mt-0'>
          <CommercialTab />
        </TabsContent>
        <TabsContent value='marketing' className='space-y-4 mt-0'>
          <MarketingTab />
        </TabsContent>
        <TabsContent value='reservations' className='space-y-4 mt-0'>
          <ReservationsTab />
        </TabsContent>
      </Main>
    </Tabs>
  )
}

