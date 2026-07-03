import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 500 });
const context = await browser.newContext();
const page = await context.newPage();

// Collect console messages from all frames
const consoleLogs = [];
page.on('console', msg => consoleLogs.push(`[MAIN] ${msg.text()}`));

console.log('1. Navigating to localhost:5000/connect...');
await page.goto('http://localhost:5000/connect', { waitUntil: 'networkidle' });

// Login if needed
const loginInput = page.locator('input[type="email"]');
if (await loginInput.isVisible({ timeout: 3000 }).catch(() => false)) {
  console.log('2. Logging in...');
  await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
  await page.fill('input[type="password"]', 'aointel2025');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
}

await page.screenshot({ path: 'C:/dev/hppro_test_1_loaded.png' });
console.log('3. Page loaded. Dismissing any startup overlays...');

// Dismiss startup overlay if present (StartupSequence / diagnostics modal)
await page.waitForTimeout(3000);
const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Let\'s Go"), button:has-text("Dismiss"), button:has-text("Skip"), button:has-text("Got it")').first();
if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await continueBtn.click({ force: true });
  await page.waitForTimeout(1000);
}

// Try pressing Escape to close any modal
await page.keyboard.press('Escape');
await page.waitForTimeout(1000);

// Click anywhere on the overlay background to dismiss
const overlay = page.locator('.fixed.inset-0').first();
if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
  await overlay.click({ position: { x: 10, y: 10 }, force: true });
  await page.waitForTimeout(1000);
}

await page.screenshot({ path: 'C:/dev/hppro_test_1b_overlay_dismissed.png' });
console.log('4. Looking for Present button...');

// Click Present button using force click to bypass overlays
const presentBtn = page.locator('button:has-text("Present")').first();
await presentBtn.waitFor({ timeout: 10000 });
await presentBtn.click({ force: true });
console.log('4. Clicked Present button');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'C:/dev/hppro_test_2_present_clicked.png' });

// Wait for HPPRO iframe
console.log('5. Waiting for HPPRO iframe...');
const hpproFrame = page.frameLocator('iframe[src*="hppro"]').first();

// Check what's inside the iframe after 8 seconds
await page.waitForTimeout(8000);
await page.screenshot({ path: 'C:/dev/hppro_test_3_after_wait.png' });

// Check if login page or StartPresentation
const iframes = await page.locator('iframe').all();
console.log(`Found ${iframes.length} iframes`);

for (const iframe of iframes) {
  const src = await iframe.getAttribute('src');
  console.log('iframe src:', src);
}

// Try to access the HPPRO iframe content
try {
  const hpproIframe = page.frame({ url: /localhost:5000\/api\/hppro/ });
  if (hpproIframe) {
    const title = await hpproIframe.title();
    const url = hpproIframe.url();
    console.log('HPPRO iframe URL:', url);
    console.log('HPPRO iframe title:', title);
    
    // Check for login form
    const hasLoginForm = await hpproIframe.locator('input[name="Password"]').isVisible().catch(() => false);
    const hasStartPresentation = await hpproIframe.locator('text=StartPresentation').isVisible().catch(() => false);
    const bodyText = await hpproIframe.locator('body').innerText().catch(() => 'no body');
    
    console.log('Has login form:', hasLoginForm);
    console.log('Has StartPresentation:', hasStartPresentation);
    console.log('Cookie logs:');
    
    // Check localStorage and cookies in iframe
    const cookieResult = await hpproIframe.evaluate(() => {
      const cookies = document.cookie;
      const user = localStorage.getItem('user');
      const hpprologin = cookies.split(';').find(c => c.trim().startsWith('hpprologin='));
      return { cookies, hpprologin, hasUser: !!user, userPreview: user?.substring(0,100) };
    }).catch(e => ({ error: e.message }));
    
    console.log('HPPRO iframe state:', JSON.stringify(cookieResult, null, 2));
    console.log('Body preview:', bodyText.substring(0, 300));
  } else {
    console.log('Could not access HPPRO iframe (cross-origin or not found)');
  }
} catch(e) {
  console.log('Iframe access error:', e.message);
}

// Final screenshot
await page.screenshot({ path: 'C:/dev/hppro_test_4_final.png', fullPage: false });

// Print all console logs
console.log('\n=== CONSOLE LOGS ===');
consoleLogs.slice(-30).forEach(l => console.log(l));

await browser.close();
console.log('\nScreenshots saved to C:/dev/hppro_test_*.png');
