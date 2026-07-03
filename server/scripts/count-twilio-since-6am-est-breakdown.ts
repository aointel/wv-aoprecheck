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

function isClientIdentity(value: unknown): boolean {
  return String(value || "").trim().toLowerCase().startsWith("client:");
}

function isLikelyPstn(value: unknown): boolean {
  const s = String(value || "").trim();
  if (!s) return false;
  if (isClientIdentity(s)) return false;
  return /[0-9]/.test(s);
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error("Twilio credentials missing");

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const { year, month, day, isoDate } = getNyDateParts();
  const sinceUtcMs = nyLocalToUtcMs(year, month, day, 6, 0, 0);

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

  const windowCalls = calls.filter((c: any) => {
    const t = c.startTime || c.dateCreated;
    return t ? new Date(t).getTime() >= sinceUtcMs : false;
  });

  const byDirection: Record<string, number> = {};
  for (const c of windowCalls) {
    const dir = String((c as any).direction || "unknown").toLowerCase();
    byDirection[dir] = (byDirection[dir] || 0) + 1;
  }

  const outbound = windowCalls.filter((c: any) =>
    String((c as any).direction || "").toLowerCase().startsWith("outbound"),
  );
  const outboundApiDial = outbound.filter((c: any) =>
    ["outbound-api", "outbound-dial"].includes(String((c as any).direction || "").toLowerCase()),
  );
  const outboundToPstn = outbound.filter((c: any) => isLikelyPstn((c as any).to));
  const outboundFromClientToPstn = outbound.filter((c: any) =>
    isClientIdentity((c as any).from) && isLikelyPstn((c as any).to),
  );
  const parentLegsOnly = outbound.filter((c: any) => !String((c as any).parentCallSid || "").trim());

  console.log(
    JSON.stringify(
      {
        nyDate: isoDate,
        sinceEst: `${isoDate} 06:00:00 America/New_York`,
        sinceUtc: new Date(sinceUtcMs).toISOString(),
        fetchedFromTwilioToday: calls.length,
        totalCallsSince6amEst: windowCalls.length,
        byDirection,
        outboundAny: outbound.length,
        outboundApiOrDial: outboundApiDial.length,
        outboundToPstn: outboundToPstn.length,
        outboundFromClientToPstn: outboundFromClientToPstn.length,
        outboundParentLegsOnly: parentLegsOnly.length,
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
