import { readFileSync } from 'fs';

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const rows = JSON.parse(readFileSync('C:\\dev\\AOIrail\\aws-agent-submissions.json', 'utf8'));
console.log(`Inserting ${rows.length} submissions into platform_sales...`);

let upserted = 0, skipped = 0, errors = 0;

// Batch in chunks of 100
const CHUNK = 100;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK).map(row => ({
    submitted_application_id: String(row.eappId || ''),
    policy_number: row.policyNumber || null,
    insured: row.insured || null,
    lob: row.lob || null,
    cwa: row.cwa || 0,
    platform_alp: row.alp || 0,
    sga_submit: row.submittedDate || null,
    origination: row.transmitDate || null, // using origination for transmit date
    agent_name: row.agentName || null,
    company_email: row.agentEmail || null,
    associate_id: String(row.associateId || ''),
    // Store SaleId in group_code for now (no dedicated column yet)
    group_code: row.saleId || null,
  })).filter(r => r.submitted_application_id);

  const res = await fetch(`${SUPA_URL}/rest/v1/platform_sales`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(chunk)
  });

  if (res.status >= 200 && res.status < 300) {
    upserted += chunk.length;
    process.stdout.write(`\r  ${upserted}/${rows.length} inserted...`);
  } else {
    const t = await res.text();
    // Try one by one on batch failure
    for (const row of chunk) {
      const r2 = await fetch(`${SUPA_URL}/rest/v1/platform_sales`, {
        method: 'POST',
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(row)
      });
      if (r2.status >= 200 && r2.status < 300) upserted++;
      else { errors++; }
    }
  }
}

console.log(`\n✅ Done: ${upserted} upserted, ${skipped} skipped, ${errors} errors`);
console.log(`\nSaleIds stored in group_code field — ready for OCR when needed.`);
console.log(`Next: for each SaleId, call Planet image API → OCR → extract application_date`);
