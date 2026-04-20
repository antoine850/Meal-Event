import { useMemo } from 'react'
import {
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Euro, TrendingUp, Users, Utensils, Loader2, Info } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  type DashboardTabProps,
  calcSignedRevenue,
  calcSignedCount,
  calcAvgTicket,
  calcConversionRate,
  calcPipeline,
  groupByRestaurant,
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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#a855f7']

interface GeneralTabProps extends DashboardTabProps {
  statuses?: { id: string; name: string; color: string; slug: string }[]
}

export function GeneralTab({ bookings, isLoading, restaurants, statuses = [] }: GeneralTabProps) {
  const signedRevenue = useMemo(() => calcSignedRevenue(bookings), [bookings])
  const signedCount = useMemo(() => calcSignedCount(bookings), [bookings])
  const avgTicket = useMemo(() => calcAvgTicket(bookings), [bookings])
  const conversionRate = useMemo(() => calcConversionRate(bookings), [bookings])

  const pipeline = useMemo(() => calcPipeline(bookings, statuses), [bookings, statuses])

  const restaurantKPIs = useMemo(() => {
    const groups = groupByRestaurant(bookings)
    return Object.entries(groups)
      .map(([name, items]) => ({
        name,
        revenue: calcSignedRevenue(items),
        bookings: items.length,
        avgTicket: calcAvgTicket(items),
        color: restaurants.find(r => r.name === name)?.color || null,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [bookings, restaurants])

  const pieData = useMemo(() =>
    restaurantKPIs.filter(r => r.revenue > 0).map(r => ({ name: r.name, value: r.revenue })),
    [restaurantKPIs]
  )

  const recentBookings = useMemo(() =>
    [...bookings]
      .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
      .slice(0, 5),
    [bookings]
  )

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
              <KpiTooltip text="Montant total TTC des devis signés (primary quote)" />
              <CardTitle className='text-sm font-medium'>CA Signé</CardTitle>
            </div>
            <Euro className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{signedRevenue.toLocaleString('fr-FR')} €</div>
            <p className='text-xs text-muted-foreground'>{signedCount} événements signés</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Nombre total d'événements sur la période (tous statuts)" />
              <CardTitle className='text-sm font-medium'>Événements</CardTitle>
            </div>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{bookings.length}</div>
            <p className='text-xs text-muted-foreground'>
              {bookings.reduce((sum, b) => sum + (b.guests_count || 0), 0).toLocaleString('fr-FR')} convives
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="CA signé / nombre d'événements signés" />
              <CardTitle className='text-sm font-medium'>Ticket moyen</CardTitle>
            </div>
            <Utensils className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{avgTicket.toLocaleString('fr-FR')} €</div>
            <p className='text-xs text-muted-foreground'>Par événement signé</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Événements avec devis signé / total (hors annulés)" />
              <CardTitle className='text-sm font-medium'>Taux de conversion</CardTitle>
            </div>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{conversionRate}%</div>
            <p className='text-xs text-muted-foreground'>Signés / total</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline by statuses */}
      {pipeline.length > 0 && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>Répartition des événements par statut</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Stacked bar */}
            <div className='mb-4'>
              <div className='flex h-3 w-full overflow-hidden rounded-full bg-muted'>
                {pipeline.map((stage) => {
                  const totalCount = pipeline.reduce((s, p) => s + p.count, 0)
                  const widthPercent = totalCount > 0 ? (stage.count / totalCount) * 100 : 0
                  if (widthPercent === 0) return null
                  return (
                    <div
                      key={stage.statusId}
                      className='h-full transition-all'
                      style={{ width: `${widthPercent}%`, backgroundColor: stage.color }}
                      title={`${stage.name}: ${stage.count}`}
                    />
                  )
                })}
              </div>
            </div>
            {/* Status grid */}
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {pipeline.map((stage) => (
                <div key={stage.statusId} className='flex items-center gap-3 rounded-lg border p-3'>
                  <div className='h-8 w-1 rounded-full shrink-0' style={{ backgroundColor: stage.color }} />
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium truncate'>{stage.name}</p>
                    <div className='flex items-baseline gap-2'>
                      <span className='text-lg font-bold'>{stage.count}</span>
                      <span className='text-xs text-muted-foreground'>
                        {stage.amount > 0 ? `${stage.amount.toLocaleString('fr-FR')} €` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader>
            <CardTitle>CA par restaurant</CardTitle>
            <CardDescription>Répartition du chiffre d'affaires signé</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width='100%' height={350}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx='50%'
                    cy='50%'
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={4}
                    dataKey='value'
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={restaurants.find(r => r.name === pieData[index].name)?.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${Number(value ?? 0).toLocaleString('fr-FR')} €`, 'CA']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className='text-sm text-muted-foreground text-center py-10'>Aucune donnée</p>
            )}
          </CardContent>
        </Card>

        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader>
            <CardTitle>Performance par restaurant</CardTitle>
            <CardDescription>CA signé, événements et ticket moyen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {restaurantKPIs.length > 0 ? restaurantKPIs.map((restaurant) => (
                <div key={restaurant.name} className='flex items-center gap-4'>
                  <Avatar className='h-9 w-9'>
                    <AvatarFallback className='bg-primary/10 text-primary'>
                      {restaurant.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                    <div className='space-y-1'>
                      <p className='text-sm font-medium leading-none'>{restaurant.name}</p>
                      <p className='text-xs text-muted-foreground'>
                        {restaurant.bookings} événements  Ø {restaurant.avgTicket.toLocaleString('fr-FR')} €
                      </p>
                    </div>
                    <div className='font-medium text-green-600'>
                      {restaurant.revenue.toLocaleString('fr-FR')} €
                    </div>
                  </div>
                </div>
              )) : (
                <p className='text-sm text-muted-foreground text-center py-4'>Aucune donnée</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <CardTitle>Derniers événements</CardTitle>
          <CardDescription>Les 5 derniers événements enregistrés</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {recentBookings.length > 0 ? recentBookings.map((booking) => {
              const contactName = booking.contact
                ? `${booking.contact.first_name} ${booking.contact.last_name || ''}`.trim()
                : 'Sans contact'
              const primaryQuote = booking.quotes?.find(q => q.primary_quote)
              const quoteTtc = primaryQuote?.total_ttc || 0
              return (
                <div key={booking.id} className='flex items-center gap-4'>
                  <Avatar className='h-9 w-9'>
                    <AvatarFallback>
                      {contactName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                    <div className='space-y-1'>
                      <p className='text-sm font-medium leading-none'>{contactName}</p>
                      <p className='text-xs text-muted-foreground'>
                        {booking.restaurant?.name || 'Sans restaurant'} • {booking.occasion || booking.event_type || ''}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
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
                      <span className='font-medium'>
                        {quoteTtc > 0 ? `${quoteTtc.toLocaleString('fr-FR')} €` : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            }) : (
              <p className='text-sm text-muted-foreground text-center py-4'>Aucun événement</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
