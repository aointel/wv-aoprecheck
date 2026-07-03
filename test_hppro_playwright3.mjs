import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 500 });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();

// Log all console messages
page.on('console', m => {
  if (m.type() !== 'log') return;
  const t = m.text();
  if (t.includes('aillogincookie') || t.includes('navigateTo') || t.includes('NavigatePage') || t.includes('StartPresentation') || t.includes('isloggedin')) {
    console.log('[HPPRO]', t.substring(0, 200));
  }
});

console.log('1. Navigating to AOI...');
await page.goto('http://localhost:5000/connect', { waitUntil: 'domcontentloaded' });

// Check if login page
const isLoginPage = await page.locator('input[name="email"], input[type="email"]').isVisible({ timeout: 5000 }).catch(() => false);
if (isLoginPage) {
  console.log('2. Logging in...');
  await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
  await page.fill('input[type="password"]', 'aointel2025');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/connect**', { timeout: 15000 }).catch(() => {});
}

// Wait for AOI Connect page to fully load
console.log('3. Waiting for Connect page...');
await page.waitForSelector('button:has-text("Present")', { timeout: 30000 });
await page.waitForTimeout(3000); // Extra time for startup overlay to clear

// Dismiss startup diagnostic overlay if present
const diagOverlay = page.locator('.fixed.inset-0.z-\\[9999\\]').first();
if (await diagOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
  console.log('   Dismissing startup overlay...');
  // Click the "Continue" or complete the diagnostics
  const completeBtn = page.locator('button:has-text("Continue"), button:has-text("Complete")').first();
  if (await completeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await completeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(2000);
}

await page.screenshot({ path: 'C:/dev/hppro3_1_ready.png' });
console.log('4. Ready - clicking Present button...');

// Click Present button
const presentBtn = page.locator('button:has-text("Present")').first();
await presentBtn.scrollIntoViewIfNeeded();
await presentBtn.click({ timeout: 10000 });
console.log('   Clicked!');
await page.waitForTimeout(3000);

await page.screenshot({ path: 'C:/dev/hppro3_2_overlay_open.png' });

// Wait for HPPRO to load
console.log('5. Waiting 12s for HPPRO to load...');
await page.waitForTimeout(12000);

await page.screenshot({ path: 'C:/dev/hppro3_3_loaded.png' });

// Screenshot the HPPRO iframe specifically
const hpproIframe = await page.$('iframe[src*="api/hppro"]');
if (hpproIframe) {
  const box = await hpproIframe.boundingBox();
  console.log('HPPRO iframe box:', box);
  if (box && box.width > 50 && box.height > 50) {
    await page.screenshot({ path: 'C:/dev/hppro3_4_iframe.png', clip: box });
    console.log('   iframe screenshot saved');
  }
}

// Try to read HPPRO frame state
const hFrame = page.frame({ url: /localhost:5000\/api\/hppro/ });
if (hFrame) {
  const state = await hFrame.evaluate(() => ({
    url: location.href,
    title: document.title,
    cookie: document.cookie.substring(0, 200),
    hpprologin: document.cookie.match(/hpprologin=([^;]+)/)?.[1] || null,
    hasLoginForm: !!document.querySelector('input[name="Password"], input[id="Password"]'),
    hasStartPresentation: location.hash.includes('StartPresentation'),
    bodyText: (document.querySelector('h1,h2,.title,.page-title')?.innerText || document.title || '').substring(0,100)
  })).catch(e => ({ error: e.message }));
  console.log('\n=== HPPRO IFRAME STATE ===');
  console.log(JSON.stringify(state, null, 2));
  
  if (state.hasLoginForm) {
    console.log('\n❌ STILL SHOWING LOGIN FORM');
    console.log('hpprologin cookie:', state.hpprologin);
  } else {
    console.log('\n✅ NOT SHOWING LOGIN FORM - HPPRO MAY BE LOADED!');
  }
} else {
  console.log('Could not find HPPRO frame by URL');
  console.log('Available frames:', page.frames().map(f => f.url()));
}

await browser.close();
