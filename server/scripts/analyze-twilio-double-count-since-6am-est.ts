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

function normalizePhone(value: unknown): string {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function bucketMinute(isoLike: unknown): string {
  if (!isoLike) return "";
  const d = new Date(String(isoLike));
  if (Number.isNaN(d.getTime())) return "";
  d.setSeconds(0, 0);
  return d.toISOString();
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

  const outbound = calls.filter((c: any) => {
    const t = c.startTime || c.dateCreated;
    if (!t) return false;
    if (new Date(t).getTime() < sinceUtcMs) return false;
    return String(c.direction || "").toLowerCase().startsWith("outbound");
  });

  const sidKeys = new Set<string>();
  const familyKeys = new Set<string>(); // parentCallSid group; fallback sid
  const toMinuteKeys = new Set<string>(); // destination + minute bucket
  const toOnly = new Set<string>();

  for (const c of outbound) {
    const sid = String(c.sid || "").trim();
    if (sid) sidKeys.add(sid);

    const parent = String(c.parentCallSid || "").trim();
    familyKeys.add(parent || sid || `nosid:${Math.random()}`);

    const to10 = normalizePhone(c.to);
    if (to10) toOnly.add(to10);
    const minute = bucketMinute(c.startTime || c.dateCreated);
    if (to10 && minute) toMinuteKeys.add(`${to10}|${minute}`);
  }

  console.log(
    JSON.stringify(
      {
        nyDate: isoDate,
        sinceEst: `${isoDate} 06:00:00 America/New_York`,
        sinceUtc: new Date(sinceUtcMs).toISOString(),
        outboundLegsRaw: outbound.length,
        uniqueBySid: sidKeys.size,
        uniqueByParentFamily: familyKeys.size,
        uniqueByToPhone: toOnly.size,
        uniqueByToPhonePerMinute: toMinuteKeys.size,
        duplicateLegsVsParentFamily: outbound.length - familyKeys.size,
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
