import pg from 'pg';
import { existsSync, readFileSync } from 'fs';

const { Pool } = pg;

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
      ADD COLUMN IF NOT EXISTS module_permissions jsonb NOT NULL DEFAULT '{}'::jsonb;
  `);

  await pool.query(`UPDATE app_users SET app_role = 'OWNER' WHERE role = 'admin' AND app_role = 'VIEWER';`);

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