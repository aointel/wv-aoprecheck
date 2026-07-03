/**
 * Get Twilio call details for a call SID (parent + child calls).
 * Run: npx tsx server/scripts/get-call-details.ts [CallSid]
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const callSid = process.argv[2] || 'CAd9ec5570f3326a84afac61417660302c';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const call = await client.calls(callSid).fetch();
  console.log('--- Parent call ---');
  console.log('Sid:', call.sid);
  console.log('From:', call.from, 'To:', call.to);
  console.log('Status:', call.status);
  console.log('Direction:', call.direction);
  console.log('StartTime:', call.startTime);
  console.log('EndTime:', call.endTime);
  console.log('Duration:', call.duration);
  console.log('AnsweredBy:', (call as any).answeredBy);
  console.log('Uri (fetch):', call.uri);
  // Fetch subresources (child calls created by Dial)
  try {
    const subcalls = await (client.calls as any).list({ parentCallSid: callSid });
    if (subcalls && subcalls.length > 0) {
      console.log('\n--- Child call(s) from Dial ---');
      for (const c of subcalls) {
        console.log('  Sid:', c.sid, 'To:', c.to, 'Status:', c.status, 'Duration:', c.duration);
      }
    }
  } catch (e) {
    // Try API for call events
  }
  // Get recent events if available
  const events = await client.calls(callSid).events?.list?.() || [];
  if (events.length > 0) {
    console.log('\n--- Events ---');
    for (const e of events) {
      console.log('  ', (e as any).request?.url || e);
    }
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
