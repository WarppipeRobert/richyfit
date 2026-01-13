-- 002_create_refresh_tokens.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookups by user
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON refresh_tokens(user_id);

-- Optional: prevent duplicate hashes (helps avoid accidental double-insert)
CREATE UNIQUE INDEX IF NOT EXISTS uq_refresh_tokens_token_hash
  ON refresh_tokens(token_hash);

-- Optional: common query helper indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
  ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked_at
  ON refresh_tokens(revoked_at);
