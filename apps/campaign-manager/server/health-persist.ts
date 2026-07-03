/**
 * Persist agent health reports to Postgres so they survive Railway restarts.
 * Falls back silently if DATABASE_URL is not set or pg is unavailable.
 */

import type { AgentHealthReport } from '../shared/types.js';

const DATABASE_URL = process.env.DATABASE_URL;
const HEALTH_TTL_HOURS = 2; // only reload reports newer than this on startup

let pgClient: any = null;

async function getClient() {
  if (pgClient) return pgClient;
  if (!DATABASE_URL) return null;
  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    pgClient = client;
    client.on('error', () => { pgClient = null; }); // reconnect next call
    return client;
  } catch {
    return null;
  }
}

export async function ensureHealthTable(): Promise<void> {
  const client = await getClient();
  if (!client) return;
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_health_cache (
        email       text PRIMARY KEY,
        report      jsonb NOT NULL,
        updated_at  timestamptz NOT NULL DEFAULT now()
      );
    `);
    console.log('[health-persist] ✅ agent_health_cache table ready');
  } catch (err: any) {
    console.warn('[health-persist] Could not create table:', err.message);
  }
}

export async function persistHealth(report: AgentHealthReport): Promise<void> {
  const client = await getClient();
  if (!client) return;
  try {
    await client.query(
      `INSERT INTO agent_health_cache (email, report, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (email) DO UPDATE SET report = $2, updated_at = now()`,
      [report.email.toLowerCase(), JSON.stringify(report)]
    );
  } catch (err: any) {
    console.warn('[health-persist] write failed:', err.message);
    pgClient = null; // force reconnect next time
  }
}

export async function loadPersistedHealth(): Promise<AgentHealthReport[]> {
  const client = await getClient();
  if (!client) return [];
  try {
    const cutoff = new Date(Date.now() - HEALTH_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const { rows } = await client.query(
      `SELECT report FROM agent_health_cache WHERE updated_at > $1`,
      [cutoff]
    );
    const reports: AgentHealthReport[] = rows.map((r: any) => r.report);
    console.log(`[health-persist] Loaded ${reports.length} health reports from DB`);
    return reports;
  } catch (err: any) {
    console.warn('[health-persist] load failed:', err.message);
    return [];
  }
}
