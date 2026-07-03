/**
 * Backfill taalk_call_analytics.call_duration from twilio_call_logs (Transfer Calls was showing — for duration).
 * Run: npx tsx server/scripts/backfill-call-duration-from-twilio.ts [days=7] [limit=500]
 */

import { supabaseAdmin } from '../supabase';

async function main() {
  const days = parseInt(process.argv[2] || '7', 10);
  const limit = parseInt(process.argv[3] || '500', 10);

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not configured');
    process.exit(1);
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: rows, error } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, taalk_call_id, billing_transaction_id')
    .like('billing_transaction_id', 'twilio-%')
    .or('call_duration.is.null,call_duration.lt.1')
    .gte('call_date', since.toISOString())
    .order('call_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Fetch taalk_call_analytics:', error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log('✅ No taalk_call_analytics rows needing duration backfill');
    process.exit(0);
  }

  const sidFor = (r: any) => r.taalk_call_id || (typeof r.billing_transaction_id === 'string' && r.billing_transaction_id.startsWith('twilio-') ? r.billing_transaction_id.slice(7) : null);
  const sids = [...new Set(rows.map((r: any) => sidFor(r)).filter(Boolean))];
  const BATCH = 100;
  const durationBySid = new Map<string, number>();

  for (let i = 0; i < sids.length; i += BATCH) {
    const batch = sids.slice(i, i + BATCH);
    const { data: parentRows } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid, call_duration')
      .in('twilio_call_sid', batch);
    const { data: childRows } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('parent_call_sid, call_duration')
      .in('parent_call_sid', batch)
      .not('parent_call_sid', 'is', null);

    (parentRows || []).forEach((r: any) => {
      const d = Number(r.call_duration);
      if (d > 0) durationBySid.set(r.twilio_call_sid, d);
    });
    (childRows || []).forEach((r: any) => {
      const d = Number(r.call_duration);
      const parentSid = (r as any).parent_call_sid;
      if (d > 0 && parentSid) {
        const existing = durationBySid.get(parentSid) ?? 0;
        if (d > existing) durationBySid.set(parentSid, d);
      }
    });
  }

  console.log(`Sids needing duration: ${sids.length} | Duration map: ${durationBySid.size}`);

  let updated = 0;
  for (const row of rows) {
    const sid = sidFor(row);
    const dur = sid ? durationBySid.get(sid) : undefined;
    if (dur != null && dur > 0) {
      const { error: upErr } = await supabaseAdmin.from('taalk_call_analytics').update({ call_duration: dur }).eq('id', row.id);
      if (!upErr) updated++;
    }
  }

  console.log(`✅ Backfilled call_duration for ${updated}/${rows.length} Transfer Calls (last ${days} days)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
