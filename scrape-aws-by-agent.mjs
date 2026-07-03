/**
 * Search Planet ALTIG by last name for each active agent.
 * Derives last name from email: "johnavila" → search "AVILA" on Planet.
 * Captures SaleId + submitted date + image URL for each submission.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import pg from 'pg';
const { Pool } = pg;

const neon = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });
const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const fmt = (d) => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
const endDate = new Date();
const startDate = new Date(); startDate.setDate(startDate.getDate() - 42);
const START = fmt(startDate); const END = fmt(endDate);

// Get active agents
const { rows: activeRows } = await neon.query(
  `SELECT DISTINCT agent_email FROM agent_daily_stats WHERE stat_date >= $1 AND dials > 0`,
  [startDate.toISOString().split('T')[0]]
);
const activeEmails = activeRows.map(r => r.agent_email.toLowerCase()).filter(e => e.includes('@aoglobelife.com'));
console.log(`Active agents: ${activeEmails.length}`);

// Get real names from market_alp_weekly (producer = "FIRST LAST")
const { rows: alpRows } = await neon.query(`SELECT DISTINCT producer FROM market_alp_weekly`);
const alpNormMap = new Map(); // "abelklug" → { producer:"ABEL KLUG", lastName:"KLUG" }
for (const { producer } of alpRows) {
  const norm = producer.replace(/[\s,.'"-]+/g, '').toLowerCase();
  const words = producer.trim().split(/\s+/);
  const lastName = words[words.length - 1].toUpperCase();
  alpNormMap.set(norm, { producer, lastName });
}

// Match each active email to a producer name + last name
const agentSearchList = [];
for (const email of activeEmails) {
  const local = email.split('@')[0].toLowerCase();
  if (alpNormMap.has(local)) {
    const { producer, lastName } = alpNormMap.get(local);
    agentSearchList.push({ email, producer, lastName });
  }
}
console.log(`Matched ${agentSearchList.length} agents to ALP names for Planet search`);
if (agentSearchList.length > 0) console.log('Sample:', agentSearchList.slice(0,3).map(a=>`${a.email}=${a.producer}`).join(', '));

// Login
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://aws.planetaltig.com/Account/Login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('input[name="Alias"]', 'michaelmandella');
await page.fill('input[name="Password"]', 'C8fkef8agyeh!!');
await page.click('input[type="submit"]');
await page.waitForLoadState('domcontentloaded');
console.log('Logged in');

await page.goto('https://aws.planetaltig.com/SearchApplicationV2', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2000);
await page.click('#btnSimpleSearch');
await page.waitForTimeout(2000);

const makeParams = (agentName, s, e) => {
  const p = new URLSearchParams();
  p.append('draw','1');
  const cols = [['Insured','Insured'],['EAppBasicInfo.TransmitDateString','TransmitDate'],['SubmittedDateString','SubmittedDate'],['HireDateString','Tenure'],['PolicyNumber','PolicyNumber'],['LineOfBusinessDescription','LineOfBusiness'],['CWAString','CWA'],['ALPString','ALP'],['Status','Status'],['CurrentStatus','CurrentStatus']];
  cols.forEach(([data,name],i) => {
    p.append(`columns[${i}][data]`,data); p.append(`columns[${i}][name]`,name);
    p.append(`columns[${i}][searchable]`,'true'); p.append(`columns[${i}][orderable]`,'true');
    p.append(`columns[${i}][search][value]`,''); p.append(`columns[${i}][search][regex]`,'false');
  });
  p.append('order[0][column]','2'); p.append('order[0][dir]','desc');
  p.append('start','0'); p.append('length','200');
  p.append('search[value]',''); p.append('search[regex]','false');
  p.append('mqCleanStatus','All'); p.append('EAppStatusTypeId','0'); p.append('EAppMacUserId','-1');
  p.append('policyHolderName',''); p.append('policyNumber',''); p.append('agentName', agentName);
  p.append('SwitchToNilicoPolicies','1');
  ['200','202','203','208'].forEach(s => p.append('appStatusList[]',s));
  p.append('startdate',s); p.append('endDate',e); p.append('basicStartdate',s); p.append('basicEndDate',e);
  p.append('IsAdvanceSearch','false');
  return p.toString();
};

const allMatched = [];

for (const agent of agentSearchList) {
  const result = await page.evaluate(async ({ params }) => {
    const res = await fetch('/SearchApplicationV2/RefreshEAppSearchList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: params, credentials: 'include'
    });
    try { return await res.json(); } catch(e) { return null; }
  }, { params: makeParams(agent.lastName, START, END) });

  if (!result?.data?.length) continue;

  // Filter rows to this specific agent (last name match)
  const agentRows = result.data.filter(r => {
    const pName = (r.EAppBasicInfo?.AgentName || '').toUpperCase();
    return pName.includes(agent.lastName);
  });

  if (!agentRows.length) continue;

  for (const row of agentRows) {
    const info = row.EAppBasicInfo || {};
    const submitMs = row.SubmittedDate?.match(/\d+/)?.[0];
    const transmitMs = info.TransmitDate?.match(/\d+/)?.[0];
    allMatched.push({
      agentEmail: agent.email,
      agentName: info.AgentName,
      saleId: info.SaleId,
      eappId: row.EappId,
      policyNumber: row.PolicyNumber,
      insured: row.Insured,
      alp: Number(row.ALP) || 0,
      cwa: Number(row.CWA) || 0,
      lob: row.LineOfBusiness,
      submittedDate: submitMs ? new Date(parseInt(submitMs)).toISOString().split('T')[0] : null,
      transmitDate: transmitMs ? new Date(parseInt(transmitMs)).toISOString().split('T')[0] : null,
      imageUrl: info.EappImageS3Url || null,
      status: row.CurrentStatus,
      associateId: info.AssociateId,
    });
  }

  const totalAlp = agentRows.reduce((s,r) => s+(Number(r.ALP)||0), 0);
  console.log(`  ${agent.producer} (${agent.email}): ${agentRows.length} apps, $${totalAlp.toFixed(0)} ALP`);
}

await browser.close();
console.log(`\nTotal: ${allMatched.length} submissions for our agents`);
writeFileSync('C:\\dev\\AOIrail\\aws-agent-submissions.json', JSON.stringify(allMatched, null, 2));

const withImages = allMatched.filter(r => r.imageUrl);
const withSaleIds = allMatched.filter(r => r.saleId);
console.log(`  ${withSaleIds.length} have SaleIds for image API`);
console.log(`  ${withImages.length} have direct image URLs`);
if (allMatched.length > 0) console.log('\nSample:', JSON.stringify(allMatched[0], null, 2));

await neon.end();
