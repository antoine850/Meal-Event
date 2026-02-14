-- ============================================
-- MIGRATION 16: Cleanup Unused Bookings Columns
-- Remove columns from bookings table that are
-- not used by the frontend
-- ============================================

-- ============================================
-- ANALYSIS OF BOOKINGS COLUMNS
-- ============================================
-- KEEP (used in frontend):
-- - id, organization_id, restaurant_id, contact_id
-- - status_id, assigned_to
-- - occasion, option, relance, source (added in migration-14)
-- - is_table_blocked, has_extra_provider
-- - event_date, created_at, updated_at
--
-- REMOVE (not used in frontend):
-- - event_type (belongs in booking_events)
-- - start_time, end_time (belong in booking_events)
-- - guests_count (belongs in booking_events)
-- - space_id (belongs in booking_events)
-- - total_amount, deposit_amount, deposit_percentage (billing, not used)
-- - internal_notes, client_notes, special_requests (belong in booking_events)
-- - notion_url (not used)
-- - time_slot_id (already removed in migration-15)
-- ============================================

-- Drop foreign key constraints first
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_space_id_fkey;

-- Remove unused columns
ALTER TABLE bookings DROP COLUMN IF EXISTS event_type;
ALTER TABLE bookings DROP COLUMN IF EXISTS start_time;
ALTER TABLE bookings DROP COLUMN IF EXISTS end_time;
ALTER TABLE bookings DROP COLUMN IF EXISTS guests_count;
ALTER TABLE bookings DROP COLUMN IF EXISTS space_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS total_amount;
ALTER TABLE bookings DROP COLUMN IF EXISTS deposit_amount;
ALTER TABLE bookings DROP COLUMN IF EXISTS deposit_percentage;
ALTER TABLE bookings DROP COLUMN IF EXISTS internal_notes;
ALTER TABLE bookings DROP COLUMN IF EXISTS client_notes;
ALTER TABLE bookings DROP COLUMN IF EXISTS special_requests;
ALTER TABLE bookings DROP COLUMN IF EXISTS notion_url;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show remaining columns in bookings table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
ORDER BY ordinal_position;

-- Count remaining columns
SELECT COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'bookings';
