-- ============================================
-- MIGRATION 14: Sync Frontend ↔ Supabase
-- Fix all discrepancies found during audit
-- ============================================

-- ============================================
-- PROBLEM 1: bookings table missing columns
-- Frontend uses occasion, option, relance, source
-- but they don't exist in Supabase
-- ============================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS occasion character varying;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS option character varying;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS relance character varying;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source character varying;

-- ============================================
-- PROBLEM 2: contacts.status_id already removed
-- from Supabase but still in TS types
-- → No SQL needed, only TS types update
-- ============================================

-- ============================================
-- PROBLEM 3: contacts.restaurant_id exists in
-- Supabase but missing from TS types
-- → No SQL needed, only TS types update
-- ============================================

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify bookings now has occasion, option, relance, source
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('occasion', 'option', 'relance', 'source')
ORDER BY column_name;

-- Verify contacts does NOT have status_id
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'contacts'
  AND column_name = 'status_id';

-- Verify contacts HAS restaurant_id
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'contacts'
  AND column_name = 'restaurant_id';
