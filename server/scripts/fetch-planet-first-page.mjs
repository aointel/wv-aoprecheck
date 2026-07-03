import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const fmt = (d) =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

const startDate = '04/01/2026';
const endDate = fmt(new Date());
const pageSize = 100;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('https://aws.planetaltig.com/Account/Login', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});
await page.fill('input[name="Alias"]', 'michaelmandella');
await page.fill('input[name="Password"]', 'C8fkef8agyeh!!');
await page.click('input[type="submit"]');
await page.waitForLoadState('domcontentloaded');

await page.goto('https://aws.planetaltig.com/SearchApplicationV2', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});
await page.waitForTimeout(1500);
await page.click('#btnSimpleSearch');
await page.waitForTimeout(1200);

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

const p = new URLSearchParams();
p.append('draw', '1');
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
p.append('start', '0');
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

const result = await page.evaluate(async ({ body }) => {
  const res = await fetch('/SearchApplicationV2/RefreshEAppSearchList', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
    credentials: 'include',
  });
  try {
    return await res.json();
  } catch {
    return null;
  }
}, { body: p.toString() });

await browser.close();

if (!result?.data) {
  console.error('No data returned from Planet API.');
  process.exit(1);
}

const slim = result.data.map((r) => ({
  eappId: r.EappId,
  policyNumber: r.PolicyNumber,
  insured: r.Insured,
  lob: r.LineOfBusiness,
  alp: r.ALP,
  cwa: r.CWA,
  submittedDate: r.SubmittedDate,
  submittedDateStr: r.SubmittedDateString,
  transmitDateStr: r.EAppBasicInfo?.TransmitDateString,
  agentName: r.EAppBasicInfo?.AgentName,
  agentCode: r.EAppBasicInfo?.AgentCode,
  associateId: r.EAppBasicInfo?.AssociateId,
  saleId: r.EAppBasicInfo?.SaleId,
  officeId: r.EAppBasicInfo?.OfficeId,
  officeName: r.EAppBasicInfo?.OfficeName,
  status: r.CurrentStatus,
  imageUrl: r.EAppBasicInfo?.EappImageS3Url || null,
}));

const now = new Date();
const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
const outPath = `C:\\dev\\AOIrail\\server\\scripts\\output\\planet-first-page-${stamp}.json`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  JSON.stringify(
    {
      query: { startDate, endDate, pageSize, offset: 0 },
      summary: {
        recordsTotal: result.recordsTotal ?? null,
        recordsFiltered: result.recordsFiltered ?? null,
        alpTotal: result.AlpTotal ?? null,
        returned: slim.length,
      },
      data: slim,
    },
    null,
    2,
  ),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      outPath,
      startDate,
      endDate,
      pageSize,
      recordsTotal: result.recordsTotal ?? null,
      recordsFiltered: result.recordsFiltered ?? null,
      returned: slim.length,
      alpTotal: result.AlpTotal ?? null,
    },
    null,
    2,
  ),
);
