-- Migration: Refactor extras to use quote_items with item_type
-- Date: 2025-03-07
-- Description: 
--   - Drops quote_extras table (if exists)
--   - Adds item_type column to quote_items to distinguish products from extras
--   - Migrates any existing quote_extras data to quote_items

-- ============================================
-- 1. MIGRATE EXISTING QUOTE_EXTRAS TO QUOTE_ITEMS
-- (if quote_extras table exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quote_extras') THEN
    -- Insert existing extras as quote_items with item_type='extra'
    INSERT INTO quote_items (
      quote_id,
      name,
      description,
      quantity,
      unit_price,
      tva_rate,
      discount_amount,
      total_ht,
      total_ttc,
      position,
      item_type,
      created_at
    )
    SELECT 
      quote_id,
      name,
      description,
      quantity,
      unit_price,
      tva_rate,
      0 as discount_amount,
      total_ht,
      total_ttc,
      999 as position, -- Put extras at the end
      'extra' as item_type,
      created_at
    FROM quote_extras;
    
    RAISE NOTICE 'Migrated % extras to quote_items', (SELECT COUNT(*) FROM quote_extras);
  END IF;
END $$;

-- ============================================
-- 2. DROP QUOTE_EXTRAS TABLE
-- ============================================
DROP TABLE IF EXISTS quote_extras CASCADE;

-- ============================================
-- 3. ADD ITEM_TYPE COLUMN TO QUOTE_ITEMS
-- ============================================
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'product';

-- Add check constraint to ensure valid values
ALTER TABLE quote_items DROP CONSTRAINT IF EXISTS quote_items_item_type_check;
ALTER TABLE quote_items ADD CONSTRAINT quote_items_item_type_check 
  CHECK (item_type IN ('product', 'extra'));

-- Create index for filtering by type
CREATE INDEX IF NOT EXISTS idx_quote_items_item_type ON quote_items(item_type);

-- ============================================
-- 4. UPDATE EXISTING ROWS
-- Set item_type='product' for all existing items (default)
-- ============================================
UPDATE quote_items SET item_type = 'product' WHERE item_type IS NULL;

-- ============================================
-- 5. PAYMENT MODALITY (if not already added)
-- ============================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_modality TEXT DEFAULT 'autre';

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Total quote_items: %', (SELECT COUNT(*) FROM quote_items);
  RAISE NOTICE 'Products: %', (SELECT COUNT(*) FROM quote_items WHERE item_type = 'product');
  RAISE NOTICE 'Extras: %', (SELECT COUNT(*) FROM quote_items WHERE item_type = 'extra');
END $$;
