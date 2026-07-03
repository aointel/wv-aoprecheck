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

// Find all buttons on the page
const buttons = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t && t.length < 100);
});
console.log('All buttons:', buttons.slice(0, 20));

// Check specific queue
const queueText = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const aoBtn = btns.find(b => b.textContent?.includes('AO Queue'));
  const plusBtn = btns.find(b => b.textContent?.includes('Plus'));
  return { ao: aoBtn?.textContent?.trim(), plus: plusBtn?.textContent?.trim() };
});
console.log('Queue buttons:', queueText);

await page.screenshot({ path: 'C:/dev/queue-ss.png', fullPage: false });
await browser.close();
