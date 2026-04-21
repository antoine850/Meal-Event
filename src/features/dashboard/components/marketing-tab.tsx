import { useMemo } from 'react'
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
import { Instagram, Facebook, Globe, MessageCircle, Users, TrendingUp, Loader2, Info } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  type DashboardTabProps,
  getContactsBySource,
  getMonthlyLeadsBySource,
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

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#a855f7']

export function MarketingTab({ bookings, contacts, isLoading }: DashboardTabProps) {
  const marketingBySource = useMemo(() => getContactsBySource(contacts, bookings), [contacts, bookings])
  const monthlyLeads = useMemo(() => getMonthlyLeadsBySource(contacts), [contacts])

  const totalLeads = useMemo(() => marketingBySource.reduce((acc, s) => acc + s.leads, 0), [marketingBySource])
  const totalBookings = useMemo(() => marketingBySource.reduce((acc, s) => acc + s.bookings, 0), [marketingBySource])
  const totalSigned = useMemo(() => marketingBySource.reduce((acc, s) => acc + s.signedCount, 0), [marketingBySource])
  const avgConversion = useMemo(() => totalLeads > 0 ? ((totalBookings / totalLeads) * 100).toFixed(1) : '0', [totalLeads, totalBookings])

  // Meilleure source = celle qui signe le plus (signatureRate, pas juste conversion leads→bookings)
  const bestSource = useMemo(() =>
    marketingBySource.reduce((best, current) =>
      current.signatureRate > (best?.signatureRate || 0) ? current : best,
      marketingBySource[0]
    ),
    [marketingBySource]
  )

  const sourceNames = useMemo(() => marketingBySource.map(s => s.source), [marketingBySource])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (marketingBySource.length === 0) {
    return (
      <div className='flex items-center justify-center py-20'>
        <p className='text-muted-foreground'>Aucune donnée marketing disponible</p>
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
              <KpiTooltip text="Contacts créés sur la période, toutes sources confondues" />
              <CardTitle className='text-sm font-medium'>Total Leads</CardTitle>
            </div>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalLeads}</div>
            <p className='text-xs text-muted-foreground'>Depuis toutes les sources</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Leads ayant généré au moins un événement" />
              <CardTitle className='text-sm font-medium'>Événements</CardTitle>
            </div>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalBookings}</div>
            <p className='text-xs text-muted-foreground'>Leads convertis en événements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Événements créés / total leads (toutes sources)" />
              <CardTitle className='text-sm font-medium'>Taux de conversion</CardTitle>
            </div>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{avgConversion}%</div>
            <p className='text-xs text-muted-foreground'>{totalSigned} signés · {totalBookings} événements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text="Source avec le meilleur taux de signature (signés / leads)" />
              <CardTitle className='text-sm font-medium'>Meilleure source</CardTitle>
            </div>
            {bestSource && (sourceIcons[bestSource.source] || <Globe className='h-4 w-4 text-muted-foreground' />)}
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{bestSource?.source || '-'}</div>
            <p className='text-xs text-muted-foreground'>
              {bestSource ? `${bestSource.signatureRate}% de signés` : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader>
            <CardTitle>Évolution des leads</CardTitle>
            <CardDescription>Leads par source sur les 6 derniers mois</CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={350}>
              <LineChart data={monthlyLeads}>
                <XAxis dataKey='month' stroke='#888888' fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke='#888888' fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend />
                {sourceNames.map((name, i) => (
                  <Line
                    key={name}
                    type='monotone'
                    dataKey={name}
                    stroke={sourceColors[name] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
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
            <CardDescription>Comparaison par source d'acquisition</CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={350}>
              <BarChart data={marketingBySource} layout='vertical'>
                <XAxis type='number' stroke='#888888' fontSize={12} tickLine={false} axisLine={false} />
                <YAxis type='category' dataKey='source' stroke='#888888' fontSize={12} tickLine={false} axisLine={false} width={80} />
                <Tooltip />
                <Legend />
                <Bar dataKey='leads' fill='#94a3b8' name='Leads' radius={[0, 4, 4, 0]} />
                <Bar dataKey='bookings' fill='#3b82f6' name='Événements' radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Source Details */}
      <Card>
        <CardHeader>
          <CardTitle>Performance par source</CardTitle>
          <CardDescription>Détail des conversions et revenus par canal d'acquisition</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-6'>
            {marketingBySource.map((source) => {
              const maxLeads = Math.max(...marketingBySource.map(s => s.leads))
              const progress = maxLeads > 0 ? (source.leads / maxLeads) * 100 : 0
              const color = sourceColors[source.source] || '#6B7280'
              return (
                <div key={source.source} className='space-y-2'>
                  <div className='flex items-center gap-4'>
                    <div
                      className='flex h-10 w-10 items-center justify-center rounded-full'
                      style={{ backgroundColor: color + '20' }}
                    >
                      {sourceIcons[source.source] || <Globe className='h-4 w-4' style={{ color }} />}
                    </div>
                    <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                      <div className='space-y-1'>
                        <p className='text-sm font-medium leading-none'>{source.source}</p>
                        <p className='text-xs text-muted-foreground'>
                          {source.leads} leads • {source.bookings} événements • {source.signedCount} signés ({source.signatureRate}%)
                        </p>
                      </div>
                      <div className='text-right'>
                        <p className='font-medium text-green-600'>
                          {source.revenue.toLocaleString('fr-FR')} €
                        </p>
                        <p className='text-xs text-muted-foreground'>CA signé total</p>
                      </div>
                    </div>
                  </div>
                  <Progress value={progress} className='h-2' />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
