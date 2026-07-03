import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import twilio from "twilio";
import { pool } from "../db.js";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

type DialSummary = {
  agentEmail: string;
  dials: number;
};

function nyDateParts(now = new Date()): { isoDate: string; year: number; month: number; day: number } {
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = isoDate.split("-").map(Number);
  return { isoDate, year, month, day };
}

function nyLocalToUtcMs(year: number, month: number, day: number, hour: number, minute = 0, second = 0): number {
  const targetLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const guess = new Date(targetLocalAsUtc);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
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

function extractAoglobeEmails(value: unknown): string[] {
  const raw = String(value || "").toLowerCase();
  const matches = raw.match(/[a-z0-9._%+-]+@aoglobelife\.com/g) || [];
  return Array.from(new Set(matches));
}

function isOutbound(direction: unknown): boolean {
  return String(direction || "").toLowerCase().startsWith("outbound");
}

async function fetchCallsSince6amEstToday(client: ReturnType<typeof twilio>): Promise<any[]> {
  const { isoDate, year, month, day } = nyDateParts();
  const sinceUtcMs = nyLocalToUtcMs(year, month, day, 6, 0, 0);
  let startTimeBefore: string | undefined;
  const calls: any[] = [];

  while (true) {
    const page = await client.calls.list({
      startTimeAfter: isoDate,
      startTimeBefore,
      limit: 1000,
    } as any);
    if (!page.length) break;
    calls.push(...page);
    if (page.length < 1000) break;
    const last = page[page.length - 1] as any;
    const lastTime = last.startTime || last.dateCreated;
    if (!lastTime) break;
    const d = new Date(lastTime);
    if (Number.isNaN(d.getTime())) break;
    d.setSeconds(d.getSeconds() - 1);
    startTimeBefore = d.toISOString().slice(0, 19);
  }

  return calls.filter((c: any) => {
    const t = c.startTime || c.dateCreated;
    return t ? new Date(t).getTime() >= sinceUtcMs : false;
  });
}

function summarizeAgentDials(calls: any[]): DialSummary[] {
  const byAgent = new Map<string, number>();
  for (const c of calls) {
    const fromEmails = extractAoglobeEmails(c?.from);
    const toEmails = extractAoglobeEmails(c?.to);
    const all = [...fromEmails, ...toEmails];
    if (!all.length) continue;

    const agentEmail = String(fromEmails[0] || toEmails[0]).toLowerCase();
    if (!agentEmail) continue;

    byAgent.set(agentEmail, (byAgent.get(agentEmail) || 0) + 1);
  }

  return Array.from(byAgent.entries())
    .map(([agentEmail, dials]) => ({ agentEmail, dials }))
    .sort((a, b) => b.dials - a.dials || a.agentEmail.localeCompare(b.agentEmail));
}

function toCsv(rows: DialSummary[]): string {
  const lines = ["agent_email,dials"];
  for (const row of rows) {
    lines.push(`${row.agentEmail},${row.dials}`);
  }
  return `${lines.join("\n")}\n`;
}

async function backfillAgentDailyDials(statDate: string, rows: DialSummary[]): Promise<number> {
  if (!rows.length) return 0;
  const emails = rows.map((r) => r.agentEmail);
  const dials = rows.map((r) => r.dials);

  const updated = await pool.query({
    text: `
      UPDATE agent_daily_stats ads
      SET
        dials = src.dials,
        updated_at = NOW()
      FROM (
        SELECT
          UNNEST($1::text[]) AS agent_email,
          UNNEST($2::int[]) AS dials
      ) src
      WHERE ads.agent_email = src.agent_email
        AND ads.stat_date = $3::date
    `,
    values: [emails, dials, statDate],
    query_timeout: 180000,
  });

  const inserted = await pool.query({
    text: `
      INSERT INTO agent_daily_stats (agent_email, stat_date, dials, updated_at)
      SELECT src.agent_email, $3::date, src.dials, NOW()
      FROM (
        SELECT
          UNNEST($1::text[]) AS agent_email,
          UNNEST($2::int[]) AS dials
      ) src
      LEFT JOIN agent_daily_stats ads
        ON ads.agent_email = src.agent_email
       AND ads.stat_date = $3::date
      WHERE ads.agent_email IS NULL
    `,
    values: [emails, dials, statDate],
    query_timeout: 180000,
  });

  return Number(updated.rowCount || 0) + Number(inserted.rowCount || 0);
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials missing");
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const { isoDate } = nyDateParts();

  const calls = await fetchCallsSince6amEstToday(client);
  const allAoglobeLegs = calls.filter((c) => {
    const from = String(c?.from || "").toLowerCase();
    const to = String(c?.to || "").toLowerCase();
    return from.includes("@aoglobelife.com") || to.includes("@aoglobelife.com");
  });
  const outboundAoglobeLegs = allAoglobeLegs.filter((c) => isOutbound(c?.direction));
  const summaries = summarizeAgentDials(allAoglobeLegs);
  const csvBody = toCsv(summaries);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outputDir = path.join(scriptDir, "output");
  await fs.mkdir(outputDir, { recursive: true });
  const csvPath = path.join(outputDir, `twilio-agent-dials-${isoDate}-since-6am-est.csv`);
  await fs.writeFile(csvPath, csvBody, "utf8");

  const upsertedRows = await backfillAgentDailyDials(isoDate, summaries);
  const totalDials = summaries.reduce((sum, row) => sum + row.dials, 0);

  console.log(
    JSON.stringify(
      {
        ok: true,
        statDate: isoDate,
        window: `${isoDate} 06:00:00 America/New_York -> now`,
        twilioApiCallsSince6amEst: calls.length,
        twilioApiCallsWithAoglobelifeLeg: allAoglobeLegs.length,
        twilioApiOutboundCallsWithAoglobelifeLeg: outboundAoglobeLegs.length,
        agentsBackfilled: summaries.length,
        totalAgentDialsBackfilled: totalDials,
        rowsUpserted: upsertedRows,
        csvPath,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error((err as Error)?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

