import { pool } from "./db";

export type LeaseStatus = "active" | "released" | "expired" | "recalled";

export type LeaseModeContext = {
  enabled: boolean;
  allowlist: Set<string>;
};

export type NextLeaseInput = {
  agentEmail: string;
  markets?: string[];
  states?: string[];
  queue?: "hotlead" | "plus" | "my-leads" | string;
};

type LeaseRow = {
  id: string;
  lead_id: number;
  agent_email: string;
  status: LeaseStatus;
  leased_at: string;
  heartbeat_at: string;
  expires_at: string;
  released_at: string | null;
  release_reason: string | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_LEASE_TTL_SECONDS = Number(process.env.OUTBOUND_LEASE_TTL_SECONDS || "90");
const DEFAULT_HEARTBEAT_EXTENSION_SECONDS = Number(process.env.OUTBOUND_LEASE_HEARTBEAT_EXTENSION_SECONDS || "90");
const DEFAULT_HEARTBEAT_STALE_GRACE_SECONDS = Number(process.env.OUTBOUND_LEASE_HEARTBEAT_STALE_GRACE_SECONDS || "15");

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function normalizeList(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => value.toUpperCase());
}

function normalizeMarketList(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function parseCsvAllowlist(value: string | undefined): Set<string> {
  if (!value) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((part) => normalizeEmail(part))
      .filter(Boolean),
  );
}

export function getLeaseModeContext(): LeaseModeContext {
  const enabled = String(process.env.OUTBOUND_LEASE_MODE || "false").toLowerCase() === "true";
  const allowlist = parseCsvAllowlist(process.env.OUTBOUND_LEASE_AGENT_ALLOWLIST);
  return { enabled, allowlist };
}

export function isLeaseModeEnabledForAgent(agentEmail: string): boolean {
  const normalized = normalizeEmail(agentEmail);
  const { enabled, allowlist } = getLeaseModeContext();
  if (!enabled) return false;
  if (allowlist.size === 0) return true;
  return allowlist.has(normalized);
}

export async function ensureLeadLeaseTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_leases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id BIGINT NOT NULL,
      agent_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      leased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      released_at TIMESTAMPTZ NULL,
      release_reason TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT lead_leases_status_check CHECK (status IN ('active', 'released', 'expired', 'recalled'))
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_leases_status_expires_at
      ON lead_leases (status, expires_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_leases_agent_status
      ON lead_leases (agent_email, status);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_leases_active_lead
      ON lead_leases (lead_id)
      WHERE status = 'active';
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_leases_active_agent
      ON lead_leases (agent_email)
      WHERE status = 'active';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_routing_profiles (
      agent_email TEXT PRIMARY KEY,
      markets TEXT[] NOT NULL DEFAULT '{}',
      states TEXT[] NOT NULL DEFAULT '{}',
      source TEXT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function upsertAgentRoutingProfile(input: {
  agentEmail: string;
  markets?: string[];
  states?: string[];
  source?: string;
}): Promise<void> {
  const agentEmail = normalizeEmail(input.agentEmail);
  const markets = normalizeMarketList(input.markets);
  const states = normalizeList(input.states);
  await pool.query(
    `
    INSERT INTO agent_routing_profiles (agent_email, markets, states, source, updated_at)
    VALUES ($1, $2::text[], $3::text[], $4, NOW())
    ON CONFLICT (agent_email)
    DO UPDATE SET
      markets = EXCLUDED.markets,
      states = EXCLUDED.states,
      source = EXCLUDED.source,
      updated_at = NOW()
    `,
    [agentEmail, markets, states, input.source || "unknown"],
  );
}

async function getRoutingProfile(agentEmail: string): Promise<{ markets: string[]; states: string[] } | null> {
  const normalized = normalizeEmail(agentEmail);
  const result = await pool.query<{ markets: string[] | null; states: string[] | null }>(
    `
    SELECT markets, states
    FROM agent_routing_profiles
    WHERE agent_email = $1
    LIMIT 1
    `,
    [normalized],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    markets: Array.isArray(row.markets) ? row.markets : [],
    states: Array.isArray(row.states) ? row.states : [],
  };
}

export async function getActiveLeaseForAgent(agentEmail: string): Promise<LeaseRow | null> {
  const normalized = normalizeEmail(agentEmail);
  const result = await pool.query<LeaseRow>(
    `
    SELECT *
    FROM lead_leases
    WHERE agent_email = $1
      AND status = 'active'
      AND expires_at > NOW()
    ORDER BY leased_at DESC
    LIMIT 1
    `,
    [normalized],
  );
  return result.rows[0] || null;
}

export async function getLeaseLead(leaseId: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query<Record<string, unknown>>(
    `
    SELECT ml.*
    FROM lead_leases ll
    JOIN masterlead ml ON ml.id = ll.lead_id
    WHERE ll.id = $1
    LIMIT 1
    `,
    [leaseId],
  );
  return result.rows[0] || null;
}

function buildMarketFilter(markets: string[], params: unknown[]): string {
  if (markets.length === 0) return "";
  params.push(markets);
  const idx = params.length;
  return `AND (
    COALESCE(NULLIF(TRIM(ml.taalk_market), ''), NULLIF(TRIM(ml.market), '')) IS NULL
    OR COALESCE(NULLIF(TRIM(ml.taalk_market), ''), NULLIF(TRIM(ml.market), '')) = ANY($${idx}::text[])
  )`;
}

function buildStateFilter(states: string[], params: unknown[]): string {
  if (states.length === 0) return "";
  params.push(states);
  const idx = params.length;
  return `AND UPPER(COALESCE(NULLIF(TRIM(ml.taalk_state), ''), NULLIF(TRIM(ml.state), ''), '')) = ANY($${idx}::text[])`;
}

function buildQueueFilter(queue: string | undefined): string {
  const normalized = String(queue || "").toLowerCase().trim();
  if (normalized === "plus") {
    return "AND (LOWER(COALESCE(ml.taalk_market, '')) LIKE '%plus%' OR LOWER(COALESCE(ml.market, '')) LIKE '%plus%')";
  }
  if (normalized === "hotlead" || normalized === "hot" || normalized === "ao-queue") {
    return "AND COALESCE(ml.is_hot_lead::text, 'false') IN ('true','1')";
  }
  return "";
}

export async function getOrCreateNextLease(input: NextLeaseInput): Promise<{
  reused: boolean;
  lease: LeaseRow;
  lead: Record<string, unknown> | null;
}> {
  const normalizedEmail = normalizeEmail(input.agentEmail);
  const requestedMarkets = normalizeMarketList(input.markets);
  const requestedStates = normalizeList(input.states);

  const profile = await getRoutingProfile(normalizedEmail);
  const markets = requestedMarkets.length > 0 ? requestedMarkets : profile?.markets || [];
  const states = requestedStates.length > 0 ? requestedStates : profile?.states || [];

  if (markets.length === 0 || states.length === 0) {
    throw new Error("MISSING_ROUTING_PROFILE");
  }

  const existing = await getActiveLeaseForAgent(normalizedEmail);
  if (existing) {
    const lead = await getLeaseLead(existing.id);
    return { reused: true, lease: existing, lead };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const recheck = await client.query<LeaseRow>(
      `
      SELECT *
      FROM lead_leases
      WHERE agent_email = $1
        AND status = 'active'
        AND expires_at > NOW()
      ORDER BY leased_at DESC
      LIMIT 1
      `,
      [normalizedEmail],
    );
    if (recheck.rows[0]) {
      await client.query("COMMIT");
      const lead = await getLeaseLead(recheck.rows[0].id);
      return { reused: true, lease: recheck.rows[0], lead };
    }

    const params: unknown[] = [normalizedEmail];
    const marketFilter = buildMarketFilter(markets, params);
    const stateFilter = buildStateFilter(states, params);
    const queueFilter = buildQueueFilter(input.queue);
    const heartbeatGraceExpr = `${Math.max(0, DEFAULT_HEARTBEAT_STALE_GRACE_SECONDS)} seconds`;

    const candidateQuery = `
      SELECT ml.id
      FROM masterlead ml
      WHERE COALESCE(ml.dnc::text, 'false') NOT IN ('true','1')
        AND COALESCE(ml.is_time_locked::text, 'false') NOT IN ('true','1')
        AND COALESCE(ml.currently_calling::text, 'false') NOT IN ('true','1')
        AND COALESCE(ml."TaalkResolve"::text, 'false') NOT IN ('true','1')
        AND LOWER(COALESCE(TRIM(ml.cnresolution), 'pending')) IN ('pending', 'new', '', 'null')
        ${queueFilter}
        ${marketFilter}
        ${stateFilter}
        AND NOT EXISTS (
          SELECT 1
          FROM lead_leases ll
          WHERE ll.lead_id = ml.id
            AND ll.status = 'active'
            AND ll.expires_at > NOW() - INTERVAL '${heartbeatGraceExpr}'
        )
      ORDER BY
        COALESCE(ml.priority_score, 0) DESC,
        COALESCE(ml.last_contacted, TO_TIMESTAMP(0)) ASC,
        ml.id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;

    const candidate = await client.query<{ id: number }>(candidateQuery, params);
    const leadId = candidate.rows[0]?.id;
    if (!leadId) {
      await client.query("ROLLBACK");
      throw new Error("NO_ELIGIBLE_LEADS");
    }

    const leaseInsert = await client.query<LeaseRow>(
      `
      INSERT INTO lead_leases (
        lead_id,
        agent_email,
        status,
        leased_at,
        heartbeat_at,
        expires_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'active',
        NOW(),
        NOW(),
        NOW() + ($3 || ' seconds')::interval,
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [leadId, normalizedEmail, String(DEFAULT_LEASE_TTL_SECONDS)],
    );

    await client.query("COMMIT");
    const lease = leaseInsert.rows[0];
    const lead = await getLeaseLead(lease.id);
    return { reused: false, lease, lead };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function heartbeatLease(input: {
  leaseId: string;
  agentEmail: string;
}): Promise<{ success: boolean; lease: LeaseRow | null }> {
  const normalizedEmail = normalizeEmail(input.agentEmail);
  const updated = await pool.query<LeaseRow>(
    `
    UPDATE lead_leases
    SET
      heartbeat_at = NOW(),
      expires_at = NOW() + ($3 || ' seconds')::interval,
      updated_at = NOW()
    WHERE id = $1
      AND agent_email = $2
      AND status = 'active'
      AND expires_at > NOW()
    RETURNING *
    `,
    [input.leaseId, normalizedEmail, String(DEFAULT_HEARTBEAT_EXTENSION_SECONDS)],
  );
  return {
    success: updated.rows.length > 0,
    lease: updated.rows[0] || null,
  };
}

export async function releaseLease(input: {
  leaseId: string;
  actorEmail: string;
  reason: string;
  allowAdminOverride?: boolean;
}): Promise<{ success: boolean; lease: LeaseRow | null }> {
  const normalizedEmail = normalizeEmail(input.actorEmail);
  let query = `
    UPDATE lead_leases
    SET
      status = CASE WHEN status = 'active' THEN 'released' ELSE status END,
      released_at = COALESCE(released_at, NOW()),
      release_reason = $3,
      updated_at = NOW()
    WHERE id = $1
      AND status = 'active'
  `;
  const params: unknown[] = [input.leaseId, normalizedEmail, input.reason];
  if (input.allowAdminOverride) {
    query += ` AND (agent_email = $2 OR $4 = true)`;
    params.push(true);
  } else {
    query += ` AND agent_email = $2`;
  }
  query += ` RETURNING *`;
  const updated = await pool.query<LeaseRow>(query, params);
  return {
    success: updated.rows.length > 0,
    lease: updated.rows[0] || null,
  };
}

export async function validateActiveLeaseOwnership(input: {
  leadId: number;
  agentEmail: string;
}): Promise<{ ok: boolean; leaseId?: string; reason?: string }> {
  const normalizedEmail = normalizeEmail(input.agentEmail);
  const result = await pool.query<LeaseRow>(
    `
    SELECT *
    FROM lead_leases
    WHERE lead_id = $1
      AND status = 'active'
      AND expires_at > NOW()
    LIMIT 1
    `,
    [input.leadId],
  );
  const lease = result.rows[0];
  if (!lease) return { ok: false, reason: "NO_ACTIVE_LEASE" };
  if (normalizeEmail(lease.agent_email) !== normalizedEmail) {
    return { ok: false, reason: "LEASE_OWNED_BY_OTHER_AGENT", leaseId: lease.id };
  }
  return { ok: true, leaseId: lease.id };
}

export async function releaseLeaseByLeadAndAgent(input: {
  leadId: number;
  agentEmail: string;
  reason: string;
}): Promise<{ success: boolean; lease: LeaseRow | null }> {
  const normalizedEmail = normalizeEmail(input.agentEmail);
  const updated = await pool.query<LeaseRow>(
    `
    UPDATE lead_leases
    SET
      status = 'released',
      released_at = NOW(),
      release_reason = $3,
      updated_at = NOW()
    WHERE lead_id = $1
      AND agent_email = $2
      AND status = 'active'
    RETURNING *
    `,
    [input.leadId, normalizedEmail, input.reason],
  );
  return {
    success: updated.rows.length > 0,
    lease: updated.rows[0] || null,
  };
}

export async function expireStaleLeases(): Promise<number> {
  const expired = await pool.query(
    `
    UPDATE lead_leases
    SET
      status = 'expired',
      released_at = NOW(),
      release_reason = COALESCE(release_reason, 'timeout'),
      updated_at = NOW()
    WHERE status = 'active'
      AND expires_at < NOW()
    `,
  );
  return Number(expired.rowCount || 0);
}
