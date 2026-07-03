import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

type TwilioCallLite = {
  sid: string;
  parentCallSid?: string | null;
  from?: string | null;
  to?: string | null;
  direction?: string | null;
  status?: string | null;
  duration?: string | number | null;
  startTime?: Date | null;
  endTime?: Date | null;
  dateCreated?: Date | null;
  dateUpdated?: Date | null;
};

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function nyDateParts(now = new Date()): { isoDate: string; year: number; month: number; day: number } {
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = isoDate.split("-").map(Number);
  return { isoDate, year, month, day };
}

function nyLocalToUtcMs(year: number, month: number, day: number, hour: number, minute = 0, second = 0): number {
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

function toCsvField(value: unknown): string {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

async function fetchCallsForEndpoint(
  client: ReturnType<typeof twilio>,
  kind: "from" | "to",
  endpoint: string,
  startTimeAfter: string,
): Promise<TwilioCallLite[]> {
  let startTimeBefore: string | undefined;
  const out: TwilioCallLite[] = [];
  while (true) {
    const page = await client.calls.list({
      [kind]: endpoint,
      startTimeAfter,
      startTimeBefore,
      limit: 1000,
    } as any);
    if (!page.length) break;
    out.push(...(page as any[]));
    if (page.length < 1000) break;
    const last = page[page.length - 1] as any;
    const ts = last.startTime || last.dateCreated;
    if (!ts) break;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) break;
    d.setSeconds(d.getSeconds() - 1);
    startTimeBefore = d.toISOString().slice(0, 19);
  }
  return out;
}

async function main() {
  const agentEmail = String(getArg("agent") || "").trim().toLowerCase();
  if (!agentEmail || !agentEmail.includes("@")) {
    throw new Error("Pass --agent=<email>");
  }
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials missing");
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const { isoDate, year, month, day } = nyDateParts();
  const sinceUtcMs = nyLocalToUtcMs(year, month, day, 6, 0, 0);
  const endpoint = `client:${agentEmail}`;

  const fromCalls = await fetchCallsForEndpoint(client, "from", endpoint, isoDate);
  const toCalls = await fetchCallsForEndpoint(client, "to", endpoint, isoDate);

  const bySid = new Map<string, TwilioCallLite>();
  for (const call of [...fromCalls, ...toCalls]) {
    const sid = String(call.sid || "");
    if (!sid) continue;
    const ts = call.startTime || call.dateCreated;
    if (!ts || new Date(ts).getTime() < sinceUtcMs) continue;
    bySid.set(sid, call);
  }

  const calls = Array.from(bySid.values()).sort((a, b) => {
    const ta = new Date((a.startTime || a.dateCreated || 0) as any).getTime();
    const tb = new Date((b.startTime || b.dateCreated || 0) as any).getTime();
    return tb - ta;
  });

  const headers = [
    "sid",
    "parent_call_sid",
    "start_time_utc",
    "end_time_utc",
    "direction",
    "status",
    "duration_seconds",
    "from",
    "to",
  ];
  const lines = [headers.join(",")];
  for (const c of calls) {
    lines.push(
      [
        toCsvField(c.sid),
        toCsvField(c.parentCallSid || ""),
        toCsvField(c.startTime ? new Date(c.startTime).toISOString() : c.dateCreated ? new Date(c.dateCreated).toISOString() : ""),
        toCsvField(c.endTime ? new Date(c.endTime).toISOString() : c.dateUpdated ? new Date(c.dateUpdated).toISOString() : ""),
        toCsvField(c.direction || ""),
        toCsvField(c.status || ""),
        toCsvField(c.duration ?? ""),
        toCsvField(c.from || ""),
        toCsvField(c.to || ""),
      ].join(","),
    );
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outputDir = path.join(scriptDir, "output");
  await fs.mkdir(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outputDir, `twilio-calls-${agentEmail.replace(/[^a-z0-9]+/gi, "_")}-since-6am-est-${stamp}.csv`);
  await fs.writeFile(outPath, `${lines.join("\n")}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        agent: agentEmail,
        endpoint,
        window: `${isoDate} 06:00:00 America/New_York -> now`,
        fromMatches: fromCalls.length,
        toMatches: toCalls.length,
        uniqueCallsSince6amEst: calls.length,
        csvPath: outPath,
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
