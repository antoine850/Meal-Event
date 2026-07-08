-- Gmail phase 3 : dedup inter-boites des messages ingeres par le polling.
-- gmail_message_id est un identifiant PAR boite : le meme email recu par deux
-- boites connectees (repondre-a-tous, commercial en copie) porte deux ids
-- differents et entrerait deux fois dans le fil. Le Message-ID RFC, lui, est
-- identique partout : l'unicite par fil fait rebondir la 2e ingestion (23505,
-- deja tolere par recordInbound). Partiel : les envois Resend ont rfc NULL.
CREATE UNIQUE INDEX IF NOT EXISTS email_messages_thread_rfc_uidx
  ON email_messages (thread_id, rfc_message_id)
  WHERE rfc_message_id IS NOT NULL;
