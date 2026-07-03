/**
 * Remove eligible (ready-to-send) leads from Taalk DNC so they can be called.
 * Reads output/eligible-for-taalk.csv, filters to already_in_taalk=no.
 * For each: remove from company DNC (lets.taalk.ai) and campaign DNC (api.taalk.ai).
 *
 * Env: LIMIT (optional, cap number to process), BATCH_SIZE (default 20), DRY_RUN=1 to only log
 * Run: node AOIrail/scripts/remove-leads-from-taalk-dnc.cjs
 */

const fs = require('fs');
const path = require('path');

const TAALK_API_KEY = process.env.TAALK_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
const API_BASE = 'https://api.taalk.ai/api';
const LETS_BASE = 'https://lets.taalk.ai/api';
const DB = process.env.TAALK_DB || 'michaelmandella';
const DNC_HEADERS = {
  'Authorization': `Bearer ${TAALK_API_KEY}`,
  'Content-Type': 'application/json',
  'x-app-db': DB,
};

function phoneToDigits(phone) {
  if (!phone) return '';
  const d = String(phone).replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d.length === 10 ? d : d;
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
    const [, campaignId, , state, typeCol] = match;
    const stateStr = state.trim();
    const typeStr = (typeCol || '').trim();
    if (!typeStr) continue;
    mappings.set(`${typeStr}-${stateStr}`, { campaignId: campaignId.trim() });
  }
  return mappings;
}

/** PATCH /api/dnc/OUT/local with body { "10-digit phone string": 0 } (0=remove, 1=add) */
async function removeCompanyDnc(digits) {
  const body = { [digits]: 0 };
  const res = await fetch(`${LETS_BASE}/dnc/OUT/local`, {
    method: 'PATCH',
    headers: DNC_HEADERS,
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

/** PATCH /api/dnc/OUT/ftc with body { "10-digit phone string": 0 } (0=remove, 1=add) */
async function removeFtcDnc(digits) {
  const body = { [digits]: 0 };
  const res = await fetch(`${LETS_BASE}/dnc/OUT/ftc`, {
    method: 'PATCH',
    headers: DNC_HEADERS,
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

/** Remove one phone from campaign DNC. PATCH campaign2s/{id}/contacts/{phone} body: { dnc: false } */
async function removeCampaignDnc(campaignId, digits) {
  const url = `${API_BASE}/campaign2s/${campaignId}/contacts/${digits}?db=${encodeURIComponent(DB)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${TAALK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dnc: false }),
  });
  return { ok: res.ok, status: res.status };
}

function parseCsvLine(line) {
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) {
      parts.push(cur.replace(/^"|"$/g, '').trim());
      cur = '';
    } else cur += c;
  }
  parts.push(cur.replace(/^"|"$/g, '').trim());
  return parts;
}

function parseEligibleCsv(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const id = parts[0];
    const phone = (parts[3] || '').trim();
    const campaign_key = (parts[7] || '').trim();
    const already_in_taalk = (parts[9] || '').trim().toLowerCase();
    if (already_in_taalk !== 'no') continue;
    rows.push({ id, phone, campaign_key });
  }
  return rows;
}

async function main() {
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
  const batchSize = Math.max(1, parseInt(process.env.BATCH_SIZE, 10) || 20);
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  const csvPath = process.env.ELIGIBLE_CSV || path.join(__dirname, '..', 'output', 'eligible-for-taalk.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('Missing', csvPath, '- run eligible-leads-for-taalk-with-duplicate-check.cjs first.');
    process.exit(1);
  }

  const mappings = loadCampaignMappings();
  console.log('Loaded', mappings.size, 'campaigns from vn-pavet-campaigns.csv\n');

  const rows = parseEligibleCsv(csvPath);
  let toProcess = rows.filter((r) => mappings.has(r.campaign_key));
  if (limit != null) toProcess = toProcess.slice(0, limit);
  console.log('Leads to remove from DNC (already_in_taalk=no, have campaign):', toProcess.length);
  if (toProcess.length === 0) {
    console.log('Nothing to do.');
    return;
  }
  if (dryRun) {
    console.log('DRY_RUN: would remove', toProcess.length, 'leads from company + campaign DNC. First 3:', toProcess.slice(0, 3));
    return;
  }

  let companyOk = 0, companyFail = 0, ftcOk = 0, ftcFail = 0, campaignOk = 0, campaignFail = 0;

  for (let i = 0; i < toProcess.length; i += batchSize) {
    const batch = toProcess.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (row) => {
        const digits = phoneToDigits(row.phone);
        if (!digits) return { company: { ok: false }, ftc: { ok: false }, campaign: { ok: false } };
        const mapping = mappings.get(row.campaign_key);
        if (!mapping) return { company: { ok: false }, ftc: { ok: false }, campaign: { ok: false } };
        const companyRes = await removeCompanyDnc(digits);
        const ftcRes = await removeFtcDnc(digits);
        const campaignRes = await removeCampaignDnc(mapping.campaignId, digits);
        return { company: companyRes, ftc: ftcRes, campaign: campaignRes };
      })
    );
    for (const r of results) {
      if (r.company.ok) companyOk++;
      else companyFail++;
      if (r.ftc && r.ftc.ok) ftcOk++;
      else if (r.ftc) ftcFail++;
      if (r.campaign.ok) campaignOk++;
      else campaignFail++;
    }
    const done = Math.min(i + batchSize, toProcess.length);
    if (done % 500 === 0 || done === toProcess.length) {
      console.log('  Processed', done, '/', toProcess.length, '- Company:', companyOk, 'FTC:', ftcOk, 'Campaign:', campaignOk, '| fails C:', companyFail, 'F:', ftcFail, 'Camp:', campaignFail);
    }
  }

  console.log('\nDone.');
  console.log('  Company DNC: removed', companyOk, 'failed', companyFail);
  console.log('  FTC DNC: removed', ftcOk, 'failed', ftcFail);
  console.log('  Campaign DNC: removed', campaignOk, 'failed', campaignFail);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
