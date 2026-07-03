/**
 * Fetch 20 masterlead rows and show how they'd be distributed to Taalk campaigns
 * (group code + state -> campaign). Uses same logic as upload-10-contacts-to-taalk.cjs.
 *
 * Run: node AOIrail/scripts/show-20-leads-distribution.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const STATE_MAP = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR',
  CALIFORNIA: 'CA', COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE',
  FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID',
  ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS',
  KENTUCKY: 'KY', LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD',
  MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS',
  MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH', OKLAHOMA: 'OK',
  OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT',
  VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI', WYOMING: 'WY', 'DISTRICT OF COLUMBIA': 'DC'
};

function normalizeState(state) {
  if (!state) return null;
  const u = String(state).trim().toUpperCase();
  if (u.length === 2) return u;
  return STATE_MAP[u] || u;
}

function getGroupCode(taalkMarket) {
  if (!taalkMarket) return null;
  const u = String(taalkMarket).toUpperCase();
  if (u.includes('VBEU') || u.includes('VB')) return 'VB';
  if (u.includes('GLOBE') || u.includes('VN')) return 'VN';
  if (u.includes('VETERAN') || u.includes('VET') || u.includes('PAVET')) return 'PAVET';
  return null;
}

function typeFromCampaignName(campaignName) {
  if (!campaignName) return null;
  const n = String(campaignName).toUpperCase();
  if (n.includes('VBEU1') || n.includes('VBEU') || n.includes('VB-') || n.includes('VB -') || n.startsWith('VB')) return 'VB';
  if (n.includes('GLOBE') || n.includes('-VN-') || n.startsWith('VN')) return 'VN';
  if (n.includes('PAVET') || n.includes('VETERAN')) return 'PAVET';
  return null;
}

function loadCampaignMappings() {
  const csvPath = path.join(__dirname, '..', 'vn-pavet-campaigns.csv');
  if (!fs.existsSync(csvPath)) return new Map();
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter((l) => l.trim());
  const mappings = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^([^,]+),(".*?"|[^,]*),([^,]+),([^,]*)$/);
    if (!match) continue;
    const [, campaignId, campaignName, state, typeCol] = match;
    const campaignNameStr = (campaignName || '').replace(/^"|"$/g, '').trim();
    const stateStr = state.trim();
    const typeStr = (typeCol || '').trim() || typeFromCampaignName(campaignNameStr);
    if (!typeStr) continue;
    mappings.set(`${typeStr}-${stateStr}`, { campaignId: campaignId.trim(), campaignName: campaignNameStr, state: stateStr, groupCode: typeStr });
  }
  return mappings;
}

async function main() {
  const mappings = loadCampaignMappings();
  console.log('Loaded', mappings.size, 'campaigns from vn-pavet-campaigns.csv\n');
  console.log('Fetching 20 masterlead rows (has phone)...\n');

  const { data: rows, error } = await supabase
    .from('masterlead')
    .select('id, first_name, last_name, phone, taalk_market, taalk_state, state')
    .not('phone', 'is', null)
    .limit(20)
    .order('id', { ascending: false });

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log('No leads found.');
    return;
  }

  console.log('Distribution (groupCode + state -> campaign):\n');
  console.log('  #  | id      | name              | phone       | taalk_market     | state | groupCode | key       | campaign');
  console.log('-----|---------|-------------------|-------------|------------------|-------|-----------|-----------|------------------');

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim().slice(0, 18) || '-';
    const phone = (r.phone || '').slice(-11).trim().slice(0, 11);
    const market = (r.taalk_market || '').slice(0, 16);
    const state = normalizeState(r.taalk_state || r.state) || '-';
    const groupCode = getGroupCode(r.taalk_market) || '-';
    const key = groupCode !== '-' && state !== '-' ? `${groupCode}-${state}` : '-';
    const campaign = key !== '-' && mappings.has(key) ? mappings.get(key).campaignName.slice(0, 18) : (key !== '-' ? 'NO MAPPING' : 'skip');
    console.log(
      String(i + 1).padStart(4),
      '|',
      String(r.id).padEnd(7),
      '|',
      name.padEnd(18),
      '|',
      phone.padEnd(11),
      '|',
      market.padEnd(16),
      '|',
      state.padEnd(5),
      '|',
      (groupCode + '').padEnd(9),
      '|',
      (key + '').padEnd(9),
      '|',
      campaign
    );
  }
  console.log('\nDone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
