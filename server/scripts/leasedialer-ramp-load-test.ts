/**
 * Leasedialer ramp/load simulation.
 *
 * Simulates normal-ish agent load over time instead of a burst:
 * - Pulls real existing users from agent_routing_profiles.
 * - Starts with N agents.
 * - Adds more agents every interval.
 * - Each active agent loops: sync lead queue -> optionally send fake called result -> wait.
 *
 * Default is intentionally long:
 *   npx tsx server/scripts/leasedialer-ramp-load-test.ts
 *
 * Useful short smoke:
 *   npx tsx server/scripts/leasedialer-ramp-load-test.ts --durationMin=2 --initialAgents=2 --addEveryMin=1 --addAgents=2 --maxAgents=6 --sendResults=false
 *
 * Production mutation mode:
 *   npx tsx server/scripts/leasedialer-ramp-load-test.ts --sendResults=true
 */

import { pool } from "../db.js";

type SyncResult = {
  success?: boolean;
  mode?: string;
  reason?: string | null;
  error?: string | null;
  total?: number;
  leads?: any[];
  currentLead?: any;
  assignmentId?: string | null;
  reused?: boolean;
  assigned?: boolean;
};

type AgentState = {
  idx: number;
  email: string;
  startedAt: number;
  nextDialAt: number;
  cycles: number;
  active: boolean;
};

type RequestSample = {
  route: string;
  status: string;
  ms: number;
  ok: boolean;
  reason?: string | null;
};

type RouteStats = {
  count: number;
  ok: number;
  fail: number;
  latencies: number[];
  byStatus: Record<string, number>;
  byReason: Record<string, number>;
};

const stats: Record<string, RouteStats> = {};
const recentSamples: RequestSample[] = [];

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((v) => v.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function numArg(name: string, fallback: number): number {
  const raw = arg(name);
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function boolArg(name: string, fallback: boolean): boolean {
  const raw = arg(name);
  if (raw == null) return fallback;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(v)) return true;
  if (["0", "false", "no", "n"].includes(v)) return false;
  return fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function routeStats(route: string): RouteStats {
  if (!stats[route]) {
    stats[route] = {
      count: 0,
      ok: 0,
      fail: 0,
      latencies: [],
      byStatus: {},
      byReason: {},
    };
  }
  return stats[route];
}

function record(route: string, sample: RequestSample): void {
  const s = routeStats(route);
  s.count += 1;
  if (sample.ok) s.ok += 1;
  else s.fail += 1;
  s.latencies.push(sample.ms);
  if (s.latencies.length > 20000) s.latencies.shift();
  s.byStatus[sample.status] = (s.byStatus[sample.status] || 0) + 1;
  const reason = String(sample.reason || (sample.ok ? "OK" : "UNKNOWN"));
  s.byReason[reason] = (s.byReason[reason] || 0) + 1;
  recentSamples.push(sample);
  if (recentSamples.length > 500) recentSamples.shift();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function timedJson(route: string, url: string, init: RequestInit, timeoutMs: number): Promise<{
  ok: boolean;
  status: string;
  ms: number;
  json: any;
  text: string;
}> {
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(url, init, timeoutMs);
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    const ms = Date.now() - started;
    record(route, {
      route,
      status: String(res.status),
      ok: res.ok,
      ms,
      reason: json?.reason || json?.error || null,
    });
    return { ok: res.ok, status: String(res.status), ms, json, text };
  } catch (error: any) {
    const ms = Date.now() - started;
    const reason = error?.name === "AbortError" ? "TIMEOUT" : error?.message || String(error);
    record(route, { route, status: "FETCH_ERROR", ok: false, ms, reason });
    return { ok: false, status: "FETCH_ERROR", ms, json: null, text: "" };
  }
}

function leadName(lead: any): string {
  return [lead?.first_name, lead?.last_name].filter(Boolean).join(" ").trim() || lead?.name || "Stress Lead";
}

async function syncLead(baseUrl: string, agent: AgentState, timeoutMs: number): Promise<SyncResult | null> {
  const params = new URLSearchParams({
    userEmail: agent.email,
    rampLoad: "1",
    agentIdx: String(agent.idx),
    t: String(Date.now()),
  });
  const result = await timedJson(
    "leasedialer:sync",
    `${baseUrl}/api/leasedialer/sync?${params}`,
    {
      method: "GET",
      headers: {
        "cache-control": "no-cache",
        "x-stress-test": "leasedialer-ramp",
        "x-user-email": agent.email,
      },
    },
    timeoutMs,
  );
  return result.json as SyncResult | null;
}

async function sendFakeCalledResult(resultBaseUrl: string, agent: AgentState, lead: any, timeoutMs: number): Promise<void> {
  const leadId = lead?.id ?? lead?.leadId ?? lead?.lead_id ?? null;
  const taalkLeadId = lead?.taalk_lead_id ?? lead?.taalkLeadId ?? null;
  const phone = lead?.phone ?? lead?.phone_number ?? "";
  if (!phone) return;

  const callId = `stress-${agent.idx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  await timedJson(
    "outbound:end-call",
    `${resultBaseUrl}/api/outbound-dialer/end-call`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-stress-test": "leasedialer-ramp",
        "x-user-email": agent.email,
      },
      body: JSON.stringify({
        callId,
        leadPhone: phone,
        leadId,
        taalkLeadId,
        disposition: "called",
        duration: 2,
        agentEmail: agent.email,
        leadName: leadName(lead),
      }),
    },
    timeoutMs,
  );
}

async function fetchCandidateAgents(limit: number): Promise<string[]> {
  const result = await pool.query<{ email: string }>(
    `
      WITH candidates AS (
        SELECT DISTINCT lower(agent_email) AS email
        FROM agent_routing_profiles
        WHERE agent_email IS NOT NULL
          AND btrim(agent_email) <> ''
          AND states IS NOT NULL
          AND array_length(states, 1) > 0
          AND lower(agent_email) LIKE '%@aoglobelife.com'
      )
      SELECT email
      FROM candidates
      ORDER BY random()
      LIMIT $1
    `,
    [limit],
  );
  return result.rows.map((r) => r.email).filter(Boolean);
}

function summarize() {
  const out: Record<string, any> = {};
  for (const [route, s] of Object.entries(stats)) {
    out[route] = {
      count: s.count,
      ok: s.ok,
      fail: s.fail,
      byStatus: s.byStatus,
      byReason: s.byReason,
      latencyMs: {
        min: s.latencies.length ? Math.min(...s.latencies) : 0,
        p50: percentile(s.latencies, 50),
        p90: percentile(s.latencies, 90),
        p95: percentile(s.latencies, 95),
        p99: percentile(s.latencies, 99),
        max: s.latencies.length ? Math.max(...s.latencies) : 0,
        avg: s.latencies.length
          ? Math.round(s.latencies.reduce((sum, v) => sum + v, 0) / s.latencies.length)
          : 0,
      },
    };
  }
  return out;
}

function shouldStopEarly(maxErrorRate: number, minRequestsForStop: number): { stop: boolean; reason: string } {
  const sync = stats["leasedialer:sync"];
  if (!sync || sync.count < minRequestsForStop) return { stop: false, reason: "" };
  const errorRate = sync.fail / Math.max(1, sync.count);
  if (errorRate >= maxErrorRate) {
    return {
      stop: true,
      reason: `sync error rate ${(errorRate * 100).toFixed(1)}% >= ${(maxErrorRate * 100).toFixed(1)}%`,
    };
  }
  return { stop: false, reason: "" };
}

async function agentLoop(input: {
  agent: AgentState;
  baseUrl: string;
  resultBaseUrl: string;
  endAt: number;
  dialDelayMs: number;
  sendResults: boolean;
  timeoutMs: number;
  maxErrorRate: number;
  minRequestsForStop: number;
  globalStop: { value: boolean; reason: string };
}) {
  const { agent, baseUrl, resultBaseUrl, endAt, dialDelayMs, sendResults, timeoutMs, maxErrorRate, minRequestsForStop, globalStop } = input;
  while (Date.now() < endAt && !globalStop.value) {
    const synced = await syncLead(baseUrl, agent, timeoutMs);
    agent.cycles += 1;

    const lead = synced?.currentLead || (Array.isArray(synced?.leads) ? synced?.leads?.[0] : null);
    if (sendResults && synced?.success && lead) {
      await sendFakeCalledResult(resultBaseUrl, agent, lead, timeoutMs);
    }

    const stopCheck = shouldStopEarly(maxErrorRate, minRequestsForStop);
    if (stopCheck.stop) {
      globalStop.value = true;
      globalStop.reason = stopCheck.reason;
      break;
    }

    await sleep(dialDelayMs);
  }
  agent.active = false;
}

async function main() {
  const baseUrl = (arg("baseUrl") || "https://aoirail-data-production.up.railway.app").replace(/\/+$/, "");
  const resultBaseUrl = (arg("resultBaseUrl") || "https://aoirail-production.up.railway.app").replace(/\/+$/, "");
  const durationMin = numArg("durationMin", 90);
  const initialAgents = numArg("initialAgents", 5);
  const addEveryMin = numArg("addEveryMin", 5);
  const addAgents = numArg("addAgents", 5);
  const maxAgents = numArg("maxAgents", 100);
  const dialDelayMs = numArg("dialDelayMs", 2000);
  const timeoutMs = numArg("timeoutMs", 60000);
  const reportEverySec = numArg("reportEverySec", 60);
  const sendResults = boolArg("sendResults", false);
  const maxErrorRate = numArg("maxErrorRate", 0.75);
  const minRequestsForStop = numArg("minRequestsForStop", 50);

  const candidates = await fetchCandidateAgents(maxAgents);
  await pool.end();
  if (candidates.length === 0) throw new Error("No candidate agents found in agent_routing_profiles");

  const endAt = Date.now() + durationMin * 60_000;
  const addEveryMs = addEveryMin * 60_000;
  const globalStop = { value: false, reason: "" };
  const agents: AgentState[] = [];
  const loops: Promise<void>[] = [];
  let nextCandidate = 0;
  let nextRampAt = Date.now();

  const addBatch = (count: number) => {
    const added: string[] = [];
    for (let i = 0; i < count && nextCandidate < candidates.length && agents.length < maxAgents; i += 1) {
      const email = candidates[nextCandidate++];
      const agent: AgentState = {
        idx: agents.length + 1,
        email,
        startedAt: Date.now(),
        nextDialAt: Date.now(),
        cycles: 0,
        active: true,
      };
      agents.push(agent);
      added.push(email);
      loops.push(agentLoop({ agent, baseUrl, resultBaseUrl, endAt, dialDelayMs, sendResults, timeoutMs, maxErrorRate, minRequestsForStop, globalStop }));
    }
    if (added.length) {
      console.log(JSON.stringify({ at: new Date().toISOString(), event: "agents_added", added: added.length, activeAgents: agents.filter((a) => a.active).length, totalAgents: agents.length, sample: added.slice(0, 5) }));
    }
  };

  console.log(JSON.stringify({
    at: new Date().toISOString(),
    event: "ramp_start",
    baseUrl,
    resultBaseUrl,
    durationMin,
    initialAgents,
    addEveryMin,
    addAgents,
    maxAgents,
    dialDelayMs,
    sendResults,
    candidateAgents: candidates.length,
    maxErrorRate,
    minRequestsForStop,
  }, null, 2));

  addBatch(initialAgents);
  nextRampAt = Date.now() + addEveryMs;
  let nextReportAt = Date.now() + reportEverySec * 1000;

  while (Date.now() < endAt && !globalStop.value) {
    if (Date.now() >= nextRampAt) {
      addBatch(addAgents);
      nextRampAt += addEveryMs;
    }
    if (Date.now() >= nextReportAt) {
      console.log(JSON.stringify({
        at: new Date().toISOString(),
        event: "ramp_report",
        activeAgents: agents.filter((a) => a.active).length,
        totalAgents: agents.length,
        summary: summarize(),
      }, null, 2));
      nextReportAt += reportEverySec * 1000;
    }
    await sleep(500);
  }

  if (globalStop.value) {
    console.log(JSON.stringify({ at: new Date().toISOString(), event: "early_stop", reason: globalStop.reason }, null, 2));
  }

  await Promise.allSettled(loops);
  console.log(JSON.stringify({
    at: new Date().toISOString(),
    event: "ramp_complete",
    activeAgents: agents.filter((a) => a.active).length,
    totalAgents: agents.length,
    cycles: agents.reduce((sum, a) => sum + a.cycles, 0),
    stoppedEarly: globalStop.value,
    stopReason: globalStop.reason || null,
    summary: summarize(),
    recentSamples: recentSamples.slice(-25),
  }, null, 2));
}

main().catch(async (error) => {
  console.error("[leasedialer-ramp-load-test] failed:", error?.message || error);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
