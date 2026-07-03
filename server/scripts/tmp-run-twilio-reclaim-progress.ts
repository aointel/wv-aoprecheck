import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";
import { leaseDialerPool as pool } from "../db.js";
import { sweepStaleLeasedialerAgentQueues } from "../leasedialer-assignment-service";

function extractAgentEmail(endpoint: unknown): string | null {
  const raw = String(endpoint || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("client:")) {
    const identity = raw.slice("client:".length).trim().toLowerCase();
    return identity.includes("@") ? identity : null;
  }
  return raw.includes("@") ? raw : null;
}

async function fetchTwilioActiveOwnerEmails(lastMinutes: number): Promise<Set<string>> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Missing Twilio credentials");
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const startTimeAfter = new Date(Date.now() - Math.max(1, lastMinutes) * 60 * 1000);
  const calls = await client.calls.list({
    startTimeAfter,
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

  const owners = new Set<string>();
  for (const call of calls as any[]) {
    const direction = String(call?.direction || "").toLowerCase();
    if (!direction.startsWith("outbound")) continue;
    const sid = String(call?.sid || "").trim();
    const parent = String(call?.parentCallSid || "").trim();
    const owner =
      extractAgentEmail(call?.from) ||
      extractAgentEmail(call?.to) ||
      ownerBySid.get(sid) ||
      ownerBySid.get(parent);
    if (owner) owners.add(owner);
  }
  return owners;
}

async function getQueuedOwners() {
  const result = await pool.query<{ agent_email: string; queued_count: string }>(
    `
      SELECT lower(agent_email) AS agent_email, COUNT(*)::text AS queued_count
      FROM leasedialer_assignments
      WHERE status IN ('queued', 'active')
      GROUP BY 1
      ORDER BY COUNT(*) DESC, lower(agent_email) ASC
    `,
  );
  return result.rows.map((row) => ({
    agentEmail: String(row.agent_email || ""),
    queuedCount: Number(row.queued_count || 0),
  }));
}

async function getRemainingQueuedCount(): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM leasedialer_assignments WHERE status IN ('queued', 'active')`,
  );
  return Number(result.rows[0]?.count || 0);
}

async function main() {
  const noDialMinutes = Math.max(15, Number(process.argv[2] || 60));
  const initialBatch = Math.max(50, Number(process.argv[3] || 500));
  const maxPasses = Math.max(1, Number(process.argv[4] || 50));
  let batchSize = initialBatch;
  let totalReleased = 0;
  let totalCompletedBad = 0;

  let activeOwners = await fetchTwilioActiveOwnerEmails(noDialMinutes);
  const initialOwners = await getQueuedOwners();
  const inactiveOwnersInitial = initialOwners.filter((row) => !activeOwners.has(row.agentEmail));
  console.log(
    JSON.stringify(
      {
        phase: "start",
        noDialMinutes,
        queuedOwners: initialOwners.length,
        activeOwnersByTwilio: activeOwners.size,
        inactiveOwnersToReclaim: inactiveOwnersInitial.length,
        queuedLeadsOnInactiveOwners: inactiveOwnersInitial.reduce((sum, row) => sum + row.queuedCount, 0),
        sampleOwnerStatus: initialOwners.slice(0, 30).map((row) => ({
          owner: row.agentEmail,
          queued: row.queuedCount,
          madeCallLast60m: activeOwners.has(row.agentEmail) ? "Y" : "N",
        })),
      },
      null,
      2,
    ),
  );

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    if (pass % 3 === 1) {
      activeOwners = await fetchTwilioActiveOwnerEmails(noDialMinutes);
    }
    try {
      const sweepResult = await sweepStaleLeasedialerAgentQueues({
        batchSize,
        staleMinutes: 20,
        noDialReclaimMinutes: noDialMinutes,
      });
      totalReleased += Number(sweepResult.releasedToPool || 0);
      totalCompletedBad += Number(sweepResult.completedBad || 0);
      const remainingQueued = await getRemainingQueuedCount();
      console.log(
        JSON.stringify({
          phase: "progress",
          pass,
          batchSize,
          releasedThisPass: sweepResult.releasedToPool,
          completedBadThisPass: sweepResult.completedBad,
          totalReleased,
          totalCompletedBad,
          remainingQueued,
        }),
      );

      if (Number(sweepResult.releasedToPool || 0) === 0 && Number(sweepResult.completedBad || 0) === 0) {
        break;
      }
    } catch (error: any) {
      const message = String(error?.message || error || "");
      if (message.toLowerCase().includes("timeout")) {
        batchSize = Math.max(50, Math.floor(batchSize / 2));
        console.log(JSON.stringify({ phase: "retry", pass, reason: "timeout", nextBatchSize: batchSize }));
        continue;
      }
      throw error;
    }
  }

  const finalOwners = await getQueuedOwners();
  activeOwners = await fetchTwilioActiveOwnerEmails(noDialMinutes);
  const finalInactiveOwners = finalOwners.filter((row) => !activeOwners.has(row.agentEmail));
  console.log(
    JSON.stringify(
      {
        phase: "done",
        noDialMinutes,
        totalReleased,
        totalCompletedBad,
        finalQueuedOwners: finalOwners.length,
        finalInactiveOwners: finalInactiveOwners.length,
        finalQueuedLeadsOnInactiveOwners: finalInactiveOwners.reduce((sum, row) => sum + row.queuedCount, 0),
        sampleOwnerStatus: finalOwners.slice(0, 30).map((row) => ({
          owner: row.agentEmail,
          queued: row.queuedCount,
          madeCallLast60m: activeOwners.has(row.agentEmail) ? "Y" : "N",
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
