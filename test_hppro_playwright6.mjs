import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 200 });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();

await page.goto('http://localhost:5000/connect', { waitUntil: 'domcontentloaded' });

if (await page.locator('input[type="email"]').isVisible({ timeout: 5000 }).catch(() => false)) {
  await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
  await page.fill('input[type="password"]', 'aointel2025');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(8000);
}

// Set startup complete
await page.evaluate(() => sessionStorage.setItem('aoi_startup_complete', 'true'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(12000);

console.log('Ready. Clicking Present...');
const btn = page.locator('button:has-text("Present")').first();
await btn.click({ force: true });

// Wait briefly and check DOM immediately
await page.waitForTimeout(1000);

// Check if the overlay appeared
const overlays = await page.evaluate(() => {
  const fixed = document.querySelectorAll('[style*="position:fixed"], [style*="position: fixed"]');
  return Array.from(fixed).map(el => ({
    tag: el.tagName,
    style: el.getAttribute('style')?.substring(0, 100),
    class: el.className?.substring(0, 80),
    text: el.innerText?.substring(0, 50)
  }));
});
console.log('Fixed elements after click:', JSON.stringify(overlays.slice(0,5), null, 2));

// Check if iframe appeared
await page.waitForTimeout(2000);
const iframes = await page.evaluate(() => 
  Array.from(document.querySelectorAll('iframe')).map(f => f.src?.substring(0, 80))
);
console.log('iframes:', iframes);

await page.screenshot({ path: 'C:/dev/hppro6_1.png' });
await page.waitForTimeout(8000);
await page.screenshot({ path: 'C:/dev/hppro6_2.png' });

// Final frame check
console.log('Frames:', page.frames().map(f => f.url().substring(0, 80)));

const hFrame = page.frame({ url: /api\/hppro/ });
if (hFrame) {
  const state = await hFrame.evaluate(() => ({
    cookie: document.cookie.substring(0, 200),
    hasLoginForm: !!document.querySelector('input[id="Password"]'),
    hpprologin: document.cookie.match(/hpprologin=([^;]+)/)?.[1] || null,
    url: location.href,
  })).catch(e => ({error: e.message}));
  console.log('\n=== HPPRO ===');
  console.log(JSON.stringify(state, null, 2));
  
  const iframeEl = await page.$('iframe[src*="api/hppro"]');
  if (iframeEl) {
    const box = await iframeEl.boundingBox();
    if (box?.width > 50) await page.screenshot({ path: 'C:/dev/hppro6_iframe.png', clip: box });
  }
}

await browser.close();
