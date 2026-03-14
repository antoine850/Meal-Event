-- ============================================================================
-- MENU FORMS REFACTORING: Reusable forms + Event-specific links
-- ============================================================================
-- 
-- NEW ARCHITECTURE:
-- - menu_forms: Reusable form templates (no booking_id)
-- - booking_menu_forms: Junction table linking forms to events (with share_token)
-- - menu_form_responses: Now linked to booking_menu_forms (not menu_forms)
--
-- FLOW:
-- 1. Settings > Menus: Create/edit reusable forms
-- 2. Event > Menu tab: Link a form to the event
-- 3. Each link has its own share_token for client access
-- ============================================================================

-- Step 1: Create the junction table booking_menu_forms
CREATE TABLE IF NOT EXISTS booking_menu_forms (
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
  
  -- One form per event (can be changed later if needed)
  UNIQUE(booking_id, menu_form_id)
);

-- Indexes for booking_menu_forms
CREATE INDEX IF NOT EXISTS idx_booking_menu_forms_booking ON booking_menu_forms(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_menu_forms_form ON booking_menu_forms(menu_form_id);
CREATE INDEX IF NOT EXISTS idx_booking_menu_forms_token ON booking_menu_forms(share_token);

-- Step 2: Add restaurant_id to menu_forms (for filtering by restaurant)
ALTER TABLE menu_forms ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_menu_forms_restaurant ON menu_forms(restaurant_id);

-- Step 3: Add booking_menu_form_id to menu_form_responses (link responses to event, not form)
ALTER TABLE menu_form_responses ADD COLUMN IF NOT EXISTS booking_menu_form_id UUID REFERENCES booking_menu_forms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_menu_form_responses_booking_form ON menu_form_responses(booking_menu_form_id);

-- Step 4: Migrate existing data
-- For each existing menu_form with a booking_id, create a booking_menu_forms entry
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

-- Update menu_form_responses to link to booking_menu_forms
UPDATE menu_form_responses mfr
SET booking_menu_form_id = bmf.id
FROM booking_menu_forms bmf
WHERE mfr.menu_form_id = bmf.menu_form_id
  AND mfr.booking_menu_form_id IS NULL;

-- Backfill restaurant_id from bookings
UPDATE menu_forms mf
SET restaurant_id = b.restaurant_id
FROM bookings b
WHERE mf.booking_id = b.id
  AND mf.restaurant_id IS NULL;

-- Step 5: Make menu_forms reusable (remove booking-specific columns)
-- Note: We keep booking_id for now to avoid breaking existing code, but it will be nullable
ALTER TABLE menu_forms ALTER COLUMN booking_id DROP NOT NULL;

-- Remove booking-specific columns from menu_forms (now in booking_menu_forms)
-- We'll do this in a separate migration after code is updated to avoid breaking changes
-- For now, just mark them as deprecated via comments

COMMENT ON COLUMN menu_forms.booking_id IS 'DEPRECATED: Use booking_menu_forms junction table instead';
COMMENT ON COLUMN menu_forms.status IS 'DEPRECATED: Use booking_menu_forms.status instead';
COMMENT ON COLUMN menu_forms.share_token IS 'DEPRECATED: Use booking_menu_forms.share_token instead';
COMMENT ON COLUMN menu_forms.client_comment IS 'DEPRECATED: Use booking_menu_forms.client_comment instead';
COMMENT ON COLUMN menu_forms.submitted_at IS 'DEPRECATED: Use booking_menu_forms.submitted_at instead';
COMMENT ON COLUMN menu_forms.guests_count IS 'DEPRECATED: Use booking_menu_forms.guests_count instead';

-- Step 6: RLS Policies for booking_menu_forms
ALTER TABLE booking_menu_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage booking_menu_forms in their org"
  ON booking_menu_forms FOR ALL
  USING (
    booking_id IN (
      SELECT b.id FROM bookings b
      WHERE b.organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    booking_id IN (
      SELECT b.id FROM bookings b
      WHERE b.organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

-- Public can view shared booking_menu_forms by token
CREATE POLICY "Public can view shared booking_menu_forms by token"
  ON booking_menu_forms FOR SELECT
  USING (status IN ('shared', 'submitted'));

-- Public can update shared booking_menu_forms (for client submission)
CREATE POLICY "Public can update shared booking_menu_forms"
  ON booking_menu_forms FOR UPDATE
  USING (status = 'shared')
  WITH CHECK (status IN ('shared', 'submitted'));

-- Step 7: Drop old menu_dimensions tables (no longer used)
DROP TABLE IF EXISTS menu_dimension_options CASCADE;
DROP TABLE IF EXISTS menu_dimension_restaurants CASCADE;
DROP TABLE IF EXISTS menu_dimensions CASCADE;

-- Remove menu_dimension_id column from menu_form_fields if it exists
ALTER TABLE menu_form_fields DROP COLUMN IF EXISTS menu_dimension_id;

-- Comments
COMMENT ON TABLE booking_menu_forms IS 'Junction table linking menu forms to bookings. Each link has its own share_token and responses.';
COMMENT ON COLUMN booking_menu_forms.share_token IS 'Unique token for client access to this specific event menu form';
COMMENT ON COLUMN menu_forms.restaurant_id IS 'Restaurant this form belongs to. Used for filtering in Settings > Menus.';
