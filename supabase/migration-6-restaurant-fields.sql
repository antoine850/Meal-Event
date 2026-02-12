-- Migration: Add additional fields to restaurants table
-- Run this in Supabase SQL Editor

-- Additional restaurant fields based on requirements
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'France';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'fr';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'EUR';

-- Notification settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS notification_emails TEXT[]; -- Array of emails for notifications
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS recap_email VARCHAR(255); -- Email for daily recap

-- Email signature settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_signature_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_signature_text TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS counter_signature_enabled BOOLEAN DEFAULT FALSE;

-- Email tracking
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_tracking_enabled BOOLEAN DEFAULT TRUE;

-- SMS settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS sms_name VARCHAR(50);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS sms_signature TEXT;

-- Display settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS display_mode VARCHAR(50) DEFAULT 'company_firstname_lastname';

-- Client portal
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS client_portal_background_url TEXT;

-- VAT settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS vat_accommodation_enabled BOOLEAN DEFAULT FALSE;

-- Website and social links
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS instagram VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS facebook VARCHAR(255);
