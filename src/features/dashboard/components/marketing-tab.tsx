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
import { Instagram, Facebook, Globe, MessageCircle, Users, TrendingUp } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  marketingBySource,
  monthlyLeadsBySource,
} from '../data/mock-data'

const sourceIcons: Record<string, React.ReactNode> = {
  Instagram: <Instagram className='h-4 w-4' style={{ color: '#E4405F' }} />,
  Facebook: <Facebook className='h-4 w-4' style={{ color: '#1877F2' }} />,
  'Google Ads': <Globe className='h-4 w-4' style={{ color: '#4285F4' }} />,
  WhatsApp: <MessageCircle className='h-4 w-4' style={{ color: '#25D366' }} />,
  Organique: <Users className='h-4 w-4' style={{ color: '#6B7280' }} />,
  Parrainage: <TrendingUp className='h-4 w-4' style={{ color: '#8B5CF6' }} />,
}

const sourceColors: Record<string, string> = {
  Instagram: '#E4405F',
  Facebook: '#1877F2',
  'Google Ads': '#4285F4',
  WhatsApp: '#25D366',
  Organique: '#6B7280',
  Parrainage: '#8B5CF6',
}

export function MarketingTab() {
  const totalLeads = marketingBySource.reduce((acc, s) => acc + s.leads, 0)
  const totalBookings = marketingBySource.reduce((acc, s) => acc + s.bookings, 0)
  const _totalRevenue = marketingBySource.reduce((acc, s) => acc + s.revenue, 0)
  const avgConversion = ((totalBookings / totalLeads) * 100).toFixed(1)

  const bestSource = marketingBySource.reduce((best, current) => 
    current.conversionRate > best.conversionRate ? current : best
  )

  return (
    <div className='space-y-4'>
      {/* KPI Cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Leads
            </CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalLeads}</div>
            <p className='text-xs text-muted-foreground'>
              Depuis toutes les sources
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Réservations
            </CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalBookings}</div>
            <p className='text-xs text-muted-foreground'>
              Leads convertis en réservations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Taux de conversion</CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{avgConversion}%</div>
            <p className='text-xs text-muted-foreground'>
              Moyenne toutes sources
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Meilleure source
            </CardTitle>
            {sourceIcons[bestSource.source]}
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{bestSource.source}</div>
            <p className='text-xs text-muted-foreground'>
              {bestSource.conversionRate}% de conversion
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
              <LineChart data={monthlyLeadsBySource}>
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
                <Line type='monotone' dataKey='Instagram' stroke='#E4405F' strokeWidth={2} dot={false} />
                <Line type='monotone' dataKey='Facebook' stroke='#1877F2' strokeWidth={2} dot={false} />
                <Line type='monotone' dataKey='Google Ads' stroke='#4285F4' strokeWidth={2} dot={false} />
                <Line type='monotone' dataKey='WhatsApp' stroke='#25D366' strokeWidth={2} dot={false} />
                <Line type='monotone' dataKey='Organique' stroke='#6B7280' strokeWidth={2} dot={false} />
                <Line type='monotone' dataKey='Parrainage' stroke='#8B5CF6' strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader>
            <CardTitle>Leads vs Réservations</CardTitle>
            <CardDescription>Comparaison par source d'acquisition</CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={350}>
              <BarChart data={marketingBySource} layout='vertical'>
                <XAxis type='number' stroke='#888888' fontSize={12} tickLine={false} axisLine={false} />
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
                <Bar dataKey='leads' fill='#94a3b8' name='Leads' radius={[0, 4, 4, 0]} />
                <Bar dataKey='bookings' fill='#3b82f6' name='Réservations' radius={[0, 4, 4, 0]} />
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
              const progress = (source.leads / maxLeads) * 100
              return (
                <div key={source.source} className='space-y-2'>
                  <div className='flex items-center gap-4'>
                    <div 
                      className='flex h-10 w-10 items-center justify-center rounded-full'
                      style={{ backgroundColor: sourceColors[source.source] + '20' }}
                    >
                      {sourceIcons[source.source]}
                    </div>
                    <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                      <div className='space-y-1'>
                        <p className='text-sm font-medium leading-none'>
                          {source.source}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {source.leads} leads • {source.bookings} réservations • {source.conversionRate}% conversion
                        </p>
                      </div>
                      <div className='text-right'>
                        <p className='font-medium text-green-600'>
                          {source.revenue.toLocaleString('fr-FR')} €
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          CA généré
                        </p>
                      </div>
                    </div>
                  </div>
                  <Progress 
                    value={progress} 
                    className='h-2'
                                      />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
