import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();

console.log('1. Navigating...');
await page.goto('http://localhost:5000/connect', { waitUntil: 'networkidle' });

// Login
const emailInput = page.locator('input[type="email"]');
if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
  await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
  await page.fill('input[type="password"]', 'aointel2025');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
}

// Wait for app to fully load
await page.waitForTimeout(8000);
console.log('2. App loaded');
await page.screenshot({ path: 'C:/dev/hppro2_1_loaded.png' });

// Force click Present button (bypass any overlay)
console.log('3. Clicking Present...');
await page.evaluate(() => {
  // Find and click the Present button directly via JS
  const buttons = Array.from(document.querySelectorAll('button'));
  const present = buttons.find(b => b.textContent.includes('Present'));
  if (present) { present.click(); console.log('Clicked Present via JS'); }
  else console.log('Present button not found');
});

await page.waitForTimeout(3000);
console.log('4. Overlay should be open');
await page.screenshot({ path: 'C:/dev/hppro2_2_overlay.png', fullPage: false });

// Wait for HPPRO to load
await page.waitForTimeout(10000);
console.log('5. After 10s wait');
await page.screenshot({ path: 'C:/dev/hppro2_3_hppro_loaded.png', fullPage: false });

// Try to access the HPPRO iframe
const hpproFrameElement = await page.$('iframe[src*="api/hppro"]');
if (hpproFrameElement) {
  const boundingBox = await hpproFrameElement.boundingBox();
  console.log('HPPRO iframe bounding box:', boundingBox);
  
  // Screenshot just the iframe area
  if (boundingBox) {
    await page.screenshot({ 
      path: 'C:/dev/hppro2_4_iframe_area.png',
      clip: boundingBox
    });
    console.log('HPPRO iframe screenshot saved');
  }
}

// Check what's in the HPPRO iframe via JS injection
const hpproFrame = page.frame({ url: /localhost:5000\/api\/hppro/ });
if (hpproFrame) {
  console.log('HPPRO frame URL:', hpproFrame.url());
  const logs = await hpproFrame.evaluate(() => {
    return {
      cookie: document.cookie,
      hpprologin: document.cookie.includes('hpprologin'),
      url: location.href,
      title: document.title,
      hasLoginForm: !!document.querySelector('input[name="Password"]'),
      bodySnippet: document.body?.innerText?.substring(0, 200) || 'no body'
    };
  }).catch(e => ({ error: e.message }));
  console.log('HPPRO frame state:', JSON.stringify(logs, null, 2));
}

await browser.close();
console.log('Done - screenshots at C:/dev/hppro2_*.png');
