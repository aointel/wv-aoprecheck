/**
 * Preview how inbound billing (8 credits per call) would apply to all inbound calls on file.
 * Uses the same rules as the call-status webhook: completed, duration > 10s, owner_email set,
 * associate_id found, and MUST have a lead with taalk_lead_id (tied to the call).
 * Does NOT charge anyone; read-only report.
 * Run: npx tsx server/scripts/inbound-charge-preview.ts [days=90] [limit=500]
 */
import { supabaseAdmin } from '../supabase';

const DEFAULT_DAYS = 90;
const DEFAULT_LIMIT = 2000;
const CREDITS_PER_INBOUND = 8;

async function resolveLeadForCall(row: any): Promise<{ lead_id: number; taalk_lead_id: string } | null> {
  const meta = typeof row.metadata === 'string' ? (() => { try { return JSON.parse(row.metadata); } catch { return {}; } })() : (row.metadata || {});
  const leadId = meta.lead_id || row.lead_id;
  const phone = meta.lead_phone || meta.leadPhone || row.from_number;
  if (leadId) {
    const { data: ld } = await supabaseAdmin!
      .from('masterlead')
      .select('id, taalk_lead_id')
      .or(`id.eq.${leadId},taalk_lead_id.eq.${leadId}`)
      .maybeSingle();
    if (ld && (ld.taalk_lead_id != null && String(ld.taalk_lead_id).trim())) {
      return { lead_id: ld.id, taalk_lead_id: String(ld.taalk_lead_id).trim() };
    }
  }
  if (phone) {
    const clean = String(phone).replace(/\D/g, '').slice(-10);
    if (clean.length >= 10) {
      const { data: ld } = await supabaseAdmin!
        .from('masterlead')
        .select('id, taalk_lead_id')
        .or(`phone.eq.${clean},phone.eq.+1${clean},phone_number.eq.${clean},phone_number.eq.+1${clean}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ld && (ld.taalk_lead_id != null && String(ld.taalk_lead_id).trim())) {
        return { lead_id: ld.id, taalk_lead_id: String(ld.taalk_lead_id).trim() };
      }
    }
  }
  return null;
}

async function main() {
  const days = parseInt(process.argv[2] || String(DEFAULT_DAYS), 10);
  const limit = parseInt(process.argv[3] || String(DEFAULT_LIMIT), 10);

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, twilio_call_sid, call_source, call_direction, call_status, call_duration, call_started_at, owner_email, from_number, lead_id, metadata')
    .or('call_source.eq.taskrouter_inbound,call_source.eq.incomingcall_609')
    .gte('call_started_at', since.toISOString())
    .order('call_started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Fetch twilio_call_logs:', error.message);
    process.exit(1);
  }

  const list = (rows || []) as any[];
  console.log(`\n📋 Inbound calls on file (last ${days} days, limit ${limit}): ${list.length}\n`);
  console.log('Rule: charge only when call is tied to a lead with taalk_lead_id (plus completed, duration>10, owner, associate_id).\n');

  const chargeable: { call_sid: string; owner_email: string; associate_id: string; taalk_lead_id: string; lead_id: number; duration: number; call_started_at: string }[] = [];
  const skipped: { call_sid: string; reason: string; owner_email?: string; duration?: number; status?: string }[] = [];

  for (const row of list) {
    const sid = row.twilio_call_sid || '';
    const status = (row.call_status || '').toLowerCase();
    const duration = row.call_duration != null ? parseInt(String(row.call_duration), 10) : null;
    const owner = (row.owner_email || '').trim().toLowerCase();

    if (!owner) {
      skipped.push({ call_sid: sid, reason: 'no owner_email' });
      continue;
    }
    if (status !== 'completed') {
      skipped.push({ call_sid: sid, reason: `status not completed (${status})`, owner_email: owner, status });
      continue;
    }
    if (duration == null || duration <= 10) {
      skipped.push({ call_sid: sid, reason: `duration <= 10s (${duration ?? 'null'})`, owner_email: owner, duration: duration ?? 0 });
      continue;
    }

    const { data: customerRow } = await supabaseAdmin
      .from('customers')
      .select('associate_id')
      .eq('company_email', owner)
      .maybeSingle();

    const associateId = customerRow?.associate_id ? String(customerRow.associate_id).trim() : null;
    if (!associateId) {
      skipped.push({ call_sid: sid, reason: 'no associate_id for owner', owner_email: owner });
      continue;
    }

    const lead = await resolveLeadForCall(row);
    if (!lead) {
      skipped.push({ call_sid: sid, reason: 'no lead with taalk_lead_id', owner_email: owner });
      continue;
    }

    chargeable.push({
      call_sid: sid,
      owner_email: owner,
      associate_id: associateId,
      taalk_lead_id: lead.taalk_lead_id,
      lead_id: lead.lead_id,
      duration: duration!,
      call_started_at: row.call_started_at || '',
    });
  }

  // Per-agent summary
  const byAgent = new Map<string, { count: number; credits: number }>();
  for (const c of chargeable) {
    const cur = byAgent.get(c.owner_email) || { count: 0, credits: 0 };
    cur.count += 1;
    cur.credits += CREDITS_PER_INBOUND;
    byAgent.set(c.owner_email, cur);
  }

  console.log('--- WOULD BE CHARGED (tied to lead with taalk_lead_id + completed, duration>10, owner, associate_id) ---');
  console.log(`Count: ${chargeable.length} calls × ${CREDITS_PER_INBOUND} credits = ${chargeable.length * CREDITS_PER_INBOUND} total credits\n`);
  if (chargeable.length > 0) {
    console.log('Per-agent:');
    const sorted = [...byAgent.entries()].sort((a, b) => b[1].count - a[1].count);
    for (const [email, v] of sorted) {
      console.log(`  ${email}: ${v.count} calls, ${v.credits} credits`);
    }
    console.log('\nFirst 20 chargeable calls (all have taalk_lead_id):');
    chargeable.slice(0, 20).forEach((c) => {
      console.log(`  ${c.call_sid}  taalk_lead_id=${c.taalk_lead_id}  ${c.owner_email}  associate_id=${c.associate_id}  duration=${c.duration}s  ${c.call_started_at?.slice(0, 19)}`);
    });
  }

  console.log('\n--- SKIPPED (would NOT be charged) ---');
  console.log(`Count: ${skipped.length}`);
  const byReason = new Map<string, number>();
  for (const s of skipped) {
    byReason.set(s.reason, (byReason.get(s.reason) || 0) + 1);
  }
  for (const [reason, count] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`);
  }
  if (skipped.length > 0 && skipped.length <= 30) {
    console.log('\nSkipped rows (sample):');
    skipped.slice(0, 15).forEach((s) => console.log(`  ${s.call_sid}  ${s.reason}`));
  }

  console.log('\n--- SUMMARY ---');
  console.log(`Total inbound rows: ${list.length}`);
  console.log(`Would charge: ${chargeable.length} (${chargeable.length * CREDITS_PER_INBOUND} credits)`);
  console.log(`Skipped: ${skipped.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
