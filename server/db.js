import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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