/**
 * Backfill inbound call charges: apply 8 credits per qualifying call and insert connect row into billing_transactions.
 * Uses same rules as inbound-charge-preview: completed, duration > 10s, owner_email, associate_id, lead with taalk_lead_id.
 * Skips calls that already have a billing_transactions row with transaction_id = inbound-connect-{CallSid}.
 * Run: npx tsx server/scripts/backfill-inbound-credits.ts [days=90] [limit=500] [dryRun=0] [maxApply]
 * Example dry run: npx tsx server/scripts/backfill-inbound-credits.ts 90 500 1
 * Bill only 1 call: npx tsx server/scripts/backfill-inbound-credits.ts 90 500 0 1
 */
import { supabaseAdmin } from '../supabase';

const DEFAULT_DAYS = 90;
const DEFAULT_LIMIT = 500;
const CREDITS_PER_INBOUND = 8;

type LeadInfo = { lead_id: number; taalk_lead_id: string; first_name?: string; last_name?: string; phone?: string };

async function resolveLeadForCall(row: any): Promise<LeadInfo | null> {
  const meta = typeof row.metadata === 'string' ? (() => { try { return JSON.parse(row.metadata); } catch { return {}; } })() : (row.metadata || {});
  const leadId = meta.lead_id || row.lead_id;
  const phone = meta.lead_phone || meta.leadPhone || row.from_number;
  if (leadId) {
    const { data: ld } = await supabaseAdmin!
      .from('masterlead')
      .select('id, taalk_lead_id, first_name, last_name, phone')
      .or(`id.eq.${leadId},taalk_lead_id.eq.${leadId}`)
      .maybeSingle();
    if (ld && (ld.taalk_lead_id != null && String(ld.taalk_lead_id).trim())) {
      return {
        lead_id: ld.id,
        taalk_lead_id: String(ld.taalk_lead_id).trim(),
        first_name: ld.first_name ?? undefined,
        last_name: ld.last_name ?? undefined,
        phone: ld.phone ?? undefined,
      };
    }
  }
  if (phone) {
    const clean = String(phone).replace(/\D/g, '').slice(-10);
    if (clean.length >= 10) {
      const { data: ld } = await supabaseAdmin!
        .from('masterlead')
        .select('id, taalk_lead_id, first_name, last_name, phone')
        .or(`phone.eq.${clean},phone.eq.+1${clean},phone_number.eq.${clean},phone_number.eq.+1${clean}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ld && (ld.taalk_lead_id != null && String(ld.taalk_lead_id).trim())) {
        return {
          lead_id: ld.id,
          taalk_lead_id: String(ld.taalk_lead_id).trim(),
          first_name: ld.first_name ?? undefined,
          last_name: ld.last_name ?? undefined,
          phone: ld.phone ?? undefined,
        };
      }
    }
  }
  return null;
}

async function main() {
  const days = parseInt(process.argv[2] || String(DEFAULT_DAYS), 10);
  const limit = parseInt(process.argv[3] || String(DEFAULT_LIMIT), 10);
  const dryRun = process.argv[4] === '1' || process.argv[4] === 'true';
  const maxApply = process.argv[5] ? parseInt(process.argv[5], 10) : undefined;

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, twilio_call_sid, call_source, call_status, call_duration, call_started_at, owner_email, from_number, lead_id, metadata')
    .or('call_source.eq.taskrouter_inbound,call_source.eq.incomingcall_609')
    .gte('call_started_at', since.toISOString())
    .order('call_started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Fetch twilio_call_logs:', error.message);
    process.exit(1);
  }

  const list = (rows || []) as any[];
  console.log(`\n📋 Inbound calls (last ${days} days, limit ${limit}). Dry run: ${dryRun}\n`);

  type Chargeable = {
    call_sid: string;
    twilio_call_log_id: number;
    owner_email: string;
    associate_id: string;
    agent_name: string;
    taalk_lead_id: string;
    lead_id: number;
    lead_name: string | null;
    lead_phone: string | null;
    duration: number;
    call_started_at: string;
  };

  const chargeable: Chargeable[] = [];

  for (const row of list) {
    const sid = row.twilio_call_sid || '';
    const status = (row.call_status || '').toLowerCase();
    const duration = row.call_duration != null ? parseInt(String(row.call_duration), 10) : null;
    const owner = (row.owner_email || '').trim().toLowerCase();

    if (!owner || status !== 'completed' || duration == null || duration <= 10) continue;

    const { data: customerRow } = await supabaseAdmin
      .from('customers')
      .select('associate_id, first_name, last_name')
      .eq('company_email', owner)
      .maybeSingle();

    const associateId = customerRow?.associate_id ? String(customerRow.associate_id).trim() : null;
    if (!associateId) continue;

    const lead = await resolveLeadForCall(row);
    if (!lead) continue;

    const agentName = [customerRow?.first_name, customerRow?.last_name].filter(Boolean).join(' ').trim() || owner;
    const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || null;
    const leadPhone = lead.phone ?? null;

    chargeable.push({
      call_sid: sid,
      twilio_call_log_id: row.id,
      owner_email: owner,
      associate_id: associateId,
      agent_name: agentName,
      taalk_lead_id: lead.taalk_lead_id,
      lead_id: lead.lead_id,
      lead_name: leadName,
      lead_phone: leadPhone,
      duration: duration,
      call_started_at: row.call_started_at || '',
    });
  }

  // Skip already billed (existing inbound-connect in billing_transactions)
  const existingTxIds = new Set<string>();
  if (chargeable.length > 0) {
    const txIds = chargeable.map((c) => `inbound-connect-${c.call_sid}`);
    for (let i = 0; i < txIds.length; i += 100) {
      const batch = txIds.slice(i, i + 100);
      const { data: existing } = await supabaseAdmin
        .from('billing_transactions')
        .select('transaction_id')
        .in('transaction_id', batch);
      (existing || []).forEach((r: any) => existingTxIds.add(r.transaction_id));
    }
  }

  const toProcess = chargeable.filter((c) => !existingTxIds.has(`inbound-connect-${c.call_sid}`));
  const skippedBilled = chargeable.length - toProcess.length;

  console.log(`Chargeable: ${chargeable.length}, already billed: ${skippedBilled}, to process: ${toProcess.length}\n`);

  if (dryRun) {
    toProcess.slice(0, 25).forEach((c) => console.log(`  [dry run] would charge ${c.owner_email} 8 credits, call ${c.call_sid} taalk_lead_id=${c.taalk_lead_id}`));
    if (toProcess.length > 25) console.log(`  ... and ${toProcess.length - 25} more`);
    console.log(`\nDone (dry run). Would charge ${toProcess.length} calls (${toProcess.length * CREDITS_PER_INBOUND} credits). Run without dryRun to apply.`);
    return;
  }

  const toApply = maxApply ? toProcess.slice(0, maxApply) : toProcess;
  if (maxApply) console.log(`Applying at most ${maxApply} call(s).\n`);

  let creditsApplied = 0;
  let billingInserted = 0;
  let errors = 0;

  for (const c of toApply) {
    try {
      const { data: currentCredits, error: fetchErr } = await supabaseAdmin!
        .from('user_credits')
        .select('aoi_connect_credits_used, credits_used')
        .eq('email', c.owner_email)
        .single();

      if (fetchErr || !currentCredits) {
        console.warn(`  ⚠️ No user_credits for ${c.owner_email}, skip ${c.call_sid}`);
        errors++;
        continue;
      }

      const newAoi = (currentCredits.aoi_connect_credits_used ?? 0) + CREDITS_PER_INBOUND;
      const newUsed = (currentCredits.credits_used ?? 0) + CREDITS_PER_INBOUND;

      const { error: updateErr } = await supabaseAdmin!
        .from('user_credits')
        .update({
          aoi_connect_credits_used: newAoi,
          credits_used: newUsed,
          updated_at: new Date().toISOString(),
        })
        .eq('email', c.owner_email);

      if (updateErr) {
        console.warn(`  ⚠️ user_credits update failed for ${c.owner_email}:`, updateErr.message);
        errors++;
        continue;
      }
      creditsApplied++;

      const { error: btErr } = await supabaseAdmin!.from('billing_transactions').insert({
        transaction_id: `inbound-connect-${c.call_sid}`,
        transaction_type: 'connect',
        agent_email: c.owner_email,
        agent_associate_id: parseInt(c.associate_id, 10) || null,
        agent_name: c.agent_name,
        transaction_date: new Date().toISOString(),
        amount_usd: 8.0,
        credits_charged: CREDITS_PER_INBOUND,
        lead_name: c.lead_name,
        lead_phone: c.lead_phone,
        source_table: 'twilio_call_logs',
        source_id: c.twilio_call_log_id,
        description: 'Inbound connect (609/TaskRouter) backfill',
        metadata: { taalk_lead_id: c.taalk_lead_id, call_sid: c.call_sid, duration: c.duration },
      });

      if (btErr && btErr.code !== '23505') {
        console.warn(`  ⚠️ billing_transactions insert failed for ${c.call_sid}:`, btErr.message);
      } else if (!btErr) {
        billingInserted++;
      }

      if (creditsApplied <= 15) {
        console.log(`  ✅ ${c.call_sid}  ${c.owner_email}  +8 credits  taalk_lead_id=${c.taalk_lead_id}`);
      }
    } catch (e) {
      console.warn(`  ⚠️ Error processing ${c.call_sid}:`, e);
      errors++;
    }
  }

  console.log(`\nDone. Credits applied: ${creditsApplied}, billing_transactions inserted: ${billingInserted}, errors: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
