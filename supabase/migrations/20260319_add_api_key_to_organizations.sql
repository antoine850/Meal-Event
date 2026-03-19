ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS api_key_hash TEXT,
  ADD COLUMN IF NOT EXISTS api_key_prefix TEXT,
  ADD COLUMN IF NOT EXISTS api_key_last_used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_organizations_api_key_hash ON organizations(api_key_hash) WHERE api_key_hash IS NOT NULL;
