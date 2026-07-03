import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();

// Listen for the custom event
await page.addInitScript(() => {
  window.__aoiPresentFired = false;
  window.addEventListener('aoi-present-open', () => { 
    window.__aoiPresentFired = true; 
    console.log('aoi-present-open event fired!');
  });
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

const btn = await page.locator('button:has-text("Present")').first();
await btn.click({ force: true });
await page.waitForTimeout(2000);

const eventFired = await page.evaluate(() => window.__aoiPresentFired);
console.log('aoi-present-open event fired:', eventFired);

const overlayState = await page.evaluate(() => {
  const el = document.getElementById('aoi-present-overlay');
  return el ? { display: el.style.display, innerHTML: el.innerHTML.length } : null;
});
console.log('Overlay state:', overlayState);

// If event not fired, dispatch it manually to test the overlay
if (!eventFired) {
  console.log('Manually dispatching event...');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('aoi-present-open')));
  await page.waitForTimeout(2000);
  
  const overlayAfter = await page.evaluate(() => {
    const el = document.getElementById('aoi-present-overlay');
    return el ? { display: el.style.display, innerHTML: el.innerHTML.length, frames: document.querySelectorAll('iframe').length } : null;
  });
  console.log('Overlay after manual dispatch:', overlayAfter);
}

await page.screenshot({ path: 'C:/dev/hpproC_1.png' });
await page.waitForTimeout(8000);
await page.screenshot({ path: 'C:/dev/hpproC_2.png' });

// Check HPPRO frame
const hFrame = page.frame({ url: /api\/hppro/ });
if (hFrame) {
  const state = await hFrame.evaluate(() => ({
    cookie: document.cookie.substring(0, 150),
    hpprologin: document.cookie.match(/hpprologin=([^;]+)/)?.[1] || null,
    hasLoginForm: !!document.querySelector('input[id="Password"]'),
    url: location.href,
    userid_in_cookie: new URLSearchParams(document.cookie.match(/hpprologin=([^;]+)/)?.[1] || '').get('userid')
  })).catch(e => ({error: e.message}));
  console.log('\n=== HPPRO STATE ===');
  console.log(JSON.stringify(state, null, 2));
  if (!state.hasLoginForm && !state.error) console.log('✅ HPPRO WORKING - NO LOGIN FORM!');
  else if (state.hasLoginForm) console.log('❌ Still login form. userid_in_cookie:', state.userid_in_cookie, 'expected: 231');
} else {
  console.log('No HPPRO frame yet');
}

await browser.close();
