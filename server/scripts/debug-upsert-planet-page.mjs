import { readFileSync } from 'fs';

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node server/scripts/debug-upsert-planet-page.mjs <input-json>');
  process.exit(1);
}

const payload = JSON.parse(readFileSync(inputPath, 'utf8'));
const rows = Array.isArray(payload?.data) ? payload.data : [];

const toIsoDate = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const msMatch = raw.match(/\/Date\((\d+)\)\//);
  if (msMatch) {
    const ms = Number(msMatch[1]);
    if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10);
  }
  const simple = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (simple) {
    const mm = simple[1].padStart(2, '0');
    const dd = simple[2].padStart(2, '0');
    const yyyy = simple[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
};

const mapped = rows.slice(0, 100).map((row) => ({
  submitted_application_id: String(row.eappId || ''),
  policy_number: row.policyNumber || null,
  insured: row.insured || null,
  lob: row.lob || null,
  cwa: row.cwa || 0,
  platform_alp: row.alp || 0,
  sga_submit: toIsoDate(row.submittedDate || row.submittedDateStr),
  origination: toIsoDate(row.transmitDateStr),
  agent_name: row.agentName || null,
  company_email: null,
  associate_id: row.associateId == null ? '' : String(row.associateId),
  group_code: row.saleId || null,
}));

let ok = 0;
let fail = 0;
const samples = [];
for (const row of mapped) {
  const res = await fetch(`${SUPA_URL}/rest/v1/platform_sales`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (res.status >= 200 && res.status < 300) {
    ok++;
  } else {
    fail++;
    if (samples.length < 10) {
      samples.push({
        submitted_application_id: row.submitted_application_id,
        status: res.status,
        error: await res.text(),
      });
    }
  }
}

console.log(JSON.stringify({ ok, fail, samples }, null, 2));
