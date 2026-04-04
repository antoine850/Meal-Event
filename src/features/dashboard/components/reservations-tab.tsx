import { useMemo } from 'react'
import { format, parseISO, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar, CheckCircle, Clock, TrendingUp, Users, Loader2, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import {
  type DashboardTabProps,
  getReservationsByDayOfWeek,
  getReservationsByType,
  getMonthlyTrend,
} from '../hooks/use-dashboard-data'

function KpiTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger asChild>
          <Info className='h-3.5 w-3.5 text-muted-foreground cursor-help' />
        </TooltipTrigger>
        <TooltipContent side='bottom' className='max-w-[220px]'>
          <p className='text-xs'>{text}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  )
}

export function ReservationsTab({ bookings, isLoading }: DashboardTabProps) {
  const stats = useMemo(() => {
    const confirmed = bookings.filter(b =>
      b.status?.slug === 'confirme_fonctionnaire' || b.status?.slug === 'fonction_envoyee' || b.status?.slug === 'a_facturer' || b.status?.slug === 'cloture'
    ).length
    const pending = bookings.filter(b =>
      b.status?.slug === 'nouveau' || b.status?.slug === 'qualification' || b.status?.slug === 'proposition' || b.status?.slug === 'negociation' || b.status?.slug === 'attente_paiement' || b.status?.slug === 'relance_paiement'
    ).length
    const totalGuests = bookings.reduce((sum, b) => sum + (b.guests_count || 0), 0)

    return {
      total: bookings.length,
      confirmed,
      pending,
      totalGuests,
      avgGuests: bookings.length > 0 ? Math.round(totalGuests / bookings.length) : 0,
    }
  }, [bookings])

  const byDayOfWeek = useMemo(() => getReservationsByDayOfWeek(bookings), [bookings])
  const byType = useMemo(() => getReservationsByType(bookings), [bookings])
  const monthlyTrend = useMemo(() => getMonthlyTrend(bookings), [bookings])

  const upcomingBookings = useMemo(() => {
    const now = new Date()
    return bookings
      .filter(b => isAfter(parseISO(b.event_date), now))
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .slice(0, 5)
  }, [bookings])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* KPI Cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Nombre d'événements sur la période sélectionnée" />
              <CardTitle className='text-sm font-medium'>Total Événements</CardTitle>
            </div>
            <Calendar className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.total}</div>
            <p className='text-xs text-muted-foreground'>Sur la période sélectionnée</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Événements avec acompte payé ou plus avancé dans le pipeline" />
              <CardTitle className='text-sm font-medium'>Confirmées</CardTitle>
            </div>
            <CheckCircle className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>{stats.confirmed}</div>
            <p className='text-xs text-muted-foreground'>
              {stats.total > 0 ? ((stats.confirmed / stats.total) * 100).toFixed(0) : 0}% du total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Événements en cours de traitement (nouveau → relance paiement)" />
              <CardTitle className='text-sm font-medium'>En attente</CardTitle>
            </div>
            <Clock className='h-4 w-4 text-yellow-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-yellow-600'>{stats.pending}</div>
            <p className='text-xs text-muted-foreground'>À confirmer</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Somme des convives, tous événements confondus" />
              <CardTitle className='text-sm font-medium'>Total Convives</CardTitle>
            </div>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.totalGuests.toLocaleString('fr-FR')}</div>
            <p className='text-xs text-muted-foreground'>
              Moy. {stats.avgGuests} pers./événement
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
              <BarChart data={byDayOfWeek}>
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
            {byType.length > 0 ? (
              <ResponsiveContainer width='100%' height={250}>
                <PieChart>
                  <Pie
                    data={byType}
                    cx='50%'
                    cy='50%'
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey='value'
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {byType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value ?? 0} événements`, '']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className='text-sm text-muted-foreground text-center py-10'>Aucune donnée</p>
            )}
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
                    name === 'reservations' ? `${value ?? 0} événements` : `${(Number(value) ?? 0).toLocaleString('fr-FR')} €`,
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
            {upcomingBookings.length > 0 ? upcomingBookings.map((booking) => {
              const contactName = booking.contact
                ? `${booking.contact.first_name} ${booking.contact.last_name || ''}`.trim()
                : booking.contact_sur_place_societe || 'Sans contact'
              return (
                <div key={booking.id} className='flex items-center justify-between border-b pb-3 last:border-0 last:pb-0'>
                  <div className='flex-1 min-w-0'>
                    <p className='font-medium text-sm truncate'>{contactName}</p>
                    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                      <span>{format(parseISO(booking.event_date), 'EEE d MMM', { locale: fr })}</span>
                      {booking.start_time && (
                        <>
                          <span>•</span>
                          <span>{booking.start_time.slice(0, 5)}</span>
                        </>
                      )}
                      {booking.guests_count && (
                        <>
                          <span>•</span>
                          <span>{booking.guests_count} pers.</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {(booking.occasion || booking.event_type) && (
                      <Badge variant='outline' className='text-xs'>
                        {booking.occasion || booking.event_type}
                      </Badge>
                    )}
                    {booking.status && (
                      <Badge
                        variant='outline'
                        style={{
                          borderColor: booking.status.color,
                          color: booking.status.color,
                        }}
                      >
                        {booking.status.name}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            }) : (
              <p className='text-sm text-muted-foreground text-center py-4'>Aucun événement à venir</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
