-- Migration: Add missing billing address fields to restaurants table
-- Run this in Supabase SQL Editor

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(20);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100) DEFAULT 'France';
