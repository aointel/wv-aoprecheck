/**
 * 1) When did inbound calls last have recordings? (exact date range of the 452)
 * 2) Current Twilio 609 settings (Voice URL, Status Callback) — compare to what was needed then.
 * Run: npx tsx server/scripts/when-inbound-recordings-worked-and-609-settings.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import { supabaseAdmin } from '../supabase.js';

const INBOUND_609_LAST10 = '6096048379';
const PROD_BASE = 'https://aoirail-production.up.railway.app';
const PROD_INCOMINGCALL = `${PROD_BASE}/incomingcall`;
const PROD_STATUS = `${PROD_BASE}/api/twilio/call-status`;
const PROD_RECORDING_STATUS = `${PROD_BASE}/api/twilio/recording-status`;

async function main() {
  console.log('\n=== 1) WHEN INBOUND HAD RECORDINGS (the 452 rows) ===\n');
  if (!supabaseAdmin) {
    console.log('Supabase not configured.');
  } else {
    const { data: latest } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('call_started_at, call_source, from_number')
      .eq('call_direction', 'inbound')
      .not('recording_url', 'is', null)
      .neq('recording_url', '')
      .order('call_started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: earliest } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('call_started_at, call_source')
      .eq('call_direction', 'inbound')
      .not('recording_url', 'is', null)
      .neq('recording_url', '')
      .order('call_started_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    console.log('Earliest inbound with recording:', (earliest as any)?.call_started_at ?? '—', 'source:', (earliest as any)?.call_source);
    console.log('Latest inbound with recording: ', (latest as any)?.call_started_at ?? '—', 'source:', (latest as any)?.call_source);
    console.log('(Those 452 are agent-leg rows, from_number=client:..., source=twilio_call_status_webhook)');
  }

  console.log('\n=== 2) CURRENT TWILIO 609 SETTINGS (what Twilio uses now) ===\n');
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.log('Twilio not configured.');
    return;
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const numbers = await client.incomingPhoneNumbers.list();
  const n = numbers.find((x) => String(x.phoneNumber || '').replace(/\D/g, '').endsWith(INBOUND_609_LAST10));
  if (!n) {
    console.log('609 number not found in account.');
    return;
  }
  const num = n as any;
  let voiceUrl = (num.voiceUrl || num.voice_url || '').trim();
  const statusCallback = (num.statusCallback || num.status_callback || '').trim();
  const appSid = num.voiceApplicationSid || num.voice_application_sid;
  if (appSid) {
    try {
      const app = await client.applications(appSid).fetch();
      const appUrl = (app as any).voiceUrl || (app as any).voice_url || '';
      if (appUrl) voiceUrl = appUrl.trim();
    } catch (_) {}
  }
  console.log('609 number:', num.phoneNumber);
  console.log('Voice URL (where inbound POSTs go):', voiceUrl || '(not set)');
  console.log('Status Callback (call status + recording):    ', statusCallback || '(not set)');
  console.log('');
  console.log('Expected for 609 (per .cursor rules):');
  console.log('  Voice URL:  ', PROD_INCOMINGCALL);
  console.log('  Status Cb:  ', PROD_STATUS);
  console.log('  (Recording status is set when we start recording in dequeue-status: recordingStatusCallback to', PROD_RECORDING_STATUS + ')');
  console.log('');
  const voiceOk = voiceUrl === PROD_INCOMINGCALL;
  const statusOk = statusCallback === PROD_STATUS;
  if (!voiceOk) console.log('>>> Voice URL MISMATCH — inbound may not hit /incomingcall. Fix: set 609 Voice URL to', PROD_INCOMINGCALL);
  if (!statusOk) console.log('>>> Status Callback MISMATCH — call/recording events may not hit our server. Fix: set Status Callback to', PROD_STATUS);
  if (voiceOk && statusOk) console.log('>>> 609 URLs look correct. If caller-leg recordings still missing, check dequeue-status (taskCallSid row exists + recording started) and recording-status (worker_call_sid match).');
  console.log('');
  console.log('=== 3) WHAT TO FIX (from when it worked Feb 15–23) ===');
  console.log('• 609 must have Status Callback =', PROD_STATUS);
  console.log('  (Without it we never get call-status for the agent leg; the 452 rows came from that webhook.)');
  console.log('• Run: npx tsx server/scripts/set-609-voice-incomingcall.ts');
  console.log('  (uses production URL from hardcoded-config; no BASE_URL needed)');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
