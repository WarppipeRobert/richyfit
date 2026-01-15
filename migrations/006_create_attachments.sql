-- 004_create_attachments.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Attachment type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attachment_type') THEN
    CREATE TYPE attachment_type AS ENUM ('progress_photo', 'document');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type attachment_type NOT NULL,
  s3_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Required indexes
CREATE INDEX IF NOT EXISTS idx_attachments_client_id
  ON attachments(client_id);
