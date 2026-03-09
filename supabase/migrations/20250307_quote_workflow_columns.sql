-- Migration: Add workflow tracking columns to quotes
-- Date: 2025-03-07
-- Description: 
--   - Adds boolean columns to track workflow progress
--   - quote_sent_at, quote_signed_at, deposit_paid_at, balance_sent_at, balance_paid_at

-- ============================================
-- 1. ADD WORKFLOW TRACKING COLUMNS
-- ============================================

-- Quote sent tracking
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Quote signed tracking  
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_signed_at TIMESTAMPTZ DEFAULT NULL;

-- Deposit paid tracking
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ DEFAULT NULL;

-- Balance invoice sent tracking
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS balance_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Balance paid tracking (fully paid)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS balance_paid_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================
-- 2. ADD INDEXES FOR FILTERING
-- ============================================
CREATE INDEX IF NOT EXISTS idx_quotes_quote_sent_at ON quotes(quote_sent_at) WHERE quote_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_deposit_paid_at ON quotes(deposit_paid_at) WHERE deposit_paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_balance_paid_at ON quotes(balance_paid_at) WHERE balance_paid_at IS NOT NULL;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Added columns: quote_sent_at, quote_signed_at, deposit_paid_at, balance_sent_at, balance_paid_at';
END $$;
