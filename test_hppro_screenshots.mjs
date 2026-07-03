import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();

await page.goto('http://localhost:5000/connect', { waitUntil: 'domcontentloaded' });
if (await page.locator('input[type="email"]').isVisible({ timeout: 5000 }).catch(() => false)) {
  await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
  await page.fill('input[type="password"]', 'aointel2025');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(8000);
}
await page.evaluate(() => sessionStorage.setItem('aoi_startup_complete', 'true'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(12000);

await page.evaluate(() => window.dispatchEvent(new CustomEvent('aoi-present-open')));

// Take screenshots at multiple points
for (let i = 0; i <= 20; i++) {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `C:/dev/hppro_ss_${String(i).padStart(2,'0')}.png` });
  console.log(`Screenshot ${i} taken`);
}

await browser.close();
