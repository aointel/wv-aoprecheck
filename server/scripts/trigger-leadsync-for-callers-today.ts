import { supabaseAdmin } from "../supabase.js";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function todayPt(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

async function fetchCallerEmailsForDay(day: string): Promise<string[]> {
  if (!supabaseAdmin) throw new Error("supabaseAdmin not configured");

  const emails = new Set<string>();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("twilio_call_logs")
      .select("owner_email, call_direction, call_started_at")
      .gte("call_started_at", `${day}T00:00:00-08:00`)
      .lt("call_started_at", `${day}T23:59:59.999-08:00`)
      .not("owner_email", "is", null)
      .neq("owner_email", "")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed querying twilio_call_logs: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    for (const row of data as Array<{ owner_email?: string | null; call_direction?: string | null }>) {
      const email = String(row.owner_email || "").toLowerCase().trim();
      const direction = String(row.call_direction || "").toLowerCase().trim();
      if (!email.endsWith("@aoglobelife.com")) continue;
      if (!direction.startsWith("outbound")) continue;
      emails.add(email);
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return Array.from(emails).sort();
}

async function triggerOne(email: string, requestedCount: number): Promise<{ ok: boolean; status: number; body: string }> {
  console.warn(
    `[trigger-leadsync] DISABLED old bulk assignment for ${email}; would have requested ${requestedCount}`,
  );
  return {
    ok: true,
    status: 200,
    body: JSON.stringify({ ok: true, assigned: 0, disabled: true }),
  };
}

async function main() {
  const day = getArg("day") || todayPt();
  const requestedCount = Number(getArg("requestedCount") || "300");
  const dryRun = String(getArg("dryRun") || "").toLowerCase() === "true";

  const emails = await fetchCallerEmailsForDay(day);
  console.log(`[trigger-leadsync] day=${day} callers=${emails.length} endpoint=DISABLED`);

  if (emails.length === 0) {
    console.log("[trigger-leadsync] no @aoglobelife.com outbound callers found");
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify({ day, count: emails.length, emails }, null, 2));
    return;
  }

  let ok = 0;
  let failed = 0;
  const failures: Array<{ email: string; status: number; body: string }> = [];

  for (const email of emails) {
    try {
      const r = await triggerOne(email, requestedCount);
      if (r.ok) {
        ok += 1;
        console.log(`OK  ${email} -> ${r.status}`);
      } else {
        failed += 1;
        console.log(`ERR ${email} -> ${r.status}`);
        failures.push({ email, status: r.status, body: r.body.slice(0, 400) });
      }
    } catch (e: any) {
      failed += 1;
      const body = (e?.message || String(e)).slice(0, 400);
      console.log(`ERR ${email} -> exception`);
      failures.push({ email, status: 0, body });
    }
  }

  console.log(
    JSON.stringify(
      {
        day,
        requestedCount,
        totalCallers: emails.length,
        successCount: ok,
        failureCount: failed,
        failures,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error("[trigger-leadsync] fatal:", (e as Error)?.message || String(e));
  process.exit(1);
});

