-- ============================================
-- EMAIL TEMPLATES : une ligne par modèle + affectation restaurants
-- ============================================
-- ÉTAPE 1 (additive) : l'ancien frontend reste 100 % fonctionnel pendant le deploy.
-- L'étape 2 (20260713_email_templates_cleanup.sql) s'applique quelques jours après,
-- une fois le deploy vérifié.
--
-- PRÉ-CHECK avant application (résultat attendu : 0 ligne) :
--   SELECT organization_id, slug FROM email_templates
--   GROUP BY 1, 2 HAVING COUNT(*) FILTER (WHERE lang = 'fr') = 0;

-- Jonction template <-> restaurants (pattern product_restaurants).
-- Vide = modèle visible pour tous les restaurants.
CREATE TABLE IF NOT EXISTS email_template_restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_email_template_restaurants_template
  ON email_template_restaurants(template_id);

ALTER TABLE email_template_restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email template restaurants" ON email_template_restaurants
  FOR SELECT USING (template_id IN (SELECT id FROM email_templates WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can insert email template restaurants" ON email_template_restaurants
  FOR INSERT WITH CHECK (template_id IN (SELECT id FROM email_templates WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can delete email template restaurants" ON email_template_restaurants
  FOR DELETE USING (template_id IN (SELECT id FROM email_templates WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())));

-- Les langues deviennent des colonnes ; la ligne FR existante devient le parent
-- (elle garde son id, les jonctions futures pointeront dessus).
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS subject_fr TEXT,
  ADD COLUMN IF NOT EXISTS body_fr TEXT,
  ADD COLUMN IF NOT EXISTS subject_en TEXT,
  ADD COLUMN IF NOT EXISTS body_en TEXT;

UPDATE email_templates SET name = label, subject_fr = subject, body_fr = body
WHERE lang = 'fr' AND subject_fr IS NULL;

-- Left-join implicite : un slug sans version EN garde des colonnes _en NULL.
UPDATE email_templates fr SET subject_en = en.subject, body_en = en.body
FROM email_templates en
WHERE fr.lang = 'fr' AND en.lang = 'en'
  AND en.organization_id = fr.organization_id AND en.slug = fr.slug
  AND fr.subject_en IS NULL;

-- Le nouveau frontend insère des parents sans les colonnes historiques.
-- (UNIQUE(org, slug, lang) tolère les NULL multiples en Postgres.)
ALTER TABLE email_templates
  ALTER COLUMN slug DROP NOT NULL,
  ALTER COLUMN lang DROP NOT NULL,
  ALTER COLUMN label DROP NOT NULL,
  ALTER COLUMN subject DROP NOT NULL,
  ALTER COLUMN body DROP NOT NULL;
