-- Migration: Add billing fields to quotes table for full quote/invoice flow
-- Run this in Supabase SQL Editor

-- Title & event details
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS date_start TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS date_end TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS order_number VARCHAR(100);

-- Discount
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0;

-- Deposit (Acompte)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_percentage DECIMAL(5,2) DEFAULT 80;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_label VARCHAR(255) DEFAULT 'Acompte à signature';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_days INTEGER DEFAULT 7;

-- Balance (Solde)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS balance_label VARCHAR(255) DEFAULT 'Solde';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS balance_days INTEGER DEFAULT 0;

-- Dates & deadlines
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_due_days INTEGER DEFAULT 7;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS invoice_due_days INTEGER DEFAULT 0;

-- Comments (bilingual)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS comments_fr TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS comments_en TEXT;

-- Conditions (4 blocks, per-quote editable copy)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS conditions_devis TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS conditions_facture TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS conditions_acompte TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS conditions_solde TEXT;

-- Language & versioning
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS language VARCHAR(2) DEFAULT 'fr';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
