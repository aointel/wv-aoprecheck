import fs from "fs";
import path from "path";
import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error("Twilio credentials missing");
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const all = await (client as any).monitor.v1.alerts.list({
    limit: 5000,
    startDate: since,
    endDate: new Date(),
  });
  const alerts: any[] = [];
  for (const a of all) {
    const created = a.dateCreated ? new Date(a.dateCreated) : null;
    if (created && created < since) continue;
    alerts.push({
      sid: a.sid,
      dateCreated: created ? created.toISOString() : null,
      errorCode: a.errorCode ? String(a.errorCode) : null,
      alertText: a.alertText || null,
      logLevel: a.logLevel || null,
      requestUrl: a.requestUrl || null,
      moreInfo: a.moreInfo || null,
    });
  }

  const byCode: Record<string, number> = {};
  for (const a of alerts) {
    const k = a.errorCode || "no_error_code";
    byCode[k] = (byCode[k] || 0) + 1;
  }

  const outDir = path.resolve(process.cwd(), "server", "scripts", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `twilio-alert-error-codes-30d-${stamp}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        generatedAtUtc: new Date().toISOString(),
        windowStartUtc: since.toISOString(),
        totalAlerts: alerts.length,
        byErrorCode: Object.fromEntries(Object.entries(byCode).sort((a, b) => b[1] - a[1])),
        alerts,
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
        totalAlerts: alerts.length,
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

