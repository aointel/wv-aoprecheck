/**
 * Parse HPPRO Excel export and load into Supabase hppro_analytics_summary table
 * Also creates hppro_presentations table if needed
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('C:/dev/AOIrail/node_modules/xlsx/xlsx.js');

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=minimal',
      ...(opts.headers || {}),
    },
  });
  return r;
}

// Parse Excel serial date to ISO string
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toISOString().slice(0, 10);
}

// Read the file
console.log('Reading Excel file...');
const wb = XLSX.readFile('C:/Users/mmand/Downloads/data (4).xlsx');
const ws = wb.Sheets['Export'];
const rows = XLSX.utils.sheet_to_json(ws);
console.log(`Loaded ${rows.length} rows`);
console.log('Sample:', JSON.stringify(rows[0]));

// Check existing table
const check = await supa('/hppro_presentations?limit=1');
console.log('\nhppro_presentations table status:', check.status);

if (check.status === 404 || (await check.json().catch(() => ({code:'42P01'}))).code === '42P01') {
  console.log('Table does not exist — need to create it first');
  console.log('Run this SQL in Supabase dashboard:');
  console.log(`
CREATE TABLE IF NOT EXISTS hppro_presentations (
  id bigserial PRIMARY KEY,
  presentation_id bigint UNIQUE,
  lead_id bigint,
  create_date date,
  alp numeric,
  office_name text,
  agent_associate_id bigint,
  agent_name text,
  agent_email text,
  member_first_name text,
  member_last_name text,
  member_email text,
  member_phone text,
  city text,
  member_state text,
  zip text,
  group_name text,
  presentation_type text,
  belong_to_vso text,
  honorable_service text,
  service_in_war text,
  is_form_submitted text,
  what_happened text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hppro_lead_id ON hppro_presentations(lead_id);
CREATE INDEX IF NOT EXISTS idx_hppro_agent_id ON hppro_presentations(agent_associate_id);
CREATE INDEX IF NOT EXISTS idx_hppro_create_date ON hppro_presentations(create_date DESC);
  `);
} else {
  // Table exists — load data
  // Ensure every record has exactly the same keys (PostgREST requires consistent shape)
  const records = rows.map(r => ({
    presentation_id: r['PresentationID'] ?? null,
    lead_id: r['LeadId'] ?? null,
    create_date: excelDateToISO(r['CreateDate']),
    alp: parseFloat(r['ALP']) || 0,
    office_name: r['OfficeName'] ?? null,
    agent_associate_id: r['AgentAssociateID'] ?? null,
    agent_name: r['AgentName'] ?? null,
    agent_email: null,
    member_first_name: r['MemberFirstName'] ?? null,
    member_last_name: r['MemberLastName'] ?? null,
    member_email: r['MemberEmail'] ?? null,
    member_phone: r['MemberPhone'] ?? null,
    city: r['City'] ?? null,
    member_state: r['MemberState'] ?? null,
    zip: r['Zip'] ? String(r['Zip']) : null,
    group_name: r['GroupName'] ?? null,
    presentation_type: r['PresentationType'] ?? null,
    belong_to_vso: r['BelongToVSO'] ?? null,
    honorable_service: r['HonorableService'] ?? null,
    service_in_war: r['ServiceInWar'] ?? null,
    is_form_submitted: r['IsFormSubmitted'] ?? null,
    what_happened: r['WhatHappenedText'] ?? null,
  }));

  console.log(`\nInserting ${records.length} records in batches...`);
  const BATCH = 100;
  let inserted = 0, errors = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const r = await supa('/hppro_presentations', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: JSON.stringify(batch),
    });
    if (r.ok || r.status === 201) {
      inserted += batch.length;
    } else {
      errors++;
      if (errors === 1) console.log('First error:', (await r.text()).slice(0, 200));
    }
    if (i % 1000 === 0) process.stdout.write(`\r  ${inserted}/${records.length}`);
    await new Promise(r => setTimeout(r, 50));
  }
  console.log(`\n✓ Inserted: ${inserted}, Errors: ${errors}`);

  // Quick summary
  const byAgent = {};
  for (const r of records) {
    const id = r.agent_associate_id;
    if (!id) continue;
    if (!byAgent[id]) byAgent[id] = { name: r.agent_name, pres: 0, alp: 0, enrolled: 0 };
    byAgent[id].pres++;
    byAgent[id].alp += r.alp || 0;
    if (r.what_happened === 'Enrollment') byAgent[id].enrolled++;
  }
  console.log('\nTop 10 agents by ALP:');
  Object.entries(byAgent)
    .sort((a,b) => b[1].alp - a[1].alp)
    .slice(0, 10)
    .forEach(([id, d]) => {
      const closeRate = d.pres > 0 ? Math.round(d.enrolled/d.pres*100) : 0;
      console.log(`  ${d.name} (${id}): ${d.pres} pres | $${Math.round(d.alp).toLocaleString()} ALP | ${d.enrolled} enrolled | ${closeRate}% close`);
    });
}
