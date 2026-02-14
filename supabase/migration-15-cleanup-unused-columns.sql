-- ============================================
-- MIGRATION 15: Cleanup Unused Columns
-- ============================================

-- ============================================
-- 1. Remove time_slot_id from bookings
-- Never used in frontend, time_slots table was
-- supposed to be dropped in migration-12
-- ============================================

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_time_slot_id_fkey;
ALTER TABLE bookings DROP COLUMN IF EXISTS time_slot_id;

-- ============================================
-- 2. Remove description from booking_events
-- Exists in Supabase but never used in frontend
-- or in TypeScript types
-- ============================================

ALTER TABLE booking_events DROP COLUMN IF EXISTS description;

-- ============================================
-- 3. Drop time_slots and restaurant_time_slots
-- tables if they still exist (should have been
-- dropped in migration-12)
-- ============================================

DROP TABLE IF EXISTS restaurant_time_slots CASCADE;
DROP TABLE IF EXISTS time_slots CASCADE;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify time_slot_id removed from bookings
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name = 'time_slot_id';
-- Expected: No rows

-- Verify description removed from booking_events
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'booking_events' AND column_name = 'description';
-- Expected: No rows

-- Verify time_slots table dropped
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('time_slots', 'restaurant_time_slots');
-- Expected: No rows
