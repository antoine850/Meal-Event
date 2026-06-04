import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Cross2Icon } from '@radix-ui/react-icons'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { type SortingState } from '@tanstack/react-table'
import { Calendar as CalendarIcon, Columns3, List, Loader2 } from 'lucide-react'
import { type DateRange } from 'react-day-picker'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ConfigDrawer } from '@/components/config-drawer'
import { DateFilter, FacetedFilter } from '@/components/data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { SortSelect, parseSortValue } from '@/components/sort-select'
import { ThemeSwitch } from '@/components/theme-switch'
import { useOrganizationUsers } from '@/features/contacts/hooks/use-contacts'
import {
  SIGNED_SLUGS,
  getStaleProposals,
} from '@/features/dashboard/hooks/use-dashboard-data'
import { BookingsTable } from './components/bookings-table'
import { CalendarView } from './components/calendar-view'
import { CreateBookingDialog } from './components/create-booking-dialog'
import { ExportEventsDialog } from './components/export-events-dialog'
import { PipelineView } from './components/pipeline-view'
import {
  useBookings,
  useBookingStatuses,
  useRestaurants,
} from './hooks/use-bookings'
import { bookingToReservation } from './types'

type MainView = 'calendar' | 'list' | 'pipeline'
type CalendarMode = 'month' | 'week' | 'day'

export function Reservations() {
  const search = useSearch({ from: '/_authenticated/evenements/' })
  const navigate = useNavigate({ from: '/evenements' })

  // Derive state from URL search params
  // Vue par défaut : Liste + événements à venir (décision client)
  const mainView = (search.view || 'list') as MainView
  const calendarMode = (search.calendarMode || 'week') as CalendarMode
  const searchValue = search.q || ''

  // Date par défaut : aujourd'hui (pour afficher les événements à venir sur la vue liste)
  const defaultFrom = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const dateRange: DateRange | undefined = search.from
    ? {
        from: new Date(search.from),
        to: search.to ? new Date(search.to) : undefined,
      }
    : mainView === 'list' && search.from === undefined
      ? { from: defaultFrom, to: undefined }
      : undefined
  const selectedCommercials = useMemo(
    () => new Set(search.commercial ? search.commercial.split(',') : []),
    [search.commercial]
  )
  const selectedStatuses = useMemo(
    () => new Set(search.status ? search.status.split(',') : []),
    [search.status]
  )
  const selectedRestaurants = useMemo(
    () => new Set(search.restaurant ? search.restaurant.split(',') : []),
    [search.restaurant]
  )

  const toDateRange = (from?: string, to?: string) =>
    from
      ? { from: new Date(from), to: to ? new Date(to) : undefined }
      : undefined
  const toIso = (d?: Date) => d?.toISOString().slice(0, 10)

  const signDateRange = toDateRange(search.fromSign, search.toSign)
  const importDateRange = toDateRange(search.fromImport, search.toImport)

  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [bookingDialogDate, setBookingDialogDate] = useState<Date | undefined>()
  const [sortValue, setSortValue] = useState('event_date:asc')
  const tableSorting: SortingState = useMemo(
    () => [parseSortValue(sortValue)],
    [sortValue]
  )

  // Recherche : input local + debounce pour ne pas mettre à jour l'URL à chaque frappe.
  // On retient la dernière valeur qu'on a poussée dans l'URL pour distinguer
  // un changement "à nous" (qu'on ignore) d'un changement externe (back/forward,
  // lien partagé) qui doit, lui, resynchroniser l'input.
  const [searchInput, setSearchInput] = useState(searchValue)
  const debouncedSearch = useDebouncedValue(searchInput)
  const lastSyncedSearchRef = useRef(searchValue)
  // Sync URL ← input débouncé
  useEffect(() => {
    if (debouncedSearch === lastSyncedSearchRef.current) return
    lastSyncedSearchRef.current = debouncedSearch
    navigate({
      search: (prev: Record<string, unknown>) => {
        const next = { ...prev, q: debouncedSearch || undefined } as Record<
          string,
          unknown
        >
        Object.keys(next).forEach((k) => {
          if (next[k] === undefined || next[k] === '') delete next[k]
        })
        return next
      },
      replace: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])
  // Sync input ← URL UNIQUEMENT si le changement vient de l'extérieur
  // (back/forward, lien partagé). Évite d'écraser une frappe en cours
  // quand l'URL se met à jour à cause de notre propre navigate().
  useEffect(() => {
    if (searchValue === lastSyncedSearchRef.current) return
    lastSyncedSearchRef.current = searchValue
    setSearchInput(searchValue)
  }, [searchValue])

  const eventSortOptions = [
    { label: 'Date de création (récent)', value: 'created_at:desc' },
    { label: 'Date de création (ancien)', value: 'created_at:asc' },
    { label: "Date d'événement (proche)", value: 'event_date:asc' },
    { label: "Date d'événement (lointain)", value: 'event_date:desc' },
    { label: 'Montant (croissant)', value: 'total_amount:asc' },
    { label: 'Montant (décroissant)', value: 'total_amount:desc' },
    { label: 'Couverts (croissant)', value: 'guests_count:asc' },
    { label: 'Couverts (décroissant)', value: 'guests_count:desc' },
  ]

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

  const { data: bookings = [], isLoading } = useBookings()
  const { data: statuses = [] } = useBookingStatuses()
  const { data: users = [] } = useOrganizationUsers()
  const { data: restaurants = [] } = useRestaurants()

  // Reset visible uniquement si au moins un filtre est explicitement présent
  // dans l'URL. On ignore le défaut « événements à venir » de la vue liste
  // (qui n'est pas dans l'URL) pour ne pas afficher Reset alors qu'il n'y a
  // rien à reset.
  const hasActiveFilters = !!(
    search.q ||
    search.from ||
    search.to ||
    search.fromSign ||
    search.toSign ||
    search.fromImport ||
    search.toImport ||
    search.commercial ||
    search.status ||
    search.restaurant ||
    search.signed ||
    search.stale ||
    search.source
  )

  const onResetFilters = useCallback(() => {
    setSearchInput('')
    setSearch({
      q: undefined,
      from: undefined,
      to: undefined,
      fromSign: undefined,
      toSign: undefined,
      fromImport: undefined,
      toImport: undefined,
      commercial: undefined,
      status: undefined,
      restaurant: undefined,
      signed: undefined,
      stale: undefined,
      source: undefined,
    })
  }, [setSearch])

  const filteredBookings = useMemo(() => {
    let result = bookings

    if (searchValue) {
      const q = searchValue.toLowerCase()
      result = result.filter(
        (b) =>
          (b.contact?.first_name || '').toLowerCase().includes(q) ||
          (b.contact?.last_name || '').toLowerCase().includes(q) ||
          (b.contact?.email || '').toLowerCase().includes(q) ||
          (b.event_type || '').toLowerCase().includes(q) ||
          (b.restaurant?.name || '').toLowerCase().includes(q)
      )
    }

    if (dateRange?.from) {
      const fromDate = new Date(dateRange.from)
      fromDate.setHours(0, 0, 0, 0)
      result = result.filter((b) => new Date(b.event_date) >= fromDate)
    }

    if (dateRange?.to) {
      const toDate = new Date(dateRange.to)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter((b) => new Date(b.event_date) <= toDate)
    }

    if (selectedCommercials.size > 0) {
      result = result.filter((b) =>
        (b.assigned_user_ids || []).some((id) => selectedCommercials.has(id))
      )
    }

    if (selectedStatuses.size > 0) {
      result = result.filter(
        (b) => b.status?.slug && selectedStatuses.has(b.status.slug)
      )
    }

    if (selectedRestaurants.size > 0) {
      result = result.filter(
        (b) => b.restaurant_id && selectedRestaurants.has(b.restaurant_id)
      )
    }

    // Filtre date de signature
    if (signDateRange?.from) {
      const from = new Date(signDateRange.from)
      from.setHours(0, 0, 0, 0)
      result = result.filter((b) => {
        const signedAt = b.quotes?.find((q) => q.primary_quote)?.quote_signed_at
        return signedAt && new Date(signedAt) >= from
      })
    }
    if (signDateRange?.to) {
      const to = new Date(signDateRange.to)
      to.setHours(23, 59, 59, 999)
      result = result.filter((b) => {
        const signedAt = b.quotes?.find((q) => q.primary_quote)?.quote_signed_at
        return signedAt && new Date(signedAt) <= to
      })
    }

    // Filtre date d'import (created_at)
    if (importDateRange?.from) {
      const from = new Date(importDateRange.from)
      from.setHours(0, 0, 0, 0)
      result = result.filter(
        (b) => b.created_at && new Date(b.created_at) >= from
      )
    }
    if (importDateRange?.to) {
      const to = new Date(importDateRange.to)
      to.setHours(23, 59, 59, 999)
      result = result.filter(
        (b) => b.created_at && new Date(b.created_at) <= to
      )
    }

    // Drill-down depuis le dashboard : signé / proposition stale / source contact
    if (search.signed === '1') {
      result = result.filter((b) => SIGNED_SLUGS.includes(b.status?.slug || ''))
    }
    if (search.stale === '1') {
      const staleIds = new Set(
        getStaleProposals(result).map((s) => s.bookingId)
      )
      result = result.filter((b) => staleIds.has(b.id))
    }
    if (search.source) {
      const wanted = search.source.toLowerCase()
      result = result.filter(
        (b) => (b.contact?.source || 'Autre').toLowerCase() === wanted
      )
    }

    return result
  }, [
    bookings,
    searchValue,
    dateRange,
    signDateRange,
    importDateRange,
    selectedCommercials,
    selectedStatuses,
    selectedRestaurants,
    search.signed,
    search.stale,
    search.source,
  ])

  const reservations = useMemo(() => {
    return filteredBookings.map(bookingToReservation)
  }, [filteredBookings])

  const handleAddReservation = (date: Date) => {
    setBookingDialogDate(date)
    setBookingDialogOpen(true)
  }

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
        <h1 className='text-lg font-semibold'>Événements</h1>
        <div className='ms-auto flex items-center space-x-2 sm:space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        {/* Ligne 1 : recherche (s'étire sur l'espace dispo) + tri / bascule de vue / création (droite) */}
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            placeholder='Rechercher par contact, type, restaurant...'
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className='h-8 min-w-[180px] flex-1'
          />
          <div className='flex items-center gap-2'>
            {mainView === 'list' && (
              <SortSelect
                options={eventSortOptions}
                value={sortValue}
                onChange={setSortValue}
              />
            )}
            <ToggleGroup
              type='single'
              value={mainView}
              onValueChange={(value) => value && setSearch({ view: value })}
            >
              <ToggleGroupItem
                value='calendar'
                aria-label='Vue calendrier'
                className='h-8 w-8 px-0'
              >
                <CalendarIcon className='h-4 w-4' />
              </ToggleGroupItem>
              <ToggleGroupItem
                value='list'
                aria-label='Vue liste'
                className='h-8 w-8 px-0'
              >
                <List className='h-4 w-4' />
              </ToggleGroupItem>
              <ToggleGroupItem
                value='pipeline'
                aria-label='Vue pipeline'
                className='h-8 w-8 px-0'
              >
                <Columns3 className='h-4 w-4' />
              </ToggleGroupItem>
            </ToggleGroup>
            <ExportEventsDialog
              initialStatusSlugs={selectedStatuses}
              initialRestaurantIds={selectedRestaurants}
              initialCommercialIds={selectedCommercials}
            />
            <CreateBookingDialog
              open={bookingDialogOpen}
              onOpenChange={setBookingDialogOpen}
              defaultDate={bookingDialogDate}
            />
          </div>
        </div>

        {/* Ligne 2 : tous les filtres en dessous, communs aux 3 vues */}
        <div className='flex flex-wrap items-center gap-2'>
          <DateFilter
            value={dateRange}
            onChange={(range) =>
              setSearch({
                from: range?.from ? range.from.toISOString() : undefined,
                to: range?.to ? range.to.toISOString() : undefined,
              })
            }
            placeholder="Date d'événement"
            futureAware
          />
          <DateFilter
            value={signDateRange}
            onChange={(range) =>
              setSearch({
                fromSign: toIso(range?.from),
                toSign: toIso(range?.to),
              })
            }
            placeholder='Date de signature'
          />
          <DateFilter
            value={importDateRange}
            onChange={(range) =>
              setSearch({
                fromImport: toIso(range?.from),
                toImport: toIso(range?.to),
              })
            }
            placeholder="Date d'import"
          />
          <FacetedFilter
            title='Commercial'
            options={users.map((u) => ({
              label: `${u.first_name} ${u.last_name}`,
              value: u.id,
            }))}
            selected={selectedCommercials}
            onSelectionChange={(set) =>
              setSearch({
                commercial: set.size ? Array.from(set).join(',') : undefined,
              })
            }
          />
          <FacetedFilter
            title='Restaurant'
            options={restaurants.map((r) => ({ label: r.name, value: r.id }))}
            selected={selectedRestaurants}
            onSelectionChange={(set) =>
              setSearch({
                restaurant: set.size ? Array.from(set).join(',') : undefined,
              })
            }
          />
          <FacetedFilter
            title='Statut'
            options={statuses.map((s) => ({ label: s.name, value: s.slug }))}
            selected={selectedStatuses}
            onSelectionChange={(set) =>
              setSearch({
                status: set.size ? Array.from(set).join(',') : undefined,
              })
            }
          />
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
        </div>

        {/* Bannière de drill-down : affiche les filtres venus du dashboard
            (signed / stale / source) qui n'ont pas d'UI dédiée dans la
            barre de filtres. Cliquable pour retirer chaque filtre. */}
        {(search.signed || search.stale || search.source) && (
          <div className='flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs'>
            <span className='text-muted-foreground'>Vue filtrée :</span>
            {search.signed === '1' && (
              <Badge
                variant='secondary'
                className='cursor-pointer gap-1 hover:bg-secondary/80'
                onClick={() => setSearch({ signed: undefined })}
              >
                Signés uniquement
                <Cross2Icon className='h-3 w-3' />
              </Badge>
            )}
            {search.stale === '1' && (
              <Badge
                variant='secondary'
                className='cursor-pointer gap-1 hover:bg-secondary/80'
                onClick={() => setSearch({ stale: undefined })}
              >
                Propositions sans réponse (&gt;3j)
                <Cross2Icon className='h-3 w-3' />
              </Badge>
            )}
            {search.source && (
              <Badge
                variant='secondary'
                className='cursor-pointer gap-1 hover:bg-secondary/80'
                onClick={() => setSearch({ source: undefined })}
              >
                Source : {search.source}
                <Cross2Icon className='h-3 w-3' />
              </Badge>
            )}
          </div>
        )}

        {mainView === 'list' && (
          <BookingsTable
            data={filteredBookings}
            users={users}
            sorting={tableSorting}
          />
        )}
        {mainView === 'calendar' && (
          <div className='flex-1 overflow-hidden'>
            <CalendarView
              reservations={reservations}
              viewMode={calendarMode}
              onViewModeChange={(mode) => setSearch({ calendarMode: mode })}
              onAddReservation={handleAddReservation}
            />
          </div>
        )}
        {mainView === 'pipeline' && (
          <PipelineView bookings={filteredBookings} statuses={statuses} />
        )}
      </Main>
    </>
  )
}
