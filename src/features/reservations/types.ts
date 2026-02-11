export type BookingWithRelations = {
  id: string
  organization_id: string | null
  restaurant_id: string | null
  contact_id: string | null
  status_id: string | null
  assigned_to: string | null
  space_id: string | null
  time_slot_id: string | null
  event_type: string | null
  event_date: string
  start_time: string | null
  end_time: string | null
  guests_count: number | null
  total_amount: number
  deposit_amount: number
  internal_notes: string | null
  client_notes: string | null
  created_at: string
  updated_at: string
  restaurant?: { id: string; name: string; color: string | null } | null
  contact?: { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null } | null
  status?: { id: string; name: string; color: string; slug: string } | null
  space?: { id: string; name: string } | null
  assigned_user?: { id: string; first_name: string; last_name: string } | null
}

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
    eventType: booking.event_type,
    restaurant: {
      id: booking.restaurant?.id || '',
      name: booking.restaurant?.name || 'Restaurant',
      color: booking.restaurant?.color || '#3b82f6',
    },
    status: booking.status?.slug || 'pending',
    statusColor: booking.status?.color || 'bg-gray-500',
    notes: booking.internal_notes,
    amountHT: booking.total_amount || 0,
  }
}
