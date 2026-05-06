import { useState, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from 'date-fns'
import { Link } from '@tanstack/react-router'
import { fr } from 'date-fns/locale'
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Euro,
  Phone,
  Mail,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Reservation } from '../types'

type ViewMode = 'month' | 'week' | 'day'

type CalendarViewProps = {
  reservations: Reservation[]
  viewMode: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  onReservationClick?: (reservation: Reservation) => void
  onAddReservation?: (date: Date) => void
}

function ReservationCard({
  reservation,
}: {
  reservation: Reservation
  onClick?: () => void
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to='/evenements/booking/$id'
            params={{ id: reservation.id }}
            onClick={(e) => e.stopPropagation()}
            className='mb-1 block cursor-pointer rounded-md border-l-4 bg-card p-2 text-xs shadow-sm transition-all hover:ring-2 hover:ring-primary/30'
            style={{
              borderLeftColor:
                reservation.statusColor || reservation.restaurant.color,
            }}
          >
            <div className='mb-0.5 flex items-center gap-1 text-[10px] text-muted-foreground'>
              <div
                className='h-2 w-2 rounded-full'
                style={{ backgroundColor: reservation.restaurant.color }}
              />
              <span>{reservation.restaurant.name.split(' ').slice(-1)[0]}</span>
            </div>
            <div className='font-medium text-primary'>
              {reservation.startTime} - {reservation.endTime}
            </div>
            <div className='truncate font-semibold'>
              {reservation.clientName}
            </div>
            <div className='flex items-center gap-1 text-muted-foreground'>
              <Users className='h-3 w-3' />
              <span>{reservation.guests}</span>
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent
          side='right'
          align='start'
          className='max-w-[280px] p-0'
        >
          <div className='space-y-2 p-3'>
            <div className='flex items-center justify-between gap-2'>
              <span className='text-sm font-semibold'>
                {reservation.clientName}
              </span>
              <Badge
                variant='outline'
                className={cn('shrink-0 text-[10px]', reservation.statusColor)}
              >
                {reservation.status}
              </Badge>
            </div>
            <div className='space-y-1 text-xs text-muted-foreground'>
              <div className='flex items-center gap-1.5'>
                <div
                  className='h-2 w-2 shrink-0 rounded-full'
                  style={{ backgroundColor: reservation.restaurant.color }}
                />
                {reservation.restaurant.name}
              </div>
              {reservation.eventType && <div>{reservation.eventType}</div>}
              <div className='flex items-center gap-1.5'>
                <Users className='h-3 w-3 shrink-0' />
                {reservation.guests} personnes
              </div>
              {reservation.clientEmail && (
                <div className='flex items-center gap-1.5'>
                  <Mail className='h-3 w-3 shrink-0' />
                  {reservation.clientEmail}
                </div>
              )}
              {reservation.clientPhone && (
                <div className='flex items-center gap-1.5'>
                  <Phone className='h-3 w-3 shrink-0' />
                  {reservation.clientPhone}
                </div>
              )}
              {reservation.amountHT > 0 && (
                <div className='flex items-center gap-1.5'>
                  <Euro className='h-3 w-3 shrink-0' />
                  {reservation.amountHT.toLocaleString('fr-FR')} € HT
                </div>
              )}
              {reservation.notes && (
                <div className='line-clamp-2 border-t pt-1 text-[11px]'>
                  {reservation.notes}
                </div>
              )}
            </div>
            <div className='pt-1 text-[10px] font-medium text-primary'>
              Cliquer pour ouvrir la fiche →
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function MonthView({
  currentDate,
  reservations,
  onReservationClick,
  onAddReservation,
}: {
  currentDate: Date
  reservations: Reservation[]
  onReservationClick?: (reservation: Reservation) => void
  onAddReservation?: (date: Date) => void
}) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const today = new Date()
  const numWeeks = Math.ceil(days.length / 7)

  const reservationsByDate = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    reservations.forEach((r) => {
      const key = r.date.toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return map
  }, [reservations])

  const dayNames = {
    full: [
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
      'Dimanche',
    ],
    short: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  }

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='grid grid-cols-7 border-b'>
        {dayNames.full.map((day, i) => (
          <div
            key={day}
            className='border-r p-1 text-center text-xs font-medium text-muted-foreground last:border-r-0 sm:p-2 sm:text-sm'
          >
            <span className='hidden sm:inline'>{day}</span>
            <span className='sm:hidden'>{dayNames.short[i]}</span>
          </div>
        ))}
      </div>

      {/* Days Grid - Full Height */}
      <div
        className='grid flex-1 grid-cols-7 grid-rows-[repeat(var(--weeks),1fr)]'
        style={{ '--weeks': numWeeks } as React.CSSProperties}
      >
        {days.map((day) => {
          const dayReservations = (
            reservationsByDate.get(day.toDateString()) || []
          ).sort((a, b) => a.startTime.localeCompare(b.startTime))
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isToday = isSameDay(day, today)

          return (
            <div
              key={day.toISOString()}
              onClick={() => onAddReservation?.(day)}
              className={cn(
                'min-h-[60px] cursor-pointer overflow-hidden border-r border-b p-0.5 transition-colors last:border-r-0 hover:bg-muted/50 sm:min-h-0 sm:p-1',
                !isCurrentMonth && 'bg-muted/30',
                isToday && 'bg-primary/5'
              )}
            >
              {/* Day Number */}
              <div className='mb-0.5 flex items-center justify-between sm:mb-1'>
                <div
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium sm:h-7 sm:w-7 sm:text-sm',
                    isToday && 'bg-primary text-primary-foreground'
                  )}
                >
                  {format(day, 'd')}
                </div>
                {dayReservations.length > 0 && (
                  <span className='text-[10px] text-muted-foreground sm:text-xs'>
                    <span className='hidden sm:inline'>
                      {dayReservations.length} rés.
                    </span>
                    <span className='sm:hidden'>{dayReservations.length}</span>
                  </span>
                )}
              </div>

              {/* Reservations - Mobile: dots, Desktop: cards */}
              <div className='flex flex-wrap gap-0.5 sm:hidden'>
                {dayReservations.slice(0, 4).map((reservation) => (
                  <div
                    key={reservation.id}
                    className='h-2 w-2 rounded-full'
                    style={{ backgroundColor: reservation.restaurant.color }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onReservationClick?.(reservation)
                    }}
                  />
                ))}
                {dayReservations.length > 4 && (
                  <span className='text-[8px] text-muted-foreground'>
                    +{dayReservations.length - 4}
                  </span>
                )}
              </div>

              <ScrollArea className='hidden h-[calc(100%-32px)] sm:block'>
                <div className='space-y-1 pr-2'>
                  {dayReservations.map((reservation) => (
                    <ReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      onClick={() => onReservationClick?.(reservation)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({
  currentDate,
  reservations,
}: {
  currentDate: Date
  reservations: Reservation[]
  onReservationClick?: (reservation: Reservation) => void
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const today = new Date()

  const reservationsByDate = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    reservations.forEach((r) => {
      const key = r.date.toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return map
  }, [reservations])

  return (
    <ScrollArea className='h-full'>
      <div className='flex flex-col gap-3 sm:grid sm:grid-cols-7 sm:gap-2 sm:p-2'>
        {days.map((day) => {
          const dayReservations =
            reservationsByDate.get(day.toDateString()) || []
          const isToday = isSameDay(day, today)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'rounded-lg border-2 border-foreground/20 bg-card p-3 sm:border sm:p-2',
                isToday && 'border-primary ring-2 ring-primary'
              )}
            >
              <div className='mb-2 flex items-center gap-2 sm:flex-col sm:items-stretch sm:gap-0'>
                <div className='flex items-center gap-2 sm:flex-col sm:gap-0 sm:text-center'>
                  <div className='text-xs text-muted-foreground'>
                    <span className='sm:hidden'>
                      {format(day, 'EEEE', { locale: fr })}
                    </span>
                    <span className='hidden sm:inline'>
                      {format(day, 'EEE', { locale: fr })}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'text-lg font-bold',
                      isToday && 'text-primary'
                    )}
                  >
                    {format(day, 'd MMM', { locale: fr })}
                  </div>
                </div>
                <div className='ml-auto text-xs text-muted-foreground sm:hidden'>
                  {dayReservations.length} rés.
                </div>
              </div>
              <div className='space-y-1 sm:max-h-[250px] sm:overflow-y-auto'>
                {dayReservations
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((reservation) => (
                    <Link
                      key={reservation.id}
                      to='/evenements/booking/$id'
                      params={{ id: reservation.id }}
                      className='block cursor-pointer rounded border bg-card p-2 transition-all hover:shadow-md hover:ring-2 hover:ring-primary/30'
                      style={{
                        borderLeftColor: reservation.restaurant.color,
                        borderLeftWidth: 3,
                      }}
                    >
                      <div className='text-xs font-medium'>
                        {reservation.startTime} - {reservation.endTime}
                      </div>
                      <div className='truncate text-sm font-medium'>
                        {reservation.clientName}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {reservation.guests} pers. • {reservation.eventType}
                      </div>
                    </Link>
                  ))}
                {dayReservations.length === 0 && (
                  <div className='py-4 text-center text-xs text-muted-foreground'>
                    Aucun événement
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

function DayView({
  currentDate,
  reservations,
}: {
  currentDate: Date
  reservations: Reservation[]
  onReservationClick?: (reservation: Reservation) => void
}) {
  const dayReservations = reservations
    .filter((r) => isSameDay(r.date, currentDate))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const hours = Array.from({ length: 14 }, (_, i) => i + 10) // 10h to 23h

  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]'>
      {/* Timeline */}
      <Card className='p-4 lg:order-2'>
        <h3 className='mb-4 font-medium'>
          {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
        </h3>
        <div className='relative'>
          {hours.map((hour) => (
            <div key={hour} className='flex min-h-[60px] border-t py-2'>
              <div className='w-12 shrink-0 text-xs text-muted-foreground'>
                {hour}:00
              </div>
              <div className='flex-1 space-y-1'>
                {dayReservations
                  .filter((r) => parseInt(r.startTime.split(':')[0]) === hour)
                  .map((reservation) => (
                    <Link
                      key={reservation.id}
                      to='/evenements/booking/$id'
                      params={{ id: reservation.id }}
                      className='block cursor-pointer rounded p-2 text-white transition-all hover:opacity-80 hover:ring-2 hover:ring-primary/30'
                      style={{ backgroundColor: reservation.restaurant.color }}
                    >
                      <div className='text-xs font-medium'>
                        {reservation.startTime} - {reservation.endTime}
                      </div>
                      <div className='text-sm font-medium'>
                        {reservation.clientName}
                      </div>
                      <div className='text-xs opacity-90'>
                        {reservation.guests} pers. • {reservation.eventType}
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Reservations List */}
      <Card className='p-4 lg:order-1'>
        <h3 className='mb-4 font-medium'>
          Événements du jour ({dayReservations.length})
        </h3>
        <ScrollArea className='h-[500px]'>
          <div className='space-y-3'>
            {dayReservations.map((reservation) => (
              <Link
                key={reservation.id}
                to='/evenements/booking/$id'
                params={{ id: reservation.id }}
                className='block cursor-pointer rounded-lg border p-3 transition-all hover:shadow-md hover:ring-2 hover:ring-primary/30'
                style={{
                  borderLeftColor: reservation.restaurant.color,
                  borderLeftWidth: 4,
                }}
              >
                <div className='flex items-start justify-between'>
                  <div>
                    <div className='font-medium'>{reservation.clientName}</div>
                    <div className='text-sm text-muted-foreground'>
                      {reservation.clientEmail}
                    </div>
                  </div>
                  <div className='text-right'>
                    <div className='font-medium'>
                      {reservation.startTime} - {reservation.endTime}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      {reservation.guests} personnes
                    </div>
                  </div>
                </div>
                <div className='mt-2 flex items-center gap-2 text-sm'>
                  <span
                    className='rounded px-2 py-0.5 text-xs text-white'
                    style={{ backgroundColor: reservation.restaurant.color }}
                  >
                    {reservation.restaurant.name}
                  </span>
                  <span className='text-muted-foreground'>
                    {reservation.eventType}
                  </span>
                  <span className='ml-auto font-medium'>
                    {reservation.amountHT.toLocaleString('fr-FR')} € HT
                  </span>
                </div>
              </Link>
            ))}
            {dayReservations.length === 0 && (
              <div className='py-8 text-center text-muted-foreground'>
                Aucun événement pour cette journée
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  )
}

const viewModeOptions = [
  { value: 'month', label: '30 jours' },
  { value: 'week', label: '7 jours' },
  { value: 'day', label: 'Journée' },
]

export function CalendarView({
  reservations,
  viewMode,
  onViewModeChange,
  onReservationClick,
  onAddReservation,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const navigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      setCurrentDate(
        direction === 'prev'
          ? subMonths(currentDate, 1)
          : addMonths(currentDate, 1)
      )
    } else if (viewMode === 'week') {
      setCurrentDate(
        direction === 'prev'
          ? subWeeks(currentDate, 1)
          : addWeeks(currentDate, 1)
      )
    } else {
      setCurrentDate(
        direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1)
      )
    }
  }

  const getTitle = () => {
    if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale: fr })
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
      return `${format(weekStart, 'd MMM', { locale: fr })} - ${format(weekEnd, 'd MMM yyyy', { locale: fr })}`
    } else {
      return format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })
    }
  }

  return (
    <div className='flex h-full flex-col'>
      {/* Navigation */}
      <div className='flex flex-col justify-between gap-2 pb-4 sm:flex-row sm:items-center'>
        <div className='flex items-center gap-2'>
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8 sm:h-9 sm:w-9'
              onClick={() => navigate('prev')}
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8 sm:h-9 sm:w-9'
              onClick={() => navigate('next')}
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>

          {/* View selector - Mobile */}
          {onViewModeChange && (
            <Select
              value={viewMode}
              onValueChange={(value) => onViewModeChange(value as ViewMode)}
            >
              <SelectTrigger className='h-8 w-[110px] sm:hidden'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {viewModeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <h2 className='flex-1 text-center text-sm font-semibold capitalize sm:hidden'>
            {getTitle()}
          </h2>
          <Button
            variant='outline'
            size='sm'
            className='hidden sm:flex'
            onClick={() => setCurrentDate(new Date())}
          >
            Aujourd'hui
          </Button>
        </div>
        <h2 className='hidden text-lg font-semibold capitalize sm:block'>
          {getTitle()}
        </h2>
        <div className='hidden items-center gap-3 sm:flex'>
          {/* Restaurant legend */}
          <div className='flex items-center gap-2 overflow-x-auto'>
            {Array.from(
              new Map(
                reservations.map((r) => [r.restaurant.id, r.restaurant])
              ).values()
            ).map((restaurant) => (
              <div
                key={restaurant.id}
                className='flex shrink-0 items-center gap-1 text-xs'
              >
                <div
                  className='h-2 w-2 rounded sm:h-3 sm:w-3'
                  style={{ backgroundColor: restaurant.color }}
                />
                <span className='hidden md:inline'>{restaurant.name}</span>
              </div>
            ))}
          </div>
          {/* Calendar mode selector - Desktop */}
          {onViewModeChange && (
            <ToggleGroup
              type='single'
              value={viewMode}
              onValueChange={(value) =>
                value && onViewModeChange(value as ViewMode)
              }
              className='rounded-md border'
            >
              <ToggleGroupItem
                value='day'
                aria-label='1 jour'
                className='h-8 gap-1 px-2 text-xs'
              >
                <Calendar className='h-3.5 w-3.5' />1 jour
              </ToggleGroupItem>
              <ToggleGroupItem
                value='week'
                aria-label='7 jours'
                className='h-8 gap-1 px-2 text-xs'
              >
                <CalendarDays className='h-3.5 w-3.5' />7 jours
              </ToggleGroupItem>
              <ToggleGroupItem
                value='month'
                aria-label='30 jours'
                className='h-8 gap-1 px-2 text-xs'
              >
                <CalendarRange className='h-3.5 w-3.5' />
                30 jours
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
      </div>

      {/* Calendar - Full Height */}
      <div className='min-h-0 flex-1 overflow-hidden sm:rounded-lg sm:border'>
        {viewMode === 'month' && (
          <MonthView
            currentDate={currentDate}
            reservations={reservations}
            onReservationClick={onReservationClick}
            onAddReservation={onAddReservation}
          />
        )}
        {viewMode === 'week' && (
          <WeekView
            currentDate={currentDate}
            reservations={reservations}
            onReservationClick={onReservationClick}
          />
        )}
        {viewMode === 'day' && (
          <DayView
            currentDate={currentDate}
            reservations={reservations}
            onReservationClick={onReservationClick}
          />
        )}
      </div>
    </div>
  )
}
