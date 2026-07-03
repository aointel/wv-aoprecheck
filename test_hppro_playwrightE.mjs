import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
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
await page.waitForTimeout(1000);

// Inspect the overlay DOM
const domInfo = await page.evaluate(() => {
  const overlay = document.getElementById('aoi-present-overlay');
  if (!overlay) return { error: 'no overlay' };
  
  const iframes = overlay.querySelectorAll('iframe');
  const iframeInfo = Array.from(iframes).map(f => ({
    src: f.src,
    width: f.offsetWidth,
    height: f.offsetHeight,
    style: f.getAttribute('style') || f.style.cssText
  }));
  
  return {
    display: overlay.style.display,
    dimensions: { w: overlay.offsetWidth, h: overlay.offsetHeight },
    childCount: overlay.children.length,
    innerHTML_preview: overlay.innerHTML.substring(0, 400),
    iframes: iframeInfo
  };
});

console.log('Overlay DOM:', JSON.stringify(domInfo, null, 2));

// Wait for HPPRO to start loading
await page.waitForTimeout(3000);

// Check server requests in proxy log
const serverLogs = await page.evaluate(() => {
  // Check if any fetch to /api/hppro happened
  return window._hpproRequestsMade || 'not tracked';
});

// Take screenshot
await page.screenshot({ path: 'C:/dev/hpproE_1.png', fullPage: false });
await page.waitForTimeout(8000);
await page.screenshot({ path: 'C:/dev/hpproE_2.png', fullPage: false });

// Check for frames now
const frames = page.frames();
const hpproFrames = frames.filter(f => f.url().includes('hppro') || f.url().includes('localhost:5000/api'));
console.log('HPPRO frames:', hpproFrames.map(f => f.url()));

// Get iframe src that's inside overlay
const iframeSrc = await page.evaluate(() => {
  const overlay = document.getElementById('aoi-present-overlay');
  const iframe = overlay?.querySelector('iframe');
  return iframe ? { src: iframe.src, contentDoc: iframe.contentDocument?.title || 'no access' } : null;
});
console.log('Iframe src:', iframeSrc);

await browser.close();
