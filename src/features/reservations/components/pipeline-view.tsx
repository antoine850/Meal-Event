import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useNavigate } from '@tanstack/react-router'
import { fr } from 'date-fns/locale'
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
  statuses: Array<{
    id: string
    name: string
    slug: string
    color: string | null
    position: number
  }>
}

export function PipelineView({ bookings, statuses }: PipelineViewProps) {
  const navigate = useNavigate()
  const [activeStatus, setActiveStatus] = useState<string | null>(null)

  const columns = useMemo<StatusColumn[]>(() => {
    return statuses
      .sort((a, b) => a.position - b.position)
      .map((status) => ({
        slug: status.slug,
        name: status.name,
        color: status.color || '#6b7280',
        bookings: bookings.filter((b) => b.status?.slug === status.slug),
      }))
  }, [bookings, statuses])

  const visibleColumns = activeStatus
    ? columns.filter((c) => c.slug === activeStatus)
    : columns

  return (
    <div className='space-y-4'>
      {/* Status summary cards */}
      {/* Mobile: Dropdown */}
      <div className='sm:hidden'>
        <Select
          value={activeStatus || 'all'}
          onValueChange={(value) =>
            setActiveStatus(value === 'all' ? null : value)
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue>
              {activeStatus ? (
                <div className='flex items-center gap-2'>
                  <div
                    className='h-3 w-3 rounded-full'
                    style={{
                      backgroundColor:
                        columns.find((c) => c.slug === activeStatus)?.color ||
                        '#6b7280',
                    }}
                  />
                  <span>
                    {columns.find((c) => c.slug === activeStatus)?.name} (
                    {
                      columns.find((c) => c.slug === activeStatus)?.bookings
                        .length
                    }
                    )
                  </span>
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
                  <div
                    className='h-3 w-3 rounded-full'
                    style={{ backgroundColor: col.color }}
                  />
                  <span>
                    {col.name} ({col.bookings.length})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Cards Grid */}
      <div
        className='hidden w-full gap-2 sm:grid'
        style={{
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
        }}
      >
        {columns.map((col) => (
          <button
            key={col.slug}
            onClick={() =>
              setActiveStatus(activeStatus === col.slug ? null : col.slug)
            }
            className={cn(
              'flex flex-col items-start rounded-lg border p-3 text-left transition-all hover:opacity-90 hover:shadow-md',
              activeStatus === col.slug && 'ring-2 ring-primary ring-offset-2'
            )}
            style={{
              borderTopWidth: '3px',
              borderTopColor: col.color,
            }}
          >
            <span className='text-2xl font-bold' style={{ color: col.color }}>
              {col.bookings.length}
            </span>
            <span className='w-full truncate text-xs text-muted-foreground'>
              {col.name}
            </span>
          </button>
        ))}
      </div>

      {/* Pipeline columns with booking cards */}
      <div
        className='grid min-h-[400px] gap-3'
        style={{
          gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))`,
        }}
      >
        {visibleColumns.map((col) => (
          <div key={col.slug} className='space-y-2'>
            {/* Column header */}
            <div
              className='flex items-center justify-between rounded-t-lg border-b-2 px-3 py-2'
              style={{
                borderBottomColor: col.color,
                backgroundColor: col.color + '10',
              }}
            >
              <span
                className='truncate text-sm font-semibold'
                style={{ color: col.color }}
              >
                {col.name}
              </span>
              <span
                className='rounded-full px-2 py-0.5 text-xs font-bold text-white'
                style={{ backgroundColor: col.color }}
              >
                {col.bookings.length}
              </span>
            </div>

            {/* Booking cards */}
            <div className='max-h-[calc(100vh-320px)] space-y-2 overflow-y-auto pr-1'>
              {col.bookings.length === 0 ? (
                <div className='flex items-center justify-center py-8 text-xs text-muted-foreground'>
                  Aucun événement
                </div>
              ) : (
                col.bookings
                  .sort(
                    (a, b) =>
                      new Date(a.event_date).getTime() -
                      new Date(b.event_date).getTime()
                  )
                  .map((booking) => (
                    <button
                      key={booking.id}
                      onClick={() =>
                        navigate({
                          to: '/reservations/booking/$id',
                          params: { id: booking.id },
                        })
                      }
                      className='w-full cursor-pointer space-y-1.5 rounded-lg border bg-card p-3 text-left transition-all hover:border-gray-300 hover:shadow-md'
                    >
                      {/* Client name */}
                      <p className='truncate text-sm font-medium'>
                        {booking.contact
                          ? `${booking.contact.first_name} ${booking.contact.last_name || ''}`.trim()
                          : 'Client inconnu'}
                      </p>

                      {/* Event info row */}
                      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <CalendarDays className='h-3 w-3 flex-shrink-0' />
                        <span>
                          {format(new Date(booking.event_date), 'dd MMM yyyy', {
                            locale: fr,
                          })}
                        </span>
                        {booking.start_time && (
                          <span>• {booking.start_time.slice(0, 5)}</span>
                        )}
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
                            className='h-2 w-2 flex-shrink-0 rounded-full'
                            style={{
                              backgroundColor:
                                booking.restaurant.color || '#3b82f6',
                            }}
                          />
                          <span className='truncate text-[10px] text-muted-foreground'>
                            {booking.restaurant.name}
                          </span>
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
