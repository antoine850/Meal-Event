-- Migration: Add integration columns for Stripe, SignNow, Resend
-- Date: 2025-03-09
-- Description:
--   - Adds SignNow tracking columns to quotes
--   - Adds Stripe session tracking columns to quotes
--   - Adds deposit_sent_at timestamp to quotes
--   - Adds signed_pdf_url for storing signed document
--   - Adds restaurant branding/legal columns
--   - Creates email_logs table for audit trail

-- ============================================
-- 1. QUOTES: SignNow columns
-- ============================================
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signnow_document_id TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signnow_invite_id TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT;

-- ============================================
-- 2. QUOTES: Stripe session tracking
-- ============================================
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS stripe_deposit_session_id TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS stripe_deposit_url TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS stripe_balance_session_id TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS stripe_balance_url TEXT;

-- ============================================
-- 3. QUOTES: deposit_sent_at timestamp
-- ============================================
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_sent_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_deposit_sent_at ON quotes(deposit_sent_at) WHERE deposit_sent_at IS NOT NULL;

-- ============================================
-- 4. RESTAURANTS: branding / legal columns
-- ============================================
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'DEV';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS legal_form TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS share_capital TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS rcs TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS siren TEXT;

-- ============================================
-- 5. EMAIL_LOGS: audit trail for sent emails
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  quote_id UUID REFERENCES quotes(id),
  booking_id UUID REFERENCES bookings(id),
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  reply_to_email TEXT,
  subject TEXT,
  resend_message_id TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_quote_id ON email_logs(quote_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_booking_id ON email_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20250309_integration_columns completed successfully!';
END $$;
