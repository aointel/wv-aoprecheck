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

// Click Present
const btn = await page.locator('button:has-text("Present")').first();
await btn.click({ force: true });
await page.waitForTimeout(2000);

// Deep DOM scan - find ALL divs with position fixed
const scan = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll('*').forEach(el => {
    const cs = window.getComputedStyle(el);
    if (cs.position === 'fixed') {
      results.push({
        tag: el.tagName,
        id: el.id?.substring(0, 20),
        class: el.className?.substring(0, 80),
        style: (el.getAttribute('style') || '').substring(0, 100),
        computedZ: cs.zIndex,
        display: cs.display,
        opacity: cs.opacity,
        w: cs.width,
        h: cs.height,
        visible: cs.display !== 'none' && cs.visibility !== 'hidden',
        textSnippet: el.textContent?.substring(0, 50).trim()
      });
    }
  });
  return results;
});

console.log(`Found ${scan.length} fixed-position elements:`);
scan.forEach(el => console.log(JSON.stringify(el)));

// Full page screenshot
await page.screenshot({ path: 'C:/dev/hpproA_full.png', fullPage: true });

// Check if the overlay div exists but might have opacity 0 or is behind something
const overlayEl = await page.evaluate(() => {
  // Try to find element with inset:0 in style
  const all = document.querySelectorAll('div[style]');
  for (const div of all) {
    const s = div.getAttribute('style') || '';
    if ((s.includes('inset:0') || s.includes('inset: 0')) && s.includes('fixed')) {
      return {
        found: true,
        style: s,
        innerHTML: div.innerHTML.substring(0, 200),
        zIndex: window.getComputedStyle(div).zIndex,
        display: window.getComputedStyle(div).display
      };
    }
  }
  return { found: false };
});
console.log('\nOverlay element with inset:0:', JSON.stringify(overlayEl, null, 2));

await browser.close();
