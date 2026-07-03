import { readFileSync } from 'fs';

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node server/scripts/verify-planet-page-in-platform-sales.mjs <input-json>');
  process.exit(1);
}

const payload = JSON.parse(readFileSync(inputPath, 'utf8'));
const ids = (payload?.data || [])
  .map((r) => String(r?.eappId || '').trim())
  .filter(Boolean);

const CHUNK = 40;
const found = new Set();

for (let i = 0; i < ids.length; i += CHUNK) {
  const chunk = ids.slice(i, i + CHUNK);
  const inClause = `(${chunk.join(',')})`;
  const url = `${SUPA_URL}/rest/v1/platform_sales?select=submitted_application_id&submitted_application_id=in.${encodeURIComponent(inClause)}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
    },
  });
  if (!res.ok) {
    console.error('Verify query failed:', res.status, await res.text());
    process.exit(1);
  }
  const rows = await res.json();
  for (const row of rows || []) {
    const id = String(row?.submitted_application_id || '').trim();
    if (id) found.add(id);
  }
}

console.log(
  JSON.stringify(
    {
      totalInput: ids.length,
      foundInPlatformSales: found.size,
      missing: ids.filter((id) => !found.has(id)).slice(0, 25),
    },
    null,
    2,
  ),
);
