/**
 * Database migration runner.
 * Runs on server startup if DATABASE_URL is set.
 *
 * On Railway: add DATABASE_URL to environment variables.
 * Get it from: Supabase Dashboard → Settings → Database → Connection String (URI)
 */

const DATABASE_URL = process.env.DATABASE_URL;

const MIGRATIONS = [
  {
    name: 'create_agent_ghost_status',
    sql: `
      CREATE TABLE IF NOT EXISTS agent_ghost_status (
        email          text PRIMARY KEY,
        ghost_since    timestamptz NOT NULL DEFAULT now(),
        sms_sent       boolean     NOT NULL DEFAULT false,
        recovered      boolean     NOT NULL DEFAULT false,
        recovered_at   timestamptz,
        updated_at     timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ghost_status_recovered ON agent_ghost_status (recovered);
      CREATE OR REPLACE FUNCTION update_ghost_status_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS ghost_status_updated_at ON agent_ghost_status;
      CREATE TRIGGER ghost_status_updated_at
        BEFORE UPDATE ON agent_ghost_status
        FOR EACH ROW EXECUTE FUNCTION update_ghost_status_timestamp();
    `,
  },
];

export async function runMigrations(): Promise<void> {
  if (!DATABASE_URL) {
    console.log('[migrate] DATABASE_URL not set — skipping migrations (ghost table may not exist)');
    return;
  }

  let pg: any;
  try {
    pg = await import('pg');
  } catch {
    console.warn('[migrate] pg package not installed — skipping migrations');
    return;
  }

  const client = new pg.default.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('[migrate] Connected — running migrations...');

    for (const m of MIGRATIONS) {
      try {
        await client.query(m.sql);
        console.log(`[migrate] ✅ ${m.name}`);
      } catch (err: any) {
        console.error(`[migrate] ❌ ${m.name}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error('[migrate] Failed to connect:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}
