const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  max: 4,
});

const SUPA_URL = "https://ycztjetxwpfgtrzeyytt.supabase.co";
const SUPA_KEY = "sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd";
const SUPA_HEADERS = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
};

function pacificDateIso(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function toDate(s) {
  return new Date(`${s}T00:00:00.000Z`);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

async function fetchSalesByAgentFromSupabase(day) {
  const pageSize = 1000;
  const platformRows = [];
  let offset = 0;
  const dayFilter = encodeURIComponent(`(origination.eq.${day},and(origination.is.null,sga_submit.eq.${day}))`);
  while (true) {
    const url =
      `${SUPA_URL}/rest/v1/platform_sales` +
      `?select=submitted_application_id,associate_id,platform_alp,lob,group_code,origination,sga_submit` +
      // Business rule: attribute sales to origination date.
      // Fallback to sga_submit only when origination is missing.
      `&or=${dayFilter}` +
      `&submitted_application_id=not.is.null` +
      `&associate_id=not.is.null` +
      `&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { headers: SUPA_HEADERS });
    if (!res.ok) throw new Error(`platform_sales fetch failed: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    if (!rows.length) break;
    platformRows.push(...rows);
    if (rows.length < pageSize) break;
    offset += rows.length;
  }

  const byAssociate = new Map(); // associate_id -> Map<saleKey, maxAlp>
  for (const row of platformRows) {
    const lob = String(row?.lob ?? "").trim().toUpperCase();
    if (lob !== "L") continue; // Only life apps count.

    const assoc = String(row?.associate_id ?? "").trim();
    const appId = String(row?.submitted_application_id ?? "").trim();
    const groupCode = String(row?.group_code ?? "").trim();
    const saleKey = groupCode || appId; // spouse pairs share this frequently
    if (!assoc || !saleKey) continue;
    const alp = Number(row?.platform_alp || 0);
    const cur = byAssociate.get(assoc) || new Map();
    const prev = Number(cur.get(saleKey) || 0);
    if (alp > prev) cur.set(saleKey, alp);
    else if (!cur.has(saleKey)) cur.set(saleKey, 0);
    byAssociate.set(assoc, cur);
  }

  if (byAssociate.size === 0) return [];

  const associateIds = Array.from(byAssociate.keys());
  const associateToEmail = new Map();
  const chunkSize = 200;
  for (let i = 0; i < associateIds.length; i += chunkSize) {
    const chunk = associateIds.slice(i, i + chunkSize);
    const inVals = `(${chunk.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(",")})`;
    const url =
      `${SUPA_URL}/rest/v1/customers` +
      `?select=associate_id,company_email,personal_email` +
      `&associate_id=in.${encodeURIComponent(inVals)}`;
    const res = await fetch(url, { headers: SUPA_HEADERS });
    if (!res.ok) throw new Error(`customers fetch failed: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    for (const row of rows) {
      const assoc = String(row?.associate_id ?? "").trim();
      const email = String(row?.company_email || row?.personal_email || "").toLowerCase().trim();
      if (assoc && email && !associateToEmail.has(assoc)) associateToEmail.set(assoc, email);
    }
  }

  const byAgent = new Map(); // email -> Map<saleKey, maxAlp>
  for (const [assoc, salesMap] of byAssociate.entries()) {
    const email = associateToEmail.get(assoc);
    if (!email) continue;
    const cur = byAgent.get(email) || new Map();
    for (const [saleKey, alp] of salesMap.entries()) {
      const prev = Number(cur.get(saleKey) || 0);
      if (alp > prev) cur.set(saleKey, alp);
      else if (!cur.has(saleKey)) cur.set(saleKey, 0);
    }
    byAgent.set(email, cur);
  }

  return Array.from(byAgent.entries()).map(([agent_email, salesMap]) => ({
    agent_email,
    sales: salesMap.size,
    alp: Number(
      Array.from(salesMap.values())
        .reduce((sum, v) => sum + Number(v || 0), 0)
        .toFixed(2),
    ),
  }));
}

async function syncDay(day) {
  const salesByAgent = await fetchSalesByAgentFromSupabase(day);
  let upsert = { rowCount: 0 };

  if (salesByAgent.length > 0) {
    const emails = salesByAgent.map((r) => r.agent_email);
    const sales = salesByAgent.map((r) => r.sales);
    const alp = salesByAgent.map((r) => r.alp);
    upsert = await pool.query(
      `
        WITH sales_src AS (
          SELECT * FROM UNNEST($2::text[], $3::int[], $4::numeric[])
            AS t(agent_email, sales, alp)
        )
        INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, instants, sales, alp, updated_at)
        SELECT
          s.agent_email,
          $1::date,
          COALESCE(existing.dials, 0),
          COALESCE(existing.reached, 0),
          COALESCE(existing.booked, 0),
          COALESCE(existing.instants, 0),
          s.sales,
          s.alp,
          NOW()
        FROM sales_src s
        LEFT JOIN agent_daily_stats existing
          ON existing.agent_email = s.agent_email
         AND existing.stat_date = $1::date
        ON CONFLICT (agent_email, stat_date)
        DO UPDATE SET
          sales = EXCLUDED.sales,
          alp = EXCLUDED.alp,
          updated_at = NOW()
        RETURNING agent_email
      `,
      [day, emails, sales, alp],
    );
  }

  const zeroed = await pool.query(
    `
      UPDATE agent_daily_stats ads
      SET sales = 0,
          alp = 0,
          updated_at = NOW()
      WHERE ads.stat_date = $1::date
        AND (COALESCE(ads.sales, 0) <> 0 OR COALESCE(ads.alp, 0) <> 0)
        AND (
          $2::text[] IS NULL
          OR array_length($2::text[], 1) IS NULL
          OR NOT (LOWER(TRIM(ads.agent_email)) = ANY($2::text[]))
        )
    `,
    [day, salesByAgent.length ? salesByAgent.map((r) => r.agent_email) : null],
  );

  const verify = await pool.query(
    `
      SELECT
        COALESCE(SUM(sales), 0)::int AS ads_sales,
        COALESCE(SUM(alp), 0)::numeric(12,2) AS ads_alp
      FROM agent_daily_stats
      WHERE stat_date = $1::date
    `,
    [day],
  );

  return {
    day,
    upsertedRows: upsert.rowCount || 0,
    zeroedRows: zeroed.rowCount || 0,
    totals: verify.rows[0],
  };
}

async function main() {
  const start = process.argv[2] || "2026-04-01";
  const end = process.argv[3] || pacificDateIso();
  let d = toDate(start);
  const endDate = toDate(end);
  const out = [];
  while (d <= endDate) {
    const day = isoDate(d);
    const r = await syncDay(day);
    out.push(r);
    console.log(
      `[sales/alp backfill] ${day} upserted=${r.upsertedRows} zeroed=${r.zeroedRows} sales=${r.totals.ads_sales} alp=${r.totals.ads_alp}`,
    );
    d = addDays(d, 1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        start,
        end,
        days: out.length,
        sample: out.slice(0, 3),
        last: out[out.length - 1] || null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e?.message || String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
