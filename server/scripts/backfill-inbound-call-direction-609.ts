/**
 * Backfill: set call_direction = 'inbound' for all 609 inbound calls that are missing it.
 * (Calls TO +16096048379 are inbound; they must have call_direction = 'inbound' to show in stats.)
 *
 * Run: npx tsx server/scripts/backfill-inbound-call-direction-609.ts [days=30] [dryRun=1]
 */
import { supabaseAdmin } from '../supabase.js';

const INBOUND_609 = '+16096048379';
const INBOUND_609_LAST10 = '6096048379';

async function main() {
  const days = parseInt(process.argv[2] || '30', 10);
  const dryRun = process.argv[3] !== '0' && process.argv[3] !== 'false';

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, twilio_call_sid, to_number, call_direction, call_source, owner_email')
    .gte('call_started_at', since.toISOString())
    .or('to_number.eq.+16096048379,to_number.ilike.%6096048379');

  if (error) {
    console.error('❌ Fetch failed:', error.message);
    process.exit(1);
  }

  const needFix = (rows || []).filter(
    (r: any) => r.call_direction !== 'inbound'
  );

  console.log(`\n📋 609 inbound calls (last ${days} days): ${(rows || []).length} total, ${needFix.length} with call_direction != 'inbound'\n`);

  if (needFix.length === 0) {
    console.log('✅ All 609 rows already have call_direction = "inbound".\n');
    return;
  }

  if (dryRun) {
    console.log('Dry run. Would set call_direction = "inbound" for:', needFix.slice(0, 10).map((r: any) => r.twilio_call_sid));
    console.log('Run with 0 as third arg to apply.\n');
    return;
  }

  let updated = 0;
  for (const r of needFix as any[]) {
    const { error: upErr } = await supabaseAdmin
      .from('twilio_call_logs')
      .update({ call_direction: 'inbound' })
      .eq('twilio_call_sid', r.twilio_call_sid);
    if (upErr) {
      console.warn('  ❌', r.twilio_call_sid, upErr.message);
    } else {
      updated++;
      if (updated <= 15) console.log('  ✅', r.twilio_call_sid, '→ call_direction = inbound');
    }
  }
  console.log(`\n✅ Updated ${updated} rows to call_direction = 'inbound'.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
