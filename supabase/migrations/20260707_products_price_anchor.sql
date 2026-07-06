-- Le catalogue stocke le prix tel que saisi : unit_price_ttc devient une vraie colonne
-- (valeurs actuelles conservées) et price_entry_mode designe l'ancre (ttc par defaut,
-- tous les produits existants ont ete saisis en TTC).
ALTER TABLE products ALTER COLUMN unit_price_ttc DROP EXPRESSION;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_entry_mode text NOT NULL DEFAULT 'ttc'
    CHECK (price_entry_mode IN ('ht', 'ttc'));
