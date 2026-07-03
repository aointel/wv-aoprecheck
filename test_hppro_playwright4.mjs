import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();

console.log('1. Navigating...');
await page.goto('http://localhost:5000/connect', { waitUntil: 'domcontentloaded' });

// Login if needed
if (await page.locator('input[type="email"]').isVisible({ timeout: 5000 }).catch(() => false)) {
  await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
  await page.fill('input[type="password"]', 'aointel2025');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(8000);
}

// Wait for app
console.log('2. Waiting for app...');
await page.waitForTimeout(10000);

// Force-dismiss the startup overlay via React state manipulation
console.log('3. Force-dismissing startup overlay...');
await page.evaluate(() => {
  // Set the sessionStorage flag that marks startup as complete
  sessionStorage.setItem('aoi_startup_complete', 'true');
  // Also try dispatching a custom event
  window.dispatchEvent(new CustomEvent('startup-complete'));
  window.dispatchEvent(new Event('startup-done'));
  
  // Remove the overlay div directly
  const overlays = document.querySelectorAll('.fixed.inset-0');
  overlays.forEach(o => {
    if (o.style.zIndex === '9999' || getComputedStyle(o).zIndex === '9999' || o.className.includes('z-[9999]')) {
      console.log('Removing overlay:', o.className.substring(0,100));
      o.remove();
    }
  });
});

await page.waitForTimeout(2000);

// Reload to apply the sessionStorage flag
console.log('4. Reloading with startup flag set...');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(8000);

await page.screenshot({ path: 'C:/dev/hppro4_1_after_reload.png' });

// Now click Present
console.log('5. Looking for Present button...');
const presentBtn = page.locator('button:has-text("Present")').first();
const isVisible = await presentBtn.isVisible({ timeout: 10000 }).catch(() => false);
console.log('Present button visible:', isVisible);

if (isVisible) {
  await presentBtn.click({ force: true, timeout: 5000 });
  console.log('6. Clicked Present!');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/dev/hppro4_2_overlay.png' });
  
  // Wait for HPPRO
  await page.waitForTimeout(12000);
  await page.screenshot({ path: 'C:/dev/hppro4_3_hppro.png' });
  
  // Check HPPRO iframe
  const hFrame = page.frame({ url: /localhost:5000\/api\/hppro/ });
  if (hFrame) {
    const state = await hFrame.evaluate(() => ({
      url: location.href,
      cookie: document.cookie.substring(0, 150),
      hpprologin: document.cookie.match(/hpprologin=([^;]+)/)?.[1] || null,
      hasLoginForm: !!document.querySelector('input[id="Password"]'),
      title: document.title,
    })).catch(e => ({ error: e.message }));
    console.log('\n=== HPPRO STATE ===');
    console.log(JSON.stringify(state, null, 2));
    if (!state.hasLoginForm && !state.error) {
      console.log('✅ SUCCESS - HPPRO loaded without login form!');
    } else if (state.hasLoginForm) {
      console.log('❌ Still showing login form. hpprologin:', state.hpprologin);
    }
  } else {
    console.log('Frames:', page.frames().map(f => f.url().substring(0, 80)));
  }
} else {
  console.log('Present button not found - taking screenshot');
  await page.screenshot({ path: 'C:/dev/hppro4_error.png', fullPage: true });
  console.log('Buttons on page:');
  const btns = await page.locator('button').allTextContents();
  console.log(btns.slice(0, 20));
}

await browser.close();
