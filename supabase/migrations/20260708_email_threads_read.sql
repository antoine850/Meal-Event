-- Gmail phase 4b : etat de lecture partage equipe des fils.
-- last_inbound_at : bumpe par recordInbound (inbound seulement). last_message_at
-- ne peut pas servir de signal "non lu" car il bouge aussi sur nos envois.
-- last_read_at : mis a now quand un membre ouvre l'onglet Emails du fil.
-- Non lu = last_inbound_at > coalesce(last_read_at, -infini).
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- Backfill : dernier message entrant par fil.
UPDATE email_threads t
SET last_inbound_at = sub.max_in
FROM (
  SELECT thread_id, MAX(sent_at) AS max_in
  FROM email_messages
  WHERE direction = 'inbound'
  GROUP BY thread_id
) sub
WHERE sub.thread_id = t.id AND t.last_inbound_at IS NULL;
