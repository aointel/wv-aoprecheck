import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('https://aoirail-production.up.railway.app/login');
await page.waitForLoadState('networkidle');
await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
await page.fill('input[type="password"]', 'aointel2025');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

await page.goto('https://aoirail-production.up.railway.app/dashboard/connect');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(4000);

// Acknowledge init
try {
  const checkbox = await page.$('input[type="checkbox"]');
  if (checkbox) await checkbox.check();
  await page.waitForTimeout(500);
  const btn = await page.$('button:has-text("Acknowledge"), button:has-text("Continue")');
  if (btn) await btn.click();
  await page.waitForTimeout(3000);
} catch(e) {}

// Click "Let's Go" to get into the dialer
try {
  const letsGo = await page.$('button:has-text("Let\'s Go")');
  if (letsGo) { await letsGo.click(); console.log('Clicked Lets Go'); await page.waitForTimeout(3000); }
} catch(e) {}

await page.screenshot({ path: 'C:/dev/ss7.png', fullPage: true });

// Get the AO Queue button text
const aoQueue = await page.$eval('button:has-text("AO Queue")', el => el.textContent).catch(() => null);
const plus = await page.$eval('button:has-text("Plus")', el => el.textContent).catch(() => null);
console.log('AO Queue button:', aoQueue);
console.log('Plus button:', plus);

// Get network requests to see what API calls are made for leads
const requests = [];
page.on('response', async resp => {
  if (resp.url().includes('outbound-dialer')) {
    try {
      const json = await resp.json().catch(() => null);
      if (json) requests.push({ url: resp.url(), total: json.total, leads: json.leads?.length });
    } catch {}
  }
});

// Wait for any refetch
await page.waitForTimeout(3000);
console.log('Lead API requests:', JSON.stringify(requests, null, 2));

await browser.close();
