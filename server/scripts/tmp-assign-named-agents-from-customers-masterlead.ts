import { Client } from "pg";
import { supabaseAdmin } from "../supabase";

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const TARGET_PER_AGENT = Math.max(1, Number(process.env.TARGET_PER_AGENT || 200));
const INSERT_CHUNK = Math.max(1, Number(process.env.INSERT_CHUNK || 25));
const MAX_ATTEMPTS = Math.max(1, Number(process.env.MAX_ATTEMPTS || 600));
const SLEEP_MS = Math.max(0, Number(process.env.SLEEP_MS || 30));

const DEFAULT_EMAILS = [
  "duaneshaw@aoglobelife.com",
  "erickurzynski@aoglobelife.com",
  "erikacavin@aoglobelife.com",
  "gagemurphy@aoglobelife.com",
  "gavinthomas@aoglobelife.com",
  "jenniferrobins@aoglobelife.com",
  "joshuacassell@aoglobelife.com",
  "kadenmcbride@aoglobelife.com",
  "kenmock@aoglobelife.com",
  "kennethhollobaugh@aoglobelife.com",
  "nancyaguilar@aoglobelife.com",
  "normandyer@aoglobelife.com",
  "stephenlaframboise@aoglobelife.com",
  "tyjeremorrow@aoglobelife.com",
  "vincentisabelle@aoglobelife.com",
  "wildaclay@aoglobelife.com",
  "zakiblanding@aoglobelife.com",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeMarket(value: unknown): string {
  const raw = String(value || "").trim();
  const compact = raw.toLowerCase().replace(/\s+/g, "");
  if (compact.includes("globe")) return "Globe Market";
  if (compact.includes("veteran")) return "Veteran";
  if (compact.includes("recruit")) return "AO Recruit";
  return raw;
}

function normalizeState(value: unknown): string {
  return String(value || "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

function parseUnknownList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  const text = String(value || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v || "").trim()).filter(Boolean);
  } catch {
    // ignore
  }
  return text
    .split(/[,\n;|]+/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

async function getCustomerProfile(email: string): Promise<{ markets: string[]; states: string[]; source: string }> {
  if (!supabaseAdmin) return { markets: [], states: [], source: "missing_supabase_admin" };
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id, company_email, personal_email, states, market, created_at")
    .or(`company_email.eq.${email},personal_email.eq.${email}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return { markets: [], states: [], source: "customers_not_found" };

  const row: any = data[0];
  const markets = Array.from(new Set(parseUnknownList(row.market).map(normalizeMarket).filter(Boolean)));
  const states = Array.from(new Set(parseUnknownList(row.states).map(normalizeState).filter((s) => /^[A-Z]{2}$/.test(s))));
  return { markets, states, source: "customers" };
}

async function getQueuedCount(client: Client, email: string): Promise<number> {
  const res = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM leasedialer_assignments
      WHERE lower(agent_email) = lower($1)
        AND queue = 'hotlead'
        AND status = 'queued'
    `,
    [email],
  );
  return Number(res.rows[0]?.count || 0);
}

async function assignOneChunk(
  client: Client,
  email: string,
  markets: string[],
  states: string[],
  limit: number,
): Promise<number> {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout = '500ms'");
    await client.query("SET LOCAL statement_timeout = '30000ms'");
    const result = await client.query(
      `
        WITH candidates AS (
          SELECT ml.id
          FROM masterlead ml
          WHERE (
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%recruit%' THEN 'AO Recruit'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
            END
          ) = ANY($2::text[])
            AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($3::text[])
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND COALESCE(btrim(ml.cn_email), '') = ''
            AND NOT EXISTS (
              SELECT 1
              FROM leasedialer_assignments la
              WHERE la.lead_id = ml.id
                AND la.status IN ('queued', 'active')
            )
          ORDER BY ml.created_at DESC NULLS LAST, ml.id DESC
          LIMIT $4
          FOR UPDATE SKIP LOCKED
        ),
        ins AS (
          INSERT INTO leasedialer_assignments (
            lead_id,
            agent_email,
            queue,
            status,
            assigned_at,
            created_at,
            updated_at
          )
          SELECT id, $1, 'hotlead', 'queued', NOW(), NOW(), NOW()
          FROM candidates
          ON CONFLICT DO NOTHING
          RETURNING lead_id
        )
        SELECT COUNT(*)::int AS count
        FROM ins
      `,
      [email, markets, states, limit],
    );
    await client.query("COMMIT");
    return Number(result.rows[0]?.count || 0);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function run(): Promise<void> {
  const inputEmails = process.argv
    .slice(2)
    .flatMap((v) => String(v || "").split(/[,\s]+/g))
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.includes("@"));
  const emails = inputEmails.length ? inputEmails : DEFAULT_EMAILS;

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 30000,
    query_timeout: 30000,
  });

  await client.connect();
  try {
    const results: any[] = [];
    for (const email of emails) {
      const profile = await getCustomerProfile(email);
      if (!profile.markets.length || !profile.states.length) {
        const row = { email, source: profile.source, queuedBefore: await getQueuedCount(client, email), inserted: 0, skipped: "missing_customer_filters" };
        results.push(row);
        console.log(JSON.stringify({ event: "assign_agent", ...row }));
        continue;
      }

      const queuedBefore = await getQueuedCount(client, email);
      const need = Math.max(0, TARGET_PER_AGENT - queuedBefore);
      if (!need) {
        const row = { email, source: profile.source, queuedBefore, inserted: 0, skipped: "already_at_target" };
        results.push(row);
        console.log(JSON.stringify({ event: "assign_agent", ...row }));
        continue;
      }

      let inserted = 0;
      let attempts = 0;
      let lastError: string | null = null;
      while (inserted < need && attempts < MAX_ATTEMPTS) {
        attempts += 1;
        const limit = Math.min(INSERT_CHUNK, need - inserted);
        try {
          const n = await assignOneChunk(client, email, profile.markets, profile.states, limit);
          if (n <= 0) break;
          inserted += n;
          if (SLEEP_MS > 0) await sleep(SLEEP_MS);
        } catch (error: any) {
          lastError = String(error?.message || error);
          break;
        }
      }
      const queuedAfter = await getQueuedCount(client, email);
      const row = {
        email,
        source: profile.source,
        markets: profile.markets,
        statesCount: profile.states.length,
        queuedBefore,
        need,
        attempts,
        inserted,
        queuedAfter,
        error: lastError,
      };
      results.push(row);
      console.log(JSON.stringify({ event: "assign_agent", ...row }));
    }

    const summary = {
      targetPerAgent: TARGET_PER_AGENT,
      requestedAgents: emails.length,
      assignedAgents: results.filter((r) => Number(r.inserted || 0) > 0).length,
      totalInserted: results.reduce((sum, r) => sum + Number(r.inserted || 0), 0),
      skippedMissingCustomerFilters: results.filter((r) => r.skipped === "missing_customer_filters").length,
      skippedAlreadyAtTarget: results.filter((r) => r.skipped === "already_at_target").length,
    };
    console.log(JSON.stringify({ event: "assign_complete", summary }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
