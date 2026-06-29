import { useEffect, useMemo, useCallback, useState } from 'react'
import { Cross2Icon } from '@radix-ui/react-icons'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { type SortingState } from '@tanstack/react-table'
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
import {
  useContactsPaged,
  useContactFacetOptions,
  useOrganizationUsers,
} from './hooks/use-contacts'

const PAGE_SIZE = 50

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
    setPageIndex(0)
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

  const { data: users = [] } = useOrganizationUsers()
  const { data: facets } = useContactFacetOptions()

  const [pageIndex, setPageIndex] = useState(0)

  const fromIso = useMemo(() => {
    if (!dateRange?.from) return undefined
    const d = new Date(dateRange.from)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [dateRange?.from])
  const toIso = useMemo(() => {
    if (!dateRange?.to) return undefined
    const d = new Date(dateRange.to)
    d.setHours(23, 59, 59, 999)
    return d.toISOString()
  }, [dateRange?.to])

  const [sortField, sortDir] = sortValue.split(':') as [string, 'asc' | 'desc']

  const { data: paged, isFetching } = useContactsPaged({
    page: pageIndex,
    pageSize: PAGE_SIZE,
    search: debouncedSearchValue.trim() || undefined,
    commercialIds: selectedCommercials.size
      ? Array.from(selectedCommercials)
      : undefined,
    companyIds: selectedCompanies.size
      ? Array.from(selectedCompanies)
      : undefined,
    sources: selectedSources.size ? Array.from(selectedSources) : undefined,
    from: fromIso,
    to: toIso,
    sort: { field: sortField, dir: sortDir },
  })
  const rows = paged?.rows ?? []
  const total = paged?.total ?? 0

  // Toute modif de filtre / recherche / tri renvoie a la premiere page.
  useEffect(() => {
    setPageIndex(0)
  }, [
    debouncedSearchValue,
    selectedCommercials,
    selectedCompanies,
    selectedSources,
    fromIso,
    toIso,
    sortValue,
  ])

  const sourceOptions = useMemo(
    () => (facets?.sources ?? []).map((s) => ({ label: s, value: s })),
    [facets]
  )
  const companyOptions = useMemo(
    () =>
      (facets?.companies ?? []).map((c) => ({ label: c.name, value: c.id })),
    [facets]
  )

  const hasActiveFilters = !!(
    search.q ||
    search.from ||
    search.to ||
    selectedCommercials.size ||
    selectedCompanies.size ||
    selectedSources.size
  )

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

        <ContactsTable
          data={rows}
          total={total}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          pageSize={PAGE_SIZE}
          isLoading={isFetching}
          sorting={tableSorting}
        />
      </Main>
    </>
  )
}
