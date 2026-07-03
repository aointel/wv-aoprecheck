import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 200 });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();

// Capture ALL console messages and errors
const errors = [];
page.on('pageerror', e => { errors.push('PAGE ERROR: ' + e.message); console.log('❌ PAGE ERROR:', e.message); });
page.on('console', msg => {
  if (msg.type() === 'error') errors.push('CONSOLE ERROR: ' + msg.text());
});

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

// Check for errors before clicking
console.log('Errors before click:', errors.length);

const btn = page.locator('button:has-text("Present")').first();
await btn.click({ force: true });
await page.waitForTimeout(2000);

console.log('Errors after click:', errors.length);
errors.forEach(e => console.log(e));

// Try triggering presentMode via React DevTools
const result = await page.evaluate(() => {
  // Find the OutboundDialerInterface component's setState
  // Walk the React fiber tree looking for our component
  function findFibers(element, depth = 0) {
    if (depth > 5 || !element) return null;
    const fiberKey = Object.keys(element).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return null;
    
    let fiber = element[fiberKey];
    while (fiber) {
      if (fiber.memoizedState && fiber.type && fiber.type.name === 'OutboundDialerInterface') {
        return fiber;
      }
      fiber = fiber.child || fiber.sibling || fiber.return;
      if (!fiber) break;
    }
    return null;
  }
  
  // Just check if there's a React error boundary catching errors
  const root = document.querySelector('#root');
  if (!root) return { error: 'no root' };
  
  // Check for any error messages in the DOM
  const errorElements = document.querySelectorAll('[data-error], .error-boundary, [class*="error"]');
  return {
    errorElements: Array.from(errorElements).map(e => e.textContent?.substring(0, 100)),
    hasRoot: !!root,
    rootChildren: root.children.length
  };
});
console.log('React check:', JSON.stringify(result, null, 2));

// Screenshot
await page.screenshot({ path: 'C:/dev/hppro8_after.png' });

// The issue might be: the overlay IS rendering but with display:none or opacity 0
// Let's check all divs with fixed positioning
const fixedDivs = await page.evaluate(() => {
  const all = document.querySelectorAll('div');
  return Array.from(all).filter(d => {
    const s = window.getComputedStyle(d);
    return s.position === 'fixed' && parseInt(s.zIndex) > 100;
  }).map(d => ({
    id: d.id,
    class: d.className?.substring(0, 60),
    style: d.getAttribute('style')?.substring(0, 100),
    zIndex: window.getComputedStyle(d).zIndex,
    display: window.getComputedStyle(d).display,
    opacity: window.getComputedStyle(d).opacity,
    children: d.children.length
  }));
});
console.log('\nFixed divs with zIndex > 100:', JSON.stringify(fixedDivs, null, 2));

await browser.close();
