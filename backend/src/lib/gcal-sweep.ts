import { supabase } from './supabase.js'
import {
  handleGcalSyncRequest,
  SYNCABLE_STATUS_SLUGS,
} from './google-calendar.js'
import { parisToday } from './status-promotion.js'

// Filet de la sync temps réel (trigger pg_net) : crée les événements manquants
// — backfill à la première activation d'un resto, rattrapage des posts perdus
// pendant un deploy Render. Les updates manqués se rattrapent à la prochaine
// édition du booking (pas de flag dirty en v1, cf. spec).
const BATCH_CAP = 50

export async function runGcalSweep(): Promise<number> {
  const { data: restos, error: restosError } = await supabase
    .from('restaurants')
    .select('id, organization_id')
    .eq('google_calendar_sync_enabled', true)
  if (restosError) throw new Error(`restaurants: ${restosError.message}`)
  if (!restos?.length) return 0

  const orgIds = [...new Set(restos.map((r) => r.organization_id))]
  const { data: statuses, error: statusesError } = await supabase
    .from('statuses')
    .select('id')
    .eq('type', 'booking')
    .in('organization_id', orgIds)
    .in('slug', SYNCABLE_STATUS_SLUGS)
  if (statusesError) throw new Error(`statuses: ${statusesError.message}`)
  if (!statuses?.length) return 0

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id')
    .in('restaurant_id', restos.map((r) => r.id))
    .in('status_id', statuses.map((s) => s.id))
    .is('google_calendar_event_id', null)
    .gte('event_date', parisToday(new Date()))
    .order('event_date', { ascending: true })
    .limit(BATCH_CAP)
  if (bookingsError) throw new Error(`bookings: ${bookingsError.message}`)
  if (!bookings?.length) return 0

  for (const b of bookings) {
    await handleGcalSyncRequest({ action: 'upsert', booking_id: b.id })
  }
  console.log(`[gcal-sweep] ${bookings.length} booking(s) traité(s)`)
  return bookings.length
}

let sweepInFlight = false

// Run au boot (backfill du stock) puis tick 15 min. Idempotent : un booking
// déjà synchronisé n'a plus google_calendar_event_id null.
export function startGcalSweep(): void {
  const tick = async () => {
    if (sweepInFlight) return
    if (process.env.GOOGLE_CALENDAR_SYNC_ENABLED !== 'true') return
    sweepInFlight = true
    try {
      await runGcalSweep()
    } catch (err) {
      console.error(
        '[gcal-sweep] tick en echec:',
        err instanceof Error ? err.message : err
      )
    } finally {
      sweepInFlight = false
    }
  }
  void tick()
  setInterval(tick, 900_000)
}
