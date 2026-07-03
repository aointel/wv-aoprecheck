import { dispositionWritePool, leaseDialerPool as pool } from "./db";
import { supabaseAdmin } from "./supabase";
import { computeFlowWeighting } from "./flow-weighting";
import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "./hardcoded-config";

type QueueType = "hotlead" | "plus" | "my-leads" | string;

const LEASEDIALER_CLIENT_BUFFER_LEADS = Number(process.env.LEASEDIALER_CLIENT_BUFFER_LEADS || 20);
const LEASEDIALER_TARGET_QUEUED_LEADS = Number(process.env.LEASEDIALER_TARGET_QUEUED_LEADS || 20);
const LEASEDIALER_REFILL_THRESHOLD = Number(process.env.LEASEDIALER_REFILL_THRESHOLD || 8);
const LEASEDIALER_ACTIVE_LOCK_MS = 60 * 60 * 1000;
const ROUTING_PROFILE_SYNC_INTERVAL_MS = Number(process.env.ROUTING_PROFILE_SYNC_INTERVAL_MS || 5 * 60 * 1000);
const ROUTING_PROFILE_SYNC_LOCK_ID = 6096048379;
const LEASEDIALER_PRELOADER_INTERVAL_MS = 60 * 1000;
const LEASEDIALER_PRELOADER_BATCH_SIZE = 10;
const LEASEDIALER_PRELOADER_LOCK_ID = 6096048380;
const LEASEDIALER_PRELOADER_PRE_CLEANUP_BATCH_SIZE = Number(process.env.LEASEDIALER_PRELOADER_PRE_CLEANUP_BATCH_SIZE || 500);
const LEASEDIALER_POOL_TARGET_PER_BUCKET = 500;
const LEASEDIALER_POOL_LOCK_ID = 6096048381;
const LEASEDIALER_ACTIVE_AGENT_HEARTBEAT_MS = 10 * 60 * 1000;
const LEASEDIALER_JOB_LOCK_TTL_MS = 10 * 60 * 1000;
const LEASEDIALER_SWEEP_INTERVAL_MS = Number(process.env.LEASEDIALER_SWEEP_INTERVAL_MS || 30 * 60 * 1000);
const LEASEDIALER_SWEEP_STALE_MINUTES = Number(process.env.LEASEDIALER_SWEEP_STALE_MINUTES || 20);
const LEASEDIALER_SWEEP_BATCH_SIZE = Number(process.env.LEASEDIALER_SWEEP_BATCH_SIZE || 1000);
const LEASEDIALER_SWEEP_MAX_PASSES = Number(process.env.LEASEDIALER_SWEEP_MAX_PASSES || 10);
const LEASEDIALER_SWEEP_LOCK_ID = 6096048382;
const LEASEDIALER_NO_DIAL_RECLAIM_MINUTES = Number(process.env.LEASEDIALER_NO_DIAL_RECLAIM_MINUTES || 60);
const LEASEDIALER_ORPHAN_OWNER_CLEANUP_BATCH_SIZE = Number(process.env.LEASEDIALER_ORPHAN_OWNER_CLEANUP_BATCH_SIZE || 500);
const LEASEDIALER_OWNER_DRIFT_ALERT_THRESHOLD = Number(process.env.LEASEDIALER_OWNER_DRIFT_ALERT_THRESHOLD || 0);
const LEASEDIALER_DIRECT_ASSIGN_PAGE_SIZE = Number(process.env.LEASEDIALER_DIRECT_ASSIGN_PAGE_SIZE || 50);
const LEASEDIALER_DIRECT_ASSIGN_MAX_PAGES_PER_STATE = Number(process.env.LEASEDIALER_DIRECT_ASSIGN_MAX_PAGES_PER_STATE || 200);
const LEASEDIALER_NARROW_STATE_COUNT_MAX = Number(process.env.LEASEDIALER_NARROW_STATE_COUNT_MAX || 5);
// Keep weighting consistent with campaign-manager auto-manager logic:
// state capacity is meaningful only when at least N licensed/eligible agents cover the state.
const LEASEDIALER_MIN_LICENSED_AGENTS_PER_STATE = Number(process.env.LEASEDIALER_MIN_LICENSED_AGENTS_PER_STATE || 2);
const LEASEDIALER_FAILED_PHONE_COOLDOWN_MINUTES = Number(process.env.LEASEDIALER_FAILED_PHONE_COOLDOWN_MINUTES || 120);
const LEASEDIALER_RECENT_ANY_CALL_BLOCK_MINUTES = Number(process.env.LEASEDIALER_RECENT_ANY_CALL_BLOCK_MINUTES || 1440);
const LEASEDIALER_MAX_CONCURRENT_REFILLS = Number(process.env.LEASEDIALER_MAX_CONCURRENT_REFILLS || 5);
const LEASEDIALER_PRIORITY_CACHE_MS = Number(process.env.LEASEDIALER_PRIORITY_CACHE_MS || 30_000);

// Cache buildMarketStatePriorityForAgentFill results by market+state+queue key
// Agents with identical routing share one DB query instead of N separate queries
const marketStatePriorityCache = new Map<string, { result: MarketStatePriority[]; ts: number }>();
const marketStatePriorityInflight = new Map<string, Promise<MarketStatePriority[]>>();

// --- Concurrency-limited refill queue ---
// Prevents thundering herd: all agents queue up, max N run at once
type RefillJob = { agentEmail: string; queue: string; resolve: () => void };
const refillQueue: RefillJob[] = [];
let activeRefillCount = 0;

function drainRefillQueue(): void {
  while (activeRefillCount < LEASEDIALER_MAX_CONCURRENT_REFILLS && refillQueue.length > 0) {
    const job = refillQueue.shift()!;
    activeRefillCount++;
    job.resolve();
  }
}

async function queuedRefill(agentEmail: string, queue: string, fn: () => Promise<void>): Promise<void> {
  await new Promise<void>((resolve) => {
    refillQueue.push({ agentEmail, queue, resolve });
    drainRefillQueue();
  });
  try {
    await fn();
  } finally {
    activeRefillCount--;
    drainRefillQueue();
  }
}

const GLOBE_CALLABLE_MAX_AGE_INTERVAL_SQL = `
  (
    lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) NOT LIKE '%globe%'
    OR (ml.created_at IS NOT NULL AND ml.created_at >= NOW() - INTERVAL '6 months')
  )
`;
const backgroundRefills = new Set<string>();
const backgroundRefillLastRequestedAt = new Map<string, number>();
let routingProfileSyncTimer: ReturnType<typeof setInterval> | null = null;
let leasePreloaderTimer: ReturnType<typeof setInterval> | null = null;
let leasePreloaderRunning = false;
let leasePreloaderConsecutiveStallPasses = 0;
let jobLockSchemaEnsured = false;
let jobLockSchemaEnsurePromise: Promise<void> | null = null;
let eligiblePoolSchemaEnsured = false;
let eligiblePoolSchemaEnsurePromise: Promise<void> | null = null;
let assignmentTablesEnsured = false;
let assignmentTablesEnsurePromise: Promise<void> | null = null;

type MarketStatePriority = {
  market: string;
  state: string;
  servedCallable: number;
  totalCallable: number;
  unservedCallable: number;
  eligibleActiveAgents: number;
  narrowEligibleAgents: number;
  broadBlockedForAgent: boolean;
  utilizationRatio: number;
  pressureScore: number;
  recommendedWeight: number;
};

function extractAgentEmailFromTwilioEndpoint(endpoint: unknown): string | null {
  const raw = String(endpoint || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("client:")) {
    const identity = raw.slice("client:".length).trim().toLowerCase();
    return identity.includes("@") ? identity : null;
  }
  return raw.includes("@") ? raw : null;
}

async function fetchTwilioActiveOwnerEmails(lastMinutes: number): Promise<string[]> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials missing for reclaim owner check");
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const startTimeAfter = new Date(Date.now() - Math.max(1, lastMinutes) * 60 * 1000);
  const calls = await client.calls.list({
    startTimeAfter,
    pageSize: 1000,
    limit: 20000,
  } as any);

  const ownerBySid = new Map<string, string>();
  for (const call of calls as any[]) {
    const sid = String(call?.sid || "").trim();
    if (!sid) continue;
    const owner = extractAgentEmailFromTwilioEndpoint(call?.from) || extractAgentEmailFromTwilioEndpoint(call?.to);
    if (owner) ownerBySid.set(sid, owner);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const call of calls as any[]) {
      const sid = String(call?.sid || "").trim();
      const parent = String(call?.parentCallSid || "").trim();
      if (!sid || !parent) continue;
      const sidOwner = ownerBySid.get(sid);
      const parentOwner = ownerBySid.get(parent);
      if (!sidOwner && parentOwner) {
        ownerBySid.set(sid, parentOwner);
        changed = true;
      } else if (sidOwner && !parentOwner) {
        ownerBySid.set(parent, sidOwner);
        changed = true;
      }
    }
  }

  const activeOwners = new Set<string>();
  for (const call of calls as any[]) {
    const direction = String(call?.direction || "").toLowerCase();
    if (!direction.startsWith("outbound")) continue;
    const sid = String(call?.sid || "").trim();
    const parent = String(call?.parentCallSid || "").trim();
    const owner =
      extractAgentEmailFromTwilioEndpoint(call?.from) ||
      extractAgentEmailFromTwilioEndpoint(call?.to) ||
      ownerBySid.get(sid) ||
      ownerBySid.get(parent);
    if (owner) activeOwners.add(owner);
  }

  return Array.from(activeOwners);
}

function isQueryTimeoutError(error: unknown): boolean {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return message.includes("query read timeout") || message.includes("statement timeout") || message.includes("timeout");
}

function buildFallbackPriorityFromRouting(markets: string[], states: string[]): MarketStatePriority[] {
  const rows: MarketStatePriority[] = [];
  const uniqueMarkets = Array.from(new Set(markets.map(normalizeMarketName).filter(Boolean)));
  const uniqueStates = Array.from(new Set(states.map(normalizeStateCode).filter((s) => /^[A-Z]{2}$/.test(s))));
  for (const market of uniqueMarkets) {
    for (const state of uniqueStates) {
      rows.push({
        market,
        state,
        servedCallable: 0,
        totalCallable: 0,
        unservedCallable: 0,
        eligibleActiveAgents: 0,
        narrowEligibleAgents: 0,
        broadBlockedForAgent: false,
        utilizationRatio: 0,
        pressureScore: 0,
        recommendedWeight: 0,
      });
    }
  }
  return rows;
}

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function isWithinActiveLock(assignedAt: unknown): boolean {
  const assignedMs = new Date(String(assignedAt || "")).getTime();
  return Number.isFinite(assignedMs) && Date.now() - assignedMs < LEASEDIALER_ACTIVE_LOCK_MS;
}

function parseArrayField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || "").trim()).filter(Boolean);
    }
  } catch {
    // not json, fall through
  }
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeMarketName(value: unknown): string {
  const market = String(value ?? "").trim();
  const normalized = market.toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("globe")) return "Globe Market";
  if (normalized.includes("veteran")) return "Veteran";
  return market;
}

function normalizeCustomerMarkets(value: unknown): string[] {
  return Array.from(
    new Set(
      parseArrayField(value)
        .map(normalizeMarketName)
        .filter((market) => {
          const normalized = market.toLowerCase().replace(/\s+/g, "");
          return market && normalized !== "aorecruit" && normalized !== "aovamos";
        }),
    ),
  );
}

function normalizeCustomerStates(value: unknown): string[] {
  return Array.from(
    new Set(
      parseArrayField(value)
        .map(normalizeStateCode)
        .filter((state) => Object.prototype.hasOwnProperty.call(STATE_TIMEZONES, state)),
    ),
  );
}

function normalizeStateCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

function isTruthyDbValue(value: unknown): boolean {
  return ["true", "1", "yes", "y"].includes(String(value ?? "").trim().toLowerCase());
}

function isBlankDbValue(value: unknown): boolean {
  return String(value ?? "").trim() === "";
}

async function ensureLeaseDialerJobLockSchema(): Promise<void> {
  if (jobLockSchemaEnsured) return;
  if (jobLockSchemaEnsurePromise) return jobLockSchemaEnsurePromise;

  jobLockSchemaEnsurePromise = pool.query(`
    CREATE TABLE IF NOT EXISTS leasedialer_job_locks (
      lock_name TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `).then(() => {
    jobLockSchemaEnsured = true;
  }).catch((error) => {
    jobLockSchemaEnsurePromise = null;
    throw error;
  });

  return jobLockSchemaEnsurePromise;
}

async function tryAcquireLeaseDialerJobLock(lockName: string, ttlMs = LEASEDIALER_JOB_LOCK_TTL_MS): Promise<string | null> {
  await ensureLeaseDialerJobLockSchema();
  const owner = `${process.env.RAILWAY_SERVICE_NAME || "local"}:${process.pid}:${Date.now()}`;
  const result = await pool.query<{ owner: string }>(
    `
      INSERT INTO leasedialer_job_locks (lock_name, owner, expires_at, updated_at)
      VALUES ($1, $2, NOW() + ($3::int * INTERVAL '1 millisecond'), NOW())
      ON CONFLICT (lock_name)
      DO UPDATE SET
        owner = EXCLUDED.owner,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
      WHERE leasedialer_job_locks.expires_at < NOW()
      RETURNING owner
    `,
    [lockName, owner, ttlMs],
  );
  return result.rowCount ? owner : null;
}

async function releaseLeaseDialerJobLock(lockName: string, owner: string | null): Promise<void> {
  if (!owner) return;
  await pool.query(
    `
      DELETE FROM leasedialer_job_locks
      WHERE lock_name = $1
        AND owner = $2
    `,
    [lockName, owner],
  ).catch(() => undefined);
}

const STATE_TIMEZONES: Record<string, string> = {
  CT: "America/New_York",
  DC: "America/New_York",
  DE: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  IN: "America/Indiana/Indianapolis",
  MA: "America/New_York",
  MD: "America/New_York",
  ME: "America/New_York",
  MI: "America/New_York",
  NC: "America/New_York",
  NH: "America/New_York",
  NJ: "America/New_York",
  NY: "America/New_York",
  OH: "America/New_York",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  VA: "America/New_York",
  VT: "America/New_York",
  WV: "America/New_York",
  AL: "America/Chicago",
  AR: "America/Chicago",
  IA: "America/Chicago",
  IL: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/Chicago",
  LA: "America/Chicago",
  MN: "America/Chicago",
  MO: "America/Chicago",
  MS: "America/Chicago",
  ND: "America/Chicago",
  NE: "America/Chicago",
  OK: "America/Chicago",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  WI: "America/Chicago",
  AZ: "America/Phoenix",
  CO: "America/Denver",
  ID: "America/Denver",
  MT: "America/Denver",
  NM: "America/Denver",
  UT: "America/Denver",
  WY: "America/Denver",
  CA: "America/Los_Angeles",
  NV: "America/Los_Angeles",
  OR: "America/Los_Angeles",
  WA: "America/Los_Angeles",
  AK: "America/Anchorage",
  HI: "Pacific/Honolulu",
  AB: "America/Edmonton",
  BC: "America/Vancouver",
  MB: "America/Winnipeg",
  NB: "America/Moncton",
  NL: "America/St_Johns",
  NS: "America/Halifax",
  ON: "America/Toronto",
  SK: "America/Regina",
};

function isLeadInsideCallingWindow(lead: Record<string, unknown>): boolean {
  const state = normalizeStateCode(lead.taalk_state || lead.state);
  return isStateInsideCallingWindow(state);
}

function isStateInsideCallingWindow(state: string): boolean {
  const timezone = STATE_TIMEZONES[normalizeStateCode(state)];
  if (!timezone) return false;

  try {
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
  } catch {
    return false;
  }
}

function getStatesOutsideCallingWindow(states: string[]): string[] {
  return Array.from(
    new Set(
      states
        .map(normalizeStateCode)
        .filter((state) => state && !isStateInsideCallingWindow(state)),
    ),
  );
}

function isLeadCallableForLease(
  lead: Record<string, unknown>,
  input: { queue: string; routing: { markets: string[]; states: string[] }; reservedLeadIds: Set<number> },
): boolean {
  const id = Number(lead.id);
  if (!Number.isFinite(id) || input.reservedLeadIds.has(id)) return false;
  if (!isBlankDbValue(lead.cn_email)) return false;
  const resolution = String(lead.cnresolution ?? "pending").trim().toLowerCase();
  if (!["pending", "new", "", "null"].includes(resolution)) return false;
  if (isGlobeLeadOverAgeLimit(lead)) return false;
  if (!isLeadInsideCallingWindow(lead)) return false;

  const market = String(lead.taalk_market || lead.market || "").trim();
  const state = normalizeStateCode(lead.taalk_state || lead.state);
  if (!input.routing.markets.includes(market)) return false;
  if (!input.routing.states.includes(state)) return false;

  const isPlusLead =
    String(lead.taalk_market || "").toLowerCase().includes("plus") ||
    String(lead.market || "").toLowerCase().includes("plus");
  return input.queue === "plus" ? isPlusLead : !isPlusLead;
}

function isGlobeLeadOverAgeLimit(lead: Record<string, unknown>): boolean {
  const market = String(lead.taalk_market || lead.market || "").toLowerCase();
  if (!market.includes("globe")) return false;
  const createdAtRaw = lead.created_at;
  if (!createdAtRaw) return true;
  const createdAtMs = Date.parse(String(createdAtRaw));
  if (!Number.isFinite(createdAtMs)) return true;
  return createdAtMs < Date.now() - 1000 * 60 * 60 * 24 * 30 * 6;
}

function isActiveLeaseLeadStillCallable(lead: Record<string, unknown>, agentEmail: string, queue: string): boolean {
  if (!lead) return false;
  const leadOwnerEmail = normalizeEmail(String(lead.cn_email || ""));
  if (leadOwnerEmail && leadOwnerEmail !== normalizeEmail(agentEmail)) return false;
  const resolution = String(lead.cnresolution ?? "pending").trim().toLowerCase();
  if (!["pending", "new", "", "null"].includes(resolution)) return false;
  if (isGlobeLeadOverAgeLimit(lead)) return false;
  if (!isLeadInsideCallingWindow(lead)) return false;

  const isPlusLead =
    String(lead.taalk_market || "").toLowerCase().includes("plus") ||
    String(lead.market || "").toLowerCase().includes("plus");
  return queue === "plus" ? isPlusLead : !isPlusLead;
}

async function expireInvalidLeaseAssignmentsForAgent(
  client: Awaited<ReturnType<typeof pool.connect>>,
  input: { agentEmail: string; queue: string; routing?: { markets?: string[]; states?: string[] } },
): Promise<number> {
  const routingMarkets = Array.isArray(input.routing?.markets) ? input.routing.markets : [];
  const routingStates = Array.isArray(input.routing?.states) ? input.routing.states : [];
  const callableMarkets = Array.from(new Set(routingMarkets.map(normalizeMarketName).filter(Boolean)));
  const callableStates = Array.from(new Set(routingStates.map(normalizeStateCode).filter(Boolean)));
  const result = await client.query<{ released_count: number }>(
    `
      WITH released AS (
        UPDATE leasedialer_assignments la
        SET status = 'completed',
            released_at = NOW(),
            release_reason = 'lease_lead_not_callable',
            updated_at = NOW()
        FROM masterlead ml
        WHERE ml.id = la.lead_id
          AND la.agent_email = $1
          AND la.queue = $2
          AND la.status IN ('queued', 'active')
          AND (
            COALESCE(btrim(ml.taalk_lead_id::text), '') = ''
            OR
            lower(trim(coalesce(ml.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
            OR (
              COALESCE(btrim(ml.cn_email), '') <> ''
              AND lower(btrim(ml.cn_email)) <> $1
            )
            OR (
              array_length($3::text[], 1) IS NOT NULL
              AND (
                CASE
                  WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
                  WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
                  ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
                END
              ) <> ALL($3::text[])
            )
            OR (
              array_length($4::text[], 1) IS NOT NULL
              AND (
                COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''))
                IS NULL
                OR COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) <> ALL($4::text[])
              )
            )
            OR (
              lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%'
              AND (ml.created_at IS NULL OR ml.created_at < NOW() - INTERVAL '6 months')
            )
          )
        RETURNING la.lead_id
      ),
      cleared_owner AS (
        UPDATE masterlead ml
        SET cn_email = NULL,
            assigned_date = NULL,
            updated_at = NOW()
        FROM released r
        WHERE ml.id = r.lead_id
          AND lower(trim(coalesce(ml.cn_email, ''))) = $1
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        RETURNING ml.id
      )
      SELECT COUNT(*)::int AS released_count
      FROM released
    `,
    [input.agentEmail, input.queue, callableMarkets, callableStates],
  );
  return Number(result.rows[0]?.released_count || 0);
}

async function releaseOutsideWindowLeaseAssignmentsForAgent(
  client: Awaited<ReturnType<typeof pool.connect>>,
  input: { agentEmail: string; queue: string; states: string[] },
): Promise<number> {
  const outsideWindowStates = getStatesOutsideCallingWindow(input.states);
  if (outsideWindowStates.length === 0) return 0;

  const result = await client.query<{ released_count: number }>(
    `
      WITH released AS (
        UPDATE leasedialer_assignments la
        SET status = 'released',
            released_at = NOW(),
            release_reason = 'outside_calling_window',
            updated_at = NOW()
        FROM masterlead ml
        WHERE ml.id = la.lead_id
          AND la.agent_email = $1
          AND la.queue = $2
          AND la.status IN ('queued', 'active')
          AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($3::text[])
        RETURNING la.lead_id
      ),
      cleared_owner AS (
        UPDATE masterlead ml
        SET cn_email = NULL,
            assigned_date = NULL,
            updated_at = NOW()
        FROM released r
        WHERE ml.id = r.lead_id
          AND lower(trim(coalesce(ml.cn_email, ''))) = $1
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        RETURNING ml.id
      )
      SELECT COUNT(*)::int AS released_count
      FROM released
    `,
    [input.agentEmail, input.queue, outsideWindowStates],
  );
  return Number(result.rows[0]?.released_count || 0);
}

async function resolveRoutingProfile(agentEmail: string): Promise<{ markets: string[]; states: string[] }> {
  const normalizedEmail = normalizeEmail(agentEmail);

  if (!supabaseAdmin) {
    return { markets: [], states: [] };
  }

  try {
    const { data: customerRow, error } = await supabaseAdmin
      .from("customers")
      .select("market, secondary_market, states")
      .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    // Combine primary market array + secondary_market field into one deduped list
    const primaryMarkets = normalizeCustomerMarkets(customerRow?.market);
    const secondaryMarkets = normalizeCustomerMarkets(customerRow?.secondary_market);
    const customerMarkets = Array.from(new Set([...primaryMarkets, ...secondaryMarkets]));
    const customerStates = normalizeCustomerStates(customerRow?.states);

    if (customerMarkets.length > 0 && customerStates.length > 0) {
      // Fire-and-forget cache write — don't block routing on pool checkout
      void pool.query(
        `
          INSERT INTO agent_routing_profiles (agent_email, markets, states, source, updated_at)
          VALUES ($1, $2::text[], $3::text[], 'customers_realtime', NOW())
          ON CONFLICT (agent_email)
          DO UPDATE SET
            markets = EXCLUDED.markets,
            states = EXCLUDED.states,
            source = EXCLUDED.source,
            updated_at = NOW()
        `,
        [normalizedEmail, customerMarkets, customerStates],
      ).catch(() => undefined);

      return { markets: customerMarkets, states: customerStates };
    }
  } catch (error: any) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes('relation "customers" does not exist')) {
      throw error;
    }
  }

  return { markets: [], states: [] };
}

export async function ensureLeaseDialerAssignmentTables(): Promise<void> {
  if (process.env.SKIP_LEASE_SCHEMA_ENSURE === "1") {
    assignmentTablesEnsured = true;
    return;
  }
  if (assignmentTablesEnsured) return;
  if (assignmentTablesEnsurePromise) return assignmentTablesEnsurePromise;

  assignmentTablesEnsurePromise = (async () => {
  // Ensure agent_routing_profiles exists before any routing queries run
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_routing_profiles (
      agent_email TEXT PRIMARY KEY,
      markets TEXT[] NOT NULL DEFAULT '{}',
      states TEXT[] NOT NULL DEFAULT '{}',
      source TEXT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await dispositionWritePool.query(`
    CREATE TABLE IF NOT EXISTS leasedialer_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id BIGINT NOT NULL,
      agent_email TEXT NOT NULL,
      queue TEXT NOT NULL DEFAULT 'hotlead',
      status TEXT NOT NULL DEFAULT 'active',
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      released_at TIMESTAMPTZ NULL,
      release_reason TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT leasedialer_assignments_status_check CHECK (status IN ('queued', 'active', 'completed', 'released', 'expired'))
    );
  `);

  // Never drop/recreate constraints in runtime startup path.
  // Adding only when missing avoids repeated ACCESS EXCLUSIVE lock pressure.
  await dispositionWritePool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conname = 'leasedialer_assignments_status_check'
          AND c.conrelid = 'leasedialer_assignments'::regclass
      ) THEN
        ALTER TABLE leasedialer_assignments
          ADD CONSTRAINT leasedialer_assignments_status_check
          CHECK (status IN ('queued', 'active', 'completed', 'released', 'expired'));
      END IF;
    END
    $$;
  `);

  await dispositionWritePool.query(`
    CREATE OR REPLACE FUNCTION leasedialer_clear_masterlead_owner_on_release()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF OLD.status IN ('queued', 'active') AND NEW.status NOT IN ('queued', 'active') THEN
        UPDATE masterlead ml
        SET cn_email = NULL,
            updated_at = NOW()
        WHERE ml.id = NEW.lead_id
          AND lower(trim(coalesce(ml.cn_email, ''))) = lower(OLD.agent_email)
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null');
      END IF;
      RETURN NEW;
    END;
    $$;
  `);

  // Same rule for trigger setup: create only if absent, never drop/recreate at runtime.
  await dispositionWritePool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger t
        WHERE t.tgname = 'trg_leasedialer_clear_owner_on_release'
          AND t.tgrelid = 'leasedialer_assignments'::regclass
      ) THEN
        CREATE TRIGGER trg_leasedialer_clear_owner_on_release
        AFTER UPDATE OF status ON leasedialer_assignments
        FOR EACH ROW
        EXECUTE FUNCTION leasedialer_clear_masterlead_owner_on_release();
      END IF;
    END
    $$;
  `);

  // Do not create indexes from app startup. Production indexes are created
  // concurrently by migration/ops scripts to avoid deploy-time relation locks.
  assignmentTablesEnsured = true;
  })().catch((error) => {
    assignmentTablesEnsurePromise = null;
    throw error;
  });

  return assignmentTablesEnsurePromise;
}

export async function syncAgentRoutingProfilesFromCustomers(): Promise<{
  scanned: number;
  updated: number;
  skippedAorecruitOnly: number;
  skippedMissingData: number;
}> {
  if (!supabaseAdmin) {
    console.warn("⚠️ Customer routing profile sync skipped: Supabase admin client not configured");
    return { scanned: 0, updated: 0, skippedAorecruitOnly: 0, skippedMissingData: 0 };
  }

  await ensureLeaseDialerAssignmentTables();

  const lockOwner = await tryAcquireLeaseDialerJobLock(`routing_profile_sync:${ROUTING_PROFILE_SYNC_LOCK_ID}`, 30 * 60 * 1000);
  if (!lockOwner) {
    return { scanned: 0, updated: 0, skippedAorecruitOnly: 0, skippedMissingData: 0 };
  }

  let scanned = 0;
  let updated = 0;
  let skippedAorecruitOnly = 0;
  let skippedMissingData = 0;

  try {
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const to = from + pageSize - 1;
      const { data, error } = await supabaseAdmin
        .from("customers")
        .select("company_email, personal_email, market, secondary_market, states")
        .range(from, to);

      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) break;

      for (const row of rows as Array<Record<string, unknown>>) {
        scanned += 1;
        const primaryMarkets = normalizeCustomerMarkets(row.market);
        const secondaryMarkets = normalizeCustomerMarkets((row as any).secondary_market);
        const markets = Array.from(new Set([...primaryMarkets, ...secondaryMarkets]));
        const rawMarkets = parseArrayField(row.market);
        const states = normalizeCustomerStates(row.states);
        const emails = Array.from(
          new Set(
            [row.company_email, row.personal_email]
              .map((email) => normalizeEmail(String(email || "")))
              .filter((email) => email.includes("@")),
          ),
        );

        if (markets.length === 0 && rawMarkets.some((m) => m.toLowerCase().replace(/\s+/g, "") === "aorecruit")) {
          skippedAorecruitOnly += 1;
          continue;
        }

        if (emails.length === 0 || markets.length === 0 || states.length === 0) {
          skippedMissingData += 1;
          continue;
        }

        for (const email of emails) {
          await pool.query(
            `
              INSERT INTO agent_routing_profiles (agent_email, markets, states, source, updated_at)
              VALUES ($1, $2::text[], $3::text[], 'customers_hourly', NOW())
              ON CONFLICT (agent_email)
              DO UPDATE SET
                markets = EXCLUDED.markets,
                states = EXCLUDED.states,
                source = EXCLUDED.source,
                updated_at = NOW()
            `,
            [email, markets, states],
          );
          updated += 1;
        }
      }

      if (rows.length < pageSize) break;
    }

    console.error("[LEASE] customer routing profile sync complete", {
      scanned,
      updated,
      skippedAorecruitOnly,
      skippedMissingData,
    });

    return { scanned, updated, skippedAorecruitOnly, skippedMissingData };
  } finally {
    await releaseLeaseDialerJobLock(`routing_profile_sync:${ROUTING_PROFILE_SYNC_LOCK_ID}`, lockOwner);
  }
}

export function startCustomerRoutingProfileSyncScheduler(): void {
  if (routingProfileSyncTimer) return;

  const run = () => {
    void syncAgentRoutingProfilesFromCustomers().catch((error: any) => {
      console.error("[LEASE] customer routing profile sync failed:", error?.message || error);
    });
  };

  setTimeout(run, 30_000).unref?.();
  routingProfileSyncTimer = setInterval(run, ROUTING_PROFILE_SYNC_INTERVAL_MS);
  routingProfileSyncTimer.unref?.();
  console.error("[LEASE] customer routing profile sync scheduler started", {
    intervalMs: ROUTING_PROFILE_SYNC_INTERVAL_MS,
    sourceOfTruth: "supabase.customers",
  });
}

async function fetchActiveCcproAgentEmails(): Promise<string[]> {
  // Source of truth: leasedialer_client_status on Neon.
  // updated_at is set every heartbeat — any agent who has sent a heartbeat recently is online.
  try {
    const result = await pool.query<{ agent_email: string }>(
      `SELECT DISTINCT lower(agent_email) AS agent_email
       FROM leasedialer_client_status
       WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 millisecond')`,
      [LEASEDIALER_ACTIVE_AGENT_HEARTBEAT_MS],
    );
    if (result.rows.length > 0) {
      return result.rows.map((r) => normalizeEmail(r.agent_email)).filter((e) => e.includes("@"));
    }
  } catch (e: any) {
    console.warn("[LEASE_PRELOADER] leasedialer_client_status lookup failed:", e?.message);
  }
  return [];
}

async function buildMarketStatePriorityForAgentFill(
  client: Awaited<ReturnType<typeof pool.connect>>,
  input: {
    agentEmail: string;
    queue: string;
    markets: string[];
    states: string[];
  },
): Promise<MarketStatePriority[]> {
  const markets = Array.from(new Set(input.markets.map(normalizeMarketName).filter(Boolean)));
  const states = Array.from(new Set(input.states.map(normalizeStateCode).filter((state) => /^[A-Z]{2}$/.test(state))));

  // Cache key: same market+queue combo shares one DB query for up to 30s
  // States vary per agent but market-level stats (served/total callable) are shared
  const cacheKey = `${input.queue}:${[...markets].sort().join(',')}`;
  const cached = marketStatePriorityCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < LEASEDIALER_PRIORITY_CACHE_MS) {
    return cached.result;
  }
  // Deduplicate: if same key is already in-flight, wait for it
  const inflight = marketStatePriorityInflight.get(cacheKey);
  if (inflight) return inflight;

  const promise = buildMarketStatePriorityForAgentFillDirect(client, input, markets, states)
    .then((result) => {
      marketStatePriorityCache.set(cacheKey, { result, ts: Date.now() });
      marketStatePriorityInflight.delete(cacheKey);
      return result;
    })
    .catch((err) => {
      marketStatePriorityInflight.delete(cacheKey);
      throw err;
    });
  marketStatePriorityInflight.set(cacheKey, promise);
  return promise;
}

async function buildMarketStatePriorityForAgentFillDirect(
  client: Awaited<ReturnType<typeof pool.connect>>,
  input: {
    agentEmail: string;
    queue: string;
    markets: string[];
    states: string[];
  },
  markets: string[],
  states: string[],
): Promise<MarketStatePriority[]> {
  if (markets.length === 0 || states.length === 0) return [];

  const targetAgentStateCount = states.length;
  const targetAgentIsBroad = targetAgentStateCount > LEASEDIALER_NARROW_STATE_COUNT_MAX;
  const recentStatusMinutes = Math.max(
    10,
    Math.min(240, Number(process.env.LEASEDIALER_ACTIVE_STATUS_RECENT_MINUTES || 30)),
  );

  // Set a generous timeout for this heavy aggregation query
  await client.query("SET LOCAL statement_timeout = '8000ms'");
  const metrics = await client.query<{
    market: string;
    state: string;
    served_callable: number;
    total_callable: number;
    eligible_active_agents: number;
    narrow_eligible_agents: number;
  }>(
    `
      WITH active_agents AS (
        SELECT DISTINCT lower(agent_email) AS agent_email
        FROM leasedialer_client_status
        WHERE updated_at >= NOW() - ($4::int * INTERVAL '1 minute')
        UNION
        SELECT lower($1::text)
      ),
      -- markets/states come directly from Supabase customers (passed as $2/$3), no routing profiles table
      eligible AS (
        SELECT
          lower($1::text) AS agent_email,
          mk AS market,
          st AS state,
          array_length($3::text[], 1) AS state_count
        FROM unnest($2::text[]) mk
        CROSS JOIN unnest($3::text[]) st
      ),
      served AS (
        SELECT
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
          END AS market,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS state,
          COUNT(*)::int AS served_callable
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE la.queue = $5
          AND la.status IN ('queued', 'active')
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND ${GLOBE_CALLABLE_MAX_AGE_INTERVAL_SQL}
          AND (
            COALESCE(btrim(ml.cn_email), '') = ''
            OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
          )
          AND (
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
            END
          ) = ANY($2::text[])
          AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($3::text[])
        GROUP BY 1, 2
      ),
      total_callable AS (
        SELECT
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
          END AS market,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS state,
          COUNT(*)::int AS total_callable
        FROM masterlead ml
        WHERE lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND ${GLOBE_CALLABLE_MAX_AGE_INTERVAL_SQL}
          AND (
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
            END
          ) = ANY($2::text[])
          AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($3::text[])
        GROUP BY 1, 2
      )
      SELECT
        e.market,
        e.state,
        COALESCE(s.served_callable, 0)::int AS served_callable,
        COALESCE(tc.total_callable, 0)::int AS total_callable,
        COUNT(DISTINCT e.agent_email)::int AS eligible_active_agents,
        COUNT(DISTINCT e.agent_email) FILTER (WHERE e.state_count <= $6::int)::int AS narrow_eligible_agents
      FROM eligible e
      LEFT JOIN served s ON s.market = e.market AND s.state = e.state
      LEFT JOIN total_callable tc ON tc.market = e.market AND tc.state = e.state
      GROUP BY e.market, e.state, s.served_callable, tc.total_callable
    `,
    [input.agentEmail, markets, states, recentStatusMinutes, input.queue, LEASEDIALER_NARROW_STATE_COUNT_MAX],
  );

  return metrics.rows
    .map((row) => {
      const market = normalizeMarketName(row.market);
      const state = normalizeStateCode(row.state);
      const servedCallable = Number(row.served_callable || 0);
      const totalCallable = Number(row.total_callable || 0);
      const eligibleActiveAgents = Number(row.eligible_active_agents || 0);
      const narrowEligibleAgents = Number(row.narrow_eligible_agents || 0);
      const unservedCallable = Math.max(0, totalCallable - servedCallable);
      const utilizationRatio = totalCallable > 0 ? servedCallable / totalCallable : 0;
      const scored = computeFlowWeighting({
        callable: totalCallable,
        queued: servedCallable,
        active: servedCallable,
        activeAgents: eligibleActiveAgents,
      });
      // License-aware weighting (same principle as auto-manager):
      // prioritize states by callable load per licensed/eligible agent instead of raw lead count.
      const licensedAgentDivisor = Math.max(eligibleActiveAgents, 1);
      const callablePerLicensedAgent = totalCallable / licensedAgentDivisor;
      const unservedPerLicensedAgent = unservedCallable / licensedAgentDivisor;
      const belowCoverageThreshold = eligibleActiveAgents < LEASEDIALER_MIN_LICENSED_AGENTS_PER_STATE;
      // Higher score = fill sooner.
      // - Boost high callable-per-license buckets
      // - Penalize already-served/utilized buckets
      // - Keep some preference for zero-served buckets
      // - Down-rank states below minimum license coverage threshold
      const pressureScore =
        callablePerLicensedAgent * 6 +
        unservedPerLicensedAgent * 7 +
        unservedCallable * 0.8 -
        servedCallable * 0.9 -
        utilizationRatio * 120 -
        narrowEligibleAgents * 1.5 +
        (servedCallable === 0 && totalCallable > 0 ? 25 : 0) +
        (belowCoverageThreshold ? -60 : 0);
      // Blend inventory shape with license-aware callable pressure so queue priority
      // respects both remaining pool health and licensed-agent coverage constraints.
      const normalizedPressure = Math.min(100, Math.max(0, pressureScore));
      const licenseAwareWeight = Math.min(
        100,
        Math.max(0, scored.recommendedWeight * 0.65 + normalizedPressure * 0.35),
      );
      return {
        market,
        state,
        servedCallable,
        totalCallable,
        unservedCallable,
        eligibleActiveAgents,
        narrowEligibleAgents,
        broadBlockedForAgent: targetAgentIsBroad && narrowEligibleAgents > 0,
        utilizationRatio: scored.utilizationRatio,
        pressureScore,
        recommendedWeight: Number(licenseAwareWeight.toFixed(1)),
      };
    })
    .filter((row) => row.market && /^[A-Z]{2}$/.test(row.state))
    .sort((a, b) => {
      if (a.recommendedWeight !== b.recommendedWeight) return b.recommendedWeight - a.recommendedWeight;
      if (a.pressureScore !== b.pressureScore) return b.pressureScore - a.pressureScore;
      if (a.eligibleActiveAgents !== b.eligibleActiveAgents) return a.eligibleActiveAgents - b.eligibleActiveAgents;
      if (a.servedCallable !== b.servedCallable) return a.servedCallable - b.servedCallable;
      if (a.totalCallable !== b.totalCallable) return b.totalCallable - a.totalCallable;
      if (a.market !== b.market) return a.market.localeCompare(b.market);
      return a.state.localeCompare(b.state);
    });
}

async function ensureEligiblePoolSchema(): Promise<void> {
  if (eligiblePoolSchemaEnsured) return;
  if (eligiblePoolSchemaEnsurePromise) return eligiblePoolSchemaEnsurePromise;

  eligiblePoolSchemaEnsurePromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leasedialer_eligible_pool (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id BIGINT NOT NULL UNIQUE,
        queue TEXT NOT NULL DEFAULT 'hotlead',
        market TEXT NOT NULL,
        state TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ready',
        claimed_by_agent_email TEXT NULL,
        claimed_assignment_id UUID NULL,
        claimed_at TIMESTAMPTZ NULL,
        lead_received_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT leasedialer_eligible_pool_status_check CHECK (status IN ('ready', 'claimed', 'expired'))
      );
    `);

    await pool.query(`
      ALTER TABLE leasedialer_eligible_pool
        ADD COLUMN IF NOT EXISTS lead_received_at TIMESTAMPTZ NULL;
    `);

    // Do not create indexes from app startup. Production indexes are created
    // concurrently by migration/ops scripts to avoid deploy-time relation locks.

    eligiblePoolSchemaEnsured = true;
  })().catch((error) => {
    eligiblePoolSchemaEnsurePromise = null;
    throw error;
  });

  return eligiblePoolSchemaEnsurePromise;
}

async function warmEligiblePoolBucket(
  client: Awaited<ReturnType<typeof pool.connect>>,
  input: { queue: string; market: string; state: string; targetReady?: number },
): Promise<number> {
  const queue = String(input.queue || "hotlead").toLowerCase().trim();
  const market = String(input.market || "").trim();
  const state = normalizeStateCode(input.state);
  const targetReady = input.targetReady ?? LEASEDIALER_POOL_TARGET_PER_BUCKET;
  if (!market || !state || !isStateInsideCallingWindow(state)) return 0;

  const readyCount = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM leasedialer_eligible_pool ep
      JOIN masterlead ml ON ml.id = ep.lead_id
      WHERE ep.queue = $1
        AND ep.market = $2
        AND ep.state = $3
        AND ep.status = 'ready'
        AND COALESCE(btrim(ml.cn_email), '') = ''
        AND lower(btrim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        AND ($2 <> 'Globe Market' OR (ml.created_at IS NOT NULL AND ml.created_at >= NOW() - INTERVAL '6 months'))
        AND NOT EXISTS (
          SELECT 1
          FROM leasedialer_assignments la
          WHERE la.lead_id = ep.lead_id
            AND (la.status IN ('queued', 'active') OR la.assigned_at >= NOW() - INTERVAL '1 hour')
        )
    `,
    [queue, market, state],
  );
  const needed = Math.max(0, targetReady - Number(readyCount.rows[0]?.count || 0));
  if (needed <= 0) return 0;

  const inserted = await client.query<{ lead_id: string }>(
    `
      INSERT INTO leasedialer_eligible_pool (
        lead_id,
        queue,
        market,
        state,
        status,
        lead_received_at,
        created_at,
        updated_at
      )
      SELECT
        ml.id,
        $1,
        $2,
        upper(COALESCE(NULLIF(btrim(ml.taalk_state), ''), btrim(ml.state))),
        'ready',
        ml.created_at,
        NOW(),
        NOW()
      FROM masterlead ml
      WHERE COALESCE(btrim(ml.cn_email), '') = ''
        AND lower(btrim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        AND (
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
          END
        ) = $2
        AND upper(COALESCE(NULLIF(btrim(ml.taalk_state), ''), btrim(ml.state))) = $3
        AND ($2 <> 'Globe Market' OR (ml.created_at IS NOT NULL AND ml.created_at >= NOW() - INTERVAL '6 months'))
        AND (
          ($1 = 'plus' AND (
            lower(COALESCE(ml.taalk_market, '')) LIKE '%plus%'
            OR lower(COALESCE(ml.market, '')) LIKE '%plus%'
          ))
          OR
          ($1 <> 'plus' AND NOT (
            lower(COALESCE(ml.taalk_market, '')) LIKE '%plus%'
            OR lower(COALESCE(ml.market, '')) LIKE '%plus%'
          ))
        )
        AND NOT EXISTS (
          SELECT 1
          FROM leasedialer_eligible_pool ep
          WHERE ep.lead_id = ml.id
            AND ep.status IN ('ready', 'claimed')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM leasedialer_assignments la
          WHERE la.lead_id = ml.id
            AND (la.status IN ('queued', 'active') OR la.assigned_at >= NOW() - INTERVAL '1 hour')
        )
      ORDER BY
        ml.created_at DESC NULLS LAST,
        NULLIF(regexp_replace(coalesce(ml.taalk_lead_id::text, ''), '\\D', '', 'g'), '')::bigint DESC NULLS LAST,
        ml.id DESC
      LIMIT $4
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
      WHERE leasedialer_eligible_pool.status = 'expired'
        AND NOT EXISTS (
          SELECT 1
          FROM leasedialer_assignments la
          WHERE la.lead_id = leasedialer_eligible_pool.lead_id
            AND (la.status IN ('queued', 'active') OR la.assigned_at >= NOW() - INTERVAL '1 hour')
        )
      RETURNING lead_id::text
    `,
    [queue, market, state, needed],
  );

  return inserted.rowCount || 0;
}

async function warmEligiblePoolForRouting(
  client: Awaited<ReturnType<typeof pool.connect>>,
  input: { queue: string; routing: { markets: string[]; states: string[] } },
): Promise<number> {
  return 0;
}

async function warmEligiblePoolForSingleBucket(
  client: Awaited<ReturnType<typeof pool.connect>>,
  input: { queue: string; routing: { markets: string[]; states: string[] } },
): Promise<number> {
  return 0;
}

export async function warmEligibleLeadPoolOnce(options?: {
  queue?: string;
  bucketLimit?: number;
}): Promise<{ scanned: number; warmed: number; inserted: number; skipped: number }> {
  await ensureEligiblePoolSchema();

  const queue = String(options?.queue || "hotlead").toLowerCase().trim();
  const bucketLimit = Math.max(1, Math.min(50, Number(options?.bucketLimit || 20)));
  const lockName = `eligible_pool_fill:${LEASEDIALER_POOL_LOCK_ID}:${queue}`;
  let scanned = 0;
  let warmed = 0;
  let inserted = 0;
  let skipped = 0;

  const lockOwner = await tryAcquireLeaseDialerJobLock(lockName, LEASEDIALER_JOB_LOCK_TTL_MS);
  if (!lockOwner) return { scanned, warmed, inserted, skipped };

  try {
    // Get all active market+state routing buckets from active agents
    const buckets = await pool.query<{ market: string; state: string }>(
      `SELECT DISTINCT
        CASE
          WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(c_market), ''), ''), '\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
          WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(c_market), ''), ''), '\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
          ELSE c_market
        END AS market,
        upper(c_state) AS state
      FROM (
        SELECT unnest(string_to_array(
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
          END, ',')) AS c_market,
          unnest(ARRAY['CA', 'TX', 'FL', 'GA', 'NC', 'SC', 'VA', 'OH', 'PA', 'NY', 'IL', 'AZ', 'CO', 'WA', 'OR', 'NV', 'MO', 'TN', 'AL', 'LA']) AS c_state
        FROM generate_series(1,1)
      ) sub
      WHERE c_market IS NOT NULL AND c_market <> ''
      LIMIT $1`,
      [bucketLimit]
    ).catch(() => ({ rows: [] as { market: string; state: string }[] }));

    // Simpler: just get buckets that already exist in the pool or are needed
    const activeBuckets = await pool.query<{ market: string; state: string }>(
      `SELECT DISTINCT market, state
       FROM leasedialer_eligible_pool
       WHERE queue = $1
         AND status = 'ready'
       UNION
       SELECT DISTINCT
         CASE
           WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
           WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
           ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
         END AS market,
         upper(COALESCE(NULLIF(btrim(ml.taalk_state), ''), btrim(ml.state))) AS state
       FROM masterlead ml
       WHERE lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
         AND (ml.cn_email IS NULL OR btrim(ml.cn_email) = '')
         AND (ml.last_contacted IS NULL OR ml.last_contacted < NOW() - INTERVAL '24 hours')
         AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
       GROUP BY 1, 2
       HAVING COUNT(*) > 10
       LIMIT $2`,
      [queue, bucketLimit]
    );

    scanned = activeBuckets.rows.length;

    for (const bucket of activeBuckets.rows) {
      if (!bucket.market || !bucket.state) continue;
      if (!isStateInsideCallingWindow(bucket.state)) { skipped++; continue; }
      try {
        const client = await pool.connect();
        try {
          const count = await warmEligiblePoolBucket(client, {
            queue,
            market: bucket.market,
            state: bucket.state,
            targetReady: LEASEDIALER_POOL_TARGET_PER_BUCKET,
          });
          if (count > 0) { warmed++; inserted += count; }
        } finally {
          client.release();
        }
      } catch (e: any) {
        skipped++;
        console.error("[POOL_FILL] bucket failed", { market: bucket.market, state: bucket.state, error: e?.message });
      }
    }

    if (inserted > 0) {
      console.error("[POOL_FILL] pass complete", { scanned, warmed, inserted, skipped, queue });
    }
  } finally {
    await releaseLeaseDialerJobLock(lockName, lockOwner);
  }

  return { scanned, warmed, inserted, skipped };
}

export async function cleanupStaleLeaseRows(options?: {
  batchSize?: number;
}): Promise<{
  assignmentsCleaned: number;
  poolExpired: number;
  blockedReadyExpired: number;
  orphanClaimsReleased: number;
}> {
  await ensureEligiblePoolSchema();
  const batchSize = Math.max(1, Math.min(250, Number(options?.batchSize || 50)));

  const reclaimed = await reclaimOrphanedLeasePoolRows({ batchSize });

  const assignments = await pool.query(
    `
      WITH candidates AS (
        SELECT id, lead_id, agent_email
        FROM leasedialer_assignments
        WHERE status IN ('queued', 'active')
        ORDER BY updated_at ASC NULLS FIRST, created_at ASC
        LIMIT $1
      ),
      bad AS (
        SELECT c.id
        FROM candidates c
        JOIN masterlead ml ON ml.id = c.lead_id
        WHERE (
          lower(trim(coalesce(ml.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
          OR (
            COALESCE(btrim(ml.cn_email), '') <> ''
            AND lower(btrim(ml.cn_email)) <> lower(c.agent_email)
          )
        )
        OR NOT (
          CASE COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''))
            WHEN 'CT' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'DC' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'DE' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'FL' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'GA' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'MA' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'MD' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'ME' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'MI' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'NC' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'NH' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'NJ' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'NY' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'OH' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'PA' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'RI' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'SC' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'VA' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'VT' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'WV' THEN (now() AT TIME ZONE 'America/New_York')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'IN' THEN (now() AT TIME ZONE 'America/Indiana/Indianapolis')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'AL' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'AR' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'IA' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'IL' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'KS' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'KY' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'LA' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'MN' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'MO' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'MS' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'ND' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'NE' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'OK' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'SD' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'TN' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'TX' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'WI' THEN (now() AT TIME ZONE 'America/Chicago')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'AZ' THEN (now() AT TIME ZONE 'America/Phoenix')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'CO' THEN (now() AT TIME ZONE 'America/Denver')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'ID' THEN (now() AT TIME ZONE 'America/Denver')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'MT' THEN (now() AT TIME ZONE 'America/Denver')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'NM' THEN (now() AT TIME ZONE 'America/Denver')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'UT' THEN (now() AT TIME ZONE 'America/Denver')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'WY' THEN (now() AT TIME ZONE 'America/Denver')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'CA' THEN (now() AT TIME ZONE 'America/Los_Angeles')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'NV' THEN (now() AT TIME ZONE 'America/Los_Angeles')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'OR' THEN (now() AT TIME ZONE 'America/Los_Angeles')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'WA' THEN (now() AT TIME ZONE 'America/Los_Angeles')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'AK' THEN (now() AT TIME ZONE 'America/Anchorage')::time BETWEEN time '08:00' AND time '21:00'
            WHEN 'HI' THEN (now() AT TIME ZONE 'Pacific/Honolulu')::time BETWEEN time '08:00' AND time '21:00'
            ELSE false
          END
        )
      )
      UPDATE leasedialer_assignments la
      SET status = 'completed',
          released_at = NOW(),
          release_reason = 'stale_lease_cleanup',
          updated_at = NOW()
      FROM bad
      WHERE la.id = bad.id
    `,
    [batchSize],
  );

  const poolRows = await pool.query(
    `
      WITH candidates AS (
        SELECT id, lead_id
        FROM leasedialer_eligible_pool
        WHERE status IN ('ready', 'claimed')
        ORDER BY updated_at ASC NULLS FIRST, created_at ASC
        LIMIT $1
      ),
      bad AS (
        SELECT c.id
        FROM candidates c
        JOIN masterlead ml ON ml.id = c.lead_id
        WHERE (
          COALESCE(btrim(ml.cn_email), '') <> ''
          OR lower(trim(coalesce(ml.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
          OR COALESCE(btrim(ml.taalk_lead_id::text), '') = ''
        )
      )
      UPDATE leasedialer_eligible_pool ep
      SET status = 'expired',
          updated_at = NOW()
      FROM bad
      WHERE ep.id = bad.id
    `,
    [batchSize],
  );

  const blockedReadyRows = { rowCount: reclaimed.blockedReadyExpired };
  const orphanClaims = { rowCount: reclaimed.orphanClaimsReleased };

  return {
    assignmentsCleaned: assignments.rowCount || 0,
    poolExpired: poolRows.rowCount || 0,
    blockedReadyExpired: blockedReadyRows.rowCount || 0,
    orphanClaimsReleased: orphanClaims.rowCount || 0,
  };
}

export async function reclaimOrphanedLeasePoolRows(options?: {
  batchSize?: number;
}): Promise<{ blockedReadyExpired: number; orphanClaimsReleased: number }> {
  await ensureEligiblePoolSchema();
  const batchSize = Math.max(1, Math.min(1000, Number(options?.batchSize || 250)));

  const blockedReadyRows = await pool.query(
    `
      WITH candidates AS (
        SELECT id, lead_id
        FROM leasedialer_eligible_pool
        WHERE status = 'ready'
          AND EXISTS (
          SELECT 1
          FROM leasedialer_assignments la
          WHERE la.lead_id = leasedialer_eligible_pool.lead_id
            AND la.status IN ('queued', 'active')
        )
        ORDER BY updated_at ASC NULLS FIRST, created_at ASC
        LIMIT $1
      )
      UPDATE leasedialer_eligible_pool ep
      SET status = 'expired',
          updated_at = NOW()
      FROM candidates
      WHERE ep.id = candidates.id
    `,
    [batchSize],
  );

  const orphanClaims = await pool.query(
    `
      WITH candidates AS (
        SELECT id, lead_id, claimed_by_agent_email
        FROM leasedialer_eligible_pool
        WHERE status = 'claimed'
          AND NOT EXISTS (
            SELECT 1
            FROM leasedialer_assignments la
            WHERE la.lead_id = leasedialer_eligible_pool.lead_id
              AND la.status IN ('queued', 'active')
          )
        ORDER BY updated_at ASC NULLS FIRST, claimed_at ASC NULLS FIRST
        LIMIT $1
      ),
      orphaned AS (
        SELECT
          c.id,
          CASE
            WHEN COALESCE(btrim(ml.cn_email), '') = ''
             AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
             AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            THEN 'ready'
            ELSE 'expired'
          END AS next_status
        FROM candidates c
        JOIN masterlead ml ON ml.id = c.lead_id
      )
      UPDATE leasedialer_eligible_pool ep
      SET status = orphaned.next_status,
          claimed_by_agent_email = NULL,
          claimed_assignment_id = NULL,
          claimed_at = NULL,
          updated_at = NOW()
      FROM orphaned
      WHERE ep.id = orphaned.id
    `,
    [batchSize],
  );

  return {
    blockedReadyExpired: blockedReadyRows.rowCount || 0,
    orphanClaimsReleased: orphanClaims.rowCount || 0,
  };
}

export async function sweepStaleLeasedialerAgentQueues(options?: {
  batchSize?: number;
  staleMinutes?: number;
  noDialReclaimMinutes?: number;
}): Promise<{ releasedToPool: number; completedBad: number }> {
  await ensureEligiblePoolSchema();
  const batchSize = Math.max(1, Math.min(1000, Number(options?.batchSize || 250)));
  const staleMinutes = Math.max(15, Math.min(24 * 60, Number(options?.staleMinutes || 60)));
  const noDialReclaimMinutes = Math.max(15, Math.min(7 * 24 * 60, Number(options?.noDialReclaimMinutes || LEASEDIALER_NO_DIAL_RECLAIM_MINUTES)));
  const twilioActiveOwners = await fetchTwilioActiveOwnerEmails(noDialReclaimMinutes);
  const normalizedTwilioActiveOwners = twilioActiveOwners
    .map((email) => normalizeEmail(email))
    .filter((email) => email.includes("@"));

  const result = await pool.query<{ action: string; count: number }>(
    `
      WITH candidates AS (
        SELECT
          la.id,
          la.lead_id,
          la.agent_email,
          'release' AS action,
          'idle_no_recent_dial_reclaim' AS reason
        FROM leasedialer_assignments la
        WHERE $2::int >= 0
          AND la.status IN ('queued', 'active')
          AND COALESCE(NULLIF(btrim(la.agent_email), ''), '') <> ''
          AND (
            COALESCE(cardinality($3::text[]), 0) = 0
            OR lower(la.agent_email) <> ALL($3::text[])
          )
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      ),
      updated_assignments AS (
        UPDATE leasedialer_assignments la
        SET status = 'released',
            released_at = NOW(),
            release_reason = c.reason,
            updated_at = NOW()
        FROM candidates c
        WHERE la.id = c.id
        RETURNING la.lead_id, la.agent_email, c.action
      ),
      cleared_owner AS (
        UPDATE masterlead ml
        SET cn_email = NULL,
            assigned_date = NULL,
            updated_at = NOW()
        FROM updated_assignments ua
        WHERE ml.id = ua.lead_id
          AND lower(trim(coalesce(ml.cn_email, ''))) = lower(ua.agent_email)
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        RETURNING ml.id
      ),
      returned_pool AS (
        UPDATE leasedialer_eligible_pool ep
        SET status = 'ready',
            claimed_by_agent_email = NULL,
            claimed_assignment_id = NULL,
            claimed_at = NULL,
            updated_at = NOW()
        FROM updated_assignments ua
        WHERE ep.lead_id = ua.lead_id
          AND ua.action = 'release'
          AND ep.status = 'claimed'
          AND lower(coalesce(ep.claimed_by_agent_email, '')) = lower(ua.agent_email)
        RETURNING ep.lead_id
      )
      SELECT action, COUNT(*)::int AS count
      FROM updated_assignments
      GROUP BY action
    `,
    [batchSize, staleMinutes, normalizedTwilioActiveOwners],
  );

  let releasedToPool = 0;
  let completedBad = 0;
  for (const row of result.rows) {
    if (row.action === "release") releasedToPool = Number(row.count || 0);
    if (row.action === "complete") completedBad = Number(row.count || 0);
  }
  return { releasedToPool, completedBad };
}

async function cleanupOwnedCallableWithoutActiveLease(options?: { batchSize?: number }): Promise<number> {
  const batchSize = Math.max(1, Math.min(2000, Number(options?.batchSize || LEASEDIALER_ORPHAN_OWNER_CLEANUP_BATCH_SIZE)));
  const result = await dispositionWritePool.query<{ cleared_count: number }>(
    `
      WITH candidates AS (
        SELECT ml.id
        FROM masterlead ml
        WHERE COALESCE(btrim(ml.cn_email), '') <> ''
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND NOT EXISTS (
            SELECT 1
            FROM leasedialer_assignments la
            WHERE la.lead_id = ml.id
              AND la.status IN ('queued', 'active')
          )
        ORDER BY ml.id
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      ),
      updated AS (
        UPDATE masterlead ml
        SET cn_email = NULL,
            assigned_date = NULL,
            updated_at = NOW()
        FROM candidates c
        WHERE ml.id = c.id
        RETURNING ml.id
      )
      SELECT COUNT(*)::int AS cleared_count
      FROM updated
    `,
    [batchSize],
  );
  return Number(result.rows[0]?.cleared_count || 0);
}

async function sampleOwnedCallableWithoutActiveLease(limitRows = 200): Promise<{
  sampledCount: number;
  topOwners: Array<{ owner_email: string; count: number }>;
}> {
  const safeLimit = Math.max(1, Math.min(5000, Number(limitRows || 200)));
  const result = await dispositionWritePool.query<{ owner_email: string; count: number }>(
    `
      WITH candidates AS (
        SELECT lower(btrim(ml.cn_email)) AS owner_email
        FROM masterlead ml
        WHERE COALESCE(btrim(ml.cn_email), '') <> ''
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND NOT EXISTS (
            SELECT 1
            FROM leasedialer_assignments la
            WHERE la.lead_id = ml.id
              AND la.status IN ('queued', 'active')
          )
        ORDER BY ml.id
        LIMIT $1
      )
      SELECT owner_email, COUNT(*)::int AS count
      FROM candidates
      GROUP BY owner_email
      ORDER BY count DESC, owner_email ASC
      LIMIT 10
    `,
    [safeLimit],
  );
  const sampledCount = result.rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
  return { sampledCount, topOwners: result.rows.map((row) => ({ owner_email: String(row.owner_email || ""), count: Number(row.count || 0) })) };
}

let hourlyLeaseSweeperTimer: ReturnType<typeof setInterval> | null = null;
let hourlyLeaseSweeperRunning = false;

export function startHourlyLeasedialerQueueSweeper(): void {
  if (hourlyLeaseSweeperTimer) return;
  const run = async () => {
    if (hourlyLeaseSweeperRunning) return;
    hourlyLeaseSweeperRunning = true;
    const lockName = `queue_sweeper:${LEASEDIALER_SWEEP_LOCK_ID}`;
    let lockOwner: string | null = null;
    try {
      lockOwner = await tryAcquireLeaseDialerJobLock(lockName);
      if (!lockOwner) return;
      let totalReleasedToPool = 0;
      let totalCompletedBad = 0;
      let totalOwnerCleared = 0;
      let passes = 0;
      const maxPasses = Math.max(1, Math.min(20, LEASEDIALER_SWEEP_MAX_PASSES));

      while (passes < maxPasses) {
        const result = await sweepStaleLeasedialerAgentQueues({
          batchSize: LEASEDIALER_SWEEP_BATCH_SIZE,
          staleMinutes: LEASEDIALER_SWEEP_STALE_MINUTES,
          noDialReclaimMinutes: LEASEDIALER_NO_DIAL_RECLAIM_MINUTES,
        });
        passes += 1;
        totalReleasedToPool += result.releasedToPool;
        totalCompletedBad += result.completedBad;
        if (result.releasedToPool === 0 && result.completedBad === 0) break;
      }

      let ownerCleanupPasses = 0;
      while (ownerCleanupPasses < maxPasses) {
        const cleared = await cleanupOwnedCallableWithoutActiveLease({
          batchSize: LEASEDIALER_ORPHAN_OWNER_CLEANUP_BATCH_SIZE,
        });
        ownerCleanupPasses += 1;
        totalOwnerCleared += cleared;
        if (cleared === 0) break;
      }

      if (totalReleasedToPool > 0 || totalCompletedBad > 0 || totalOwnerCleared > 0) {
        console.error("[LEASE_SWEEP] periodic pass complete", {
          passes,
          releasedToPool: totalReleasedToPool,
          completedBad: totalCompletedBad,
          ownerLocksCleared: totalOwnerCleared,
          staleMinutes: LEASEDIALER_SWEEP_STALE_MINUTES,
          batchSize: LEASEDIALER_SWEEP_BATCH_SIZE,
        });
      }

      if (LEASEDIALER_OWNER_DRIFT_ALERT_THRESHOLD >= 0) {
        const driftSample = await sampleOwnedCallableWithoutActiveLease(
          Math.max(LEASEDIALER_OWNER_DRIFT_ALERT_THRESHOLD + 1, 200),
        );
        if (driftSample.sampledCount > LEASEDIALER_OWNER_DRIFT_ALERT_THRESHOLD) {
          console.error("[LEASE_SWEEP][ALERT] callable leads still owned without active lease", {
            sampledCount: driftSample.sampledCount,
            threshold: LEASEDIALER_OWNER_DRIFT_ALERT_THRESHOLD,
            topOwners: driftSample.topOwners,
          });
        }
      }
    } catch (error: any) {
      console.warn("[LEASE_SWEEP] periodic pass failed", error?.message || error);
    } finally {
      await releaseLeaseDialerJobLock(lockName, lockOwner);
      hourlyLeaseSweeperRunning = false;
    }
  };
  setTimeout(() => void run(), 30_000).unref?.();
  hourlyLeaseSweeperTimer = setInterval(() => void run(), LEASEDIALER_SWEEP_INTERVAL_MS);
  hourlyLeaseSweeperTimer.unref?.();
  console.error("[LEASE_SWEEP] periodic queue sweeper started", {
    intervalMs: LEASEDIALER_SWEEP_INTERVAL_MS,
    staleMinutes: LEASEDIALER_SWEEP_STALE_MINUTES,
    noDialReclaimMinutes: LEASEDIALER_NO_DIAL_RECLAIM_MINUTES,
    batchSize: LEASEDIALER_SWEEP_BATCH_SIZE,
    maxPasses: LEASEDIALER_SWEEP_MAX_PASSES,
  });
}
export async function warmLeaseDialerQueuesOnce(options?: {
  batchSize?: number;
  queue?: string;
}): Promise<{ scanned: number; warmed: number; inserted: number; skipped: number }> {
  if (leasePreloaderRunning) {
    return { scanned: 0, warmed: 0, inserted: 0, skipped: 0 };
  }

  leasePreloaderRunning = true;

  const queue = String(options?.queue || "hotlead").toLowerCase().trim();
  const batchSize = Math.max(1, Math.min(50, Number(options?.batchSize || LEASEDIALER_PRELOADER_BATCH_SIZE)));
  let scanned = 0;
  let warmed = 0;
  let inserted = 0;
  let skipped = 0;
  let timeoutFallbackSuccess = 0;
  let timeoutFallbackFailed = 0;
  const skippedAgents: string[] = [];
  const lockName = `queue_preloader:${LEASEDIALER_PRELOADER_LOCK_ID}:${queue}`;
  let lockOwner: string | null = null;

  try {
    lockOwner = await tryAcquireLeaseDialerJobLock(lockName);
    if (!lockOwner) {
      return { scanned, warmed, inserted, skipped };
    }

    const preCleanup = await cleanupStaleLeaseRows({ batchSize: LEASEDIALER_PRELOADER_PRE_CLEANUP_BATCH_SIZE });
    if (
      preCleanup.assignmentsCleaned > 0 ||
      preCleanup.poolExpired > 0 ||
      preCleanup.blockedReadyExpired > 0 ||
      preCleanup.orphanClaimsReleased > 0
    ) {
      console.error("[LEASE_CLEANUP] preloader pre-pass complete", preCleanup);
    }

    const activeAgentEmails = await fetchActiveCcproAgentEmails();
    if (activeAgentEmails.length === 0) {
      console.error("[LEASE_PRELOADER] pass skipped: no active CCPro agents");
      return { scanned, warmed, inserted, skipped };
    }

    // Fetch markets/states directly from Supabase customers (source of truth)
    // Fall back to agent_routing_profiles if Supabase is unavailable
    let candidateRows: { agent_email: string; markets: string[]; states: string[]; queued_count: string }[] = [];

    if (supabaseAdmin) {
      try {
        const { data: custRows, error: custErr } = await supabaseAdmin
          .from("customers")
          .select("company_email, personal_email, market, states")
          .in("company_email", activeAgentEmails);
        if (custErr) throw new Error(custErr.message);
        // Also try personal_email matches for any not found by company_email
        const foundEmails = new Set((custRows || []).map((r: any) => normalizeEmail(String(r.company_email || ""))));
        const missingEmails = activeAgentEmails.filter(e => !foundEmails.has(e)).slice(0, 20);
        let extraRows: any[] = [];
        if (missingEmails.length > 0) {
          const { data: extra } = await supabaseAdmin
            .from("customers")
            .select("company_email, personal_email, market, states")
            .in("personal_email", missingEmails);
          extraRows = extra || [];
        }
        const allCustRows = [...(custRows || []), ...extraRows];
        // Build queued_count from Neon for ordering
        const queuedRes = await pool.query<{ agent_email: string; queued_count: string }>(
          `SELECT lower(agent_email) AS agent_email, COUNT(id)::text AS queued_count
           FROM leasedialer_assignments
           WHERE status = 'queued' AND queue = $1 AND lower(agent_email) = ANY($2::text[])
           GROUP BY lower(agent_email)`,
          [queue, activeAgentEmails],
        );
        const queuedMap = new Map(queuedRes.rows.map(r => [r.agent_email, r.queued_count]));
        const seen = new Set<string>();
        for (const row of allCustRows) {
          const email = normalizeEmail(String(row.company_email || row.personal_email || ""));
          if (!email || !activeAgentEmails.includes(email) || seen.has(email)) continue;
          seen.add(email);
          const markets = normalizeCustomerMarkets(row.market);
          const states = normalizeCustomerStates(row.states);
          if (markets.length === 0 || states.length === 0) continue;
          candidateRows.push({ agent_email: email, markets, states, queued_count: queuedMap.get(email) || "0" });
        }
        // Sort by queued_count ASC (fill emptiest first), cap at batchSize
        candidateRows.sort((a, b) => Number(a.queued_count) - Number(b.queued_count));
        candidateRows = candidateRows.slice(0, batchSize);
        console.error("[LEASE_PRELOADER] candidates from supabase.customers", { count: candidateRows.length });
      } catch (custFetchErr: any) {
        console.warn("[LEASE_PRELOADER] supabase customers fetch failed, falling back to agent_routing_profiles:", custFetchErr?.message);
        candidateRows = [];
      }
    }

    scanned = candidateRows.length;

    for (const candidate of candidateRows) {
      const agentEmail = normalizeEmail(candidate.agent_email);
      const markets = Array.isArray(candidate.markets) ? candidate.markets.map(normalizeMarketName).filter(Boolean) : [];
      const states = Array.isArray(candidate.states)
        ? candidate.states.map(normalizeStateCode).filter((state) => /^[A-Z]{2}$/.test(state))
        : [];
      if (!agentEmail || markets.length === 0 || states.length === 0) {
        skipped += 1;
        continue;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await expireInvalidLeaseAssignmentsForAgent(client, { agentEmail, queue, routing: { markets, states } });
        await releaseOutsideWindowLeaseAssignmentsForAgent(client, { agentEmail, queue, states });
        await warmEligiblePoolForRouting(client, { queue, routing: { markets, states } });
        const count = await fillQueuedLeadsForAgent(client, {
          agentEmail,
          queue,
          routing: { markets, states },
          targetQueued: LEASEDIALER_TARGET_QUEUED_LEADS,
        });
        await client.query("COMMIT");
        if (count > 0) warmed += 1;
        inserted += count;
      } catch (error: any) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // ignore rollback failure in background warmer
        }
        const message = String(error?.message || error || "");
        const isTimeout = /query read timeout|statement timeout|timeout/i.test(message);
        if (isTimeout) {
          // If warm-up times out under DB pressure, still try a cheap claim-only topoff
          // so active agents can receive already-ready inventory.
          try {
            await client.query("BEGIN");
            await expireInvalidLeaseAssignmentsForAgent(client, { agentEmail, queue, routing: { markets, states } });
            await releaseOutsideWindowLeaseAssignmentsForAgent(client, { agentEmail, queue, states });
            const count = await fillQueuedLeadsForAgent(client, {
              agentEmail,
              queue,
              routing: { markets, states },
              targetQueued: LEASEDIALER_TARGET_QUEUED_LEADS,
            });
            await client.query("COMMIT");
            if (count > 0) warmed += 1;
            inserted += count;
            timeoutFallbackSuccess += 1;
            return;
          } catch (fallbackError: any) {
            try {
              await client.query("ROLLBACK");
            } catch {
              // ignore rollback failure in fallback path
            }
            skipped += 1;
            timeoutFallbackFailed += 1;
            skippedAgents.push(agentEmail);
            console.error("[LEASE_PRELOADER] warm timeout and fallback fill failed", {
              agentEmail,
              queue,
              warmError: message,
              fallbackError: fallbackError?.message || String(fallbackError),
            });
            return;
          }
        }

        skipped += 1;
        skippedAgents.push(agentEmail);
        console.error("[LEASE_PRELOADER] failed to warm agent", {
          agentEmail,
          queue,
          error: message,
        });
      } finally {
        client.release();
      }
    }

    cleanupStaleLeaseRows({ batchSize: 25 })
      .then((cleanup) => {
        if (
          cleanup.assignmentsCleaned > 0 ||
          cleanup.poolExpired > 0 ||
          cleanup.blockedReadyExpired > 0 ||
          cleanup.orphanClaimsReleased > 0
        ) {
          console.error("[LEASE_CLEANUP] async pass complete", cleanup);
        }
      })
      .catch((error: any) => {
        console.warn("[LEASE_CLEANUP] async pass failed:", error?.message || error);
      });

    if (scanned > 0 || inserted > 0) {
      console.error("[LEASE_PRELOADER] pass complete", { scanned, warmed, inserted, skipped, queue });
    }

    const isStalledPass = scanned > 0 && inserted === 0 && skipped > 0;
    if (isStalledPass) {
      leasePreloaderConsecutiveStallPasses += 1;
      if (leasePreloaderConsecutiveStallPasses >= 3) {
        console.error("[LEASE_PRELOADER][ALERT] consecutive stalled passes", {
          queue,
          consecutiveStallPasses: leasePreloaderConsecutiveStallPasses,
          scanned,
          warmed,
          inserted,
          skipped,
          timeoutFallbackSuccess,
          timeoutFallbackFailed,
          sampleSkippedAgents: skippedAgents.slice(0, 8),
        });
      }
    } else {
      leasePreloaderConsecutiveStallPasses = 0;
    }

    if (timeoutFallbackSuccess > 0 || timeoutFallbackFailed > 0) {
      console.error("[LEASE_PRELOADER] timeout fallback summary", {
        queue,
        timeoutFallbackSuccess,
        timeoutFallbackFailed,
      });
    }

    return { scanned, warmed, inserted, skipped };
  } finally {
    await releaseLeaseDialerJobLock(lockName, lockOwner);
    leasePreloaderRunning = false;
  }
}

export async function warmLeaseDialerQueueForAgent(input: {
  agentEmail: string;
  queue?: string;
  targetQueued?: number;
}): Promise<{ inserted: number; reason?: string }> {
  const agentEmail = normalizeEmail(input.agentEmail);
  const queue = String(input.queue || "hotlead").toLowerCase().trim();
  const routing = await resolveRoutingProfile(agentEmail);

  if (!agentEmail || routing.markets.length === 0 || routing.states.length === 0) {
    return { inserted: 0, reason: "MISSING_ROUTING_PROFILE" };
  }

  const client = await pool.connect();
  try {
    // Set statement timeout at session level before BEGIN so it doesn't abort the txn if fired
    await client.query("SET statement_timeout = '12000ms'");
    await client.query("BEGIN");
    await expireInvalidLeaseAssignmentsForAgent(client, { agentEmail, queue, routing });
    await releaseOutsideWindowLeaseAssignmentsForAgent(client, {
      agentEmail,
      queue,
      states: routing.states,
    });
    await warmEligiblePoolForRouting(client, { queue, routing });
    const inserted = await fillQueuedLeadsForAgent(client, {
      agentEmail,
      queue,
      routing,
      targetQueued: input.targetQueued ?? LEASEDIALER_CLIENT_BUFFER_LEADS,
    });
    await client.query("COMMIT");
    return { inserted };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    // Reset statement timeout so connection returns to pool with default settings
    await client.query("SET statement_timeout = '0'").catch(() => undefined);
    client.release();
  }
}

export function startLeaseDialerQueuePreloaderScheduler(): void {
  if (process.env.LEASEDIALER_PROACTIVE_PRELOADER_ENABLED === "false") {
    console.error("[LEASE_PRELOADER] proactive preloader explicitly disabled by env; fills occur only on-demand");
    return;
  }
  if (leasePreloaderTimer) return;

  const run = () => {
    void (async () => {
      await warmLeaseDialerQueuesOnce();
    })().catch((error: any) => {
      console.error("[LEASE_PRELOADER] run failed:", error?.message || error);
    });
  };

  // Cold-start preloader: fill all CCPro agents with 0 queued leads every 5 minutes
  // so agents have leads waiting when they log in, not just when they're already online.
  const runColdStart = () => {
    void (async () => {
      if (!supabaseAdmin) return;
      try {
        const { data: custRows, error } = await supabaseAdmin
          .from("customers")
          .select("company_email, personal_email, market, states")
          .eq("CCPRO", true)
          .limit(300);
        if (error || !custRows?.length) return;

        // Find who has 0 queued leads
        const allEmails = custRows.map((r: any) => normalizeEmail(String(r.company_email || r.personal_email || ""))).filter(Boolean);
        if (allEmails.length === 0) return;

        const queuedCounts = await pool.query<{ agent_email: string; cnt: string }>(
          `SELECT lower(agent_email) AS agent_email, COUNT(*)::text AS cnt
           FROM leasedialer_assignments
           WHERE status = 'queued' AND lower(agent_email) = ANY($1::text[])
           GROUP BY lower(agent_email)`,
          [allEmails],
        );
        const queuedMap = new Map(queuedCounts.rows.map((r) => [r.agent_email, Number(r.cnt)]));
        const emptyAgents = custRows.filter((r: any) => {
          const email = normalizeEmail(String(r.company_email || r.personal_email || ""));
          return email && (queuedMap.get(email) || 0) === 0;
        });

        if (emptyAgents.length === 0) return;
        console.error("[LEASE_COLDSTART] filling empty agents", { count: emptyAgents.length });

        // Fill up to 10 at a time, 20 leads each — small cold-start buffer
        let filled = 0;
        for (const row of emptyAgents.slice(0, 20)) {
          const email = normalizeEmail(String(row.company_email || row.personal_email || ""));
          const markets = normalizeCustomerMarkets(row.market);
          const states = normalizeCustomerStates(row.states);
          if (!email || markets.length === 0 || states.length === 0) continue;
          try {
            const client = await Promise.race([
              pool.connect(),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Query read timeout")), 3000)),
            ]);
            try {
              await client.query("BEGIN");
              const inserted = await fillQueuedLeadsForAgent(client, {
                agentEmail: email,
                queue: "hotlead",
                routing: { markets, states },
                targetQueued: 20,
              });
              await client.query("COMMIT");
              if (inserted > 0) filled++;
            } catch {
              await client.query("ROLLBACK").catch(() => undefined);
            } finally {
              client.release();
            }
          } catch {
            // pool exhausted or timeout — skip
          }
        }
        if (filled > 0) console.error("[LEASE_COLDSTART] pass complete", { filled });
      } catch (e: any) {
        console.error("[LEASE_COLDSTART] failed:", e?.message);
      }
    })();
  };

  setTimeout(run, 60_000).unref?.();
  leasePreloaderTimer = setInterval(run, LEASEDIALER_PRELOADER_INTERVAL_MS);
  leasePreloaderTimer.unref?.();

  // Pool fill: replenish leasedialer_eligible_pool with fresh pending leads every 5 minutes
  const runPoolFill = () => {
    void warmEligibleLeadPoolOnce({ queue: "hotlead" }).catch((e: any) => {
      console.error("[POOL_FILL] scheduled run failed:", e?.message);
    });
  };
  setTimeout(runPoolFill, 30_000).unref?.(); // first run 30s after start
  setInterval(runPoolFill, 5 * 60 * 1000).unref?.(); // then every 5 minutes

  // Cold-start runs every 5 minutes, first run after 2 minutes
  setTimeout(runColdStart, 2 * 60 * 1000).unref?.();
  setInterval(runColdStart, 5 * 60 * 1000).unref?.();

  console.error("[LEASE_PRELOADER] scheduler started", {
    intervalMs: LEASEDIALER_PRELOADER_INTERVAL_MS,
    batchSize: LEASEDIALER_PRELOADER_BATCH_SIZE,
    targetQueued: LEASEDIALER_TARGET_QUEUED_LEADS,
    refillThreshold: LEASEDIALER_REFILL_THRESHOLD,
    poolTargetPerBucket: LEASEDIALER_POOL_TARGET_PER_BUCKET,
    coldStartIntervalMs: 5 * 60 * 1000,
    coldStartTargetQueued: 20,
  });
}

async function fillQueuedLeadsForAgent(
  client: Awaited<ReturnType<typeof pool.connect>>,
  input: {
    agentEmail: string;
    queue: string;
    routing: { markets: string[]; states: string[] };
    targetQueued?: number;
  },
): Promise<number> {
  const targetQueued = input.targetQueued ?? LEASEDIALER_TARGET_QUEUED_LEADS;
  const callableMarkets = Array.from(new Set(input.routing.markets.map(normalizeMarketName).filter(Boolean)));
  const callableStates = input.routing.states
    .map(normalizeStateCode)
    .filter((state) => state && isStateInsideCallingWindow(state));
  if (callableMarkets.length === 0 || callableStates.length === 0) return 0;

  const queuedCount = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM leasedialer_assignments la
      JOIN masterlead ml ON ml.id = la.lead_id
      WHERE la.agent_email = $1
        AND la.queue = $2
        AND la.status = 'queued'
        AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($3::text[])
        AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = $1)
        AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND ${GLOBE_CALLABLE_MAX_AGE_INTERVAL_SQL}
    `,
    [input.agentEmail, input.queue, callableStates],
  );

  const currentQueued = Number(queuedCount.rows[0]?.count || 0);
  if (currentQueued >= LEASEDIALER_REFILL_THRESHOLD) return 0;
  const needed = Math.max(0, targetQueued - currentQueued);
  if (needed <= 0) return 0;

  let statePriority: MarketStatePriority[] = [];
  try {
    // Use a separate pool connection for this read-only priority query so that a
    // statement timeout here does NOT abort the caller's open write transaction.
    // Race against a 3s timeout so pool exhaustion never hangs the fill indefinitely.
    const priorityClient = await Promise.race([
      pool.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Query read timeout")), 3000)),
    ]);
    try {
      statePriority = await buildMarketStatePriorityForAgentFill(priorityClient, {
        agentEmail: input.agentEmail,
        queue: input.queue,
        markets: callableMarkets,
        states: callableStates,
      });
    } finally {
      priorityClient.release();
    }
  } catch (error: any) {
    if (!isQueryTimeoutError(error)) throw error;
    statePriority = buildFallbackPriorityFromRouting(callableMarkets, callableStates);
    console.error("[LEASE_ASSIGN] state priority fallback", {
      agentEmail: input.agentEmail,
      queue: input.queue,
      reason: String(error?.message || error || "timeout"),
      fallbackBuckets: statePriority.length,
    });
  }
  const prioritizedBuckets = statePriority.filter((bucket) => !bucket.broadBlockedForAgent);
  if (prioritizedBuckets.length === 0) return 0;

  const priorityPreview = prioritizedBuckets.slice(0, 12).map((bucket, idx) => ({
    rank: idx + 1,
    market: bucket.market,
    state: bucket.state,
    recommendedWeight: Number(bucket.recommendedWeight.toFixed(1)),
    pressureScore: Number(bucket.pressureScore.toFixed(2)),
    utilizationRatio: Number(bucket.utilizationRatio.toFixed(3)),
    servedCallable: bucket.servedCallable,
    totalCallable: bucket.totalCallable,
    eligibleActiveAgents: bucket.eligibleActiveAgents,
    narrowEligibleAgents: bucket.narrowEligibleAgents,
  }));
  console.error("[LEASE_ASSIGN] state priority", {
    agentEmail: input.agentEmail,
    queue: input.queue,
    currentQueued,
    needed,
    preview: priorityPreview,
  });

  let insertedTotal = 0;
  for (const bucket of prioritizedBuckets) {
    let cursorCreatedAt: string | null = null;
    let cursorId: number | null = null;
    for (let page = 0; page < LEASEDIALER_DIRECT_ASSIGN_MAX_PAGES_PER_STATE && insertedTotal < needed; page += 1) {
      const remaining = needed - insertedTotal;
      const result = await client.query<{ lead_id: string; created_at: string; source_id: string }>(
        `
          eligible AS (
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
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = lower($3)
              )
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND ($1 <> 'Globe Market' OR (ml.created_at IS NOT NULL AND ml.created_at >= NOW() - INTERVAL '6 months'))
              AND NOT EXISTS (
                SELECT 1 FROM leasedialer_assignments la_hist
                WHERE la_hist.lead_id = ml.id
                  AND lower(la_hist.agent_email) = lower($3)
                  AND la_hist.created_at >= NOW() - INTERVAL '7 days'
              )
              AND (
                ml.last_contacted IS NULL
                OR ml.last_contacted < NOW() - INTERVAL '24 hours'
              )
              AND (
                $5::timestamptz IS NULL
                OR (ml.created_at, ml.id) < ($5::timestamptz, $6::bigint)
              )
            ORDER BY ml.created_at DESC NULLS LAST, ml.id DESC
            LIMIT $4
          ),
          inserted AS (
            INSERT INTO leasedialer_assignments (
              lead_id,
              agent_email,
              queue,
              status,
              market,
              state,
              assigned_at,
              created_at,
              updated_at
            )
            SELECT id, $3, $7, 'queued', $1, $2, NOW(), NOW(), NOW()
            FROM eligible
            ON CONFLICT DO NOTHING
            RETURNING lead_id
          )
          SELECT i.lead_id::text, e.created_at::text, e.id::text AS source_id
          FROM eligible e
          LEFT JOIN inserted i ON i.lead_id = e.id
          ORDER BY e.created_at DESC NULLS LAST, e.id DESC
        `,
        [
          bucket.market,
          bucket.state,
          input.agentEmail,
          Math.max(LEASEDIALER_DIRECT_ASSIGN_PAGE_SIZE, Math.min(LEASEDIALER_DIRECT_ASSIGN_PAGE_SIZE * 3, remaining * 3)),
          cursorCreatedAt,
          cursorId,
          input.queue,
        ],
      );
      if (result.rows.length === 0) break;
      const last = result.rows[result.rows.length - 1];
      cursorCreatedAt = last.created_at;
      cursorId = Number(last.source_id);
      const insertedThisPage = result.rows.filter((row) => row.lead_id).length;
      insertedTotal += insertedThisPage;
      if (result.rows.length < LEASEDIALER_DIRECT_ASSIGN_PAGE_SIZE || insertedThisPage >= remaining) break;
    }
    if (insertedTotal >= needed) break;
  }

  return insertedTotal;
}

async function refillQueuedLeadsInBackground(input: { agentEmail: string; queue: string }): Promise<void> {
  if (process.env.LEASEDIALER_BACKGROUND_REFILL_ENABLED !== "true") return;
  const agentEmail = normalizeEmail(input.agentEmail);
  const queue = String(input.queue || "hotlead").toLowerCase().trim();
  const key = `${agentEmail}:${queue}`;
  if (backgroundRefills.has(key)) return;
  const lastRequestedAt = backgroundRefillLastRequestedAt.get(key) || 0;
  if (Date.now() - lastRequestedAt < 10_000) return;

  backgroundRefills.add(key);
  backgroundRefillLastRequestedAt.set(key, Date.now());
  // Queue this refill — waits for a slot (max LEASEDIALER_MAX_CONCURRENT_REFILLS at once)
  void queuedRefill(agentEmail, queue, async () => {
  setTimeout(async () => {
    const client = await pool.connect();
    try {
      const routing = await resolveRoutingProfile(agentEmail);
      if (routing.markets.length === 0 || routing.states.length === 0) return;
      await client.query("BEGIN");
      await expireInvalidLeaseAssignmentsForAgent(client, { agentEmail, queue, routing });
      await releaseOutsideWindowLeaseAssignmentsForAgent(client, {
        agentEmail,
        queue,
        states: routing.states,
      });
      await warmEligiblePoolForRouting(client, { queue, routing });
      await fillQueuedLeadsForAgent(client, { agentEmail, queue, routing });
      await client.query("COMMIT");
    } catch (error: any) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback failure in detached refill
      }
      console.warn("⚠️ leasedialer background refill failed:", {
        agentEmail,
        queue,
        error: error?.message || String(error),
      });
    } finally {
      client.release();
      backgroundRefills.delete(key);
    }
  }, 0).unref?.();
  }); // end queuedRefill
}

async function getNextQueuedLeadsForAgent(
  client: Awaited<ReturnType<typeof pool.connect>>,
  agentEmail: string,
  queue: string,
  limit = 2,
  callableStates: string[] = [],
): Promise<Array<Record<string, unknown>>> {
  const result = await client.query<Record<string, unknown>>(
    `
      SELECT ml.*
      FROM leasedialer_assignments la
      JOIN masterlead ml ON ml.id = la.lead_id
      WHERE la.agent_email = $1
        AND la.queue = $2
        AND la.status = 'queued'
        AND (
          array_length($4::text[], 1) IS NULL
          OR COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($4::text[])
        )
        AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = $1)
        AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND ${GLOBE_CALLABLE_MAX_AGE_INTERVAL_SQL}
      ORDER BY
        ml.created_at DESC NULLS LAST,
        NULLIF(regexp_replace(coalesce(ml.taalk_lead_id::text, ''), '\\D', '', 'g'), '')::bigint DESC NULLS LAST,
        la.assigned_at ASC,
        la.created_at ASC
      LIMIT $3
    `,
    [agentEmail, queue, Math.min(limit * 3, 150), callableStates],
  );

  return result.rows.filter((row) => isLeadInsideCallingWindow(row)).slice(0, limit);
}

async function tryDirectFailOpenLeaseAssignment(input: {
  agentEmail: string;
  queue: string;
  routing: { markets: string[]; states: string[] };
  callableStates: string[];
}): Promise<{
  reused: boolean;
  assigned: boolean;
  assignmentId: string | null;
  lead: Record<string, unknown> | null;
  backupLeads: Array<Record<string, unknown>>;
  timedOut?: boolean;
} | null> {
  const callableMarkets = Array.from(new Set(input.routing.markets.map(normalizeMarketName).filter(Boolean)));
  if (callableMarkets.length === 0 || input.callableStates.length === 0) return null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '250ms'");
    await client.query("SET LOCAL statement_timeout = '8000ms'");
    const existing = await client.query<Record<string, unknown>>({
      text: `
        SELECT
          la.id AS assignment_id,
          la.status AS assignment_status,
          la.lead_id AS assignment_lead_id,
          ml.*
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = lower($1)
          AND la.queue = $2
          AND la.status IN ('active', 'queued')
          AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($3::text[])
          AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = $1)
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND (
            ml.last_contacted IS NULL
            OR ml.last_contacted < NOW() - ($4::int * INTERVAL '1 minute')
          )
          AND ${GLOBE_CALLABLE_MAX_AGE_INTERVAL_SQL}
        ORDER BY
          CASE WHEN la.status = 'active' THEN 0 ELSE 1 END,
          ml.created_at DESC NULLS LAST,
          la.assigned_at ASC,
          la.created_at ASC
        LIMIT 25
        FOR UPDATE SKIP LOCKED
      `,
      values: [
        input.agentEmail,
        input.queue,
        input.callableStates,
        LEASEDIALER_RECENT_ANY_CALL_BLOCK_MINUTES,
      ],
      query_timeout: 1800,
    } as any);
    const existingLead = existing.rows.find((row) => isLeadInsideCallingWindow(row));
    if (existingLead) {
      const assignmentId = String(existingLead.assignment_id || "");
      const assignmentStatus = String(existingLead.assignment_status || "").toLowerCase();
      if (assignmentStatus === "queued" && assignmentId) {
        await client.query(
          `
            UPDATE leasedialer_assignments
            SET status = 'active',
                assigned_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
          `,
          [assignmentId],
        );
        // Stamp last_contacted so repeat-block filter works without twilio_call_logs
        await client.query(
          `UPDATE masterlead SET last_contacted = NOW(), updated_at = NOW() WHERE id = (SELECT lead_id FROM leasedialer_assignments WHERE id = $1)`,
          [assignmentId],
        ).catch(() => undefined);
      }
      await client.query(
        `
          UPDATE masterlead
          SET cn_email = $1,
              assigned_date = NOW(),
              updated_at = NOW()
          WHERE id = $2
            AND (COALESCE(btrim(cn_email), '') = '' OR lower(btrim(cn_email)) = $1)
            AND lower(trim(coalesce(cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        `,
        [input.agentEmail, Number(existingLead.assignment_lead_id || existingLead.lead_id)],
      );
      const backupLeads = existing.rows
        .filter((row) => Number(row.assignment_lead_id || row.lead_id) !== Number(existingLead.assignment_lead_id || existingLead.lead_id))
        .filter((row) => isLeadInsideCallingWindow(row))
        .slice(0, LEASEDIALER_CLIENT_BUFFER_LEADS);
      await client.query("COMMIT");
      void refillQueuedLeadsInBackground({ agentEmail: input.agentEmail, queue: input.queue });
      return {
        reused: true,
        assigned: assignmentStatus !== "active",
        assignmentId: assignmentId || null,
        lead: existingLead,
        backupLeads,
      };
    }

    const claimed = await client.query<{ assignment_id: string; lead_id: string }>({
      text: `
        eligible AS (
          SELECT ml.id
          FROM masterlead ml
          WHERE (
              CASE
                WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
                WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
                ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
              END
            ) = ANY($3::text[])
            AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($4::text[])
            AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = $1)
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND ${GLOBE_CALLABLE_MAX_AGE_INTERVAL_SQL}
            AND NOT EXISTS (
              SELECT 1
              FROM recent_failed_phones rfp
              WHERE rfp.phone10 = COALESCE(
                NULLIF(btrim(ml.phone_last10), ''),
                RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)
              )
            )
            AND (
              ml.last_contacted IS NULL
              OR ml.last_contacted < NOW() - INTERVAL '24 hours'
            )
          ORDER BY ml.created_at DESC NULLS LAST, ml.id DESC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        ),
        inserted AS (
          INSERT INTO leasedialer_assignments (
            lead_id,
            agent_email,
            queue,
            status,
            assigned_at,
            created_at,
            updated_at
          )
          SELECT e.id, $1, $2, 'queued', NOW(), NOW(), NOW()
          FROM eligible e
          ON CONFLICT DO NOTHING
          RETURNING id, lead_id
        ),
        picked AS (
          SELECT i.id, i.lead_id
          FROM inserted i
          UNION ALL
          SELECT la.id, la.lead_id
          FROM eligible e
          JOIN leasedialer_assignments la
            ON la.lead_id = e.id
          WHERE lower(la.agent_email) = lower($1)
            AND la.queue = $2
            AND la.status IN ('queued', 'active')
          LIMIT 1
        ),
        owner_claim AS (
          UPDATE masterlead ml
          SET cn_email = $1,
              assigned_date = NOW(),
              updated_at = NOW()
          FROM picked p
          WHERE ml.id = p.lead_id
            AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = $1)
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          RETURNING ml.id
        )
        SELECT p.id::text AS assignment_id, p.lead_id::text AS lead_id
        FROM picked p
        JOIN owner_claim oc ON oc.id = p.lead_id
        LIMIT 1
      `,
      values: [
        input.agentEmail,
        input.queue,
        callableMarkets,
        input.callableStates,
        LEASEDIALER_FAILED_PHONE_COOLDOWN_MINUTES,
        LEASEDIALER_RECENT_ANY_CALL_BLOCK_MINUTES,
      ],
      query_timeout: 1800,
    } as any);

    const picked = claimed.rows[0];
    if (!picked) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
        UPDATE leasedialer_assignments
        SET status = 'active',
            assigned_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [picked.assignment_id],
    );
    // Stamp last_contacted so repeat-block filter works without twilio_call_logs
    await client.query(
      `UPDATE masterlead SET last_contacted = NOW(), updated_at = NOW() WHERE id = $1`,
      [picked.lead_id],
    ).catch(() => undefined);

    const leadRow = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM masterlead
        WHERE id = $1
        LIMIT 1
      `,
      [Number(picked.lead_id)],
    );

    const backupLeads = await getNextQueuedLeadsForAgent(
      client,
      input.agentEmail,
      input.queue,
      LEASEDIALER_CLIENT_BUFFER_LEADS,
      input.callableStates,
    );
    await client.query("COMMIT");
    void refillQueuedLeadsInBackground({ agentEmail: input.agentEmail, queue: input.queue });
    return {
      reused: false,
      assigned: true,
      assignmentId: picked.assignment_id ?? null,
      lead: leadRow.rows[0] || null,
      backupLeads,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure in fail-open path
    }
    if (isQueryTimeoutError(error)) {
      return {
        reused: false,
        assigned: false,
        assignmentId: null,
        lead: null,
        backupLeads: [],
        timedOut: true,
      };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function syncLeaseDialerLead(input: {
  agentEmail: string;
  queue?: QueueType;
}): Promise<{
  reused: boolean;
  assigned: boolean;
  assignmentId: string | null;
  lead: Record<string, unknown> | null;
  backupLead: Record<string, unknown> | null;
  backupLeads: Array<Record<string, unknown>>;
  reason?: string;
}> {
  const agentEmail = normalizeEmail(input.agentEmail);
  const queue = String(input.queue || "hotlead").toLowerCase().trim();
  let sawNonCallableQueueRows = false;

  // Fast path: if agent already has queued assignments, serve from those immediately
  // without waiting on resolveRoutingProfile (Supabase). Routing only needed for NEW fills.
  const existingQueued = await pool.query<Record<string, unknown>>(
    `SELECT la.id AS assignment_id, la.lead_id AS assignment_lead_id, ml.*
     FROM leasedialer_assignments la
     JOIN masterlead ml ON ml.id = la.lead_id
     WHERE lower(la.agent_email) = $1
       AND la.queue = $2
       AND la.status = 'queued'
       AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = $1)
       AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
     ORDER BY la.assigned_at ASC, la.created_at ASC
     LIMIT 25`,
    [agentEmail, queue],
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

  if (existingQueued.rows.length > 0) {
    const callable = existingQueued.rows.filter((row) => isLeadInsideCallingWindow(row));
    if (callable.length > 0) {
      const lead = callable[0];
      const assignmentId = String(lead.assignment_id || "");
      // Mark as active
      await pool.query(
        `UPDATE leasedialer_assignments SET status = 'active', assigned_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [assignmentId],
      ).catch(() => undefined);
      // Stamp last_contacted so repeat-block filter works without twilio_call_logs
      await pool.query(
        `UPDATE masterlead SET last_contacted = NOW(), updated_at = NOW() WHERE id = (SELECT lead_id FROM leasedialer_assignments WHERE id = $1)`,
        [assignmentId],
      ).catch(() => undefined);
      await pool.query(
        `UPDATE masterlead SET cn_email = $1, assigned_date = NOW(), updated_at = NOW() WHERE id = $2 AND (COALESCE(btrim(cn_email),'')='' OR lower(btrim(cn_email))=$1) AND lower(trim(coalesce(cnresolution,'pending'))) IN ('pending','new','','null')`,
        [agentEmail, Number(lead.assignment_lead_id || lead.lead_id)],
      ).catch(() => undefined);
      void refillQueuedLeadsInBackground({ agentEmail, queue });
      return {
        reused: false,
        assigned: true,
        assignmentId: assignmentId || null,
        lead,
        backupLead: callable[1] || null,
        backupLeads: callable.slice(1),
        reason: "EXISTING_QUEUE_FAST_PATH",
      };
    }
    sawNonCallableQueueRows = true;
  }

  const routing = await resolveRoutingProfile(agentEmail);
  const callableStates = routing.states
    .map(normalizeStateCode)
    .filter((state) => state && isStateInsideCallingWindow(state));

  const fastPathLead = await tryDirectFailOpenLeaseAssignment({
    agentEmail,
    queue,
    routing,
    callableStates,
  });
  if (fastPathLead?.lead) {
    return {
      reused: fastPathLead.reused,
      assigned: fastPathLead.assigned,
      assignmentId: fastPathLead.assignmentId,
      lead: fastPathLead.lead,
      backupLead: fastPathLead.backupLeads[0] || null,
      backupLeads: fastPathLead.backupLeads,
      reason: "FAST_PATH_ASSIGNMENT",
    };
  }
  // If the fast path times out, continue into the regular sync flow rather than
  // returning empty; this keeps lead assignment attempts alive under contention.

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await expireInvalidLeaseAssignmentsForAgent(client, { agentEmail, queue, routing });
    await releaseOutsideWindowLeaseAssignmentsForAgent(client, {
      agentEmail,
      queue,
      states: routing.states,
    });

    const activeAssignment = await client.query<{ id: string; lead_id: number; assigned_at: string }>(
      `
        SELECT id, lead_id, assigned_at
        FROM leasedialer_assignments
        WHERE agent_email = $1
          AND status = 'active'
        ORDER BY assigned_at DESC
        LIMIT 1
      `,
      [agentEmail],
    );

    if (activeAssignment.rows[0]) {
      const current = activeAssignment.rows[0];
      const lockedLead = await client.query<Record<string, unknown>>(
        `
          SELECT *
          FROM masterlead
          WHERE id = $1
          LIMIT 1
        `,
        [current.lead_id],
      );

      if (lockedLead.rows[0] && !isActiveLeaseLeadStillCallable(lockedLead.rows[0], agentEmail, queue)) {
        await client.query(
          `
            UPDATE leasedialer_assignments
            SET status = 'completed',
                released_at = NOW(),
                release_reason = 'active_lead_not_callable',
                updated_at = NOW()
            WHERE id = $1
          `,
          [current.id],
        );
      } else if (lockedLead.rows[0] && isWithinActiveLock(current.assigned_at)) {
        const backupLeads = await getNextQueuedLeadsForAgent(client, agentEmail, queue, LEASEDIALER_CLIENT_BUFFER_LEADS, callableStates);
        await client.query("COMMIT");
        void refillQueuedLeadsInBackground({ agentEmail, queue });
        return {
          reused: true,
          assigned: false,
          assignmentId: current.id,
          lead: lockedLead.rows[0],
          backupLead: backupLeads[0] || null,
          backupLeads,
        };
      }

      if (lockedLead.rows[0] && isActiveLeaseLeadStillCallable(lockedLead.rows[0], agentEmail, queue)) {
        // Fail-open behavior: if an "active" lead survived beyond the lock window,
        // treat it as stale and auto-release it so the agent can receive a fresh lead.
        const assignedMs = new Date(String(current.assigned_at || "")).getTime();
        const staleActive = Number.isFinite(assignedMs) && Date.now() - assignedMs >= LEASEDIALER_ACTIVE_LOCK_MS;
        if (!staleActive) {
          const backupLeads = await getNextQueuedLeadsForAgent(client, agentEmail, queue, LEASEDIALER_CLIENT_BUFFER_LEADS, callableStates);
          await client.query("COMMIT");
          void refillQueuedLeadsInBackground({ agentEmail, queue });
          return {
            reused: true,
            assigned: false,
            assignmentId: current.id,
            lead: lockedLead.rows[0],
            backupLead: backupLeads[0] || null,
            backupLeads,
            reason: "ACTIVE_LEAD_RESYNC_REQUIRED",
          };
        }

        await client.query(
          `
            UPDATE leasedialer_assignments
            SET status = 'released',
                released_at = NOW(),
                release_reason = 'stale_active_auto_released',
                updated_at = NOW()
            WHERE id = $1
              AND status = 'active'
          `,
          [current.id],
        );
        await client.query(
          `
            UPDATE masterlead
            SET cn_email = NULL,
                assigned_date = NULL,
                updated_at = NOW()
            WHERE id = $1
              AND lower(trim(coalesce(cn_email, ''))) = $2
              AND lower(trim(coalesce(cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          `,
          [current.lead_id, agentEmail],
        );
        console.warn("[LEASE_SYNC] auto-released stale active assignment", {
          agentEmail,
          queue,
          assignmentId: current.id,
          leadId: current.lead_id,
          assignedAt: current.assigned_at,
          staleForMs: Number.isFinite(assignedMs) ? Date.now() - assignedMs : null,
        });
      }

      const currentLead = lockedLead.rows[0] ? { rows: [] as Record<string, unknown>[] } : await client.query<Record<string, unknown>>(
        `
          SELECT *
          FROM masterlead
          WHERE id = $1
            AND lower(trim(coalesce(cn_email, ''))) = $2
            AND lower(trim(coalesce(cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          LIMIT 1
        `,
        [current.lead_id, agentEmail],
      );

      if (currentLead.rows[0] && isLeadInsideCallingWindow(currentLead.rows[0])) {
        const backupLeads = await getNextQueuedLeadsForAgent(client, agentEmail, queue, LEASEDIALER_CLIENT_BUFFER_LEADS, callableStates);
        await client.query("COMMIT");
        void refillQueuedLeadsInBackground({ agentEmail, queue });
        return {
          reused: true,
          assigned: false,
          assignmentId: current.id,
          lead: currentLead.rows[0],
          backupLead: backupLeads[0] || null,
          backupLeads,
        };
      }

      if (currentLead.rows[0]) {
        await client.query(
          `
            UPDATE masterlead
            SET cn_email = NULL,
                assigned_date = NULL,
                updated_at = NOW()
            WHERE id = $1
              AND lower(trim(coalesce(cn_email, ''))) = $2
              AND lower(trim(coalesce(cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          `,
          [current.lead_id, agentEmail],
        );
      }

      await client.query(
        `
          UPDATE leasedialer_assignments
          SET status = $2,
              released_at = NOW(),
              release_reason = $3,
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          current.id,
          currentLead.rows[0] ? "released" : "completed",
          currentLead.rows[0] ? "outside_calling_window" : "lead_not_callable",
        ],
      );
    }

    const queued = await client.query<Record<string, unknown>>(
      `
        SELECT
          la.id AS assignment_id,
          la.lead_id AS assignment_lead_id,
          ml.*
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE la.agent_email = $1
          AND la.queue = $2
          AND la.status = 'queued'
          AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($3::text[])
          AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = $1)
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND ${GLOBE_CALLABLE_MAX_AGE_INTERVAL_SQL}
        ORDER BY
          ml.created_at DESC NULLS LAST,
          NULLIF(regexp_replace(coalesce(ml.taalk_lead_id::text, ''), '\\D', '', 'g'), '')::bigint DESC NULLS LAST,
          la.assigned_at ASC,
          la.created_at ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `,
      [agentEmail, queue, callableStates],
    );

    const outsideWindowQueued = queued.rows.filter((row) => !isLeadInsideCallingWindow(row));
    if (outsideWindowQueued.length > 0) {
      sawNonCallableQueueRows = true;
      const outsideAssignmentIds = outsideWindowQueued.map((row) => String(row.assignment_id));
      const outsideLeadIds = outsideWindowQueued.map((row) => Number(row.assignment_lead_id || row.lead_id)).filter(Number.isFinite);
      await client.query(
        `
          UPDATE leasedialer_assignments
          SET status = 'released',
              released_at = NOW(),
              release_reason = 'outside_calling_window',
              updated_at = NOW()
          WHERE id = ANY($1::uuid[])
        `,
        [outsideAssignmentIds],
      );
      if (outsideLeadIds.length > 0) {
        await client.query(
          `
            UPDATE masterlead
            SET cn_email = NULL,
                assigned_date = NULL,
                updated_at = NOW()
            WHERE id = ANY($1::bigint[])
              AND lower(trim(coalesce(cn_email, ''))) = $2
              AND lower(trim(coalesce(cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          `,
          [outsideLeadIds, agentEmail],
        );
      }
    }

    const badQueuedLeadIds = queued.rows
      .filter((row: any) => !isActiveLeaseLeadStillCallable(row, agentEmail, queue))
      .map((row) => Number(row.assignment_lead_id || row.lead_id))
      .filter(Number.isFinite);
    if (badQueuedLeadIds.length > 0) {
      sawNonCallableQueueRows = true;
      await client.query(
        `
          UPDATE leasedialer_assignments
          SET status = 'completed',
              released_at = NOW(),
              release_reason = 'queued_lead_not_callable',
              updated_at = NOW()
          WHERE agent_email = $1
            AND queue = $2
            AND status = 'queued'
            AND lead_id = ANY($3::bigint[])
        `,
        [agentEmail, queue, badQueuedLeadIds],
      );
      queued.rows = queued.rows.filter((row) => !badQueuedLeadIds.includes(Number(row.assignment_lead_id || row.lead_id)));
    }

    let queuedLead = queued.rows.find((row) => isLeadInsideCallingWindow(row));
    if (queuedLead) {
      queued.rows[0] = queuedLead;
    }
    if (!queuedLead) {
      let refillTimedOut = false;
      try {
        await warmEligiblePoolForSingleBucket(client, { queue, routing });
        await fillQueuedLeadsForAgent(client, {
          agentEmail,
          queue,
          routing,
          targetQueued: LEASEDIALER_CLIENT_BUFFER_LEADS,
        });

        const refilled = await client.query<Record<string, unknown>>(
          `
            SELECT
              la.id AS assignment_id,
              la.lead_id AS assignment_lead_id,
              ml.*
            FROM leasedialer_assignments la
            JOIN masterlead ml ON ml.id = la.lead_id
            WHERE la.agent_email = $1
              AND la.queue = $2
              AND la.status = 'queued'
              AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($3::text[])
              AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = $1)
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND ${GLOBE_CALLABLE_MAX_AGE_INTERVAL_SQL}
            ORDER BY
              ml.created_at DESC NULLS LAST,
              NULLIF(regexp_replace(coalesce(ml.taalk_lead_id::text, ''), '\\D', '', 'g'), '')::bigint DESC NULLS LAST,
              la.assigned_at ASC,
              la.created_at ASC
            LIMIT 50
            FOR UPDATE SKIP LOCKED
          `,
          [agentEmail, queue, callableStates],
        );
        queuedLead = refilled.rows.find((row) => isLeadInsideCallingWindow(row));
        if (queuedLead) {
          queued.rows[0] = queuedLead;
        }
      } catch (error) {
        if (!isQueryTimeoutError(error)) throw error;
        refillTimedOut = true;
      }

      if (!queuedLead || refillTimedOut) {
        await client.query("ROLLBACK");
        const failOpen = await tryDirectFailOpenLeaseAssignment({
          agentEmail,
          queue,
          routing,
          callableStates,
        });
        if (failOpen?.lead) {
          return {
            reused: false,
            assigned: true,
            assignmentId: failOpen.assignmentId,
            lead: failOpen.lead,
            backupLead: failOpen.backupLeads[0] || null,
            backupLeads: failOpen.backupLeads,
            reason: refillTimedOut ? "FAIL_OPEN_DIRECT_ASSIGNMENT" : undefined,
          };
        }
        void refillQueuedLeadsInBackground({ agentEmail, queue });
        return {
          reused: false,
          assigned: false,
          assignmentId: null,
          lead: null,
          backupLead: null,
          backupLeads: [],
          reason: sawNonCallableQueueRows ? "NO_CALLABLE_LEADS" : "NO_ELIGIBLE_LEADS",
        };
      }
    }

    const leadToActivate = queued.rows[0];
    if (!leadToActivate) {
      await client.query("ROLLBACK");
      return {
        reused: false,
        assigned: false,
        assignmentId: null,
        lead: null,
        backupLead: null,
        backupLeads: [],
        reason: sawNonCallableQueueRows ? "NO_CALLABLE_LEADS" : "NO_ELIGIBLE_LEADS",
      };
    }

    const activated = await client.query<{ id: string }>(
      `
        UPDATE leasedialer_assignments
        SET status = 'active',
            assigned_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [String(leadToActivate.assignment_id)],
    );

    const leadRow = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM masterlead
        WHERE id = $1
        LIMIT 1
      `,
      [Number(leadToActivate.assignment_lead_id || leadToActivate.lead_id)],
    );

    const backupLeads = await getNextQueuedLeadsForAgent(client, agentEmail, queue, LEASEDIALER_CLIENT_BUFFER_LEADS, callableStates);
    await client.query("COMMIT");
    void refillQueuedLeadsInBackground({ agentEmail, queue });
    return {
      reused: false,
      assigned: true,
      assignmentId: activated.rows[0]?.id ?? null,
      lead: leadRow.rows[0] || null,
      backupLead: backupLeads[0] || null,
      backupLeads,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure when transaction already aborted
    }
    if (isQueryTimeoutError(error)) {
      const failOpen = await tryDirectFailOpenLeaseAssignment({
        agentEmail,
        queue,
        routing,
        callableStates,
      });
      if (failOpen?.lead) {
        return {
          reused: false,
          assigned: true,
          assignmentId: failOpen.assignmentId,
          lead: failOpen.lead,
          backupLead: failOpen.backupLeads[0] || null,
          backupLeads: failOpen.backupLeads,
          reason: "FAIL_OPEN_DIRECT_ASSIGNMENT",
        };
      }
      return {
        reused: false,
        assigned: false,
        assignmentId: null,
        lead: null,
        backupLead: null,
        backupLeads: [],
        reason: sawNonCallableQueueRows ? "NO_CALLABLE_LEADS" : "NO_ELIGIBLE_LEADS",
      };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseLeaseDialerAssignmentByLeadAndAgent(input: {
  leadId: number;
  agentEmail: string;
  reason?: string;
}): Promise<{ success: boolean; releasedCount: number; ownerClearedCount: number }> {
  const agentEmail = normalizeEmail(input.agentEmail);
  const result = await dispositionWritePool.query<{ released_count: number; owner_cleared_count: number }>(
    `
      WITH released AS (
        UPDATE leasedialer_assignments
        SET status = 'completed',
            released_at = NOW(),
            release_reason = $3,
            updated_at = NOW()
        WHERE lead_id = $1
          AND lower(agent_email) = lower($2)
          AND status IN ('active', 'queued')
        RETURNING lead_id
      ),
      cleared_owner AS (
        UPDATE masterlead ml
        SET cn_email = NULL,
            assigned_date = NULL,
            updated_at = NOW()
        WHERE ml.id = $1
          AND lower(trim(coalesce(ml.cn_email, ''))) = lower($2)
        RETURNING ml.id
      )
      SELECT
        (SELECT COUNT(*)::int FROM released) AS released_count,
        (SELECT COUNT(*)::int FROM cleared_owner) AS owner_cleared_count
    `,
    [input.leadId, agentEmail, input.reason || "released"],
  );

  const releasedCount = Number(result.rows[0]?.released_count || 0);
  const ownerClearedCount = Number(result.rows[0]?.owner_cleared_count || 0);
  return {
    success: releasedCount > 0 || ownerClearedCount > 0,
    releasedCount,
    ownerClearedCount,
  };
}

export async function releaseLeaseDialerAssignmentBackToPool(input: {
  leadId: number;
  agentEmail: string;
  reason?: string;
}): Promise<{ success: boolean; releasedCount: number; ownerClearedCount: number }> {
  const agentEmail = normalizeEmail(input.agentEmail);
  const reason = input.reason || "released_to_pool";
  const result = await dispositionWritePool.query<{ released_count: number; owner_cleared_count: number }>(
    `
      WITH released AS (
        UPDATE leasedialer_assignments
        SET status = 'released',
            released_at = NOW(),
            release_reason = $3,
            updated_at = NOW()
        WHERE lead_id = $1
          AND lower(agent_email) = lower($2)
          AND status IN ('active', 'queued')
        RETURNING lead_id
      ),
      cleared_owner AS (
        UPDATE masterlead ml
        SET cn_email = NULL,
            assigned_date = NULL,
            updated_at = NOW()
        WHERE ml.id = $1
          AND lower(trim(coalesce(ml.cn_email, ''))) = lower($2)
        RETURNING ml.id
      ),
      pool_reset AS (
        UPDATE leasedialer_eligible_pool ep
        SET status = 'ready',
            claimed_by_agent_email = NULL,
            claimed_assignment_id = NULL,
            claimed_at = NULL,
            updated_at = NOW()
        FROM released r
        JOIN masterlead ml ON ml.id = r.lead_id
        WHERE ep.lead_id = r.lead_id
          AND ep.status = 'claimed'
          AND lower(coalesce(ep.claimed_by_agent_email, '')) = lower($2)
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        RETURNING ep.lead_id
      )
      SELECT
        (SELECT COUNT(*)::int FROM released) AS released_count,
        (SELECT COUNT(*)::int FROM cleared_owner) AS owner_cleared_count
    `,
    [input.leadId, agentEmail, reason],
  );

  const releasedCount = Number(result.rows[0]?.released_count || 0);
  const ownerClearedCount = Number(result.rows[0]?.owner_cleared_count || 0);
  return {
    success: releasedCount > 0 || ownerClearedCount > 0,
    releasedCount,
    ownerClearedCount,
  };
}



