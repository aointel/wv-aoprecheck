/**
 * Check if a specific caller number ever called the 609 inbound number.
 * Run: npx tsx server/scripts/check-caller-609.ts 9012994036
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const TO_609 = '+16096048379';

async function main() {
  const digits = process.argv[2]?.replace(/\D/g, '') || '';
  if (!digits || digits.length < 10) {
    console.error('Usage: npx tsx server/scripts/check-caller-609.ts <10-digit-number>');
    process.exit(1);
  }
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const calls = await client.calls.list({ to: TO_609, limit: 200 });
  const normalized = digits.slice(-10);
  const match = calls.filter((c) => {
    const from = String(c.from || '').replace(/\D/g, '');
    return from.endsWith(normalized) || from === normalized;
  });
  if (match.length === 0) {
    console.log('NO');
    process.exit(0);
  }
  console.log('YES');
  match.forEach((c) => {
    console.log('  From:', c.from, '| Status:', c.status, '| Start:', c.startTime, '| Duration:', c.duration != null ? c.duration + 's' : '—');
  });
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
