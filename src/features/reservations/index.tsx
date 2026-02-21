import { useState, useMemo, useCallback } from 'react'
import { type DateRange } from 'react-day-picker'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Calendar as CalendarIcon, List, Loader2 } from 'lucide-react'
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
import { CalendarView } from './components/calendar-view'
import { BookingsTable } from './components/bookings-table'
import { CreateBookingDialog } from './components/create-booking-dialog'
import { useBookings, useBookingStatuses, useRestaurants } from './hooks/use-bookings'
import { useOrganizationUsers } from '@/features/contacts/hooks/use-contacts'
import { bookingToReservation } from './types'

type MainView = 'calendar' | 'list'
type CalendarMode = 'month' | 'week' | 'day'

export function Reservations() {
  const search = useSearch({ from: '/_authenticated/evenements/' })
  const navigate = useNavigate({ from: '/evenements/' })

  // Derive state from URL search params
  const mainView = (search.view || 'calendar') as MainView
  const calendarMode = (search.calendarMode || 'week') as CalendarMode
  const searchValue = search.q || ''
  const dateRange: DateRange | undefined = search.from
    ? { from: new Date(search.from), to: search.to ? new Date(search.to) : undefined }
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

  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [bookingDialogDate, setBookingDialogDate] = useState<Date | undefined>()

  const setSearch = useCallback(
    (updates: Record<string, string | undefined>) => {
      navigate({
        search: (prev) => {
          const next = { ...prev, ...updates } as Record<string, unknown>
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

  const { data: bookings = [], isLoading } = useBookings()
  const { data: statuses = [] } = useBookingStatuses()
  const { data: users = [] } = useOrganizationUsers()
  const { data: restaurants = [] } = useRestaurants()

  const hasActiveFilters = !!(searchValue || dateRange?.from || selectedCommercials.size || selectedStatuses.size || selectedRestaurants.size)

  const onResetFilters = useCallback(() => {
    setSearch({
      q: undefined,
      from: undefined,
      to: undefined,
      commercial: undefined,
      status: undefined,
      restaurant: undefined,
    })
  }, [setSearch])

  const filteredBookings = useMemo(() => {
    let result = bookings

    if (searchValue) {
      const q = searchValue.toLowerCase()
      result = result.filter(b =>
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
      result = result.filter(b => new Date(b.event_date) >= fromDate)
    }

    if (dateRange?.to) {
      const toDate = new Date(dateRange.to)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter(b => new Date(b.event_date) <= toDate)
    }

    if (selectedCommercials.size > 0) {
      result = result.filter(b => b.assigned_to && selectedCommercials.has(b.assigned_to))
    }

    if (selectedStatuses.size > 0) {
      result = result.filter(b => b.status?.slug && selectedStatuses.has(b.status.slug))
    }

    if (selectedRestaurants.size > 0) {
      result = result.filter(b => b.restaurant_id && selectedRestaurants.has(b.restaurant_id))
    }

    return result
  }, [bookings, searchValue, dateRange, selectedCommercials, selectedStatuses, selectedRestaurants])

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
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            placeholder='Rechercher par contact, type, restaurant...'
            value={searchValue}
            onChange={(e) => setSearch({ q: e.target.value || undefined })}
            className='h-8 w-full sm:w-[200px] lg:w-[250px]'
          />
          <div className='flex flex-wrap gap-2'>
            <DateFilter
              value={dateRange}
              onChange={(range) => {
                setSearch({
                  from: range?.from ? range.from.toISOString() : undefined,
                  to: range?.to ? range.to.toISOString() : undefined,
                })
              }}
              placeholder="Date d'événement"
            />
            <FacetedFilter
              title='Commercial'
              options={users.map(u => ({ label: `${u.first_name} ${u.last_name}`, value: u.id }))}
              selected={selectedCommercials}
              onSelectionChange={(set) => setSearch({ commercial: set.size ? Array.from(set).join(',') : undefined })}
            />
            <FacetedFilter
              title='Restaurant'
              options={restaurants.map(r => ({ label: r.name, value: r.id }))}
              selected={selectedRestaurants}
              onSelectionChange={(set) => setSearch({ restaurant: set.size ? Array.from(set).join(',') : undefined })}
            />
            <FacetedFilter
              title='Statut'
              options={statuses.map(s => ({ label: s.name, value: s.slug }))}
              selected={selectedStatuses}
              onSelectionChange={(set) => setSearch({ status: set.size ? Array.from(set).join(',') : undefined })}
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
              value={mainView}
              onValueChange={(value) => value && setSearch({ view: value })}
            >
              <ToggleGroupItem value='calendar' aria-label='Vue calendrier' className='px-2 gap-1.5'>
                <CalendarIcon className='h-4 w-4' />
                <span className='hidden sm:inline text-xs'>Calendrier</span>
              </ToggleGroupItem>
              <ToggleGroupItem value='list' aria-label='Vue liste' className='px-2 gap-1.5'>
                <List className='h-4 w-4' />
                <span className='hidden sm:inline text-xs'>Liste</span>
              </ToggleGroupItem>
            </ToggleGroup>
            <CreateBookingDialog
              open={bookingDialogOpen}
              onOpenChange={setBookingDialogOpen}
              defaultDate={bookingDialogDate}
            />
          </div>
        </div>

        {mainView === 'list' && (
          <BookingsTable data={filteredBookings} />
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
      </Main>
    </>
  )
}
