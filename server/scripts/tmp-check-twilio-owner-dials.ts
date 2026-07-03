import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";
import { leaseDialerPool as pool } from "../db.js";

function extractAgentEmail(endpoint: unknown): string | null {
  const s = String(endpoint || "").trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("client:")) {
    const identity = s.slice("client:".length).trim().toLowerCase();
    return identity.includes("@") ? identity : null;
  }
  return s.includes("@") ? s : null;
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials missing");
  }

  const hoursBack = Math.max(1, Number(process.argv[2] || 2));
  const ownerLimit = Math.max(1, Math.min(1000, Number(process.argv[3] || 200)));
  const start = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const ownersResult = await pool.query<{ agent_email: string }>(
    `
      SELECT lower(agent_email) AS agent_email
      FROM leasedialer_assignments
      WHERE status IN ('queued', 'active')
      GROUP BY 1
      ORDER BY COUNT(*) DESC
      LIMIT $1
    `,
    [ownerLimit],
  );
  const owners = new Set(ownersResult.rows.map((r) => String(r.agent_email || "").toLowerCase()).filter(Boolean));

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const calls = await client.calls.list({
    startTimeAfter: start,
    pageSize: 1000,
    limit: 20000,
  } as any);

  const ownerBySid = new Map<string, string>();
  for (const call of calls as any[]) {
    const sid = String(call?.sid || "").trim();
    if (!sid) continue;
    const owner = extractAgentEmail(call?.from) || extractAgentEmail(call?.to);
    if (owner) ownerBySid.set(sid, owner);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const call of calls as any[]) {
      const sid = String(call?.sid || "").trim();
      const parent = String(call?.parentCallSid || "").trim();
      if (!sid || !parent) continue;
      const sidOwner = ownerBySid.get(sid);
      const parentOwner = ownerBySid.get(parent);
      if (!sidOwner && parentOwner) {
        ownerBySid.set(sid, parentOwner);
        changed = true;
      } else if (sidOwner && !parentOwner) {
        ownerBySid.set(parent, sidOwner);
        changed = true;
      }
    }
  }

  const lastDialByOwner = new Map<string, string>();
  let outbound = 0;
  for (const call of calls as any[]) {
    const direction = String(call?.direction || "").toLowerCase();
    if (!direction.startsWith("outbound")) continue;
    outbound += 1;
    const sid = String(call?.sid || "").trim();
    const parent = String(call?.parentCallSid || "").trim();
    const owner = extractAgentEmail(call?.from) || extractAgentEmail(call?.to) || ownerBySid.get(sid) || ownerBySid.get(parent);
    if (!owner || !owners.has(owner)) continue;
    const tsRaw = call?.startTime || call?.dateCreated;
    if (!tsRaw) continue;
    const ts = new Date(tsRaw);
    if (Number.isNaN(ts.getTime())) continue;
    const prev = lastDialByOwner.get(owner);
    if (!prev || ts > new Date(prev)) lastDialByOwner.set(owner, ts.toISOString());
  }

  const ownersWithoutOutbound = Array.from(owners).filter((owner) => !lastDialByOwner.has(owner));

  console.log(
    JSON.stringify(
      {
        hoursBack,
        windowStartUtc: start.toISOString(),
        ownersWithQueuedOrActive: owners.size,
        twilioCallsFetched: calls.length,
        twilioOutboundCalls: outbound,
        ownersWithOutboundInWindow: lastDialByOwner.size,
        ownersWithoutOutboundInWindow: ownersWithoutOutbound.length,
        sampleOwnersWithoutOutbound: ownersWithoutOutbound.slice(0, 25),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error((err as Error)?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
