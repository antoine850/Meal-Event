-- ============================================
-- EMAIL TEMPLATES : cleanup post-migration (ÉTAPE 2)
-- ============================================
-- À APPLIQUER quelques jours après le deploy du frontend, une fois vérifié.
--
-- PRÉ-CHECKS avant application (résultat attendu : 0 ligne chacun) :
-- 1. Dérive entre colonnes legacy et nouvelles. ATTENTION au sens : une édition via la
--    NOUVELLE UI (name/subject_fr changent, label/subject inchangés) est ATTENDUE — ne
--    rien recopier. Ne réconcilier (legacy -> nouvelles colonnes) que si l'édition a été
--    faite via l'ANCIENNE UI pendant la fenêtre de deploy. En cas de doute, comparer les
--    contenus à la main avant de continuer :
--   SELECT id FROM email_templates WHERE lang = 'fr'
--     AND (label IS DISTINCT FROM name OR subject IS DISTINCT FROM subject_fr
--          OR body IS DISTINCT FROM body_fr);
--   SELECT en.id FROM email_templates en
--   JOIN email_templates fr ON fr.organization_id = en.organization_id
--     AND fr.slug = en.slug AND fr.lang = 'fr'
--   WHERE en.lang = 'en' AND (en.subject IS DISTINCT FROM fr.subject_en
--                             OR en.body IS DISTINCT FROM fr.body_en);
-- 2. Parents incomplets qui feraient échouer les SET NOT NULL :
--   SELECT id FROM email_templates
--   WHERE lang IS NULL AND (name IS NULL OR subject_fr IS NULL OR body_fr IS NULL);
-- Rollback AVANT cette étape : DROP TABLE email_template_restaurants +
-- DROP COLUMN name/subject_fr/body_fr/subject_en/body_en (données d'origine intactes).
-- Rollback APRÈS : reconstruire les lignes EN depuis subject_en/body_en.

DELETE FROM email_templates WHERE lang = 'en';

-- La contrainte UNIQUE(org, slug, lang) et son index tombent avec les colonnes.
ALTER TABLE email_templates
  DROP COLUMN lang,
  DROP COLUMN subject,
  DROP COLUMN body,
  DROP COLUMN label,
  DROP COLUMN slug;

ALTER TABLE email_templates
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN subject_fr SET NOT NULL,
  ALTER COLUMN body_fr SET NOT NULL;
