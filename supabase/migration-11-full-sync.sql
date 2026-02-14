-- Full Synchronization Script for restaurants table
-- This script ensures the database schema matches the current frontend fields
-- Run this in the Supabase SQL Editor

-- 1. ADD MISSING COLUMNS (Address and others)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(20);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100) DEFAULT 'France';

-- 2. REMOVE UNUSED COLUMNS
-- These columns are no longer used in the frontend code or the new simplified Restaurant type
ALTER TABLE restaurants DROP COLUMN IF EXISTS description;
ALTER TABLE restaurants DROP COLUMN IF EXISTS capacity;
ALTER TABLE restaurants DROP COLUMN IF EXISTS cover_url;
ALTER TABLE restaurants DROP COLUMN IF EXISTS vat_accommodation_enabled;
ALTER TABLE restaurants DROP COLUMN IF EXISTS invoice_chrono_format;
ALTER TABLE restaurants DROP COLUMN IF EXISTS quote_comments_fr;
ALTER TABLE restaurants DROP COLUMN IF EXISTS quote_comments_en;
ALTER TABLE restaurants DROP COLUMN IF EXISTS opening_hours;
ALTER TABLE restaurants DROP COLUMN IF EXISTS show_event_id;
ALTER TABLE restaurants DROP COLUMN IF EXISTS hide_establishment_header;
ALTER TABLE restaurants DROP COLUMN IF EXISTS chronological_products;
ALTER TABLE restaurants DROP COLUMN IF EXISTS hide_package_products;
ALTER TABLE restaurants DROP COLUMN IF EXISTS accommodation_period;
ALTER TABLE restaurants DROP COLUMN IF EXISTS quote_columns;
ALTER TABLE restaurants DROP COLUMN IF EXISTS deposit_invoice_columns;
ALTER TABLE restaurants DROP COLUMN IF EXISTS vat_rates;
ALTER TABLE restaurants DROP COLUMN IF EXISTS accounting_categories;
ALTER TABLE restaurants DROP COLUMN IF EXISTS default_deposits;

-- 3. ENSURE EXISTING COLUMNS HAVE CORRECT TYPES (Optional but recommended for consistency)
-- Most of these were added in previous migrations, but we ensure they exist and have correct defaults
ALTER TABLE restaurants ALTER COLUMN language SET DEFAULT 'fr';
ALTER TABLE restaurants ALTER COLUMN currency SET DEFAULT 'EUR';
ALTER TABLE restaurants ALTER COLUMN event_reminder_enabled SET DEFAULT FALSE;
ALTER TABLE restaurants ALTER COLUMN email_signature_enabled SET DEFAULT TRUE;
ALTER TABLE restaurants ALTER COLUMN email_tracking_enabled SET DEFAULT TRUE;
ALTER TABLE restaurants ALTER COLUMN quote_validity_days SET DEFAULT 7;
