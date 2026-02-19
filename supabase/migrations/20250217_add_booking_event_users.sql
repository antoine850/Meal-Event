-- Créer la table de liaison pour les commerciaux assignés aux événements
CREATE TABLE booking_event_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_event_id UUID NOT NULL REFERENCES booking_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_event_id, user_id)
);

-- Ajouter une colonne pour stocker les IDs des commerciaux en JSON (alternative)
-- ALTER TABLE booking_events ADD COLUMN assigned_users UUID[] DEFAULT ARRAY[]::UUID[];

-- Créer un index pour améliorer les performances
CREATE INDEX idx_booking_event_users_booking_event_id ON booking_event_users(booking_event_id);
CREATE INDEX idx_booking_event_users_user_id ON booking_event_users(user_id);
