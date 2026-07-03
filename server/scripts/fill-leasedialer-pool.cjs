#!/usr/bin/env node

/**
 * Fill leasedialer_eligible_pool from masterlead using primary-key cursor scans.
 *
 * This avoids expensive market/state table scans. It scans masterlead by id DESC,
 * filters rows in Node, and upserts clean rows into leasedialer_eligible_pool.
 *
 * Env:
 *   DATABASE_URL=...
 *   MARKET="Globe Market"
 *   STATES="CA,FL,NC,TX,VA,PA"
 *   TARGET=1000
 *   PAGE_SIZE=5000
 *   MAX_PAGES_PER_STATE=400
 *   UPSERT_BATCH=250
 */

const { Pool } = require("pg");

const MARKET = process.env.MARKET || "Globe Market";
const STATES = String(
  process.env.STATES ||
    "AL,AK,AZ,AR,CA,CO,CT,DE,FL,GA,HI,IA,ID,IL,IN,KS,KY,LA,MA,MD,ME,MI,MN,MO,MS,NC,ND,NE,NH,NJ,NM,NV,NY,OH,OK,OR,PA,RI,SC,SD,TN,TX,UT,VA,VT,WA,WI,WV,WY",
)
  .split(",")
  .map((state) => state.trim().toUpperCase())
  .filter(Boolean);

const TARGET = Number(process.env.TARGET || 1000);
const PAGE_SIZE = Number(process.env.PAGE_SIZE || 5000);
const MAX_PAGES_PER_STATE = Number(process.env.MAX_PAGES_PER_STATE || 400);
const UPSERT_BATCH = Number(process.env.UPSERT_BATCH || 250);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5000,
  query_timeout: 30000,
  statement_timeout: 30000,
});

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeState(value) {
  return clean(value).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
}

function truthy(value) {
  return ["true", "1", "yes", "y"].includes(clean(value).toLowerCase());
}

function resolutionOk(value) {
  return ["pending", "new", "", "null"].includes(clean(value || "pending").toLowerCase());
}

function isEligibleLead(row, state) {
  const market = clean(row.taalk_market) || clean(row.market);
  const leadState = normalizeState(row.taalk_state || row.state);

  return (
    market === MARKET &&
    leadState === state &&
    clean(row.taalk_lead_id) !== "" &&
    clean(row.cn_email) === "" &&
    resolutionOk(row.cnresolution) &&
    !truthy(row.dnc) &&
    !truthy(row.ftcrestricted) &&
    !truthy(row.FTCRESTRICTED) &&
    !truthy(row.currently_calling) &&
    !truthy(row.TaalkResolve)
  );
}

async function readyCount(state) {
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM leasedialer_eligible_pool
      WHERE queue = 'hotlead'
        AND market = $1
        AND state = $2
        AND status = 'ready'
    `,
    [MARKET, state],
  );
  return Number(result.rows[0]?.count || 0);
}

async function upsertPoolRows(state, rows) {
  if (!rows.length) return 0;

  const ids = rows.map((row) => Number(row.id)).filter(Number.isFinite);
  const created = rows.map((row) => new Date(row.created_at || Date.now()).toISOString());

  const result = await pool.query(
    `
      INSERT INTO leasedialer_eligible_pool (
        lead_id,
        queue,
        market,
        state,
        status,
        claimed_by_agent_email,
        claimed_assignment_id,
        claimed_at,
        lead_received_at,
        created_at,
        updated_at
      )
      SELECT
        picked.lead_id,
        'hotlead',
        $2,
        $3,
        'ready',
        NULL,
        NULL,
        NULL,
        picked.created_at,
        NOW(),
        NOW()
      FROM unnest($1::bigint[], $4::timestamptz[]) AS picked(lead_id, created_at)
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
    [ids, MARKET, state, created],
  );

  return result.rowCount || 0;
}

async function fillState(state) {
  let current = await readyCount(state);
  let inserted = 0;
  let pages = 0;
  let lastId = 9223372036854775807n;

  while (current < TARGET && pages < MAX_PAGES_PER_STATE) {
    const page = await pool.query(
      `
        SELECT
          id,
          created_at,
          taalk_lead_id,
          taalk_market,
          market,
          taalk_state,
          state,
          cn_email,
          cnresolution,
          dnc,
          ftcrestricted,
          "FTCRESTRICTED",
          currently_calling,
          "TaalkResolve"
        FROM masterlead
        WHERE id < $1
        ORDER BY id DESC
        LIMIT $2
      `,
      [lastId.toString(), PAGE_SIZE],
    );

    if (!page.rows.length) break;
    lastId = BigInt(String(page.rows[page.rows.length - 1].id));

    const candidates = page.rows
      .filter((row) => isEligibleLead(row, state))
      .slice(0, TARGET - current);

    let added = 0;
    for (let i = 0; i < candidates.length; i += UPSERT_BATCH) {
      added += await upsertPoolRows(state, candidates.slice(i, i + UPSERT_BATCH));
    }

    inserted += added;
    current = await readyCount(state);
    pages += 1;

    console.log(
      JSON.stringify({
        event: "state_page",
        market: MARKET,
        state,
        page: pages,
        candidates: candidates.length,
        added,
        ready: current,
        target: TARGET,
        lastId: lastId.toString(),
      }),
    );
  }

  return { market: MARKET, state, inserted, ready: current, pages };
}

(async () => {
  console.log(
    JSON.stringify({
      event: "start",
      market: MARKET,
      states: STATES,
      target: TARGET,
      pageSize: PAGE_SIZE,
      maxPagesPerState: MAX_PAGES_PER_STATE,
      upsertBatch: UPSERT_BATCH,
      startedAt: new Date().toISOString(),
    }),
  );

  const results = [];
  for (const state of STATES) {
    try {
      const result = await fillState(state);
      results.push(result);
      console.log(JSON.stringify({ event: "state_done", ...result }));
    } catch (error) {
      const result = { market: MARKET, state, error: error.message || String(error) };
      results.push(result);
      console.log(JSON.stringify({ event: "state_error", ...result }));
    }
  }

  console.log(
    JSON.stringify({
      event: "complete",
      completedAt: new Date().toISOString(),
      totalInserted: results.reduce((sum, row) => sum + Number(row.inserted || 0), 0),
      results,
    }),
  );
})()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
