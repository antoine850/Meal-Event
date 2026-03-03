-- Menu Forms: shareable forms for client menu choices
CREATE TABLE IF NOT EXISTS menu_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Choix de menu',
  description TEXT,
  guests_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'shared', 'submitted', 'locked')),
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  client_comment TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Menu Form Fields: dynamic fields with options
CREATE TABLE IF NOT EXISTS menu_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_form_id UUID NOT NULL REFERENCES menu_forms(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'select' CHECK (field_type IN ('select', 'text')),
  options JSONB DEFAULT '[]'::jsonb,
  is_per_person BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Menu Form Responses: one row per guest per field
CREATE TABLE IF NOT EXISTS menu_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_form_id UUID NOT NULL REFERENCES menu_forms(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES menu_form_fields(id) ON DELETE CASCADE,
  guest_index INTEGER NOT NULL DEFAULT 0,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_menu_forms_booking ON menu_forms(booking_id);
CREATE INDEX IF NOT EXISTS idx_menu_forms_token ON menu_forms(share_token);
CREATE INDEX IF NOT EXISTS idx_menu_form_fields_form ON menu_form_fields(menu_form_id);
CREATE INDEX IF NOT EXISTS idx_menu_form_responses_form ON menu_form_responses(menu_form_id);
CREATE INDEX IF NOT EXISTS idx_menu_form_responses_field ON menu_form_responses(field_id);

-- Enable RLS
ALTER TABLE menu_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_form_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_forms
CREATE POLICY "Users can manage menu_forms in their org"
  ON menu_forms FOR ALL
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Public read/write for shared forms via token (for client access)
CREATE POLICY "Public can view shared menu_forms by token"
  ON menu_forms FOR SELECT
  USING (status IN ('shared', 'submitted'));

CREATE POLICY "Public can update shared menu_forms"
  ON menu_forms FOR UPDATE
  USING (status = 'shared')
  WITH CHECK (status IN ('shared', 'submitted'));

-- RLS Policies for menu_form_fields
CREATE POLICY "Users can manage menu_form_fields in their org"
  ON menu_form_fields FOR ALL
  USING (menu_form_id IN (SELECT id FROM menu_forms WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())))
  WITH CHECK (menu_form_id IN (SELECT id FROM menu_forms WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Public can view fields of shared forms"
  ON menu_form_fields FOR SELECT
  USING (menu_form_id IN (SELECT id FROM menu_forms WHERE status IN ('shared', 'submitted')));

-- RLS Policies for menu_form_responses
CREATE POLICY "Users can manage menu_form_responses in their org"
  ON menu_form_responses FOR ALL
  USING (menu_form_id IN (SELECT id FROM menu_forms WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())))
  WITH CHECK (menu_form_id IN (SELECT id FROM menu_forms WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Public can manage responses of shared forms"
  ON menu_form_responses FOR ALL
  USING (menu_form_id IN (SELECT id FROM menu_forms WHERE status IN ('shared', 'submitted')))
  WITH CHECK (menu_form_id IN (SELECT id FROM menu_forms WHERE status = 'shared'));
