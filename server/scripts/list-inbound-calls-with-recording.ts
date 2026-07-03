/**
 * List inbound calls that HAVE a recording_url.
 * Run: npx tsx server/scripts/list-inbound-calls-with-recording.ts [limit=100]
 */
import { supabaseAdmin } from '../supabase.js';

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured.');
    process.exit(1);
  }
  const limit = parseInt(process.argv[2] || '100', 10);

  const { count: totalWith, error: eCount } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('*', { count: 'exact', head: true })
    .eq('call_direction', 'inbound')
    .not('recording_url', 'is', null)
    .neq('recording_url', '');

  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, twilio_call_sid, from_number, to_number, call_started_at, call_duration, call_status, owner_email, call_source, recording_url')
    .eq('call_direction', 'inbound')
    .not('recording_url', 'is', null)
    .neq('recording_url', '')
    .order('call_started_at', { ascending: false })
    .limit(limit);

  if (eCount || error) {
    console.error('Error:', eCount?.message || error?.message);
    process.exit(1);
  }

  console.log('\n=== Inbound calls WITH recording_url ===\n');
  console.log('Total inbound with recording:', totalWith ?? 0);
  console.log('Showing latest', (rows || []).length, '\n');

  const list = (rows || []) as any[];
  for (const r of list) {
    console.log(
      r.twilio_call_sid,
      r.call_started_at?.slice(0, 19),
      'dur=' + (r.call_duration ?? '—'),
      'from=' + (r.from_number ?? '—'),
      'owner=' + (r.owner_email ?? '—').slice(0, 25),
      'source=' + (r.call_source ?? '—')
    );
    console.log('  url:', (r.recording_url || '').slice(0, 80) + (r.recording_url?.length > 80 ? '...' : ''));
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
