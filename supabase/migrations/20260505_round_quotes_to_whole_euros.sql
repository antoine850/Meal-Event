-- Réaligne les devis non encaissés sur l'arrondi à l'euro entier (Math.ceil).
--
-- Contexte : la migration 20260501 alignait tout au centime. Le métier veut
-- maintenant que chaque ligne TTC d'un devis soit un montant entier en euros
-- (toujours arrondi au supérieur), et que le total TTC du devis soit la somme
-- de ces lignes (lui-même entier après application de la remise globale).
--
-- Filtre de sécurité : on ne touche QUE les devis dont aucun acompte ni solde
-- n'a encore été encaissé (deposit_paid_at IS NULL AND balance_paid_at IS NULL).
-- Les documents fiscaux déjà émis restent intouchés.
--
-- Idempotente : peut être relancée sans effet de bord.

BEGIN;

-- 1) Arrondir chaque ligne (item) à l'euro supérieur — TTC entier, HT dérivé
UPDATE quote_items qi
SET
  total_ttc = CEIL(
    (COALESCE(qi.quantity, 0) * COALESCE(qi.unit_price, 0) - COALESCE(qi.discount_amount, 0))
    * (1 + COALESCE(qi.tva_rate, 0) / 100.0)
  ),
  total_ht = CEIL(
    (COALESCE(qi.quantity, 0) * COALESCE(qi.unit_price, 0) - COALESCE(qi.discount_amount, 0))
    * (1 + COALESCE(qi.tva_rate, 0) / 100.0)
  ) / NULLIF((1 + COALESCE(qi.tva_rate, 0) / 100.0), 0)
WHERE qi.quote_id IN (
  SELECT id FROM quotes
  WHERE deposit_paid_at IS NULL
    AND balance_paid_at IS NULL
)
  AND qi.item_type IS DISTINCT FROM 'extra';

-- 2) Recalculer les totaux du devis depuis les items mis à jour, avec remise globale
WITH item_sums AS (
  SELECT
    quote_id,
    SUM(total_ttc) AS sum_ttc,
    SUM(total_ht) AS sum_ht
  FROM quote_items
  WHERE item_type IS DISTINCT FROM 'extra'
  GROUP BY quote_id
)
UPDATE quotes q
SET
  total_ttc = CEIL(s.sum_ttc * (1 - COALESCE(q.discount_percentage, 0) / 100.0)),
  total_ht  = s.sum_ht  * (1 - COALESCE(q.discount_percentage, 0) / 100.0),
  total_tva = CEIL(s.sum_ttc * (1 - COALESCE(q.discount_percentage, 0) / 100.0))
              - (s.sum_ht * (1 - COALESCE(q.discount_percentage, 0) / 100.0))
FROM item_sums s
WHERE q.id = s.quote_id
  AND q.deposit_paid_at IS NULL
  AND q.balance_paid_at IS NULL;

COMMIT;
