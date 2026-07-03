import pg from "pg";

const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const API_BASE = process.env.LEAD_API_BASE || "https://aoirail-production.up.railway.app";
const WAIT_MINUTES = Math.max(1, Math.min(120, Number(process.argv[2] || 30)));
const LIMIT = Math.max(1, Math.min(200, Number(process.argv[3] || 80)));
const CONCURRENCY = Math.max(1, Math.min(25, Number(process.argv[4] || 10)));
const REQUEST_TIMEOUT_MS = Math.max(3000, Math.min(60000, Number(process.env.LEAD_API_TIMEOUT_MS || 20000)));

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timeout ${ms}ms`)), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchWaitingAndBlockers(client) {
  const waitingRes = await client.query(
    `
      SELECT
        lower(agent_email) AS agent_email,
        COALESCE(local_leased_lead_count, 0)::int AS local_leased_lead_count,
        updated_at
      FROM leasedialer_client_status
      WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 minute')
        AND COALESCE(local_leased_lead_count, 0) = 0
      ORDER BY updated_at DESC NULLS LAST, lower(agent_email) ASC
      LIMIT $2
    `,
    [WAIT_MINUTES, LIMIT],
  );

  const blockerRes = await client.query(
    `
      WITH recent_zero AS (
        SELECT lower(agent_email) AS agent_email, updated_at
        FROM leasedialer_client_status
        WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 minute')
          AND COALESCE(local_leased_lead_count, 0) = 0
      ),
      profile AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          ARRAY(
            SELECT upper(regexp_replace(s, '[^A-Za-z]', '', 'g'))
            FROM unnest(COALESCE(states, ARRAY[]::text[])) s
            WHERE upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) <> ''
          ) AS states
        FROM agent_routing_profiles
        ORDER BY lower(agent_email), updated_at DESC
      ),
      q AS (
        SELECT
          rz.agent_email,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue = 'hotlead'
          )::int AS raw_queue_rows,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue = 'hotlead'
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = rz.agent_email
              )
          )::int AS callable_rows,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue = 'hotlead'
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = rz.agent_email
              )
              AND p.states IS NOT NULL
              AND array_length(p.states, 1) IS NOT NULL
              AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY(p.states)
          )::int AS strict_callable_rows,
          p.states AS profile_states
        FROM recent_zero rz
        LEFT JOIN profile p ON p.agent_email = rz.agent_email
        LEFT JOIN leasedialer_assignments la ON lower(la.agent_email) = rz.agent_email
        LEFT JOIN masterlead ml ON ml.id = la.lead_id
        GROUP BY rz.agent_email, p.states
      )
      SELECT
        agent_email,
        raw_queue_rows,
        callable_rows,
        strict_callable_rows,
        CASE
          WHEN profile_states IS NULL OR array_length(profile_states, 1) IS NULL THEN 'missing_profile_states'
          WHEN raw_queue_rows = 0 THEN 'no_queue_rows'
          WHEN callable_rows = 0 THEN 'all_rows_non_callable'
          WHEN strict_callable_rows = 0 THEN 'queue_poisoned_state_mismatch'
          ELSE 'other'
        END AS blocker
      FROM q
    `,
    [WAIT_MINUTES],
  );

  const blockerMap = new Map(blockerRes.rows.map((row) => [row.agent_email, row]));
  return { waiting: waitingRes.rows, blockerMap };
}

async function callLeadApi(agentEmail) {
  const body = { agentEmail, queue: "hotlead", status: "available" };
  const endpoint = `${API_BASE}/api/leads/signal-online-and-request`;
  const { signal, clear } = timeoutSignal(REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: -1,
      payload: { error: String(error?.message || error) },
    };
  } finally {
    clear();
  }
}

async function runConcurrent(items, worker, concurrency) {
  const results = [];
  let cursor = 0;
  async function runner() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runner()));
  return results;
}

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const { waiting, blockerMap } = await fetchWaitingAndBlockers(client);
    const rows = await runConcurrent(
      waiting,
      async (agent) => {
        const api = await callLeadApi(agent.agent_email);
        const blocker = blockerMap.get(agent.agent_email) || null;
        return {
          agent_email: agent.agent_email,
          updated_at: agent.updated_at,
          api_ok: api.ok,
          api_status: api.status,
          warmed: Number(api?.payload?.warmed ?? 0),
          warmReason: api?.payload?.warmReason ?? null,
          api_error: api.ok ? null : api?.payload?.error || api?.payload || "api_error",
          blocker: blocker?.blocker || "not_classified",
          raw_queue_rows: blocker?.raw_queue_rows ?? null,
          callable_rows: blocker?.callable_rows ?? null,
          strict_callable_rows: blocker?.strict_callable_rows ?? null,
        };
      },
      CONCURRENCY,
    );

    const summary = {
      ranAt: new Date().toISOString(),
      waitMinutes: WAIT_MINUTES,
      waiting_count: waiting.length,
      api_calls: rows.length,
      warmed_gt0: rows.filter((r) => r.warmed > 0).length,
      warmed_eq0: rows.filter((r) => r.warmed === 0).length,
      api_errors: rows.filter((r) => !r.api_ok).length,
    };

    const blockerCounts = Object.entries(
      rows.reduce((acc, row) => {
        acc[row.blocker] = (acc[row.blocker] || 0) + 1;
        return acc;
      }, {}),
    )
      .map(([blocker, count]) => ({ blocker, count }))
      .sort((a, b) => b.count - a.count);

    console.log(JSON.stringify({ summary, blocker_counts: blockerCounts, rows }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
