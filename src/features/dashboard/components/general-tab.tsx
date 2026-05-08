import { useMemo } from 'react'
import { parseISO, differenceInDays } from 'date-fns'
import { Link } from '@tanstack/react-router'
import {
  Euro,
  TrendingUp,
  Users,
  Utensils,
  Info,
  AlertCircle,
  ArrowRight,
  CalendarDays,
} from 'lucide-react'
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import {
  type DashboardTabProps,
  calcSignedRevenue,
  calcSignedCount,
  calcAvgTicketPerGuest,
  calcConversionRate,
  calcPipeline,
  groupBySignedRestaurant,
  getStaleProposals,
  getPaidAmount,
  SIGNED_SLUGS,
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

interface GeneralTabProps extends DashboardTabProps {
  statuses?: { id: string; name: string; color: string; slug: string }[]
}

export function GeneralTab({
  bookings,
  isLoading,
  restaurants,
  statuses = [],
}: GeneralTabProps) {
  const signedRevenue = useMemo(() => calcSignedRevenue(bookings), [bookings])
  const signedCount = useMemo(() => calcSignedCount(bookings), [bookings])
  const avgTicketPerGuest = useMemo(
    () => calcAvgTicketPerGuest(bookings),
    [bookings]
  )
  const conversionRate = useMemo(() => calcConversionRate(bookings), [bookings])

  // Carte Événements: ne compter que les événements signés
  const signedBookings = useMemo(
    () => bookings.filter((b) => SIGNED_SLUGS.includes(b.status?.slug || '')),
    [bookings]
  )
  const signedGuests = useMemo(
    () => signedBookings.reduce((sum, b) => sum + (b.guests_count || 0), 0),
    [signedBookings]
  )

  const pipeline = useMemo(
    () => calcPipeline(bookings, statuses),
    [bookings, statuses]
  )

  const restaurantKPIs = useMemo(() => {
    const groups = groupBySignedRestaurant(bookings)
    return Object.entries(groups)
      .map(([name, items]) => ({
        name,
        revenue: calcSignedRevenue(items),
        signedCount: items.length,
        avgTicket:
          items.length > 0
            ? Math.round(calcSignedRevenue(items) / items.length)
            : 0,
        color: restaurants.find((r) => r.name === name)?.color || null,
      }))
      .filter((r) => r.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
  }, [bookings, restaurants])

  // Actions requises: propositions stale + paiements en retard + relances
  const actionItems = useMemo(() => {
    const fmtDate = (d: string | null | undefined) =>
      d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : null

    const now = new Date()

    const notCancelled = (b: { status?: { slug?: string | null; name?: string | null } | null }) => {
      const slug = b.status?.slug || ''
      const name = b.status?.name?.toLowerCase() || ''
      return !slug.includes('annul') && !name.includes('annul')
    }

    const stale = getStaleProposals(
      bookings.filter((b) => notCancelled(b))
    ).map((s) => {
        const booking = bookings.find((b) => b.id === s.bookingId)
        return {
          type: 'stale' as const,
          bookingId: s.bookingId,
          title: s.contactName,
          detail: `Devis envoyé depuis ${s.daysSince}j sans réponse`,
          eventDate: fmtDate(booking?.event_date),
          restaurant: s.restaurantName,
          statusName: booking?.status?.name || '',
          statusColor: booking?.status?.color || null,
          guests: booking?.guests_count || 0,
          amount: s.amount,
          severity: 'warning' as const,
        }
      })

    const overdue = bookings
      .filter((b) => notCancelled(b))
      .filter((b) => SIGNED_SLUGS.includes(b.status?.slug || ''))
      .filter((b) => {
        const primary = b.quotes?.find((q) => q.primary_quote)
        const ht = primary?.total_ht || 0
        const paid = getPaidAmount(b)
        return ht > 0 && paid < ht && new Date(b.event_date) < now
      })
      .map((b) => ({
        type: 'overdue' as const,
        bookingId: b.id,
        title: b.contact
          ? `${b.contact.first_name} ${b.contact.last_name || ''}`.trim()
          : 'Sans contact',
        detail: 'Paiement en retard',
        eventDate: fmtDate(b.event_date),
        restaurant: b.restaurant?.name || '',
        statusName: b.status?.name || '',
        statusColor: b.status?.color || null,
        guests: b.guests_count || 0,
        amount:
          (b.quotes?.find((q) => q.primary_quote)?.total_ht || 0) -
          getPaidAmount(b),
        severity: 'danger' as const,
      }))

    const relances = bookings
      .filter((b) => notCancelled(b))
      .filter((b) => b.status?.slug === 'relance_paiement')
      .map((b) => ({
        type: 'relance' as const,
        bookingId: b.id,
        title: b.contact
          ? `${b.contact.first_name} ${b.contact.last_name || ''}`.trim()
          : 'Sans contact',
        detail: 'Relance de paiement à envoyer',
        eventDate: fmtDate(b.event_date),
        restaurant: b.restaurant?.name || '',
        statusName: b.status?.name || '',
        statusColor: b.status?.color || null,
        guests: b.guests_count || 0,
        amount: b.quotes?.find((q) => q.primary_quote)?.total_ttc || 0,
        severity: 'warning' as const,
      }))

    const urgentUpcoming = bookings
      .filter((b) => {
        if (!b.event_date) return false
        const daysUntil = differenceInDays(parseISO(b.event_date), now)
        return daysUntil >= 0 && daysUntil < 3
      })
      .filter((b) => notCancelled(b))
      .filter((b) => b.status?.slug !== 'nouveau')
      .filter((b) => {
        const isSigned = SIGNED_SLUGS.includes(b.status?.slug || '')
        const hasPaidDeposit = getPaidAmount(b) > 0
        return !isSigned || !hasPaidDeposit
      })
      .map((b) => {
        const daysUntil = differenceInDays(parseISO(b.event_date), now)
        const isSigned = SIGNED_SLUGS.includes(b.status?.slug || '')
        const reason = !isSigned ? 'non signé' : 'acompte non payé'
        const whenLabel = daysUntil === 0 ? "aujourd'hui" : `dans ${daysUntil}j`
        return {
          type: 'urgent_upcoming' as const,
          bookingId: b.id,
          title: b.contact
            ? `${b.contact.first_name} ${b.contact.last_name || ''}`.trim()
            : 'Sans contact',
          detail: `Événement ${whenLabel} — ${reason}`,
          eventDate: fmtDate(b.event_date),
          restaurant: b.restaurant?.name || '',
          statusName: b.status?.name || '',
          statusColor: b.status?.color || null,
          guests: b.guests_count || 0,
          amount: b.quotes?.find((q) => q.primary_quote)?.total_ht || 0,
          severity: 'danger' as const,
        }
      })

    return [...urgentUpcoming, ...overdue, ...stale, ...relances]
  }, [bookings])

  const pieData = useMemo(
    () =>
      restaurantKPIs
        .filter((r) => r.revenue > 0)
        .map((r) => ({ name: r.name, value: r.revenue })),
    [restaurantKPIs]
  )

  const recentBookings = useMemo(
    () =>
      [...bookings]
        .sort(
          (a, b) =>
            new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
        )
        .slice(0, 5),
    [bookings]
  )

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
      {/* KPI Cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text='Nombre total de demandes reçues, tous statuts confondus' />
              <CardTitle className='text-sm font-medium'>Total demandes</CardTitle>
            </div>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{bookings.length}</div>
            <p className='text-xs text-muted-foreground'>Tous statuts confondus</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text='Montant total HT des devis signés (primary quote)' />
              <CardTitle className='text-sm font-medium'>CA Signé HT</CardTitle>
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
                ? Math.round(signedRevenue / signedCount).toLocaleString('fr-FR')
                : 0}{' '}
              € HT / événement
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex items-center gap-1.5'>
              <KpiTooltip text='Événements signés (après signature, hors annulés/nouveaux/qualification)' />
              <CardTitle className='text-sm font-medium'>Événements signés</CardTitle>
            </div>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{signedBookings.length}</div>
            <p className='text-xs text-muted-foreground'>
              {signedGuests.toLocaleString('fr-FR')} convives signés
            </p>
          </CardContent>
        </Card>
        <Card>
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
            <div className='text-2xl font-bold'>{conversionRate}%</div>
            <p className='text-xs text-muted-foreground'>Devis signés / total événements</p>
          </CardContent>
        </Card>
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
                      key={stage.statusId}
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
                  key={stage.statusId}
                  to='/evenements'
                  search={{ view: 'list', status: stage.slug } as any}
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
              {actionItems.map((item) => (
                <div
                  key={`${item.type}-${item.bookingId}`}
                  className='flex items-center gap-3 py-2.5 first:pt-0 last:pb-0'
                >
                  <div className={`h-2 w-2 shrink-0 rounded-full ${item.severity === 'danger' ? 'bg-red-500' : 'bg-orange-500'}`} />

                  <div className='min-w-0 flex-1 flex items-center gap-2 overflow-hidden'>
                    <span className='shrink-0 text-sm font-semibold'>{item.title}</span>
                    {item.statusName && (
                      <span
                        className='shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-medium'
                        style={{
                          borderColor: item.statusColor || undefined,
                          color: item.statusColor || undefined,
                          backgroundColor: item.statusColor ? `${item.statusColor}18` : undefined,
                        }}
                      >
                        {item.statusName}
                      </span>
                    )}
                    <span className='truncate text-xs text-muted-foreground'>
                      {[
                        item.detail,
                        item.eventDate,
                        item.restaurant,
                        item.guests > 0 ? `${item.guests} pers.` : null,
                      ].filter(Boolean).join(' · ')}
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
                      params={{ id: item.bookingId }}
                      className='flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90'
                    >
                      Voir
                      <ArrowRight className='h-3 w-3' />
                    </Link>
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
            <div className='space-y-4'>
              {restaurantKPIs.length > 0 ? (
                restaurantKPIs.map((restaurant) => (
                  <div
                    key={restaurant.name}
                    className='flex items-center gap-4'
                  >
                    <Avatar className='h-9 w-9'>
                      <AvatarFallback className='bg-primary/10 text-primary'>
                        {restaurant.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
                      <div className='space-y-1'>
                        <p className='text-sm leading-none font-medium'>
                          {restaurant.name}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {restaurant.signedCount} événements signés · Ø{' '}
                          {restaurant.avgTicket.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                      <div className='font-medium text-green-600'>
                        {restaurant.revenue.toLocaleString('fr-FR')} €
                      </div>
                    </div>
                  </div>
                ))
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
                const contactName = booking.contact
                  ? `${booking.contact.first_name} ${booking.contact.last_name || ''}`.trim()
                  : 'Sans contact'
                const primaryQuote = booking.quotes?.find(
                  (q) => q.primary_quote
                )
                const quoteTtc = primaryQuote?.total_ht || 0
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
                          {booking.restaurant?.name || 'Sans restaurant'} •{' '}
                          {booking.occasion || booking.event_type || ''}
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
