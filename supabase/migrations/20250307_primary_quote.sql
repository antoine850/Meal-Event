-- Migration: Add primary_quote flag on quotes to mark the active quote per booking
-- Date: 2025-03-07
-- Description:
--   - Adds primary_quote boolean (default false)
--   - Ensures only one primary quote per booking via partial unique index

-- 1) Add column
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS primary_quote BOOLEAN DEFAULT FALSE;

-- 2) Partial unique index: only one primary quote per booking
CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_primary_per_booking
  ON quotes(booking_id)
  WHERE primary_quote IS TRUE;

-- 3) Verification message
DO $$
BEGIN
  RAISE NOTICE 'primary_quote column added with unique constraint per booking';
END $$;
