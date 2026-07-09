-- Le trigger delete_contact_only_threads (20260707) tourne avec les droits de
-- l'appelant : depuis le frontend (role authenticated, aucune policy DELETE sur
-- email_threads), son DELETE ne voit aucune ligne. Le FK contact_id ON DELETE
-- SET NULL (action referentielle, exempte de RLS) produit alors un fil
-- (booking_id NULL, contact_id NULL) qui viole email_threads_target_chk et
-- bloque la suppression du contact. SECURITY DEFINER = le DELETE s'execute avec
-- les droits du proprietaire de la fonction (bypass RLS), comme prevu.
CREATE OR REPLACE FUNCTION delete_contact_only_threads()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM email_threads
  WHERE contact_id = OLD.id AND booking_id IS NULL;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
