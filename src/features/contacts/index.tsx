import { useEffect, useMemo, useCallback, useState } from 'react'
import { Cross2Icon } from '@radix-ui/react-icons'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { type SortingState } from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import { type DateRange } from 'react-day-picker'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfigDrawer } from '@/components/config-drawer'
import { DateFilter, FacetedFilter } from '@/components/data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { SortSelect, parseSortValue } from '@/components/sort-select'
import { ThemeSwitch } from '@/components/theme-switch'
import { ContactsTable } from './components/contacts-table'
import { CreateContactDialog } from './components/create-contact-dialog'
import { useContacts, useOrganizationUsers } from './hooks/use-contacts'

export function Contacts() {
  const search = useSearch({ from: '/_authenticated/contacts/' })
  const navigate = useNavigate({ from: '/contacts' })

  const dateRange: DateRange | undefined = search.from
    ? {
        from: new Date(search.from),
        to: search.to ? new Date(search.to) : undefined,
      }
    : undefined

  const setSearch = useCallback(
    (updates: Record<string, string | undefined>) => {
      navigate({
        search: (prev: Record<string, unknown>) => {
          const next = { ...prev, ...updates } as Record<string, unknown>
          Object.keys(next).forEach((k) => {
            if (next[k] === undefined || next[k] === '') delete next[k]
          })
          return next
        },
        replace: true,
      })
    },
    [navigate]
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

  const onResetFilters = useCallback(() => {
    setSearchValue('')
    setSelectedCommercials(new Set())
    setSelectedCompanies(new Set())
    setSelectedSources(new Set())
    navigate({
      search: () => ({}) as Record<string, unknown>,
      replace: true,
    })
  }, [navigate])

  // Input local immédiat ; le filtrage et la sync URL utilisent la valeur débouncée
  // pour ne pas re-render toute la page à chaque frappe.
  const [searchValue, setSearchValue] = useState(search.q || '')
  const debouncedSearchValue = useDebouncedValue(searchValue)
  useEffect(() => {
    if ((debouncedSearchValue || '') === (search.q || '')) return
    setSearch({ q: debouncedSearchValue || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue])

  const [selectedCommercials, setSelectedCommercials] = useState<Set<string>>(
    new Set()
  )
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(
    new Set()
  )
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [sortValue, setSortValue] = useState('created_at:desc')
  const tableSorting: SortingState = useMemo(
    () => [parseSortValue(sortValue)],
    [sortValue]
  )

  const contactSortOptions = [
    { label: 'Date de création (récent)', value: 'created_at:desc' },
    { label: 'Date de création (ancien)', value: 'created_at:asc' },
    { label: 'Nom (A-Z)', value: 'first_name:asc' },
    { label: 'Nom (Z-A)', value: 'first_name:desc' },
    { label: 'Source', value: 'source:asc' },
  ]

  const { data: contacts = [], isLoading: isLoadingContacts } = useContacts()
  const { data: users = [] } = useOrganizationUsers()

  const sourceOptions = useMemo(() => {
    const sources = new Set(
      contacts.map((c) => c.source).filter(Boolean) as string[]
    )
    return Array.from(sources)
      .sort()
      .map((s) => ({ label: s, value: s }))
  }, [contacts])

  // Options de filtre derivees des societes presentes dans les contacts charges :
  // pertinent (seules les societes ayant un contact) et borne (pas de cap 1000).
  const companyOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of contacts as any[]) {
      if (c.company?.id && c.company?.name)
        map.set(c.company.id, c.company.name)
    }
    return Array.from(map, ([value, label]) => ({ label, value })).sort(
      (a, b) => a.label.localeCompare(b.label)
    )
  }, [contacts])

  const hasActiveFilters = !!(
    search.q ||
    search.from ||
    search.to ||
    selectedCommercials.size ||
    selectedSources.size
  )

  const filteredContacts = useMemo(() => {
    let result = contacts

    if (dateRange?.from) {
      const fromDate = new Date(dateRange.from)
      fromDate.setHours(0, 0, 0, 0)
      result = result.filter(
        (c) => c.created_at && new Date(c.created_at) >= fromDate
      )
    }

    if (dateRange?.to) {
      const toDate = new Date(dateRange.to)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter(
        (c) => c.created_at && new Date(c.created_at) <= toDate
      )
    }

    if (debouncedSearchValue) {
      const q = debouncedSearchValue.toLowerCase()
      result = result.filter(
        (c: any) =>
          (c.first_name || '').toLowerCase().includes(q) ||
          (c.last_name || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.company?.name || '').toLowerCase().includes(q)
      )
    }

    if (selectedCommercials.size > 0) {
      result = result.filter(
        (c: any) => c.assigned_to && selectedCommercials.has(c.assigned_to)
      )
    }

    if (selectedCompanies.size > 0) {
      result = result.filter(
        (c: any) => c.company_id && selectedCompanies.has(c.company_id)
      )
    }

    if (selectedSources.size > 0) {
      result = result.filter(
        (c: any) => c.source && selectedSources.has(c.source)
      )
    }

    return result
  }, [
    contacts,
    dateRange,
    debouncedSearchValue,
    selectedCommercials,
    selectedCompanies,
    selectedSources,
  ])

  const isLoading = isLoadingContacts

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
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            placeholder='Rechercher par nom, contact ou email...'
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
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
              options={users.map((u) => ({
                label: `${u.first_name} ${u.last_name}`,
                value: u.id,
              }))}
              selected={selectedCommercials}
              onSelectionChange={setSelectedCommercials}
            />
            <FacetedFilter
              title='Société'
              options={companyOptions}
              selected={selectedCompanies}
              onSelectionChange={setSelectedCompanies}
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
            <SortSelect
              options={contactSortOptions}
              value={sortValue}
              onChange={setSortValue}
            />
            <CreateContactDialog iconOnly />
          </div>
        </div>

        <ContactsTable data={filteredContacts} sorting={tableSorting} />
      </Main>
    </>
  )
}
