-- Migration: Add item_type to quote_items and payment_modality to payments
-- Date: 2025-03-06
-- Description: 
--   - Adds item_type column to quote_items to distinguish products from extras
--   - Adds payment_modality to payments table for tracking payment type

-- ============================================
-- 1. ADD ITEM_TYPE TO QUOTE_ITEMS
-- Allows distinguishing between regular products and extras
-- Values: 'product' (default), 'extra'
-- ============================================
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'product';

-- Add check constraint to ensure valid values
ALTER TABLE quote_items DROP CONSTRAINT IF EXISTS quote_items_item_type_check;
ALTER TABLE quote_items ADD CONSTRAINT quote_items_item_type_check 
  CHECK (item_type IN ('product', 'extra'));

-- Create index for filtering by type
CREATE INDEX IF NOT EXISTS idx_quote_items_item_type ON quote_items(item_type);

-- ============================================
-- 2. PAYMENT MODALITY
-- Add payment_modality column to track payment purpose
-- Values: 'acompte', 'solde', 'caution', 'extra', 'autre'
-- ============================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_modality TEXT DEFAULT 'autre';
