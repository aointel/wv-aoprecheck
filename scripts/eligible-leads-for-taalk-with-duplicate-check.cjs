/**
 * Build list of all leads eligible to send to Taalk (Veteran or Globe only).
 * Eligible = cnresolution is null, pending, or called (not booked etc.).
 * Then check each against Taalk to see if already in campaign (duplicate).
 * Output: CSV with eligible leads + already_in_taalk (yes/no), and summary.
 *
 * Env: LIMIT (optional cap on rows fetched; unset = fetch all ~130k), OUTPUT_CSV, BATCH_SIZE (default 20), BATCH_DELAY_MS (default 0)
 * If you only see 1000 rows, unset LIMIT (e.g. don't set LIMIT=30) so pagination runs to completion.
 * Run: node AOIrail/scripts/eligible-leads-for-taalk-with-duplicate-check.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';
const TAALK_API_KEY = process.env.TAALK_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
const TAALK_BASE = 'https://api.taalk.ai/api';
const DB = 'michaelmandella';

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
  if (u.includes('VETERAN') || u.includes('VET') || u.includes('PAVET')) return 'PAVET';
  if (u.includes('GLOBE') || u.includes('VN')) return 'VN';
  return null;
}

function typeFromCampaignName(name) {
  if (!name) return null;
  const n = String(name).toUpperCase();
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
    const nameStr = (campaignName || '').replace(/^"|"$/g, '').trim();
    const stateStr = state.trim();
    const typeStr = (typeCol || '').trim() || typeFromCampaignName(nameStr);
    if (!typeStr) continue;
    mappings.set(`${typeStr}-${stateStr}`, { campaignId: campaignId.trim(), campaignName: nameStr, state: stateStr, type: typeStr });
  }
  return mappings;
}

function phoneToDigits(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

/** Check if phone exists IN THIS CAMPAIGN only (200 = in campaign, 404 = not in campaign). Does not check global existence or DNC. */
async function checkContactInTaalk(campaignId, phone) {
  const digits = phoneToDigits(phone);
  if (!digits) return { exists: false };
  const url = `${TAALK_BASE}/campaign2s/${campaignId}/contacts/${digits}?db=${DB}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${TAALK_API_KEY}`, 'Content-Type': 'application/json' }
  });
  return { exists: res.status === 200 };
}

function escapeCsv(val) {
  if (val == null) return '';
  const v = String(val);
  if (v.includes(',') || v.includes('"') || v.includes('\n')) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function main() {
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
  const outDir = path.join(__dirname, '..', 'output');
  const outPath = process.env.OUTPUT_CSV || path.join(outDir, 'eligible-for-taalk.csv');

  const mappings = loadCampaignMappings();
  console.log('Loaded', mappings.size, 'campaigns from vn-pavet-campaigns.csv\n');
  const { count: totalMatch } = await supabase
    .from('masterlead')
    .select('id', { count: 'exact', head: true })
    .or('taalk_market.ilike.%Veteran%,taalk_market.ilike.%Globe%')
    .not('phone', 'is', null)
    .or('cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called');
  console.log('Total rows matching filter (Veteran/Globe, phone, null|pending|called):', totalMatch ?? '?', '\n');
  console.log('Fetching in pages of 1000...\n');

  let all = [];
  const pageSize = 1000;
  let lastId = 0;

  while (true) {
    const base = supabase
      .from('masterlead')
      .select('id, first_name, last_name, phone, taalk_market, taalk_state, state, cnresolution')
      .or('taalk_market.ilike.%Veteran%,taalk_market.ilike.%Globe%')
      .not('phone', 'is', null)
      .or('cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called');
    const q = lastId === 0 ? base : base.gt('id', lastId);
    const { data: chunk, error } = await q.order('id', { ascending: true }).limit(pageSize);

    if (error) {
      console.error('Supabase error:', error.message);
      process.exit(1);
    }
    if (!chunk || chunk.length === 0) break;
    all = all.concat(chunk);
    lastId = Number(chunk[chunk.length - 1].id);
    if (all.length <= 2000) console.log('  Fetched', all.length, 'leads... (lastId', lastId, ')');
    else if (all.length % 5000 < pageSize) console.log('  Fetched', all.length, 'leads...');
    if (limit != null && all.length >= limit) {
      all = all.slice(0, limit);
      break;
    }
    if (chunk.length < pageSize) break;
  }

  const eligible = [];
  for (const row of all) {
    const state = normalizeState(row.taalk_state || row.state);
    const groupCode = getGroupCode(row.taalk_market);
    if (!state || !groupCode) continue;
    const key = `${groupCode}-${state}`;
    const mapping = mappings.get(key);
    if (!mapping) continue;
    eligible.push({
      id: row.id,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      phone: row.phone || '',
      taalk_market: row.taalk_market || '',
      state,
      group_code: groupCode,
      campaign_key: key,
      campaign_name: mapping.campaignName,
      campaign_id: mapping.campaignId,
      mapping
    });
  }

  const batchSize = Math.max(1, parseInt(process.env.BATCH_SIZE, 10) || 20);
  const batchDelayMs = Math.max(0, parseInt(process.env.BATCH_DELAY_MS, 10) || 0);
  console.log('Eligible (have campaign mapping):', eligible.length, '\n');
  console.log('Checking against Taalk in batches of', batchSize, batchDelayMs ? `(${batchDelayMs}ms between batches)` : '', '...\n');

  const rows = [];
  let alreadyIn = 0;
  for (let i = 0; i < eligible.length; i += batchSize) {
    const batch = eligible.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((e) => checkContactInTaalk(e.campaign_id, e.phone)));
    for (let j = 0; j < batch.length; j++) {
      const e = batch[j];
      const exists = results[j].exists;
      if (exists) alreadyIn++;
      rows.push({ ...e, already_in_taalk: exists ? 'yes' : 'no' });
    }
    const done = Math.min(i + batchSize, eligible.length);
    if (done % 500 === 0 || done === eligible.length) console.log('  Checked', done, '/', eligible.length);
    if (done < eligible.length) await new Promise((r) => setTimeout(r, batchDelayMs));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const header = 'id,first_name,last_name,phone,taalk_market,state,group_code,campaign_key,campaign_name,already_in_taalk';
  const lines = rows.map((r) => [
    r.id,
    escapeCsv(r.first_name),
    escapeCsv(r.last_name),
    escapeCsv(r.phone),
    escapeCsv(r.taalk_market),
    r.state,
    r.group_code,
    r.campaign_key,
    escapeCsv(r.campaign_name),
    r.already_in_taalk
  ].join(','));
  fs.writeFileSync(outPath, [header, ...lines].join('\n'), 'utf-8');

  const readyToSend = rows.filter((r) => r.already_in_taalk === 'no').length;
  console.log('\nSummary:');
  console.log('  Total eligible (Veteran/Globe + campaign):', eligible.length);
  console.log('  Already in Taalk (duplicate):', alreadyIn);
  console.log('  Ready to send (not in Taalk):', readyToSend);
  console.log('\nWrote:', outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
