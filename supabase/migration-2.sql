-- ============================================
-- Migration 2: Update booking_events table
-- Adds detailed event fields for menu, contact, allergies, etc.
-- ============================================

-- Add new columns to booking_events table
ALTER TABLE booking_events
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guests_count INTEGER,
  ADD COLUMN IF NOT EXISTS occasion VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_date_flexible BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_restaurant_flexible BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_preferred_time VARCHAR(100),
  ADD COLUMN IF NOT EXISTS menu_aperitif TEXT,
  ADD COLUMN IF NOT EXISTS menu_entree TEXT,
  ADD COLUMN IF NOT EXISTS menu_plat TEXT,
  ADD COLUMN IF NOT EXISTS menu_dessert TEXT,
  ADD COLUMN IF NOT EXISTS menu_boissons TEXT,
  ADD COLUMN IF NOT EXISTS menu_details JSONB,
  ADD COLUMN IF NOT EXISTS mise_en_place TEXT,
  ADD COLUMN IF NOT EXISTS deroulement TEXT,
  ADD COLUMN IF NOT EXISTS is_privatif BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allergies_regimes TEXT,
  ADD COLUMN IF NOT EXISTS prestations_souhaitees TEXT,
  ADD COLUMN IF NOT EXISTS budget_client DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS format_souhaite VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_sur_place_nom VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_sur_place_tel VARCHAR(50),
  ADD COLUMN IF NOT EXISTS contact_sur_place_societe VARCHAR(255),
  ADD COLUMN IF NOT EXISTS instructions_speciales TEXT,
  ADD COLUMN IF NOT EXISTS commentaires TEXT,
  ADD COLUMN IF NOT EXISTS date_signature_devis DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Remove old description column if it exists (replaced by commentaires)
-- ALTER TABLE booking_events DROP COLUMN IF EXISTS description;

-- Add trigger for updated_at
CREATE OR REPLACE TRIGGER update_booking_events_updated_at 
  BEFORE UPDATE ON booking_events 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add index on space_id for performance
CREATE INDEX IF NOT EXISTS idx_booking_events_space ON booking_events(space_id);

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON COLUMN booking_events.occasion IS 'Type d''occasion: "Diner d''équipe - Société ORANGE"';
COMMENT ON COLUMN booking_events.client_preferred_time IS 'Horaire souhaité par le client: "20H"';
COMMENT ON COLUMN booking_events.menu_aperitif IS 'Détails apéritif: "3 AB + 1 coupe de champagne"';
COMMENT ON COLUMN booking_events.menu_entree IS 'Détails entrée: "25 La Tartelette"';
COMMENT ON COLUMN booking_events.menu_plat IS 'Détails plat: "25 L''Orzo"';
COMMENT ON COLUMN booking_events.menu_dessert IS 'Détails dessert: "25 Le Flan"';
COMMENT ON COLUMN booking_events.menu_boissons IS 'Détails boissons: "1/2 bouteille eau + café, 25 formules vin"';
COMMENT ON COLUMN booking_events.menu_details IS 'Détails structurés du menu en JSON si besoin';
COMMENT ON COLUMN booking_events.mise_en_place IS 'Instructions mise en place: "choix de la direction"';
COMMENT ON COLUMN booking_events.allergies_regimes IS 'Allergies et régimes alimentaires à prendre en compte';
COMMENT ON COLUMN booking_events.contact_sur_place_nom IS 'Nom du contact sur place le jour J';
COMMENT ON COLUMN booking_events.contact_sur_place_tel IS 'Téléphone du contact sur place';
COMMENT ON COLUMN booking_events.contact_sur_place_societe IS 'Société du contact sur place';
COMMENT ON COLUMN booking_events.instructions_speciales IS 'Instructions spéciales: "Sur place faire valider par Caroline..."';
