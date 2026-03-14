import { useState } from 'react'
import { type DateRange } from 'react-day-picker'
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
import { ThemeSwitch } from '@/components/theme-switch'
import { DateFilter } from '@/components/data-table/date-filter'
import { FacetedFilter } from '@/components/data-table/standalone-faceted-filter'
import { GeneralTab } from './components/general-tab'
import { CommercialTab } from './components/commercial-tab'
import { MarketingTab } from './components/marketing-tab'
import { ReservationsTab } from './components/reservations-tab'
import { useDashboardData, type DashboardFilters } from './hooks/use-dashboard-data'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

const tabs = [
  { value: 'general', label: 'Vue d\'ensemble' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'reservations', label: 'Événements' },
]

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('general')

  // Filters state
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set())
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())
  const [selectedCommercials, setSelectedCommercials] = useState<Set<string>>(new Set())
  const [selectedClientType, setSelectedClientType] = useState<Set<string>>(new Set())

  const filters: DashboardFilters = {
    dateRange: dateRange?.from && dateRange?.to ? { from: dateRange.from, to: dateRange.to } : undefined,
    restaurants: selectedRestaurants,
    statuses: selectedStatuses,
    commercials: selectedCommercials,
    clientType: selectedClientType,
  }

  const { bookings, contacts, restaurants, users, statuses, isAdmin, userName, isLoading } = useDashboardData(filters)

  const hasFilters = !!dateRange || selectedRestaurants.size > 0 || selectedStatuses.size > 0 || selectedCommercials.size > 0 || selectedClientType.size > 0

  const resetFilters = () => {
    setDateRange(undefined)
    setSelectedRestaurants(new Set())
    setSelectedStatuses(new Set())
    setSelectedCommercials(new Set())
    setSelectedClientType(new Set())
  }

  const restaurantOptions = restaurants.map(r => ({ label: r.name, value: r.id }))
  const statusOptions = statuses.map(s => ({ label: s.name, value: s.id }))
  const commercialOptions = users.map(u => ({ label: `${u.first_name} ${u.last_name}`, value: u.id }))
  const clientTypeOptions = [
    { label: 'B2B (Entreprise)', value: 'b2b' },
    { label: 'B2C (Particulier)', value: 'b2c' },
  ]

  const tabProps = { bookings, contacts, restaurants, users, isLoading }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className='flex flex-col h-full'>
      {/* ===== Top Heading ===== */}
      <Header fixed>
        <h1 className='text-lg font-semibold'>Tableau de bord</h1>

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
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className='mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <h2 className='text-2xl font-bold tracking-tight whitespace-nowrap'>
            👋 Bonjour{userName ? `, ${userName}` : ''} !
          </h2>

          {/* Filters */}
          <div className='flex flex-wrap items-center gap-2 justify-end'>
            <DateFilter
              value={dateRange}
              onChange={setDateRange}
              placeholder='Période'
            />
            <FacetedFilter
              title='Restaurant'
              options={restaurantOptions}
              selected={selectedRestaurants}
              onSelectionChange={setSelectedRestaurants}
            />
            <FacetedFilter
              title='Statut'
              options={statusOptions}
              selected={selectedStatuses}
              onSelectionChange={setSelectedStatuses}
            />
            {isAdmin && (
              <FacetedFilter
                title='Commercial'
                options={commercialOptions}
                selected={selectedCommercials}
                onSelectionChange={setSelectedCommercials}
              />
            )}
            <FacetedFilter
              title='Type client'
              options={clientTypeOptions}
              selected={selectedClientType}
              onSelectionChange={setSelectedClientType}
            />
            {hasFilters && (
              <Button variant='ghost' size='sm' className='h-8 px-2' onClick={resetFilters}>
                <RotateCcw className='mr-1 h-3 w-3' />
                Réinitialiser
              </Button>
            )}
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
          <GeneralTab {...tabProps} />
        </TabsContent>
        <TabsContent value='commercial' className='space-y-4 mt-0'>
          <CommercialTab {...tabProps} />
        </TabsContent>
        <TabsContent value='marketing' className='space-y-4 mt-0'>
          <MarketingTab {...tabProps} />
        </TabsContent>
        <TabsContent value='reservations' className='space-y-4 mt-0'>
          <ReservationsTab {...tabProps} />
        </TabsContent>
      </Main>
    </Tabs>
  )
}
