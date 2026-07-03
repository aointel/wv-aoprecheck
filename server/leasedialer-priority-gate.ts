import { leaseDialerPool } from "./db";

const ACTIVE_WINDOW_MS = Number(process.env.LEAD_PRIORITY_ACTIVE_WINDOW_MS || 15 * 60 * 1000);
const LOW_BUFFER_THRESHOLD = Number(process.env.LEAD_PRIORITY_LOW_BUFFER_THRESHOLD || process.env.LEASEDIALER_AGENT_REFILL_THRESHOLD || 50);
const CACHE_MS = Number(process.env.LEAD_PRIORITY_CACHE_MS || 15_000);

type LeadPressureSnapshot = {
  checkedAt: string;
  pressure: boolean;
  forcePressure: boolean;
  activeAgents: number;
  lowClientBuffers: number;
  emptyClientBuffers: number;
  threshold: number;
};

let cached: { expiresAt: number; snapshot: LeadPressureSnapshot } | null = null;

export async function getLeadPressureSnapshot(): Promise<LeadPressureSnapshot> {
  if (process.env.LEAD_PRIORITY_FORCE_PRESSURE === "true") {
    return {
      checkedAt: new Date().toISOString(),
      pressure: true,
      forcePressure: true,
      activeAgents: 0,
      lowClientBuffers: 0,
      emptyClientBuffers: 0,
      threshold: LOW_BUFFER_THRESHOLD,
    };
  }

  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.snapshot;

  const activeSince = new Date(now - ACTIVE_WINDOW_MS).toISOString();
  const result = await leaseDialerPool.query<{
    active_agents: number;
    low_buffers: number;
    empty_buffers: number;
  }>(
    `
      SELECT
        COUNT(*)::int AS active_agents,
        COUNT(*) FILTER (WHERE COALESCE(local_leased_lead_count, 0) < $2)::int AS low_buffers,
        COUNT(*) FILTER (WHERE COALESCE(local_leased_lead_count, 0) <= 0)::int AS empty_buffers
      FROM leasedialer_client_status
      WHERE updated_at >= $1::timestamptz
    `,
    [activeSince, LOW_BUFFER_THRESHOLD],
  );

  const row = result.rows[0] || { active_agents: 0, low_buffers: 0, empty_buffers: 0 };
  const snapshot: LeadPressureSnapshot = {
    checkedAt: new Date().toISOString(),
    pressure: Number(row.low_buffers || 0) > 0,
    forcePressure: false,
    activeAgents: Number(row.active_agents || 0),
    lowClientBuffers: Number(row.low_buffers || 0),
    emptyClientBuffers: Number(row.empty_buffers || 0),
    threshold: LOW_BUFFER_THRESHOLD,
  };
  cached = { expiresAt: now + CACHE_MS, snapshot };
  return snapshot;
}

export async function shouldYieldToLeadDelivery(jobName: string): Promise<boolean> {
  if (process.env.LEAD_PRIORITY_ENABLED === "false") return false;
  if (jobName === "agent_daily_stats_reconciler" && process.env.LEAD_PRIORITY_GATE_DIAL_STATS !== "true") return false;

  try {
    const snapshot = await getLeadPressureSnapshot();
    if (snapshot.pressure) {
      console.error("[LEAD_PRIORITY] yielding non-lead job", { jobName, ...snapshot });
      return true;
    }
  } catch (error: any) {
    // If the pressure check itself fails, be conservative. Do not let
    // background work pile onto the database while lead state is unknown.
    console.error("[LEAD_PRIORITY] pressure check failed; yielding non-lead job", {
      jobName,
      error: error?.message || String(error),
    });
    return true;
  }

  return false;
}
