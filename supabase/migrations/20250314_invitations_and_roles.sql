-- ============================================
-- INVITATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  token UUID DEFAULT uuid_generate_v4(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  restaurant_ids UUID[] DEFAULT '{}',
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email, status)
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations(organization_id);

-- ============================================
-- ADD MISSING ROLES FOR EXISTING ORGS
-- ============================================

INSERT INTO roles (organization_id, name, slug, description, is_default)
SELECT o.id, 'Commercial', 'commercial', 'Gestion des contacts et réservations de ses restaurants', TRUE
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.organization_id = o.id AND r.slug = 'commercial');

INSERT INTO roles (organization_id, name, slug, description, is_default)
SELECT o.id, 'Gérant Restaurant', 'gerant', 'Accès aux événements de son/ses restaurant(s) uniquement', TRUE
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.organization_id = o.id AND r.slug = 'gerant');

-- ============================================
-- ASSIGN PERMISSIONS TO ALL ORG ROLES
-- ============================================

-- Admin: ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'admin'
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Commercial
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'commercial'
AND p.slug IN (
  'dashboard.view', 'dashboard.commercial.view',
  'contacts.view', 'contacts.create', 'contacts.update',
  'bookings.view', 'bookings.create', 'bookings.update',
  'quotes.view', 'quotes.create', 'quotes.update', 'quotes.send',
  'payments.view', 'payments.create', 'payments.remind',
  'restaurants.view',
  'settings.view'
)
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Gérant
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'gerant'
AND p.slug IN (
  'dashboard.view', 'dashboard.restaurant.view',
  'bookings.view',
  'restaurants.view'
)
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
