import pg from 'pg';

import settings from './config.js';

const sslEnabled = settings.databaseSsl;

const pool = new pg.Pool({
  connectionString: settings.databaseUrl,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  idleTimeoutMillis: 30_000,
  max: Number(process.env.PG_POOL_MAX || 10),
});

export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (settings.env === 'development') {
    const duration = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log('executed query', { text, duration, rows: result.rowCount });
  }
  return result;
}

export async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS image_jobs (
      id UUID PRIMARY KEY,
      original_filename TEXT,
      status TEXT NOT NULL,
      original_path TEXT NOT NULL,
      processed_path TEXT,
      error TEXT,
      target_dimension INT NOT NULL DEFAULT ${settings.maxImageDimension},
      original_size_bytes BIGINT,
      processed_size_bytes BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`
    ALTER TABLE image_jobs
    ADD COLUMN IF NOT EXISTS target_dimension INT NOT NULL DEFAULT ${settings.maxImageDimension};
  `);
  await query(`
    ALTER TABLE image_jobs
    ADD COLUMN IF NOT EXISTS original_size_bytes BIGINT;
  `);
  await query(`
    ALTER TABLE image_jobs
    ADD COLUMN IF NOT EXISTS processed_size_bytes BIGINT;
  `);
}

export async function closePool() {
  await pool.end();
}
