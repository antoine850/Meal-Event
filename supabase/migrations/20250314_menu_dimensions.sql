-- Menu Dimensions: reusable menu choice templates linked to restaurants (like products)
-- These are pre-defined menu options that can be reused across multiple menu forms

CREATE TABLE IF NOT EXISTS menu_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction table for menu_dimensions <-> restaurants (like product_restaurants)
CREATE TABLE IF NOT EXISTS menu_dimension_restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_dimension_id UUID NOT NULL REFERENCES menu_dimensions(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(menu_dimension_id, restaurant_id)
);

-- Menu dimension options: the actual choices within a dimension
CREATE TABLE IF NOT EXISTS menu_dimension_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_dimension_id UUID NOT NULL REFERENCES menu_dimensions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add description field to menu_form_fields options (stored as JSON with label + description)
-- The options field already exists as JSONB, we'll store objects like: [{"label": "Option 1", "description": "Description"}]

-- Add reference to menu_dimension for menu_form_fields (optional - if using a template)
ALTER TABLE menu_form_fields ADD COLUMN IF NOT EXISTS menu_dimension_id UUID REFERENCES menu_dimensions(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_menu_dimensions_org ON menu_dimensions(organization_id);
CREATE INDEX IF NOT EXISTS idx_menu_dimension_restaurants_dim ON menu_dimension_restaurants(menu_dimension_id);
CREATE INDEX IF NOT EXISTS idx_menu_dimension_restaurants_rest ON menu_dimension_restaurants(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_dimension_options_dim ON menu_dimension_options(menu_dimension_id);
CREATE INDEX IF NOT EXISTS idx_menu_form_fields_dimension ON menu_form_fields(menu_dimension_id);

-- Enable RLS
ALTER TABLE menu_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_dimension_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_dimension_options ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_dimensions
CREATE POLICY "Users can view menu dimensions in their organization" ON menu_dimensions
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert menu dimensions in their organization" ON menu_dimensions
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update menu dimensions in their organization" ON menu_dimensions
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete menu dimensions in their organization" ON menu_dimensions
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- RLS Policies for menu_dimension_restaurants
CREATE POLICY "Users can view menu dimension restaurants" ON menu_dimension_restaurants
  FOR SELECT USING (menu_dimension_id IN (SELECT id FROM menu_dimensions WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can insert menu dimension restaurants" ON menu_dimension_restaurants
  FOR INSERT WITH CHECK (menu_dimension_id IN (SELECT id FROM menu_dimensions WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can delete menu dimension restaurants" ON menu_dimension_restaurants
  FOR DELETE USING (menu_dimension_id IN (SELECT id FROM menu_dimensions WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

-- RLS Policies for menu_dimension_options
CREATE POLICY "Users can view menu dimension options" ON menu_dimension_options
  FOR SELECT USING (menu_dimension_id IN (SELECT id FROM menu_dimensions WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can insert menu dimension options" ON menu_dimension_options
  FOR INSERT WITH CHECK (menu_dimension_id IN (SELECT id FROM menu_dimensions WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can update menu dimension options" ON menu_dimension_options
  FOR UPDATE USING (menu_dimension_id IN (SELECT id FROM menu_dimensions WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can delete menu dimension options" ON menu_dimension_options
  FOR DELETE USING (menu_dimension_id IN (SELECT id FROM menu_dimensions WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));
