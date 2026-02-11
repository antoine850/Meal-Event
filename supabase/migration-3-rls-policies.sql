-- ============================================
-- Migration 3: Fix RLS Policies for Onboarding
-- Disable RLS on all tables for development
-- ============================================

ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants DISABLE ROW LEVEL SECURITY;
ALTER TABLE statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE spaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE booking_products_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_restaurants DISABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_time_slots DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Alternative: Proper RLS Policies (uncomment if you want RLS enabled)
-- ============================================

/*
-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Organizations: Allow authenticated users to create, and members to read/update their org
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their organization" ON organizations;
CREATE POLICY "Users can update their organization" ON organizations
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Roles: Allow org members to manage roles
DROP POLICY IF EXISTS "Users can create roles in their org" ON roles;
CREATE POLICY "Users can create roles in their org" ON roles
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view roles in their org" ON roles;
CREATE POLICY "Users can view roles in their org" ON roles
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Users: Allow creating user profile and viewing org members
DROP POLICY IF EXISTS "Users can create their profile" ON users;
CREATE POLICY "Users can create their profile" ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can view org members" ON users;
CREATE POLICY "Users can view org members" ON users
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their profile" ON users;
CREATE POLICY "Users can update their profile" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Settings: Allow org members to manage settings
DROP POLICY IF EXISTS "Users can create org settings" ON settings;
CREATE POLICY "Users can create org settings" ON settings
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view org settings" ON settings;
CREATE POLICY "Users can view org settings" ON settings
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );
*/
