-- Ajouter les colonnes manquantes à la table spaces
ALTER TABLE spaces 
ADD COLUMN IF NOT EXISTS ordre INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS nom_public TEXT,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
