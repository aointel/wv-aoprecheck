import cron from "node-cron";
import { pool } from "./db";
import { supabaseAdmin, supabaseAdminRaw } from "./supabase";
import { isHotTablesEodOnly } from "./hot-table-mode";
import { withHotTableSupabaseWriteBypass } from "./hot-table-write-gate";

type TwilioCallLogRow = {
  twilio_call_sid: string;
  owner_email: string | null;
  agent_identity: string | null;
  from_number: string | null;
  to_number: string | null;
  call_direction: string | null;
  call_status: string | null;
  call_duration: number | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  parent_call_sid: string | null;
  call_source: string | null;
  answered_by: string | null;
  amd_duration_ms: number | null;
  metadata: unknown;
  recording_url: string | null;
  associate_id: string | null;
  lead_id: number | null;
  taalk_lead_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AgentDialMetricRow = {
  agent_email: string;
  agent_name: string | null;
  lead_id: number | null;
  lead_phone: string;
  lead_name: string | null;
  lead_state: string | null;
  event_type: string;
  event_timestamp: string;
  call_duration: number | null;
  call_status: string | null;
  disposition: string | null;
  call_sid: string | null;
  source: string | null;
  notes: string | null;
  isHotLead: boolean | null;
};

const CHUNK_SIZE = 500;
const WINDOW_HOURS = 30;
const syncClient = () => (supabaseAdminRaw || supabaseAdmin)!;

function toIsoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function metricKey(row: AgentDialMetricRow): string {
  return [
    row.agent_email || "",
    row.event_type || "",
    row.lead_phone || "",
    row.call_sid || "",
    row.event_timestamp || "",
    row.disposition || "",
  ].join("|");
}

async function syncTwilioCallLogs(windowStartIso: string): Promise<number> {
  const localResult = await pool.query<TwilioCallLogRow>(
    `
      SELECT
        twilio_call_sid,
        owner_email,
        agent_identity,
        from_number,
        to_number,
        call_direction,
        call_status,
        call_duration,
        call_started_at,
        call_ended_at,
        parent_call_sid,
        call_source,
        answered_by,
        amd_duration_ms,
        metadata,
        recording_url,
        associate_id,
        lead_id,
        taalk_lead_id,
        created_at,
        updated_at
      FROM twilio_call_logs
      WHERE (updated_at IS NOT NULL AND updated_at >= $1::timestamptz)
         OR (call_started_at IS NOT NULL AND call_started_at >= $1::timestamptz)
    `,
    [windowStartIso],
  );

  const rows = localResult.rows || [];
  if (!rows.length) return 0;

  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await syncClient()
      .from("twilio_call_logs")
      .upsert(chunk, { onConflict: "twilio_call_sid" });
    if (error) throw error;
    upserted += chunk.length;
  }

  return upserted;
}

async function syncAgentDialMetrics(windowStartIso: string): Promise<number> {
  const localResult = await pool.query<AgentDialMetricRow>(
    `
      SELECT
        agent_email,
        agent_name,
        lead_id,
        lead_phone,
        lead_name,
        lead_state,
        event_type,
        event_timestamp,
        call_duration,
        call_status,
        disposition,
        call_sid,
        source,
        notes,
        "isHotLead"
      FROM agent_dial_metrics
      WHERE event_timestamp >= $1::timestamptz
      ORDER BY event_timestamp ASC
    `,
    [windowStartIso],
  );
  const localRows = localResult.rows || [];
  if (!localRows.length) return 0;

  const remoteExisting = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await syncClient()
      .from("agent_dial_metrics")
      .select("agent_email,event_type,lead_phone,call_sid,event_timestamp,disposition")
      .gte("event_timestamp", windowStartIso)
      .range(from, from + 999);
    if (error) throw error;
    const rows = (data || []) as AgentDialMetricRow[];
    for (const row of rows) remoteExisting.add(metricKey(row));
    if (rows.length < 1000) break;
  }

  const toInsert = localRows.filter((row) => !remoteExisting.has(metricKey(row)));
  if (!toInsert.length) return 0;

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const { error } = await syncClient().from("agent_dial_metrics").insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }
  return inserted;
}

export async function runLocalHotTablesEodSync(): Promise<{
  twilioCallLogsUpserted: number;
  agentDialMetricsInserted: number;
}> {
  if (!isHotTablesEodOnly()) {
    return { twilioCallLogsUpserted: 0, agentDialMetricsInserted: 0 };
  }
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client unavailable for EOD sync");
  }

  const windowStartIso = toIsoHoursAgo(WINDOW_HOURS);
  const [twilioCallLogsUpserted, agentDialMetricsInserted] =
    await withHotTableSupabaseWriteBypass(async () => {
      return Promise.all([
        syncTwilioCallLogs(windowStartIso),
        syncAgentDialMetrics(windowStartIso),
      ]);
    });
  return { twilioCallLogsUpserted, agentDialMetricsInserted };
}

export function startLocalHotTablesEodSyncScheduler(): void {
  if (!isHotTablesEodOnly()) {
    console.log("⏭️ Hot-table EOD-only mode disabled; nightly sync scheduler not started");
    return;
  }

  const runSync = async () => {
    const startedAt = Date.now();
    try {
      const result = await runLocalHotTablesEodSync();
      console.log(
        `✅ Hot-table sync complete in ${Date.now() - startedAt}ms | twilio_call_logs=${result.twilioCallLogsUpserted} agent_dial_metrics=${result.agentDialMetricsInserted}`,
      );
    } catch (error) {
      console.error("❌ Hot-table sync failed:", error);
    }
  };

  // Run every 30 minutes during business hours (7am-11pm)
  cron.schedule("*/30 7-23 * * *", runSync);
  // Also run at 11pm for full EOD
  cron.schedule("0 23 * * *", runSync);

  // Run immediately on startup to backfill any missed calls
  setTimeout(runSync, 5000);

  console.log("🔄 Hot-table sync scheduled every 30min (7am-11pm) + EOD at 11pm, running initial backfill...");
}
