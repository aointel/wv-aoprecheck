import fs from "fs";
import path from "path";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchJson(url: string) {
  const auth = "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: auth } });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function fetchDay(startDate: string, endDate: string) {
  let nextUrl: string | null = `https://monitor.twilio.com/v1/Alerts?PageSize=1000&StartDate=${encodeURIComponent(
    startDate,
  )}&EndDate=${encodeURIComponent(endDate)}`;
  const rows: any[] = [];
  let pages = 0;
  let capped = false;
  let error: string | null = null;

  while (nextUrl) {
    try {
      const data = await fetchJson(nextUrl);
      pages += 1;
      const alerts = Array.isArray(data.alerts) ? data.alerts : [];
      rows.push(...alerts);
      nextUrl = data?.meta?.next_page_url || null;
    } catch (e: any) {
      error = e?.message || String(e);
      if (String(error).includes("10,000 results")) capped = true;
      break;
    }
  }

  return { rows, pages, capped, error };
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error("Twilio credentials missing");

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);

  const byErrorCode: Record<string, number> = {};
  const days: any[] = [];
  let totalAlerts = 0;
  let totalPages = 0;
  let cappedDays = 0;

  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dayStart = toIsoDate(d);
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    const dayEnd = toIsoDate(next);
    const result = await fetchDay(dayStart, dayEnd);
    console.log(
      JSON.stringify({
        progress: "day_complete",
        dayStart,
        alerts: result.rows.length,
        pages: result.pages,
        capped: result.capped,
      }),
    );

    totalAlerts += result.rows.length;
    totalPages += result.pages;
    if (result.capped) cappedDays += 1;

    const dayByCode: Record<string, number> = {};
    for (const a of result.rows) {
      const code = a.error_code ? String(a.error_code) : "no_error_code";
      byErrorCode[code] = (byErrorCode[code] || 0) + 1;
      dayByCode[code] = (dayByCode[code] || 0) + 1;
    }

    days.push({
      dayStart,
      dayEndExclusive: dayEnd,
      alerts: result.rows.length,
      pages: result.pages,
      cappedAtPlatformLimit: result.capped,
      error: result.error,
      topErrorCodes: Object.entries(dayByCode)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([code, count]) => ({ code, count })),
    });
  }

  const outDir = path.resolve(process.cwd(), "server", "scripts", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `twilio-alert-error-codes-30d-by-day-${stamp}.json`);
  const payload = {
    generatedAtUtc: new Date().toISOString(),
    windowStartUtcDate: toIsoDate(start),
    windowEndUtcDateExclusive: toIsoDate(end),
    totalAlertsScanned: totalAlerts,
    totalPagesScanned: totalPages,
    cappedDays,
    byErrorCode: Object.fromEntries(Object.entries(byErrorCode).sort((a, b) => b[1] - a[1])),
    days,
  };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        windowStartUtcDate: payload.windowStartUtcDate,
        windowEndUtcDateExclusive: payload.windowEndUtcDateExclusive,
        totalAlertsScanned: payload.totalAlertsScanned,
        cappedDays: payload.cappedDays,
        topErrorCodes: Object.entries(byErrorCode)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([code, count]) => ({ code, count })),
        reportFile: outFile,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error((e as Error)?.message || String(e));
  process.exit(1);
});

