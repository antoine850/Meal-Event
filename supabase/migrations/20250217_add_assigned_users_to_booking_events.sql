-- Ajouter une colonne pour stocker les IDs des commerciaux assignés aux événements
ALTER TABLE booking_events ADD COLUMN IF NOT EXISTS assigned_user_ids UUID[] DEFAULT ARRAY[]::UUID[];
