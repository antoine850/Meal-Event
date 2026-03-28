import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from '@tanstack/react-router'
import { Users, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BookingWithRelations } from '../hooks/use-bookings'

type StatusColumn = {
  slug: string
  name: string
  color: string
  bookings: BookingWithRelations[]
}

type PipelineViewProps = {
  bookings: BookingWithRelations[]
  statuses: Array<{ id: string; name: string; slug: string; color: string | null; position: number }>
}

export function PipelineView({ bookings, statuses }: PipelineViewProps) {
  const navigate = useNavigate()
  const [activeStatus, setActiveStatus] = useState<string | null>(null)

  const columns = useMemo<StatusColumn[]>(() => {
    return statuses
      .sort((a, b) => a.position - b.position)
      .map(status => ({
        slug: status.slug,
        name: status.name,
        color: status.color || '#6b7280',
        bookings: bookings.filter(b => b.status?.slug === status.slug),
      }))
  }, [bookings, statuses])

  const visibleColumns = activeStatus
    ? columns.filter(c => c.slug === activeStatus)
    : columns

  return (
    <div className='space-y-4'>
      {/* Status summary cards */}
      {/* Mobile: Dropdown */}
      <div className='sm:hidden'>
        <Select
          value={activeStatus || 'all'}
          onValueChange={(value) => setActiveStatus(value === 'all' ? null : value)}
        >
          <SelectTrigger className='w-full'>
            <SelectValue>
              {activeStatus ? (
                <div className='flex items-center gap-2'>
                  <div
                    className='w-3 h-3 rounded-full'
                    style={{ backgroundColor: columns.find(c => c.slug === activeStatus)?.color || '#6b7280' }}
                  />
                  <span>{columns.find(c => c.slug === activeStatus)?.name} ({columns.find(c => c.slug === activeStatus)?.bookings.length})</span>
                </div>
              ) : (
                <span>Tous les statuts ({bookings.length})</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>
              <span>Tous les statuts ({bookings.length})</span>
            </SelectItem>
            {columns.map((col) => (
              <SelectItem key={col.slug} value={col.slug}>
                <div className='flex items-center gap-2'>
                  <div className='w-3 h-3 rounded-full' style={{ backgroundColor: col.color }} />
                  <span>{col.name} ({col.bookings.length})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Cards Grid */}
      <div className='hidden sm:grid gap-2 w-full' style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((col) => (
          <button
            key={col.slug}
            onClick={() => setActiveStatus(activeStatus === col.slug ? null : col.slug)}
            className={cn(
              'flex flex-col items-start rounded-lg border p-3 text-left transition-all hover:shadow-md hover:opacity-90',
              activeStatus === col.slug && 'ring-2 ring-primary ring-offset-2'
            )}
            style={{
              borderTopWidth: '3px',
              borderTopColor: col.color,
            }}
          >
            <span className='text-2xl font-bold' style={{ color: col.color }}>{col.bookings.length}</span>
            <span className='text-xs text-muted-foreground truncate w-full'>{col.name}</span>
          </button>
        ))}
      </div>

      {/* Pipeline columns with booking cards */}
      <div
        className='grid gap-3 min-h-[400px]'
        style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))` }}
      >
        {visibleColumns.map((col) => (
          <div key={col.slug} className='space-y-2'>
            {/* Column header */}
            <div
              className='flex items-center justify-between px-3 py-2 rounded-t-lg border-b-2'
              style={{ borderBottomColor: col.color, backgroundColor: col.color + '10' }}
            >
              <span className='text-sm font-semibold truncate' style={{ color: col.color }}>{col.name}</span>
              <span
                className='text-xs font-bold px-2 py-0.5 rounded-full text-white'
                style={{ backgroundColor: col.color }}
              >
                {col.bookings.length}
              </span>
            </div>

            {/* Booking cards */}
            <div className='space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1'>
              {col.bookings.length === 0 ? (
                <div className='flex items-center justify-center py-8 text-xs text-muted-foreground'>
                  Aucun événement
                </div>
              ) : (
                col.bookings
                  .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
                  .map((booking) => (
                    <button
                      key={booking.id}
                      onClick={() => navigate({ to: '/reservations/booking/$id', params: { id: booking.id } })}
                      className='w-full text-left border rounded-lg p-3 space-y-1.5 hover:shadow-md hover:border-gray-300 transition-all bg-card cursor-pointer'
                    >
                      {/* Client name */}
                      <p className='text-sm font-medium truncate'>
                        {booking.contact
                          ? `${booking.contact.first_name} ${booking.contact.last_name || ''}`.trim()
                          : 'Client inconnu'}
                      </p>

                      {/* Event info row */}
                      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <CalendarDays className='h-3 w-3 flex-shrink-0' />
                        <span>{format(new Date(booking.event_date), 'dd MMM yyyy', { locale: fr })}</span>
                        {booking.start_time && <span>• {booking.start_time.slice(0, 5)}</span>}
                      </div>

                      {/* Guests + Amount */}
                      <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                        {booking.guests_count && (
                          <span className='flex items-center gap-1'>
                            <Users className='h-3 w-3' />
                            {booking.guests_count}
                          </span>
                        )}
                        {booking.occasion && (
                          <span className='truncate'>{booking.occasion}</span>
                        )}
                      </div>

                      {/* Restaurant badge */}
                      {booking.restaurant && (
                        <div className='flex items-center gap-1.5'>
                          <div
                            className='w-2 h-2 rounded-full flex-shrink-0'
                            style={{ backgroundColor: booking.restaurant.color || '#3b82f6' }}
                          />
                          <span className='text-[10px] text-muted-foreground truncate'>{booking.restaurant.name}</span>
                        </div>
                      )}
                    </button>
                  ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
