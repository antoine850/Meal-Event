-- Fusionner les champs de booking_events dans bookings
-- Les champs déjà présents dans bookings: space_id, event_date, start_time, end_time, guests_count

-- Ajouter les colonnes de montants et autres champs manquants
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guests_count INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS space_id UUID;

-- Ajouter les champs manquants de booking_events dans bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_date_flexible BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_restaurant_flexible BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_preferred_time TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS menu_aperitif TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS menu_entree TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS menu_plat TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS menu_dessert TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS menu_boissons TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS menu_details JSONB;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mise_en_place TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deroulement TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_privatif BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS allergies_regimes TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS prestations_souhaitees TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS budget_client NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS format_souhaite TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact_sur_place_nom TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact_sur_place_tel TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact_sur_place_societe TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS instructions_speciales TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commentaires TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS date_signature_devis DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_user_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Migrer les données du premier booking_event de chaque booking
UPDATE bookings b
SET
  is_date_flexible = COALESCE(be.is_date_flexible, FALSE),
  is_restaurant_flexible = COALESCE(be.is_restaurant_flexible, FALSE),
  client_preferred_time = be.client_preferred_time,
  menu_aperitif = be.menu_aperitif,
  menu_entree = be.menu_entree,
  menu_plat = be.menu_plat,
  menu_dessert = be.menu_dessert,
  menu_boissons = be.menu_boissons,
  mise_en_place = be.mise_en_place,
  deroulement = be.deroulement,
  is_privatif = COALESCE(be.is_privatif, FALSE),
  allergies_regimes = be.allergies_regimes,
  prestations_souhaitees = be.prestations_souhaitees,
  budget_client = be.budget_client,
  format_souhaite = be.format_souhaite,
  contact_sur_place_nom = be.contact_sur_place_nom,
  contact_sur_place_tel = be.contact_sur_place_tel,
  contact_sur_place_societe = be.contact_sur_place_societe,
  instructions_speciales = be.instructions_speciales,
  commentaires = be.commentaires,
  date_signature_devis = be.date_signature_devis::date
FROM (
  SELECT DISTINCT ON (booking_id) *
  FROM booking_events
  ORDER BY booking_id, created_at ASC
) be
WHERE b.id = be.booking_id;
