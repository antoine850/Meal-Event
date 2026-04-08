import { useMemo } from 'react'
import {
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Euro, TrendingUp, Users, Utensils, Loader2, Info, FileSignature } from 'lucide-react'
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
  calcRevenue,
  calcAvgTicket,
  calcConversionRate,
  calcSignatureRate,
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

export function GeneralTab({ bookings, isLoading, restaurants }: DashboardTabProps) {
  const totalRevenue = useMemo(() => calcRevenue(bookings), [bookings])
  const avgTicket = useMemo(() => calcAvgTicket(bookings), [bookings])
  const signatureRate = useMemo(() => calcSignatureRate(bookings), [bookings])
  const conversionRate = useMemo(() => calcConversionRate(bookings), [bookings])

  const restaurantKPIs = useMemo(() => {
    const groups = groupByRestaurant(bookings)
    return Object.entries(groups)
      .map(([name, items]) => ({
        name,
        revenue: calcRevenue(items),
        bookings: items.length,
        avgTicket: calcAvgTicket(items),
        color: restaurants.find(r => r.name === name)?.color || null,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [bookings, restaurants])

  const pieData = useMemo(() =>
    restaurantKPIs.map(r => ({ name: r.name, value: r.revenue })),
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
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Somme des paiements encaissés (acomptes + soldes + extras) sur les événements confirmés" />
              <CardTitle className='text-sm font-medium'>CA encaissé</CardTitle>
            </div>
            <Euro className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalRevenue.toLocaleString('fr-FR')} €</div>
            <p className='text-xs text-muted-foreground'>{bookings.length} événements</p>
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
              <KpiTooltip text="CA encaissé / nombre d'événements confirmés" />
              <CardTitle className='text-sm font-medium'>Panier moyen</CardTitle>
            </div>
            <Utensils className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{avgTicket.toLocaleString('fr-FR')} €</div>
            <p className='text-xs text-muted-foreground'>Par événement confirmé</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Événements avec devis signé / total (hors annulés)" />
              <CardTitle className='text-sm font-medium'>Taux de signature</CardTitle>
            </div>
            <FileSignature className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{signatureRate}%</div>
            <p className='text-xs text-muted-foreground'>Devis signés / total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Événements avec acompte reçu / total (hors annulés)" />
              <CardTitle className='text-sm font-medium'>Taux de conversion</CardTitle>
            </div>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{conversionRate}%</div>
            <p className='text-xs text-muted-foreground'>Acompte reçu / total</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader>
            <CardTitle>CA par restaurant</CardTitle>
            <CardDescription>Répartition du chiffre d'affaires</CardDescription>
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
            <CardDescription>CA, événements et panier moyen</CardDescription>
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
                        {(booking.payments?.filter(p => p.status === 'paid' || p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0) || 0).toLocaleString('fr-FR')} €
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
