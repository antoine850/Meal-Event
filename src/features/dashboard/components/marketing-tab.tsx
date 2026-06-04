import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Link, useSearch } from '@tanstack/react-router'
import {
  Instagram,
  Facebook,
  Globe,
  MessageCircle,
  Users,
  TrendingUp,
  Info,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  LineChart,
} from 'recharts'
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
import { type DashboardTabProps } from '../hooks/use-dashboard-data'
import {
  buildEventsSearch,
  signedSearch,
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

const sourceIcons: Record<string, React.ReactNode> = {
  Instagram: <Instagram className='h-4 w-4' style={{ color: '#E4405F' }} />,
  Facebook: <Facebook className='h-4 w-4' style={{ color: '#1877F2' }} />,
  'Google Ads': <Globe className='h-4 w-4' style={{ color: '#4285F4' }} />,
  Google: <Globe className='h-4 w-4' style={{ color: '#4285F4' }} />,
  WhatsApp: <MessageCircle className='h-4 w-4' style={{ color: '#25D366' }} />,
  Organique: <Users className='h-4 w-4' style={{ color: '#6B7280' }} />,
  Parrainage: <TrendingUp className='h-4 w-4' style={{ color: '#8B5CF6' }} />,
}

const sourceColors: Record<string, string> = {
  Instagram: '#E4405F',
  Facebook: '#1877F2',
  'Google Ads': '#4285F4',
  Google: '#4285F4',
  WhatsApp: '#25D366',
  Organique: '#6B7280',
  Parrainage: '#8B5CF6',
  Autre: '#9CA3AF',
}

const DEFAULT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
  '#a855f7',
]

export function MarketingTab({ marketing, isLoading }: DashboardTabProps) {
  const dash = useSearch({ strict: false }) as DashboardSearch
  const marketingBySource = useMemo(
    () =>
      (marketing?.by_source ?? []).map((s) => ({
        source: s.source,
        leads: s.leads,
        bookings: s.bookings,
        signedCount: s.signed_count,
        conversionRate: s.conversion_rate,
        signatureRate: s.signature_rate,
        revenue: s.revenue,
      })),
    [marketing]
  )

  // Pivot long {month,source,leads} -> wide rows pour le LineChart
  const monthlyLeads = useMemo(() => {
    const rows = marketing?.monthly_leads_by_source ?? []
    const byMonth = new Map<string, Record<string, string | number>>()
    rows.forEach((r) => {
      const label = format(parseISO(`${r.month}-01`), 'MMM', { locale: fr })
      let row = byMonth.get(r.month)
      if (!row) {
        row = { month: label }
        byMonth.set(r.month, row)
      }
      row[r.source] = ((row[r.source] as number) || 0) + r.leads
    })
    return [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, row]) => row)
  }, [marketing])

  const totalLeads = useMemo(
    () => marketingBySource.reduce((acc, s) => acc + s.leads, 0),
    [marketingBySource]
  )
  const totalBookings = useMemo(
    () => marketingBySource.reduce((acc, s) => acc + s.bookings, 0),
    [marketingBySource]
  )
  const totalSigned = useMemo(
    () => marketingBySource.reduce((acc, s) => acc + s.signedCount, 0),
    [marketingBySource]
  )
  // Taux de conversion = événements signés (ou statut ultérieur) / événements de la période
  const avgConversion = useMemo(
    () =>
      totalBookings > 0
        ? ((totalSigned / totalBookings) * 100).toFixed(1)
        : '0',
    [totalSigned, totalBookings]
  )

  // Meilleure source = celle qui signe le plus (signatureRate, pas juste conversion leads→bookings)
  const bestSource = useMemo(
    () =>
      marketingBySource.reduce(
        (best, current) =>
          current.signatureRate > (best?.signatureRate || 0) ? current : best,
        marketingBySource[0]
      ),
    [marketingBySource]
  )

  const sourceNames = useMemo(
    () => marketingBySource.map((s) => s.source),
    [marketingBySource]
  )

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
        {/* Charts */}
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
          <Card className='col-span-1 lg:col-span-4'>
            <CardHeader>
              <Skeleton className='h-5 w-40' />
              <Skeleton className='h-3 w-56' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-[350px] w-full' />
            </CardContent>
          </Card>
          <Card className='col-span-1 lg:col-span-3'>
            <CardHeader>
              <Skeleton className='h-5 w-36' />
              <Skeleton className='h-3 w-52' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-[350px] w-full' />
            </CardContent>
          </Card>
        </div>
        {/* Source details */}
        <Card>
          <CardHeader>
            <Skeleton className='h-5 w-44' />
            <Skeleton className='h-3 w-64' />
          </CardHeader>
          <CardContent className='space-y-6'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='space-y-2'>
                <div className='flex items-center gap-4'>
                  <Skeleton className='h-10 w-10 rounded-full' />
                  <div className='flex flex-1 items-center justify-between gap-2'>
                    <div className='space-y-1'>
                      <Skeleton className='h-4 w-24' />
                      <Skeleton className='h-3 w-48' />
                    </div>
                    <Skeleton className='h-4 w-20' />
                  </div>
                </div>
                <Skeleton className='h-2 w-full rounded-full' />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (marketingBySource.length === 0) {
    return (
      <div className='flex items-center justify-center py-20'>
        <p className='text-muted-foreground'>
          Aucune donnée marketing disponible
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* KPI Cards — drill-down vers /evenements (Total Leads non cliquable
          car compte des contacts, pas des bookings). */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text='Contacts créés sur la période, toutes sources confondues' />
              <CardTitle className='text-sm font-medium'>Total Leads</CardTitle>
            </div>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalLeads}</div>
            <p className='text-xs text-muted-foreground'>
              Depuis toutes les sources
            </p>
          </CardContent>
        </Card>
        <Link
          to='/evenements'
          search={buildEventsSearch(dash)}
          className='block'
        >
          <Card className='h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <div className='flex items-center gap-1.5'>
                <KpiTooltip text='Leads ayant généré au moins un événement' />
                <CardTitle className='text-sm font-medium'>
                  Événements
                </CardTitle>
              </div>
              <TrendingUp className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{totalBookings}</div>
              <p className='text-xs text-muted-foreground'>
                Leads convertis en événements
              </p>
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
                <KpiTooltip text='Événements signés (ou statut ultérieur) / total événements de la période' />
                <CardTitle className='text-sm font-medium'>
                  Taux de conversion
                </CardTitle>
              </div>
              <TrendingUp className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{avgConversion}%</div>
              <p className='text-xs text-muted-foreground'>
                {totalSigned} signés / {totalBookings} événements
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link
          to='/evenements'
          search={{
            ...signedSearch(dash),
            ...(bestSource?.source ? { source: bestSource.source } : {}),
          }}
          className='block'
        >
          <Card className='h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <div className='flex items-center gap-1.5'>
                <KpiTooltip text='Source avec le meilleur taux de signature (signés / leads)' />
                <CardTitle className='text-sm font-medium'>
                  Meilleure source
                </CardTitle>
              </div>
              {bestSource &&
                (sourceIcons[bestSource.source] || (
                  <Globe className='h-4 w-4 text-muted-foreground' />
                ))}
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {bestSource?.source || '-'}
              </div>
              <p className='text-xs text-muted-foreground'>
                {bestSource ? `${bestSource.signatureRate}% de signés` : '-'}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader>
            <CardTitle>Évolution des leads</CardTitle>
            <CardDescription>
              Leads par source sur les 6 derniers mois
            </CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={350}>
              <LineChart data={monthlyLeads}>
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
                />
                <Tooltip />
                <Legend />
                {sourceNames.map((name, i) => (
                  <Line
                    key={name}
                    type='monotone'
                    dataKey={name}
                    stroke={
                      sourceColors[name] ||
                      DEFAULT_COLORS[i % DEFAULT_COLORS.length]
                    }
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader>
            <CardTitle>Leads vs Événements</CardTitle>
            <CardDescription>
              Comparaison par source d'acquisition
            </CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={350}>
              <BarChart data={marketingBySource} layout='vertical'>
                <XAxis
                  type='number'
                  stroke='#888888'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type='category'
                  dataKey='source'
                  stroke='#888888'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey='leads'
                  fill='#94a3b8'
                  name='Leads'
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey='bookings'
                  fill='#3b82f6'
                  name='Événements'
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Source Details */}
      <Card>
        <CardHeader>
          <CardTitle>Performance par source</CardTitle>
          <CardDescription>
            Détail des conversions et revenus par canal d'acquisition
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {marketingBySource.map((source) => {
              const maxLeads = Math.max(
                ...marketingBySource.map((s) => s.leads)
              )
              const progress =
                maxLeads > 0 ? (source.leads / maxLeads) * 100 : 0
              const color = sourceColors[source.source] || '#6B7280'
              return (
                <Link
                  key={source.source}
                  to='/evenements'
                  search={buildEventsSearch(dash, { source: source.source })}
                  className='-mx-2 block space-y-2 rounded-md px-2 py-2 transition-colors hover:bg-accent'
                >
                  <div className='flex items-center gap-4'>
                    <div
                      className='flex h-10 w-10 items-center justify-center rounded-full'
                      style={{ backgroundColor: color + '20' }}
                    >
                      {sourceIcons[source.source] || (
                        <Globe className='h-4 w-4' style={{ color }} />
                      )}
                    </div>
                    <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                      <div className='space-y-1'>
                        <p className='text-sm leading-none font-medium'>
                          {source.source}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {source.leads} leads • {source.bookings} événements •{' '}
                          {source.signedCount} signés ({source.signatureRate}%)
                        </p>
                      </div>
                      <div className='text-right'>
                        <p className='font-medium text-green-600'>
                          {source.revenue.toLocaleString('fr-FR')} €
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          CA signé HT
                        </p>
                      </div>
                    </div>
                  </div>
                  <Progress value={progress} className='h-2' />
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
