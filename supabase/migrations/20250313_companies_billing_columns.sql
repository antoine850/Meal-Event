-- Migration: Add billing columns to companies table
-- Date: 2025-03-13
-- Description: Adds billing address fields to companies for invoice generation

-- ============================================
-- COMPANIES: billing address columns
-- ============================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS billing_postal_code TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS billing_city TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS billing_country TEXT DEFAULT 'France';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS siret TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tva_number TEXT;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20250313_companies_billing_columns completed successfully!';
END $$;
