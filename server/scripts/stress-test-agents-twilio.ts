/**
 * Controlled stress test for AOIrail server:
 * - Simulates N virtual agents (heartbeat/session traffic)
 * - Simulates Twilio webhook traffic (incomingcall + call-status + dial-action)
 *
 * Usage:
 *   npx tsx server/scripts/stress-test-agents-twilio.ts --baseUrl=http://localhost:5001 --agents=50 --durationSec=120
 */

type RouteKey =
  | "agent:heartbeat"
  | "agent:session"
  | "twilio:incomingcall"
  | "twilio:call-status"
  | "twilio:dial-action";

type RouteStats = {
  count: number;
  success: number;
  failures: number;
  totalMs: number;
  maxMs: number;
  latencies: number[];
  byStatus: Record<string, number>;
};

const ROUTES: RouteKey[] = [
  "agent:heartbeat",
  "agent:session",
  "twilio:incomingcall",
  "twilio:call-status",
  "twilio:dial-action",
];

const stats: Record<RouteKey, RouteStats> = Object.fromEntries(
  ROUTES.map((k) => [
    k,
    {
      count: 0,
      success: 0,
      failures: 0,
      totalMs: 0,
      maxMs: 0,
      latencies: [],
      byStatus: {},
    },
  ]),
) as Record<RouteKey, RouteStats>;

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function numArg(name: string, fallback: number): number {
  const v = Number(getArg(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function boolArg(name: string, fallback: boolean): boolean {
  const raw = getArg(name);
  if (raw == null) return fallback;
  const v = raw.toLowerCase().trim();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function p(samples: number[], q: number): number {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((q / 100) * sorted.length));
  return sorted[idx];
}

function logRouteStat(route: RouteKey) {
  const s = stats[route];
  const avg = s.count ? s.totalMs / s.count : 0;
  const p95 = p(s.latencies, 95);
  const p99 = p(s.latencies, 99);
  console.log(
    `${route.padEnd(20)} count=${String(s.count).padStart(5)} ok=${String(s.success).padStart(5)} fail=${String(
      s.failures,
    ).padStart(5)} avg=${avg.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms max=${s.maxMs.toFixed(1)}ms`,
  );
}

async function trackedFetch(route: RouteKey, url: string, init?: RequestInit) {
  const s = stats[route];
  const start = Date.now();
  let ok = false;
  let code = "ERR";
  try {
    const res = await fetch(url, init);
    code = String(res.status);
    ok = res.status < 500;
  } catch {
    ok = false;
    code = "ERR";
  }
  const ms = Date.now() - start;
  s.count += 1;
  s.totalMs += ms;
  s.maxMs = Math.max(s.maxMs, ms);
  s.latencies.push(ms);
  if (s.latencies.length > 10000) s.latencies.shift();
  if (ok) s.success += 1;
  else s.failures += 1;
  s.byStatus[code] = (s.byStatus[code] || 0) + 1;
}

function randomPhone(i: number): string {
  const base = 2000000 + (i % 7000000);
  return `+1503${String(base).padStart(7, "0").slice(0, 7)}`;
}

async function simulateAgent(
  baseUrl: string,
  id: number,
  endAt: number,
  cycleMs: number,
  twilioCallsPerCycle: number,
) {
  const email = `loadagent${id}@aoglobelife.com`;
  const fromPhone = randomPhone(id);
  while (Date.now() < endAt) {
    await trackedFetch("agent:heartbeat", `${baseUrl}/api/ao-recruit/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail: email, context: "stress-test", isOnline: true }),
    });

    await trackedFetch("agent:session", `${baseUrl}/api/auth/session`, {
      method: "GET",
      headers: {
        "x-user-email": email,
      },
    });

    for (let c = 0; c < twilioCallsPerCycle; c++) {
      const callSid = `CA${Date.now()}${id}${c}`.slice(0, 34);
      const toPhone = randomPhone(id * 100 + c);

      const incoming = new URLSearchParams({
        CallSid: callSid,
        From: toPhone,
        To: "+16096048379",
      });
      await trackedFetch("twilio:incomingcall", `${baseUrl}/incomingcall`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: incoming.toString(),
      });

      const status = new URLSearchParams({
        CallSid: callSid,
        CallStatus: "completed",
        CallDuration: String(15 + (id % 60)),
        From: `client:${email}`,
        To: toPhone,
        Direction: "outbound-api",
      });
      await trackedFetch("twilio:call-status", `${baseUrl}/api/twilio/call-status`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: status.toString(),
      });

      const dialAction = new URLSearchParams({
        CallSid: `PA${callSid.slice(2)}`,
        DialCallSid: callSid,
        DialCallStatus: "completed",
        To: toPhone,
        From: `client:${email}`,
      });
      await trackedFetch("twilio:dial-action", `${baseUrl}/api/twilio/dial-action?agentEmail=${encodeURIComponent(email)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: dialAction.toString(),
      });
    }

    const jitter = Math.floor(Math.random() * 250);
    await sleep(Math.max(50, cycleMs + jitter));
  }
}

async function main() {
  const baseUrl = (getArg("baseUrl") || "http://localhost:5001").replace(/\/+$/, "");
  const agents = numArg("agents", 50);
  const durationSec = numArg("durationSec", 120);
  const cycleMs = numArg("cycleMs", 1200);
  const twilioCallsPerCycle = numArg("twilioCallsPerCycle", 1);
  const resetPerf = boolArg("resetPerf", true);

  console.log(
    `[stress-test] baseUrl=${baseUrl} agents=${agents} durationSec=${durationSec} cycleMs=${cycleMs} twilioCallsPerCycle=${twilioCallsPerCycle}`,
  );

  if (resetPerf) {
    try {
      await fetch(`${baseUrl}/api/admin/perf/reset`, { method: "POST" });
      console.log("[stress-test] reset /api/admin/perf metrics");
    } catch {
      console.log("[stress-test] could not reset perf metrics; continuing");
    }
  }

  const endAt = Date.now() + durationSec * 1000;
  await Promise.all(
    Array.from({ length: agents }, (_, i) => simulateAgent(baseUrl, i + 1, endAt, cycleMs, twilioCallsPerCycle)),
  );

  console.log("\n[stress-test] complete. Route summary:");
  for (const route of ROUTES) logRouteStat(route);

  console.log("\n[stress-test] status code distribution:");
  for (const route of ROUTES) {
    const s = stats[route];
    const codes = Object.entries(s.byStatus)
      .sort((a, b) => Number(a[0] === "ERR" ? 999 : a[0]) - Number(b[0] === "ERR" ? 999 : b[0]))
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
    console.log(`${route.padEnd(20)} ${codes}`);
  }

  try {
    const perfRes = await fetch(`${baseUrl}/api/admin/perf/summary`);
    if (perfRes.ok) {
      const perf = await perfRes.json();
      console.log("\n[stress-test] topRoutesByP95 (server-reported):");
      for (const row of (perf.topRoutesByP95 || []).slice(0, 10)) {
        console.log(
          `${String(row.key).padEnd(40)} p95=${row.p95Ms}ms p99=${row.p99Ms}ms avg=${row.avgMs}ms errors=${row.errors}/${row.count}`,
        );
      }
      console.log("\n[stress-test] topDependenciesByP95 (server-reported):");
      for (const row of (perf.topDependenciesByP95 || []).slice(0, 10)) {
        console.log(
          `${String(row.key).padEnd(40)} p95=${row.p95Ms}ms p99=${row.p99Ms}ms avg=${row.avgMs}ms errors=${row.errors}/${row.count}`,
        );
      }
    } else {
      console.log(`[stress-test] perf summary request returned ${perfRes.status}`);
    }
  } catch {
    console.log("[stress-test] could not fetch /api/admin/perf/summary");
  }
}

main().catch((err) => {
  console.error("[stress-test] failed:", err);
  process.exit(1);
});
