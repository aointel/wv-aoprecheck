/**
 * Server-backed "Getting Started" completion tracking for AO Precheck.
 *
 * Completion is stored per agent account (email) in a small self-migrating
 * Postgres table, so it is authoritative across devices/browsers and cannot be
 * bypassed by clearing localStorage. Version-aware: bumping the client's
 * GETTING_STARTED_VERSION means existing rows no longer match and the agent is
 * forced through the flow again.
 */
import { leaseDialerPool as pool } from "./db";

let _ready: Promise<void> | null = null;

export function ensureGettingStartedTable(): Promise<void> {
  if (_ready) return _ready;
  _ready = (async () => {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS getting_started_completions (
        email text PRIMARY KEY,
        version text NOT NULL DEFAULT 'v1',
        completed_at timestamptz NOT NULL DEFAULT now()
      )`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[getting-started] ensure table failed (non-fatal):", msg);
    }
  })();
  return _ready;
}

function norm(email = ""): string {
  return String(email).toLowerCase().trim();
}

export interface GettingStartedStatus {
  completed: boolean;
  version: string | null;
  completedAt: string | null;
}

export async function getGettingStartedStatus(email: string): Promise<GettingStartedStatus> {
  await ensureGettingStartedTable();
  const em = norm(email);
  if (!em) return { completed: false, version: null, completedAt: null };
  try {
    const r = await pool.query(
      `SELECT version, completed_at FROM getting_started_completions WHERE email = $1`,
      [em],
    );
    if (!r.rows.length) return { completed: false, version: null, completedAt: null };
    return {
      completed: true,
      version: r.rows[0].version ?? null,
      completedAt: r.rows[0].completed_at ? new Date(r.rows[0].completed_at).toISOString() : null,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[getting-started] status query failed:", msg);
    // Fail-safe: if we cannot read status, report not-completed so the agent is
    // asked to complete it (we never silently let someone bypass the flow).
    return { completed: false, version: null, completedAt: null };
  }
}

export async function markGettingStartedComplete(email: string, version: string): Promise<boolean> {
  await ensureGettingStartedTable();
  const em = norm(email);
  if (!em) return false;
  try {
    await pool.query(
      `INSERT INTO getting_started_completions (email, version, completed_at)
       VALUES ($1, $2, now())
       ON CONFLICT (email) DO UPDATE SET version = EXCLUDED.version, completed_at = now()`,
      [em, version || "v1"],
    );
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[getting-started] mark complete failed:", msg);
    return false;
  }
}

// ── Precheck MANAGER Getting Started (separate flag from the agent flow) ──────
let _mgrReady: Promise<void> | null = null;

function ensureManagerTable(): Promise<void> {
  if (_mgrReady) return _mgrReady;
  _mgrReady = (async () => {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS precheck_manager_getting_started_completions (
        email text PRIMARY KEY,
        version text NOT NULL DEFAULT 'mgr-v1',
        completed_at timestamptz NOT NULL DEFAULT now()
      )`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[getting-started] ensure manager table failed (non-fatal):", msg);
    }
  })();
  return _mgrReady;
}

export async function getManagerGettingStartedStatus(email: string): Promise<GettingStartedStatus> {
  await ensureManagerTable();
  const em = norm(email);
  if (!em) return { completed: false, version: null, completedAt: null };
  try {
    const r = await pool.query(
      `SELECT version, completed_at FROM precheck_manager_getting_started_completions WHERE email = $1`,
      [em],
    );
    if (!r.rows.length) return { completed: false, version: null, completedAt: null };
    return {
      completed: true,
      version: r.rows[0].version ?? null,
      completedAt: r.rows[0].completed_at ? new Date(r.rows[0].completed_at).toISOString() : null,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[getting-started] manager status query failed:", msg);
    return { completed: false, version: null, completedAt: null };
  }
}

export async function markManagerGettingStartedComplete(email: string, version: string): Promise<boolean> {
  await ensureManagerTable();
  const em = norm(email);
  if (!em) return false;
  try {
    await pool.query(
      `INSERT INTO precheck_manager_getting_started_completions (email, version, completed_at)
       VALUES ($1, $2, now())
       ON CONFLICT (email) DO UPDATE SET version = EXCLUDED.version, completed_at = now()`,
      [em, version || "mgr-v1"],
    );
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[getting-started] manager mark complete failed:", msg);
    return false;
  }
}
