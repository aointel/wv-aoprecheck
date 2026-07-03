import { chromium } from 'playwright';
import { existsSync } from 'fs';

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const PLANET_USER = 'michaelmandella';
const PLANET_PASS = 'C8fkef8agyeh!!';

const fmt = (d) =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

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

const startDate = process.env.START_DATE || '04/01/2026';
const endDate = process.env.END_DATE || fmt(new Date());
const pageSize = Number(process.env.PAGE_SIZE || 500);
const concurrency = Number(process.env.CONCURRENCY || 6);
const maxPages = Number(process.env.MAX_PAGES || 20);
const maxRetries = Number(process.env.MAX_RETRIES || 4);
const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  ['/usr/bin/chromium-browser', '/usr/bin/chromium'].find((candidate) => existsSync(candidate));

const cols = [
  ['Insured', 'Insured'],
  ['EAppBasicInfo.TransmitDateString', 'TransmitDate'],
  ['SubmittedDateString', 'SubmittedDate'],
  ['HireDateString', 'Tenure'],
  ['PolicyNumber', 'PolicyNumber'],
  ['LineOfBusinessDescription', 'LineOfBusiness'],
  ['CWAString', 'CWA'],
  ['ALPString', 'ALP'],
  ['Status', 'Status'],
  ['CurrentStatus', 'CurrentStatus'],
];

function buildBody({ start, draw }) {
  const p = new URLSearchParams();
  p.append('draw', String(draw));
  cols.forEach(([data, name], i) => {
    p.append(`columns[${i}][data]`, data);
    p.append(`columns[${i}][name]`, name);
    p.append(`columns[${i}][searchable]`, 'true');
    p.append(`columns[${i}][orderable]`, 'true');
    p.append(`columns[${i}][search][value]`, '');
    p.append(`columns[${i}][search][regex]`, 'false');
  });
  p.append('order[0][column]', '2');
  p.append('order[0][dir]', 'desc');
  p.append('start', String(start));
  p.append('length', String(pageSize));
  p.append('search[value]', '');
  p.append('search[regex]', 'false');
  p.append('mqCleanStatus', 'All');
  p.append('EAppStatusTypeId', '0');
  p.append('EAppMacUserId', '-1');
  p.append('policyHolderName', '');
  p.append('policyNumber', '');
  p.append('agentName', '');
  p.append('SwitchToNilicoPolicies', '1');
  ['200', '202', '203', '208'].forEach((s) => p.append('appStatusList[]', s));
  p.append('startdate', startDate);
  p.append('endDate', endDate);
  p.append('basicStartdate', startDate);
  p.append('basicEndDate', endDate);
  p.append('IsAdvanceSearch', 'false');
  return p.toString();
}

async function fetchPlanetPage(request, { start, draw }) {
  const body = buildBody({ start, draw });
  const res = await request.post(
    'https://aws.planetaltig.com/SearchApplicationV2/RefreshEAppSearchList',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      data: body,
    },
  );
  if (!res.ok()) {
    throw new Error(`Planet request failed (${res.status()}) start=${start}`);
  }
  return await res.json();
}

function mapRows(rows) {
  return (rows || [])
    .map((r) => {
      const assocRaw = r.EAppBasicInfo?.AssociateId;
      const assoc = assocRaw == null ? '' : String(assocRaw).trim();
      const out = {
        submitted_application_id: String(r.EappId || ''),
        policy_number: r.PolicyNumber || null,
        insured: r.Insured || null,
        lob: r.LineOfBusiness || null,
        cwa: r.CWA || 0,
        platform_alp: r.ALP || 0,
        sga_submit: toIsoDate(r.SubmittedDate || r.SubmittedDateString),
        origination: toIsoDate(r.EAppBasicInfo?.TransmitDateString),
        agent_name: r.EAppBasicInfo?.AgentName || null,
        company_email: null,
        group_code: r.EAppBasicInfo?.SaleId || null,
      };
      if (assoc) out.associate_id = assoc;
      return out;
    })
    .filter((r) => r.submitted_application_id);
}

async function upsertPlatformSales(rows) {
  if (!rows.length) return { ok: 0, fail: 0 };
  const res = await fetch(
    `${SUPA_URL}/rest/v1/platform_sales?on_conflict=submitted_application_id`,
    {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    },
  );

  if (res.status >= 200 && res.status < 300) {
    return { ok: rows.length, fail: 0 };
  }

  let ok = 0;
  let fail = 0;
  for (const row of rows) {
    const retry = await fetch(
      `${SUPA_URL}/rest/v1/platform_sales?on_conflict=submitted_application_id`,
      {
        method: 'POST',
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(row),
      },
    );
    if (retry.status >= 200 && retry.status < 300) ok++;
    else fail++;
  }
  return { ok, fail };
}

async function retry(fn, label) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const waitMs = 300 * Math.pow(2, i) + Math.floor(Math.random() * 250);
      console.warn(`Retry ${i + 1}/${maxRetries} for ${label}: ${String(err)} (wait ${waitMs}ms)`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumExecutablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://aws.planetaltig.com/Account/Login', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});
await page.fill('input[name="Alias"]', PLANET_USER);
await page.fill('input[name="Password"]', PLANET_PASS);
await page.click('input[type="submit"]');
await page.waitForLoadState('domcontentloaded');

await page.goto('https://aws.planetaltig.com/SearchApplicationV2', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});
await page.waitForTimeout(1200);
await page.click('#btnSimpleSearch');
await page.waitForTimeout(1200);

const initial = await retry(
  () => fetchPlanetPage(context.request, { start: 0, draw: 1 }),
  'initial-page',
);
const total = Number(initial?.recordsTotal || 0);
const totalPages = Math.ceil(total / pageSize);
const targetPages = Math.min(maxPages, totalPages || maxPages);

const offsets = [];
for (let p = 0; p < targetPages; p++) offsets.push(p * pageSize);

const started = Date.now();
let fetchedPages = 0;
let fetchedRows = 0;
let upsertOk = 0;
let upsertFail = 0;
let processedOffsets = 0;

let offsetPtr = 0;
const worker = async (workerId) => {
  while (offsetPtr < offsets.length) {
    const myIdx = offsetPtr++;
    const start = offsets[myIdx];
    const draw = myIdx + 1;
    const label = `offset=${start}`;
    const data = await retry(
      () => fetchPlanetPage(context.request, { start, draw }),
      label,
    );
    const mapped = mapRows(data?.data || []);
    const up = await retry(
      () => upsertPlatformSales(mapped),
      `upsert-${label}`,
    );

    fetchedPages++;
    fetchedRows += mapped.length;
    upsertOk += up.ok;
    upsertFail += up.fail;
    processedOffsets++;

    const elapsedSec = Math.max(1, (Date.now() - started) / 1000);
    const rowsPerSec = (fetchedRows / elapsedSec).toFixed(2);
    console.log(
      `[worker ${workerId}] page ${processedOffsets}/${offsets.length} ${label} rows=${mapped.length} upsert_ok=${up.ok} upsert_fail=${up.fail} rate=${rowsPerSec} rows/s`,
    );
    await new Promise((r) => setTimeout(r, 75 + Math.floor(Math.random() * 175)));
  }
};

const workers = [];
for (let i = 0; i < Math.max(1, concurrency); i++) workers.push(worker(i + 1));
await Promise.all(workers);
await browser.close();

const elapsedMs = Date.now() - started;
console.log(
  JSON.stringify(
    {
      ok: true,
      query: { startDate, endDate, pageSize, concurrency, maxPages },
      totalRecordsInRange: total,
      processedPages: fetchedPages,
      fetchedRows,
      upsertOk,
      upsertFail,
      elapsedMs,
      rowsPerSecond: Number((fetchedRows / Math.max(1, elapsedMs / 1000)).toFixed(2)),
      alpTotal: initial?.AlpTotal ?? null,
    },
    null,
    2,
  ),
);
