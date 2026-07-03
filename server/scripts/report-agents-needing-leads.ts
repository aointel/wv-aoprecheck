import { leaseDialerPool } from "../db";
import { supabaseAdmin } from "../supabase";

type AgentRow = {
  agent_email: string;
  status: string;
  last_seen_at: string;
  buffer_count: number;
  callable_count: number;
  pending_assigned_count: number;
  unresolved_assigned_count: number;
};

async function run(): Promise<void> {
  const threshold = Number(process.argv[2] || 25);
  if (!supabaseAdmin) throw new Error("supabaseAdmin unavailable");

  const sinceIso = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const { data: statusRows, error: statusError } = await supabaseAdmin
    .from("agent_live_call_status")
    .select("agent_email,status,last_heartbeat_at,updated_at")
    .in("status", ["available", "in_call"])
    .or(`last_heartbeat_at.gte.${sinceIso},updated_at.gte.${sinceIso}`);
  if (statusError) throw statusError;

  const active = (statusRows || [])
    .map((r: any) => ({
      agent_email: String(r.agent_email || "").toLowerCase().trim(),
      status: String(r.status || "unknown"),
      last_seen_at: String(r.last_heartbeat_at || r.updated_at || ""),
    }))
    .filter((r) => r.agent_email.includes("@"));

  const dedup = new Map<string, { status: string; last_seen_at: string }>();
  for (const row of active) {
    const prev = dedup.get(row.agent_email);
    if (!prev || new Date(row.last_seen_at).getTime() > new Date(prev.last_seen_at).getTime()) {
      dedup.set(row.agent_email, { status: row.status, last_seen_at: row.last_seen_at });
    }
  }
  const activeEmails = Array.from(dedup.keys());
  if (activeEmails.length === 0) {
    console.log(JSON.stringify({ generated_at: new Date().toISOString(), threshold, active_agents_total: 0, needs_leads_count: 0, needs_leads: [], all_active_agents: [] }, null, 2));
    return;
  }

  const countMap = new Map<
    string,
    { callable_count: number; pending_assigned_count: number; unresolved_assigned_count: number }
  >();

  const chunkSize = 20;
  for (let i = 0; i < activeEmails.length; i += chunkSize) {
    const chunk = activeEmails.slice(i, i + chunkSize);
    for (const email of chunk) {
      const counts = await leaseDialerPool.query<{
        callable_count: number;
        pending_assigned_count: number;
        unresolved_assigned_count: number;
      }>(
        `
          SELECT
            COUNT(*) FILTER (
              WHERE lower(trim(COALESCE(cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
                AND COALESCE(btrim(COALESCE(taalk_lead_id::text, '')), '') <> ''
            )::int AS callable_count,
            COUNT(*) FILTER (
              WHERE lower(trim(COALESCE(cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            )::int AS pending_assigned_count,
            COUNT(*) FILTER (
              WHERE lower(trim(COALESCE(cnresolution, 'pending'))) NOT IN ('sale', 'not_interested', 'do_not_call', 'appointment_set', 'callback_requested', 'no_show')
            )::int AS unresolved_assigned_count
          FROM masterlead
          WHERE lower(COALESCE(cn_email, '')) = lower($1)
        `,
        [email],
      );

      const row = counts.rows[0] || { callable_count: 0, pending_assigned_count: 0, unresolved_assigned_count: 0 };
      countMap.set(email, {
        callable_count: Number(row.callable_count || 0),
        pending_assigned_count: Number(row.pending_assigned_count || 0),
        unresolved_assigned_count: Number(row.unresolved_assigned_count || 0),
      });
    }
  }

  const bufferRes = await leaseDialerPool.query<{ agent_email: string; buffer_count: number }>(
    `
      SELECT DISTINCT ON (lower(agent_email))
        lower(agent_email) AS agent_email,
        COALESCE(local_leased_lead_count, 0)::int AS buffer_count
      FROM leasedialer_client_status
      WHERE lower(agent_email) = ANY($1::text[])
      ORDER BY lower(agent_email), updated_at DESC
    `,
    [activeEmails],
  );
  const bufferMap = new Map(bufferRes.rows.map((r) => [String(r.agent_email).toLowerCase(), Number(r.buffer_count || 0)]));

  const allAgents: AgentRow[] = activeEmails.map((email) => {
    const meta = dedup.get(email)!;
    const c = countMap.get(email);
    return {
      agent_email: email,
      status: meta.status,
      last_seen_at: meta.last_seen_at,
      buffer_count: Number(bufferMap.get(email) || 0),
      callable_count: Number(c?.callable_count || 0),
      pending_assigned_count: Number(c?.pending_assigned_count || 0),
      unresolved_assigned_count: Number(c?.unresolved_assigned_count || 0),
    };
  }).sort((a, b) => a.callable_count - b.callable_count || a.buffer_count - b.buffer_count || b.last_seen_at.localeCompare(a.last_seen_at));

  const needy = allAgents.filter((r) => (Number(r.callable_count || 0) < threshold) || (Number(r.buffer_count || 0) < threshold));

  console.log(
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        threshold,
        active_agents_total: allAgents.length,
        needs_leads_count: needy.length,
        needs_leads: needy,
        all_active_agents: allAgents,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((err) => {
    console.error("report-agents-needing-leads failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await leaseDialerPool.end().catch(() => undefined);
  });

