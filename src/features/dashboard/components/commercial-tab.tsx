import { useMemo } from 'react'
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
import { Euro, Target, TrendingUp, Users, Loader2, Info } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  type DashboardTabProps,
  calcRevenue,
  calcConversionRate,
  groupByUser,
  getMonthlyRevenueByCommercial,
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

export function CommercialTab({ bookings, users, isLoading }: DashboardTabProps) {
  const commercialStats = useMemo(() => {
    const groups = groupByUser(bookings, users)
    return Object.entries(groups)
      .filter(([key]) => key !== 'unassigned')
      .map(([, data]) => ({
        name: data.user ? `${data.user.first_name} ${data.user.last_name}` : 'Inconnu',
        initials: data.user ? `${data.user.first_name?.[0] || ''}${data.user.last_name?.[0] || ''}`.toUpperCase() || '??' : '??',
        sales: calcRevenue(data.bookings),
        bookings: data.bookings.length,
        conversionRate: calcConversionRate(data.bookings),
      }))
      .sort((a, b) => b.sales - a.sales)
  }, [bookings])

  const totalSales = useMemo(() => commercialStats.reduce((acc, c) => acc + c.sales, 0), [commercialStats])
  const totalBookings = useMemo(() => commercialStats.reduce((acc, c) => acc + c.bookings, 0), [commercialStats])
  const avgConversion = useMemo(() => {
    if (totalBookings === 0) return '0'
    return calcConversionRate(bookings).toFixed(1)
  }, [bookings, totalBookings])

  const bestPerformer = commercialStats[0]

  const pieData = useMemo(() =>
    commercialStats.map(c => ({ name: c.name, value: c.sales })),
    [commercialStats]
  )

  const monthlyData = useMemo(() => getMonthlyRevenueByCommercial(bookings, users), [bookings, users])
  const commercialNames = useMemo(() => commercialStats.map(c => c.name), [commercialStats])

  // Dynamic target: max commercial sales * 1.2 rounded to nearest 10k
  const target = useMemo(() => {
    if (commercialStats.length === 0) return 100000
    const maxSales = Math.max(...commercialStats.map(c => c.sales))
    return Math.ceil((maxSales * 1.2) / 10000) * 10000
  }, [commercialStats])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (commercialStats.length === 0) {
    return (
      <div className='flex items-center justify-center py-20'>
        <p className='text-muted-foreground'>Aucune donnée commerciale disponible</p>
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
              <KpiTooltip text="CA cumulé des événements confirmés assignés à l'équipe" />
              <CardTitle className='text-sm font-medium'>CA Total Équipe</CardTitle>
            </div>
            <Euro className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalSales.toLocaleString('fr-FR')} €</div>
            <p className='text-xs text-muted-foreground'>
              Réparti sur {commercialStats.length} commerciaux
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Nombre total d'événements assignés (tous statuts)" />
              <CardTitle className='text-sm font-medium'>Événements traités</CardTitle>
            </div>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalBookings}</div>
            <p className='text-xs text-muted-foreground'>
              Ø {commercialStats.length > 0 ? Math.round(totalBookings / commercialStats.length) : 0} par commercial
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Moyenne pondérée : total confirmés / total non-annulés" />
              <CardTitle className='text-sm font-medium'>Taux de conversion</CardTitle>
            </div>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{avgConversion}%</div>
            <p className='text-xs text-muted-foreground'>Acompte reçu / total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Commercial avec le plus de CA confirmé" />
              <CardTitle className='text-sm font-medium'>Meilleur performeur</CardTitle>
            </div>
            <Target className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold truncate'>{bestPerformer?.name || '-'}</div>
            <p className='text-xs text-muted-foreground'>
              {bestPerformer ? `${bestPerformer.sales.toLocaleString('fr-FR')} € de CA` : '-'}
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
              <BarChart data={monthlyData}>
                <XAxis dataKey='month' stroke='#888888' fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke='#888888' fontSize={12} tickLine={false} axisLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k€`}
                />
                <Tooltip formatter={(value) => [`${Number(value ?? 0).toLocaleString('fr-FR')} €`, '']} />
                <Legend />
                {commercialNames.map((name, i) => (
                  <Bar key={name} dataKey={name} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
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
            {commercialStats.map((commercial, index) => {
              const progress = target > 0 ? (commercial.sales / target) * 100 : 0
              return (
                <div key={commercial.name} className='space-y-2'>
                  <div className='flex items-center gap-4'>
                    <Avatar className='h-10 w-10'>
                      <AvatarFallback style={{ backgroundColor: COLORS[index % COLORS.length] + '20', color: COLORS[index % COLORS.length] }}>
                        {commercial.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                      <div className='space-y-1'>
                        <p className='text-sm font-medium leading-none'>{commercial.name}</p>
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
                    <Progress value={Math.min(progress, 100)} className='h-2' />
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
