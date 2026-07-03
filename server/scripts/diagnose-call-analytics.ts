/**
 * Diagnose why calls aren't being analyzed
 * Run: npx tsx server/scripts/diagnose-call-analytics.ts
 */

import { supabaseAdmin } from '../supabase';

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('📊 Call Analytics Diagnostic (today only)\n');

  // 1. taalk_call_analytics today
  const { data: allToday, count: totalToday } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, analysis_status, recording_url', { count: 'exact', head: true })
    .gte('call_date', today.toISOString())
    .like('billing_transaction_id', 'twilio-%');

  const { data: todayRows } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, analysis_status, recording_url')
    .gte('call_date', today.toISOString())
    .like('billing_transaction_id', 'twilio-%')
    .limit(500);

  const total = todayRows?.length ?? 0;
  const byStatus: Record<string, number> = {};
  let withSupabaseUrl = 0;
  let pendingWithUrl = 0;
  let pendingNoUrl = 0;
  (todayRows || []).forEach((r: any) => {
    byStatus[r.analysis_status] = (byStatus[r.analysis_status] || 0) + 1;
    const hasSupabase = (r.recording_url || '').includes('supabase');
    if (hasSupabase) withSupabaseUrl++;
    if (r.analysis_status === 'pending') {
      if (hasSupabase) pendingWithUrl++;
      else pendingNoUrl++;
    }
  });

  console.log('taalk_call_analytics (twilio-*, today):');
  console.log('  Total:', total);
  console.log('  By status:', byStatus);
  console.log('  With Supabase recording_url:', withSupabaseUrl);
  console.log('  PENDING + Supabase URL (scheduler can process):', pendingWithUrl);
  console.log('  PENDING + NO Supabase URL (need recording-status or Twilio API):', pendingNoUrl);

  // 2. twilio_call_logs today - do they have recording_url?
  const { data: twilioToday } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, recording_url')
    .gte('call_started_at', today.toISOString())
    .or('call_direction.eq.outbound,call_direction.is.null')
    .limit(500);

  const twilioWithSupabase = (twilioToday || []).filter((r: any) => (r.recording_url || '').includes('supabase')).length;
  console.log('\ntwilio_call_logs (outbound, today):');
  console.log('  Sample size:', twilioToday?.length ?? 0);
  console.log('  With Supabase recording_url:', twilioWithSupabase);

  // 3. Pending in taalk but NOT in twilio with URL?
  const pendingSids = (todayRows || [])
    .filter((r: any) => r.analysis_status === 'pending' && !(r.recording_url || '').includes('supabase'))
    .map((r: any) => r.id);
  // Can't easily get taalk_call_id from the filtered select - need to re-query
  const { data: pendingRows } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('taalk_call_id, recording_url')
    .gte('call_date', today.toISOString())
    .eq('analysis_status', 'pending')
    .limit(20);
  const sidsNoUrl = (pendingRows || []).map((r: any) => r.taalk_call_id).filter(Boolean);

  if (sidsNoUrl.length > 0) {
    const { data: tcl } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid, recording_url, parent_call_sid')
      .in('twilio_call_sid', sidsNoUrl);
    const twilioHasUrl = (tcl || []).filter((r: any) => (r.recording_url || '').includes('supabase'));
    const parentSids = [...new Set((tcl || []).map((r: any) => r.parent_call_sid).filter(Boolean))];
    let parentsWithUrl = 0;
    if (parentSids.length > 0) {
      const { data: parents } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, recording_url')
        .in('twilio_call_sid', parentSids);
      parentsWithUrl = (parents || []).filter((r: any) => (r.recording_url || '').includes('supabase')).length;
    }
    console.log('\nPENDING without Supabase URL in taalk_call_analytics:');
    console.log('  taalk_call_ids (sample):', sidsNoUrl.slice(0, 5).join(', '));
    console.log('  Child has Supabase URL in twilio_call_logs:', twilioHasUrl.length, '/', sidsNoUrl.length);
    console.log('  Parent has Supabase URL (scheduler checks parent):', parentsWithUrl);
    const ccproCanProcess = twilioHasUrl.length + parentsWithUrl;
    if (ccproCanProcess > 0) {
      console.log('  -> processPendingCcproCalls CAN process these (URL in twilio_call_logs)');
    } else {
      console.log('  -> Neither child nor parent has URL. recording-status webhook may not be firing.');
    }
  }

  console.log('\n--- Summary ---');
  if (pendingWithUrl > 0) {
    console.log('✅', pendingWithUrl, 'calls ready for analysis (have Supabase URL). Scheduler should process.');
  }
  if (pendingNoUrl > 0) {
    console.log('⚠️', pendingNoUrl, 'calls PENDING but no Supabase URL. Need recording-status webhook or Twilio API fetch.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
