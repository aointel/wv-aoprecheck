import fs from "fs";
import path from "path";
import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

type EventRow = {
  sid: string;
  dateCreated: string | null;
  level: string | null;
  source: string | null;
  sourceIpAddress: string | null;
  actorSid: string | null;
  eventGroup: string | null;
  eventData: any;
  errorCode: string | null;
  requestUrl: string | null;
  description: string | null;
};

function extractErrorCode(e: any): string | null {
  const candidates = [
    e?.errorCode,
    e?.eventData?.error_code,
    e?.eventData?.errorCode,
    e?.eventData?.response?.body?.code,
    e?.eventData?.request?.parameters?.ErrorCode,
  ];
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return null;
}

function extractRequestUrl(e: any): string | null {
  return (
    e?.eventData?.request?.url ||
    e?.eventData?.request_url ||
    e?.requestUrl ||
    null
  );
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error("Twilio credentials missing");
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows: EventRow[] = [];
  let pageToken: string | undefined;

  while (true) {
    const page = await (client as any).monitor.v1.events.page({
      pageSize: 1000,
      ...(pageToken ? { pageToken } : {}),
    });

    const instances = page.instances || [];
    for (const e of instances) {
      const created = e.dateCreated ? new Date(e.dateCreated) : null;
      if (created && created < since) continue;

      const row: EventRow = {
        sid: e.sid || "",
        dateCreated: created ? created.toISOString() : null,
        level: e.level || null,
        source: e.source || null,
        sourceIpAddress: e.sourceIpAddress || null,
        actorSid: e.actorSid || null,
        eventGroup: e.eventGroup || null,
        eventData: e.eventData || null,
        errorCode: extractErrorCode(e),
        requestUrl: extractRequestUrl(e),
        description: e.description || null,
      };
      rows.push(row);
    }

    const nextUri = (page as any)?.nextPageUrl || "";
    if (!nextUri) break;
    const tokenMatch = String(nextUri).match(/[?&]PageToken=([^&]+)/i);
    pageToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined;
    if (!pageToken) break;
  }

  const inWindow = rows.filter((r) => r.dateCreated && new Date(r.dateCreated) >= since);
  const withErrorCode = inWindow.filter((r) => !!r.errorCode);

  const byCode: Record<string, number> = {};
  for (const r of withErrorCode) byCode[r.errorCode as string] = (byCode[r.errorCode as string] || 0) + 1;

  const outDir = path.resolve(process.cwd(), "server", "scripts", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `twilio-monitor-error-codes-30d-${stamp}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        generatedAtUtc: new Date().toISOString(),
        windowStartUtc: since.toISOString(),
        totalMonitorEventsFetchedInWindow: inWindow.length,
        totalEventsWithErrorCode: withErrorCode.length,
        byErrorCode: Object.fromEntries(Object.entries(byCode).sort((a, b) => b[1] - a[1])),
        sample: withErrorCode.slice(0, 200),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        windowStartUtc: since.toISOString(),
        totalMonitorEventsFetchedInWindow: inWindow.length,
        totalEventsWithErrorCode: withErrorCode.length,
        topErrorCodes: Object.entries(byCode)
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

