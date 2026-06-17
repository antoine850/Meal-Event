import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Link, useSearch } from '@tanstack/react-router'
import { fr } from 'date-fns/locale'
import {
  Euro,
  TrendingUp,
  Users,
  Utensils,
  Info,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

export function GeneralTab({
  aggregates,
  actionLists,
  isLoading,
  restaurants,
}: DashboardTabProps) {
  // Filtres actuels du dashboard, propagés à chaque drill-down vers /evenements
  const dash = useSearch({ strict: false }) as DashboardSearch

  const total = aggregates?.total ?? 0
  const signedRevenue = aggregates?.signed_revenue ?? 0
  const signedCount = aggregates?.signed_count ?? 0
  const signedGuests = aggregates?.signed_guests ?? 0
  const signedWithoutQuote = aggregates?.signed_without_quote ?? 0
  const avgTicketPerGuest = aggregates?.avg_ticket_per_guest ?? 0
  const conversionRate = aggregates?.conversion_rate ?? 0
  const outstanding = aggregates?.outstanding ?? 0

  const pipeline = aggregates?.pipeline ?? []
  const restaurantKPIs = useMemo(
    () => aggregates?.by_restaurant ?? [],
    [aggregates]
  )

  const fmtDate = (d: string | null | undefined) =>
    d ? format(parseISO(d), 'd MMM yyyy', { locale: fr }) : null

  const actionItems = actionLists?.action_items ?? []
  const ACTIONS_PER_PAGE = 20
  const [actionsPage, setActionsPage] = useState(0)
  const actionsPageCount = Math.ceil(actionItems.length / ACTIONS_PER_PAGE)
  const page = Math.min(actionsPage, Math.max(0, actionsPageCount - 1))
  const pagedActions = actionItems.slice(
    page * ACTIONS_PER_PAGE,
    page * ACTIONS_PER_PAGE + ACTIONS_PER_PAGE
  )

  const pieData = useMemo(
    () =>
      restaurantKPIs
        .filter((r) => r.revenue > 0)
        .map((r) => ({ name: r.name ?? '', value: r.revenue })),
    [restaurantKPIs]
  )

  const recentBookings = actionLists?.recent_bookings ?? []

  if (isLoading) {
    return (
      <div className='space-y-4'>
        {/* KPI Cards */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-4 w-4 rounded-full' />
              </CardHeader>
              <CardContent>
                <Skeleton className='mb-2 h-8 w-24' />
                <Skeleton className='h-3 w-36' />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Pipeline */}
        <Card>
          <CardHeader className='pb-3'>
            <Skeleton className='h-5 w-24' />
            <Skeleton className='h-3 w-48' />
          </CardHeader>
          <CardContent>
            <Skeleton className='mb-4 h-3 w-full rounded-full' />
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className='h-16 rounded-lg' />
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Charts */}
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
          <Card className='col-span-1 lg:col-span-4'>
            <CardHeader>
              <Skeleton className='h-5 w-40' />
              <Skeleton className='h-3 w-56' />
            </CardHeader>
            <CardContent className='flex items-center justify-center'>
              <Skeleton className='h-[350px] w-[350px] rounded-full' />
            </CardContent>
          </Card>
          <Card className='col-span-1 lg:col-span-3'>
            <CardHeader>
              <Skeleton className='h-5 w-48' />
              <Skeleton className='h-3 w-64' />
            </CardHeader>
            <CardContent className='space-y-4'>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className='flex items-center gap-4'>
                  <Skeleton className='h-10 w-10 rounded-full' />
                  <div className='flex-1 space-y-2'>
                    <Skeleton className='h-4 w-32' />
                    <Skeleton className='h-2 w-full' />
                  </div>
                  <Skeleton className='h-4 w-20' />
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
      {/* KPI Cards — chaque carte est un drill-down vers /evenements
          en vue Liste avec les filtres du dashboard propagés. */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
        <Link
          to='/evenements'
          search={buildEventsSearch(dash)}
          className='block'
        >
          <Card className='h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <div className='flex items-center gap-1.5'>
                <KpiTooltip text='Nombre total de demandes reçues, tous statuts confondus' />
                <CardTitle className='text-sm font-medium'>
                  Total demandes
                </CardTitle>
              </div>
              <Users className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{total}</div>
              <p className='text-xs text-muted-foreground'>
                Tous statuts confondus
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to='/evenements' search={signedSearch(dash)} className='block'>
          <Card className='h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <div className='flex items-center gap-1.5'>
                <KpiTooltip text='Montant total HT des devis signés (primary quote)' />
                <CardTitle className='text-sm font-medium'>
                  CA Signé HT
                </CardTitle>
              </div>
              <Euro className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {signedRevenue.toLocaleString('fr-FR')} €
              </div>
              <p className='text-xs text-muted-foreground'>
                Ø{' '}
                {signedCount > 0
                  ? Math.round(signedRevenue / signedCount).toLocaleString(
                      'fr-FR'
                    )
                  : 0}{' '}
                € HT / événement
              </p>
              {outstanding > 0 && (
                <p className='text-xs text-muted-foreground'>
                  Reste à encaisser : {outstanding.toLocaleString('fr-FR')} €
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link to='/evenements' search={signedSearch(dash)} className='block'>
          <Card className='h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <div className='flex items-center gap-1.5'>
                <KpiTooltip text='Événements signés (après signature, hors annulés/nouveaux/qualification)' />
                <CardTitle className='text-sm font-medium'>
                  Événements signés
                </CardTitle>
              </div>
              <Users className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{signedCount}</div>
              <p className='text-xs text-muted-foreground'>
                {signedGuests.toLocaleString('fr-FR')} convives signés
              </p>
              {signedWithoutQuote > 0 && (
                <p className='text-xs text-orange-600'>
                  dont {signedWithoutQuote} sans devis
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link to='/evenements' search={signedSearch(dash)} className='block'>
          <Card className='h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <div className='flex items-center gap-1.5'>
                <KpiTooltip text='CA signé HT / nombre total de convives signés' />
                <CardTitle className='text-sm font-medium'>
                  Ticket moyen HT
                </CardTitle>
              </div>
              <Utensils className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {avgTicketPerGuest.toLocaleString('fr-FR')} €
              </div>
              <p className='text-xs text-muted-foreground'>Par convive</p>
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
                <KpiTooltip text='Événements avec au moins un devis signé / total événements (annulés inclus)' />
                <CardTitle className='text-sm font-medium'>
                  Taux de conversion
                </CardTitle>
              </div>
              <TrendingUp className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{conversionRate}%</div>
              <p className='text-xs text-muted-foreground'>
                Devis signés / total événements
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Pipeline by statuses */}
      {pipeline.length > 0 && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>
              Répartition des événements par statut
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Stacked bar */}
            <div className='mb-4'>
              <div className='flex h-3 w-full overflow-hidden rounded-full bg-muted'>
                {pipeline.map((stage) => {
                  const totalCount = pipeline.reduce((s, p) => s + p.count, 0)
                  const widthPercent =
                    totalCount > 0 ? (stage.count / totalCount) * 100 : 0
                  if (widthPercent === 0) return null
                  return (
                    <div
                      key={stage.status_id}
                      className='h-full transition-all'
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: stage.color,
                      }}
                      title={`${stage.name}: ${stage.count}`}
                    />
                  )
                })}
              </div>
            </div>
            {/* Status grid */}
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {pipeline.map((stage) => (
                <Link
                  key={stage.status_id}
                  to='/evenements'
                  search={buildEventsSearch(dash, { status: stage.slug })}
                  className='flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent'
                >
                  <div
                    className='h-8 w-1 shrink-0 rounded-full'
                    style={{ backgroundColor: stage.color }}
                  />
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>{stage.name}</p>
                    <div className='flex items-baseline gap-2'>
                      <span className='text-lg font-bold'>{stage.count}</span>
                      <span className='text-xs text-muted-foreground'>
                        {stage.amount > 0
                          ? `${stage.amount.toLocaleString('fr-FR')} €`
                          : ''}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions requises — sous la pipeline */}
      {actionItems.length > 0 && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2'>
              <AlertCircle className='h-5 w-5 text-orange-500' />
              Actions requises
            </CardTitle>
            <CardDescription>
              Événements nécessitant une action immédiate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='divide-y'>
              {pagedActions.map((item) => (
                <div
                  key={`${item.type}-${item.booking_id}`}
                  className='flex items-center gap-3 py-2.5 first:pt-0 last:pb-0'
                >
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${item.severity === 'danger' ? 'bg-red-500' : 'bg-orange-500'}`}
                  />

                  <div className='flex min-w-0 flex-1 items-center gap-2 overflow-hidden'>
                    <span className='shrink-0 text-sm font-semibold'>
                      {item.title}
                    </span>
                    {item.status_name && (
                      <span
                        className='shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-medium'
                        style={{
                          borderColor: item.status_color || undefined,
                          color: item.status_color || undefined,
                          backgroundColor: item.status_color
                            ? `${item.status_color}18`
                            : undefined,
                        }}
                      >
                        {item.status_name}
                      </span>
                    )}
                    <span className='truncate text-xs text-muted-foreground'>
                      {[
                        item.detail,
                        fmtDate(item.event_date),
                        item.restaurant,
                        item.guests > 0 ? `${item.guests} pers.` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>

                  <div className='flex shrink-0 items-center gap-3'>
                    {item.amount > 0 && (
                      <span className='text-sm font-semibold tabular-nums'>
                        {item.amount.toLocaleString('fr-FR')} €
                      </span>
                    )}
                    <Link
                      to='/evenements/booking/$id'
                      params={{ id: item.booking_id }}
                      className='flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90'
                    >
                      Voir
                      <ArrowRight className='h-3 w-3' />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            {actionsPageCount > 1 && (
              <div className='flex items-center justify-end gap-2 pt-3'>
                <span className='text-sm text-muted-foreground'>
                  {actionItems.length} actions · page {page + 1}/
                  {actionsPageCount}
                </span>
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => setActionsPage(page - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => setActionsPage(page + 1)}
                  disabled={page >= actionsPageCount - 1}
                >
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader>
            <CardTitle>CA HT par restaurant</CardTitle>
            <CardDescription>
              Répartition du chiffre d'affaires signé HT
            </CardDescription>
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
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          restaurants.find(
                            (r) => r.name === pieData[index].name
                          )?.color || COLORS[index % COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      `${Number(value ?? 0).toLocaleString('fr-FR')} €`,
                      'CA',
                    ]}
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

        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader>
            <CardTitle>Performance HT par restaurant</CardTitle>
            <CardDescription>
              CA signé HT, événements et ticket moyen HT
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {restaurantKPIs.length > 0 ? (
                restaurantKPIs.map((restaurant) => {
                  const name = restaurant.name ?? 'Sans restaurant'
                  const row = (
                    <div className='flex items-center gap-4'>
                      <Avatar className='h-9 w-9'>
                        <AvatarFallback className='bg-primary/10 text-primary'>
                          {name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                        <div className='space-y-1'>
                          <p className='text-sm leading-none font-medium'>
                            {name}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            {restaurant.signed_count} événements signés · Ø{' '}
                            {restaurant.avg_ticket.toLocaleString('fr-FR')} €
                          </p>
                        </div>
                        <div className='font-medium text-green-600'>
                          {restaurant.revenue.toLocaleString('fr-FR')} €
                        </div>
                      </div>
                    </div>
                  )
                  return restaurant.id ? (
                    <Link
                      key={name}
                      to='/evenements'
                      search={signedSearch({
                        ...dash,
                        restaurants: restaurant.id,
                      })}
                      className='-mx-2 block rounded-md px-2 py-1.5 transition-colors hover:bg-accent'
                    >
                      {row}
                    </Link>
                  ) : (
                    <div key={name}>{row}</div>
                  )
                })
              ) : (
                <p className='py-4 text-center text-sm text-muted-foreground'>
                  Aucune donnée
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <CardTitle>Derniers événements</CardTitle>
          <CardDescription>
            Les 5 derniers événements enregistrés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {recentBookings.length > 0 ? (
              recentBookings.map((booking) => {
                const contactName = booking.contact_name || 'Sans contact'
                const quoteTtc = booking.amount || 0
                return (
                  <div key={booking.id} className='flex items-center gap-4'>
                    <Avatar className='h-9 w-9'>
                      <AvatarFallback>
                        {contactName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                      <div className='space-y-1'>
                        <p className='text-sm leading-none font-medium'>
                          {contactName}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {booking.restaurant_name || 'Sans restaurant'} •{' '}
                          {booking.kind || ''}
                        </p>
                      </div>
                      <div className='flex items-center gap-2'>
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
                        <span className='font-medium'>
                          {quoteTtc > 0
                            ? `${quoteTtc.toLocaleString('fr-FR')} €`
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className='py-4 text-center text-sm text-muted-foreground'>
                Aucun événement
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
