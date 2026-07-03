/**
 * Report who would get an inbound right now: queue size, queued callers, agents eligible to receive (heartbeat, not on call).
 * Usage: npx ts-node server/scripts/eligible-for-inbound.ts [--base-url URL] [--market M] [--state S]
 */
const BASE_URL = process.env.BASE_URL || process.argv.find((a) => a.startsWith('--base-url='))?.split('=')[1] || 'https://aoirail-production.up.railway.app';

async function main() {
  const url = `${BASE_URL}/api/call-connector-pro/eligible-for-inbound`;
  console.log('Fetching:', url);
  const res = await fetch(url);
  if (!res.ok) {
    console.error('Error:', res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  console.log('\n--- Inbound queue ---');
  console.log('Queue length:', data.queueLength ?? 0);
  (data.queuedCalls || []).forEach((q: any, i: number) => {
    console.log(`  ${i + 1}. from=${q.from} callSid=${q.callSid} createdAt=${q.createdAt}`);
  });
  console.log('\n--- Eligible to receive (heartbeat, not on call) ---');
  (data.eligibleRingGroup || []).forEach((a: any) => console.log('  ', a.email));
  console.log('\n--- Currently on a call (excluded) ---');
  (data.onCall || []).forEach((e: string) => console.log('  ', e));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
