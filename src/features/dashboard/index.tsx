import { useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { RotateCcw } from 'lucide-react'
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
} from './hooks/use-dashboard-data'

const tabs = [
  { value: 'general', label: "Vue d'ensemble" },
  { value: 'commercial', label: 'Commercial' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'reservations', label: 'Événements' },
]

// Helpers pour convertir entre Set et chaîne CSV dans l'URL
function toSet(csv: string | undefined): Set<string> {
  if (!csv) return new Set()
  return new Set(csv.split(',').filter(Boolean))
}

function toCsv(set: Set<string>): string | undefined {
  if (set.size === 0) return undefined
  return [...set].join(',')
}

export function Dashboard() {
  const navigate = useNavigate({ from: '/' })
  const search = useSearch({ strict: false }) as {
    tab?: 'general' | 'commercial' | 'marketing' | 'reservations'
    fromEvent?: string
    toEvent?: string
    fromSign?: string
    toSign?: string
    fromImport?: string
    toImport?: string
    restaurants?: string
    statuses?: string
    commercials?: string
    clientType?: string
  }

  const activeTab = search.tab ?? 'general'

  const toDateRange = (from?: string, to?: string) => {
    if (!from || !to) return undefined
    return { from: new Date(from), to: new Date(to) }
  }
  const toIso = (d?: Date) => d?.toISOString().slice(0, 10)

  const eventDateRange = useMemo(
    () => toDateRange(search.fromEvent, search.toEvent),
    [search.fromEvent, search.toEvent]
  )
  const signDateRange = useMemo(
    () => toDateRange(search.fromSign, search.toSign),
    [search.fromSign, search.toSign]
  )
  const importDateRange = useMemo(
    () => toDateRange(search.fromImport, search.toImport),
    [search.fromImport, search.toImport]
  )

  const selectedRestaurants = useMemo(
    () => toSet(search.restaurants),
    [search.restaurants]
  )
  const selectedStatuses = useMemo(
    () => toSet(search.statuses),
    [search.statuses]
  )
  const selectedCommercials = useMemo(
    () => toSet(search.commercials),
    [search.commercials]
  )
  const selectedClientType = useMemo(
    () => toSet(search.clientType),
    [search.clientType]
  )

  const setSearch = (patch: Partial<typeof search>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  const setActiveTab = (tab: string) =>
    setSearch({ tab: tab as typeof search.tab })

  const setEventDateRange = (range: { from?: Date; to?: Date } | undefined) =>
    setSearch({ fromEvent: toIso(range?.from), toEvent: toIso(range?.to) })
  const setSignDateRange = (range: { from?: Date; to?: Date } | undefined) =>
    setSearch({ fromSign: toIso(range?.from), toSign: toIso(range?.to) })
  const setImportDateRange = (range: { from?: Date; to?: Date } | undefined) =>
    setSearch({ fromImport: toIso(range?.from), toImport: toIso(range?.to) })

  const setSelectedRestaurants = (s: Set<string>) =>
    setSearch({ restaurants: toCsv(s) })
  const setSelectedStatuses = (s: Set<string>) =>
    setSearch({ statuses: toCsv(s) })
  const setSelectedCommercials = (s: Set<string>) =>
    setSearch({ commercials: toCsv(s) })
  const setSelectedClientType = (s: Set<string>) =>
    setSearch({ clientType: toCsv(s) })

  const filters: DashboardFilters = useMemo(
    () => ({
      eventDateRange,
      signDateRange,
      importDateRange,
      restaurants: selectedRestaurants,
      statuses: selectedStatuses,
      commercials: selectedCommercials,
      clientType: selectedClientType,
    }),
    [
      eventDateRange,
      signDateRange,
      importDateRange,
      selectedRestaurants,
      selectedStatuses,
      selectedCommercials,
      selectedClientType,
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
    !!eventDateRange ||
    !!signDateRange ||
    !!importDateRange ||
    selectedRestaurants.size > 0 ||
    selectedStatuses.size > 0 ||
    selectedCommercials.size > 0 ||
    selectedClientType.size > 0

  const resetFilters = () =>
    setSearch({
      fromEvent: undefined,
      toEvent: undefined,
      fromSign: undefined,
      toSign: undefined,
      fromImport: undefined,
      toImport: undefined,
      restaurants: undefined,
      statuses: undefined,
      commercials: undefined,
      clientType: undefined,
    })

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
        <div className='mb-4 space-y-3'>
          <h2 className='text-2xl font-bold tracking-tight'>
            👋 Bonjour{userName ? `, ${userName}` : ''} !
          </h2>

          {/* Filters */}
          <div className='flex flex-wrap items-center gap-2'>
            <DateFilter
              value={eventDateRange}
              onChange={setEventDateRange}
              placeholder="Date d'événement"
            />
            <DateFilter
              value={signDateRange}
              onChange={setSignDateRange}
              placeholder='Date de signature'
            />
            <DateFilter
              value={importDateRange}
              onChange={setImportDateRange}
              placeholder="Date d'import"
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
