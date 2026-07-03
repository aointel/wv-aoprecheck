/**
 * Check actual Twilio account: list recent outbound calls and their recording status.
 * Uses only Twilio REST API (no DB). Confirms which account we're hitting and whether
 * recordings exist for recent calls.
 *
 * Run: npx tsx server/scripts/twilio-check-account-recordings.ts [--days 7] [--limit 50]
 */

import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config";

function authHeader(): string {
  return "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("❌ Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN (e.g. in hardcoded-config).");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let days = 7;
  let limit = 50;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[i + 1], 10) || 7;
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10) || 50;
      i++;
    }
  }

  const base = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startMs = start.getTime();

  // Show which account we're querying (mask full SID for logs)
  const sidDisplay =
    TWILIO_ACCOUNT_SID.length > 8
      ? TWILIO_ACCOUNT_SID.slice(0, 4) + "..." + TWILIO_ACCOUNT_SID.slice(-4)
      : TWILIO_ACCOUNT_SID;
  console.log("Twilio account (Calls API):", sidDisplay);
  console.log("Full Account SID (for dashboard):", TWILIO_ACCOUNT_SID);
  console.log("Date range: last", days, "days (since", start.toISOString().slice(0, 10), ")");
  console.log("Max outbound calls to check:", limit, "\n");

  const outbound: Array<{
    sid: string;
    to: string;
    from: string;
    duration: string | null;
    date_created: string;
    status: string;
    direction: string;
  }> = [];
  const apiBase = "https://api.twilio.com";
  let nextPageUri: string | null = `${base}/Calls.json?PageSize=100`;

  while (nextPageUri && outbound.length < limit) {
    const url = nextPageUri.startsWith("http") ? nextPageUri : apiBase + nextPageUri;
    const res = await fetch(url, { headers: { Authorization: authHeader() } });
    if (!res.ok) {
      console.error("❌ Twilio API error:", res.status, await res.text());
      process.exit(1);
    }
    const data = (await res.json()) as {
      calls?: Array<{
        sid: string;
        to: string;
        from: string;
        duration: string | null;
        date_created: string;
        status: string;
        direction: string;
      }>;
      next_page_uri?: string | null;
    };
    const calls = data.calls ?? [];
    for (const c of calls) {
      const t = new Date(c.date_created || 0).getTime();
      if (t < startMs) continue;
      const dir = (c.direction || "").toLowerCase();
      const isOutbound = dir === "outbound-api" || dir === "outbound-dial";
      if (isOutbound && (c.status === "completed" || c.status === "in-progress" || c.status === "busy" || c.status === "no-answer")) {
        outbound.push({
          sid: c.sid,
          to: c.to ?? "—",
          from: c.from ?? "—",
          duration: c.duration,
          date_created: c.date_created ?? "—",
          status: c.status,
          direction: c.direction ?? "—",
        });
        if (outbound.length >= limit) break;
      }
    }
    nextPageUri = data.next_page_uri ?? null;
    if (calls.length === 0) break;
  }

  console.log("Outbound calls in range:", outbound.length);
  if (outbound.length === 0) {
    console.log("No outbound calls in this window. Try --days 14 or 30.");
    process.exit(0);
  }

  // For each call, get Recordings and classify
  let withCompleted = 0;
  let withInProgress = 0;
  let withNone = 0;
  const details: Array<{ sid: string; to: string; date: string; recStatus: string; recCount: number }> = [];

  for (const call of outbound) {
    const recUrl = `${base}/Calls/${call.sid}/Recordings.json?PageSize=10`;
    const recRes = await fetch(recUrl, { headers: { Authorization: authHeader() } });
    let recStatus = "none";
    let recCount = 0;
    if (recRes.ok) {
      const recData = (await recRes.json()) as { recordings?: Array<{ status?: string }> };
      const list = recData.recordings ?? [];
      recCount = list.length;
      const completed = list.filter((r: any) => (r.status ?? (r as any).Status) === "completed");
      const inProgress = list.filter((r: any) => (r.status ?? (r as any).Status) === "in-progress");
      if (completed.length > 0) {
        recStatus = "completed";
        withCompleted++;
      } else if (inProgress.length > 0) {
        recStatus = "in-progress";
        withInProgress++;
      } else if (list.length > 0) {
        recStatus = (list[0] as any).status ?? (list[0] as any).Status ?? "?";
        withInProgress++;
      } else {
        withNone++;
      }
    } else {
      withNone++;
    }
    details.push({
      sid: call.sid,
      to: call.to,
      date: (call.date_created || "").slice(0, 19),
      recStatus,
      recCount,
    });
  }

  console.log("\n--- Recording status on Twilio account ---");
  console.log("  With completed recording:", withCompleted);
  console.log("  With in-progress / other:", withInProgress);
  console.log("  With no recordings:", withNone);
  console.log("");

  // Show first 20 calls with recording status so you can cross-check in Twilio console
  console.log("Sample calls (check these in Twilio Console > Monitor > Logs > Calls):");
  console.log("  Call SID                    | To           | Date                 | Recordings");
  console.log("  ----------------------------|--------------|----------------------|------------");
  details.slice(0, 20).forEach((d) => {
    const sid = d.sid.padEnd(34).slice(0, 34);
    const to = (d.to || "—").padEnd(12).slice(0, 12);
    const date = (d.date || "—").padEnd(20).slice(0, 20);
    console.log(`  ${sid} | ${to} | ${date} | ${d.recCount} (${d.recStatus})`);
  });
  if (details.length > 20) {
    console.log("  ... and", details.length - 20, "more.");
  }

  console.log("\nTwilio Console URL (replace ACCOUNT_SID):");
  console.log("  https://console.twilio.com/us1/monitor/logs/calls?accountSid=" + TWILIO_ACCOUNT_SID);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
