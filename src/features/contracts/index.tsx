import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Download,
  FileText,
  Euro,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Building,
  Loader2,
  Search,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useBookings, useRestaurants, type BookingWithRelations } from '@/features/reservations/hooks/use-bookings'
import { useContacts } from '@/features/contacts/hooks/use-contacts'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { FacetedFilter } from '@/components/data-table/standalone-faceted-filter'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { RotateCcw } from 'lucide-react'

// ─── Helpers ───

const SIGNED_SLUGS = ['attente_paiement', 'relance_paiement', 'confirme_fonctionnaire', 'fonction_envoyee', 'a_facturer', 'cloture']

function getQuoteTtc(b: BookingWithRelations) {
  const primary = b.quotes?.find(q => q.primary_quote)
  if (primary) return primary.total_ttc || 0
  return b.quotes?.[0]?.total_ttc || 0
}

function getPaidAmount(b: BookingWithRelations) {
  if (!b.payments?.length) return 0
  return b.payments
    .filter(p => p.status === 'paid' || p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0)
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF'
  const csv = bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Quote status helpers ───

type QuoteDisplayStatus = 'draft' | 'sent' | 'signed' | 'paid' | 'cancelled'

function getQuoteDisplayStatus(q: { status: string | null }, b: BookingWithRelations): QuoteDisplayStatus {
  if (b.status?.slug === 'cancelled') return 'cancelled'
  const paid = getPaidAmount(b)
  const ttc = q.status === 'quote_signed' || q.status === 'deposit_paid' || q.status === 'balance_paid' || q.status === 'completed'
  if (q.status === 'completed' || q.status === 'balance_paid') return 'paid'
  if (ttc && paid > 0) return 'paid'
  if (q.status === 'quote_signed' || q.status === 'deposit_paid') return 'signed'
  if (q.status === 'sent' || q.status === 'signature_requested') return 'sent'
  return 'draft'
}

const statusConfig: Record<QuoteDisplayStatus, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'text-gray-500 border-gray-300' },
  sent: { label: 'Envoyé', color: 'text-blue-600 border-blue-300' },
  signed: { label: 'Signé', color: 'text-green-600 border-green-300' },
  paid: { label: 'Payé', color: 'text-emerald-600 border-emerald-300' },
  cancelled: { label: 'Annulé', color: 'text-red-600 border-red-300' },
}

// ─── Main Component ───

export function Contracts() {
  const [activeTab, setActiveTab] = useState('quotes')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput, 150)
  const [quotesPage, setQuotesPage] = useState(0)
  const [clientsPage, setClientsPage] = useState(0)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set())
  const PAGE_SIZE = 50

  useEffect(() => { setQuotesPage(0) }, [search, selectedStatuses, selectedSources, selectedRestaurants])
  useEffect(() => { setClientsPage(0) }, [search])
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings()
  const { data: contacts = [], isLoading: contactsLoading } = useContacts()
  const { data: companies = [], isLoading: companiesLoading } = useCompanies()
  const { data: restaurants = [] } = useRestaurants()

  const isLoading = bookingsLoading || contactsLoading || companiesLoading

  // ─── Quotes (Devis) from bookings ───
  const allQuotes = useMemo(() => {
    const results: {
      quoteId: string
      quoteNumber: string
      contactName: string
      contactEmail: string
      companyName: string
      restaurantName: string
      restaurantId: string
      source: string
      eventType: string
      eventDate: string
      totalTtc: number
      paidAmount: number
      status: QuoteDisplayStatus
      sentAt: string | null
      signedAt: string | null
      bookingId: string
    }[] = []

    bookings.forEach(b => {
      if (!b.quotes?.length) return
      b.quotes.forEach(q => {
        const contactName = b.contact ? `${b.contact.first_name} ${b.contact.last_name || ''}`.trim() : 'Sans contact'
        const contactEmail = b.contact?.email || ''
        const companyName = b.contact?.company?.name || ''
        results.push({
          quoteId: q.id,
          quoteNumber: q.quote_number || '-',
          contactName,
          contactEmail,
          companyName,
          restaurantName: b.restaurant?.name || '',
          restaurantId: b.restaurant_id || '',
          source: ((b.contact as any)?.source || '') as string,
          eventType: b.occasion || b.event_type || '',
          eventDate: b.event_date,
          totalTtc: q.total_ttc || 0,
          paidAmount: getPaidAmount(b),
          status: getQuoteDisplayStatus(q, b),
          sentAt: q.quote_sent_at,
          signedAt: q.quote_signed_at,
          bookingId: b.id,
        })
      })
    })

    return results.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
  }, [bookings])

  // Options de filtres
  const sourceOptions = useMemo(() => {
    const sources = new Set<string>()
    bookings.forEach(b => {
      const src = ((b.contact as any)?.source || '') as string
      if (src) sources.add(src)
    })
    return Array.from(sources).sort().map(s => ({ label: s, value: s }))
  }, [bookings])

  const restaurantOptions = useMemo(
    () => restaurants.map(r => ({ label: r.name, value: r.id })),
    [restaurants]
  )

  const statusFilterOptions: { label: string; value: QuoteDisplayStatus }[] = [
    { label: 'Brouillon', value: 'draft' },
    { label: 'Envoyé', value: 'sent' },
    { label: 'Signé', value: 'signed' },
    { label: 'Payé', value: 'paid' },
    { label: 'Annulé', value: 'cancelled' },
  ]

  // ─── Client history (CA per contact) ───
  const clientHistory = useMemo(() => {
    const map = new Map<string, {
      contactId: string
      contactName: string
      contactEmail: string
      companyName: string
      bookingsCount: number
      signedCount: number
      totalCA: number
      totalPaid: number
      lastEventDate: string
      lastBookingId: string
    }>()

    bookings.forEach(b => {
      const cid = b.contact_id || 'no-contact'
      const existing = map.get(cid)
      const contactName = b.contact ? `${b.contact.first_name} ${b.contact.last_name || ''}`.trim() : 'Sans contact'
      const isSigned = SIGNED_SLUGS.includes(b.status?.slug || '')
      const quoteTtc = isSigned ? getQuoteTtc(b) : 0

      if (existing) {
        existing.bookingsCount++
        if (isSigned) existing.signedCount++
        existing.totalCA += quoteTtc
        existing.totalPaid += getPaidAmount(b)
        if (b.event_date > existing.lastEventDate) {
          existing.lastEventDate = b.event_date
          existing.lastBookingId = b.id
        }
      } else {
        map.set(cid, {
          contactId: cid,
          contactName,
          contactEmail: b.contact?.email || '',
          companyName: b.contact?.company?.name || '',
          bookingsCount: 1,
          signedCount: isSigned ? 1 : 0,
          totalCA: quoteTtc,
          totalPaid: getPaidAmount(b),
          lastEventDate: b.event_date,
          lastBookingId: b.id,
        })
      }
    })

    return [...map.values()].sort((a, b) => b.totalCA - a.totalCA)
  }, [bookings])

  // ─── Filtered data ───
  const searchLower = search.toLowerCase()
  const filteredQuotes = useMemo(() => {
    return allQuotes.filter(q => {
      if (search) {
        const matchSearch =
          q.contactName.toLowerCase().includes(searchLower) ||
          q.companyName.toLowerCase().includes(searchLower) ||
          q.quoteNumber.toLowerCase().includes(searchLower) ||
          q.restaurantName.toLowerCase().includes(searchLower)
        if (!matchSearch) return false
      }
      if (selectedStatuses.size > 0 && !selectedStatuses.has(q.status)) return false
      if (selectedSources.size > 0 && !selectedSources.has(q.source)) return false
      if (selectedRestaurants.size > 0 && !selectedRestaurants.has(q.restaurantId)) return false
      return true
    })
  }, [allQuotes, search, searchLower, selectedStatuses, selectedSources, selectedRestaurants])

  const filteredClients = useMemo(() =>
    search ? clientHistory.filter(c =>
      c.contactName.toLowerCase().includes(searchLower) ||
      c.companyName.toLowerCase().includes(searchLower) ||
      c.contactEmail.toLowerCase().includes(searchLower)
    ) : clientHistory,
    [clientHistory, search, searchLower]
  )

  const hasFilters = selectedStatuses.size > 0 || selectedSources.size > 0 || selectedRestaurants.size > 0
  const resetFilters = () => {
    setSelectedStatuses(new Set())
    setSelectedSources(new Set())
    setSelectedRestaurants(new Set())
  }

  const paginatedQuotes = useMemo(
    () => filteredQuotes.slice(quotesPage * PAGE_SIZE, (quotesPage + 1) * PAGE_SIZE),
    [filteredQuotes, quotesPage]
  )
  const paginatedClients = useMemo(
    () => filteredClients.slice(clientsPage * PAGE_SIZE, (clientsPage + 1) * PAGE_SIZE),
    [filteredClients, clientsPage]
  )

  // ─── Stats ───
  // Aligné avec le dashboard : un événement est "signé" si son booking est dans SIGNED_SLUGS.
  // On agrège au niveau booking (1 événement = 1 entrée) et on prend le CA du devis principal
  // pour éviter le double-comptage quand un booking a plusieurs versions de devis (v1, v2, v3).
  const quoteStats = useMemo(() => {
    const signedBookings = bookings.filter(b => SIGNED_SLUGS.includes(b.status?.slug || ''))
    const sentBookings = bookings.filter(b => {
      const slug = b.status?.slug || ''
      return slug === 'proposition' || slug === 'negociation'
    })
    return {
      total: allQuotes.length, // total des devis édités (toutes versions confondues)
      signed: signedBookings.length, // nb d'événements signés (comme dashboard)
      sent: sentBookings.length, // nb d'événements en attente de signature
      totalCA: signedBookings.reduce((s, b) => s + getQuoteTtc(b), 0), // somme des devis principaux signés
    }
  }, [bookings, allQuotes])

  const paymentStats = useMemo(() => {
    // Scope aux bookings signés pour cohérence "CA signé → reste à encaisser"
    // (évite que paid > totalSigned quand un acompte a été encaissé sur un booking non-signé)
    const signedBookings = bookings.filter(b => SIGNED_SLUGS.includes(b.status?.slug || ''))
    const paid = signedBookings.reduce((sum, b) => sum + getPaidAmount(b), 0)
    const totalSigned = signedBookings.reduce((sum, b) => sum + getQuoteTtc(b), 0)
    const pending = Math.max(0, totalSigned - paid)

    // "Événements en retard" = tous les statuts SAUF proposition/qualification/nouveau/cancelled
    // + event_date passé + non soldé
    const OVERDUE_EXCLUDE = ['proposition', 'qualification', 'cancelled', 'nouveau']
    const now = new Date()
    const overdueCount = bookings.filter(b => {
      const slug = b.status?.slug || ''
      if (OVERDUE_EXCLUDE.includes(slug)) return false
      const ttc = getQuoteTtc(b)
      const paidAmt = getPaidAmount(b)
      return ttc > 0 && paidAmt < ttc && new Date(b.event_date) < now
    }).length
    return { totalPaid: paid, totalPending: pending, overdueCount }
  }, [bookings])

  // ─── Exports ───
  const exportQuotes = useCallback(() => {
    const headers = ['N° Devis', 'Client', 'Société', 'Restaurant', 'Type', 'Date événement', 'Montant TTC', 'Statut']
    const rows = allQuotes.map(q => [
      q.quoteNumber,
      q.contactName,
      q.companyName,
      q.restaurantName,
      q.eventType,
      format(parseISO(q.eventDate), 'dd/MM/yyyy'),
      q.totalTtc.toFixed(2).replace('.', ','),
      statusConfig[q.status].label,
    ])
    downloadCsv(`devis_${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows)
  }, [allQuotes])

  const exportClients = useCallback(() => {
    const headers = ['Client', 'Email', 'Société', 'Événements', 'Signés', 'CA Signé', 'CA Encaissé', 'Dernier événement']
    const rows = clientHistory.map(c => [
      c.contactName,
      c.contactEmail,
      c.companyName,
      String(c.bookingsCount),
      String(c.signedCount),
      c.totalCA.toFixed(2).replace('.', ','),
      c.totalPaid.toFixed(2).replace('.', ','),
      format(parseISO(c.lastEventDate), 'dd/MM/yyyy'),
    ])
    downloadCsv(`clients_ca_${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows)
  }, [clientHistory])

  const exportContacts = useCallback(() => {
    const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Société', 'Source', 'Créé le']
    const rows = contacts.map(c => [
      c.first_name || '',
      c.last_name || '',
      c.email || '',
      c.phone || '',
      c.company?.name || '',
      (c as any).source || '',
      c.created_at ? format(parseISO(c.created_at), 'dd/MM/yyyy') : '',
    ])
    downloadCsv(`contacts_${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows)
  }, [contacts])

  const exportCompanies = useCallback(() => {
    const headers = ['Nom', 'Téléphone', 'Email facturation', 'Adresse', 'CP', 'Ville', 'SIRET', 'TVA']
    const rows = companies.map(c => [
      c.name,
      c.phone || '',
      c.billing_email || '',
      c.billing_address || '',
      c.billing_postal_code || '',
      c.billing_city || '',
      c.siret || '',
      c.tva_number || '',
    ])
    downloadCsv(`societes_${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows)
  }, [companies])

  if (isLoading) {
    return (
      <>
        <Header fixed>
          <h1 className='text-lg font-semibold'>Devis & Factures</h1>
          <div className='ms-auto flex items-center space-x-4'>
            <ThemeSwitch />
            <ConfigDrawer />
            <ProfileDropdown />
          </div>
        </Header>
        <Main>
          <div className='flex items-center justify-center py-20'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header fixed>
        <h1 className='text-lg font-semibold'>Devis & Factures</h1>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <TabsList>
              <TabsTrigger value='quotes' className='gap-2'>
                <FileText className='h-4 w-4' />
                Devis
              </TabsTrigger>
              <TabsTrigger value='clients' className='gap-2'>
                <Users className='h-4 w-4' />
                Historique clients
              </TabsTrigger>
            </TabsList>
            <div className='flex flex-wrap items-center gap-2'>
              <div className='relative'>
                <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Rechercher...'
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className='pl-9 w-[200px]'
                />
              </div>
              {activeTab === 'quotes' && (
                <>
                  <FacetedFilter
                    title='Statut'
                    options={statusFilterOptions.map(o => ({ label: o.label, value: o.value }))}
                    selected={selectedStatuses}
                    onSelectionChange={setSelectedStatuses}
                  />
                  {sourceOptions.length > 0 && (
                    <FacetedFilter
                      title='Source'
                      options={sourceOptions}
                      selected={selectedSources}
                      onSelectionChange={setSelectedSources}
                    />
                  )}
                  {restaurantOptions.length > 0 && (
                    <FacetedFilter
                      title='Restaurant'
                      options={restaurantOptions}
                      selected={selectedRestaurants}
                      onSelectionChange={setSelectedRestaurants}
                    />
                  )}
                  {hasFilters && (
                    <Button variant='ghost' size='sm' className='h-8 px-2' onClick={resetFilters}>
                      <RotateCcw className='mr-1 h-3 w-3' />
                      Réinitialiser
                    </Button>
                  )}
                </>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline'>
                    <Download className='mr-2 h-4 w-4' />
                    Exporter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem onClick={exportQuotes}>
                    <FileText className='mr-2 h-4 w-4' />
                    Devis (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportClients}>
                    <Users className='mr-2 h-4 w-4' />
                    Historique clients (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportContacts}>
                    <Users className='mr-2 h-4 w-4' />
                    Contacts (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCompanies}>
                    <Building className='mr-2 h-4 w-4' />
                    Sociétés (CSV)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ═══ Tab: Devis ═══ */}
          <TabsContent value='quotes' className='space-y-4 mt-4'>
            {/* Stats */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Total Devis</CardTitle>
                  <FileText className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{quoteStats.total}</div>
                  <p className='text-xs text-muted-foreground'>Toutes versions confondues</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Événements signés</CardTitle>
                  <CheckCircle className='h-4 w-4 text-green-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-green-600'>{quoteStats.signed}</div>
                  <p className='text-xs text-muted-foreground'>Signés ou statut ultérieur</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>En attente</CardTitle>
                  <Clock className='h-4 w-4 text-yellow-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-yellow-600'>{quoteStats.sent}</div>
                  <p className='text-xs text-muted-foreground'>Proposition / négociation</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>CA Signé</CardTitle>
                  <Euro className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{quoteStats.totalCA.toLocaleString('fr-FR')} €</div>
                  <p className='text-xs text-muted-foreground'>Devis principal des événements signés</p>
                </CardContent>
              </Card>
            </div>

            {/* Payment summary bar */}
            <div className='grid gap-4 sm:grid-cols-3'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>CA Encaissé</CardTitle>
                  <CheckCircle className='h-4 w-4 text-green-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-xl font-bold text-green-600'>{paymentStats.totalPaid.toLocaleString('fr-FR')} €</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Reste à encaisser</CardTitle>
                  <Clock className='h-4 w-4 text-yellow-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-xl font-bold text-yellow-600'>{paymentStats.totalPending.toLocaleString('fr-FR')} €</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Événements en retard</CardTitle>
                  <AlertCircle className='h-4 w-4 text-red-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-xl font-bold text-red-600'>{paymentStats.overdueCount}</div>
                  <p className='text-xs text-muted-foreground'>Événements passés non soldés</p>
                </CardContent>
              </Card>
            </div>

            {/* Quotes Table */}
            <Card>
              <CardContent className='p-0'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Devis</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className='hidden md:table-cell'>Restaurant</TableHead>
                      <TableHead className='hidden lg:table-cell'>Événement</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className='text-right'>Montant TTC</TableHead>
                      <TableHead className='text-right hidden sm:table-cell'>Payé</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className='w-12'></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedQuotes.length > 0 ? paginatedQuotes.map((q) => {
                      const st = statusConfig[q.status]
                      return (
                        <TableRow
                          key={q.quoteId}
                          className='cursor-pointer hover:bg-muted/50'
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('a')) return
                            window.location.href = `/evenements/booking/${q.bookingId}`
                          }}
                        >
                          <TableCell className='font-medium text-sm'>{q.quoteNumber}</TableCell>
                          <TableCell>
                            <div>
                              <p className='text-sm font-medium'>{q.contactName}</p>
                              {q.companyName && <p className='text-xs text-muted-foreground'>{q.companyName}</p>}
                            </div>
                          </TableCell>
                          <TableCell className='text-sm hidden md:table-cell'>{q.restaurantName}</TableCell>
                          <TableCell className='text-sm hidden lg:table-cell'>{q.eventType}</TableCell>
                          <TableCell className='text-sm'>
                            {format(parseISO(q.eventDate), 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell className='text-right font-medium'>
                            {q.totalTtc > 0 ? `${q.totalTtc.toLocaleString('fr-FR')} €` : '-'}
                          </TableCell>
                          <TableCell className='text-right hidden sm:table-cell'>
                            <span className={cn(
                              'font-medium',
                              q.paidAmount >= q.totalTtc && q.totalTtc > 0 && 'text-green-600',
                              q.paidAmount > 0 && q.paidAmount < q.totalTtc && 'text-orange-600'
                            )}>
                              {q.paidAmount > 0 ? `${q.paidAmount.toLocaleString('fr-FR')} €` : '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant='outline' className={cn('text-xs', st.color)}>
                              {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              asChild
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8'
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link
                                to='/evenements/booking/$id'
                                params={{ id: q.bookingId }}
                                title='Voir l&apos;événement'
                              >
                                <ExternalLink className='h-4 w-4' />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    }) : (
                      <TableRow>
                        <TableCell colSpan={9} className='text-center py-8 text-muted-foreground'>
                          Aucun devis trouvé
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              {filteredQuotes.length > PAGE_SIZE && (
                <div className='flex items-center justify-between px-4 py-3 border-t'>
                  <span className='text-sm text-muted-foreground'>
                    {quotesPage * PAGE_SIZE + 1}–{Math.min((quotesPage + 1) * PAGE_SIZE, filteredQuotes.length)} sur {filteredQuotes.length}
                  </span>
                  <div className='flex items-center gap-1'>
                    <Button variant='outline' size='icon' className='h-8 w-8' onClick={() => setQuotesPage(0)} disabled={quotesPage === 0}>
                      <DoubleArrowLeftIcon className='h-4 w-4' />
                    </Button>
                    <Button variant='outline' size='icon' className='h-8 w-8' onClick={() => setQuotesPage(p => p - 1)} disabled={quotesPage === 0}>
                      <ChevronLeftIcon className='h-4 w-4' />
                    </Button>
                    <span className='text-sm px-2'>Page {quotesPage + 1} / {Math.ceil(filteredQuotes.length / PAGE_SIZE)}</span>
                    <Button variant='outline' size='icon' className='h-8 w-8' onClick={() => setQuotesPage(p => p + 1)} disabled={(quotesPage + 1) * PAGE_SIZE >= filteredQuotes.length}>
                      <ChevronRightIcon className='h-4 w-4' />
                    </Button>
                    <Button variant='outline' size='icon' className='h-8 w-8' onClick={() => setQuotesPage(Math.ceil(filteredQuotes.length / PAGE_SIZE) - 1)} disabled={(quotesPage + 1) * PAGE_SIZE >= filteredQuotes.length}>
                      <DoubleArrowRightIcon className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* ═══ Tab: Client History ═══ */}
          <TabsContent value='clients' className='space-y-4 mt-4'>
            <Card>
              <CardHeader>
                <CardTitle>Historique par client</CardTitle>
                <CardDescription>CA généré par compte client sur l'ensemble des événements</CardDescription>
              </CardHeader>
              <CardContent className='p-0'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className='hidden md:table-cell'>Société</TableHead>
                      <TableHead className='text-center'>Événements</TableHead>
                      <TableHead className='text-center hidden sm:table-cell'>Signés</TableHead>
                      <TableHead className='text-right'>CA Signé</TableHead>
                      <TableHead className='text-right hidden sm:table-cell'>CA Encaissé</TableHead>
                      <TableHead className='hidden lg:table-cell'>Dernier événement</TableHead>
                      <TableHead className='w-12'></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClients.length > 0 ? paginatedClients.map((c) => (
                      <TableRow
                        key={c.contactId}
                        className='cursor-pointer hover:bg-muted/50'
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('a')) return
                          window.location.href = `/evenements/booking/${c.lastBookingId}`
                        }}
                      >
                        <TableCell>
                          <div>
                            <p className='text-sm font-medium'>{c.contactName}</p>
                            {c.contactEmail && <p className='text-xs text-muted-foreground'>{c.contactEmail}</p>}
                          </div>
                        </TableCell>
                        <TableCell className='text-sm hidden md:table-cell'>{c.companyName || '-'}</TableCell>
                        <TableCell className='text-center'>{c.bookingsCount}</TableCell>
                        <TableCell className='text-center hidden sm:table-cell'>{c.signedCount}</TableCell>
                        <TableCell className='text-right font-medium'>
                          {c.totalCA > 0 ? `${c.totalCA.toLocaleString('fr-FR')} €` : '-'}
                        </TableCell>
                        <TableCell className='text-right hidden sm:table-cell'>
                          <span className={cn(
                            'font-medium',
                            c.totalPaid >= c.totalCA && c.totalCA > 0 && 'text-green-600',
                            c.totalPaid > 0 && c.totalPaid < c.totalCA && 'text-orange-600'
                          )}>
                            {c.totalPaid > 0 ? `${c.totalPaid.toLocaleString('fr-FR')} €` : '-'}
                          </span>
                        </TableCell>
                        <TableCell className='text-sm hidden lg:table-cell'>
                          {format(parseISO(c.lastEventDate), 'dd MMM yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Button
                            asChild
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8'
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link
                              to='/evenements/booking/$id'
                              params={{ id: c.lastBookingId }}
                              title='Voir le dernier événement'
                            >
                              <ExternalLink className='h-4 w-4' />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={8} className='text-center py-8 text-muted-foreground'>
                          Aucun client trouvé
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              {filteredClients.length > PAGE_SIZE && (
                <div className='flex items-center justify-between px-4 py-3 border-t'>
                  <span className='text-sm text-muted-foreground'>
                    {clientsPage * PAGE_SIZE + 1}–{Math.min((clientsPage + 1) * PAGE_SIZE, filteredClients.length)} sur {filteredClients.length}
                  </span>
                  <div className='flex items-center gap-1'>
                    <Button variant='outline' size='icon' className='h-8 w-8' onClick={() => setClientsPage(0)} disabled={clientsPage === 0}>
                      <DoubleArrowLeftIcon className='h-4 w-4' />
                    </Button>
                    <Button variant='outline' size='icon' className='h-8 w-8' onClick={() => setClientsPage(p => p - 1)} disabled={clientsPage === 0}>
                      <ChevronLeftIcon className='h-4 w-4' />
                    </Button>
                    <span className='text-sm px-2'>Page {clientsPage + 1} / {Math.ceil(filteredClients.length / PAGE_SIZE)}</span>
                    <Button variant='outline' size='icon' className='h-8 w-8' onClick={() => setClientsPage(p => p + 1)} disabled={(clientsPage + 1) * PAGE_SIZE >= filteredClients.length}>
                      <ChevronRightIcon className='h-4 w-4' />
                    </Button>
                    <Button variant='outline' size='icon' className='h-8 w-8' onClick={() => setClientsPage(Math.ceil(filteredClients.length / PAGE_SIZE) - 1)} disabled={(clientsPage + 1) * PAGE_SIZE >= filteredClients.length}>
                      <DoubleArrowRightIcon className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
