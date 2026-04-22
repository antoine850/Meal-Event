-- Permet de définir un montant fixe d'acompte sur un devis,
-- en remplacement du calcul par pourcentage.
-- Si NULL → deposit_percentage est utilisé (comportement actuel).
-- Si renseigné → ce montant est utilisé à la place.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS deposit_amount_override float8 DEFAULT NULL;

COMMENT ON COLUMN quotes.deposit_amount_override IS
  'Montant fixe d''acompte (€). Si NULL, le deposit_percentage est utilisé pour le calcul.';
