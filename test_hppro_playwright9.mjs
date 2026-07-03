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

// Find the Present button's exact coordinates and click with mouse
const btn = await page.locator('button:has-text("Present")').first();
const box = await btn.boundingBox();
console.log('Present button box:', box);

// Use mouse.click at exact coordinates
await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
console.log('Mouse clicked Present');
await page.waitForTimeout(500);

// Check if ij (presentMode) is now true via React internals
const reactCheck = await page.evaluate(() => {
  // Walk fiber tree to find presentMode state
  const root = document.querySelector('#root');
  if (!root) return null;
  
  const key = Object.keys(root).find(k => k.startsWith('__reactFiber'));
  if (!key) return null;
  
  function walkFiber(fiber, depth = 0) {
    if (!fiber || depth > 50) return null;
    // Check if this fiber has the ij state (presentMode)
    if (fiber.memoizedState) {
      let state = fiber.memoizedState;
      let stateValues = [];
      while (state) {
        stateValues.push(state.memoizedState);
        state = state.next;
      }
      // Look for a fiber with many useState hooks (our component)
      if (stateValues.length > 10) {
        return { stateCount: stateValues.length, states: stateValues.slice(0, 30) };
      }
    }
    return walkFiber(fiber.child, depth + 1) || walkFiber(fiber.sibling, depth + 1);
  }
  
  return walkFiber(root[key]);
});

if (reactCheck) {
  console.log('React states found:', reactCheck.stateCount);
  // Check if any boolean states toggled
  const booleans = reactCheck.states.filter(s => typeof s === 'boolean');
  console.log('Boolean states:', booleans);
} else {
  console.log('Could not read React state');
}

await page.waitForTimeout(2000);

// Check if overlay appeared
const hasOverlay = await page.evaluate(() => {
  const overlay = document.querySelector('div[style*="position:fixed"][style*="inset:0"]') ||
                  document.querySelector('div[style*="position: fixed"]');
  return !!overlay;
});
console.log('Overlay appeared:', hasOverlay);

// Screenshot
await page.screenshot({ path: 'C:/dev/hppro9_clicked.png' });

await page.waitForTimeout(5000);
await page.screenshot({ path: 'C:/dev/hppro9_5s.png' });

console.log('Frames:', page.frames().map(f => f.url().substring(0,60)));

await browser.close();
