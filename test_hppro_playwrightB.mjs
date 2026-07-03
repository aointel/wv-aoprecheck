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

// Click Present - standard click
const btn = await page.locator('button:has-text("Present")').first();
await btn.click({ force: true });
await page.waitForTimeout(1000);

// Check the EXACT React state of presentMode after clicking
const state = await page.evaluate(() => {
  // Find OutboundDialerInterface fiber and check its state
  const root = document.getElementById('root');
  if (!root) return null;
  
  const fKey = Object.keys(root).find(k => k.startsWith('__reactFiber'));
  if (!fKey) return null;
  
  // Walk to find a fiber with useState([...]) that has oj
  let fiber = root[fKey];
  const found = [];
  const visited = new Set();
  
  function walk(f, depth) {
    if (!f || depth > 100 || visited.has(f)) return;
    visited.add(f);
    
    if (f.memoizedState) {
      let state = f.memoizedState;
      const vals = [];
      while (state && vals.length < 50) {
        vals.push(state.memoizedState);
        state = state.next;
      }
      // Look for component with 40+ states (OutboundDialerInterface is huge)
      if (vals.length >= 30) {
        found.push({ count: vals.length, vals: vals.slice(0, 40) });
      }
    }
    walk(f.child, depth + 1);
    walk(f.sibling, depth + 1);
  }
  
  walk(fiber, 0);
  
  // Find the one with the most states (likely OutboundDialerInterface)
  const biggest = found.sort((a,b) => b.count - a.count)[0];
  if (!biggest) return { error: 'no component found', foundCount: found.length };
  
  return {
    stateCount: biggest.count,
    booleans: biggest.vals.map((v, i) => ({ i, type: typeof v, val: v })).filter(x => x.type === 'boolean'),
    // Check index of presentMode - it should be one of the early booleans
    allVals: biggest.vals.slice(0, 20)
  };
});

console.log('React state after Present click:', JSON.stringify(state, null, 2));

// Take screenshot
await page.screenshot({ path: 'C:/dev/hpproB_1.png' });

// Wait and check again
await page.waitForTimeout(3000);
const hasFixedOverlay = await page.evaluate(() => 
  !!document.querySelector('div[style*="inset:0"]') || 
  !!document.querySelector('div[style*="inset: 0"]') ||
  document.querySelectorAll('div').length > 0 && Array.from(document.querySelectorAll('div')).some(d => {
    const s = d.getAttribute('style') || '';
    return s.includes('fixed') && s.includes('inset');
  })
);
console.log('Has fixed overlay:', hasFixedOverlay);

await page.screenshot({ path: 'C:/dev/hpproB_2.png' });
await browser.close();
