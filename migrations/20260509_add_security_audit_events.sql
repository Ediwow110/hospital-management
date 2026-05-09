CREATE TABLE IF NOT EXISTS security_audit_events (
  id UUID PRIMARY KEY,
  event_type VARCHAR NOT NULL,
  tenant_id VARCHAR,
  user_id VARCHAR,
  ip_address VARCHAR,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_events_tenant_created
  ON security_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_events_event_type
  ON security_audit_events (event_type, created_at DESC);
