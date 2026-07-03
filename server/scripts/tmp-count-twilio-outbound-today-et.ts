import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

function etTodayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error("Twilio credentials missing");

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const startTimeAfter = etTodayIsoDate(); // ET date boundary for today

  const calls: any[] = [];
  let startTimeBefore: string | undefined;

  while (true) {
    const page = await client.calls.list({ startTimeAfter, startTimeBefore, limit: 1000 } as any);
    if (!page.length) break;
    calls.push(...page);
    if (page.length < 1000) break;
    const last = page[page.length - 1] as any;
    const t = last.startTime || last.dateCreated;
    if (!t) break;
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) break;
    d.setSeconds(d.getSeconds() - 1);
    startTimeBefore = d.toISOString().slice(0, 19);
  }

  const outbound = calls.filter((c: any) => String(c.direction || "").toLowerCase().startsWith("outbound"));

  console.log(
    JSON.stringify(
      {
        source: "twilio_api",
        etDate: startTimeAfter,
        totalCallsTodayEt: calls.length,
        outboundDialsTodayEt: outbound.length,
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

