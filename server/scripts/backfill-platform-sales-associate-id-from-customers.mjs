const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const headers = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
};

const normalize = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const customerNameKeys = (row) => {
  const first = String(row?.first_name || '').trim();
  const last = String(row?.last_name || '').trim();
  const keys = new Set();
  if (first || last) {
    keys.add(normalize(`${last},${first}`));
    keys.add(normalize(`${first} ${last}`));
    keys.add(normalize(`${last} ${first}`));
    keys.add(normalize(`${first}${last}`));
    keys.add(normalize(`${last}${first}`));
  }
  return [...keys].filter(Boolean);
};

const agentNameKeys = (agentName) => {
  const raw = String(agentName || '').trim();
  const keys = new Set([normalize(raw)]);
  if (raw.includes(',')) {
    const [last, first] = raw.split(',').map((s) => s.trim());
    keys.add(normalize(`${last},${first}`));
    keys.add(normalize(`${first} ${last}`));
    keys.add(normalize(`${last} ${first}`));
    keys.add(normalize(`${first}${last}`));
    keys.add(normalize(`${last}${first}`));
  } else {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts[parts.length - 1];
      keys.add(normalize(`${last},${first}`));
      keys.add(normalize(`${first} ${last}`));
      keys.add(normalize(`${last} ${first}`));
      keys.add(normalize(`${first}${last}`));
      keys.add(normalize(`${last}${first}`));
    }
  }
  return [...keys].filter(Boolean);
};

async function fetchAllCustomers() {
  const out = [];
  const limit = 1000;
  let offset = 0;
  while (true) {
    const url =
      `${SUPA_URL}/rest/v1/customers` +
      `?select=first_name,last_name,associate_id,company_email,personal_email` +
      `&associate_id=not.is.null` +
      `&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`customers fetch failed: ${res.status} ${await res.text()}`);
    }
    const rows = await res.json();
    if (!rows.length) break;
    out.push(...rows);
    offset += rows.length;
    if (rows.length < limit) break;
  }
  return out;
}

async function fetchPlatformSalesPage(afterId) {
  const limit = 1000;
  const url =
    `${SUPA_URL}/rest/v1/platform_sales` +
    `?select=id,agent_name,associate_id,submitted_application_id` +
    `&agent_name=not.is.null` +
    `&submitted_application_id=not.is.null` +
    `&id=gt.${afterId}` +
    `&order=id.asc&limit=${limit}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`platform_sales fetch failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

async function bulkUpsertById(rows) {
  if (!rows.length) return;
  const res = await fetch(`${SUPA_URL}/rest/v1/platform_sales?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`bulk upsert failed: ${res.status} ${await res.text()}`);
  }
}

const customers = await fetchAllCustomers();
const associateByKey = new Map();
for (const c of customers) {
  const assoc = String(c?.associate_id ?? '').trim();
  if (!assoc) continue;
  for (const key of customerNameKeys(c)) {
    if (!associateByKey.has(key)) associateByKey.set(key, assoc);
  }
}

let afterId = 0;
let scanned = 0;
let candidatesMissing = 0;
let matched = 0;
let updated = 0;

while (true) {
  const page = await fetchPlatformSalesPage(afterId);
  if (!page.length) break;
  afterId = Number(page[page.length - 1].id) || afterId;
  scanned += page.length;

  const updates = [];
  for (const row of page) {
    const currentAssoc = String(row?.associate_id ?? '').trim();
    if (currentAssoc) continue;
    candidatesMissing++;
    const keys = agentNameKeys(row?.agent_name);
    let found = '';
    for (const key of keys) {
      if (associateByKey.has(key)) {
        found = String(associateByKey.get(key) || '').trim();
        if (found) break;
      }
    }
    if (!found) continue;
    matched++;
    updates.push({ id: row.id, associate_id: found });
  }

  for (let i = 0; i < updates.length; i += 500) {
    const chunk = updates.slice(i, i + 500);
    await bulkUpsertById(chunk);
    updated += chunk.length;
  }

  console.log(
    `scanned=${scanned} missing_assoc=${candidatesMissing} matched=${matched} updated=${updated} last_id=${afterId}`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      customersLoaded: customers.length,
      scanned,
      missingAssociateCandidates: candidatesMissing,
      matched,
      updated,
    },
    null,
    2,
  ),
);
