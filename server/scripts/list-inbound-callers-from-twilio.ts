/**
 * List from Twilio API all phone numbers that called the 609 inbound number in the last N hours.
 * Fetches in batches of 1000 (no pagination cap) — full list.
 *
 * Run: npx tsx server/scripts/list-inbound-callers-from-twilio.ts [hours=96]
 *      96 = 4 days
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';

const INBOUND_609 = '+16096048379';
const BATCH_SIZE = 1000;
const DEFAULT_HOURS = 96; // 4 days

async function main() {
  const hours = parseInt(process.argv[2] || String(DEFAULT_HOURS), 10) || DEFAULT_HOURS;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio not configured.');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const after = new Date(Date.now() - hours * 60 * 60 * 1000);
  const startTimeAfter = after.toISOString().slice(0, 19) + 'Z';

  console.log(`\n📞 Twilio: ALL callers TO ${INBOUND_609} in the last ${hours}h (4 days) — batched, no cap\n`);

  const callers = new Map<string, { count: number; lastStatus: string; lastStart: string }>();
  let totalFetched = 0;
  let endTimeBefore: string | null = null;

  try {
    while (true) {
      const opts: Record<string, unknown> = {
        to: INBOUND_609,
        startTimeAfter,
        limit: BATCH_SIZE,
      };
      if (endTimeBefore) opts.endTimeBefore = endTimeBefore;

      const batch = await client.calls.list(opts as any);
      totalFetched += batch.length;

      for (const c of batch) {
        const from = (c.from || '').trim();
        if (!from) continue;
        const existing = callers.get(from);
        const start = c.startTime ? new Date(c.startTime).toISOString() : '';
        const status = (c.status || '').toLowerCase();
        if (!existing) {
          callers.set(from, { count: 1, lastStatus: status, lastStart: start });
        } else {
          existing.count += 1;
          existing.lastStatus = status;
          existing.lastStart = start;
        }
      }

      console.log(`   Batch: ${batch.length} calls (total so far: ${totalFetched})`);
      if (batch.length < BATCH_SIZE) break;

      const oldest = batch[batch.length - 1];
      const oldestStart = oldest.startTime ? new Date(oldest.startTime) : null;
      if (!oldestStart) break;
      endTimeBefore = oldestStart.toISOString().slice(0, 19) + 'Z';
    }

    const list = [...callers.entries()].sort((a, b) => b[1].count - a[1].count);

    console.log(`\n   Total calls from Twilio: ${totalFetched}`);
    console.log(`   Unique caller numbers:   ${list.length}\n`);
    console.log('   Caller number          | Calls | Last status  | Last call (UTC)');
    console.log('   -----------------------|-------|--------------|------------------');
    for (const [phone, info] of list) {
      console.log(`   ${phone.padEnd(23)} | ${String(info.count).padStart(5)} | ${info.lastStatus.padEnd(12)} | ${info.lastStart.slice(0, 19)}`);
    }
    console.log('');
  } catch (e) {
    console.error('❌ Twilio API error:', (e as Error)?.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
