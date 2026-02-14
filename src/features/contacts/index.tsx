import { useMemo, useCallback, useState } from 'react'
import { type DateRange } from 'react-day-picker'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Kanban, LayoutGrid, Loader2, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DateFilter, FacetedFilter } from '@/components/data-table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { StatusCards } from './components/status-cards'
import { ContactsTable } from './components/contacts-table'
import { ContactsKanban } from './components/contacts-kanban'
import { ContactsCards } from './components/contacts-cards'
import { CreateContactDialog } from './components/create-contact-dialog'
import { useContacts, useContactStatuses, useOrganizationUsers, useRestaurantsList } from './hooks/use-contacts'

type ViewMode = 'table' | 'kanban' | 'cards'

export function Contacts() {
  const search = useSearch({ from: '/_authenticated/tasks/' })
  const navigate = useNavigate({ from: '/tasks' })

  const activeStatus = search.status || null
  const viewMode = (search.view || 'table') as ViewMode
  const dateRange: DateRange | undefined = search.from
    ? { from: new Date(search.from), to: search.to ? new Date(search.to) : undefined }
    : undefined

  const setSearch = useCallback(
    (updates: Record<string, string | undefined>) => {
      navigate({
        search: (prev: Record<string, unknown>) => {
          const next = { ...prev, ...updates }
          Object.keys(next).forEach(k => {
            if (next[k] === undefined || next[k] === '') delete next[k]
          })
          return next
        },
        replace: true,
      })
    },
    [navigate]
  )

  const setActiveStatus = useCallback(
    (status: string | null) => setSearch({ status: status || undefined }),
    [setSearch]
  )

  const setViewMode = useCallback(
    (mode: ViewMode) => setSearch({ view: mode === 'table' ? undefined : mode }),
    [setSearch]
  )

  const setDateRange = useCallback(
    (range: DateRange | undefined) => {
      setSearch({
        from: range?.from ? range.from.toISOString().split('T')[0] : undefined,
        to: range?.to ? range.to.toISOString().split('T')[0] : undefined,
      })
    },
    [setSearch]
  )

  const onSearchChange = useCallback(
    (value: string) => setSearch({ q: value || undefined }),
    [setSearch]
  )

  const onResetFilters = useCallback(
    () => {
      setSearchValue('')
      setSelectedCommercials(new Set())
      setSelectedRestaurants(new Set())
      setSelectedStatuses(new Set())
      setSelectedSources(new Set())
      navigate({
        search: {},
        replace: true,
      })
    },
    [navigate]
  )

  const [searchValue, setSearchValue] = useState(search.q || '')

  const [selectedCommercials, setSelectedCommercials] = useState<Set<string>>(new Set())
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set())
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())

  const { data: contacts = [], isLoading: isLoadingContacts } = useContacts()
  const { data: statuses = [], isLoading: isLoadingStatuses } = useContactStatuses()
  const { data: users = [] } = useOrganizationUsers()
  const { data: restaurants = [] } = useRestaurantsList()

  const sourceOptions = useMemo(() => {
    const sources = new Set(contacts.map(c => c.source).filter(Boolean) as string[])
    return Array.from(sources).sort().map(s => ({ label: s, value: s }))
  }, [contacts])

  const hasActiveFilters = !!(search.q || search.status || search.from || search.to || selectedCommercials.size || selectedRestaurants.size || selectedStatuses.size || selectedSources.size)

  const statusCounts = useMemo(() => {
    return statuses.map(status => ({
      value: status.slug,
      label: status.name,
      color: status.color || 'bg-gray-500',
      count: contacts.filter(c => c.status?.slug === status.slug).length,
    }))
  }, [statuses, contacts])

  const filteredContacts = useMemo(() => {
    let result = contacts
    
    if (activeStatus) {
      result = result.filter(c => c.status?.slug === activeStatus)
    }
    
    if (dateRange?.from) {
      const fromDate = new Date(dateRange.from)
      fromDate.setHours(0, 0, 0, 0)
      result = result.filter(c => new Date(c.created_at) >= fromDate)
    }
    
    if (dateRange?.to) {
      const toDate = new Date(dateRange.to)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter(c => new Date(c.created_at) <= toDate)
    }

    if (searchValue) {
      const q = searchValue.toLowerCase()
      result = result.filter(c => 
        (c.first_name || '').toLowerCase().includes(q) ||
        (c.last_name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.company?.name || '').toLowerCase().includes(q)
      )
    }

    if (selectedCommercials.size > 0) {
      result = result.filter(c => c.assigned_to && selectedCommercials.has(c.assigned_to))
    }

    if (selectedRestaurants.size > 0) {
      result = result.filter(c => {
        const rid = (c as Record<string, unknown>).restaurant_id as string | null
        return rid && selectedRestaurants.has(rid)
      })
    }

    if (selectedStatuses.size > 0) {
      result = result.filter(c => c.status?.slug && selectedStatuses.has(c.status.slug))
    }

    if (selectedSources.size > 0) {
      result = result.filter(c => c.source && selectedSources.has(c.source))
    }
    
    return result
  }, [activeStatus, contacts, dateRange, searchValue, selectedCommercials, selectedRestaurants, selectedStatuses, selectedSources])

  const isLoading = isLoadingContacts || isLoadingStatuses

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <>
      <Header fixed>
        <h1 className='text-lg font-semibold'>Contacts</h1>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <StatusCards 
          statuses={statusCounts} 
          activeStatus={activeStatus}
          onStatusClick={setActiveStatus}
        />

        <div className='flex flex-wrap items-center gap-2'>
          <Input
            placeholder='Rechercher par nom, contact ou email...'
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value)
              onSearchChange(e.target.value)
            }}
            className='h-8 w-full sm:w-[200px] lg:w-[250px]'
          />
          <div className='flex flex-wrap gap-2'>
            <DateFilter 
              value={dateRange} 
              onChange={setDateRange} 
              placeholder='Date de création'
            />
            <FacetedFilter
              title='Commercial'
              options={users.map(u => ({ label: `${u.first_name} ${u.last_name}`, value: u.id }))}
              selected={selectedCommercials}
              onSelectionChange={setSelectedCommercials}
            />
            <FacetedFilter
              title='Restaurant privilégié'
              options={restaurants.map(r => ({ label: r.name, value: r.id }))}
              selected={selectedRestaurants}
              onSelectionChange={setSelectedRestaurants}
            />
            <FacetedFilter
              title='Statut'
              options={statuses.map(s => ({ label: s.name, value: s.slug }))}
              selected={selectedStatuses}
              onSelectionChange={setSelectedStatuses}
            />
            <FacetedFilter
              title='Source'
              options={sourceOptions}
              selected={selectedSources}
              onSelectionChange={setSelectedSources}
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant='ghost'
              onClick={onResetFilters}
              className='h-8 px-2 lg:px-3'
            >
              Reset
              <Cross2Icon className='ms-2 h-4 w-4' />
            </Button>
          )}
          <div className='ml-auto flex items-center gap-2'>
            <ToggleGroup 
              type='single' 
              value={viewMode} 
              onValueChange={(value) => value && setViewMode(value as ViewMode)}
            >
              <ToggleGroupItem value='table' aria-label='Vue tableau' className='px-2'>
                <Table2 className='h-4 w-4' />
              </ToggleGroupItem>
              <ToggleGroupItem value='kanban' aria-label='Vue kanban' className='px-2'>
                <Kanban className='h-4 w-4' />
              </ToggleGroupItem>
              <ToggleGroupItem value='cards' aria-label='Vue cartes' className='px-2'>
                <LayoutGrid className='h-4 w-4' />
              </ToggleGroupItem>
            </ToggleGroup>
            <CreateContactDialog iconOnly />
          </div>
        </div>
        
        {viewMode === 'table' && (
          <ContactsTable data={filteredContacts} />
        )}
        {viewMode === 'kanban' && (
          <ContactsKanban data={filteredContacts} statuses={statusCounts} />
        )}
        {viewMode === 'cards' && (
          <ContactsCards data={filteredContacts} />
        )}
      </Main>
    </>
  )
}
