-- 001_create_users.sql

-- Enable UUID generation (choose one; pgcrypto is simplest)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Role enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('coach', 'client');
  END IF;
END$$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email must be unique (this also creates a unique index)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END$$;

-- Optional: explicit index (redundant because UNIQUE already indexes,
-- but harmless; keep only if you want a named non-unique index too)
-- CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
