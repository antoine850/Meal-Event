-- Fondations Gmail (phase 1) : comptes OAuth par utilisateur, fils et messages.
-- Le token vit uniquement en service role (aucune policy SELECT client dessus).
-- email_threads/email_messages sont scopes org (lecture front en phase 4).

-- 1. Comptes Gmail par utilisateur (1:1). refresh_token chiffre applicatif.
CREATE TABLE user_gmail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_email TEXT,
  refresh_token TEXT NOT NULL,
  scopes TEXT,
  history_id TEXT,
  status TEXT NOT NULL DEFAULT 'connected',
  sending_enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_gmail_accounts ENABLE ROW LEVEL SECURITY;

-- Token sensible : accessible en service role UNIQUEMENT (le front lit le
-- statut via un endpoint backend, jamais la table). Pas de policy client.
CREATE POLICY "user_gmail_accounts_service_role" ON user_gmail_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- 2. Fils de conversation (un par booking, un par contact hors booking, ou facturation).
-- Le CHECK "booking_id ou contact_id non nul" du spec est REPORTE en phase 2 :
-- couple a contact_id ON DELETE SET NULL, il bloquerait la suppression d'un
-- contact possedant un fil contact-only (SET NULL -> les deux nuls -> CHECK
-- viole -> delete du contact echoue). La phase 1 ne cree aucun fil, donc le
-- CHECK ne protege rien ici ; il sera ajoute en phase 2 avec la politique de
-- suppression des fils contact-only.
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'booking',
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un seul fil par (booking, kind).
CREATE UNIQUE INDEX email_threads_booking_kind_uidx
  ON email_threads (booking_id, kind) WHERE booking_id IS NOT NULL;
CREATE INDEX email_threads_contact_idx ON email_threads (contact_id);
CREATE INDEX email_threads_org_idx ON email_threads (organization_id);

ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_threads_select_org" ON email_threads
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY "email_threads_service_role" ON email_threads
  FOR ALL USING (auth.role() = 'service_role');

-- 3. Messages d'un fil (sortants Gmail/Resend, entrants Gmail).
-- rfc_message_id = header Message-ID RFC 2822 (sert au threading In-Reply-To/References).
-- references_header : le mot "references" est reserve en SQL, on le renomme.
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  gmail_thread_id TEXT,
  gmail_message_id TEXT,
  rfc_message_id TEXT,
  from_email TEXT,
  to_emails TEXT[],
  cc TEXT[],
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  snippet TEXT,
  sent_at TIMESTAMPTZ,
  in_reply_to TEXT,
  references_header TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedup du polling : un gmail_message_id ne peut apparaitre qu'une fois.
CREATE UNIQUE INDEX email_messages_gmail_msg_uidx
  ON email_messages (gmail_message_id) WHERE gmail_message_id IS NOT NULL;
CREATE INDEX email_messages_thread_idx ON email_messages (thread_id);

ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_messages_select_org" ON email_messages
  FOR SELECT USING (
    thread_id IN (
      SELECT id FROM email_threads
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );
CREATE POLICY "email_messages_service_role" ON email_messages
  FOR ALL USING (auth.role() = 'service_role');

-- 4. Extensions additives de email_logs (retrocompatibles, valeurs par defaut).
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'resend';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
