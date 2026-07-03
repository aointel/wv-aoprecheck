import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();

// Track ALL network requests
const requests = [];
page.on('request', req => {
  if (req.url().includes('hppro') || req.url().includes('hppro-impact')) {
    requests.push({ method: req.method(), url: req.url() });
    console.log('🔥 HPPRO request:', req.method(), req.url().substring(0, 100));
  }
});

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

// Fire the event
console.log('Firing aoi-present-open...');
await page.evaluate(() => window.dispatchEvent(new CustomEvent('aoi-present-open')));

// Wait and watch for HPPRO requests
await page.waitForTimeout(15000);

console.log('\nHPPRO requests made:', requests.length);
requests.forEach(r => console.log(' ', r.method, r.url.substring(0, 80)));

// Check overlay state
const state = await page.evaluate(() => {
  const overlay = document.getElementById('aoi-present-overlay');
  const iframe = overlay?.querySelector('iframe');
  return {
    overlayDisplay: overlay?.style.display,
    iframeSrc: iframe?.src,
    iframeLoaded: iframe?.contentDocument?.readyState,
    iframeTitle: (() => { try { return iframe?.contentDocument?.title; } catch(e) { return 'cross-origin'; } })()
  };
});
console.log('\nFinal state:', JSON.stringify(state, null, 2));

await page.screenshot({ path: 'C:/dev/hppro_final.png' });
await browser.close();
