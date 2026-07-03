import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

function toIsoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDuration(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function extractClientIdentity(value: unknown): string | null {
  const s = String(value || "").trim().toLowerCase();
  const m = s.match(/^client:(.+)$/i);
  return m ? m[1] : null;
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials missing");
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const startTimeAfter = toIsoDateOnly(since);

  const allCalls: any[] = [];
  let startTimeBefore: string | undefined;

  while (true) {
    const opts: any = { limit: 1000, startTimeAfter };
    if (startTimeBefore) opts.startTimeBefore = startTimeBefore;

    const page = await client.calls.list(opts);
    if (page.length === 0) break;

    allCalls.push(...page);
    if (page.length < 1000) break;

    const last = page[page.length - 1];
    const lastStart = last.startTime ?? (last as any).dateCreated;
    if (!lastStart) break;
    const d = new Date(lastStart);
    if (Number.isNaN(d.getTime())) break;
    d.setSeconds(d.getSeconds() - 1);
    startTimeBefore = d.toISOString().slice(0, 19);
  }

  const outbound = allCalls.filter((c) => String((c as any).direction || "").toLowerCase().startsWith("outbound"));

  const uniqueDialSids = new Set<string>();
  const uniqueDialSidsOver45 = new Set<string>();
  const uniqueClientUsers = new Set<string>();
  const uniqueOutboundFrom = new Set<string>();

  for (const c of allCalls) {
    const fromClient = extractClientIdentity((c as any).from);
    const toClient = extractClientIdentity((c as any).to);
    if (fromClient) uniqueClientUsers.add(fromClient);
    if (toClient) uniqueClientUsers.add(toClient);
  }

  for (const c of outbound) {
    const sid = String((c as any).sid || "").trim();
    if (!sid) continue;
    uniqueDialSids.add(sid);
    const dur = parseDuration((c as any).duration);
    if (dur > 45) uniqueDialSidsOver45.add(sid);

    const from = String((c as any).from || "").trim();
    if (from) uniqueOutboundFrom.add(from);
  }

  const result = {
    source: "twilio_api",
    windowHours: 24,
    fetchedCalls: allCalls.length,
    outboundCalls: outbound.length,
    unique_dials_24h: uniqueDialSids.size,
    unique_dials_over_45s_24h: uniqueDialSidsOver45.size,
    unique_users_24h_from_client_identity: uniqueClientUsers.size,
    unique_users_24h_from_outbound_from_number: uniqueOutboundFrom.size,
    generatedAtUtc: new Date().toISOString(),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error((e as Error)?.message || String(e));
  process.exit(1);
});

