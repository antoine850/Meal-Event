-- RLS sur email_logs : lecture/suppression scopées organisation (le front lit
-- la trace des envois et supprime les logs a la suppression d'un booking).
-- Le backend ecrit via service role (bypass RLS).

-- Backfill des lignes historiques sans organization_id (sinon invisibles sous RLS)
UPDATE email_logs el
SET organization_id = b.organization_id
FROM bookings b
WHERE el.organization_id IS NULL
  AND el.booking_id = b.id;

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_select_org" ON email_logs
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Le IS NULL couvre les lignes orphelines (org non backfillee, ex booking deja
-- supprime) : sans lui, la FK sans CASCADE bloquerait la suppression d'un booking
-- dont le front supprime d'abord les logs par booking_id.
CREATE POLICY "email_logs_delete_org" ON email_logs
  FOR DELETE USING (
    organization_id IS NULL
    OR organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "email_logs_service_role" ON email_logs
  FOR ALL USING (auth.role() = 'service_role');
