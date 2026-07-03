import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const leadApiCalls = [];
page.on('response', async resp => {
  if (resp.url().includes('outbound-dialer/leads') && !resp.url().includes('search') && !resp.url().includes('daily')) {
    try {
      const json = await resp.json().catch(() => null);
      if (json?.leads?.length > 0) {
        const sample = json.leads.slice(0, 3).map(l => ({
          id: l.id,
          cn_email: l.cn_email,
          cnresolution: l.cnresolution,
          taalk_market: l.taalk_market,
          is_hot_lead: l.is_hot_lead,
          ao_lead_box: l.ao_lead_box,
          associate_id: l.associate_id,
        }));
        leadApiCalls.push({ url: resp.url().substring(0, 80), total: json.total, sample });
      }
    } catch {}
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
  const cb = await page.$('input[type="checkbox"]');
  if (cb) await cb.check();
  await page.waitForTimeout(500);
  const btn = await page.$('button:has-text("Acknowledge"), button:has-text("Continue")');
  if (btn) await btn.click();
  await page.waitForTimeout(3000);
} catch {}

try {
  const go = await page.$('button:has-text("Let\'s Go")');
  if (go) { await go.click(); await page.waitForTimeout(5000); }
} catch {}

await page.waitForTimeout(3000);

const aoQueue = await page.$eval('button:has-text("AO Queue")', el => el.textContent).catch(() => 'not found');
const plus = await page.$eval('button:has-text("Plus")', el => el.textContent).catch(() => 'not found');
console.log('AO Queue:', aoQueue);
console.log('Plus:', plus);
console.log('\nLead API calls:');
leadApiCalls.forEach(c => {
  console.log('URL:', c.url);
  console.log('Total:', c.total);
  console.log('Sample:', JSON.stringify(c.sample, null, 2));
});

await browser.close();
