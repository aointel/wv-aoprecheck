import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('https://aoirail-production.up.railway.app/login');
await page.waitForLoadState('networkidle');

// Fill login
await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
await page.fill('input[type="password"]', 'aointel2025');
await page.click('button[type="submit"]');

await page.waitForLoadState('networkidle');
await page.waitForTimeout(4000);

console.log('URL after login:', page.url());
await page.screenshot({ path: 'C:/dev/screenshot2.png', fullPage: false });

// Navigate to connect
await page.goto('https://aoirail-production.up.railway.app/dashboard/connect');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(5000);

console.log('URL on connect:', page.url());
await page.screenshot({ path: 'C:/dev/screenshot3.png', fullPage: true });

// Look for lead count / queue info
const bodyText = await page.evaluate(() => {
  const els = document.querySelectorAll('[class*="queue"], [class*="lead"], [class*="count"], h1, h2, h3');
  return Array.from(els).slice(0, 20).map(e => e.textContent?.trim()).filter(Boolean);
});
console.log('Page elements:', JSON.stringify(bodyText, null, 2));

await browser.close();
