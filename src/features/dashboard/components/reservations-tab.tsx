import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Link, useSearch } from '@tanstack/react-router'
import { fr } from 'date-fns/locale'
import {
  Calendar,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  Info,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { type DashboardTabProps } from '../hooks/use-dashboard-data'
import {
  buildEventsSearch,
  confirmedSearch,
  pendingSearch,
  type DashboardSearch,
} from '../lib/events-drill-down'

function KpiTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger asChild>
          <Info className='h-3.5 w-3.5 cursor-help text-muted-foreground' />
        </TooltipTrigger>
        <TooltipContent side='bottom' className='max-w-[220px]'>
          <p className='text-xs'>{text}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  )
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const TYPE_COLORS = [
  '#f97316',
  '#ec4899',
  '#3b82f6',
  '#22c55e',
  '#8b5cf6',
  '#14b8a6',
  '#f43f5e',
  '#a855f7',
]

export function ReservationsTab({
  aggregates,
  actionLists,
  isLoading,
}: DashboardTabProps) {
  const dash = useSearch({ strict: false }) as DashboardSearch

  const stats = {
    total: aggregates?.total ?? 0,
    confirmed: aggregates?.confirmed ?? 0,
    pending: aggregates?.pending ?? 0,
    totalGuests: aggregates?.total_guests ?? 0,
    avgGuests: aggregates?.avg_guests ?? 0,
  }

  const byDayOfWeek = useMemo(
    () =>
      (aggregates?.by_day_of_week ?? [])
        .slice()
        .sort((a, b) => a.dow - b.dow)
        .map((d) => ({
          day: DAY_LABELS[d.dow - 1],
          reservations: d.reservations,
          guests: d.guests,
        })),
    [aggregates]
  )

  const byType = useMemo(
    () =>
      (aggregates?.by_type ?? []).map((t, i) => ({
        ...t,
        color: TYPE_COLORS[i % TYPE_COLORS.length],
      })),
    [aggregates]
  )

  const monthlyTrend = useMemo(
    () =>
      (aggregates?.monthly_trend ?? []).map((m) => ({
        month: format(parseISO(`${m.month}-01`), 'MMM', { locale: fr }),
        reservations: m.reservations,
        revenue: m.revenue,
      })),
    [aggregates]
  )

  const upcomingBookings = actionLists?.upcoming_bookings ?? []

  if (isLoading) {
    return (
      <div className='space-y-4'>
        {/* KPI Cards */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-4 w-4 rounded-full' />
              </CardHeader>
              <CardContent>
                <Skeleton className='mb-2 h-8 w-20' />
                <Skeleton className='h-3 w-36' />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Charts Row */}
        <div className='grid gap-4 lg:grid-cols-7'>
          <Card className='lg:col-span-4'>
            <CardHeader>
              <Skeleton className='h-5 w-56' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-[250px] w-full' />
            </CardContent>
          </Card>
          <Card className='lg:col-span-3'>
            <CardHeader>
              <Skeleton className='h-5 w-40' />
            </CardHeader>
            <CardContent className='flex items-center justify-center'>
              <Skeleton className='h-[280px] w-[280px] rounded-full' />
            </CardContent>
          </Card>
        </div>
        {/* Trend & Upcoming */}
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <Skeleton className='h-5 w-40' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-[200px] w-full' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className='h-5 w-44' />
            </CardHeader>
            <CardContent className='space-y-3'>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className='flex items-center gap-3'>
                  <Skeleton className='h-10 w-10 rounded-md' />
                  <div className='flex-1 space-y-1'>
                    <Skeleton className='h-4 w-36' />
                    <Skeleton className='h-3 w-24' />
                  </div>
                  <Skeleton className='h-5 w-16 rounded-full' />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* KPI Cards — drill-down vers /evenements */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Link
          to='/evenements'
          search={buildEventsSearch(dash)}
          className='block'
        >
          <Card className='h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <div className='flex items-center gap-1.5'>
                <KpiTooltip text="Nombre d'événements sur la période sélectionnée" />
                <CardTitle className='text-sm font-medium'>
                  Total Événements
                </CardTitle>
              </div>
              <Calendar className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.total}</div>
              <p className='text-xs text-muted-foreground'>
                Sur la période sélectionnée
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to='/evenements' search={confirmedSearch(dash)} className='block'>
          <Card className='h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <div className='flex items-center gap-1.5'>
                <KpiTooltip text='Événements avec acompte payé ou plus avancé dans le pipeline' />
                <CardTitle className='text-sm font-medium'>
                  Confirmées
                </CardTitle>
              </div>
              <CheckCircle className='h-4 w-4 text-green-500' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-green-600'>
                {stats.confirmed}
              </div>
              <p className='text-xs text-muted-foreground'>
                {stats.total > 0
                  ? ((stats.confirmed / stats.total) * 100).toFixed(0)
                  : 0}
                % du total
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to='/evenements' search={pendingSearch(dash)} className='block'>
          <Card className='h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <div className='flex items-center gap-1.5'>
                <KpiTooltip text='Événements en cours de traitement (nouveau → relance paiement)' />
                <CardTitle className='text-sm font-medium'>
                  En attente
                </CardTitle>
              </div>
              <Clock className='h-4 w-4 text-yellow-500' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-yellow-600'>
                {stats.pending}
              </div>
              <p className='text-xs text-muted-foreground'>À confirmer</p>
            </CardContent>
          </Card>
        </Link>
        <Link
          to='/evenements'
          search={buildEventsSearch(dash)}
          className='block'
        >
          <Card className='h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <div className='flex items-center gap-1.5'>
                <KpiTooltip text='Somme des convives, tous événements confondus' />
                <CardTitle className='text-sm font-medium'>
                  Total Convives
                </CardTitle>
              </div>
              <Users className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {stats.totalGuests.toLocaleString('fr-FR')}
              </div>
              <p className='text-xs text-muted-foreground'>
                Moy. {stats.avgGuests} pers./événement
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts Row */}
      <div className='grid gap-4 lg:grid-cols-7'>
        {/* Reservations by Day */}
        <Card className='lg:col-span-4'>
          <CardHeader>
            <CardTitle className='text-base'>
              Événements par jour de la semaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <BarChart data={byDayOfWeek}>
                <XAxis
                  dataKey='day'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value, name) => [
                    name === 'reservations'
                      ? `${value ?? 0} événements`
                      : `${value ?? 0} convives`,
                    name === 'reservations' ? 'Événements' : 'Convives',
                  ]}
                />
                <Bar
                  dataKey='reservations'
                  fill='#3b82f6'
                  radius={[4, 4, 0, 0]}
                />
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
              <ResponsiveContainer width='100%' height={280}>
                <PieChart>
                  <Pie
                    data={byType}
                    cx='50%'
                    cy='45%'
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey='value'
                  >
                    {byType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value ?? 0} événements`, '']}
                  />
                  <Legend
                    verticalAlign='bottom'
                    height={36}
                    iconType='circle'
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className='py-10 text-center text-sm text-muted-foreground'>
                Aucune donnée
              </p>
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
                <XAxis
                  dataKey='month'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value, name) => [
                    name === 'reservations'
                      ? `${value ?? 0} événements`
                      : `${(Number(value) ?? 0).toLocaleString('fr-FR')} €`,
                    name === 'reservations' ? 'Événements' : 'CA HT',
                  ]}
                />
                <Line
                  type='monotone'
                  dataKey='reservations'
                  stroke='#3b82f6'
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type='monotone'
                  dataKey='revenue'
                  stroke='#22c55e'
                  strokeWidth={2}
                  dot={false}
                />
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
            {upcomingBookings.length > 0 ? (
              upcomingBookings.map((booking) => {
                const contactName = booking.contact_name || 'Sans contact'
                return (
                  <div
                    key={booking.id}
                    className='flex items-center justify-between border-b pb-3 last:border-0 last:pb-0'
                  >
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-medium'>
                        {contactName}
                      </p>
                      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <span>
                          {format(parseISO(booking.event_date), 'EEE d MMM', {
                            locale: fr,
                          })}
                        </span>
                        {booking.start_time && (
                          <>
                            <span>•</span>
                            <span>{booking.start_time.slice(0, 5)}</span>
                          </>
                        )}
                        {booking.guests > 0 && (
                          <>
                            <span>•</span>
                            <span>{booking.guests} pers.</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      {booking.kind && (
                        <Badge variant='outline' className='text-xs'>
                          {booking.kind}
                        </Badge>
                      )}
                      {booking.status_name && (
                        <Badge
                          variant='outline'
                          style={{
                            borderColor: booking.status_color || undefined,
                            color: booking.status_color || undefined,
                          }}
                        >
                          {booking.status_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <p className='py-4 text-center text-sm text-muted-foreground'>
                Aucun événement à venir
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
