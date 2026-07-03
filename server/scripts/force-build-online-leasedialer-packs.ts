import pg from 'pg/lib/index.js';
import { supabaseAdmin } from '../supabase';
import { DATABASE_URL } from '../hardcoded-config';

const { Pool } = pg;

const LOOKBACK_MINUTES = Number(process.env.ONLINE_LOOKBACK_MINUTES || 15);
const TARGET_QUEUED = Number(process.env.TARGET_QUEUED || 100);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 100);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 0,
  query_timeout: 0,
});

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeState(value: unknown): string {
  return String(value || '').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
}

function normalizeMarket(value: unknown): string {
  const raw = String(value || '').trim();
  const compact = raw.toLowerCase().replace(/\s+/g, '');
  if (compact.includes('globe')) return 'Globe Market';
  if (compact.includes('veteran')) return 'Veteran';
  return raw;
}

function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean);
  } catch {
    // fall through
  }
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

async function getOnlineAgents(): Promise<string[]> {
  const explicitAgents = String(process.env.AGENTS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(email => email.includes('@'));
  if (explicitAgents.length > 0) {
    return Array.from(new Set(explicitAgents));
  }

  if (!supabaseAdmin) throw new Error('supabaseAdmin unavailable');
  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('agent_live_call_status')
    .select('agent_email,status,last_heartbeat_at,updated_at,ccpro_enabled')
    .gte('last_heartbeat_at', since)
    .in('status', ['available', 'in_call']);

  // Mirror leasedialer-assignment-service behavior: do not require ccpro_enabled=true
  // and allow either fresh heartbeat OR fresh updated_at.
  const { data: fallbackData, error: fallbackError } = await supabaseAdmin
    .from('agent_live_call_status')
    .select('agent_email,status,last_heartbeat_at,updated_at,ccpro_enabled')
    .in('status', ['available', 'in_call'])
    .or(`last_heartbeat_at.gte.${since},updated_at.gte.${since}`);

  if (!error && data && data.length > 0) {
    return Array.from(new Set((data || []).map((row: any) => normalizeEmail(row.agent_email)).filter(email => email.includes('@'))));
  }

  if (!fallbackError && fallbackData && fallbackData.length > 0) {
    return Array.from(new Set((fallbackData || []).map((row: any) => normalizeEmail(row.agent_email)).filter(email => email.includes('@'))));
  }

  if (error) throw error;
  if (fallbackError) throw fallbackError;
  return [];
}

async function forceBuildForAgent(agentEmail: string): Promise<Record<string, unknown>> {
  const profile = await pool.query(
    `SELECT markets, states FROM agent_routing_profiles WHERE lower(agent_email)=lower($1) LIMIT 1`,
    [agentEmail],
  );
  const profileRow = profile.rows[0];
  if (!profileRow) return { agentEmail, skipped: 'missing_profile' };

  const markets = Array.from(new Set(parseArray(profileRow.markets).map(normalizeMarket).filter(Boolean)));
  const states = Array.from(new Set(parseArray(profileRow.states).map(normalizeState).filter(Boolean)));
  if (!markets.length || !states.length) return { agentEmail, skipped: 'empty_profile', markets, states };

  const reset = await pool.query(
    `
      WITH q AS (
        SELECT ml.id
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id=la.lead_id
        WHERE lower(la.agent_email)=lower($1)
          AND la.queue='hotlead'
          AND la.status='queued'
          AND lower(trim(coalesce(ml.cnresolution,''))) IN ('called','call','no_answer','no answer','no_answer_vm','voicemail','left voicemail','pending','new','','null')
      )
      UPDATE masterlead ml
      SET cn_email=NULL,
          cnresolution='pending',
          assigned_date=NULL,
          updated_at=NOW()
      FROM q
      WHERE ml.id=q.id
      RETURNING ml.id
    `,
    [agentEmail],
  );

  const completeBad = await pool.query(
    `
      UPDATE leasedialer_assignments la
      SET status='completed',
          released_at=NOW(),
          release_reason='non_resettable_resolution_removed_for_online_force_build',
          updated_at=NOW()
      FROM masterlead ml
      WHERE ml.id=la.lead_id
        AND lower(la.agent_email)=lower($1)
        AND la.queue='hotlead'
        AND la.status='queued'
        AND lower(trim(coalesce(ml.cnresolution,''))) NOT IN ('pending','new','','null')
      RETURNING la.lead_id
    `,
    [agentEmail],
  );

  const queuedBefore = await pool.query(
    `SELECT COUNT(*)::int AS count FROM leasedialer_assignments WHERE lower(agent_email)=lower($1) AND queue='hotlead' AND status='queued'`,
    [agentEmail],
  );
  const currentQueued = Number(queuedBefore.rows[0]?.count || 0);
  const needed = Math.max(0, TARGET_QUEUED - currentQueued);

  let inserted = 0;
  if (needed > 0) {
    const claim = await pool.query(
      `
        WITH picked AS (
          SELECT ep.id, ep.lead_id
          FROM leasedialer_eligible_pool ep
          WHERE ep.queue='hotlead'
            AND ep.status='ready'
            AND ep.market=ANY($2::text[])
            AND ep.state=ANY($3::text[])
            AND NOT EXISTS (
              SELECT 1
              FROM leasedialer_assignments la
              WHERE la.lead_id=ep.lead_id
                AND la.status IN ('queued','active')
            )
          ORDER BY ep.lead_received_at DESC NULLS LAST, ep.lead_id DESC
          LIMIT $4
        ),
        claimed AS (
          UPDATE leasedialer_eligible_pool ep
          SET status='claimed',
              claimed_by_agent_email=$1,
              claimed_at=NOW(),
              updated_at=NOW()
          FROM picked p
          WHERE ep.id=p.id
          RETURNING ep.lead_id
        ),
        inserted AS (
          INSERT INTO leasedialer_assignments (lead_id, agent_email, queue, status, assigned_at, created_at, updated_at)
          SELECT lead_id, $1, 'hotlead', 'queued', NOW(), NOW(), NOW()
          FROM claimed
          ON CONFLICT DO NOTHING
          RETURNING lead_id
        )
        SELECT COUNT(*)::int AS inserted FROM inserted
      `,
      [agentEmail, markets, states, Math.min(BATCH_SIZE, needed)],
    );
    inserted = Number(claim.rows[0]?.inserted || 0);

    await pool.query(
      `
        WITH q AS (
          SELECT ml.id
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id=la.lead_id
          WHERE lower(la.agent_email)=lower($1)
            AND la.queue='hotlead'
            AND la.status='queued'
            AND lower(trim(coalesce(ml.cnresolution,''))) IN ('called','call','no_answer','no answer','no_answer_vm','voicemail','left voicemail','pending','new','','null')
        )
        UPDATE masterlead ml
        SET cn_email=NULL,
            cnresolution='pending',
            assigned_date=NULL,
            updated_at=NOW()
        FROM q
        WHERE ml.id=q.id
      `,
      [agentEmail],
    );
  }

  const queuedAfter = await pool.query(
    `SELECT COUNT(*)::int AS count FROM leasedialer_assignments WHERE lower(agent_email)=lower($1) AND queue='hotlead' AND status='queued'`,
    [agentEmail],
  );

  return {
    agentEmail,
    markets,
    states: states.length,
    resetQueued: reset.rowCount || 0,
    completedBad: completeBad.rowCount || 0,
    queuedBefore: currentQueued,
    inserted,
    queuedAfter: Number(queuedAfter.rows[0]?.count || 0),
  };
}

(async () => {
  const agents = await getOnlineAgents();
  console.log(JSON.stringify({ event: 'online_force_build_start', agents: agents.length, targetQueued: TARGET_QUEUED, at: new Date().toISOString() }));

  const results: Record<string, unknown>[] = [];
  for (const agentEmail of agents) {
    try {
      const result = await forceBuildForAgent(agentEmail);
      results.push(result);
      console.log(JSON.stringify({ event: 'online_force_build_agent', ...result }));
    } catch (error: any) {
      const result = { agentEmail, error: error?.message || String(error) };
      results.push(result);
      console.log(JSON.stringify({ event: 'online_force_build_error', ...result }));
    }
  }

  console.log(JSON.stringify({ event: 'online_force_build_complete', results, at: new Date().toISOString() }));
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
