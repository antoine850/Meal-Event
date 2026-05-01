-- Réaligne les totaux des devis existants sur l'arrondi au centime.
--
-- Avant ce fix, recalculateQuoteTotals (frontend + backend) persistait
-- total_ttc avec Math.ceil(finalHt + finalTva), arrondissant à l'euro
-- supérieur. L'éditeur affichait la valeur exacte (ex. 3009.93 €) mais
-- la DB stockait la valeur ceilée (3010.00 €), faisant remonter ce
-- décalage dans le PDF généré côté backend, l'email Resend, et le
-- montant Stripe.
--
-- Cette migration recalcule total_ht / total_tva / total_ttc à partir
-- des quote_items (hors extras) en miroir exact de la nouvelle logique
-- TypeScript (Math.round au centime). Idempotente.

WITH item_totals AS (
  SELECT
    quote_id,
    -- Total HT par item, arrondi au centime, puis sommé
    SUM(
      ROUND(
        (COALESCE(quantity, 0) * COALESCE(unit_price, 0) - COALESCE(discount_amount, 0))::numeric,
        2
      )
    ) AS sum_ht,
    -- TVA par item = (HT arrondi) * (taux/100), chacune arrondie au centime, puis sommée
    SUM(
      ROUND(
        ROUND(
          (COALESCE(quantity, 0) * COALESCE(unit_price, 0) - COALESCE(discount_amount, 0))::numeric,
          2
        ) * (COALESCE(tva_rate, 0) / 100.0)::numeric,
        2
      )
    ) AS sum_tva
  FROM quote_items
  WHERE item_type IS DISTINCT FROM 'extra'
  GROUP BY quote_id
),
quote_final AS (
  SELECT
    q.id AS quote_id,
    ROUND(
      (COALESCE(it.sum_ht, 0) * (1 - COALESCE(q.discount_percentage, 0) / 100.0))::numeric,
      2
    ) AS final_ht,
    ROUND(
      (COALESCE(it.sum_tva, 0) * (1 - COALESCE(q.discount_percentage, 0) / 100.0))::numeric,
      2
    ) AS final_tva
  FROM quotes q
  JOIN item_totals it ON it.quote_id = q.id
)
UPDATE quotes q
SET
  total_ht  = qf.final_ht,
  total_tva = qf.final_tva,
  total_ttc = ROUND((qf.final_ht + qf.final_tva)::numeric, 2)
FROM quote_final qf
WHERE qf.quote_id = q.id
  -- ne touche que les lignes réellement décalées (idempotent + utile pour audit)
  AND (
    q.total_ht  IS DISTINCT FROM qf.final_ht
    OR q.total_tva IS DISTINCT FROM qf.final_tva
    OR q.total_ttc IS DISTINCT FROM ROUND((qf.final_ht + qf.final_tva)::numeric, 2)
  );
