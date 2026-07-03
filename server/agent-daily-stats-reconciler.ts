import { dispositionWritePool } from "./db";
import { supabaseAdmin } from "./supabase";
import { shouldYieldToLeadDelivery } from "./leasedialer-priority-gate";
import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "./hardcoded-config";

const INTERVAL_MS = 10 * 60_000;
const statsPool = dispositionWritePool;

let timer: NodeJS.Timeout | null = null;
let running = false;
let ensurePlusColumnPromise: Promise<void> | null = null;

async function ensureAgentDailyStatsPlusColumn(): Promise<void> {
  if (!ensurePlusColumnPromise) {
    ensurePlusColumnPromise = statsPool
      .query(
        `
          ALTER TABLE agent_daily_stats
          ADD COLUMN IF NOT EXISTS plus INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS presentations INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS declared_sales INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS declared_alp NUMERIC NOT NULL DEFAULT 0
        `,
      )
      .then(() => undefined)
      .catch((err) => {
        ensurePlusColumnPromise = null;
        throw err;
      });
  }
  await ensurePlusColumnPromise;
}

function getPacificDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function localToUtcMs(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): number {
  const targetLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const guess = new Date(targetLocalAsUtc);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
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

function extractClientEmail(raw: unknown): string {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "";
  if (value.startsWith("client:")) {
    const identity = value.replace(/^client:/i, "").trim().toLowerCase();
    if (identity.includes("@")) return identity;
  }
  if (value.includes("@")) return value;
  return "";
}

async function fetchTwilioAgentStatsForPacificDate(statDate: string): Promise<
  Map<string, { dials: number; reached: number; booked: number; instants: number }>
> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials missing");
  }
  const [year, month, day] = statDate.split("-").map(Number);
  const startUtc = new Date(localToUtcMs("America/Los_Angeles", year, month, day, 0, 0, 0));
  const endUtc = new Date(localToUtcMs("America/Los_Angeles", year, month, day + 1, 0, 0, 0));
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  const byAgent = new Map<string, { dials: number; reached: number; booked: number; instants: number }>();
  let pageToken: string | undefined;
  let pageNumber: string | undefined;

  while (true) {
    const page = await client.calls.page({
      startTimeAfter: startUtc,
      startTimeBefore: endUtc,
      pageSize: 1000,
      pageToken,
      pageNumber,
    } as any);
    const calls: any[] = Array.isArray((page as any)?.instances) ? (page as any).instances : [];
    for (const c of calls) {
      const direction = String(c?.direction || "").toLowerCase();
      if (!direction.startsWith("outbound")) continue;
      const email = extractClientEmail(c?.from) || extractClientEmail(c?.to);
      if (!email) continue;
      const duration = Number(c?.duration || 0) || 0;
      const cur = byAgent.get(email) || { dials: 0, reached: 0, booked: 0, instants: 0 };
      cur.dials += 1;
      if (duration >= 45) cur.reached += 1;
      if (duration >= 600) {
        cur.booked += 1;
        cur.instants += 1;
      }
      byAgent.set(email, cur);
    }

    const nextPageUrl = String((page as any)?.nextPageUrl || "");
    if (!nextPageUrl) break;
    const u = new URL(nextPageUrl);
    pageToken = u.searchParams.get("PageToken") || undefined;
    pageNumber = u.searchParams.get("Page") || undefined;
  }

  return byAgent;
}

async function fetchSalesAlpByAgentFromSupabase(statDate: string): Promise<
  Array<{ agent_email: string; sales: number; alp: number }>
> {
  if (!supabaseAdmin) return [];

  const pageSize = 1000;
  const platformRows: Array<{
    submitted_application_id: string | null;
    associate_id: string | number | null;
    platform_alp: number | null;
    lob: string | null;
    group_code: string | null;
    origination: string | null;
    sga_submit: string | null;
  }> = [];

  let offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("platform_sales")
      .select("submitted_application_id,associate_id,platform_alp,lob,group_code,origination,sga_submit")
      // Business rule: attribute sales to origination date.
      // Fallback to sga_submit only when origination is missing.
      .or(`origination.eq.${statDate},and(origination.is.null,sga_submit.eq.${statDate})`)
      .not("submitted_application_id", "is", null)
      .not("associate_id", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`platform_sales fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    platformRows.push(...(data as any[]));
    if (data.length < pageSize) break;
    offset += data.length;
  }

  if (platformRows.length === 0) return [];

  const byAssociate = new Map<string, Map<string, number>>();
  for (const row of platformRows) {
    const lob = String(row.lob ?? "").trim().toUpperCase();
    if (lob !== "L") continue; // Only life applications count as sales.

    const associateId = String(row.associate_id ?? "").trim();
    const appId = String(row.submitted_application_id ?? "").trim();
    const groupCode = String(row.group_code ?? "").trim();
    const saleKey = groupCode || appId; // Spouse apps often share SaleId/group_code.
    if (!associateId || !saleKey) continue;
    const alp = Number(row.platform_alp || 0);
    const salesMap = byAssociate.get(associateId) || new Map<string, number>();
    const prev = Number(salesMap.get(saleKey) || 0);
    // De-dup by sale key, keep max ALP seen for that sale unit.
    if (alp > prev) salesMap.set(saleKey, alp);
    else if (!salesMap.has(saleKey)) salesMap.set(saleKey, 0);
    byAssociate.set(associateId, salesMap);
  }

  if (byAssociate.size === 0) return [];

  const associateIds = Array.from(byAssociate.keys());
  const associateToEmail = new Map<string, string>();
  const assocChunk = 200;
  for (let i = 0; i < associateIds.length; i += assocChunk) {
    const chunk = associateIds.slice(i, i + assocChunk);
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("associate_id,company_email,personal_email")
      .in("associate_id", chunk as any);
    if (error) throw new Error(`customers fetch failed: ${error.message}`);
    for (const row of data || []) {
      const assoc = String((row as any)?.associate_id ?? "").trim();
      const email = String((row as any)?.company_email || (row as any)?.personal_email || "")
        .toLowerCase()
        .trim();
      if (!assoc || !email) continue;
      if (!associateToEmail.has(assoc)) associateToEmail.set(assoc, email);
    }
  }

  const byAgent = new Map<string, Map<string, number>>();
  for (const [associateId, salesMap] of byAssociate.entries()) {
    const email = associateToEmail.get(associateId);
    if (!email) continue;
    const current = byAgent.get(email) || new Map<string, number>();
    for (const [saleKey, alp] of salesMap.entries()) {
      const prev = Number(current.get(saleKey) || 0);
      if (alp > prev) current.set(saleKey, alp);
      else if (!current.has(saleKey)) current.set(saleKey, 0);
    }
    byAgent.set(email, current);
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

export async function reconcileAgentDailyStatsForDate(statDate: string): Promise<{
  statDate: string;
  sourceAgents: number;
  upsertedRows: number;
}> {
  await ensureAgentDailyStatsPlusColumn();
  let twilioUpsertedRows = 0;
  let sourceAgents = 0;
  try {
    const twilioStats = await fetchTwilioAgentStatsForPacificDate(statDate);
    sourceAgents = twilioStats.size;
    if (twilioStats.size > 0) {
      const emails = Array.from(twilioStats.keys());
      const dials = emails.map((e) => twilioStats.get(e)?.dials || 0);
      const reached = emails.map((e) => twilioStats.get(e)?.reached || 0);
      const booked = emails.map((e) => twilioStats.get(e)?.booked || 0);
      const instants = emails.map((e) => twilioStats.get(e)?.instants || 0);
      const twilioResult = await statsPool.query(
        `
          WITH twilio_stats AS (
            SELECT * FROM UNNEST($2::text[], $3::int[], $4::int[], $5::int[], $6::int[])
              AS t(agent_email, dials, reached, booked, instants)
          )
          INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, instants, sales, alp, plus, updated_at)
          SELECT
            t.agent_email,
            $1::date,
            t.dials,
            t.reached,
            t.booked,
            t.instants,
            COALESCE(existing.sales, 0),
            COALESCE(existing.alp, 0),
            COALESCE(existing.plus, 0),
            NOW()
          FROM twilio_stats t
          LEFT JOIN agent_daily_stats existing
            ON existing.agent_email = t.agent_email
           AND existing.stat_date = $1::date
          ON CONFLICT (agent_email, stat_date)
          DO UPDATE SET
            dials = EXCLUDED.dials,
            reached = EXCLUDED.reached,
            booked = EXCLUDED.booked,
            instants = EXCLUDED.instants,
            updated_at = NOW()
          RETURNING agent_email
        `,
        [statDate, emails, dials, reached, booked, instants],
      );
      twilioUpsertedRows = twilioResult.rowCount || 0;
    }
  } catch (twilioErr: any) {
    console.warn(
      `⚠️ [agent_daily_stats_reconciler] Twilio API sync failed for ${statDate}:`,
      twilioErr?.message || twilioErr,
    );
  }

  // Sales/ALP path: sourced from Supabase platform_sales, tied to agent via customers.associate_id.
  let salesAlpUpsertedRows = 0;
  try {
    const salesByAgent = await fetchSalesAlpByAgentFromSupabase(statDate);
    if (salesByAgent.length > 0) {
      const emails = salesByAgent.map((r) => r.agent_email);
      const sales = salesByAgent.map((r) => r.sales);
      const alp = salesByAgent.map((r) => r.alp);
      const salesAlpResult = await statsPool.query(
        `
          WITH sales_src AS (
            SELECT * FROM UNNEST($2::text[], $3::int[], $4::numeric[])
              AS t(agent_email, sales, alp)
          )
          INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, instants, sales, alp, plus, updated_at)
          SELECT
            s.agent_email,
            $1::date,
            COALESCE(existing.dials, 0),
            COALESCE(existing.reached, 0),
            COALESCE(existing.booked, 0),
            COALESCE(existing.instants, 0),
            s.sales,
            s.alp,
            COALESCE(existing.plus, 0),
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
        [statDate, emails, sales, alp],
      );
      salesAlpUpsertedRows = salesAlpResult.rowCount || 0;

      await statsPool.query(
        `
          UPDATE agent_daily_stats ads
          SET sales = 0,
              alp = 0,
              updated_at = NOW()
          WHERE ads.stat_date = $1::date
            AND (COALESCE(ads.sales, 0) <> 0 OR COALESCE(ads.alp, 0) <> 0)
            AND NOT (LOWER(TRIM(ads.agent_email)) = ANY($2::text[]))
        `,
        [statDate, emails],
      );
    } else {
      await statsPool.query(
        `
          UPDATE agent_daily_stats ads
          SET sales = 0,
              alp = 0,
              updated_at = NOW()
          WHERE ads.stat_date = $1::date
            AND (COALESCE(ads.sales, 0) <> 0 OR COALESCE(ads.alp, 0) <> 0)
        `,
        [statDate],
      );
    }
  } catch (salesAlpErr: any) {
    console.warn(
      `?? [agent_daily_stats_reconciler] sales/alp sync skipped for ${statDate}:`,
      salesAlpErr?.message || salesAlpErr,
    );
  }

  // Plus path: count plus-market leads created that PT day per owning user.
  let plusUpsertedRows = 0;
  try {
      const plusResult = await statsPool.query(
      `
        WITH plus_ml AS (
          SELECT
            LOWER(TRIM(COALESCE(NULLIF(cn_email, ''), NULLIF(previous_cn_email, '')))) AS agent_email,
            COUNT(*)::int AS plus
          FROM masterlead
          WHERE created_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
            AND created_at < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
            AND (
              LOWER(COALESCE(taalk_market, '')) LIKE '%plus%'
              OR LOWER(COALESCE(market, '')) LIKE '%plus%'
            )
            AND COALESCE(TRIM(COALESCE(cn_email, previous_cn_email, '')), '') <> ''
          GROUP BY LOWER(TRIM(COALESCE(NULLIF(cn_email, ''), NULLIF(previous_cn_email, ''))))
        )
        INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, instants, sales, alp, plus, updated_at)
        SELECT
          p.agent_email,
          $1::date,
          COALESCE(existing.dials, 0),
          COALESCE(existing.reached, 0),
          COALESCE(existing.booked, 0),
          COALESCE(existing.instants, 0),
          COALESCE(existing.sales, 0),
          COALESCE(existing.alp, 0),
          p.plus,
          NOW()
        FROM plus_ml p
        LEFT JOIN agent_daily_stats existing
          ON existing.agent_email = p.agent_email
         AND existing.stat_date = $1::date
        ON CONFLICT (agent_email, stat_date)
        DO UPDATE SET
          plus = EXCLUDED.plus,
          updated_at = NOW()
        RETURNING agent_email
      `,
      [statDate],
    );
    plusUpsertedRows = plusResult.rowCount || 0;

    await statsPool.query(
      `
        WITH plus_agents AS (
          SELECT DISTINCT LOWER(TRIM(COALESCE(NULLIF(cn_email, ''), NULLIF(previous_cn_email, '')))) AS agent_email
          FROM masterlead
          WHERE created_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
            AND created_at < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
            AND (
              LOWER(COALESCE(taalk_market, '')) LIKE '%plus%'
              OR LOWER(COALESCE(market, '')) LIKE '%plus%'
            )
            AND COALESCE(TRIM(COALESCE(cn_email, previous_cn_email, '')), '') <> ''
        )
        UPDATE agent_daily_stats ads
        SET plus = 0,
            updated_at = NOW()
        WHERE ads.stat_date = $1::date
          AND COALESCE(ads.plus, 0) <> 0
          AND NOT EXISTS (
            SELECT 1
            FROM plus_agents p
            WHERE p.agent_email = LOWER(TRIM(ads.agent_email))
          )
      `,
      [statDate],
    );
  } catch (plusErr: any) {
    console.warn(
      `?? [agent_daily_stats_reconciler] plus sync skipped for ${statDate}:`,
      plusErr?.message || plusErr,
    );
  }

  return {
    statDate,
    sourceAgents,
    upsertedRows: twilioUpsertedRows + salesAlpUpsertedRows + plusUpsertedRows,
  };
}

async function runOnce(): Promise<void> {
  if (running) return;
  if (await shouldYieldToLeadDelivery("agent_daily_stats_reconciler")) return;
  running = true;
  try {
    const statDate = getPacificDate();
    const summary = await reconcileAgentDailyStatsForDate(statDate);
    console.log(
      `🔁 [agent_daily_stats_reconciler] ${summary.statDate} source_agents=${summary.sourceAgents} upserted=${summary.upsertedRows}`,
    );
  } catch (err: any) {
    console.error("❌ [agent_daily_stats_reconciler] run failed:", err?.message || err);
  } finally {
    running = false;
  }
}

export function startAgentDailyStatsReconciler(): void {
  if (timer) return;

  // Warm immediately on boot, then every 10 minutes.
  void runOnce();
  timer = setInterval(() => {
    void runOnce();
  }, INTERVAL_MS);

  console.log("✅ agent_daily_stats reconciler started (every 10 minutes, Twilio API source)");
}

