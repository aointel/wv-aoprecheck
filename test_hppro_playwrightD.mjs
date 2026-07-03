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

// Just dispatch the event directly - bypass button click entirely
console.log('Dispatching aoi-present-open event directly...');
await page.evaluate(() => window.dispatchEvent(new CustomEvent('aoi-present-open')));
await page.waitForTimeout(3000);

const overlayState = await page.evaluate(() => {
  const el = document.getElementById('aoi-present-overlay');
  return el ? { display: el.style.display, iframes: el.querySelectorAll('iframe').length, w: el.offsetWidth, h: el.offsetHeight } : null;
});
console.log('Overlay state:', overlayState);

await page.screenshot({ path: 'C:/dev/hpproD_1.png' });
console.log('Waiting 10s for HPPRO to load...');
await page.waitForTimeout(10000);
await page.screenshot({ path: 'C:/dev/hpproD_2.png' });

// Check HPPRO iframe
const frames = page.frames();
console.log('All frames:', frames.map(f => f.url().substring(0, 70)));

const hFrame = frames.find(f => f.url().includes('api/hppro'));
if (hFrame) {
  console.log('✅ HPPRO frame found:', hFrame.url());
  const state = await hFrame.evaluate(() => ({
    hpprologin: document.cookie.match(/hpprologin=([^;]+)/)?.[1] || null,
    hasLoginForm: !!document.querySelector('input[id="Password"]'),
    userid: new URLSearchParams(document.cookie.match(/hpprologin=([^;]+)/)?.[1] || '').get('userid'),
    title: document.title,
    hash: location.hash,
  })).catch(e => ({error: e.message}));
  console.log('HPPRO state:', JSON.stringify(state, null, 2));
  
  if (state.userid === '231' && !state.hasLoginForm) {
    console.log('\n✅✅✅ HPPRO LOADED AND LOGGED IN! No login form!');
  } else if (state.hasLoginForm) {
    console.log('\n❌ Login form present. userid in cookie:', state.userid, '(need 231)');
  }
  
  // Screenshot the iframe
  const iframeEl = await page.$('iframe[src*="api/hppro"]');
  if (iframeEl) {
    const box = await iframeEl.boundingBox();
    if (box?.width > 100) await page.screenshot({ path: 'C:/dev/hpproD_iframe.png', clip: box });
  }
} else {
  console.log('No HPPRO frame found in:', frames.map(f => f.url().substring(0,50)));
}

await browser.close();
