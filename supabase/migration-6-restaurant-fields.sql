-- Migration: Add additional fields to restaurants table
-- Run this in Supabase SQL Editor

-- Regional settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'France';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'fr';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS translation_language VARCHAR(10); -- Langue de traduction (peut être null = désactivé)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'EUR';

-- Notification settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS notification_emails TEXT[]; -- Array of emails for event notifications
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS recap_emails TEXT[]; -- Array of emails for daily recap
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS cc_export_emails TEXT[]; -- Array of CC emails for exports
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS event_reminder_enabled BOOLEAN DEFAULT FALSE; -- Rappel évènement

-- Email signature settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_signature_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_signature_text TEXT;

-- Email tracking
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_tracking_enabled BOOLEAN DEFAULT TRUE;

-- SMS settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS sms_name VARCHAR(50);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS sms_signature TEXT; -- Signature SMS FR
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS sms_signature_en TEXT; -- Signature SMS EN


-- Client portal
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS client_portal_background_url TEXT; -- Fond espace client

-- VAT settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS vat_accommodation_enabled BOOLEAN DEFAULT FALSE; -- TVA Hébergement

-- Website and social links
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS instagram VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS facebook VARCHAR(255);

-- Opening hours as JSON column
-- Format: [{"day": 0, "opening": "08:30", "closing": "02:00", "is_open": true}, ...]
-- day: 0=lundi, 1=mardi, ..., 6=dimanche
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '[
  {"day": 0, "opening": "08:30", "closing": "23:00", "is_open": true},
  {"day": 1, "opening": "08:30", "closing": "23:00", "is_open": true},
  {"day": 2, "opening": "08:30", "closing": "23:00", "is_open": true},
  {"day": 3, "opening": "08:30", "closing": "23:00", "is_open": true},
  {"day": 4, "opening": "08:30", "closing": "23:00", "is_open": true},
  {"day": 5, "opening": "08:30", "closing": "23:00", "is_open": true},
  {"day": 6, "opening": "08:30", "closing": "23:00", "is_open": true}
]'::jsonb;
