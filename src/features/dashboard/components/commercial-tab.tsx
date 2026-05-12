import { useMemo } from 'react'
import {
  Euro,
  Target,
  TrendingUp,
  Clock,
  Info,
  AlertTriangle,
} from 'lucide-react'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
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
  calcConversionRate,
  calcAvgTicket,
  groupByUser,
  getMonthlyRevenueByCommercial,
  getStaleProposals,
  useAvgResponseTime,
} from '../hooks/use-dashboard-data'

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

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
  '#a855f7',
]

export function CommercialTab({
  bookings,
  users,
  isLoading,
}: DashboardTabProps) {
  const commercialStats = useMemo(() => {
    const groups = groupByUser(bookings, users)
    return Object.entries(groups)
      .filter(([key]) => key !== 'unassigned')
      .map(([, data]) => ({
        name: data.user
          ? `${data.user.first_name} ${data.user.last_name}`
          : 'Inconnu',
        initials: data.user
          ? `${data.user.first_name?.[0] || ''}${data.user.last_name?.[0] || ''}`.toUpperCase() ||
            '??'
          : '??',
        sales: calcSignedRevenue(data.bookings),
        bookings: data.bookings.length,
        signed: calcSignedCount(data.bookings),
        conversionRate: calcConversionRate(data.bookings),
        avgTicket: calcAvgTicket(data.bookings),
      }))
      .sort((a, b) => b.sales - a.sales)
  }, [bookings, users])

  const totalSales = useMemo(() => calcSignedRevenue(bookings), [bookings])
  const avgConversion = useMemo(
    () => calcConversionRate(bookings).toFixed(1),
    [bookings]
  )

  const bestPerformer = commercialStats[0]

  const pieData = useMemo(() => {
    const items = commercialStats.map((c) => ({ name: c.name, value: c.sales }))
    const total = items.reduce((s, i) => s + i.value, 0)
    return items.map((i) => ({
      ...i,
      percent: total > 0 ? (i.value / total) * 100 : 0,
    }))
  }, [commercialStats])

  const monthlyData = useMemo(
    () => getMonthlyRevenueByCommercial(bookings, users),
    [bookings, users]
  )
  const commercialNames = useMemo(
    () => commercialStats.map((c) => c.name),
    [commercialStats]
  )

  const staleProposals = useMemo(() => getStaleProposals(bookings), [bookings])
  const { data: responseTimeData } = useAvgResponseTime(bookings)

  const responseTimeLabel = useMemo(() => {
    if (!responseTimeData) return null
    const { avgHours } = responseTimeData
    if (avgHours < 1) return `${Math.round(avgHours * 60)} min`
    if (avgHours < 24) return `${avgHours.toFixed(1)}h`
    return `${(avgHours / 24).toFixed(1)}j`
  }, [responseTimeData])

  // Dynamic target: max commercial sales * 1.2 rounded to nearest 10k
  const target = useMemo(() => {
    if (commercialStats.length === 0) return 100000
    const maxSales = Math.max(...commercialStats.map((c) => c.sales))
    return Math.ceil((maxSales * 1.2) / 10000) * 10000
  }, [commercialStats])

  if (isLoading) {
    return (
      <div className='space-y-4'>
        {/* KPI Cards */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-4 w-4 rounded-full' />
              </CardHeader>
              <CardContent>
                <Skeleton className='mb-2 h-8 w-24' />
                <Skeleton className='h-3 w-36' />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Charts */}
        <div className='grid gap-4 lg:grid-cols-7'>
          <Card className='col-span-1 lg:col-span-4'>
            <CardHeader>
              <Skeleton className='h-5 w-48' />
              <Skeleton className='h-3 w-64' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-[300px] w-full' />
            </CardContent>
          </Card>
          <Card className='col-span-1 lg:col-span-3'>
            <CardHeader>
              <Skeleton className='h-5 w-36' />
              <Skeleton className='h-3 w-52' />
            </CardHeader>
            <CardContent className='flex items-center justify-center'>
              <Skeleton className='h-[300px] w-[300px] rounded-full' />
            </CardContent>
          </Card>
        </div>
        {/* Detail card */}
        <Card>
          <CardHeader>
            <Skeleton className='h-5 w-40' />
            <Skeleton className='h-3 w-56' />
          </CardHeader>
          <CardContent className='space-y-6'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className='space-y-2'>
                <div className='flex items-center gap-3'>
                  <Skeleton className='h-10 w-10 rounded-full' />
                  <div className='flex-1 space-y-1'>
                    <Skeleton className='h-4 w-32' />
                    <Skeleton className='h-3 w-48' />
                  </div>
                  <Skeleton className='h-6 w-20' />
                </div>
                <Skeleton className='h-2 w-full rounded-full' />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (commercialStats.length === 0) {
    return (
      <div className='flex items-center justify-center py-20'>
        <p className='text-muted-foreground'>
          Aucune donnée commerciale disponible
        </p>
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
              <KpiTooltip text="Montant total HT des devis signés sur les événements assignés à l'équipe" />
              <CardTitle className='text-sm font-medium'>
                CA Signé Équipe HT
              </CardTitle>
            </div>
            <Euro className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {totalSales.toLocaleString('fr-FR')} €
            </div>
            <p className='text-xs text-muted-foreground'>
              Réparti sur {commercialStats.length} commerciaux
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text='Delta moyen entre la création du booking et son premier changement de statut depuis "Nouveau"' />
              <CardTitle className='text-sm font-medium'>
                Temps de réponse moyen
              </CardTitle>
            </div>
            <Clock className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{responseTimeLabel ?? '—'}</div>
            <p className='text-xs text-muted-foreground'>
              {responseTimeData
                ? `Sur ${responseTimeData.count} événement${responseTimeData.count > 1 ? 's' : ''}`
                : 'Pas encore de données'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text='Événements avec au moins un devis signé / total événements (annulés inclus)' />
              <CardTitle className='text-sm font-medium'>
                Taux de conversion
              </CardTitle>
            </div>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{avgConversion}%</div>
            <p className='text-xs text-muted-foreground'>
              Devis signés / total événements
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text='Commercial avec le plus de CA signé' />
              <CardTitle className='text-sm font-medium'>
                Meilleur performeur
              </CardTitle>
            </div>
            <Target className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='truncate text-2xl font-bold'>
              {bestPerformer?.name || '-'}
            </div>
            <p className='text-xs text-muted-foreground'>
              {bestPerformer
                ? `${bestPerformer.sales.toLocaleString('fr-FR')} € de CA HT`
                : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stale Proposals */}
      {staleProposals.length > 0 && (
        <Card className='border-yellow-200 dark:border-yellow-900'>
          <CardHeader className='pb-3'>
            <div className='flex items-center gap-2'>
              <AlertTriangle className='h-4 w-4 text-yellow-500' />
              <CardTitle className='text-base'>
                Propositions sans réponse
              </CardTitle>
            </div>
            <CardDescription>
              Devis envoyés depuis plus de 3 jours sans action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {staleProposals.map((proposal) => (
                <div
                  key={`${proposal.bookingId}-${proposal.quoteNumber}`}
                  className='flex items-center justify-between rounded-lg border p-3'
                >
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>
                      {proposal.contactName}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {proposal.restaurantName}
                      {proposal.quoteNumber ? ` • ${proposal.quoteNumber}` : ''}
                    </p>
                  </div>
                  <div className='flex items-center gap-3'>
                    <span className='text-sm font-medium'>
                      {proposal.amount > 0
                        ? `${proposal.amount.toLocaleString('fr-FR')} €`
                        : '-'}
                    </span>
                    <Badge
                      variant='outline'
                      className='border-yellow-300 text-yellow-600 dark:border-yellow-800'
                    >
                      {proposal.daysSince}j
                    </Badge>
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
            <CardTitle>Performance mensuelle HT</CardTitle>
            <CardDescription>
              CA signé HT par commercial sur les 6 derniers mois
            </CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={350}>
              <BarChart data={monthlyData}>
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
                  formatter={(value) => [
                    `${Number(value ?? 0).toLocaleString('fr-FR')} €`,
                    '',
                  ]}
                />
                <Legend />
                {commercialNames.map((name, i) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    fill={COLORS[i % COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader>
            <CardTitle>Répartition du CA HT</CardTitle>
            <CardDescription>
              Part de chaque commercial dans le CA signé HT
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx='50%'
                  cy='45%'
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey='value'
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    `${Number(value ?? 0).toLocaleString('fr-FR')} €`,
                    'CA',
                  ]}
                />
                <Legend
                  verticalAlign='bottom'
                  align='center'
                  iconType='circle'
                  iconSize={10}
                  formatter={(value, entry) => {
                    const percent = (
                      (entry.payload as { percent?: number })?.percent ?? 0
                    ).toFixed(0)
                    const firstName = (value ?? '').split(' ')[0]
                    return (
                      <span style={{ color: entry.color, fontSize: 13 }}>
                        {firstName} {percent}%
                      </span>
                    )
                  }}
                  wrapperStyle={{ paddingTop: 16 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Commercial Details */}
      <Card>
        <CardHeader>
          <CardTitle>Détail par commercial</CardTitle>
          <CardDescription>
            Performance individuelle et objectifs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-6'>
            {commercialStats.map((commercial, index) => {
              const progress =
                target > 0 ? (commercial.sales / target) * 100 : 0
              return (
                <div key={commercial.name} className='space-y-2'>
                  <div className='flex items-center gap-4'>
                    <Avatar className='h-10 w-10'>
                      <AvatarFallback
                        style={{
                          backgroundColor: COLORS[index % COLORS.length] + '20',
                          color: COLORS[index % COLORS.length],
                        }}
                      >
                        {commercial.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                      <div className='space-y-1'>
                        <p className='text-sm leading-none font-medium'>
                          {commercial.name}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {commercial.bookings} événements • {commercial.signed}{' '}
                          signés • {commercial.conversionRate}% conversion
                        </p>
                      </div>
                      <div className='text-right'>
                        <p className='font-medium'>
                          {commercial.sales.toLocaleString('fr-FR')} €
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          Ø {commercial.avgTicket.toLocaleString('fr-FR')}{' '}
                          €/événement
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Progress value={Math.min(progress, 100)} className='h-2' />
                    <span className='w-12 text-xs text-muted-foreground'>
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
