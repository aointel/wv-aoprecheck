/**
 * Backfill parent rows in twilio_call_logs: set to_number from child row.
 * Run: npx ts-node server/scripts/backfill-parent-to-number.ts (from project root)
 * Or: cd server && npx ts-node scripts/backfill-parent-to-number.ts
 */

import { supabaseAdmin } from '../supabase';

const LIMIT = 5000;

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }
  console.log('🔧 Backfilling parent to_number from child rows...\n');
  const { data: parentsRaw, error: fetchErr } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, to_number, from_number')
    .like('from_number', 'client:%')
    .order('call_started_at', { ascending: false })
    .limit(LIMIT * 2);
  if (fetchErr) {
    console.error('❌ Fetch error:', fetchErr);
    process.exit(1);
  }
  const parents = (parentsRaw || []).filter(
    (r: any) => !r.to_number || String(r.to_number).trim() === ''
  );
  if (!parents.length) {
    console.log('✅ No parent rows with empty to_number found.');
    process.exit(0);
  }
  console.log(`📋 Found ${parents.length} parent rows with empty to_number (scanning up to ${Math.min(parents.length, LIMIT)})`);
  let updated = 0;
  for (const row of parents.slice(0, LIMIT)) {
    const { data: children } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('to_number')
      .eq('parent_call_sid', row.twilio_call_sid)
      .not('to_number', 'is', null)
      .limit(1);
    const childTo = (children as any)?.[0]?.to_number?.trim();
    if (!childTo) continue;
    const { error: upErr } = await supabaseAdmin
      .from('twilio_call_logs')
      .update({ to_number: childTo, updated_at: new Date().toISOString() })
      .eq('twilio_call_sid', row.twilio_call_sid);
    if (!upErr) {
      updated++;
      if (updated <= 15) console.log(`  ✅ ${row.twilio_call_sid} -> ${childTo}`);
    }
  }
  console.log(`\n✅ Done. Updated ${updated} parent rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
