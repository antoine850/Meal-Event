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
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import type { Reservation } from '../types'

type ViewMode = 'month' | 'week' | 'day'

type CalendarViewProps = {
  reservations: Reservation[]
  viewMode: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  onReservationClick?: (reservation: Reservation) => void
  onAddReservation?: (date: Date) => void
}

function ReservationCard({ reservation, onClick }: { reservation: Reservation, onClick?: () => void }) {
  return (
    <div 
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className='rounded-md p-2 text-xs cursor-pointer hover:opacity-90 transition-opacity border-l-4 bg-card shadow-sm mb-1'
      style={{ borderLeftColor: reservation.statusColor || reservation.restaurant.color }}
    >
      <div className='flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5'>
        <div 
          className='w-2 h-2 rounded-full' 
          style={{ backgroundColor: reservation.restaurant.color }}
        />
        <span>{reservation.restaurant.name.split(' ').slice(-1)[0]}</span>
      </div>
      <div className='font-medium text-primary'>
        {reservation.startTime} - {reservation.endTime}
      </div>
      <div className='font-semibold truncate'>{reservation.clientName}</div>
      <div className='flex items-center gap-1 text-muted-foreground'>
        <Users className='h-3 w-3' />
        <span>{reservation.guests}</span>
      </div>
    </div>
  )
}

function MonthView({ currentDate, reservations, onReservationClick, onAddReservation }: { 
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
    reservations.forEach(r => {
      const key = r.date.toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return map
  }, [reservations])

  const dayNames = {
    full: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
    short: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='grid grid-cols-7 border-b'>
        {dayNames.full.map((day, i) => (
          <div key={day} className='p-1 sm:p-2 text-center text-xs sm:text-sm font-medium text-muted-foreground border-r last:border-r-0'>
            <span className='hidden sm:inline'>{day}</span>
            <span className='sm:hidden'>{dayNames.short[i]}</span>
          </div>
        ))}
      </div>
      
      {/* Days Grid - Full Height */}
      <div className='flex-1 grid grid-cols-7 grid-rows-[repeat(var(--weeks),1fr)]' style={{ '--weeks': numWeeks } as React.CSSProperties}>
        {days.map(day => {
          const dayReservations = (reservationsByDate.get(day.toDateString()) || [])
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isToday = isSameDay(day, today)
          
          return (
            <div 
              key={day.toISOString()} 
              onClick={() => onAddReservation?.(day)}
              className={cn(
                'border-r border-b last:border-r-0 p-0.5 sm:p-1 cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden min-h-[60px] sm:min-h-0',
                !isCurrentMonth && 'bg-muted/30',
                isToday && 'bg-primary/5'
              )}
            >
              {/* Day Number */}
              <div className='flex items-center justify-between mb-0.5 sm:mb-1'>
                <div className={cn(
                  'text-xs sm:text-sm font-medium w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-full',
                  isToday && 'bg-primary text-primary-foreground'
                )}>
                  {format(day, 'd')}
                </div>
                {dayReservations.length > 0 && (
                  <span className='text-[10px] sm:text-xs text-muted-foreground'>
                    <span className='hidden sm:inline'>{dayReservations.length} rés.</span>
                    <span className='sm:hidden'>{dayReservations.length}</span>
                  </span>
                )}
              </div>
              
              {/* Reservations - Mobile: dots, Desktop: cards */}
              <div className='sm:hidden flex flex-wrap gap-0.5'>
                {dayReservations.slice(0, 4).map(reservation => (
                  <div 
                    key={reservation.id}
                    className='w-2 h-2 rounded-full'
                    style={{ backgroundColor: reservation.restaurant.color }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onReservationClick?.(reservation)
                    }}
                  />
                ))}
                {dayReservations.length > 4 && (
                  <span className='text-[8px] text-muted-foreground'>+{dayReservations.length - 4}</span>
                )}
              </div>
              
              <ScrollArea className='hidden sm:block h-[calc(100%-32px)]'>
                <div className='space-y-1 pr-2'>
                  {dayReservations.map(reservation => (
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

function WeekView({ currentDate, reservations, onReservationClick }: { 
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
    reservations.forEach(r => {
      const key = r.date.toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return map
  }, [reservations])

  return (
    <ScrollArea className='h-full'>
      <div className='flex flex-col sm:grid sm:grid-cols-7 gap-3 sm:gap-2 sm:p-2'>
        {days.map(day => {
          const dayReservations = reservationsByDate.get(day.toDateString()) || []
          const isToday = isSameDay(day, today)
          
          return (
            <div 
              key={day.toISOString()} 
              className={cn(
                'p-3 sm:p-2 rounded-lg border-2 border-foreground/20 sm:border bg-card',
                isToday && 'ring-2 ring-primary border-primary'
              )}
            >
              <div className='flex sm:flex-col items-center sm:items-stretch gap-2 sm:gap-0 mb-2'>
                <div className='flex sm:flex-col items-center gap-2 sm:gap-0 sm:text-center'>
                  <div className='text-xs text-muted-foreground'>
                    <span className='sm:hidden'>{format(day, 'EEEE', { locale: fr })}</span>
                    <span className='hidden sm:inline'>{format(day, 'EEE', { locale: fr })}</span>
                  </div>
                  <div className={cn(
                    'text-lg font-bold',
                    isToday && 'text-primary'
                  )}>
                    {format(day, 'd MMM', { locale: fr })}
                  </div>
                </div>
                <div className='ml-auto sm:hidden text-xs text-muted-foreground'>
                  {dayReservations.length} rés.
                </div>
              </div>
              <div className='space-y-1 sm:max-h-[250px] sm:overflow-y-auto'>
                {dayReservations
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map(reservation => (
                    <div 
                      key={reservation.id} 
                      onClick={() => onReservationClick?.(reservation)}
                      className='p-2 rounded border bg-card hover:shadow-md transition-shadow cursor-pointer'
                      style={{ borderLeftColor: reservation.restaurant.color, borderLeftWidth: 3 }}
                    >
                      <div className='text-xs font-medium'>{reservation.startTime} - {reservation.endTime}</div>
                      <div className='text-sm font-medium truncate'>{reservation.clientName}</div>
                      <div className='text-xs text-muted-foreground'>{reservation.guests} pers. • {reservation.eventType}</div>
                    </div>
                  ))}
                {dayReservations.length === 0 && (
                  <div className='text-xs text-muted-foreground text-center py-4'>
                    Aucune réservation
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

function DayView({ currentDate, reservations, onReservationClick }: { 
  currentDate: Date
  reservations: Reservation[]
  onReservationClick?: (reservation: Reservation) => void 
}) {
  const dayReservations = reservations
    .filter(r => isSameDay(r.date, currentDate))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const hours = Array.from({ length: 14 }, (_, i) => i + 10) // 10h to 23h

  return (
    <div className='grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4'>
      {/* Timeline */}
      <Card className='p-4 lg:order-2'>
        <h3 className='font-medium mb-4'>
          {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
        </h3>
        <div className='relative'>
          {hours.map(hour => (
            <div key={hour} className='flex border-t py-2 min-h-[60px]'>
              <div className='w-12 text-xs text-muted-foreground shrink-0'>
                {hour}:00
              </div>
              <div className='flex-1 space-y-1'>
                {dayReservations
                  .filter(r => parseInt(r.startTime.split(':')[0]) === hour)
                  .map(reservation => (
                    <div 
                      key={reservation.id}
                      onClick={() => onReservationClick?.(reservation)}
                      className='p-2 rounded text-white cursor-pointer hover:opacity-80 transition-opacity'
                      style={{ backgroundColor: reservation.restaurant.color }}
                    >
                      <div className='text-xs font-medium'>
                        {reservation.startTime} - {reservation.endTime}
                      </div>
                      <div className='text-sm font-medium'>{reservation.clientName}</div>
                      <div className='text-xs opacity-90'>
                        {reservation.guests} pers. • {reservation.eventType}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Reservations List */}
      <Card className='p-4 lg:order-1'>
        <h3 className='font-medium mb-4'>Réservations du jour ({dayReservations.length})</h3>
        <ScrollArea className='h-[500px]'>
          <div className='space-y-3'>
            {dayReservations.map(reservation => (
              <div 
                key={reservation.id}
                onClick={() => onReservationClick?.(reservation)}
                className='p-3 rounded-lg border hover:shadow-md transition-shadow cursor-pointer'
                style={{ borderLeftColor: reservation.restaurant.color, borderLeftWidth: 4 }}
              >
                <div className='flex items-start justify-between'>
                  <div>
                    <div className='font-medium'>{reservation.clientName}</div>
                    <div className='text-sm text-muted-foreground'>{reservation.clientEmail}</div>
                  </div>
                  <div className='text-right'>
                    <div className='font-medium'>{reservation.startTime} - {reservation.endTime}</div>
                    <div className='text-sm text-muted-foreground'>{reservation.guests} personnes</div>
                  </div>
                </div>
                <div className='mt-2 flex items-center gap-2 text-sm'>
                  <span className='px-2 py-0.5 rounded text-xs text-white' style={{ backgroundColor: reservation.restaurant.color }}>
                    {reservation.restaurant.name}
                  </span>
                  <span className='text-muted-foreground'>{reservation.eventType}</span>
                  <span className='ml-auto font-medium'>{reservation.amountHT.toLocaleString('fr-FR')} € HT</span>
                </div>
              </div>
            ))}
            {dayReservations.length === 0 && (
              <div className='text-center py-8 text-muted-foreground'>
                Aucune réservation pour cette journée
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

export function CalendarView({ reservations, viewMode, onViewModeChange, onReservationClick, onAddReservation }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const navigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
    } else if (viewMode === 'week') {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
    } else {
      setCurrentDate(direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1))
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
    <div className='flex flex-col h-full'>
      {/* Navigation */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4'>
        <div className='flex items-center gap-2'>
          <div className='flex items-center gap-1'>
            <Button variant='outline' size='icon' className='h-8 w-8 sm:h-9 sm:w-9' onClick={() => navigate('prev')}>
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button variant='outline' size='icon' className='h-8 w-8 sm:h-9 sm:w-9' onClick={() => navigate('next')}>
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
          
          {/* View selector - Mobile */}
          {onViewModeChange && (
            <Select value={viewMode} onValueChange={(value) => onViewModeChange(value as ViewMode)}>
              <SelectTrigger className='w-[110px] h-8 sm:hidden'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {viewModeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <h2 className='text-sm font-semibold capitalize flex-1 text-center sm:hidden'>{getTitle()}</h2>
          <Button variant='outline' size='sm' className='hidden sm:flex' onClick={() => setCurrentDate(new Date())}>
            Aujourd'hui
          </Button>
        </div>
        <h2 className='hidden sm:block text-lg font-semibold capitalize'>{getTitle()}</h2>
        <div className='hidden sm:flex items-center gap-2 overflow-x-auto'>
          {/* Restaurant legend - derived from reservations */}
          {Array.from(new Map(reservations.map(r => [r.restaurant.id, r.restaurant])).values()).map(restaurant => (
            <div key={restaurant.id} className='flex items-center gap-1 text-xs shrink-0'>
              <div className='w-2 h-2 sm:w-3 sm:h-3 rounded' style={{ backgroundColor: restaurant.color }} />
              <span className='hidden md:inline'>{restaurant.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar - Full Height */}
      <div className='flex-1 min-h-0 sm:border sm:rounded-lg overflow-hidden'>
        {viewMode === 'month' && (
          <MonthView 
            currentDate={currentDate} 
            reservations={reservations} 
            onReservationClick={onReservationClick}
            onAddReservation={onAddReservation}
          />
        )}
        {viewMode === 'week' && (
          <WeekView currentDate={currentDate} reservations={reservations} onReservationClick={onReservationClick} />
        )}
        {viewMode === 'day' && (
          <DayView currentDate={currentDate} reservations={reservations} onReservationClick={onReservationClick} />
        )}
      </div>
    </div>
  )
}
