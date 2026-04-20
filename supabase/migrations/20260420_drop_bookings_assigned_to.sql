-- Consolidation de l'assignation commerciale sur bookings :
-- on garde uniquement assigned_user_ids (array multi-user) et on supprime
-- la colonne historique assigned_to (single user).

-- 1. Backfill : pour chaque booking avec assigned_to non null dont
-- assigned_user_ids ne contient pas déjà cet utilisateur, ajouter la valeur.
UPDATE bookings
SET assigned_user_ids = ARRAY[assigned_to]
WHERE assigned_to IS NOT NULL
  AND (assigned_user_ids IS NULL OR array_length(assigned_user_ids, 1) IS NULL);

UPDATE bookings
SET assigned_user_ids = array_append(assigned_user_ids, assigned_to)
WHERE assigned_to IS NOT NULL
  AND NOT (assigned_to = ANY(assigned_user_ids));

-- 2. Drop de l'index et de la contrainte FK puis de la colonne.
DROP INDEX IF EXISTS idx_bookings_assigned;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_assigned_to_fkey;

ALTER TABLE bookings
  DROP COLUMN IF EXISTS assigned_to;

-- 3. Index GIN sur l'array pour les filtres "mes bookings" / par commercial.
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_user_ids
  ON bookings USING GIN (assigned_user_ids);
