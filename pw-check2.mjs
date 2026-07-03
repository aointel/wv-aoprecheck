import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('https://aoirail-production.up.railway.app/login');
await page.waitForLoadState('networkidle');
await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
await page.fill('input[type="password"]', 'aointel2025');
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);

await page.goto('https://aoirail-production.up.railway.app/dashboard/connect');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(4000);

// Click the acknowledge checkbox and continue button
try {
  const checkbox = await page.$('input[type="checkbox"]');
  if (checkbox) { await checkbox.check(); console.log('Checked checkbox'); }
  await page.waitForTimeout(500);
  const btn = await page.$('button:has-text("Acknowledge"), button:has-text("continue"), button:has-text("Continue")');
  if (btn) { await btn.click(); console.log('Clicked continue'); }
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');
} catch(e) { console.log('No checkpoint:', e.message); }

console.log('URL:', page.url());
await page.screenshot({ path: 'C:/dev/screenshot4.png', fullPage: true });

// Look for lead count numbers on the page
const allText = await page.evaluate(() => {
  return document.body.innerText;
});

// Find numbers that might be lead counts
const numbers = allText.match(/\d+\s*(leads|pending|queue|AO|Que)/gi);
console.log('Lead-related numbers found:', numbers);

// Also grab visible text from key areas
const keyText = await page.evaluate(() => {
  const els = document.querySelectorAll('h1,h2,h3,h4,[class*="count"],[class*="badge"],[class*="total"],[class*="queue"]');
  return Array.from(els).map(e => e.textContent?.trim()).filter(t => t && t.length < 200);
});
console.log('Key text:', keyText.slice(0, 30));

await browser.close();
