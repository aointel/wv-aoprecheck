/**
 * Backfill child rows in twilio_call_logs: set recording_url from parent when parent has Supabase URL.
 * Call analytics uses child taalk_call_id; parent has the Supabase recording_url. This copies it to child so lists/APIs see it.
 * Run: npx ts-node server/scripts/backfill-child-recording-url.ts (from project root)
 */

import { supabaseAdmin } from '../supabase';

const LIMIT = 5000;

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }
  console.log('🔧 Backfilling child recording_url from parent rows (Supabase URLs)...\n');
  const { data: childrenRaw, error: fetchErr } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, parent_call_sid, recording_url')
    .not('parent_call_sid', 'is', null)
    .order('call_started_at', { ascending: false })
    .limit(LIMIT * 2);
  if (fetchErr) {
    console.error('❌ Fetch error:', fetchErr);
    process.exit(1);
  }
  const children = (childrenRaw || []).filter((r: any) => {
    const url = (r.recording_url || '').trim();
    return !url || !url.includes('supabase');
  });
  if (!children.length) {
    console.log('✅ No child rows missing Supabase recording_url found.');
    process.exit(0);
  }
  console.log(`📋 Found ${children.length} child rows to check (up to ${Math.min(children.length, LIMIT)} will be updated)`);
  let updated = 0;
  for (const row of children.slice(0, LIMIT)) {
    const { data: parentRow } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('recording_url')
      .eq('twilio_call_sid', row.parent_call_sid)
      .maybeSingle();
    const parentUrl = (parentRow as any)?.recording_url?.trim();
    if (!parentUrl || !parentUrl.includes('supabase')) continue;
    const { error: upErr } = await supabaseAdmin
      .from('twilio_call_logs')
      .update({ recording_url: parentUrl, updated_at: new Date().toISOString() })
      .eq('twilio_call_sid', row.twilio_call_sid);
    if (!upErr) {
      updated++;
      if (updated <= 15) console.log(`  ✅ ${row.twilio_call_sid} <- parent ${row.parent_call_sid}`);
    }
  }
  console.log(`\n✅ Done. Updated ${updated} child rows with parent Supabase recording_url.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
