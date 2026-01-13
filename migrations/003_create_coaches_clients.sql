-- 003_create_coaches_clients.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Status enum for coach_clients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coach_client_status') THEN
    CREATE TYPE coach_client_status AS ENUM ('active', 'archived');
  END IF;
END$$;

-- coaches: 1:1 with users (only coaches should get a row here at app level)
CREATE TABLE IF NOT EXISTS coaches (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- clients: can be invited before having a user account (user_id nullable)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional: ensure a user can only be linked to one client row
-- (safe because user_id is nullable; multiple NULLs allowed)
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_user_id
  ON clients(user_id)
  WHERE user_id IS NOT NULL;

-- join table: coach <-> client
CREATE TABLE IF NOT EXISTS coach_clients (
  coach_user_id UUID NOT NULL REFERENCES coaches(user_id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status coach_client_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_user_id, client_id)
);

-- Required indexes
CREATE INDEX IF NOT EXISTS idx_coach_clients_coach_user_id
  ON coach_clients(coach_user_id);

CREATE INDEX IF NOT EXISTS idx_coach_clients_client_id
  ON coach_clients(client_id);
