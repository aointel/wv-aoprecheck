/**
 * Sync workers to TaskRouter from customers table. Creates/updates Workers with Offline activity and correct attributes.
 * Availability is set by the app: when agent powers on WebRTC, device.registered fires and backend POST /api/agents/voice-online sets Worker to AvailableInbound.
 * Run: npx tsx server/scripts/sync-taskrouter-workers.ts
 */

import { supabaseAdmin } from '../supabase.js';
import {
  syncWorker,
  getActivitySidByName,
  buildWorkerAttributesForVoice,
  type TaskRouterActivityName,
} from '../taskrouter-service.js';

async function main() {
  if (!supabaseAdmin) {
    console.error('Supabase admin not available');
    process.exit(1);
  }

  const offlineSid = await getActivitySidByName('Offline' as TaskRouterActivityName);
  if (!offlineSid) {
    console.error('Offline activity not found. Run provision-taskrouter first.');
    process.exit(1);
  }

  const PAGE_SIZE = 1000;
  const list: any[] = [];
  let offset = 0;
  while (true) {
    const { data: page, error: custError } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email, associate_id, market, states, first_name, last_name')
      .or('company_email.not.is.null,personal_email.not.is.null')
      .range(offset, offset + PAGE_SIZE - 1);

    if (custError) {
      console.error('Failed to fetch customers:', custError);
      process.exit(1);
    }
    const rows = page || [];
    list.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const filtered = list.filter(
    (c: any) => (c.company_email && c.company_email.includes('@')) || (c.personal_email && c.personal_email.includes('@'))
  );
  console.log('Customers to sync as workers (all Offline; availability set on device.registered):', filtered.length);

  let synced = 0;
  let failed = 0;

  for (const c of filtered) {
    const email = (c.company_email || c.personal_email || '').toString().toLowerCase().trim();
    if (!email || !email.includes('@')) continue;

    const attributes = buildWorkerAttributesForVoice(email, c);

    try {
      await syncWorker({
        friendlyName: email,
        attributes,
        activitySid: offlineSid,
      });
      synced++;
      console.log('Synced:', email, 'Offline');
    } catch (e) {
      failed++;
      console.error('Failed:', email, (e as Error).message);
    }
  }

  console.log('\nDone. Synced:', synced, 'Failed:', failed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
