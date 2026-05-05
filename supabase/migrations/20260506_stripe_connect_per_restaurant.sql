-- ═══════════════════════════════════════════════════════════════
-- Stripe Connect Standard — per-restaurant connected accounts
-- ═══════════════════════════════════════════════════════════════

-- 1. Restaurants : ID du compte Stripe connecté + métadonnées
ALTER TABLE restaurants
  ADD COLUMN stripe_account_id VARCHAR(255),
  ADD COLUMN stripe_account_name VARCHAR(255),
  ADD COLUMN stripe_account_email VARCHAR(255),
  ADD COLUMN stripe_connected_at TIMESTAMPTZ,
  ADD COLUMN stripe_connected_by UUID REFERENCES users(id),
  ADD COLUMN stripe_charges_enabled BOOLEAN DEFAULT false,
  ADD COLUMN stripe_payouts_enabled BOOLEAN DEFAULT false,
  ADD COLUMN stripe_disabled_reason VARCHAR(255);

CREATE UNIQUE INDEX idx_restaurants_stripe_account_unique
  ON restaurants(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- 2. Payments : audit + scoping webhook
ALTER TABLE payments
  ADD COLUMN stripe_account_id VARCHAR(255);

CREATE INDEX idx_payments_stripe_account_id
  ON payments(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- 3. Payment_links : idem
ALTER TABLE payment_links
  ADD COLUMN stripe_account_id VARCHAR(255);

CREATE INDEX idx_payment_links_stripe_account_id
  ON payment_links(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- 4. OAuth states : protection CSRF sur callback
CREATE TABLE stripe_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token VARCHAR(255) UNIQUE NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '15 minutes'),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX idx_stripe_oauth_states_token ON stripe_oauth_states(state_token);
CREATE INDEX idx_stripe_oauth_states_expires ON stripe_oauth_states(expires_at);

-- 5. Marquer les colonnes inutilisées comme dépréciées (DROP en Phase 6)
COMMENT ON COLUMN settings.stripe_account_id IS 'DEPRECATED: use restaurants.stripe_account_id instead';
COMMENT ON COLUMN settings.stripe_public_key IS 'DEPRECATED: not used';
COMMENT ON COLUMN settings.stripe_secret_key IS 'DEPRECATED: not used';
