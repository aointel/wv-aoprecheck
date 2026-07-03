import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";
import { collectDialStatsBaseline, getOperationalDialWindow } from "../dial-stats-chain.js";

function nyLocalToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): number {
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

async function countTwilioOutboundSince6amEt(nyDate: string): Promise<{ outboundAny: number; fetchedFromTwilioDate: number }> {
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const [year, month, day] = nyDate.split("-").map(Number);
  const sinceUtcMs = nyLocalToUtcMs(year, month, day, 6, 0, 0);

  let startTimeBefore: string | undefined;
  const allRows: any[] = [];
  while (true) {
    const page = await client.calls.list({
      startTimeAfter: nyDate,
      startTimeBefore,
      limit: 1000,
    } as any);
    if (page.length === 0) break;
    allRows.push(...page);
    if (page.length < 1000) break;
    const last = page[page.length - 1] as any;
    const t = last.startTime || last.dateCreated;
    if (!t) break;
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) break;
    d.setSeconds(d.getSeconds() - 1);
    startTimeBefore = d.toISOString().slice(0, 19);
  }

  const outboundAny = allRows.filter((c: any) => {
    const t = c.startTime || c.dateCreated;
    if (!t) return false;
    const ts = new Date(t).getTime();
    if (Number.isNaN(ts) || ts < sinceUtcMs) return false;
    return String(c.direction || "").toLowerCase().startsWith("outbound");
  }).length;

  return { outboundAny, fetchedFromTwilioDate: allRows.length };
}

async function main() {
  const { nyDate, windowStartIso, windowEndIso } = getOperationalDialWindow();
  const dbBaseline = await collectDialStatsBaseline(windowStartIso, windowEndIso, nyDate);
  const twilio = await countTwilioOutboundSince6amEt(nyDate);

  console.log(
    JSON.stringify(
      {
        nyDate,
        windowStartIso,
        windowEndIso,
        twilioApiOutboundAnySince6amEt: twilio.outboundAny,
        twilioFetchedRowsForDate: twilio.fetchedFromTwilioDate,
        twilioCallLogsOutboundAny: dbBaseline.twilioOutboundTotal,
        twilioCallLogsResolvableOutbound: dbBaseline.twilioResolvableOutbound,
        agentDialMetricsDials: dbBaseline.admDials,
        agentDailyStatsDials: dbBaseline.adsDials,
        drift: {
          twilioApiToLogsAny: twilio.outboundAny - dbBaseline.twilioOutboundTotal,
          logsResolvableToAdm: dbBaseline.twilioResolvableOutbound - dbBaseline.admDials,
          logsResolvableToAds: dbBaseline.twilioResolvableOutbound - dbBaseline.adsDials,
          admToAds: dbBaseline.admDials - dbBaseline.adsDials,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error((error as Error)?.message || String(error));
  process.exit(1);
});

