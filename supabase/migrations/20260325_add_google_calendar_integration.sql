-- Google Calendar integration columns on restaurants
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_calendar_email TEXT;

-- Track Google Calendar event ID on bookings for update/delete sync
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
