import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { Euro, TrendingUp, Users, Utensils } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  globalKPIs,
  monthlySalesByRestaurant,
  restaurantKPIs,
  recentBookings,
} from '../data/mock-data'

export function GeneralTab() {
  return (
    <div className='space-y-4'>
      {/* KPI Cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Chiffre d'affaires total
            </CardTitle>
            <Euro className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {globalKPIs.totalRevenue.toLocaleString('fr-FR')} €
            </div>
            <p className='text-xs text-muted-foreground'>
              <span className='text-green-600'>+{globalKPIs.revenueGrowth}%</span> vs mois dernier
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Réservations
            </CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{globalKPIs.totalBookings}</div>
            <p className='text-xs text-muted-foreground'>
              <span className='text-green-600'>+{globalKPIs.bookingsGrowth}%</span> vs mois dernier
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Panier moyen</CardTitle>
            <Utensils className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {globalKPIs.averageTicket.toLocaleString('fr-FR')} €
            </div>
            <p className='text-xs text-muted-foreground'>
              <span className='text-green-600'>+{globalKPIs.ticketGrowth}%</span> vs mois dernier
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Taux de conversion
            </CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{globalKPIs.conversionRate}%</div>
            <p className='text-xs text-muted-foreground'>
              <span className='text-green-600'>+{globalKPIs.conversionGrowth}%</span> vs mois dernier
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader>
            <CardTitle>CA par restaurant</CardTitle>
            <CardDescription>Évolution mensuelle du chiffre d'affaires</CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={350}>
              <BarChart data={monthlySalesByRestaurant}>
                <XAxis
                  dataKey='month'
                  stroke='#888888'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke='#888888'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k€`}
                />
                <Tooltip
                  formatter={(value) => [`${(value ?? 0).toLocaleString('fr-FR')} €`, '']}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Bar dataKey='Le Petit Bistro' fill='#3b82f6' radius={[4, 4, 0, 0]} />
                <Bar dataKey='La Grande Table' fill='#10b981' radius={[4, 4, 0, 0]} />
                <Bar dataKey='Chez Marcel' fill='#f59e0b' radius={[4, 4, 0, 0]} />
                <Bar dataKey="L'Atelier Gourmand" fill='#8b5cf6' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader>
            <CardTitle>Performance par restaurant</CardTitle>
            <CardDescription>CA, réservations et panier moyen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {restaurantKPIs.map((restaurant) => (
                <div key={restaurant.name} className='flex items-center gap-4'>
                  <Avatar className='h-9 w-9'>
                    <AvatarFallback className='bg-primary/10 text-primary'>
                      {restaurant.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                    <div className='space-y-1'>
                      <p className='text-sm font-medium leading-none'>
                        {restaurant.name}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {restaurant.bookings} réservations • Ø {restaurant.avgTicket.toLocaleString('fr-FR')} €
                      </p>
                    </div>
                    <div className='font-medium text-green-600'>
                      {restaurant.revenue.toLocaleString('fr-FR')} €
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <CardTitle>Dernières réservations</CardTitle>
          <CardDescription>Les 5 dernières réservations enregistrées</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {recentBookings.map((booking) => (
              <div key={booking.id} className='flex items-center gap-4'>
                <Avatar className='h-9 w-9'>
                  <AvatarFallback>
                    {booking.client.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                  <div className='space-y-1'>
                    <p className='text-sm font-medium leading-none'>
                      {booking.client}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {booking.restaurant} • {booking.source}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      booking.status === 'paid' 
                        ? 'bg-green-100 text-green-700' 
                        : booking.status === 'confirmed'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {booking.status === 'paid' ? 'Payé' : booking.status === 'confirmed' ? 'Confirmé' : 'En attente'}
                    </span>
                    <span className='font-medium'>
                      {booking.amount.toLocaleString('fr-FR')} €
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
