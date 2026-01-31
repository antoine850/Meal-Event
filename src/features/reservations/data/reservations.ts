import { faker } from '@faker-js/faker'
import { addDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'

faker.seed(11111)

export const reservationStatuses = [
  { value: 'confirmed', label: 'Confirmée', color: 'bg-green-500' },
  { value: 'pending', label: 'En attente', color: 'bg-yellow-500' },
  { value: 'cancelled', label: 'Annulée', color: 'bg-red-500' },
] as const

export type ReservationStatus = typeof reservationStatuses[number]['value']

export const restaurants = [
  { id: 'r1', name: 'Le Petit Bistro', color: '#3b82f6' },
  { id: 'r2', name: 'La Grande Table', color: '#22c55e' },
  { id: 'r3', name: 'Chez Marcel', color: '#f97316' },
  { id: 'r4', name: 'L\'Atelier Gourmand', color: '#8b5cf6' },
  { id: 'r5', name: 'Bistrot Là-Haut', color: '#ec4899' },
]

export const eventTypes = [
  'Anniversaire',
  'Mariage',
  'Séminaire',
  'Dîner d\'équipe',
  'Cocktail',
  'Baptême',
  'Communion',
  'Soirée privée',
]

export type Reservation = {
  id: string
  clientName: string
  clientEmail: string
  clientPhone: string
  date: Date
  startTime: string
  endTime: string
  guests: number
  eventType: string
  restaurant: typeof restaurants[number]
  status: ReservationStatus
  notes: string
  amountHT: number
}

// Generate reservations for the current month and next 2 months
const today = new Date()
const start = startOfMonth(today)
const end = endOfMonth(addDays(today, 90))
const allDays = eachDayOfInterval({ start, end })

export const reservations: Reservation[] = allDays.flatMap((day) => {
  // Random number of reservations per day (0-4)
  const numReservations = faker.number.int({ min: 0, max: 4 })
  
  return Array.from({ length: numReservations }, () => {
    const startHour = faker.number.int({ min: 11, max: 20 })
    const duration = faker.number.int({ min: 2, max: 4 })
    
    return {
      id: faker.string.uuid(),
      clientName: faker.company.name(),
      clientEmail: faker.internet.email(),
      clientPhone: faker.phone.number({ style: 'national' }),
      date: day,
      startTime: `${startHour.toString().padStart(2, '0')}:${faker.helpers.arrayElement(['00', '30'])}`,
      endTime: `${Math.min(startHour + duration, 23).toString().padStart(2, '0')}:${faker.helpers.arrayElement(['00', '30'])}`,
      guests: faker.number.int({ min: 8, max: 80 }),
      eventType: faker.helpers.arrayElement(eventTypes),
      restaurant: faker.helpers.arrayElement(restaurants),
      status: faker.helpers.arrayElement(reservationStatuses).value,
      notes: faker.lorem.sentence(),
      amountHT: faker.number.int({ min: 1000, max: 15000 }),
    }
  })
})

export const getReservationsForDate = (date: Date) => {
  return reservations.filter(r => 
    r.date.toDateString() === date.toDateString()
  )
}

export const getReservationsForDateRange = (start: Date, end: Date) => {
  return reservations.filter(r => 
    r.date >= start && r.date <= end
  )
}
