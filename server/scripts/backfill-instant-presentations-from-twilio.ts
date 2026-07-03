import { supabaseAdmin } from "../supabase";
import { masterleadClient } from "../local-masterlead-client";

type TwilioCallRow = {
  twilio_call_sid: string;
  parent_call_sid: string | null;
  owner_email: string | null;
  to_number: string | null;
  call_duration: number | null;
  call_started_at: string | null;
  call_status: string | null;
};

function parseNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;
  const value = Number(raw.slice(prefix.length));
  return Number.isFinite(value) ? value : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function normalizePhone(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "").slice(-10);
}

async function fetchCandidates(daysBack: number): Promise<TwilioCallRow[]> {
  const until = new Date();
  const since = new Date(until.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const rows: TwilioCallRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("twilio_call_logs")
      .select("twilio_call_sid,parent_call_sid,owner_email,to_number,call_duration,call_started_at,call_status")
      .eq("call_direction", "outbound")
      .eq("call_status", "completed")
      .gte("call_duration", 600)
      .gte("call_started_at", since.toISOString())
      .lt("call_started_at", until.toISOString())
      .not("owner_email", "is", null)
      .order("call_started_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const batch = (data || []) as TwilioCallRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function appointmentExistsByCallSid(agentEmail: string, sourceCallSid: string): Promise<boolean> {
  const dedupeTag = `AUTO_INSTANT_CALL_SID:${sourceCallSid}`;
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("agent_email", agentEmail)
    .eq("disposition_source", "instant_presentation")
    .ilike("internal_notes", `%${dedupeTag}%`)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function resolveLeadByPhone(last10: string): Promise<any | null> {
  if (!last10) return null;
  const { data, error } = await masterleadClient
    .from("masterlead")
    .select("id,taalk_lead_id,first_name,last_name,phone,taalk_market,market,taalk_state,state,city,taalk_city,email,address,taalk_groupcode,taalk_groupname,updated_at")
    .or(`phone.eq.${last10},phone.eq.1${last10},phone.eq.+1${last10}`)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

function buildStartEnd(callStartedAt: string | null, durationSeconds: number): { startIso: string; endIso: string; durationMin: number } {
  const nowMs = Date.now();
  const startMs = callStartedAt ? new Date(callStartedAt).getTime() : nowMs - durationSeconds * 1000;
  const safeStartMs = Number.isFinite(startMs) ? startMs : nowMs - durationSeconds * 1000;
  const endMs = Math.max(safeStartMs + 15 * 60 * 1000, safeStartMs + durationSeconds * 1000);
  const durationMin = Math.max(15, Math.round((endMs - safeStartMs) / 60000));
  return {
    startIso: new Date(safeStartMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    durationMin,
  };
}

async function main(): Promise<void> {
  if (!supabaseAdmin) throw new Error("Supabase admin client is not configured");
  const daysBack = parseNumberArg("days", 3);
  const dryRun = hasFlag("dry-run");

  console.log(`\n🔎 Backfill instant presentations (days=${daysBack}, dryRun=${dryRun})`);
  const candidates = await fetchCandidates(daysBack);
  console.log(`Found ${candidates.length} outbound completed calls with duration >= 600s`);

  let inserted = 0;
  let existing = 0;
  let skippedNoOwner = 0;
  let skippedNoPhone = 0;
  let errors = 0;

  for (const row of candidates) {
    try {
      const ownerEmail = String(row.owner_email || "").trim().toLowerCase();
      if (!ownerEmail) {
        skippedNoOwner += 1;
        continue;
      }
      const sourceCallSid = String(row.parent_call_sid || row.twilio_call_sid || "").trim();
      if (!sourceCallSid) {
        errors += 1;
        continue;
      }

      const already = await appointmentExistsByCallSid(ownerEmail, sourceCallSid);
      if (already) {
        existing += 1;
        continue;
      }

      const phoneLast10 = normalizePhone(row.to_number);
      if (!phoneLast10) {
        skippedNoPhone += 1;
        continue;
      }
      const lead = await resolveLeadByPhone(phoneLast10);
      const leadName =
        `${String(lead?.first_name || "").trim()} ${String(lead?.last_name || "").trim()}`.trim() || "Unknown Lead";

      const { startIso, endIso, durationMin } = buildStartEnd(row.call_started_at, Number(row.call_duration || 0));
      const dedupeTag = `AUTO_INSTANT_CALL_SID:${sourceCallSid}`;
      const notes = [
        `Backfill auto-created from outbound call (${Number(row.call_duration || 0)}s) after 10-minute instant threshold.`,
        lead?.address ? `Address: ${String(lead.address).trim()}` : "",
        lead?.taalk_groupcode ? `Group Code: ${String(lead.taalk_groupcode).trim()}` : "",
        lead?.taalk_groupname ? `Group Name: ${String(lead.taalk_groupname).trim()}` : "",
        lead?.id ? `ML #${lead.id}` : "",
        lead?.taalk_lead_id ? `AO Lead ID ${lead.taalk_lead_id}` : "",
      ].filter(Boolean).join("\n");

      const payload = {
        title: `Instant Presentation - ${leadName}`,
        appointment_type: "presentation",
        start_time: startIso,
        end_time: endIso,
        duration: durationMin,
        timezone: "UTC",
        agent_id: ownerEmail,
        agent_email: ownerEmail,
        agent_name: ownerEmail.split("@")[0] || ownerEmail,
        lead_id: lead?.taalk_lead_id ?? lead?.id ?? null,
        lead_name: leadName,
        lead_phone: lead?.phone || phoneLast10,
        lead_email: lead?.email || null,
        lead_state: String(lead?.taalk_state || lead?.state || "").trim().toUpperCase() || null,
        lead_city: lead?.city || lead?.taalk_city || null,
        status: "scheduled",
        confirmation_status: "pending",
        outcome: "pending",
        disposition_source: "instant_presentation",
        notes,
        internal_notes: `${dedupeTag}; BACKFILL:true; SOURCE_CALL_SID:${sourceCallSid}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (dryRun) {
        console.log(`[dry-run] would insert instant for ${ownerEmail} ${phoneLast10} callSid=${sourceCallSid}`);
      } else {
        const { error } = await supabaseAdmin.from("appointments").insert(payload);
        if (error) throw error;
      }
      inserted += 1;
    } catch (err: any) {
      errors += 1;
      console.error(`❌ Backfill row failed (${row.twilio_call_sid}): ${err?.message || err}`);
    }
  }

  console.log("\n✅ Backfill complete");
  console.log(JSON.stringify({ candidates: candidates.length, inserted, existing, skippedNoOwner, skippedNoPhone, errors }, null, 2));
}

main().catch((err) => {
  console.error("❌ backfill-instant-presentations-from-twilio failed:", err);
  process.exit(1);
});

