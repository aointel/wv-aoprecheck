import { spawn } from "node:child_process";
import path from "node:path";
import { reconcileAgentDailyStatsForDate } from "./agent-daily-stats-reconciler";
import { supabaseAdmin } from "./supabase";
import { shouldYieldToLeadDelivery } from "./leasedialer-priority-gate";

const PACIFIC_TZ = "America/Los_Angeles";
const DAILY_RUN_HOUR = 23;
const DAILY_RUN_MINUTE = 59;
const DEFAULT_LOOKBACK_DAYS = Number(process.env.PLATFORM_SALES_SYNC_LOOKBACK_DAYS || "3");

let timer: NodeJS.Timeout | null = null;
let running = false;

function pacificDateString(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: PACIFIC_TZ });
}

function toMmDdYyyy(isoDate: string): string {
  const [yyyy, mm, dd] = isoDate.split("-");
  return `${mm}/${dd}/${yyyy}`;
}

function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eachIsoDate(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  let cursor = new Date(`${startIso}T12:00:00.000Z`);
  const end = new Date(`${endIso}T12:00:00.000Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function nextRunDelayMs(now = new Date()): number {
  const target = new Date(now);
  target.setHours(DAILY_RUN_HOUR, DAILY_RUN_MINUTE, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.max(1_000, target.getTime() - now.getTime());
}

async function fetchLatestPlatformSaleDate(): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const candidates: string[] = [];
  for (const column of ["origination", "sga_submit"] as const) {
    const { data, error } = await supabaseAdmin
      .from("platform_sales")
      .select(column)
      .not(column, "is", null)
      .order(column, { ascending: false })
      .limit(1);
    if (error) throw new Error(`platform_sales latest ${column} lookup failed: ${error.message}`);
    const value = String((data?.[0] as Record<string, unknown> | undefined)?.[column] || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) candidates.push(value);
  }

  const sorted = candidates.sort();
  return sorted.length ? sorted[sorted.length - 1] : null;
}

function runNodeScript(scriptRelativePath: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), scriptRelativePath);
    const child = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptRelativePath} exited with code ${code}`));
    });
  });
}

export async function runPlatformSalesNightlySync(reason = "manual"): Promise<void> {
  if (running) {
    console.error("[PLATFORM_SALES_SYNC] skipped: already running");
    return;
  }
  if (await shouldYieldToLeadDelivery("platform_sales_nightly_sync")) {
    console.error("[PLATFORM_SALES_SYNC] skipped: lead delivery pressure");
    return;
  }

  running = true;
  const endIso = pacificDateString();
  try {
    const latestIso = await fetchLatestPlatformSaleDate();
    const startIso = latestIso
      ? shiftIsoDate(latestIso, -Math.max(0, DEFAULT_LOOKBACK_DAYS))
      : shiftIsoDate(endIso, -Math.max(0, DEFAULT_LOOKBACK_DAYS));

    console.error("[PLATFORM_SALES_SYNC] starting", {
      reason,
      latestIso,
      startIso,
      endIso,
      lookbackDays: DEFAULT_LOOKBACK_DAYS,
    });

    await runNodeScript("server/scripts/rapid-scrape-planet-to-platform-sales.mjs", {
      START_DATE: toMmDdYyyy(startIso),
      END_DATE: toMmDdYyyy(endIso),
      PAGE_SIZE: process.env.PLATFORM_SALES_SYNC_PAGE_SIZE || "500",
      CONCURRENCY: process.env.PLATFORM_SALES_SYNC_CONCURRENCY || "6",
      MAX_PAGES: process.env.PLATFORM_SALES_SYNC_MAX_PAGES || "40",
    });

    await runNodeScript("server/scripts/backfill-platform-sales-associate-id-from-customers.mjs", {});

    for (const statDate of eachIsoDate(startIso, endIso)) {
      const summary = await reconcileAgentDailyStatsForDate(statDate);
      console.error("[PLATFORM_SALES_SYNC] reconciled agent_daily_stats", summary);
    }

    console.error("[PLATFORM_SALES_SYNC] complete", { startIso, endIso });
  } catch (error: any) {
    console.error("[PLATFORM_SALES_SYNC] failed:", error?.message || error);
  } finally {
    running = false;
  }
}

function scheduleNextRun(): void {
  const delay = nextRunDelayMs();
  timer = setTimeout(() => {
    void runPlatformSalesNightlySync("scheduled_2359").finally(scheduleNextRun);
  }, delay);
  timer.unref?.();
  console.error("[PLATFORM_SALES_SYNC] next run scheduled", {
    inMinutes: Math.round(delay / 60_000),
    localTarget: "23:59 America/Los_Angeles",
  });
}

export function startPlatformSalesNightlySyncScheduler(): void {
  if (timer) return;
  scheduleNextRun();
}
