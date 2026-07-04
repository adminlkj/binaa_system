import pg from 'pg';

const { Pool } = pg;

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.DATABASE_INTERNAL_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_INTERNAL_URL ||
  process.env.DATABASE_CONNECTION_STRING;

if (!databaseUrl) {
  throw new Error('PostgreSQL connection is missing. In Render, add a PostgreSQL database, then add an environment variable named DATABASE_URL with the database Internal Connection String. If you deployed manually, render.yaml envVars are not applied automatically.');
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