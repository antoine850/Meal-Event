import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar, CheckCircle, Clock, TrendingUp, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// Mock data for reservations
const reservationStats = {
  totalReservations: 156,
  confirmedReservations: 98,
  pendingReservations: 42,
  cancelledReservations: 16,
  totalGuests: 2840,
  avgGuestsPerReservation: 18,
}

const reservationsByDay = [
  { day: 'Lun', reservations: 12, guests: 180 },
  { day: 'Mar', reservations: 8, guests: 120 },
  { day: 'Mer', reservations: 15, guests: 240 },
  { day: 'Jeu', reservations: 18, guests: 320 },
  { day: 'Ven', reservations: 28, guests: 520 },
  { day: 'Sam', reservations: 45, guests: 890 },
  { day: 'Dim', reservations: 30, guests: 570 },
]

const reservationsByType = [
  { name: 'Anniversaire', value: 35, color: '#f97316' },
  { name: 'Mariage', value: 22, color: '#ec4899' },
  { name: 'Séminaire', value: 28, color: '#3b82f6' },
  { name: 'Dîner équipe', value: 18, color: '#22c55e' },
  { name: 'Autre', value: 53, color: '#8b5cf6' },
]

const monthlyTrend = [
  { month: 'Jan', reservations: 120, revenue: 85000 },
  { month: 'Fév', reservations: 135, revenue: 92000 },
  { month: 'Mar', reservations: 148, revenue: 105000 },
  { month: 'Avr', reservations: 142, revenue: 98000 },
  { month: 'Mai', reservations: 165, revenue: 118000 },
  { month: 'Juin', reservations: 156, revenue: 112000 },
]

const upcomingReservations = [
  { id: 'RES-001', company: 'Société ABC', date: new Date(2024, 0, 25), time: '19:30', guests: 25, status: 'confirmed', type: 'Séminaire' },
  { id: 'RES-002', company: 'Famille Dupont', date: new Date(2024, 0, 26), time: '12:00', guests: 45, status: 'confirmed', type: 'Anniversaire' },
  { id: 'RES-003', company: 'Tech Corp', date: new Date(2024, 0, 27), time: '20:00', guests: 18, status: 'pending', type: 'Dîner équipe' },
  { id: 'RES-004', company: 'Wedding Martin', date: new Date(2024, 0, 28), time: '18:00', guests: 80, status: 'confirmed', type: 'Mariage' },
  { id: 'RES-005', company: 'Startup XYZ', date: new Date(2024, 0, 29), time: '19:00', guests: 12, status: 'pending', type: 'Dîner équipe' },
]

const statusColors = {
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
}

const statusLabels = {
  confirmed: 'Confirmé',
  pending: 'En attente',
  cancelled: 'Annulé',
}

export function ReservationsTab() {
  return (
    <div className='space-y-4'>
      {/* KPI Cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Événements</CardTitle>
            <Calendar className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{reservationStats.totalReservations}</div>
            <p className='text-xs text-muted-foreground'>Ce mois-ci</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Confirmées</CardTitle>
            <CheckCircle className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>{reservationStats.confirmedReservations}</div>
            <p className='text-xs text-muted-foreground'>
              {((reservationStats.confirmedReservations / reservationStats.totalReservations) * 100).toFixed(0)}% du total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>En attente</CardTitle>
            <Clock className='h-4 w-4 text-yellow-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-yellow-600'>{reservationStats.pendingReservations}</div>
            <p className='text-xs text-muted-foreground'>À confirmer</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Convives</CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{reservationStats.totalGuests.toLocaleString('fr-FR')}</div>
            <p className='text-xs text-muted-foreground'>
              Moy. {reservationStats.avgGuestsPerReservation} pers./résa
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className='grid gap-4 lg:grid-cols-7'>
        {/* Reservations by Day */}
        <Card className='lg:col-span-4'>
          <CardHeader>
            <CardTitle className='text-base'>Événements par jour de la semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <BarChart data={reservationsByDay}>
                <XAxis dataKey='day' fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'reservations' ? `${value ?? 0} événements` : `${value ?? 0} convives`,
                    name === 'reservations' ? 'Événements' : 'Convives'
                  ]}
                />
                <Bar dataKey='reservations' fill='#3b82f6' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Reservations by Type */}
        <Card className='lg:col-span-3'>
          <CardHeader>
            <CardTitle className='text-base'>Par type d'événement</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <PieChart>
                <Pie
                  data={reservationsByType}
                  cx='50%'
                  cy='50%'
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey='value'
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {reservationsByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value ?? 0} événements`, '']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Trend & Upcoming */}
      <div className='grid gap-4 lg:grid-cols-2'>
        {/* Monthly Trend */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle className='text-base'>Tendance mensuelle</CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={200}>
              <LineChart data={monthlyTrend}>
                <XAxis dataKey='month' fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'reservations' ? `${value ?? 0} événements` : `${(value ?? 0).toLocaleString('fr-FR')} €`,
                    name === 'reservations' ? 'Événements' : 'CA'
                  ]}
                />
                <Line type='monotone' dataKey='reservations' stroke='#3b82f6' strokeWidth={2} dot={false} />
                <Line type='monotone' dataKey='revenue' stroke='#22c55e' strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Upcoming Reservations */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Prochains événements</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {upcomingReservations.map((reservation) => (
              <div key={reservation.id} className='flex items-center justify-between border-b pb-3 last:border-0 last:pb-0'>
                <div className='flex-1 min-w-0'>
                  <p className='font-medium text-sm truncate'>{reservation.company}</p>
                  <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                    <span>{format(reservation.date, 'EEE d MMM', { locale: fr })}</span>
                    <span>•</span>
                    <span>{reservation.time}</span>
                    <span>•</span>
                    <span>{reservation.guests} pers.</span>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <Badge variant='outline' className='text-xs'>
                    {reservation.type}
                  </Badge>
                  <Badge variant='outline' className={statusColors[reservation.status as keyof typeof statusColors]}>
                    {statusLabels[reservation.status as keyof typeof statusLabels]}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
