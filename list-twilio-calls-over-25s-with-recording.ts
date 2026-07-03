/**
 * List ALL Twilio outbound calls >25s that have a completed recording (via Twilio API).
 */

import { supabaseAdmin } from './server/supabase';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './server/hardcoded-config';

const DAYS_BACK = 90;
const MAX_DB = 2000;

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
    .select('twilio_call_sid, to_number, owner_email, call_started_at, call_duration, call_status, call_direction')
    .in('call_direction', ['outbound', 'outbound-api'])
    .gte('call_duration', 25)
    .in('call_status', ['answered', 'completed'])
    .gte('call_started_at', dateLimit.toISOString())
    .order('call_started_at', { ascending: false })
    .limit(MAX_DB);

  if (error) {
    console.error('❌ Error fetching twilio_call_logs:', error);
    process.exit(1);
  }

  if (!twilioCalls?.length) {
    console.log('No Twilio outbound calls >25s found in the last %d days.', DAYS_BACK);
    process.exit(0);
  }

  console.log('Fetched %d Twilio calls >25s from DB (last %d days). Checking Twilio API for recordings...\n', twilioCalls.length, DAYS_BACK);

  const authHeader = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const withRecording: (typeof twilioCalls)[0] & { recording_sid?: string }[] = [];

  for (const call of twilioCalls) {
    const recUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call.twilio_call_sid}/Recordings.json`;
    const res = await fetch(recUrl, { headers: { Authorization: `Basic ${authHeader}` } });
    if (!res.ok) continue;
    const data = await res.json();
    const list = data.recordings || data.Recordings || [];
    const completed = list.filter((r: any) => (r.status || r.Status) === 'completed');
    if (completed.length > 0) {
      withRecording.push({ ...call, recording_sid: (completed[0] as any).sid || (completed[0] as any).Sid });
    }
  }

  console.log('--- Twilio calls >25s WITH a completed recording: %d ---\n', withRecording.length);
  withRecording.forEach((c, i) => {
    console.log('%d. twilio_call_sid: %s', i + 1, c.twilio_call_sid);
    console.log('   to_number: %s  owner_email: %s', c.to_number || '—', c.owner_email || '—');
    console.log('   call_started_at: %s  call_duration: %ss', c.call_started_at || '—', c.call_duration ?? '—');
    if (c.recording_sid) console.log('   recording_sid: %s', c.recording_sid);
    console.log('');
  });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
