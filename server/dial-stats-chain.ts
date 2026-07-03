import { backfillTwilioCallsToLocal } from "./backfill-twilio-to-local.js";
import { reconcileAgentDailyStatsFromAdmForDate } from "./agent-daily-stats-from-adm.js";
import { pool } from "./db.js";
import { resetAgentDialMetricsFromTwilioApi } from "./scripts/reset-agent-dial-metrics-today-from-twilio-api.js";

type DialStatsCounts = {
  twilioResolvableOutbound: number;
  twilioOutboundTotal: number;
  admDials: number;
  adsDials: number;
};

type DialStatsCycleResult = {
  ok: boolean;
  reason: string;
  elapsedMs: number;
  windowStartIso: string;
  windowEndIso: string;
  nyDate: string;
  twilioInserted: number;
  twilioSkippedExisting: number;
  twilioErrors: number;
  admInserted: number;
  ads: Awaited<ReturnType<typeof reconcileAgentDailyStatsFromAdmForDate>>;
  counts: DialStatsCounts;
  driftTwilioToAdm: number;
  driftTwilioToAds: number;
  driftAdmToAds: number;
  autoRepairTriggered?: boolean;
  autoRepairReason?: string;
  autoRepairSummary?: unknown;
  error?: string;
  retries?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function operationalDialDateIso(now = new Date()): string {
  const shifted = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

function nyLocalToUtcMs(year: number, month: number, day: number, hour: number, minute = 0, second = 0): number {
  const targetLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const guess = new Date(targetLocalAsUtc);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(guess)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = representedAsUtc - guess.getTime();
  return targetLocalAsUtc - offsetMs;
}

export function getOperationalDialWindow(now = new Date()): {
  nyDate: string;
  windowStartIso: string;
  windowEndIso: string;
} {
  const nyDate = operationalDialDateIso(now);
  const [year, month, day] = nyDate.split("-").map(Number);
  const windowStartMs = nyLocalToUtcMs(year, month, day, 6, 0, 0);
  const windowStartIso = new Date(windowStartMs).toISOString();
  const windowEndIso = new Date(windowStartMs + 24 * 60 * 60 * 1000).toISOString();
  return { nyDate, windowStartIso, windowEndIso };
}

export async function syncAgentDialMetricsFromTwilioLogsWindow(
  windowStartIso: string,
  windowEndIso: string,
): Promise<number> {
  const startMs = new Date(windowStartIso).getTime();
  const endMs = new Date(windowEndIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  const chunkMinutes = Number(process.env.DIAL_STATS_ADM_CHUNK_MINUTES || 60);
  const minChunkMinutes = Number(process.env.DIAL_STATS_ADM_MIN_CHUNK_MINUTES || 5);
  const chunkConcurrency = Math.max(1, Number(process.env.DIAL_STATS_ADM_CHUNK_CONCURRENCY || 3));
  const chunkMs = Math.max(5, chunkMinutes) * 60 * 1000;
  const minChunkMs = Math.max(1, minChunkMinutes) * 60 * 1000;

  const runChunkInsert = async (chunkStartIso: string, chunkEndIso: string): Promise<number> => {
    const result = await pool.query(
    `
      WITH base AS (
        SELECT
          LOWER(
            TRIM(
              COALESCE(
                NULLIF(t.owner_email, ''),
                NULLIF(REPLACE(CASE WHEN LOWER(COALESCE(t.from_number, '')) LIKE 'client:%' THEN LOWER(t.from_number) ELSE '' END, 'client:', ''), ''),
                NULLIF(REPLACE(CASE WHEN LOWER(COALESCE(t.agent_identity, '')) LIKE 'client:%' THEN LOWER(t.agent_identity) ELSE '' END, 'client:', ''), ''),
                NULLIF(REPLACE(CASE WHEN LOWER(COALESCE(t.to_number, '')) LIKE 'client:%' THEN LOWER(t.to_number) ELSE '' END, 'client:', ''), ''),
                -- fall back to parent call to resolve agent email
                NULLIF(p.owner_email, ''),
                NULLIF(REPLACE(CASE WHEN LOWER(COALESCE(p.from_number, '')) LIKE 'client:%' THEN LOWER(p.from_number) ELSE '' END, 'client:', ''), ''),
                NULLIF(REPLACE(CASE WHEN LOWER(COALESCE(p.agent_identity, '')) LIKE 'client:%' THEN LOWER(p.agent_identity) ELSE '' END, 'client:', ''), '')
              )
            )
          ) AS agent_email,
          RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '[^0-9]', '', 'g'), 10) AS lead_phone,
          COALESCE(t.call_duration, 0)::int AS call_duration,
          LOWER(COALESCE(t.call_status, '')) AS call_status,
          t.twilio_call_sid AS call_sid,
          t.call_started_at AS event_timestamp
        FROM twilio_call_logs t
        LEFT JOIN twilio_call_logs p ON p.twilio_call_sid = t.parent_call_sid
        WHERE t.call_started_at IS NOT NULL
          AND t.call_started_at >= $1::timestamptz
          AND t.call_started_at < $2::timestamptz
          AND LOWER(COALESCE(t.call_direction, '')) IN ('outbound', 'outbound-dial', 'outbound-api')
          AND COALESCE(TRIM(t.twilio_call_sid), '') <> ''
      ),
      dial_events AS (
        SELECT
          agent_email,
          lead_phone,
          'dial'::text AS event_type,
          event_timestamp,
          NULLIF(call_duration, 0) AS call_duration,
          call_status,
          call_sid,
          'dial_stats_chain'::text AS source,
          NULL::text AS disposition
        FROM base
        WHERE lead_phone <> ''
          AND agent_email <> ''
      ),
      reach_events AS (
        SELECT
          agent_email,
          lead_phone,
          'reach'::text AS event_type,
          event_timestamp,
          NULLIF(call_duration, 0) AS call_duration,
          call_status,
          call_sid,
          'dial_stats_chain'::text AS source,
          'connected'::text AS disposition
        FROM base
        WHERE lead_phone <> ''
          AND agent_email <> ''
          AND call_duration >= 45
          AND call_status IN ('answered', 'completed')
      ),
      all_events AS (
        SELECT * FROM dial_events
        UNION ALL
        SELECT * FROM reach_events
      )
      INSERT INTO agent_dial_metrics (
        agent_email, lead_phone, event_type, event_timestamp, call_duration, call_status, call_sid, source, disposition
      )
      SELECT
        e.agent_email, e.lead_phone, e.event_type, e.event_timestamp, e.call_duration, e.call_status, e.call_sid, e.source, e.disposition
      FROM all_events e
      LEFT JOIN agent_dial_metrics adm
        ON adm.call_sid = e.call_sid
       AND adm.event_type = e.event_type
       AND adm.event_timestamp >= $1::timestamptz
       AND adm.event_timestamp < $2::timestamptz
      WHERE adm.call_sid IS NULL
    `,
      [chunkStartIso, chunkEndIso],
    );
    return Number(result.rowCount || 0);
  };

  const isTimeoutError = (error: any): boolean =>
    /query read timeout|statement timeout|timeout/i.test(String(error?.message || error || ""));

  const processChunk = async (chunkStartMs: number, chunkEndMs: number): Promise<number> => {
    const chunkStartIso = new Date(chunkStartMs).toISOString();
    const chunkEndIso = new Date(chunkEndMs).toISOString();
    try {
      return await runChunkInsert(chunkStartIso, chunkEndIso);
    } catch (error: any) {
      const spanMs = chunkEndMs - chunkStartMs;
      if (isTimeoutError(error) && spanMs > minChunkMs) {
        const mid = chunkStartMs + Math.floor(spanMs / 2);
        const left = await processChunk(chunkStartMs, mid);
        const right = await processChunk(mid, chunkEndMs);
        return left + right;
      }
      throw error;
    }
  };

  const chunks: Array<{ start: number; end: number }> = [];
  for (let cursor = startMs; cursor < endMs; cursor += chunkMs) {
    chunks.push({ start: cursor, end: Math.min(endMs, cursor + chunkMs) });
  }

  let chunkIdx = 0;
  const workers = new Array(Math.min(chunkConcurrency, chunks.length)).fill(0).map(async () => {
    let inserted = 0;
    while (chunkIdx < chunks.length) {
      const idx = chunkIdx;
      chunkIdx += 1;
      const chunk = chunks[idx];
      inserted += await processChunk(chunk.start, chunk.end);
    }
    return inserted;
  });

  const workerTotals = await Promise.all(workers);
  const totalInserted = workerTotals.reduce((sum, value) => sum + value, 0);

  return totalInserted;
}

export async function collectDialStatsBaseline(windowStartIso: string, windowEndIso: string, nyDate: string): Promise<DialStatsCounts> {
  const counts = await pool.query<{
    twilio_resolvable_outbound: string;
    twilio_outbound_total: string;
    adm_dials: string;
    ads_dials: string;
  }>(
    `
      WITH twilio_counts AS (
        SELECT
          COUNT(*)::bigint AS twilio_outbound_total,
          COUNT(*) FILTER (
            WHERE
              LENGTH(RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '[^0-9]', '', 'g'), 10)) = 10
              AND (
                COALESCE(TRIM(t.owner_email), '') <> ''
                OR LOWER(COALESCE(t.agent_identity, '')) LIKE 'client:%'
                OR LOWER(COALESCE(t.from_number, '')) LIKE 'client:%'
                OR LOWER(COALESCE(t.to_number, '')) LIKE 'client:%'
              )
          )::bigint AS twilio_resolvable_outbound
        FROM twilio_call_logs t
        WHERE t.call_started_at >= $1::timestamptz
          AND t.call_started_at < $2::timestamptz
          AND LOWER(COALESCE(t.call_direction, '')) IN ('outbound', 'outbound-dial', 'outbound-api')
          AND COALESCE(TRIM(t.twilio_call_sid), '') <> ''
      ),
      adm_counts AS (
        SELECT COUNT(*)::bigint AS adm_dials
        FROM agent_dial_metrics adm
        WHERE adm.event_type = 'dial'
          AND adm.source = 'dial_stats_chain'
          AND adm.event_timestamp >= $1::timestamptz
          AND adm.event_timestamp < $2::timestamptz
          AND COALESCE(TRIM(adm.agent_email), '') <> ''
      ),
      ads_counts AS (
        SELECT COALESCE(SUM(COALESCE(ads.dials, 0)), 0)::bigint AS ads_dials
        FROM agent_daily_stats ads
        WHERE ads.stat_date = $3::date
      )
      SELECT
        twilio_counts.twilio_resolvable_outbound::text,
        twilio_counts.twilio_outbound_total::text,
        adm_counts.adm_dials::text,
        ads_counts.ads_dials::text
      FROM twilio_counts
      CROSS JOIN adm_counts
      CROSS JOIN ads_counts
    `,
    [windowStartIso, windowEndIso, nyDate],
  );

  return {
    twilioResolvableOutbound: Number(counts.rows[0]?.twilio_resolvable_outbound || 0),
    twilioOutboundTotal: Number(counts.rows[0]?.twilio_outbound_total || 0),
    admDials: Number(counts.rows[0]?.adm_dials || 0),
    adsDials: Number(counts.rows[0]?.ads_dials || 0),
  };
}

async function runDialStatsCycle(reason: string, twilioDaysBack: number): Promise<DialStatsCycleResult> {
  const startedAt = Date.now();
  const { nyDate, windowStartIso, windowEndIso } = getOperationalDialWindow();
  const failedSummary = {
    day: nyDate,
    updated: 0,
    inserted: 0,
    agents: 0,
    dials: 0,
    reached: 0,
    booked: 0,
    instants: 0,
  };

  try {
    const twilio = await backfillTwilioCallsToLocal(twilioDaysBack);
    const admInserted = await syncAgentDialMetricsFromTwilioLogsWindow(windowStartIso, windowEndIso);
    let summary = await reconcileAgentDailyStatsFromAdmForDate(nyDate);
    let counts = await collectDialStatsBaseline(windowStartIso, windowEndIso, nyDate);
    let autoRepairTriggered = false;
    let autoRepairReason = "";
    let autoRepairSummary: unknown = null;

    const driftThreshold = Number(process.env.DIAL_STATS_AUTO_REPAIR_DRIFT_THRESHOLD || 250);
    const autoRepairEnabled = process.env.DIAL_STATS_AUTO_REPAIR_ENABLED !== "false";
    const twilioVsAdsDrift = Math.abs(counts.twilioResolvableOutbound - counts.adsDials);
    const admVsAdsDrift = Math.abs(counts.admDials - counts.adsDials);
    const shouldAutoRepair = autoRepairEnabled && (twilioVsAdsDrift >= driftThreshold || admVsAdsDrift >= driftThreshold);

    if (shouldAutoRepair) {
      autoRepairTriggered = true;
      autoRepairReason = `drift twilio_vs_ads=${twilioVsAdsDrift} adm_vs_ads=${admVsAdsDrift} threshold=${driftThreshold}`;
      autoRepairSummary = await resetAgentDialMetricsFromTwilioApi(nyDate);
      summary = await reconcileAgentDailyStatsFromAdmForDate(nyDate);
      counts = await collectDialStatsBaseline(windowStartIso, windowEndIso, nyDate);
    }

    return {
      ok: true,
      reason,
      elapsedMs: Date.now() - startedAt,
      windowStartIso,
      windowEndIso,
      nyDate,
      twilioInserted: twilio.upserted,
      twilioSkippedExisting: twilio.skipped_existing,
      twilioErrors: twilio.errors,
      admInserted,
      ads: summary,
      counts,
      driftTwilioToAdm: counts.twilioResolvableOutbound - counts.admDials,
      driftTwilioToAds: counts.twilioResolvableOutbound - counts.adsDials,
      driftAdmToAds: counts.admDials - counts.adsDials,
      autoRepairTriggered,
      autoRepairReason,
      autoRepairSummary,
    };
  } catch (error: any) {
    return {
      ok: false,
      reason,
      elapsedMs: Date.now() - startedAt,
      windowStartIso,
      windowEndIso,
      nyDate,
      twilioInserted: 0,
      twilioSkippedExisting: 0,
      twilioErrors: 1,
      admInserted: 0,
      ads: failedSummary,
      counts: {
        twilioResolvableOutbound: 0,
        twilioOutboundTotal: 0,
        admDials: 0,
        adsDials: 0,
      },
      driftTwilioToAdm: 0,
      driftTwilioToAds: 0,
      driftAdmToAds: 0,
      error: error?.message || String(error),
    };
  }
}

function logCycle(result: DialStatsCycleResult): void {
  if (result.ok) {
    console.error(
      `[DialStatsChain] ${result.reason} ok=true retries=${result.retries || 0} nyDate=${result.nyDate} windowStart=${result.windowStartIso} windowEnd=${result.windowEndIso} twilioInserted=${result.twilioInserted} twilioSkipped=${result.twilioSkippedExisting} twilioErrors=${result.twilioErrors} admInserted=${result.admInserted} adsAgents=${result.ads.agents} adsDials=${result.ads.dials} adsReached=${result.ads.reached} adsBooked=${result.ads.booked} adsInstants=${result.ads.instants} resolvableTwilioOutbound=${result.counts.twilioResolvableOutbound} twilioOutboundTotal=${result.counts.twilioOutboundTotal} admDials=${result.counts.admDials} driftTwilioAdm=${result.driftTwilioToAdm} driftTwilioAds=${result.driftTwilioToAds} driftAdmAds=${result.driftAdmToAds} autoRepairTriggered=${result.autoRepairTriggered ? "true" : "false"} autoRepairReason="${result.autoRepairReason || ""}" elapsedMs=${result.elapsedMs}`,
    );
    if (result.autoRepairTriggered && result.autoRepairSummary) {
      console.error(`[DialStatsChain] autoRepairSummary ${JSON.stringify(result.autoRepairSummary)}`);
    }
    return;
  }

  console.error(
    `[DialStatsChain] ${result.reason} ok=false retries=${result.retries || 0} nyDate=${result.nyDate} windowStart=${result.windowStartIso} windowEnd=${result.windowEndIso} error="${result.error || "unknown"}" elapsedMs=${result.elapsedMs}`,
  );
}

export function startDialStatsChainScheduler(config?: {
  intervalMs?: number;
  retryDelayMs?: number;
  maxRetries?: number;
  twilioDaysBack?: number;
  retryTwilioDaysBack?: number;
}): () => void {
  const intervalMs = config?.intervalMs ?? 10 * 60 * 1000;
  const retryDelayMs = config?.retryDelayMs ?? 20_000;
  const maxRetries = config?.maxRetries ?? 1;
  const twilioDaysBack = config?.twilioDaysBack ?? Number(process.env.DIAL_STATS_TWILIO_DAYS_BACK || 0);
  const retryTwilioDaysBack = config?.retryTwilioDaysBack ?? Number(process.env.DIAL_STATS_RETRY_TWILIO_DAYS_BACK || 0);

  let running = false;
  let pendingIntervalRun = false;
  let timer: NodeJS.Timeout | null = null;

  const runWithRetry = async (reason: string) => {
    if (running) {
      pendingIntervalRun = true;
      console.error(`[DialStatsChain] ${reason} queued (previous run still active)`);
      return;
    }
    running = true;
    try {
      pendingIntervalRun = false;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const isRetry = attempt > 0;
        const cycleReason = isRetry ? `${reason}:retry${attempt}` : reason;
        const daysBack = isRetry ? retryTwilioDaysBack : twilioDaysBack;
        const result = await runDialStatsCycle(cycleReason, daysBack);
        result.retries = attempt;
        logCycle(result);
        if (result.ok) return;
        if (attempt < maxRetries) {
          await sleep(retryDelayMs);
        }
      }
    } finally {
      running = false;
      if (pendingIntervalRun) {
        // Drain one queued interval immediately so we do not silently lose a 10-minute cycle.
        void runWithRetry("queued_interval").catch((error) => {
          console.error("[DialStatsChain] queued interval failure:", error?.message || error);
        });
      }
    }
  };

  runWithRetry("startup").catch((error) => {
    console.error("[DialStatsChain] startup failure:", error?.message || error);
  });
  timer = setInterval(() => {
    runWithRetry("interval").catch((error) => {
      console.error("[DialStatsChain] interval failure:", error?.message || error);
    });
  }, intervalMs);

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}

