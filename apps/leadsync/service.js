/**
 * Long-running HTTP shell for Railway (aoirail-aointelleadsync).
 * Implements /api/ccpro/assignment-trigger for lead assignment from masterlead (Postgres).
 */
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = parseInt(process.env.PORT || "8080", 10);
const CAP = 300;
const RECENT_CONTACT_HOURS = Number(process.env.RECENT_CONTACT_HOURS || 4);
const LEAD_REASSIGN_COOLDOWN_HOURS = Number(process.env.LEAD_REASSIGN_COOLDOWN_HOURS || 24);

app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const DATABASE_URL = process.env.DATABASE_URL;
let pool = null;
if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  console.log("[aoirail-leadsync] Postgres pool initialized");
} else {
  console.warn("[aoirail-leadsync] No DATABASE_URL");
}

function esc(v) {
  return String(v || "").replace(/'/g, "''");
}

const TIMEZONE_SQL = `
  CASE UPPER(COALESCE(NULLIF(TRIM(state), ''), NULLIF(TRIM(taalk_state), ''), ''))
    WHEN 'CT' THEN 'America/New_York'
    WHEN 'DE' THEN 'America/New_York'
    WHEN 'FL' THEN 'America/New_York'
    WHEN 'GA' THEN 'America/New_York'
    WHEN 'MA' THEN 'America/New_York'
    WHEN 'MD' THEN 'America/New_York'
    WHEN 'ME' THEN 'America/New_York'
    WHEN 'NC' THEN 'America/New_York'
    WHEN 'NH' THEN 'America/New_York'
    WHEN 'NJ' THEN 'America/New_York'
    WHEN 'NY' THEN 'America/New_York'
    WHEN 'OH' THEN 'America/New_York'
    WHEN 'PA' THEN 'America/New_York'
    WHEN 'RI' THEN 'America/New_York'
    WHEN 'SC' THEN 'America/New_York'
    WHEN 'VA' THEN 'America/New_York'
    WHEN 'VT' THEN 'America/New_York'
    WHEN 'WV' THEN 'America/New_York'
    WHEN 'MI' THEN 'America/Detroit'
    WHEN 'IN' THEN 'America/Indiana/Indianapolis'
    WHEN 'KY' THEN 'America/Kentucky/Louisville'
    WHEN 'AL' THEN 'America/Chicago'
    WHEN 'AR' THEN 'America/Chicago'
    WHEN 'IA' THEN 'America/Chicago'
    WHEN 'IL' THEN 'America/Chicago'
    WHEN 'KS' THEN 'America/Chicago'
    WHEN 'LA' THEN 'America/Chicago'
    WHEN 'MN' THEN 'America/Chicago'
    WHEN 'MO' THEN 'America/Chicago'
    WHEN 'MS' THEN 'America/Chicago'
    WHEN 'NE' THEN 'America/Chicago'
    WHEN 'OK' THEN 'America/Chicago'
    WHEN 'SD' THEN 'America/Chicago'
    WHEN 'TN' THEN 'America/Chicago'
    WHEN 'TX' THEN 'America/Chicago'
    WHEN 'WI' THEN 'America/Chicago'
    WHEN 'ND' THEN 'America/North_Dakota/Center'
    WHEN 'AZ' THEN 'America/Phoenix'
    WHEN 'CO' THEN 'America/Denver'
    WHEN 'ID' THEN 'America/Boise'
    WHEN 'MT' THEN 'America/Denver'
    WHEN 'NM' THEN 'America/Denver'
    WHEN 'UT' THEN 'America/Denver'
    WHEN 'WY' THEN 'America/Denver'
    WHEN 'CA' THEN 'America/Los_Angeles'
    WHEN 'NV' THEN 'America/Los_Angeles'
    WHEN 'OR' THEN 'America/Los_Angeles'
    WHEN 'WA' THEN 'America/Los_Angeles'
    WHEN 'AK' THEN 'America/Anchorage'
    WHEN 'HI' THEN 'Pacific/Honolulu'
    ELSE 'America/New_York'
  END
`;

const FTC_CALLABLE_SQL = `
  COALESCE(LOWER(TRIM(ftcrestricted::text)), '') NOT IN ('yes', 'true', '1', 'y')
  AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE (${TIMEZONE_SQL}))) BETWEEN 8 AND 20
`;

const RECENT_CONTACT_SQL = `
  (last_contacted IS NULL OR last_contacted < NOW() - ($2::text || ' hours')::interval)
`;

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "aoirail-aointelleadsync", uptime: process.uptime(), db: !!pool });
});

app.get("/", (_req, res) => {
  res.type("html").send("<h1>aoirail-aointelleadsync</h1><p><a href='/health'>/health</a></p>");
});

app.post("/api/ccpro/assignment-trigger", async (req, res) => {
  const { agentEmail, states = [], markets = [] } = req.body || {};

  if (!agentEmail) return res.status(400).json({ ok: false, error: "agentEmail required" });
  const email = String(agentEmail).toLowerCase().trim();
  console.warn(`[assignment-trigger] DISABLED old bulk assignment for ${email}; returning assigned=0`);
  return res.json({
    ok: true,
    assigned: 0,
    disabled: true,
    message: "Old Leadsync bulk assignment is disabled; leasedialer buffer owns routing.",
  });

  if (!pool) return res.status(500).json({ ok: false, error: "No database connection" });

  const normalizedStates = Array.isArray(states)
    ? states.map((s) => String(s || "").toUpperCase().trim()).filter(Boolean)
    : [];
  const normalizedMarkets = Array.isArray(markets)
    ? markets.map((m) => String(m || "").toLowerCase().trim()).filter(Boolean)
    : [];

  console.log(
    `[assignment-trigger] ${email} (cap=${CAP}, cooldown=${LEAD_REASSIGN_COOLDOWN_HOURS}h, states=${JSON.stringify(normalizedStates)}, markets=${JSON.stringify(normalizedMarkets)})`,
  );

  let client = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // Per-agent DB lock prevents duplicate concurrent assignments for same email,
    // even across multiple service instances.
    const lockResult = await client.query(
      "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked",
      [email],
    );
    const gotLock = !!lockResult.rows?.[0]?.locked;
    if (!gotLock) {
      await client.query("ROLLBACK");
      console.log(`[assignment-trigger] ${email} — already processing, skipping duplicate request`);
      return res.json({ ok: true, assigned: 0, current: 0, message: "Duplicate trigger skipped" });
    }

    // Recycle leads that are assigned but not callable right now so they do not deadlock cap.
    const recycleSql = `
      UPDATE masterlead
      SET previous_cn_email = $1,
          last_assigned_date = NOW(),
          cn_email = NULL,
          assigned_date = NULL,
          updated_at = NOW()
      WHERE cn_email = $1
        AND LOWER(COALESCE(cnresolution,'')) = 'pending'
        AND LOWER(COALESCE(taalk_market,'')) NOT IN ('plus lead','plus leads')
        AND COALESCE(dnc::text,'false') NOT IN ('true','1')
        AND COALESCE("TaalkResolve"::text,'') NOT IN ('true','1')
        AND (NOT (${FTC_CALLABLE_SQL}) OR NOT (${RECENT_CONTACT_SQL}))
    `;
    const recycleResult = await client.query(recycleSql, [email, String(RECENT_CONTACT_HOURS)]);

    const countSql = `
      SELECT COUNT(*)::int AS cnt
      FROM masterlead
      WHERE cn_email = $1
        AND LOWER(COALESCE(cnresolution,'')) = 'pending'
        AND LOWER(COALESCE(taalk_market,'')) NOT IN ('plus lead','plus leads')
        AND COALESCE(dnc::text,'false') NOT IN ('true','1')
        AND COALESCE("TaalkResolve"::text,'') NOT IN ('true','1')
        AND (${FTC_CALLABLE_SQL})
        AND (${RECENT_CONTACT_SQL})
    `;
    const { rows: countRows } = await client.query(countSql, [email, String(RECENT_CONTACT_HOURS)]);
    const current = Number(countRows[0]?.cnt || 0);
    const needed = Math.max(0, CAP - current);

    if (needed <= 0) {
      await client.query("COMMIT");
      console.log(`[assignment-trigger] ${email} already at callable cap (${current}/${CAP})`);
      return res.json({
        ok: true,
        assigned: 0,
        current,
        recycled: recycleResult.rowCount || 0,
        message: `Agent already at callable cap (${current}/${CAP})`,
      });
    }

    const cooldownHours = Math.max(0, Number(LEAD_REASSIGN_COOLDOWN_HOURS || 24));
    const recentOwnershipTsSql =
      "COALESCE(NULLIF(last_assigned_date::text,'')::timestamptz, NULLIF(assigned_date::text,'')::timestamptz, NULLIF(updated_at::text,'')::timestamptz, to_timestamp(0))";
    const params = [email, needed];
    const whereClauses = [
      "(cn_email IS NULL OR cn_email = '')",
      "LOWER(COALESCE(cnresolution,'pending')) = 'pending'",
      "LOWER(COALESCE(taalk_market,'')) NOT IN ('plus lead','plus leads')",
      "COALESCE(dnc::text,'false') NOT IN ('true','1')",
      "COALESCE(\"TaalkResolve\"::text,'') NOT IN ('true','1')",
      // Prevent boomerang assignments: do not give a lead back to the same agent
      // if they were the previous owner within the cooldown window.
      `(LOWER(COALESCE(previous_cn_email,'')) <> $1 OR ${recentOwnershipTsSql} < NOW() - INTERVAL '${cooldownHours} hours')`,
      // Strong anti-repeat filter: block "same lead" variants by taalk_lead_id or phone
      // only when the same agent was the CURRENT owner recently.
      // Do not globally block by previous_cn_email; that causes leads to become dead forever.
      `NOT EXISTS (
        SELECT 1
        FROM masterlead recent_owner
        WHERE LOWER(COALESCE(recent_owner.cn_email,'')) = $1
          AND (
            (
              COALESCE(NULLIF(recent_owner.taalk_lead_id,''), '') <> ''
              AND COALESCE(NULLIF(taalk_lead_id,''), '') <> ''
              AND recent_owner.taalk_lead_id = taalk_lead_id
            )
            OR (
              RIGHT(REGEXP_REPLACE(COALESCE(recent_owner.phone::text,''), '\\D', '', 'g'), 10) <> ''
              AND RIGHT(REGEXP_REPLACE(COALESCE(phone::text,''), '\\D', '', 'g'), 10) <> ''
              AND RIGHT(REGEXP_REPLACE(COALESCE(recent_owner.phone::text,''), '\\D', '', 'g'), 10)
                  = RIGHT(REGEXP_REPLACE(COALESCE(phone::text,''), '\\D', '', 'g'), 10)
            )
          )
          AND COALESCE(
            NULLIF(recent_owner.last_assigned_date::text,'')::timestamptz,
            NULLIF(recent_owner.assigned_date::text,'')::timestamptz,
            NULLIF(recent_owner.updated_at::text,'')::timestamptz,
            to_timestamp(0)
          ) >= NOW() - INTERVAL '${cooldownHours} hours'
      )`,
      `(${FTC_CALLABLE_SQL})`,
      `(${RECENT_CONTACT_SQL.replace(/\$2/g, "$3")})`,
    ];
    params.push(String(RECENT_CONTACT_HOURS));

    if (normalizedStates.length > 0) {
      params.push(normalizedStates);
      const idx = params.length;
      whereClauses.push(
        `(UPPER(COALESCE(state,'')) = ANY($${idx}::text[]) OR UPPER(COALESCE(taalk_state,'')) = ANY($${idx}::text[]))`,
      );
    }

    if (normalizedMarkets.length > 0) {
      params.push(normalizedMarkets);
      const idx = params.length;
      whereClauses.push(
        `(LOWER(COALESCE(taalk_market,'')) = ANY($${idx}::text[]) OR LOWER(COALESCE(market,'')) = ANY($${idx}::text[]))`,
      );
    }

    const assignSql = `
      WITH candidates AS (
        SELECT id
        FROM masterlead
        WHERE ${whereClauses.join("\n          AND ")}
        ORDER BY
          CASE
            WHEN COALESCE(taalk_lead_id, '') ~ '^[0-9]+$' THEN taalk_lead_id::bigint
            ELSE NULL
          END DESC NULLS LAST
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      ),
      assigned_rows AS (
        UPDATE masterlead m
        SET cn_email = $1, updated_at = NOW()
        FROM candidates c
        WHERE m.id = c.id
          AND (m.cn_email IS NULL OR m.cn_email = '')
        RETURNING m.id
      )
      SELECT COUNT(*)::int AS assigned FROM assigned_rows
    `;

    const { rows: assignedRows } = await client.query(assignSql, params);
    const assigned = Number(assignedRows?.[0]?.assigned || 0);
    const newCount = current + assigned;

    await client.query("COMMIT");

    if (assigned <= 0) {
      console.log(`[assignment-trigger] No unassigned leads available for ${email}`);
      return res.json({
        ok: true,
        assigned: 0,
        current,
        recycled: recycleResult.rowCount || 0,
        message: "No matching callable unassigned leads",
      });
    }

    console.log(
      `[assignment-trigger] Assigned ${assigned} leads to ${email} (callable was ${current}, now ${newCount}/${CAP}, recycled=${recycleResult.rowCount || 0})`,
    );
    return res.json({
      ok: true,
      assigned,
      current,
      requested: needed,
      recycled: recycleResult.rowCount || 0,
    });
  } catch (err) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (_rollbackErr) {
      // ignore rollback error
    }
    console.error(`[assignment-trigger] Error for ${email}:`, err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  } finally {
    if (client) client.release();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[aoirail-aointelleadsync] listening on ${PORT}`);
});
