-- Activity Logs for Booking History
-- Tracks all actions performed on bookings and related entities

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Action info
  action_type VARCHAR(50) NOT NULL,      -- ex: 'quote.email_sent', 'booking.status_changed'
  action_label VARCHAR(255) NOT NULL,    -- ex: 'Devis envoyé par email'
  
  -- Actor info
  actor_type VARCHAR(20) NOT NULL DEFAULT 'user',  -- 'user', 'system', 'client', 'webhook'
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(255),               -- Cached name for display
  
  -- Related entity
  entity_type VARCHAR(50),               -- 'quote', 'payment', 'document', 'menu_form', etc.
  entity_id UUID,                        -- ID of the related entity
  
  -- Detailed metadata (JSON for flexibility)
  metadata JSONB DEFAULT '{}',           -- {old_value, new_value, amount, field_changes, etc.}
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_activity_logs_booking ON activity_logs(booking_id, created_at DESC);
CREATE INDEX idx_activity_logs_org ON activity_logs(organization_id, created_at DESC);
CREATE INDEX idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- RLS Policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their organization
CREATE POLICY "Users can view activity logs for their organization"
  ON activity_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can insert logs for their organization
CREATE POLICY "Users can insert activity logs for their organization"
  ON activity_logs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Service role can do everything (for webhooks)
CREATE POLICY "Service role has full access to activity logs"
  ON activity_logs FOR ALL
  USING (auth.role() = 'service_role');

-- Function to auto-delete logs older than 1 year (can be called via cron)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM activity_logs
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (for manual cleanup if needed)
GRANT EXECUTE ON FUNCTION cleanup_old_activity_logs() TO authenticated;

COMMENT ON TABLE activity_logs IS 'Tracks all actions performed on bookings for audit/history purposes. Auto-cleanup after 1 year.';
COMMENT ON COLUMN activity_logs.action_type IS 'Dot-notation action type: entity.action (e.g., booking.created, quote.email_sent)';
COMMENT ON COLUMN activity_logs.actor_type IS 'Who performed the action: user, system, client, webhook';
COMMENT ON COLUMN activity_logs.metadata IS 'JSON with action-specific details: field changes, amounts, old/new values, etc.';
