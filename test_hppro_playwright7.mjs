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
await page.evaluate(() => sessionStorage.setItem('aoi_startup_complete', 'true'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(12000);

const btn = page.locator('button:has-text("Present")').first();
await btn.click({ force: true });
await page.waitForTimeout(3000);

// Check what's actually in the DOM - look for the overlay
const domCheck = await page.evaluate(() => {
  // Look for HPPRO-related elements
  const allElements = document.querySelectorAll('*');
  const hpproElements = [];
  allElements.forEach(el => {
    const txt = el.textContent || '';
    const style = el.getAttribute('style') || '';
    if (txt.includes('HPPRO') || style.includes('fixed') || el.tagName === 'IFRAME') {
      hpproElements.push({
        tag: el.tagName,
        id: el.id,
        class: el.className?.substring(0, 60),
        style: style.substring(0, 80),
        text: txt.substring(0, 40),
        zIndex: getComputedStyle(el).zIndex,
        display: getComputedStyle(el).display,
        visible: el.offsetParent !== null || el.tagName === 'BODY',
      });
    }
  });
  return hpproElements.slice(0, 20);
});

console.log('DOM elements with HPPRO/fixed/iframe:');
domCheck.forEach(el => console.log(JSON.stringify(el)));

// More specific: look for the overlay div with position:fixed and high zIndex
const overlayCheck = await page.evaluate(() => {
  const overlay = document.querySelector('[style*="position:fixed"][style*="inset:0"]') || 
                  document.querySelector('[style*="position: fixed"][style*="inset: 0"]');
  return overlay ? {
    found: true,
    style: overlay.getAttribute('style')?.substring(0, 200),
    children: overlay.children.length,
    visible: overlay.offsetParent !== null,
    innerHTML: overlay.innerHTML?.substring(0, 300)
  } : { found: false };
});
console.log('\nFixed overlay check:', JSON.stringify(overlayCheck, null, 2));

// Check React fiber for state
const reactState = await page.evaluate(() => {
  // Find any React root
  const root = document.getElementById('root') || document.querySelector('[data-reactroot]');
  if (!root) return { error: 'no root' };
  
  // Try to access React internals via fiber
  const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber') || k.startsWith('_reactRootContainer'));
  return { fiberKey, hasRoot: !!root };
});
console.log('\nReact root:', JSON.stringify(reactState));

await page.screenshot({ path: 'C:/dev/hppro7_after_click.png', fullPage: true });
await browser.close();
