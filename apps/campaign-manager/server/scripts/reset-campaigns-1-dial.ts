/**
 * One-off: set every campaign to 1 dial/hour via Taalk API.
 * Run from repo root: npx tsx server/scripts/reset-campaigns-1-dial.ts
 */
import { createTaalkApiService } from '../services/taalk-api.js';

const DIALS_PER_HOUR = 1;
const DELAY_MS = 1200;

async function main() {
  const api = createTaalkApiService();
  const allCampaigns: Array<{ _id: string; name: string }> = [];
  let page = 1;
  const pageSize = 100;

  console.log('Fetching all campaigns...');
  while (true) {
    const { payload, total } = await api.getCampaigns(page, pageSize);
    if (!payload?.length) break;
    allCampaigns.push(...payload.map((c: { _id: string; name: string }) => ({ _id: c._id, name: c.name || c._id })));
    console.log(`  Page ${page}: ${payload.length} campaigns (total so far: ${allCampaigns.length}/${total ?? allCampaigns.length})`);
    if (payload.length < pageSize || allCampaigns.length >= (total ?? 0)) break;
    page++;
  }

  console.log(`\nResetting ${allCampaigns.length} campaigns to ${DIALS_PER_HOUR} dial/hour...\n`);
  let ok = 0;
  let fail = 0;
  for (const c of allCampaigns) {
    const result = await api.updateCampaignDialsPerHour(c._id, DIALS_PER_HOUR);
    if (result.success) {
      ok++;
      console.log(`  OK  ${c.name} (${c._id}) -> ${DIALS_PER_HOUR}/hr`);
    } else {
      fail++;
      console.log(`  FAIL ${c.name} (${c._id})`);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.log(`\nDone. ${ok} updated, ${fail} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
