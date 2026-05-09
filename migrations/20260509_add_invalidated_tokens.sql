CREATE TABLE IF NOT EXISTS invalidated_tokens (
  jti VARCHAR PRIMARY KEY,
  invalidated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  tenant_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invalidated_tokens_tenant_user
  ON invalidated_tokens (tenant_id, user_id);
