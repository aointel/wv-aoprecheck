/**
 * List Twilio calls involving a phone number and show recording info.
 * Run: npx tsx server/scripts/check-twilio-recording-by-phone.ts +15209711211
 *      npx tsx server/scripts/check-twilio-recording-by-phone.ts 5209711211
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';

const raw = process.argv[2]?.trim();
if (!raw) {
  console.error('Usage: npx tsx server/scripts/check-twilio-recording-by-phone.ts <phone>');
  process.exit(1);
}
const digits = raw.replace(/\D/g, '');
const e164 = digits.length === 10 ? `+1${digits}` : raw.startsWith('+') ? raw : `+${digits}`;

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials.');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  console.log('Checking Twilio for calls involving', e164, '\n');

  const [fromCalls, toCalls] = await Promise.all([
    client.calls.list({ from: e164, limit: 50 }),
    client.calls.list({ to: e164, limit: 50 }),
  ]);

  const bySid = new Map<string, any>();
  for (const c of fromCalls as any[]) {
    bySid.set(c.sid, { ...c, role: 'from' });
  }
  for (const c of toCalls as any[]) {
    if (!bySid.has(c.sid)) bySid.set(c.sid, { ...c, role: 'to' });
  }
  const calls = Array.from(bySid.values()).sort(
    (a, b) => new Date(b.dateCreated || b.startTime || 0).getTime() - new Date(a.dateCreated || a.startTime || 0).getTime()
  );

  if (calls.length === 0) {
    console.log('No Twilio calls found for', e164);
    process.exit(0);
  }

  console.log('Calls involving', e164, ':', calls.length, '\n');

  for (const call of calls.slice(0, 20)) {
    const sid = call.sid;
    const recs = await client.recordings.list({ callSid: sid });
    const completed = (recs as any[]).filter((r) => (r.status || r.status === 'completed'));
    const anyRec = (recs as any[]).length > 0 ? (recs as any[])[0] : null;
    const recStatus = anyRec ? (anyRec.status ?? (anyRec as any).Status) : '—';
    const recSid = anyRec ? (anyRec.sid ?? (anyRec as any).Sid) : null;

    console.log('---');
    console.log('Call SID:   ', sid);
    console.log('From:       ', call.from);
    console.log('To:         ', call.to);
    console.log('Direction:  ', call.direction);
    console.log('Status:     ', call.status);
    console.log('Date:       ', call.dateCreated ? new Date(call.dateCreated).toISOString() : call.startTime ?? '—');
    console.log('Duration:   ', call.duration != null ? `${call.duration}s` : '—');
    console.log('Recordings: ', (recs as any[]).length);
    if (anyRec) {
      console.log('  Recording SID:', recSid);
      console.log('  Status:       ', recStatus);
      if (recStatus === 'completed' && TWILIO_ACCOUNT_SID) {
        const mp3 = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recSid}.mp3`;
        console.log('  Listen:       ', mp3);
      }
    }
    console.log('');
  }

  if (calls.length > 20) {
    console.log('... and', calls.length - 20, 'more calls.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
