import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 500 });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();

// Catch console from iframes too
page.on('frameattached', frame => {
  frame.on('console', msg => {
    if (frame.url().includes('hppro') || frame.url().includes('localhost')) {
      const t = msg.text();
      if (t.includes('ail') || t.includes('login') || t.includes('Navigate') || t.includes('proxy')) {
        console.log(`[${frame.url().substring(0,40)}] ${t.substring(0,150)}`);
      }
    }
  });
});

console.log('1. Navigating...');
await page.goto('http://localhost:5000/connect', { waitUntil: 'domcontentloaded' });

if (await page.locator('input[type="email"]').isVisible({ timeout: 5000 }).catch(() => false)) {
  await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
  await page.fill('input[type="password"]', 'aointel2025');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(8000);
}

// Set startup complete and reload
await page.evaluate(() => sessionStorage.setItem('aoi_startup_complete', 'true'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(10000);

console.log('2. Looking for Present button...');
// Find all buttons with "Present" text
const presentBtns = await page.locator('button:has-text("Present")').all();
console.log('Present buttons found:', presentBtns.length);

for (let i = 0; i < presentBtns.length; i++) {
  const txt = await presentBtns[i].textContent();
  const visible = await presentBtns[i].isVisible();
  const box = await presentBtns[i].boundingBox();
  console.log(`  btn[${i}]: "${txt}" visible=${visible} box=${JSON.stringify(box)}`);
}

// Click the first one with force
const btn = page.locator('button:has-text("Present")').first();
await btn.click({ force: true });
console.log('3. Clicked Present (force)');
await page.waitForTimeout(2000);

// Check if presentMode is true now
const overlayVisible = await page.locator('.fixed.inset-0').filter({ hasText: 'HPPRO' }).isVisible({ timeout: 3000 }).catch(() => false);
console.log('HPPRO overlay visible:', overlayVisible);

// Check frames
const frames = page.frames();
console.log('Frames after click:', frames.map(f => f.url().substring(0, 60)));

await page.screenshot({ path: 'C:/dev/hppro5_after_click.png' });

// Wait and check again
await page.waitForTimeout(8000);
const framesAfter = page.frames();
console.log('Frames after 8s:', framesAfter.map(f => f.url().substring(0, 80)));
await page.screenshot({ path: 'C:/dev/hppro5_after_8s.png' });

// Find HPPRO frame
const hpproFrame = framesAfter.find(f => f.url().includes('api/hppro'));
if (hpproFrame) {
  console.log('\n✅ HPPRO FRAME FOUND:', hpproFrame.url());
  const state = await hpproFrame.evaluate(() => ({
    url: location.href,
    hpprologin: document.cookie.match(/hpprologin=([^;]+)/)?.[1] || null,
    hasLoginForm: !!document.querySelector('input[id="Password"]'),
    title: document.title,
    hash: location.hash,
  })).catch(e => ({ error: e.message }));
  console.log('State:', JSON.stringify(state, null, 2));
  
  if (state.hasLoginForm) {
    console.log('❌ STILL LOGIN FORM. hpprologin cookie:', state.hpprologin);
  } else {
    console.log('✅ NO LOGIN FORM! HPPRO IS WORKING!');
  }
  
  // Take screenshot of HPPRO iframe
  const iframeEl = await page.$('iframe[src*="api/hppro"]');
  if (iframeEl) {
    const box = await iframeEl.boundingBox();
    if (box) await page.screenshot({ path: 'C:/dev/hppro5_iframe.png', clip: box });
  }
} else {
  console.log('❌ No HPPRO frame found');
}

await browser.close();
