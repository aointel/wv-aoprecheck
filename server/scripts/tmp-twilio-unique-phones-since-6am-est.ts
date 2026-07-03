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

function normalizeLast10(v: unknown): string {
  return String(v || "").replace(/\D/g, "").slice(-10);
}

function isClientIdentity(v: unknown): boolean {
  return String(v || "").trim().toLowerCase().startsWith("client:");
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error("Twilio credentials missing");

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const { year, month, day, isoDate } = getNyDateParts();
  const sinceUtcMs = nyLocalToUtcMs(year, month, day, 6, 0, 0);

  let startTimeBefore: string | undefined;
  const calls: any[] = [];
  while (true) {
    const page = await client.calls.list({
      startTimeAfter: isoDate,
      startTimeBefore,
      limit: 1000,
    } as any);
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

  const outboundSince6am = calls.filter((c: any) => {
    const t = c.startTime || c.dateCreated;
    if (!t) return false;
    if (new Date(t).getTime() < sinceUtcMs) return false;
    return String(c.direction || "").toLowerCase().startsWith("outbound");
  });

  const dialedPhones = outboundSince6am
    .map((c: any) => String(c.to || "").trim())
    .filter((to) => to && !isClientIdentity(to))
    .map(normalizeLast10)
    .filter((p) => p.length === 10);

  const uniqueDialedPhones = new Set(dialedPhones);

  console.log(
    JSON.stringify(
      {
        source: "twilio_api",
        nyDate: isoDate,
        sinceEst: `${isoDate} 06:00:00 America/New_York`,
        sinceUtc: new Date(sinceUtcMs).toISOString(),
        outboundCallRowsSince6am: outboundSince6am.length,
        uniqueDialedPhonesSince6am: uniqueDialedPhones.size,
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

