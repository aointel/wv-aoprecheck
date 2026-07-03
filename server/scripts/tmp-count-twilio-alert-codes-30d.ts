import fs from "fs";
import path from "path";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

async function fetchJson(url: string) {
  const auth = "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio Alerts API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<any>;
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error("Twilio credentials missing");
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let nextUrl: string | null = "https://monitor.twilio.com/v1/Alerts?PageSize=1000";
  let pages = 0;
  let alertsSeen = 0;
  const byErrorCode: Record<string, number> = {};
  let oldestSeen: string | null = null;
  let newestSeen: string | null = null;
  let reachedWindowBoundary = false;
  const maxPages = 5000;

  while (nextUrl && pages < maxPages) {
    const data = await fetchJson(nextUrl);
    pages += 1;
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];
    if (!alerts.length) break;

    for (const a of alerts) {
      const created = a.date_created ? new Date(a.date_created) : null;
      if (!created) continue;

      const iso = created.toISOString();
      if (!newestSeen) newestSeen = iso;
      oldestSeen = iso;

      if (created < since) {
        reachedWindowBoundary = true;
        continue;
      }

      alertsSeen += 1;
      const code = a.error_code ? String(a.error_code) : "no_error_code";
      byErrorCode[code] = (byErrorCode[code] || 0) + 1;
    }

    if (reachedWindowBoundary) break;
    nextUrl = data?.meta?.next_page_url || null;

    if (pages % 25 === 0) {
      console.log(
        JSON.stringify({
          progress: "running",
          pages,
          alertsSeenInWindow: alertsSeen,
          oldestSeen,
          newestSeen,
        }),
      );
    }
  }

  const outDir = path.resolve(process.cwd(), "server", "scripts", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `twilio-alert-error-codes-30d-full-${stamp}.json`);
  const payload = {
    generatedAtUtc: new Date().toISOString(),
    windowStartUtc: since.toISOString(),
    pagesFetched: pages,
    reachedWindowBoundary,
    alertsSeenInWindow: alertsSeen,
    newestSeen,
    oldestSeen,
    byErrorCode: Object.fromEntries(Object.entries(byErrorCode).sort((a, b) => b[1] - a[1])),
  };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        ...payload,
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

