import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const leadApiCalls = [];
page.on('response', async resp => {
  if (resp.url().includes('outbound-dialer/leads') && !resp.url().includes('search') && !resp.url().includes('daily')) {
    try {
      const json = await resp.json().catch(() => null);
      leadApiCalls.push({ url: resp.url().substring(0, 100), total: json?.total, leads: json?.leads?.length });
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

// Find AO Queue count
const aoQueueBtn = await page.$eval('button:has-text("AO Queue")', el => el.textContent).catch(() => null);
console.log('AO Queue button text:', aoQueueBtn);
console.log('Lead API calls:');
leadApiCalls.forEach(c => console.log(JSON.stringify(c)));

await browser.close();
