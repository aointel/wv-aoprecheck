/**
 * Check if a masterlead (by id or phone) already exists in the Taalk campaign they'd be assigned to.
 * Uses GET campaign2s/{campaignId}/contacts/{phoneDigits} - 200 = exists, 404 = not in campaign.
 *
 * Run: node AOIrail/scripts/check-lead-in-taalk.cjs <lead_id>
 *   or: node AOIrail/scripts/check-lead-in-taalk.cjs <phone> <campaign_id>
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
  if (u.includes('VBEU') || u.includes('VB')) return 'VB';
  if (u.includes('GLOBE') || u.includes('VN')) return 'VN';
  if (u.includes('VETERAN') || u.includes('VET') || u.includes('PAVET')) return 'PAVET';
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

async function checkContactInTaalk(campaignId, phone) {
  const digits = phoneToDigits(phone);
  if (!digits) return { exists: false, error: 'No phone' };
  const url = `${TAALK_BASE}/campaign2s/${campaignId}/contacts/${digits}?db=${DB}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${TAALK_API_KEY}`, 'Content-Type': 'application/json' }
  });
  if (res.status === 200) return { exists: true };
  if (res.status === 404) return { exists: false };
  const text = await res.text();
  return { exists: false, error: `${res.status} ${text.slice(0, 100)}` };
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log('Usage: node check-lead-in-taalk.cjs <lead_id>\n  or: node check-lead-in-taalk.cjs <phone> <campaign_id>');
    process.exit(1);
  }

  const mappings = loadCampaignMappings();
  let phone;
  let campaignId;
  let label = '';

  if (process.argv[3]) {
    phone = arg;
    campaignId = process.argv[3];
    label = `phone ${phone} in campaign ${campaignId}`;
  } else {
    const leadId = isNaN(Number(arg)) ? arg : Number(arg);
    const { data: lead, error } = await supabase
      .from('masterlead')
      .select('id, first_name, last_name, phone, taalk_market, taalk_state, state')
      .eq('id', leadId)
      .single();
    if (error || !lead) {
      console.error('Lead not found:', leadId, error?.message || '');
      process.exit(1);
    }
    phone = lead.phone;
    const state = normalizeState(lead.taalk_state || lead.state);
    const groupCode = getGroupCode(lead.taalk_market);
    const key = groupCode && state ? `${groupCode}-${state}` : null;
    const mapping = key ? mappings.get(key) : null;
    if (!mapping) {
      console.log('Lead', leadId, lead.first_name, lead.last_name, phone);
      console.log('No campaign mapping for', lead.taalk_market, '/', state, '(need VN/VB/PAVET + state)');
      process.exit(0);
    }
    campaignId = mapping.campaignId;
    label = `lead ${leadId} (${lead.first_name} ${lead.last_name}, ${phone}) -> ${mapping.type}-${mapping.state} (${mapping.campaignName})`;
  }

  console.log('Checking', label, '...\n');
  const result = await checkContactInTaalk(campaignId, phone);
  if (result.error) console.log('Error:', result.error);
  console.log(result.exists ? 'YES – lead already exists in this Taalk campaign.' : 'NO – lead is not in this Taalk campaign.');
}

main().catch((e) => { console.error(e); process.exit(1); });
