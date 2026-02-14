-- ============================================
-- MIGRATION 17: Update Booking Statuses
-- Replace old statuses with new ones
-- ============================================

-- Delete old statuses
DELETE FROM statuses WHERE type = 'booking';

-- Insert new statuses
INSERT INTO statuses (id, organization_id, name, slug, color, type, created_at, updated_at)
VALUES
  (gen_random_uuid(), NULL, 'Nouveau', 'nouveau', '#fbbf24', 'booking', NOW(), NOW()),
  (gen_random_uuid(), NULL, 'Qualification', 'qualification', '#f97316', 'booking', NOW(), NOW()),
  (gen_random_uuid(), NULL, 'Proposition', 'proposition', '#ef4444', 'booking', NOW(), NOW()),
  (gen_random_uuid(), NULL, 'Négociation', 'negociation', '#dc2626', 'booking', NOW(), NOW()),
  (gen_random_uuid(), NULL, 'Confirmé / Fonctionnel', 'confirme-fonctionnel', '#22c55e', 'booking', NOW(), NOW()),
  (gen_random_uuid(), NULL, 'Fonction envoyée', 'fonction-envoyee', '#0ea5e9', 'booking', NOW(), NOW()),
  (gen_random_uuid(), NULL, 'À facturer', 'a-facturer', '#a855f7', 'booking', NOW(), NOW()),
  (gen_random_uuid(), NULL, 'Attente paiement', 'attente-paiement', '#ec4899', 'booking', NOW(), NOW()),
  (gen_random_uuid(), NULL, 'Relance paiement', 'relance-paiement', '#f472b6', 'booking', NOW(), NOW());

-- ============================================
-- VERIFICATION
-- ============================================

-- Show all booking statuses
SELECT id, name, slug, color, type
FROM statuses
WHERE type = 'booking'
ORDER BY created_at;

-- Count statuses
SELECT COUNT(*) as total_statuses
FROM statuses
WHERE type = 'booking';
