-- ============================================================================
-- MENU FORMS CLEANUP & REFACTORING
-- ============================================================================
-- This migration:
-- 1. Drops old/obsolete menu_dimensions tables
-- 2. Cleans up existing booking_menu_forms if it exists
-- 3. Recreates booking_menu_forms properly
-- 4. Updates menu_form_responses to link to booking_menu_forms
-- 5. Adds restaurant_id to menu_forms
-- ============================================================================

-- Step 1: Drop obsolete menu_dimensions tables (if they exist)
DROP TABLE IF EXISTS menu_dimension_restaurants CASCADE;
DROP TABLE IF EXISTS menu_dimension_options CASCADE;
DROP TABLE IF EXISTS menu_dimensions CASCADE;

-- Step 2: Drop existing booking_menu_forms and related policies (clean slate)
DROP POLICY IF EXISTS "Users can manage booking_menu_forms in their org" ON booking_menu_forms;
DROP POLICY IF EXISTS "Users can view booking_menu_forms in their org" ON booking_menu_forms;
DROP POLICY IF EXISTS "Public can view shared booking_menu_forms" ON booking_menu_forms;
DROP TABLE IF EXISTS booking_menu_forms CASCADE;

-- Step 3: Add restaurant_id to menu_forms if not exists
ALTER TABLE menu_forms ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;

-- Step 4: Remove booking_id from menu_forms (make forms reusable)
-- First, we need to handle existing data - keep forms but remove the direct booking link
-- The booking_id will be moved to booking_menu_forms
ALTER TABLE menu_forms ALTER COLUMN booking_id DROP NOT NULL;

-- Step 5: Create the junction table booking_menu_forms
CREATE TABLE booking_menu_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  menu_form_id UUID NOT NULL REFERENCES menu_forms(id) ON DELETE CASCADE,
  
  -- Per-event settings
  guests_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'shared', 'submitted', 'locked')),
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  client_comment TEXT,
  submitted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One form per booking (can link multiple forms to same booking)
  UNIQUE(booking_id, menu_form_id)
);

-- Step 6: Create indexes for booking_menu_forms
CREATE INDEX idx_booking_menu_forms_booking ON booking_menu_forms(booking_id);
CREATE INDEX idx_booking_menu_forms_form ON booking_menu_forms(menu_form_id);
CREATE INDEX idx_booking_menu_forms_token ON booking_menu_forms(share_token);

-- Step 7: Enable RLS on booking_menu_forms
ALTER TABLE booking_menu_forms ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies for booking_menu_forms
CREATE POLICY "Users can manage booking_menu_forms in their org"
  ON booking_menu_forms
  FOR ALL
  USING (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN restaurants r ON b.restaurant_id = r.id
      WHERE r.organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Public can view shared booking_menu_forms"
  ON booking_menu_forms
  FOR SELECT
  USING (status IN ('shared', 'submitted'));

CREATE POLICY "Public can update shared booking_menu_forms"
  ON booking_menu_forms
  FOR UPDATE
  USING (status = 'shared')
  WITH CHECK (status IN ('shared', 'submitted'));

-- Step 9: Add booking_menu_form_id to menu_form_responses (for new architecture)
-- First check if the column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_form_responses' 
    AND column_name = 'booking_menu_form_id'
  ) THEN
    ALTER TABLE menu_form_responses 
    ADD COLUMN booking_menu_form_id UUID REFERENCES booking_menu_forms(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 10: Migrate existing menu_forms data to booking_menu_forms
-- For each menu_form that has a booking_id, create a corresponding booking_menu_forms entry
INSERT INTO booking_menu_forms (booking_id, menu_form_id, guests_count, status, share_token, client_comment, submitted_at, created_at, updated_at)
SELECT 
  mf.booking_id,
  mf.id,
  mf.guests_count,
  mf.status,
  mf.share_token,
  mf.client_comment,
  mf.submitted_at,
  mf.created_at,
  mf.updated_at
FROM menu_forms mf
WHERE mf.booking_id IS NOT NULL
ON CONFLICT (booking_id, menu_form_id) DO NOTHING;

-- Step 11: Update menu_form_responses to link to booking_menu_forms
UPDATE menu_form_responses mfr
SET booking_menu_form_id = bmf.id
FROM booking_menu_forms bmf
JOIN menu_forms mf ON bmf.menu_form_id = mf.id
WHERE mfr.menu_form_id = mf.id
AND mfr.booking_menu_form_id IS NULL;

-- Step 12: Create index on restaurant_id for menu_forms
CREATE INDEX IF NOT EXISTS idx_menu_forms_restaurant ON menu_forms(restaurant_id);

-- Done!
-- After running this migration:
-- - menu_forms are now reusable templates (booking_id is optional/legacy)
-- - booking_menu_forms links forms to specific events with their own share_token
-- - menu_form_responses can be linked to booking_menu_forms
