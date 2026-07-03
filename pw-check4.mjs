import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Login
await page.goto('https://aoirail-production.up.railway.app/login');
await page.waitForLoadState('networkidle');
await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
await page.fill('input[type="password"]', 'aointel2025');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

// Go to connect
await page.goto('https://aoirail-production.up.railway.app/dashboard/connect');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(4000);

// Acknowledge init screen
try {
  const checkbox = await page.$('input[type="checkbox"]');
  if (checkbox) { await checkbox.check(); }
  await page.waitForTimeout(500);
  const btn = await page.$('button:has-text("Acknowledge"), button:has-text("continue"), button:has-text("Continue")');
  if (btn) { await btn.click(); }
  await page.waitForTimeout(3000);
} catch(e) {}

// Find all buttons and links on page
const allButtons = await page.evaluate(() => {
  const btns = document.querySelectorAll('button, a[href], [role="button"]');
  return Array.from(btns).map(b => ({
    text: b.textContent?.trim()?.substring(0, 60),
    tag: b.tagName,
    href: b.getAttribute('href'),
  })).filter(b => b.text);
});
console.log('All clickable elements:', JSON.stringify(allButtons.slice(0, 40), null, 2));

await browser.close();
