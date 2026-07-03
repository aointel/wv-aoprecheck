import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Intercept ALL network requests
const apiCalls = [];
page.on('response', async resp => {
  const url = resp.url();
  if (url.includes('outbound-dialer') || url.includes('masterlead') || url.includes('leads')) {
    try {
      const json = await resp.json().catch(() => null);
      apiCalls.push({ 
        url: url.substring(0, 150), 
        status: resp.status(),
        total: json?.total,
        leadsCount: json?.leads?.length,
        success: json?.success
      });
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
  const checkbox = await page.$('input[type="checkbox"]');
  if (checkbox) await checkbox.check();
  await page.waitForTimeout(500);
  const btn = await page.$('button:has-text("Acknowledge"), button:has-text("Continue")');
  if (btn) await btn.click();
  await page.waitForTimeout(3000);
} catch(e) {}

try {
  const letsGo = await page.$('button:has-text("Let\'s Go")');
  if (letsGo) { await letsGo.click(); await page.waitForTimeout(4000); }
} catch(e) {}

// Wait for leads to load
await page.waitForTimeout(5000);

console.log('API calls intercepted:');
apiCalls.forEach(c => console.log(JSON.stringify(c)));

// Also check window data
const storeData = await page.evaluate(() => {
  // Try to find React query cache
  const queues = window.__REACT_QUERY_GLOBAL_CALLBACKS__ || window.__REACT_QUERY_STATE__;
  return { queues: !!queues };
});
console.log('Store:', storeData);

await browser.close();
