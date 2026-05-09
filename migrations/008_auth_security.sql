-- Migration 008: Auth security tables
-- Creates invalidated_tokens and security_audit_events.
-- Run after all prior migrations (001-007) have been applied.
-- Idempotent: uses IF NOT EXISTS throughout.

-- ---------------------------------------------------------------------------
-- invalidated_tokens
-- Stores revoked JWT JTIs so the authenticate middleware can reject them.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invalidated_tokens (
  id           UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id),
  user_id      UUID,
  jti          TEXT        NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invalidated_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT invalidated_tokens_tenant_jti_unique UNIQUE (tenant_id, jti)
);

-- Index for fast revocation look-up (the hot path in authenticate middleware)
CREATE INDEX IF NOT EXISTS idx_invalidated_tokens_tenant_jti
  ON invalidated_tokens (tenant_id, jti);

-- Index to support efficient cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_invalidated_tokens_expires_at
  ON invalidated_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- security_audit_events
-- Persistent log of security-significant events: login attempts, lockouts,
-- permission denials, token revocations, cross-tenant access attempts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_audit_events (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id     UUID,
  branch_id     UUID,
  actor_user_id UUID,
  event_type    TEXT        NOT NULL,
  subject       TEXT,
  ip_address    TEXT,
  device_info   TEXT,
  payload       JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT security_audit_events_pkey PRIMARY KEY (id)
);

-- Index for tenant-scoped event queries (compliance reports, dashboards)
CREATE INDEX IF NOT EXISTS idx_security_audit_events_tenant_type_ts
  ON security_audit_events (tenant_id, event_type, created_at DESC);

-- Index for per-actor audit trails
CREATE INDEX IF NOT EXISTS idx_security_audit_events_actor_ts
  ON security_audit_events (actor_user_id, created_at DESC);

-- Index for time-range scans (log rotation, retention enforcement)
CREATE INDEX IF NOT EXISTS idx_security_audit_events_created_at
  ON security_audit_events (created_at DESC);
