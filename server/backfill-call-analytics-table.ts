/**
 * Backfill taalk_call_analytics table from existing Taalk + Twilio data.
 *
 * ONLY includes calls that have a verified Supabase recording (recording_url contains 'supabase').
 *
 * Run: npx tsx server/backfill-call-analytics-table.ts [--days=7] [--limit=5000]
 */

import { supabaseAdmin } from './supabase';

function parseArgs(): { days: number; limit: number } {
  const args = process.argv.slice(2);
  let days = 90;
  let limit = 10000;
  for (const a of args) {
    if (a.startsWith('--days=')) days = parseInt(a.split('=')[1], 10) || 90;
    if (a.startsWith('--limit=')) limit = parseInt(a.split('=')[1], 10) || 10000;
  }
  return { days, limit };
}

async function backfillFromTwilio(days: number, limit: number) {
  console.log('\n📞 Backfilling from twilio_call_logs (ONLY calls with Supabase recording)...');
  const start = new Date();
  start.setDate(start.getDate() - days);

  const { data: twilioCalls, error: twErr } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, owner_email, to_number, call_started_at, call_duration, call_direction, recording_url, parent_call_sid')
    .gte('call_started_at', start.toISOString())
    .in('call_direction', ['outbound'])
    .in('call_status', ['answered', 'completed'])
    .not('recording_url', 'is', null)
    .ilike('recording_url', '%supabase%')
    .order('call_started_at', { ascending: false })
    .limit(limit);

  if (twErr) {
    console.error('❌ Error fetching twilio_call_logs:', twErr);
    return { inserted: 0, updated: 0, errors: 1 };
  }

  const sids = (twilioCalls || []).map((c: any) => c.twilio_call_sid);
  const { data: existing } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('taalk_call_id')
    .in('taalk_call_id', sids);
  const existingBySid = new Set((existing || []).map((r: any) => r.taalk_call_id));

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const c of twilioCalls || []) {
    try {
      const sid = c.twilio_call_sid;
      const agentEmail = c.owner_email || 'unknown';
      const existingRow = existingBySid.has(sid);

      if (!existingRow) {
        const { error: insErr } = await supabaseAdmin
          .from('taalk_call_analytics')
          .insert({
            billing_transaction_id: `twilio-${sid}`,
            taalk_call_id: sid,
            agent_email: agentEmail,
            call_date: c.call_started_at || new Date().toISOString(),
            call_duration: c.call_duration > 0 ? c.call_duration : null,
            analysis_status: 'pending',
          });
        if (!insErr) {
          inserted++;
          existingBySid.add(sid);
        } else {
          if (insErr.code === '23505') existingBySid.add(sid);
          else errors++;
        }
      }
    } catch (e: any) {
      errors++;
      if (errors <= 3) console.error('❌ Error processing', c.twilio_call_sid, e?.message);
    }
  }

  console.log(`   Twilio: ${inserted} inserted, ${updated} updated, ${errors} errors`);
  return { inserted, updated, errors };
}

async function backfillFromTaalk(days: number, limit: number) {
  console.log('\n📋 Backfilling from billing_transactions + vdp_calls (Taalk)...');

  const start = new Date();
  start.setDate(start.getDate() - days);

  const { data: bt, error: btErr } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, agent_email, transaction_date, source_id, source_table, metadata')
    .eq('transaction_type', 'connect')
    .eq('source_table', 'vdp_calls')
    .gte('transaction_date', start.toISOString())
    .order('transaction_date', { ascending: false })
    .limit(limit);

  if (btErr) {
    console.error('❌ Error fetching billing_transactions:', btErr);
    return { inserted: 0, updated: 0, errors: 1 };
  }

  const transactionIds = (bt || []).map((t: any) => t.transaction_id);
  const { data: existing } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('billing_transaction_id')
    .in('billing_transaction_id', transactionIds);
  const existingById = new Set((existing || []).map((r: any) => r.billing_transaction_id));

  let inserted = 0;
  let errors = 0;

  for (const t of bt || []) {
    try {
      const taalkCallId = t.metadata?.sessionID || t.metadata?.taalk_call_id || null;
      if (!taalkCallId) continue;

      const agentEmail = t.agent_email || 'unknown';
      if (existingById.has(t.transaction_id)) continue;

      const { error: insErr } = await supabaseAdmin
        .from('taalk_call_analytics')
        .insert({
          billing_transaction_id: t.transaction_id,
          taalk_call_id: taalkCallId,
          agent_email: agentEmail,
          call_date: t.transaction_date || new Date().toISOString(),
          analysis_status: 'pending',
        });
      if (!insErr) {
        inserted++;
        existingById.add(t.transaction_id);
      } else if (insErr.code !== '23505') errors++;
    } catch (e: any) {
      errors++;
      if (errors <= 3) console.error('❌ Error processing', t.transaction_id, e?.message);
    }
  }

  console.log(`   Taalk: ${inserted} inserted, ${errors} errors`);
  return { inserted, updated: 0, errors };
}

async function enrichExistingRows(_days: number, _limit: number) {
  console.log('\n🔧 Enrich step skipped (run migration first for denormalized columns)');
  return 0;
}

export async function backfillCallAnalyticsTable(days: number = 90, limit: number = 10000) {
  const twResult = await backfillFromTwilio(days, limit);
  const taResult = await backfillFromTaalk(days, limit);
  const enriched = await enrichExistingRows(days, limit);
  return { twilio: twResult, taalk: taResult, enriched };
}

async function main() {
  const { days, limit } = parseArgs();
  console.log(`\n🚀 Backfilling call analytics table (last ${days} days, limit ${limit})`);

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  const result = await backfillCallAnalyticsTable(days, limit);
  console.log('\n✅ Backfill complete:', result);
}

// Run main when executed directly: npx tsx server/backfill-call-analytics-table.ts
if (process.argv[1]?.includes('backfill-call-analytics-table')) {
  main().catch((e) => {
    console.error('❌ Fatal:', e);
    process.exit(1);
  });
}
