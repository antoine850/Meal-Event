// Import types from use-bookings to avoid duplication
import type { BookingWithRelations } from './hooks/use-bookings'

export type { BookingWithRelations }

export type Reservation = {
  id: string
  clientName: string
  clientEmail: string | null
  clientPhone: string | null
  date: Date
  startTime: string
  endTime: string
  guests: number
  eventType: string | null
  restaurant: { id: string; name: string; color: string }
  status: string
  statusColor: string
  notes: string | null
  amountHT: number
}

export function bookingToReservation(booking: BookingWithRelations): Reservation {
  return {
    id: booking.id,
    clientName: booking.contact 
      ? `${booking.contact.first_name} ${booking.contact.last_name || ''}`.trim()
      : 'Client inconnu',
    clientEmail: booking.contact?.email || null,
    clientPhone: booking.contact?.phone || null,
    date: new Date(booking.event_date),
    startTime: booking.start_time || '12:00',
    endTime: booking.end_time || '14:00',
    guests: booking.guests_count || 0,
    eventType: booking.occasion || null,
    restaurant: {
      id: booking.restaurant?.id || '',
      name: booking.restaurant?.name || 'Restaurant',
      color: booking.restaurant?.color || '#3b82f6',
    },
    status: booking.status?.slug || 'pending',
    statusColor: booking.status?.color || 'bg-gray-500',
    notes: booking.commentaires || null,
    amountHT: 0,
  }
}
