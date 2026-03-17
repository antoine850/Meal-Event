-- Add stripe_enabled column to restaurants
-- When false, payment links will only show bank transfer info (no Stripe payment button)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS stripe_enabled BOOLEAN NOT NULL DEFAULT true;
