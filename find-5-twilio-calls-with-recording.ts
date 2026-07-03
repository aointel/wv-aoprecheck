/**
 * Find 5 Twilio outbound calls that have a completed recording (via Twilio API).
 * Prints twilio_call_sid, to_number, owner_email, call_started_at.
 */

import { supabaseAdmin } from './server/supabase';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './server/hardcoded-config';

const TARGET = 5;
const DAYS_BACK = 30;

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase not available');
    process.exit(1);
  }
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio credentials not configured');
    process.exit(1);
  }

  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - DAYS_BACK);

  const { data: twilioCalls, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, to_number, owner_email, call_started_at, call_duration, call_status')
    .eq('call_direction', 'outbound')
    .gte('call_duration', 25)
    .in('call_status', ['answered', 'completed'])
    .gte('call_started_at', dateLimit.toISOString())
    .order('call_started_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('❌ Error fetching twilio_call_logs:', error);
    process.exit(1);
  }

  if (!twilioCalls?.length) {
    console.log('No Twilio outbound calls found in the last %d days.', DAYS_BACK);
    process.exit(0);
  }

  console.log('Fetched %d Twilio outbound calls from DB (last %d days).', twilioCalls.length, DAYS_BACK);
  console.log('Checking Twilio API for recordings (need %d with completed recording)...\n', TARGET);

  const authHeader = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const withRecording: typeof twilioCalls = [];

  for (const call of twilioCalls) {
    if (withRecording.length >= TARGET) break;

    const recUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call.twilio_call_sid}/Recordings.json`;
    const res = await fetch(recUrl, { headers: { Authorization: `Basic ${authHeader}` } });
    if (!res.ok) continue;
    const data = await res.json();
    const list = data.recordings || data.Recordings || [];
    const completed = list.filter((r: any) => (r.status || r.Status) === 'completed');
    if (completed.length > 0) {
      withRecording.push(call);
      console.log('  %d. %s  to=%s  owner=%s  started=%s', withRecording.length, call.twilio_call_sid, call.to_number || '—', call.owner_email || '—', call.call_started_at || '—');
    }
  }

  console.log('\n--- Result: %d Twilio calls with a completed recording ---\n', withRecording.length);
  withRecording.forEach((c, i) => {
    console.log('%d. twilio_call_sid: %s', i + 1, c.twilio_call_sid);
    console.log('   to_number: %s', c.to_number || '—');
    console.log('   owner_email: %s', c.owner_email || '—');
    console.log('   call_started_at: %s', c.call_started_at || '—');
    console.log('');
  });

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
