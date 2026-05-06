import { useState, useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { type DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { DateFilter } from '@/components/data-table/date-filter'
import { FacetedFilter } from '@/components/data-table/standalone-faceted-filter'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { CommercialTab } from './components/commercial-tab'
import { GeneralTab } from './components/general-tab'
import { MarketingTab } from './components/marketing-tab'
import { ReservationsTab } from './components/reservations-tab'
import {
  useDashboardData,
  type DashboardFilters,
  type DashboardDateField,
} from './hooks/use-dashboard-data'

const tabs = [
  { value: 'general', label: "Vue d'ensemble" },
  { value: 'commercial', label: 'Commercial' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'reservations', label: 'Événements' },
]

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('general')

  // Filters state
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(
    new Set()
  )
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set()
  )
  const [selectedCommercials, setSelectedCommercials] = useState<Set<string>>(
    new Set()
  )
  const [selectedClientType, setSelectedClientType] = useState<Set<string>>(
    new Set()
  )

  // Date de référence par onglet :
  // - commercial → date de signature du devis
  // - reservations (événements) → date de l'événement
  // - marketing → date d'import (created_at du booking)
  // - general → date de l'événement (défaut)
  const dateField: DashboardDateField = useMemo(() => {
    if (activeTab === 'commercial') return 'signed_at'
    if (activeTab === 'marketing') return 'created_at'
    return 'event_date'
  }, [activeTab])

  const filters: DashboardFilters = useMemo(
    () => ({
      dateRange:
        dateRange?.from && dateRange?.to
          ? { from: dateRange.from, to: dateRange.to }
          : undefined,
      restaurants: selectedRestaurants,
      statuses: selectedStatuses,
      commercials: selectedCommercials,
      clientType: selectedClientType,
      dateField,
    }),
    [
      dateRange,
      selectedRestaurants,
      selectedStatuses,
      selectedCommercials,
      selectedClientType,
      dateField,
    ]
  )

  const {
    bookings,
    contacts,
    restaurants,
    users,
    statuses,
    isAdmin,
    userName,
    isLoading,
  } = useDashboardData(filters)

  const hasFilters =
    !!dateRange ||
    selectedRestaurants.size > 0 ||
    selectedStatuses.size > 0 ||
    selectedCommercials.size > 0 ||
    selectedClientType.size > 0

  const resetFilters = () => {
    setDateRange(undefined)
    setSelectedRestaurants(new Set())
    setSelectedStatuses(new Set())
    setSelectedCommercials(new Set())
    setSelectedClientType(new Set())
  }

  const restaurantOptions = restaurants.map((r) => ({
    label: r.name,
    value: r.id,
  }))
  const statusOptions = statuses.map((s) => ({ label: s.name, value: s.id }))
  const commercialOptions = users.map((u) => ({
    label: `${u.first_name} ${u.last_name}`,
    value: u.id,
  }))
  const clientTypeOptions = [
    { label: 'B2B (Entreprise)', value: 'b2b' },
    { label: 'B2C (Particulier)', value: 'b2c' },
  ]

  const tabProps = { bookings, contacts, restaurants, users, isLoading }

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className='flex h-full flex-col'
    >
      {/* ===== Top Heading ===== */}
      <Header fixed>
        <h1 className='text-lg font-semibold'>Tableau de bord</h1>

        {/* Desktop: Tabs */}
        <TabsList className='ml-4 hidden bg-transparent lg:flex'>
          {tabs.map((tab) => (
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
        <div className='mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center'>
          <h2 className='text-2xl font-bold tracking-tight whitespace-nowrap'>
            👋 Bonjour{userName ? `, ${userName}` : ''} !
          </h2>

          {/* Filters */}
          <div className='flex flex-wrap items-center justify-end gap-2'>
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
              <Button
                variant='ghost'
                size='sm'
                className='h-8 px-2'
                onClick={resetFilters}
              >
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
              {tabs.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TabsContent value='general' className='mt-0 space-y-4'>
          <GeneralTab {...tabProps} statuses={statuses} />
        </TabsContent>
        <TabsContent value='commercial' className='mt-0 space-y-4'>
          <CommercialTab {...tabProps} />
        </TabsContent>
        <TabsContent value='marketing' className='mt-0 space-y-4'>
          <MarketingTab {...tabProps} />
        </TabsContent>
        <TabsContent value='reservations' className='mt-0 space-y-4'>
          <ReservationsTab {...tabProps} />
        </TabsContent>
      </Main>
    </Tabs>
  )
}
