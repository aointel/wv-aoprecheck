import { leaseDialerWorkerPool as pool } from "./db";
import { supabaseAdmin } from "./supabase";

type Bucket = { market: string; state: string };
type AgentProfile = { agent_email: string; markets: string[] | null; states: string[] | null; local_leased_lead_count: number | null };

const QUEUE = "hotlead";
const POOL_TARGET = Number(process.env.LEASEDIALER_POOL_READY_TARGET || 1000);
const AGENT_TARGET = Number(process.env.LEASEDIALER_AGENT_BUFFER_TARGET || 100);
const AGENT_REFILL_THRESHOLD = Number(process.env.LEASEDIALER_AGENT_REFILL_THRESHOLD || 50);
const LOOP_MS = Number(process.env.LEASEDIALER_AUTOMATION_INTERVAL_MS || 10_000);
const MASTERLEAD_PAGE_SIZE = Number(process.env.LEASEDIALER_AUTOMATION_PAGE_SIZE || 5000);
const MAX_POOL_INSERTS_PER_BUCKET = Number(process.env.LEASEDIALER_AUTOMATION_MAX_POOL_INSERTS_PER_BUCKET || 1000);
const MAX_POOL_PAGES_PER_BUCKET = Number(process.env.LEASEDIALER_AUTOMATION_MAX_POOL_PAGES_PER_BUCKET || 500);
const MAX_BUCKETS_PER_LOOP = Number(process.env.LEASEDIALER_AUTOMATION_MAX_BUCKETS_PER_LOOP || 80);
const MAX_AGENT_WARMS_PER_LOOP = Number(process.env.LEASEDIALER_AUTOMATION_MAX_AGENT_WARMS || 80);
const ACTIVE_WINDOW_MS = Number(process.env.LEASEDIALER_ACTIVE_WINDOW_MS || 15 * 60 * 1000);
const EXHAUSTED_BUCKET_BACKOFF_MS = Number(process.env.LEASEDIALER_EXHAUSTED_BUCKET_BACKOFF_MS || 60 * 1000);
const RECYCLE_AFTER_MS = Number(process.env.LEASEDIALER_RECYCLE_AFTER_MS || 2 * 60 * 60 * 1000);
const RECYCLE_BATCH_SIZE = Number(process.env.LEASEDIALER_RECYCLE_BATCH_SIZE || 1000);
const DIRECT_ASSIGN_PAGE_SIZE = Number(process.env.LEASEDIALER_DIRECT_ASSIGN_PAGE_SIZE || 50);
const DIRECT_ASSIGN_MAX_PAGES_PER_STATE = Number(process.env.LEASEDIALER_DIRECT_ASSIGN_MAX_PAGES_PER_STATE || 200);

let started = false;
let running = false;
const bucketCursors = new Map<string, bigint>();
const exhaustedBuckets = new Map<string, number>();

const STATE_TIMEZONES: Record<string, string> = {
  CT: "America/New_York", DC: "America/New_York", DE: "America/New_York", FL: "America/New_York", GA: "America/New_York",
  IN: "America/Indiana/Indianapolis", MA: "America/New_York", MD: "America/New_York", ME: "America/New_York", MI: "America/New_York",
  NC: "America/New_York", NH: "America/New_York", NJ: "America/New_York", NY: "America/New_York", OH: "America/New_York",
  PA: "America/New_York", RI: "America/New_York", SC: "America/New_York", VA: "America/New_York", VT: "America/New_York", WV: "America/New_York",
  AL: "America/Chicago", AR: "America/Chicago", IA: "America/Chicago", IL: "America/Chicago", KS: "America/Chicago", KY: "America/Chicago",
  LA: "America/Chicago", MN: "America/Chicago", MO: "America/Chicago", MS: "America/Chicago", ND: "America/Chicago", NE: "America/Chicago",
  OK: "America/Chicago", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago", WI: "America/Chicago",
  AZ: "America/Phoenix", CO: "America/Denver", ID: "America/Denver", MT: "America/Denver", NM: "America/Denver", UT: "America/Denver", WY: "America/Denver",
  CA: "America/Los_Angeles", NV: "America/Los_Angeles", OR: "America/Los_Angeles", WA: "America/Los_Angeles",
  AK: "America/Anchorage", HI: "Pacific/Honolulu",
};

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeState(value: unknown): string {
  return String(value || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
}

function isLeasedialerState(value: unknown): boolean {
  return Object.prototype.hasOwnProperty.call(STATE_TIMEZONES, normalizeState(value));
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeMarket(value: unknown): string {
  const market = clean(value);
  const normalized = market.toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("globe")) return "Globe Market";
  if (normalized.includes("veteran")) return "Veteran";
  return market;
}

function isLeasedialerMarket(value: unknown): boolean {
  const normalized = clean(value).toLowerCase().replace(/\s+/g, "");
  return normalized !== "" && normalized !== "aorecruit" && normalized !== "aovamos";
}

function truthy(value: unknown): boolean {
  return ["true", "1", "yes", "y"].includes(clean(value).toLowerCase());
}

function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => clean(item)).filter(Boolean);
  const raw = clean(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => clean(item)).filter(Boolean);
  } catch {
    // not JSON
  }
  return raw.split(",").map((item) => clean(item)).filter(Boolean);
}

async async function resolveCustomerRoutingProfile(profile: AgentProfile): Promise<{ markets: string[]; states: string[] }> {
  const email = normalizeEmail(profile.agent_email);
  if (!supabaseAdmin || !email) return { markets: [], states: [] };

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("market, secondary_market, states")
    .or(`company_email.eq.${email},personal_email.eq.${email}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[LEASE_AUTO] customer routing lookup failed", { email, error: error.message });
    return { markets: [], states: [] };
  }

  const primaryMarkets = parseArray((data as any)?.market).map(normalizeMarket).filter(isLeasedialerMarket);
  const secondaryMarkets = parseArray((data as any)?.secondary_market).map(normalizeMarket).filter(isLeasedialerMarket);
  const markets = Array.from(new Set([...primaryMarkets, ...secondaryMarkets]));
  const states = Array.from(new Set(parseArray((data as any)?.states).map(normalizeState).filter(isLeasedialerState)));
  if (markets.length === 0 || states.length === 0) return { markets: [], states: [] };

  await pool.query(
    `
      INSERT INTO agent_routing_profiles (agent_email, markets, states, source, updated_at)
      VALUES ($1, $2::text[], $3::text[], 'customers_live_topoff', NOW())
      ON CONFLICT (agent_email)
      DO UPDATE SET
        markets = EXCLUDED.markets,
        states = EXCLUDED.states,
        source = EXCLUDED.source,
        updated_at = NOW()
    `,
    [email, markets, states],
  ).catch(() => undefined);

  return { markets, states };
}

function isStateInsideCallingWindow(stateValue: unknown): boolean {
  const timezone = STATE_TIMEZONES[normalizeState(stateValue)];
  if (!timezone) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const minutes = hour * 60 + minute;
  return minutes >= 8 * 60 && minutes <= 21 * 60;
}

function leadIsClean(row: Record<string, unknown>, bucket: Bucket): boolean {
  const market = clean(row.taalk_market) || clean(row.market);
  const state = normalizeState(row.taalk_state || row.state);
  const resolution = clean(row.cnresolution || "pending").toLowerCase();
  return (
    normalizeMarket(market) === bucket.market &&
    state === bucket.state &&
    clean(row.taalk_lead_id) !== "" &&
    clean(row.cn_email) === "" &&
    ["pending", "new", "", "null"].includes(resolution)
  );
}

async function getAllRoutingProfiles(): Promise<AgentProfile[]> {
  const result = await pool.query<AgentProfile>(
    `
      SELECT
        lower(agent_email) AS agent_email,
        markets,
        states,
        NULL::int AS local_leased_lead_count
      FROM agent_routing_profiles
      WHERE agent_email IS NOT NULL
        AND btrim(agent_email) <> ''
        AND markets IS NOT NULL
        AND array_length(markets, 1) > 0
        AND states IS NOT NULL
        AND array_length(states, 1) > 0
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 5000
    `,
  );
  return result.rows;
}

async function getActiveProfiles(): Promise<AgentProfile[]> {
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
  const result = await pool.query<AgentProfile>(
    `
      SELECT
        lower(cs.agent_email) AS agent_email,
        arp.markets,
        arp.states,
        cs.local_leased_lead_count
      FROM leasedialer_client_status cs
      JOIN agent_routing_profiles arp
        ON lower(arp.agent_email) = lower(cs.agent_email)
      WHERE cs.updated_at >= $1::timestamptz
        AND arp.markets IS NOT NULL
        AND array_length(arp.markets, 1) > 0
        AND arp.states IS NOT NULL
        AND array_length(arp.states, 1) > 0
      ORDER BY cs.updated_at DESC
      LIMIT 250
    `,
    [since],
  );
  return result.rows;
}

function bucketsFromProfiles(profiles: AgentProfile[]): Bucket[] {
  const seen = new Map<string, Bucket>();
  for (const profile of profiles) {
    const markets = Array.isArray(profile.markets) ? profile.markets.map(normalizeMarket).filter(isLeasedialerMarket) : [];
    const states = Array.isArray(profile.states) ? profile.states.map(normalizeState).filter(isLeasedialerState) : [];
    for (const market of markets) {
      for (const state of states) {
        seen.set(`${market}::${state}`, { market, state });
      }
    }
  }
  return Array.from(seen.values());
}

async function countReady(bucket: Bucket): Promise<number> {
  const result = await pool.query<{ count: number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM leasedialer_eligible_pool
      WHERE queue = $1
        AND market = $2
        AND state = $3
        AND status = 'ready'
    `,
    [QUEUE, bucket.market, bucket.state],
  );
  return Number(result.rows[0]?.count || 0);
}

async function getReadyCounts(): Promise<Map<string, number>> {
  const result = await pool.query<{ market: string; state: string; count: number }>(
    `
      SELECT market, state, COUNT(*)::int AS count
      FROM leasedialer_eligible_pool
      WHERE queue = $1
        AND status = 'ready'
      GROUP BY market, state
    `,
    [QUEUE],
  );
  return new Map(result.rows.map((row) => [`${row.market}::${row.state}`, Number(row.count || 0)]));
}

async function expireStalePoolRows(bucket: Bucket): Promise<number> {
  const result = await pool.query(
    `
      WITH targets AS (
        SELECT ep.id
        FROM leasedialer_eligible_pool ep
        JOIN masterlead ml ON ml.id = ep.lead_id
        WHERE ep.queue = $1
          AND ep.market = $2
          AND ep.state = $3
          AND ep.status IN ('ready', 'claimed')
          AND (
            COALESCE(btrim(ml.cn_email), '') <> ''
            OR lower(trim(coalesce(ml.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
            OR COALESCE(btrim(ml.taalk_lead_id::text), '') = ''
          )
        LIMIT 50
      )
      UPDATE leasedialer_eligible_pool ep
      SET status = 'expired',
          updated_at = NOW()
      FROM targets
      WHERE ep.id = targets.id
    `,
    [QUEUE, bucket.market, bucket.state],
  );
  return result.rowCount || 0;
}

async function upsertPoolRows(bucket: Bucket, rows: Array<Record<string, unknown>>): Promise<number> {
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => Number(row.id)).filter(Number.isFinite);
  const created = rows.map((row) => new Date(String(row.created_at || new Date().toISOString())).toISOString());
  const result = await pool.query(
    `
      INSERT INTO leasedialer_eligible_pool (
        lead_id, queue, market, state, status, claimed_by_agent_email,
        claimed_assignment_id, claimed_at, lead_received_at, created_at, updated_at
      )
      SELECT
        picked.lead_id,
        $2,
        $3,
        $4,
        'ready',
        NULL,
        NULL,
        NULL,
        picked.created_at,
        NOW(),
        NOW()
      FROM unnest($1::bigint[], $5::timestamptz[]) AS picked(lead_id, created_at)
      ON CONFLICT (lead_id) DO UPDATE
      SET queue = EXCLUDED.queue,
          market = EXCLUDED.market,
          state = EXCLUDED.state,
          status = 'ready',
          claimed_by_agent_email = NULL,
          claimed_assignment_id = NULL,
          claimed_at = NULL,
          lead_received_at = EXCLUDED.lead_received_at,
          updated_at = NOW()
      WHERE leasedialer_eligible_pool.status IN ('expired', 'claimed')
      RETURNING lead_id
    `,
    [ids, QUEUE, bucket.market, bucket.state, created],
  );
  return result.rowCount || 0;
}

async function fillPoolBucket(bucket: Bucket, options?: { active?: boolean }): Promise<{ inserted: number; ready: number; expired: number }> {
  const key = `${bucket.market}::${bucket.state}`;
  const exhaustedUntil = exhaustedBuckets.get(key) || 0;
  if (!options?.active && Date.now() < exhaustedUntil) {
    const ready = await countReady(bucket).catch(() => 0);
    return { inserted: 0, ready, expired: 0 };
  }
  if (options?.active) {
    exhaustedBuckets.delete(key);
  }

  const expired = await expireStalePoolRows(bucket).catch(() => 0);
  let ready = await countReady(bucket).catch(() => 0);
  if (ready >= POOL_TARGET) {
    exhaustedBuckets.delete(key);
    return { inserted: 0, ready, expired };
  }

  let cursor = bucketCursors.get(key) || 9223372036854775807n;
  let inserted = 0;
  let pages = 0;
  let candidateCount = 0;
  while (ready < POOL_TARGET && inserted < MAX_POOL_INSERTS_PER_BUCKET && pages < MAX_POOL_PAGES_PER_BUCKET) {
    const page = await pool.query<Record<string, unknown>>(
      `
        SELECT
          id, created_at, taalk_market, market, taalk_state, state, cn_email,
          cnresolution, dnc, ftcrestricted, "FTCRESTRICTED", currently_calling, "TaalkResolve"
        FROM masterlead
        WHERE id < $1
        ORDER BY id DESC
        LIMIT $2
      `,
      [cursor.toString(), MASTERLEAD_PAGE_SIZE],
    );
    if (page.rows.length === 0) {
      cursor = 9223372036854775807n;
      break;
    }
    cursor = BigInt(String(page.rows[page.rows.length - 1].id));
    const candidates = page.rows
      .filter((row) => leadIsClean(row, bucket))
      .slice(0, Math.min(MAX_POOL_INSERTS_PER_BUCKET - inserted, POOL_TARGET - ready));
    candidateCount += candidates.length;
    const added = await upsertPoolRows(bucket, candidates).catch(() => 0);
    inserted += added;
    ready += added;
    pages += 1;
  }
  bucketCursors.set(key, cursor);
  if (ready >= POOL_TARGET || inserted > 0) {
    exhaustedBuckets.delete(key);
  } else if (!options?.active && pages >= MAX_POOL_PAGES_PER_BUCKET && candidateCount === 0) {
    exhaustedBuckets.set(key, Date.now() + EXHAUSTED_BUCKET_BACKOFF_MS);
    console.error("[LEASE_AUTO] bucket exhausted/backing off", {
      bucket,
      ready,
      pages,
      backoffMs: EXHAUSTED_BUCKET_BACKOFF_MS,
    });
  }
  console.error("[LEASE_AUTO] bucket fill result", {
    bucket,
    ready,
    inserted,
    expired,
    pages,
    candidates: candidateCount,
    target: POOL_TARGET,
  });
  return { inserted, ready, expired };
}

async function countAgentCallable(email: string): Promise<number> {
  const result = await pool.query<{ count: number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM leasedialer_assignments la
      JOIN masterlead ml ON ml.id = la.lead_id
      WHERE lower(la.agent_email) = lower($1)
        AND la.queue = $2
        AND la.status IN ('queued', 'active')
        AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        AND (
          COALESCE(btrim(ml.cn_email), '') = ''
          OR lower(btrim(ml.cn_email)) = lower($1)
        )
    `,
    [email, QUEUE],
  );
  return Number(result.rows[0]?.count || 0);
}

async function syncAgentClientCount(email: string, count: number): Promise<void> {
  await pool.query(
    `
      INSERT INTO leasedialer_client_status (agent_email, local_leased_lead_count, current_lead_id, updated_at)
      VALUES ($1, $2, NULL, NOW())
      ON CONFLICT (agent_email)
      DO UPDATE SET
        local_leased_lead_count = EXCLUDED.local_leased_lead_count,
        updated_at = NOW()
    `,
    [email, count],
  ).catch(() => undefined);
}

async function assignDirectFromMasterlead(email: string, markets: string[], states: string[], needed: number): Promise<number> {
  if (needed <= 0 || markets.length === 0 || states.length === 0) return 0;
  let insertedTotal = 0;
  for (const market of markets) {
    for (const state of states) {
      let cursorCreatedAt: string | null = null;
      let cursorId: number | null = null;
      for (let page = 0; page < DIRECT_ASSIGN_MAX_PAGES_PER_STATE && insertedTotal < needed; page += 1) {
        const remaining = needed - insertedTotal;
        const result = await pool.query<{ lead_id: string; created_at: string; source_id: string }>(
          `
            WITH eligible AS (
              SELECT ml.id, ml.created_at
              FROM masterlead ml
              WHERE (
                  CASE
                    WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
                    WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
                    ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
                  END
                ) = $1
                AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = $2
                AND COALESCE(btrim(ml.cn_email), '') = ''
                AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
                AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
                AND (
                  $5::timestamptz IS NULL
                  OR (ml.created_at, ml.id) < ($5::timestamptz, $6::bigint)
                )
              ORDER BY ml.created_at DESC NULLS LAST, ml.id DESC
              LIMIT $4
            ),
            inserted AS (
              INSERT INTO leasedialer_assignments (lead_id, agent_email, queue, status, assigned_at, created_at, updated_at)
              SELECT id, $3, $7, 'queued', NOW(), NOW(), NOW()
              FROM eligible
              ON CONFLICT DO NOTHING
              RETURNING lead_id
            )
            SELECT i.lead_id::text, e.created_at::text, e.id::text AS source_id
            FROM eligible e
            LEFT JOIN inserted i ON i.lead_id = e.id
            ORDER BY e.created_at DESC NULLS LAST, e.id DESC
          `,
          [market, state, email, Math.max(DIRECT_ASSIGN_PAGE_SIZE, Math.min(DIRECT_ASSIGN_PAGE_SIZE * 3, remaining * 3)), cursorCreatedAt, cursorId, QUEUE],
        ).catch((error) => {
          console.warn("[LEASE_AUTO] direct masterlead page failed", { email, market, state, page, error: error?.message || String(error) });
          return { rows: [] };
        });

        if (result.rows.length === 0) break;
        const last = result.rows[result.rows.length - 1];
        cursorCreatedAt = last.created_at;
        cursorId = Number(last.source_id);
        const insertedThisPage = result.rows.filter((row) => row.lead_id).length;
        insertedTotal += insertedThisPage;
        if (result.rows.length < DIRECT_ASSIGN_PAGE_SIZE || insertedThisPage >= remaining) break;
      }
      if (insertedTotal >= needed) break;
    }
    if (insertedTotal >= needed) break;
  }
  return insertedTotal;
}

async function warmAgent(profile: AgentProfile): Promise<number> {
  const email = normalizeEmail(profile.agent_email);
  const current = await countAgentCallable(email).catch(() => 0);
  if (current >= AGENT_TARGET) {
    await syncAgentClientCount(email, current);
    return 0;
  }

  const customerRouting = await resolveCustomerRoutingProfile(profile);
  const markets = customerRouting.markets;
  const states = customerRouting.states.filter((state) => isStateInsideCallingWindow(state));
  if (markets.length === 0 || states.length === 0) return 0;

  const needed = Math.max(0, AGENT_TARGET - current);
  const fromSource = await assignDirectFromMasterlead(email, markets, states, needed);
  const after = await countAgentCallable(email).catch(() => current + fromSource);
  await syncAgentClientCount(email, after);
  return fromSource;
}

async function recycleCallableMasterleadRows(): Promise<number> {
  const result = await pool.query(
    `
      WITH candidates AS (
        SELECT ml.id
        FROM masterlead ml
        WHERE COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('called', 'call', 'no_answer', 'no answer', 'no_answer_vm', 'voicemail')
          AND COALESCE(lower(ml.currently_calling::text), '') NOT IN ('true', '1', 'yes', 'y')
          AND COALESCE(lower(ml.dnc::text), '') NOT IN ('true', '1', 'yes', 'y')
          AND COALESCE(lower(ml.aointel::text), '') NOT IN ('true', '1', 'yes', 'y')
          AND NOT (
            lower(COALESCE(ml.taalk_market::text, '')) LIKE '%plus%'
            OR lower(COALESCE(ml.market::text, '')) LIKE '%plus%'
          )
          AND COALESCE(ml.updated_at, ml.last_contacted, ml.assigned_date, ml.created_at, NOW()) <= NOW() - ($2::int * INTERVAL '1 millisecond')
        ORDER BY COALESCE(ml.updated_at, ml.last_contacted, ml.assigned_date, ml.created_at) ASC NULLS FIRST, ml.id ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE masterlead ml
      SET previous_cn_email = COALESCE(NULLIF(ml.cn_email, ''), ml.previous_cn_email),
          last_assigned_date = NOW(),
          cn_email = NULL,
          assigned_date = NULL,
          cnresolution = 'pending',
          updated_at = NOW()
      FROM candidates c
      WHERE ml.id = c.id
      RETURNING ml.id
    `,
    [RECYCLE_BATCH_SIZE, RECYCLE_AFTER_MS],
  ).catch((error) => {
    console.warn("[LEASE_AUTO] recycle masterlead failed", { error: error?.message || String(error) });
    return { rowCount: 0 };
  });
  return result.rowCount || 0;
}

let lastResyncAt = 0;
const RESYNC_INTERVAL_MS = 3 * 60_000; // only run once every 3 minutes
const RESYNC_MAX_PER_PASS = 3; // max 3 agents per pass to avoid DB pile-up

async function resyncStaleClients(profiles: AgentProfile[]): Promise<number> {
  // Throttle: only run once every 3 minutes
  if (Date.now() - lastResyncAt < RESYNC_INTERVAL_MS) return 0;

  const stale = profiles.filter((p) => Number(p.local_leased_lead_count || 0) === 0);
  if (stale.length === 0) return 0;

  const emails = stale.map((p) => p.agent_email);
  const { rows } = await pool.query<{ agent_email: string }>(
    `SELECT DISTINCT agent_email FROM leasedialer_assignments
     WHERE status = 'queued' AND agent_email = ANY($1)
     LIMIT $2`,
    [emails, RESYNC_MAX_PER_PASS],
  );
  const needsSync = rows.map((r) => r.agent_email.toLowerCase());
  if (needsSync.length === 0) return 0;

  lastResyncAt = Date.now();
  const BASE_URL = process.env.AOIRAIL_INTERNAL_URL || "https://aoirail-connect-production.up.railway.app";
  let synced = 0;
  for (const email of needsSync) {
    try {
      const res = await fetch(`${BASE_URL}/api/leasedialer/sync?userEmail=${encodeURIComponent(email)}`, {
        headers: { "x-user-email": email },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        synced++;
        console.error("[LEASE_AUTO] resync stale client", { agentEmail: email });
      }
      // Small delay between each to avoid hammering DB
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      // non-blocking
    }
  }
  return synced;
}

async function runAutomationOnce(): Promise<void> {
  if (running) return;
  running = true;
  const startedAt = Date.now();
  try {
    const [profiles, allProfiles] = await Promise.all([getActiveProfiles(), getAllRoutingProfiles()]);
    const recycled = await recycleCallableMasterleadRows();
    let agentsWarmed = 0;
    let assigned = 0;
    for (const profile of profiles.slice(0, MAX_AGENT_WARMS_PER_LOOP)) {
      const count = await warmAgent(profile).catch((error) => {
        console.warn("[LEASE_AUTO] warm agent failed", {
          agentEmail: profile.agent_email,
          error: error?.message || String(error),
        });
        return 0;
      });
      if (count > 0) agentsWarmed += 1;
      assigned += count;
    }

    const resynced = await resyncStaleClients(profiles).catch((err) => {
      console.warn("[LEASE_AUTO] resync stale clients failed", err?.message || err);
      return 0;
    });

    console.error("[LEASE_AUTO] pass complete", {
      activeProfiles: profiles.length,
      mode: "direct_masterlead_topoff",
      recycled,
      agentsWarmed,
      assigned,
      resynced,
      elapsedMs: Date.now() - startedAt,
    });
  } finally {
    running = false;
  }
}

export function startLeasedialerAutomationWorker(): void {
  if (started) return;
  if (process.env.LEASEDIALER_AUTOMATION_ENABLED === "false") {
    console.error("[LEASE_AUTO] disabled");
    return;
  }
  started = true;
  console.error("[LEASE_AUTO] starting", {
    loopMs: LOOP_MS,
    poolTarget: POOL_TARGET,
    agentTarget: AGENT_TARGET,
    agentRefillThreshold: AGENT_REFILL_THRESHOLD,
  });
  setTimeout(() => void runAutomationOnce().catch((error) => console.warn("[LEASE_AUTO] startup failed", error?.message || error)), 10_000).unref?.();
  const timer = setInterval(() => {
    void runAutomationOnce().catch((error) => console.warn("[LEASE_AUTO] pass failed", error?.message || error));
  }, LOOP_MS);
  timer.unref?.();
}
