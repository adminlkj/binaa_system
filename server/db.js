import pg from 'pg';
import crypto from 'crypto';
import { existsSync, readFileSync } from 'fs';

const { Pool } = pg;
const SYSTEM_OWNER_EMAIL = 'fysl71443@gmail.com';
const SYSTEM_OWNER_PASSWORD = 'faisal.11223344';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function readSecretFile(path) {
  if (!path || !existsSync(path)) return '';
  return readFileSync(path, 'utf8').trim();
}

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.DATABASE_INTERNAL_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_INTERNAL_URL ||
  process.env.DATABASE_CONNECTION_STRING ||
  readSecretFile(process.env.DATABASE_URL_FILE) ||
  readSecretFile('/etc/secrets/DATABASE_URL') ||
  readSecretFile('/etc/secrets/database_url');

if (!databaseUrl) {
  throw new Error('PostgreSQL connection is missing. Add DATABASE_URL as an Environment Variable on the Render Web Service, or add a Secret File mounted at /etc/secrets/DATABASE_URL containing the connection string.');
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('.render.com') ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id uuid PRIMARY KEY,
      email text UNIQUE NOT NULL,
      full_name text,
      role text NOT NULL DEFAULT 'user',
      password_hash text NOT NULL,
      reset_token_hash text,
      reset_expires_at timestamptz,
      created_date timestamptz NOT NULL DEFAULT now(),
      updated_date timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    ALTER TABLE app_users
      ADD COLUMN IF NOT EXISTS app_role text NOT NULL DEFAULT 'VIEWER',
      ADD COLUMN IF NOT EXISTS job_title text,
      ADD COLUMN IF NOT EXISTS department text,
      ADD COLUMN IF NOT EXISTS phone text,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS allowed_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS module_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS registration_requests (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      full_name text,
      password_hash text NOT NULL,
      status text NOT NULL DEFAULT 'PENDING',
      app_role text,
      allowed_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
      module_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
      reviewed_by_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
      requested_date timestamptz NOT NULL DEFAULT now(),
      reviewed_date timestamptz
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_requests_pending_email ON registration_requests (email) WHERE status = 'PENDING';`);

  await pool.query(`UPDATE app_users SET app_role = 'OWNER' WHERE role = 'admin' AND app_role = 'VIEWER';`);

  const ownerPasswordHash = hashPassword(SYSTEM_OWNER_PASSWORD);
  const ownerId = crypto.randomUUID();
  await pool.query(`
    INSERT INTO app_users (id, email, full_name, role, app_role, password_hash, is_active, allowed_modules, module_permissions, token_version)
    VALUES ($4, $1, $2, 'admin', 'OWNER', $3, true, '[]'::jsonb, '{}'::jsonb, 0)
    ON CONFLICT (email) DO UPDATE SET
      role = 'admin',
      app_role = 'OWNER',
      password_hash = EXCLUDED.password_hash,
      is_active = true,
      allowed_modules = '[]'::jsonb,
      module_permissions = '{}'::jsonb,
      token_version = app_users.token_version + 1,
      updated_date = now();
  `, [SYSTEM_OWNER_EMAIL, 'فيصل عبدالرحمن', ownerPasswordHash, ownerId]);

  // The first registered account is the system owner. Keep it protected from accidental
  // downgrade through invitations or permission edits, so the system is never left
  // without the original administrator.
  await pool.query(`
    UPDATE app_users
    SET role = 'admin', app_role = 'OWNER', is_active = true, updated_date = now()
    WHERE id = (SELECT id FROM app_users ORDER BY created_date ASC LIMIT 1)
      AND (role <> 'admin' OR app_role <> 'OWNER' OR is_active = false);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS entity_records (
      entity_name text NOT NULL,
      id uuid NOT NULL,
      created_by_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
      created_date timestamptz NOT NULL DEFAULT now(),
      updated_date timestamptz NOT NULL DEFAULT now(),
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (entity_name, id)
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_entity_records_name ON entity_records(entity_name);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_entity_records_data ON entity_records USING GIN (data);`);
}