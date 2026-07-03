import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let leadsResponse = null;
page.on('response', async resp => {
  if (resp.url().includes('outbound-dialer/leads') && !resp.url().includes('search') && !resp.url().includes('daily')) {
    try { leadsResponse = await resp.json().catch(() => null); } catch {}
  }
});

await page.goto('https://aoirail-production.up.railway.app/login');
await page.waitForLoadState('networkidle');
await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
await page.fill('input[type="password"]', 'aointel2025');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
await page.goto('https://aoirail-production.up.railway.app/dashboard/connect');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(4000);
try {
  const cb = await page.$('input[type="checkbox"]'); if (cb) await cb.check();
  await page.waitForTimeout(500);
  const btn = await page.$('button:has-text("Acknowledge"), button:has-text("Continue")'); if (btn) await btn.click();
  await page.waitForTimeout(3000);
} catch {}
try {
  const go = await page.$('button:has-text("Let\'s Go")'); if (go) { await go.click(); await page.waitForTimeout(6000); }
} catch {}
await page.waitForTimeout(3000);

// Check leads in React state via window
const debugInfo = await page.evaluate(() => {
  // Try to find React fiber to get component state
  const root = document.querySelector('#root');
  if (!root) return { error: 'no root' };
  return { htmlLength: document.body.innerHTML.length };
});

console.log('Leads API response:', JSON.stringify({
  total: leadsResponse?.total,
  count: leadsResponse?.leads?.length,
  sample: leadsResponse?.leads?.slice(0,2).map(l => ({
    id: l.id,
    cn_email: l.cn_email,
    cnresolution: l.cnresolution,
    is_hot_lead: l.is_hot_lead,
    isHotLead: l.isHotLead,
    taalk_market: l.taalk_market,
  }))
}, null, 2));

// Test the filter logic directly
if (leadsResponse?.leads) {
  const userEmail = 'chrislafond@aoglobelife.com';
  const filtered = leadsResponse.leads.filter(lead => {
    const resolution = String(lead.cnresolution ?? '').toLowerCase().trim();
    const taalkMarket = (lead.taalk_market || '').toLowerCase();
    const leadEmail = String(lead.cn_email || '').toLowerCase().trim();
    const isOwnedByUser = leadEmail !== '' && leadEmail === userEmail;
    const hotVal = lead.is_hot_lead ?? lead.isHotLead;
    const isHot = hotVal === true || hotVal === 'true' || hotVal === 1;
    const isPlusLead = taalkMarket.includes('plus');
    return isOwnedByUser && !isPlusLead && isHot && resolution === 'pending';
  });
  console.log('\nFiltered for AO Queue:', filtered.length, 'leads');
  if (filtered.length === 0 && leadsResponse.leads.length > 0) {
    const l = leadsResponse.leads[0];
    console.log('First lead debug:');
    console.log('  cn_email:', l.cn_email, '=== user?', l.cn_email?.toLowerCase() === userEmail);
    console.log('  cnresolution:', l.cnresolution, '=== pending?', String(l.cnresolution??'').toLowerCase() === 'pending');
    console.log('  is_hot_lead:', l.is_hot_lead, 'typeof:', typeof l.is_hot_lead);
    const hotVal = l.is_hot_lead ?? l.isHotLead;
    console.log('  isHot check:', hotVal === true, hotVal === 'true', hotVal === 1);
    console.log('  taalk_market:', l.taalk_market, 'isPlusLead:', (l.taalk_market||'').toLowerCase().includes('plus'));
  }
}

await browser.close();
