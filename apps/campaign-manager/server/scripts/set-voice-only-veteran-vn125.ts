/**
 * Set all VBEU1, PAVET, and VN125 campaigns to voice only (contactMethod: 'voice').
 * Run from repo root: npx tsx server/scripts/set-voice-only-veteran-vn125.ts
 */
import { createTaalkApiService } from '../services/taalk-api.js';

const DELAY_MS = 1200;

function isVeteranOrVn125(name: string): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('pavet') || n.includes('vbeu1') || n.includes('vn125');
}

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
    if (payload.length < pageSize || allCampaigns.length >= (total ?? 0)) break;
    page++;
  }

  const target = allCampaigns.filter((c) => isVeteranOrVn125(c.name));
  console.log(`\nFound ${target.length} VBEU1 / PAVET / VN125 campaigns (of ${allCampaigns.length} total). Setting to voice only...\n`);

  let ok = 0;
  let fail = 0;
  for (const c of target) {
    const result = await api.setCampaignVoiceOnly(c._id);
    if (result.success) {
      ok++;
      console.log(`  OK  ${c.name} (${c._id}) -> voice only`);
    } else {
      fail++;
      console.log(`  FAIL ${c.name} (${c._id})`);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.log(`\nDone. ${ok} set to voice only, ${fail} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
