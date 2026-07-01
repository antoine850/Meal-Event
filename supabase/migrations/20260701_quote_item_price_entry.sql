-- Saisie du prix par ligne en HT ou en TTC (ancrage sur la valeur saisie).
-- unit_price_ttc : prix unitaire TTC saisi quand price_entry_mode = 'ttc' (sinon derive de unit_price).
-- price_entry_mode : cote saisi qui fait foi pour la ligne. Defaut 'ht' = comportement existant, donc
-- toutes les lignes deja en base (natives + import Booking Shake) restent ancrees HT, inchangees.
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS unit_price_ttc numeric(12, 4),
  ADD COLUMN IF NOT EXISTS price_entry_mode text NOT NULL DEFAULT 'ht'
    CHECK (price_entry_mode IN ('ht', 'ttc'));
