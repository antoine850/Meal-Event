import { google, calendar_v3 } from 'googleapis'
import { supabase } from './supabase.js'
import { parisToday } from './status-promotion.js'

// `calendar` → read/write calendar events
// `userinfo.email` → required so we can fetch the connected Google account's
// email via oauth2.userinfo.get() and display it in the settings UI.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
]

// ============================================
// OAuth2 Client
// ============================================

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI // e.g. https://api.mealevent.fr/api/google-calendar/callback
  )
}

export function getAuthUrl(restaurantId: string): string {
  const oauth2Client = getOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: restaurantId, // pass restaurant ID through OAuth flow
  })
}

export async function handleOAuthCallback(code: string, restaurantId: string) {
  const oauth2Client = getOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)

  if (!tokens.refresh_token) {
    throw new Error('No refresh token received. User may need to revoke access and reconnect.')
  }

  // Try to fetch the connected Google account email. This is a nice-to-have
  // for the settings UI — if it fails (e.g. scope not granted yet), we still
  // persist the refresh_token so the connection itself succeeds.
  let email: string | null = null
  try {
    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()
    email = userInfo.email || null
  } catch (err) {
    console.warn('[GCal] Failed to fetch userinfo (connection will still succeed):', err instanceof Error ? err.message : err)
  }

  // Store refresh token on restaurant
  await supabase
    .from('restaurants')
    .update({
      google_refresh_token: tokens.refresh_token,
      google_calendar_email: email,
    } as never)
    .eq('id', restaurantId)

  return { email }
}

// ============================================
// Authenticated Calendar Client
// ============================================

async function getCalendarClient(restaurantId: string): Promise<{ calendar: calendar_v3.Calendar; calendarId: string } | null> {
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('google_refresh_token, google_calendar_id, google_calendar_sync_enabled')
    .eq('id', restaurantId)
    .single()

  if (!restaurant?.google_refresh_token || !restaurant?.google_calendar_id || !restaurant?.google_calendar_sync_enabled) {
    return null
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: restaurant.google_refresh_token })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  return { calendar, calendarId: restaurant.google_calendar_id }
}

// ============================================
// List Calendars (for picker UI)
// ============================================

export async function listCalendars(restaurantId: string): Promise<{ id: string; summary: string; primary: boolean }[]> {
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('google_refresh_token')
    .eq('id', restaurantId)
    .single()

  if (!restaurant?.google_refresh_token) return []

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: restaurant.google_refresh_token })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  const { data } = await calendar.calendarList.list()

  return (data.items || [])
    .filter((cal) => cal.accessRole === 'owner' || cal.accessRole === 'writer')
    .map((cal) => ({
      id: cal.id || '',
      summary: cal.summary || '',
      primary: cal.primary || false,
    }))
}

// ============================================
// Disconnect
// ============================================

export async function disconnectCalendar(restaurantId: string) {
  // Try to revoke the token
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('google_refresh_token')
    .eq('id', restaurantId)
    .single()

  if (restaurant?.google_refresh_token) {
    try {
      const oauth2Client = getOAuth2Client()
      await oauth2Client.revokeToken(restaurant.google_refresh_token)
    } catch {
      // Token may already be revoked, continue cleanup
    }
  }

  await supabase
    .from('restaurants')
    .update({
      google_refresh_token: null,
      google_calendar_id: null,
      google_calendar_sync_enabled: false,
      google_calendar_email: null,
    } as never)
    .eq('id', restaurantId)
}

// ============================================
// Event Sync: Create / Update / Delete
// ============================================

interface BookingEventData {
  id: string
  event_date: string
  start_time?: string | null
  end_time?: string | null
  guests_count: number
  occasion?: string | null
  event_type?: string | null
  reservation_type?: string | null
  is_privatif?: boolean
  contact?: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
  } | null
  restaurant?: {
    name?: string
  } | null
  space?: {
    name?: string
  } | null
  commentaires?: string | null
  allergies_regimes?: string | null
  budget_client?: string | null
}

export function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function buildCalendarEvent(booking: BookingEventData): calendar_v3.Schema$Event {
  const contactName = booking.contact
    ? `${booking.contact.first_name || ''} ${booking.contact.last_name || ''}`.trim()
    : 'Client inconnu'

  const parts: string[] = []
  parts.push(`Invités: ${booking.guests_count}`)
  if (booking.event_type) parts.push(`Type: ${booking.event_type}`)
  if (booking.reservation_type) parts.push(`Réservation: ${booking.reservation_type}`)
  if (booking.is_privatif) parts.push('Privatif')
  if (booking.space?.name) parts.push(`Espace: ${booking.space.name}`)
  if (booking.contact?.email) parts.push(`Email: ${booking.contact.email}`)
  if (booking.contact?.phone) parts.push(`Tél: ${booking.contact.phone}`)
  if (booking.budget_client) parts.push(`Budget: ${booking.budget_client}`)
  if (booking.allergies_regimes) parts.push(`Allergies: ${booking.allergies_regimes}`)
  if (booking.commentaires) parts.push(`Notes: ${booking.commentaires}`)

  const summary = `${booking.occasion || 'Événement'} — ${contactName} (${booking.guests_count} pers.)`
  const description = parts.join('\n')

  // Build date/time
  const event: calendar_v3.Schema$Event = {
    summary,
    description,
  }

  if (booking.start_time) {
    // Timed event
    const startDateTime = `${booking.event_date}T${booking.start_time}:00`
    const endTime = booking.end_time || (booking.start_time === '12:00' ? '15:00' : '23:00')
    const endDateTime = `${booking.event_date}T${endTime}:00`

    event.start = { dateTime: startDateTime, timeZone: 'Europe/Paris' }
    event.end = { dateTime: endDateTime, timeZone: 'Europe/Paris' }
  } else {
    // All-day : l'API Google exige une fin exclusive (lendemain), sinon 400.
    event.start = { date: booking.event_date }
    event.end = { date: nextDay(booking.event_date) }
  }

  return event
}

export async function createCalendarEvent(restaurantId: string, booking: BookingEventData): Promise<string | null> {
  try {
    const client = await getCalendarClient(restaurantId)
    if (!client) return null

    const event = buildCalendarEvent(booking)
    const { data } = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody: event,
    })

    const eventId = data.id || null

    // Store event ID on booking
    if (eventId) {
      await supabase
        .from('bookings')
        .update({ google_calendar_event_id: eventId } as never)
        .eq('id', booking.id)
    }

    console.log(`[GCal] Created event ${eventId} for booking ${booking.id}`)
    return eventId
  } catch (error) {
    console.error(`[GCal] Error creating event for booking ${booking.id}:`, error)
    return null
  }
}

export async function updateCalendarEvent(restaurantId: string, booking: BookingEventData, googleEventId: string): Promise<boolean> {
  try {
    const client = await getCalendarClient(restaurantId)
    if (!client) return false

    const event = buildCalendarEvent(booking)
    await client.calendar.events.update({
      calendarId: client.calendarId,
      eventId: googleEventId,
      requestBody: event,
    })

    console.log(`[GCal] Updated event ${googleEventId} for booking ${booking.id}`)
    return true
  } catch (error) {
    console.error(`[GCal] Error updating event for booking ${booking.id}:`, error)
    const status = (error as any)?.response?.status ?? (error as any)?.code
    // Google ne connait plus l'evenement : l'id stocke est perime, on l'oublie
    // pour que le sweep en recree un propre.
    if (status === 404 || status === 410) {
      await supabase
        .from('bookings')
        .update({ google_calendar_event_id: null } as never)
        .eq('id', booking.id)
    }
    return false
  }
}

export async function deleteCalendarEvent(restaurantId: string, googleEventId: string): Promise<boolean> {
  try {
    const client = await getCalendarClient(restaurantId)
    if (!client) return false

    await client.calendar.events.delete({
      calendarId: client.calendarId,
      eventId: googleEventId,
    })

    console.log(`[GCal] Deleted event ${googleEventId}`)
    return true
  } catch (error) {
    console.error(`[GCal] Error deleting event ${googleEventId}:`, error)
    return false
  }
}

// ============================================
// Sync helper: fetch full booking data and sync
// ============================================

// Only bookings in one of these statuses are pushed to Google Calendar.
// Anything earlier in the pipeline (nouveau, en discussion, proposition…) is ignored.
// Kept in sync with src/features/dashboard/hooks/use-dashboard-data.ts `CONFIRMED_SLUGS`.
export const SYNCABLE_STATUS_SLUGS = [
  'confirme_fonctionnaire', // Confirmé / Fonction à faire
  'fonction_envoyee',       // Fonction envoyée
  'a_facturer',             // À facturer
  'cloture',                // Clôturé
]

// Kill switch pilotable depuis Render sans deploy.
const syncEnabled = () => process.env.GOOGLE_CALENDAR_SYNC_ENABLED === 'true'

export interface GcalSyncPayload {
  action: 'upsert' | 'delete'
  booking_id: string
  restaurant_id?: string | null
  google_calendar_event_id?: string | null
  prev_restaurant_id?: string | null
  prev_event_id?: string | null
}

// Sérialisation par booking : deux écritures rapprochées ne créent qu'un
// événement, la dernière version est re-synchronisée en fin de vol.
const inFlight = new Map<string, { rerun: boolean }>()

async function withBookingLock(bookingId: string, fn: () => Promise<void>) {
  const current = inFlight.get(bookingId)
  if (current) {
    current.rerun = true
    return
  }
  const entry = { rerun: false }
  inFlight.set(bookingId, entry)
  try {
    await fn()
  } finally {
    inFlight.delete(bookingId)
  }
  if (entry.rerun) await withBookingLock(bookingId, fn)
}

// Point d'entrée du trigger DB (via routes/internal.ts).
export async function handleGcalSyncRequest(payload: GcalSyncPayload) {
  if (!syncEnabled()) return
  try {
    if (payload.action === 'delete') {
      // La ligne bookings n'existe plus : tout vient du payload (valeurs OLD).
      if (payload.restaurant_id && payload.google_calendar_event_id) {
        await deleteCalendarEvent(payload.restaurant_id, payload.google_calendar_event_id)
      }
      return
    }
    await withBookingLock(payload.booking_id, async () => {
      // Booking déplacé vers un autre resto : purger l'ancien calendrier avant
      // l'upsert, sinon événement fantôme + update 404 dans le nouveau.
      if (payload.prev_restaurant_id && payload.prev_event_id) {
        await deleteCalendarEvent(payload.prev_restaurant_id, payload.prev_event_id)
        await supabase
          .from('bookings')
          .update({ google_calendar_event_id: null } as never)
          .eq('id', payload.booking_id)
          .eq('google_calendar_event_id', payload.prev_event_id)
      }
      await syncBookingToCalendar(payload.booking_id)
    })
  } catch (error) {
    console.error(`[GCal] handleGcalSyncRequest ${payload.booking_id}:`, error)
  }
}

export async function syncBookingToCalendar(bookingId: string) {
  if (!syncEnabled()) return
  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, event_date, start_time, end_time, guests_count, occasion, event_type,
        reservation_type, is_privatif, commentaires, allergies_regimes, budget_client,
        restaurant_id, space_id, google_calendar_event_id,
        status:statuses (slug),
        contact:contacts (first_name, last_name, email, phone),
        restaurant:restaurants (name)
      `)
      .eq('id', bookingId)
      .single()

    if (error) {
      console.error(`[GCal] Fetch failed for booking ${bookingId}: ${error.message}`)
      return
    }
    if (!booking || !booking.restaurant_id) return

    // Unwrap joined relations (Supabase returns arrays for joins)
    const statusRel = Array.isArray(booking.status) ? booking.status[0] : booking.status
    const statusSlug: string | null = (statusRel as { slug?: string } | null)?.slug || null
    const isSyncable = statusSlug !== null && SYNCABLE_STATUS_SLUGS.includes(statusSlug)

    // Gate: booking status must be "Confirmé / Fonction à faire" or later.
    if (!isSyncable) {
      // If the booking was previously synced and is now demoted (e.g. status
      // rolled back to "proposition"), remove the stale event from the calendar.
      if (booking.google_calendar_event_id) {
        console.log(`[GCal] Booking ${bookingId} no longer syncable (status=${statusSlug}), removing stale calendar event`)
        await deleteCalendarEvent(booking.restaurant_id, booking.google_calendar_event_id)
        // Clear the stored event id so a later re-confirmation creates a fresh event.
        await supabase
          .from('bookings')
          .update({ google_calendar_event_id: null } as never)
          .eq('id', bookingId)
      }
      return
    }

    // Pas de FK bookings->spaces exposée côté PostgREST prod : l'embed échoue,
    // on résout à part (même pattern que fiche-fonction-pdf.ts).
    let space: { name: string } | null = null
    if (booking.space_id) {
      const { data: spaceRow } = await supabase
        .from('spaces')
        .select('name')
        .eq('id', booking.space_id)
        .single()
      space = spaceRow ?? null
    }

    const bookingData: BookingEventData = {
      ...booking,
      contact: Array.isArray(booking.contact) ? booking.contact[0] : booking.contact,
      restaurant: Array.isArray(booking.restaurant) ? booking.restaurant[0] : booking.restaurant,
      space,
    }

    if (!booking.google_calendar_event_id) {
      // Pas de création rétroactive : l'historique (à facturer, clôturé)
      // n'encombre pas les calendriers.
      if (booking.event_date < parisToday(new Date())) return
      await createCalendarEvent(booking.restaurant_id, bookingData)
    } else {
      await updateCalendarEvent(booking.restaurant_id, bookingData, booking.google_calendar_event_id)
    }
  } catch (error) {
    console.error(`[GCal] Sync error for booking ${bookingId}:`, error)
  }
}
