-- Gmail phase 2 : integrite des fils + reply-to facturation.

-- 1. Reply-to facturation. getOrgFacturationEmail() (phase 0bis) selectionne deja
-- organizations.facturation_email, mais la colonne n'a jamais ete creee : l'erreur
-- PostgREST etait avalee -> null. IF NOT EXISTS = sur quel que soit l'etat prod.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS facturation_email TEXT;

-- 2. Suppression des fils contact-only quand le contact part. Le FK contact_id est
-- ON DELETE SET NULL : sans ce trigger, un fil (booking_id NULL, contact_id NULL)
-- violerait le CHECK ci-dessous et bloquerait la suppression du contact. Les fils
-- rattaches a un booking gardent booking_id -> SET NULL sans consequence.
CREATE OR REPLACE FUNCTION delete_contact_only_threads()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM email_threads
  WHERE contact_id = OLD.id AND booking_id IS NULL;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_delete_email_threads ON contacts;
CREATE TRIGGER contacts_delete_email_threads
  BEFORE DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION delete_contact_only_threads();

-- 3. Chaque fil vise un booking OU un contact (report de la phase 1).
-- Pre-check avant d'appliquer : SELECT count(*) FROM email_threads
-- WHERE booking_id IS NULL AND contact_id IS NULL; doit valoir 0.
ALTER TABLE email_threads DROP CONSTRAINT IF EXISTS email_threads_target_chk;
ALTER TABLE email_threads
  ADD CONSTRAINT email_threads_target_chk
  CHECK (booking_id IS NOT NULL OR contact_id IS NOT NULL);

-- 4. Un seul fil contact-only OUVERT par contact.
CREATE UNIQUE INDEX IF NOT EXISTS email_threads_contact_open_uidx
  ON email_threads (contact_id, kind)
  WHERE contact_id IS NOT NULL AND booking_id IS NULL AND status = 'open';
