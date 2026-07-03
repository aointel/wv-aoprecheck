import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { DATABASE_URL } from './hardcoded-config';
import { perfStore } from './perf-observability';

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Pool sizing note: Neon's built-in PgBouncer pooler is used (DATABASE_URL uses the -pooler
// hostname). All pools below share the same pooler which multiplexes onto a small set of
// real Postgres connections. Keep total max across all pools ≤ 80 to avoid overwhelming
// the pooler's server-side connection limit (~100).

// Main pool — general-purpose queries (leads, agents, sessions)
export const pool = new Pool({ 
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
  query_timeout: 15000,
  statement_timeout: 15000,
  keepAlive: true,
  maxUses: 7500,
  allowExitOnIdle: false,
});

// Dedicated write pool for critical lead disposition updates.
// Keeps disposition writes isolated from heavy read/query traffic on the main pool.
export const dispositionWritePool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  query_timeout: 120000,
  statement_timeout: 120000,
  keepAlive: true,
  maxUses: 7500,
  allowExitOnIdle: false,
});

// Dedicated pool for live leasedialer sync and queue refill.
// Keeps agent lead delivery from waiting behind call-log/stats traffic on the main pool.
export const leaseDialerPool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
  query_timeout: 15000,
  statement_timeout: 15000,
  keepAlive: true,
  maxUses: 5000,
  allowExitOnIdle: false,
});

// Low-concurrency worker pool for leasedialer background maintenance.
// It must not compete with live sync for all available connections.
export const leaseDialerWorkerPool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  query_timeout: 30000,
  statement_timeout: 30000,
  keepAlive: true,
  maxUses: 5000,
  allowExitOnIdle: false,
});

// Dedicated lane for non-lead/background reads so lead-pack/sync traffic
// does not compete for the same pool connections.
export const nonLeadPool = new Pool({
  connectionString: DATABASE_URL,
  max: Math.max(2, Number(process.env.NON_LEAD_POOL_MAX || 8)),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
  query_timeout: 30000,
  statement_timeout: 30000,
  keepAlive: true,
  maxUses: 5000,
  allowExitOnIdle: false,
});

const LOW_PRIORITY_DB_CONCURRENCY = Math.max(1, Number(process.env.LOW_PRIORITY_DB_CONCURRENCY || 8));
const LOW_PRIORITY_DB_MAX_QUEUE = Math.max(LOW_PRIORITY_DB_CONCURRENCY, Number(process.env.LOW_PRIORITY_DB_MAX_QUEUE || 2000));
const LOW_PRIORITY_DB_WARN_MS = Math.max(1000, Number(process.env.LOW_PRIORITY_DB_WARN_MS || 10_000));

let lowPriorityDbActive = 0;
let lowPriorityDbLastWarnAt = 0;
const lowPriorityDbQueue: Array<() => void> = [];

function getQueryText(args: any[]): string {
  const first = args[0];
  if (typeof first === "string") return first;
  if (first && typeof first.text === "string") return first.text;
  return "";
}

function isLowPriorityDbQuery(queryText: string): boolean {
  const normalized = queryText.toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("leasedialer") || normalized.includes("agent_routing_profiles")) return false;
  return (
    normalized.includes("twilio_call_logs") ||
    normalized.includes("agent_dial_metrics") ||
    normalized.includes("agent_daily_stats") ||
    normalized.includes("webhook_sent_at") ||
    normalized.includes("with plus_ml as")
  );
}

async function runLowPriorityDbQuery<T>(operation: () => Promise<T>): Promise<T> {
  const queuedAt = Date.now();
  if (lowPriorityDbActive >= LOW_PRIORITY_DB_CONCURRENCY) {
    if (lowPriorityDbQueue.length >= LOW_PRIORITY_DB_MAX_QUEUE) {
      throw new Error(`Low priority DB queue is full (${LOW_PRIORITY_DB_MAX_QUEUE})`);
    }
    await new Promise<void>((resolve) => {
      lowPriorityDbQueue.push(resolve);
    });
  }

  lowPriorityDbActive += 1;
  const waitedMs = Date.now() - queuedAt;
  if (waitedMs > LOW_PRIORITY_DB_WARN_MS && Date.now() - lowPriorityDbLastWarnAt > LOW_PRIORITY_DB_WARN_MS) {
    lowPriorityDbLastWarnAt = Date.now();
    console.error("[DB_LOW_PRIORITY] query waited for slot", {
      waitedMs,
      active: lowPriorityDbActive,
      queued: lowPriorityDbQueue.length,
      concurrency: LOW_PRIORITY_DB_CONCURRENCY,
    });
  }

  try {
    return await operation();
  } finally {
    lowPriorityDbActive = Math.max(0, lowPriorityDbActive - 1);
    const next = lowPriorityDbQueue.shift();
    if (next) setImmediate(next);
  }
}

const originalPoolQuery = pool.query.bind(pool);
const nonLeadPoolQuery = nonLeadPool.query.bind(nonLeadPool);
(pool as any).query = async (...args: any[]) => {
  const start = Date.now();
  try {
    const queryText = getQueryText(args);
    const result = isLowPriorityDbQuery(queryText)
      ? await runLowPriorityDbQuery(() => nonLeadPoolQuery(...args))
      : await originalPoolQuery(...args);
    perfStore.recordDependency('postgres', 'pool.query', Date.now() - start, true);
    return result;
  } catch (error) {
    perfStore.recordDependency('postgres', 'pool.query', Date.now() - start, false);
    throw error;
  }
};

export const db = drizzle({ client: pool, schema });

// Graceful database connection handling
let dbConnected = false;
pool.on('connect', () => {
  console.log('🔗 Database pool connected');
  dbConnected = true;
});

pool.on('error', (err) => {
  console.warn('⚠️ Database connection failed - running without database');
  console.warn('Database error:', err.message);
  dbConnected = false;
});

// Export a safe database wrapper
export const safeDb = {
  query: async (sql: string, params?: any[]) => {
    if (!dbConnected) {
      console.warn('⚠️ Database not connected - skipping query');
      return { rows: [] };
    }
    return pool.query(sql, params);
  }
};

pool.on('remove', () => {
  console.log('🔌 Database connection removed from pool');
});

nonLeadPool.on('connect', () => {
  console.log('🔗 Non-lead DB pool connected');
});

nonLeadPool.on('error', (err) => {
  console.warn('⚠️ Non-lead DB connection failed');
  console.warn('Non-lead DB error:', err.message);
});

nonLeadPool.on('remove', () => {
  console.log('🔌 Non-lead DB connection removed from pool');
});