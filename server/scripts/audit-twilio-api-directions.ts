import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

async function main() {
  const day = String(process.argv[2] || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    console.error("Usage: npx tsx server/scripts/audit-twilio-api-directions.ts YYYY-MM-DD");
    process.exit(1);
  }
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Missing Twilio credentials");
  }

  const start = new Date(`${day}T10:00:00.000Z`); // 6:00 AM ET
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  let pageToken: string | undefined;
  const counts = new Map<string, number>();
  let total = 0;

  while (true) {
    const page = await client.calls.page({
      startTimeAfter: start,
      startTimeBefore: end,
      pageSize: 1000,
      ...(pageToken ? { pageToken } : {}),
    });
    for (const call of page.instances) {
      const dir = String(call.direction || "unknown").toLowerCase();
      counts.set(dir, (counts.get(dir) || 0) + 1);
      total += 1;
    }
    const nextUri = (page as any)?.nextPageUrl || "";
    if (!nextUri) break;
    const tokenMatch = String(nextUri).match(/[?&]PageToken=([^&]+)/i);
    pageToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined;
    if (!pageToken) break;
  }

  console.log(
    JSON.stringify(
      {
        day,
        windowUtc: { start: start.toISOString(), end: end.toISOString() },
        total,
        byDirection: Object.fromEntries(Array.from(counts.entries()).sort((a, b) => b[1] - a[1])),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error((err as Error)?.message || String(err));
  process.exit(1);
});
