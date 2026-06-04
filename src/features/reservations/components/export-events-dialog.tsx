import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { type DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useIsOrgAdmin } from '@/hooks/use-is-org-admin'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DateFilter, FacetedFilter } from '@/components/data-table'
import { useOrganizationUsers } from '@/features/contacts/hooks/use-contacts'
import { useBookingStatuses, useRestaurants } from '../hooks/use-bookings'

const API_BASE_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_API_URL || 'http://localhost:3001'

type Props = {
  initialStatusSlugs?: Set<string>
  initialRestaurantIds?: Set<string>
  initialCommercialIds?: Set<string>
}

export function ExportEventsDialog({
  initialStatusSlugs,
  initialRestaurantIds,
  initialCommercialIds,
}: Props) {
  const { data: isAdmin } = useIsOrgAdmin()
  const { data: statuses = [] } = useBookingStatuses()
  const { data: restaurants = [] } = useRestaurants()
  const { data: users = [] } = useOrganizationUsers()

  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [statusIds, setStatusIds] = useState<Set<string>>(new Set())
  const [restaurantIds, setRestaurantIds] = useState<Set<string>>(new Set())
  const [commercialIds, setCommercialIds] = useState<Set<string>>(new Set())

  // Pré-remplit statut/restaurant/commercial depuis la liste à l'ouverture ;
  // la période démarre sur "Tout" (toutes les dates) par défaut.
  // La liste filtre les statuts par slug -> on convertit en id pour l'export.
  useEffect(() => {
    if (!open) return
    setDateRange(undefined)
    const slugToId = new Map(statuses.map((s) => [s.slug, s.id]))
    setStatusIds(
      new Set(
        [...(initialStatusSlugs || [])]
          .map((slug) => slugToId.get(slug))
          .filter(Boolean) as string[]
      )
    )
    setRestaurantIds(new Set(initialRestaurantIds || []))
    setCommercialIds(new Set(initialCommercialIds || []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!isAdmin) return null

  const handleExport = async () => {
    setDownloading(true)
    try {
      const params = new URLSearchParams()
      if (dateRange?.from)
        params.set('from', dateRange.from.toISOString().slice(0, 10))
      if (dateRange?.to)
        params.set('to', dateRange.to.toISOString().slice(0, 10))
      if (statusIds.size) params.set('status', Array.from(statusIds).join(','))
      if (restaurantIds.size)
        params.set('restaurant', Array.from(restaurantIds).join(','))
      if (commercialIds.size)
        params.set('commercial', Array.from(commercialIds).join(','))

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch(
        `${API_BASE_URL}/api/exports/events.csv?${params.toString()}`,
        {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        }
      )
      if (!res.ok) throw new Error('export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `evenements-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setOpen(false)
    } catch {
      toast.error("Erreur lors de l'export")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' className='h-8 gap-1'>
          <Download className='h-4 w-4' />
          Exporter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exporter les événements (CSV)</DialogTitle>
        </DialogHeader>

        <div className='space-y-3'>
          <div className='space-y-1'>
            <Label className='text-xs'>Période (date de l'événement)</Label>
            <DateFilter
              value={dateRange}
              onChange={setDateRange}
              placeholder='Toutes les dates'
              allowAll
            />
          </div>
          <div className='flex flex-wrap gap-2'>
            <FacetedFilter
              title='Statut'
              options={statuses.map((s) => ({ label: s.name, value: s.id }))}
              selected={statusIds}
              onSelectionChange={setStatusIds}
            />
            <FacetedFilter
              title='Restaurant'
              options={restaurants.map((r) => ({ label: r.name, value: r.id }))}
              selected={restaurantIds}
              onSelectionChange={setRestaurantIds}
            />
            <FacetedFilter
              title='Commercial'
              options={users.map((u) => ({
                label: `${u.first_name} ${u.last_name}`,
                value: u.id,
              }))}
              selected={commercialIds}
              onSelectionChange={setCommercialIds}
            />
          </div>
          <p className='text-xs text-muted-foreground'>
            Sans filtre, tous les événements sont exportés.
          </p>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={downloading}>
            {downloading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Exporter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
