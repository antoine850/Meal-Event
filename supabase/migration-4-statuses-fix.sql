-- ============================================
-- Migration 4: Fix statuses table and add default data
-- ============================================

-- Add display_order column (alias for position)
ALTER TABLE statuses ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Update display_order from position if position exists
UPDATE statuses SET display_order = position WHERE display_order IS NULL OR display_order = 0;

-- ============================================
-- Create default statuses for new organizations
-- This function will be called after organization creation
-- ============================================

-- Function to create default statuses for an organization
CREATE OR REPLACE FUNCTION create_default_statuses(org_id UUID)
RETURNS void AS $$
BEGIN
  -- Contact statuses (pipeline commercial)
  INSERT INTO statuses (organization_id, name, slug, color, type, display_order, is_default) VALUES
    (org_id, 'Nouveau', 'nouveau', '#ef4444', 'contact', 1, true),
    (org_id, 'Qualification', 'qualification', '#f97316', 'contact', 2, false),
    (org_id, 'Proposition', 'proposition', '#eab308', 'contact', 3, false),
    (org_id, 'Négociation', 'negociation', '#84cc16', 'contact', 4, false),
    (org_id, 'Confirmé', 'confirme', '#22c55e', 'contact', 5, false),
    (org_id, 'Fonction envoyée', 'fonction_envoyee', '#14b8a6', 'contact', 6, false),
    (org_id, 'A facturer', 'a_facturer', '#3b82f6', 'contact', 7, false),
    (org_id, 'Attente paiement', 'attente_paiement', '#8b5cf6', 'contact', 8, false),
    (org_id, 'Relance paiement', 'relance_paiement', '#ec4899', 'contact', 9, false),
    (org_id, 'Terminé', 'termine', '#6b7280', 'contact', 10, false),
    (org_id, 'Annulé', 'annule', '#991b1b', 'contact', 11, false)
  ON CONFLICT (organization_id, slug, type) DO NOTHING;

  -- Booking statuses
  INSERT INTO statuses (organization_id, name, slug, color, type, display_order, is_default) VALUES
    (org_id, 'En attente', 'pending', '#eab308', 'booking', 1, true),
    (org_id, 'Confirmée', 'confirmed', '#22c55e', 'booking', 2, false),
    (org_id, 'Annulée', 'cancelled', '#ef4444', 'booking', 3, false),
    (org_id, 'Terminée', 'completed', '#6b7280', 'booking', 4, false)
  ON CONFLICT (organization_id, slug, type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- For existing organizations without statuses, run this:
-- SELECT create_default_statuses(id) FROM organizations;
-- ============================================
