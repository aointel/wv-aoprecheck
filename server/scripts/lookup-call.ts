/**
 * Look up a Twilio call by SID or by substring (e.g. d6313726422 or 6313726422).
 * Usage: npx tsx server/scripts/lookup-call.ts <sid-or-substring>
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const input = process.argv[2]?.trim();
if (!input) {
  console.error('Usage: npx tsx server/scripts/lookup-call.ts <CallSid or substring>');
  process.exit(1);
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  // If it looks like a full SID (starts with CA and 34 chars), fetch directly
  const maybeFullSid = input.startsWith('CA') ? input : `CA${input}`;
  if (maybeFullSid.length >= 34) {
    try {
      const call = await client.calls(maybeFullSid).fetch();
      await printCall(call as any, client);
      return;
    } catch (e: any) {
      if (e?.code === 20404 || e?.status === 404) {
        console.log('No call found with that SID, searching recent calls...\n');
      } else throw e;
    }
  }

  // List recent calls and find by SID substring or phone
  const limit = 200;
  const calls = await client.calls.list({ limit });
  const sidMatch = calls.filter((c: any) => (c.sid || '').includes(input));
  const phoneMatch = calls.filter((c: any) => {
    const from = String((c as any).from ?? '');
    const to = String((c as any).to ?? '');
    const norm = (s: string) => s.replace(/\D/g, '');
    return norm(from).includes(input.replace(/\D/g, '')) || norm(to).includes(input.replace(/\D/g, ''));
  });
  const matches = sidMatch.length ? sidMatch : phoneMatch;
  if (matches.length === 0) {
    console.log(`No recent call found with SID or phone containing "${input}".`);
    console.log('Showing last 5 calls:');
    calls.slice(0, 5).forEach((c: any) => console.log(' ', c.sid, '|', c.from, '->', c.to, '|', c.status, '|', c.dateCreated));
    return;
  }
  const call = matches[0];
  const sid = (call as any).sid;
  console.log(`Found ${matches.length} match(es). Fetching full details for ${sid}\n`);
  const full = await client.calls(sid).fetch();
  await printCall(full as any, client);
}

async function printCall(c: any, client: twilio.Twilio) {
  const sid = c.sid;
  console.log('--- Call ---');
  console.log('Sid:        ', sid);
  console.log('From:       ', c.from);
  console.log('To:         ', c.to);
  console.log('Status:     ', c.status);
  console.log('Direction:  ', c.direction);
  console.log('StartTime:  ', c.startTime);
  console.log('EndTime:    ', c.endTime);
  console.log('Duration:   ', c.duration, c.duration != null ? 'sec' : '');
  console.log('AnsweredBy: ', (c as any).answeredBy ?? '—');
  console.log('Uri:        ', c.uri);
  console.log('Price:      ', (c as any).price ?? '—');
  console.log('');

  try {
    const events = (await (client.calls(sid) as any).events?.list?.({ limit: 30 })) || [];
    if (events.length) {
      console.log('--- Events (request URLs / steps) ---');
      events.forEach((e: any, i: number) => {
        const req = e.request || e;
        const url = typeof req === 'object' ? req.url : req;
        const name = e.name ?? req?.method ?? '';
        console.log(`  ${i + 1}. ${name} ${url || JSON.stringify(e).slice(0, 80)}`);
      });
      console.log('');
    }
  } catch (_) {}

  try {
    const children = await (client.calls as any).list({ parentCallSid: sid });
    if (children?.length) {
      console.log('--- Child calls (Dial legs) ---');
      children.forEach((ch: any) => console.log('  ', ch.sid, '|', ch.to, '|', ch.status, '|', ch.duration, 'sec'));
    }
  } catch (_) {}
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
