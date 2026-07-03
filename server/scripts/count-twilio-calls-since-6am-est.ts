import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

function getNyDateParts(now = new Date()): { year: number; month: number; day: number; isoDate: string } {
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = isoDate.split("-").map(Number);
  return { year, month, day, isoDate };
}

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

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials missing");
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const { year, month, day, isoDate } = getNyDateParts();
  const sinceUtcMs = nyLocalToUtcMs(year, month, day, 6, 0, 0);
  const sinceUtc = new Date(sinceUtcMs);

  // Twilio API filters by date, then we filter by exact 6AM EST timestamp.
  const startTimeAfter = isoDate;
  let startTimeBefore: string | undefined;
  const calls: any[] = [];

  while (true) {
    const page = await client.calls.list({
      startTimeAfter,
      startTimeBefore,
      limit: 1000,
    } as any);
    if (page.length === 0) break;
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

  const totalCallsSince6amEst = calls.filter((c: any) => {
    const t = c.startTime || c.dateCreated;
    if (!t) return false;
    return new Date(t).getTime() >= sinceUtcMs;
  }).length;

  console.log(
    JSON.stringify(
      {
        nyDate: isoDate,
        sinceEst: `${isoDate} 06:00:00 America/New_York`,
        sinceUtc: sinceUtc.toISOString(),
        fetchedFromTwilio: calls.length,
        totalCallsSince6amEst,
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
