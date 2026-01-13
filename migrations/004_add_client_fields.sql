-- 004_add_client_fields.sql

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Optional: speed up search/invite checks later
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- Optional: enforce unique email among clients when email is present
-- (remove if you want duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_email
  ON clients(email)
  WHERE email IS NOT NULL;
