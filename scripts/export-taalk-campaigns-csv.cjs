/**
 * Fetch all Taalk campaigns from the API and write a CSV with campaignId, campaignName, state, groupCode.
 * State and group code (VN, VB, PAVET) are derived from campaign name.
 *
 * Run: node AOIrail/scripts/export-taalk-campaigns-csv.cjs
 * Output: AOIrail/taalk-campaigns.csv (or path via OUT_CSV env)
 */

const fs = require('fs');
const path = require('path');

const TAALK_API_KEY = process.env.TAALK_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
const BASE = 'https://api.taalk.ai/api';
const DB = 'michaelmandella';

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]);

function typeFromCampaignName(name) {
  if (!name) return '';
  const n = String(name).toUpperCase();
  if (n.includes('VBEU1') || n.includes('VBEU')) return 'VB';
  if (n.includes('VB-') || n.includes('VB -') || n.includes('-WB-') || /\bVB\b/.test(n) || /\bWB\b/.test(n)) return 'VB';
  if (n.includes('GLOBE') || n.includes('-VN-') || /\bVN\b/.test(n)) return 'VN';
  if (n.includes('PAVET') || n.includes('VETERAN')) return 'PAVET';
  return '';
}

function stateFromCampaignName(name) {
  if (!name) return '';
  const s = String(name).trim();
  // Last token after space or dash (e.g. "Veteran - PAVET - GA" -> GA, "Globe-VN-OR" -> OR)
  const last = s.split(/[\s\-–—]+/).pop();
  if (last && US_STATE_CODES.has(last.toUpperCase())) return last.toUpperCase();
  // Find any 2-letter state code in the name (e.g. "Something IL something")
  const upper = s.toUpperCase();
  for (const code of US_STATE_CODES) {
    if (upper.includes(code)) return code;
  }
  return '';
}

function escapeCsv(val) {
  if (val == null) return '';
  const v = String(val);
  if (v.includes(',') || v.includes('"') || v.includes('\n')) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function campaignId(c) {
  const raw = c._id ?? c.id;
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && raw.$oid) return raw.$oid;
  return String(raw);
}

async function main() {
  console.log('Fetching Taalk campaigns...\n');

  let all = [];
  let page = 0;
  const limit = 100;
  let totalExpected = null;

  while (true) {
    const url = `${BASE}/campaign2s?db=${DB}&page=${page}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TAALK_API_KEY}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      console.error('Taalk API error:', res.status, await res.text());
      process.exit(1);
    }
    const data = await res.json();
    const payload = data.payload || [];
    if (totalExpected == null && data.total != null) totalExpected = Number(data.total);
    if (payload.length === 0) break;
    all = all.concat(payload);
    console.log('Page', page, ':', payload.length);
    page++;
    if (page > 50) break;
    await new Promise(r => setTimeout(r, 200));
  }
  if (totalExpected != null) console.log('API reported total:', totalExpected);

  const campaigns = all.map((c) => ({ ...c, _idStr: campaignId(c) })).filter((c) => c._idStr);
  const uniqueIds = new Set(campaigns.map((c) => c._idStr));
  console.log('Total campaigns:', campaigns.length, '| unique ids:', uniqueIds.size, '\n');

  const outPath = process.env.OUT_CSV || path.join(__dirname, '..', 'taalk-campaigns.csv');
  const header = 'campaignId,campaignName,state,groupCode';
  const withState = campaigns.map((c) => {
    const id = c._idStr || campaignId(c);
    const name = c.name || '';
    const state = stateFromCampaignName(name);
    const groupCode = typeFromCampaignName(name);
    return { id, name, state, groupCode, row: [escapeCsv(id), escapeCsv(name), state, groupCode].join(',') };
  });
  withState.sort((a, b) => {
    if (a.groupCode !== b.groupCode) return (a.groupCode || '').localeCompare(b.groupCode || '');
    if (a.state !== b.state) return (a.state || '').localeCompare(b.state || '');
    return (a.name || '').localeCompare(b.name || '');
  });
  const sortedRows = withState.map((x) => x.row);
  fs.writeFileSync(outPath, [header, ...sortedRows].join('\n'), 'utf-8');
  console.log('Wrote', outPath);

  const stateGroups = withState.filter((x) => x.groupCode && x.state && ['VN', 'VB', 'PAVET'].includes(x.groupCode));
  const byGroupCode = { VN: [], VB: [], PAVET: [] };
  for (const x of stateGroups) {
    if (byGroupCode[x.groupCode]) byGroupCode[x.groupCode].push(x.state);
  }
  const states = Array.from(US_STATE_CODES);
  console.log('\nGroup codes VN, VB, PAVET (expect 50 states each = 150):');
  for (const g of ['VN', 'VB', 'PAVET']) {
    const have = [...new Set(byGroupCode[g] || [])];
    const missing = states.filter((s) => !have.includes(s));
    console.log(' ', g, ':', have.length, 'states', missing.length ? '(missing ' + missing.join(',') + ')' : '');
  }
  const total = (byGroupCode.VN?.length ? new Set(byGroupCode.VN).size : 0) + (byGroupCode.VB?.length ? new Set(byGroupCode.VB).size : 0) + (byGroupCode.PAVET?.length ? new Set(byGroupCode.PAVET).size : 0);
  console.log(' Total:', total, total === 150 ? '(150 ok)' : '(expect 150)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
