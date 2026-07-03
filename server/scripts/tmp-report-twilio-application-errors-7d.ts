import fs from "fs";
import path from "path";
import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

type Row = {
  sid: string;
  dateCreated: string | null;
  startTime: string | null;
  endTime: string | null;
  direction: string | null;
  status: string | null;
  from: string | null;
  to: string | null;
  errorCode: string | null;
  duration: string | null;
  parentCallSid: string | null;
};

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials missing");
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows: Row[] = [];
  let pageToken: string | undefined;

  while (true) {
    const page = await client.calls.page({
      startTimeAfter: since,
      pageSize: 1000,
      status: "failed",
      ...(pageToken ? { pageToken } : {}),
    } as any);

    for (const c of page.instances as any[]) {
      rows.push({
        sid: c.sid || "",
        dateCreated: c.dateCreated ? new Date(c.dateCreated).toISOString() : null,
        startTime: c.startTime ? new Date(c.startTime).toISOString() : null,
        endTime: c.endTime ? new Date(c.endTime).toISOString() : null,
        direction: c.direction || null,
        status: c.status || null,
        from: c.from || null,
        to: c.to || null,
        errorCode: c.errorCode ? String(c.errorCode) : null,
        duration: c.duration ? String(c.duration) : null,
        parentCallSid: c.parentCallSid || null,
      });
    }

    const nextUri = (page as any)?.nextPageUrl || "";
    if (!nextUri) break;
    const tokenMatch = String(nextUri).match(/[?&]PageToken=([^&]+)/i);
    pageToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined;
    if (!pageToken) break;
  }

  const byDirection: Record<string, number> = {};
  const byErrorCode: Record<string, number> = {};
  for (const r of rows) {
    const d = (r.direction || "unknown").toLowerCase();
    byDirection[d] = (byDirection[d] || 0) + 1;
    const e = r.errorCode || "no_error_code";
    byErrorCode[e] = (byErrorCode[e] || 0) + 1;
  }

  const outDir = path.resolve(process.cwd(), "server", "scripts", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `twilio-application-errors-7d-${stamp}.json`);

  const payload = {
    source: "twilio_api",
    generatedAtUtc: new Date().toISOString(),
    windowStartUtc: since.toISOString(),
    totalFailedCalls: rows.length,
    byDirection,
    byErrorCode,
    rows,
  };

  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        totalFailedCalls: rows.length,
        byDirection,
        topErrorCodes: Object.entries(byErrorCode)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([errorCode, count]) => ({ errorCode, count })),
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

