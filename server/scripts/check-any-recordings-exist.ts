/**
 * Check if ANY recordings exist: Twilio account-wide + twilio_call_logs with recording_url.
 * Run: npx tsx server/scripts/check-any-recordings-exist.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import { supabaseAdmin } from '../supabase.js';

async function main() {
  console.log('\n=== Twilio account: recordings (any) ===\n');
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.log('Twilio not configured.');
  } else {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    let total = 0;
    let withCallSid = 0;
    let sample: any[] = [];
    try {
      const recs = await client.recordings.list({ limit: 200 });
      total = recs.length;
      for (const r of recs as any[]) {
        if (r.callSid) withCallSid++;
        if (sample.length < 15) sample.push({ sid: r.sid, callSid: r.callSid, duration: r.duration, date: r.dateCreated });
      }
      console.log('Twilio recordings (last 200):', total);
      console.log('  With callSid:', withCallSid);
      if (sample.length > 0) {
        console.log('  Sample:');
        sample.forEach((s) => console.log('   ', s.sid, s.callSid, 'dur=' + s.duration, s.date));
      } else {
        console.log('  (none)');
      }
    } catch (e) {
      console.log('Twilio error:', (e as Error).message);
    }
  }

  console.log('\n=== Supabase twilio_call_logs: rows with recording_url ===\n');
  if (!supabaseAdmin) {
    console.log('Supabase not configured.');
  } else {
    const { count: withUrl, error: e1 } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('*', { count: 'exact', head: true })
      .not('recording_url', 'is', null)
      .neq('recording_url', '');
    const { count: totalRows, error: e2 } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('*', { count: 'exact', head: true });
    const { count: inboundNull, error: e3 } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('call_direction', 'inbound')
      .is('recording_url', null);

    if (e1 || e2) console.log('DB error:', e1?.message || e2?.message);
    else {
      console.log('Rows WITH recording_url:', withUrl ?? 0);
      console.log('Total rows (twilio_call_logs):', totalRows ?? 0);
      console.log('Inbound with recording_url NULL:', inboundNull ?? 0);
    }
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
