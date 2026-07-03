/**
 * Upload 10 masterlead contacts to Taalk by state + campaign type.
 * For each campaign batch: (1) remove each lead's phone from company DNC (lets.taalk.ai), then (2) add contacts to the campaign.
 * Group codes: VN, VB (includes VBEU1), PAVET. Campaigns assigned by (groupCode, state), e.g. VN-IL, PAVET-OR, VB-TX.
 * Uses vn-pavet-campaigns.csv (campaignId, campaignName, state, groupCode). Sends all taalk_* back as Taalk_*.
 *
 * Env: TAALK_API_KEY
 * Run: node AOIrail/scripts/upload-10-contacts-to-taalk.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';
const TAALK_API_KEY = process.env.TAALK_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
const TAALK_BASE = 'https://api.taalk.ai/api';
const LETS_BASE = 'https://lets.taalk.ai/api';
const DB = 'michaelmandella';

const LETS_HEADERS = {
  'Authorization': `Bearer ${TAALK_API_KEY}`,
  'Content-Type': 'application/json',
  'x-app-db': DB,
};

const UPLOAD_BATCH_SIZE = parseInt(process.env.UPLOAD_BATCH_SIZE || '5', 10);
const BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || '500', 10);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

// Group codes: VN, VB (includes VBEU1), PAVET.
function getCampaignType(taalkMarket) {
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
  if (!fs.existsSync(csvPath)) {
    throw new Error('vn-pavet-campaigns.csv not found at ' + csvPath);
  }
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
    const key = `${typeStr}-${stateStr}`;
    mappings.set(key, {
      campaignId: campaignId.trim(),
      campaignName: campaignNameStr,
      state: stateStr,
      type: typeStr
    });
  }
  return mappings;
}

// masterlead taalk_* -> Taalk API field name (exact case Taalk expects)
const TAALK_FIELD_MAP = {
  taalk_lead_id: 'Taalk_LeadId',
  taalk_state: 'Taalk_State',
  taalk_zip: 'Taalk_Zip',
  taalk_email: 'Taalk_Email',
  taalk_market: 'Taalk_Market',
  taalk_reffered: 'Taalk_Reffered',
  taalk_sponsor_org: 'Taalk_SponsorOrg',
  taalk_address: 'Taalk_Address',
  taalk_relationship: 'Taalk_Relationship',
  taalk_lead_source: 'Taalk_Lead_Source',
  taalk_city: 'Taalk_City',
  taalk_group_code: 'Taalk_GroupCode',
  taalk_groupname: 'Taalk_Groupname',
  taalk_beneficiary: 'Taalk_Beneficiary',
  taalk_secretkey: 'Taalk_Secretkey',
};

function formatPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+1${digits}`;
}

/** 10-digit phone for DNC API key. */
function digits10(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return d.length === 10 ? d : '';
}

/** Remove one phone from Taalk company DNC (so lead can be called). */
async function removeFromCompanyDnc(phone) {
  const d = digits10(phone);
  if (!d) return { status: 0 };
  const url = `${LETS_BASE}/dnc/OUT/local`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: LETS_HEADERS,
    body: JSON.stringify({ [d]: false }),
  });
  const text = await r.text();
  try {
    return { status: r.status, payload: JSON.parse(text) };
  } catch {
    return { status: r.status, payload: text };
  }
}

function masterleadToTaalkContact(row) {
  const contact = {
    firstName: (row.first_name || '').trim() || 'Unknown',
    lastName: (row.last_name || '').trim() || 'Unknown',
    phone: formatPhone(row.phone),
  };
  if (!contact.phone) return null;

  for (const [dbKey, taalkKey] of Object.entries(TAALK_FIELD_MAP)) {
    const v = row[dbKey];
    if (v != null && String(v).trim() !== '') contact[taalkKey] = String(v).trim();
  }
  if (!contact.Taalk_Address && row.address) contact.Taalk_Address = String(row.address).trim();
  if (!contact.Taalk_City && row.city) contact.Taalk_City = String(row.city).trim();
  if (!contact.Taalk_State && row.state) contact.Taalk_State = String(row.state).trim();
  if (!contact.Taalk_Zip && row.zip) contact.Taalk_Zip = String(row.zip).trim();
  if (!contact.Taalk_Email && row.email) contact.Taalk_Email = String(row.email).trim();

  return contact;
}

async function main() {
  const campaignMappings = loadCampaignMappings();
  console.log('Loaded', campaignMappings.size, 'campaigns (VN-IL, PAVET-OR, etc.) from vn-pavet-campaigns.csv\n');

  const leadIds = process.env.LEAD_IDS ? process.env.LEAD_IDS.split(',').map((s) => s.trim()).filter(Boolean) : null;
  if (leadIds && leadIds.length > 0) {
    console.log('Fetching masterlead rows by id:', leadIds.join(', '), '\n');
  } else {
    console.log('Fetching 10 masterlead rows: VN / PAVET / VB / VBEU market, phone + state...\n');
  }

  let query = supabase
    .from('masterlead')
    .select('id, first_name, last_name, phone, email, address, city, state, zip, taalk_lead_id, taalk_state, taalk_zip, taalk_email, taalk_market, taalk_reffered, taalk_sponsor_org, taalk_address, taalk_relationship, taalk_lead_source, taalk_city, taalk_group_code, taalk_groupname, taalk_beneficiary, taalk_secretkey')
    .not('phone', 'is', null);
  if (leadIds && leadIds.length > 0) {
    query = query.in('id', leadIds);
  } else {
    query = query.or('taalk_market.ilike.%Veteran%,taalk_market.ilike.%Globe%,taalk_market.ilike.%VN%,taalk_market.ilike.%VB%,taalk_market.ilike.%PAVET%').limit(10).order('id', { ascending: false });
  }
  const { data: rows, error } = await query;

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log('No masterlead rows with VN/PAVET/VB/VBEU market and phone found.');
    process.exit(0);
  }

  const byCampaign = new Map();
  let skipped = 0;
  for (const row of rows) {
    const state = normalizeState(row.taalk_state || row.state);
    const type = getCampaignType(row.taalk_market);
    if (!state || !type) {
      console.log('Skip (no state/type):', row.id, row.taalk_market, row.taalk_state);
      skipped++;
      continue;
    }
    const key = `${type}-${state}`;
    const mapping = campaignMappings.get(key);
    if (!mapping) {
      console.log('Skip (no campaign for ' + key + '):', row.id);
      skipped++;
      continue;
    }
    const contact = masterleadToTaalkContact(row);
    if (!contact) {
      skipped++;
      continue;
    }
    if (!byCampaign.has(mapping.campaignId)) {
      byCampaign.set(mapping.campaignId, { mapping, contacts: [] });
    }
    byCampaign.get(mapping.campaignId).contacts.push(contact);
  }

  if (byCampaign.size === 0) {
    console.log('No contacts mapped to a campaign (skipped ' + skipped + ').');
    process.exit(0);
  }

  console.log('Uploading by campaign (state + type):\n');
  for (const [campaignId, { mapping, contacts }] of byCampaign) {
    console.log(`  ${mapping.type}-${mapping.state}  ${mapping.campaignName}  (${contacts.length} contacts)`);
    contacts.forEach((c, i) => {
      console.log(`    ${i + 1}. ${c.firstName} ${c.lastName} ${c.phone}`);
    });
  }

  for (const [campaignId, { mapping, contacts }] of byCampaign) {
    const phones = [...new Set(contacts.map((c) => digits10(c.phone)).filter(Boolean))];
    console.log('\n' + mapping.type + '-' + mapping.state + ': removing ' + phones.length + ' phone(s) from company DNC...');
    for (const phone of phones) {
      const dnc = await removeFromCompanyDnc(phone);
      console.log('  DNC remove', phone, dnc.status, dnc.payload?.payload ?? dnc.payload);
    }
    const batches = [];
    for (let i = 0; i < contacts.length; i += UPLOAD_BATCH_SIZE) {
      batches.push(contacts.slice(i, i + UPLOAD_BATCH_SIZE));
    }
    console.log(mapping.type + '-' + mapping.state + ': uploading ' + contacts.length + ' contacts in ' + batches.length + ' batch(es) of ' + UPLOAD_BATCH_SIZE + '...');
    const url = `${TAALK_BASE}/campaign2s/${campaignId}/contacts?db=${DB}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TAALK_API_KEY}`,
    };
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ append: batch }),
      });
      const text = await res.text();
      console.log('  batch', b + 1 + '/' + batches.length, res.status, text.slice(0, 120));
      if (!res.ok) {
        console.error('Taalk upload failed for', campaignId, 'batch', b + 1);
        process.exit(1);
      }
      try {
        const json = JSON.parse(text);
        console.log('    change:', json.change || json);
      } catch (_) {}
      if (b < batches.length - 1 && BATCH_DELAY_MS > 0) await sleep(BATCH_DELAY_MS);
    }
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
