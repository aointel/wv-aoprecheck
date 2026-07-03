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
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error("Twilio credentials missing");
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  const { year, month, day, isoDate } = getNyDateParts();
  const sinceUtcMs = nyLocalToUtcMs(year, month, day, 6, 0, 0);
  const marker = "@aoglobelife.com";

  const startTimeAfter = isoDate;
  let startTimeBefore: string | undefined;
  const calls: any[] = [];

  while (true) {
    const page = await client.calls.list({ startTimeAfter, startTimeBefore, limit: 1000 } as any);
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

  const inWindow = calls.filter((c: any) => {
    const t = c.startTime || c.dateCreated;
    return t ? new Date(t).getTime() >= sinceUtcMs : false;
  });

  const withAoiIdentity = inWindow.filter((c: any) => {
    const from = String(c.from || "").toLowerCase();
    const to = String(c.to || "").toLowerCase();
    return from.includes(marker) || to.includes(marker);
  });

  const uniqueEmails = new Set<string>();
  for (const c of withAoiIdentity) {
    for (const side of [c.from, c.to]) {
      const text = String(side || "").toLowerCase();
      const m = text.match(/[a-z0-9._%+-]+@aoglobelife\.com/g);
      if (m) m.forEach((e) => uniqueEmails.add(e));
    }
  }

  console.log(
    JSON.stringify(
      {
        nyDate: isoDate,
        sinceEst: `${isoDate} 06:00:00 America/New_York`,
        totalCallsSince6amEst: inWindow.length,
        callsWithAoglobelifeIdentity: withAoiIdentity.length,
        uniqueAoglobelifeEmails: Array.from(uniqueEmails).sort(),
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

