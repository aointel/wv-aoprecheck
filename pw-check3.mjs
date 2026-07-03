import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Login
await page.goto('https://aoirail-production.up.railway.app/login');
await page.waitForLoadState('networkidle');
await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
await page.fill('input[type="password"]', 'aointel2025');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

// Go to connect
await page.goto('https://aoirail-production.up.railway.app/dashboard/connect');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(4000);

// Acknowledge init screen
try {
  const checkbox = await page.$('input[type="checkbox"]');
  if (checkbox) { await checkbox.check(); }
  await page.waitForTimeout(500);
  const btn = await page.$('button:has-text("Acknowledge"), button:has-text("continue"), button:has-text("Continue")');
  if (btn) { await btn.click(); console.log('Clicked through init'); }
  await page.waitForTimeout(3000);
} catch(e) { console.log('No init screen'); }

await page.screenshot({ path: 'C:/dev/ss5.png', fullPage: true });
console.log('After init screenshot saved');

// Now click through the product card - find "Call Connector Pro" or "Outbound" button
try {
  // Try clicking the outbound/CCP card or button
  const ccpBtn = await page.$('button:has-text("Call Connector"), button:has-text("Outbound"), button:has-text("Power On"), button:has-text("Launch"), a:has-text("Call Connector")');
  if (ccpBtn) { 
    console.log('Found CCP button, clicking...');
    await ccpBtn.click(); 
    await page.waitForTimeout(4000);
  } else {
    // Click any card that says Outbound
    const cards = await page.$$('text=Outbound — Call Connector Pro');
    if (cards.length > 0) {
      console.log('Found CCP card text');
      await cards[0].click();
      await page.waitForTimeout(3000);
    }
  }
} catch(e) { console.log('Card click error:', e.message); }

await page.screenshot({ path: 'C:/dev/ss6.png', fullPage: true });
console.log('After card click screenshot saved');

// Look for AO Queue / lead count
const bodyText = await page.evaluate(() => document.body.innerText);
const queueMatch = bodyText.match(/(\d+)\s*(leads|pending|AO\s*Que|queue)/gi);
console.log('Queue numbers found:', queueMatch?.slice(0, 10));

await browser.close();
