import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import { Euro, Target, TrendingUp, Users } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  salesByCommercial,
  monthlyPerformanceByCommercial,
  commercials,
} from '../data/mock-data'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

export function CommercialTab() {
  const totalSales = salesByCommercial.reduce((acc, c) => acc + c.sales, 0)
  const totalBookings = salesByCommercial.reduce((acc, c) => acc + c.bookings, 0)
  const avgConversion = (salesByCommercial.reduce((acc, c) => acc + c.conversionRate, 0) / salesByCommercial.length).toFixed(1)

  const pieData = salesByCommercial.map((c) => ({
    name: c.name,
    value: c.sales,
  }))

  return (
    <div className='space-y-4'>
      {/* KPI Cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              CA Total Équipe
            </CardTitle>
            <Euro className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {totalSales.toLocaleString('fr-FR')} €
            </div>
            <p className='text-xs text-muted-foreground'>
              Réparti sur {commercials.length} commerciaux
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Événements traités
            </CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalBookings}</div>
            <p className='text-xs text-muted-foreground'>
              Ø {Math.round(totalBookings / commercials.length)} par commercial
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Taux de conversion moyen</CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{avgConversion}%</div>
            <p className='text-xs text-muted-foreground'>
              Leads → Événements confirmés
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Meilleur performeur
            </CardTitle>
            <Target className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>Sophie Martin</div>
            <p className='text-xs text-muted-foreground'>
              156 000 € de CA ce mois
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader>
            <CardTitle>Performance mensuelle</CardTitle>
            <CardDescription>CA par commercial sur les 6 derniers mois</CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={350}>
              <BarChart data={monthlyPerformanceByCommercial}>
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
                  formatter={(value) => [`${Number(value ?? 0).toLocaleString('fr-FR')} €`, '']}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Bar dataKey='Sophie Martin' fill='#3b82f6' radius={[4, 4, 0, 0]} />
                <Bar dataKey='Lucas Dubois' fill='#10b981' radius={[4, 4, 0, 0]} />
                <Bar dataKey='Emma Bernard' fill='#f59e0b' radius={[4, 4, 0, 0]} />
                <Bar dataKey='Thomas Petit' fill='#8b5cf6' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader>
            <CardTitle>Répartition du CA</CardTitle>
            <CardDescription>Part de chaque commercial dans le CA total</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx='50%'
                  cy='50%'
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey='value'
                  label={({ name, percent }) => `${(name ?? '').split(' ')[0]} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${Number(value ?? 0).toLocaleString('fr-FR')} €`, 'CA']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Commercial Details */}
      <Card>
        <CardHeader>
          <CardTitle>Détail par commercial</CardTitle>
          <CardDescription>Performance individuelle et objectifs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-6'>
            {salesByCommercial.map((commercial, index) => {
              const target = 180000
              const progress = (commercial.sales / target) * 100
              return (
                <div key={commercial.name} className='space-y-2'>
                  <div className='flex items-center gap-4'>
                    <Avatar className='h-10 w-10'>
                      <AvatarImage src={commercials[index]?.avatar} alt={commercial.name} />
                      <AvatarFallback style={{ backgroundColor: COLORS[index] + '20', color: COLORS[index] }}>
                        {commercials[index]?.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                      <div className='space-y-1'>
                        <p className='text-sm font-medium leading-none'>
                          {commercial.name}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {commercial.bookings} événements • {commercial.conversionRate}% conversion
                        </p>
                      </div>
                      <div className='text-right'>
                        <p className='font-medium'>
                          {commercial.sales.toLocaleString('fr-FR')} €
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          Objectif: {target.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Progress value={progress} className='h-2' />
                    <span className='text-xs text-muted-foreground w-12'>
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
