import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:\\dev\\AOIrail\\lead-flow-test-screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const EMAIL = 'chrislafond@aoglobelife.com';
const PASS  = 'aointel2025';
const URL   = 'https://aoirail-production.up.railway.app';

let step = 0;
function log(msg) { console.log(`\n[STEP ${++step}] ${msg}`); }

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  slowMo: 400,
  args: ['--start-maximized']
});

const context = await browser.newContext({ viewport: null });
const page = await context.newPage();

// Track ALL relevant network calls
const networkLog = [];
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('assignment-trigger') || url.includes('outbound-dialer/leads') || url.includes('request-leads')) {
    let body = null;
    try { body = await response.json(); } catch {}
    networkLog.push({ url, status: response.status(), body });
    console.log(`\n📡 NETWORK HIT: ${url}`);
    console.log(`   Status: ${response.status()}`);
    console.log(`   Body:`, JSON.stringify(body, null, 2));
  }
});

async function ss(name) {
  const file = path.join(SCREENSHOT_DIR, `${String(step).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`   📸 ${file}`);
}

// ── LOGIN ────────────────────────────────────────────────────────────────────
log('Login');
await page.goto(`${URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2000);
await page.fill('input[type="email"], input[name="email"]', EMAIL);
await page.fill('input[type="password"], input[name="password"]', PASS);
await ss('login');
await page.click('button[type="submit"]');
await page.waitForTimeout(5000);
console.log(`   URL after login: ${page.url()}`);
await ss('after-login');

// ── GO TO CONNECT ────────────────────────────────────────────────────────────
log('Navigate to /connect');
await page.goto(`${URL}/connect`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(5000);
console.log(`   URL: ${page.url()}`);
await ss('connect');

// ── CLICK IGNITE QUEUE ───────────────────────────────────────────────────────
log('Click Ignite Queue button');
const igniteBtn = page.locator('text=Ignite Queue').first();
if (await igniteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
  console.log('   ✅ Found "Ignite Queue" — clicking');
  await igniteBtn.click();
  await ss('after-ignite-click');
} else {
  console.log('   ⚠️ Ignite Queue not visible — checking page');
  const txt = await page.locator('body').innerText().catch(() => '');
  console.log('   Page text (first 800):', txt.substring(0, 800));
  await ss('ignite-not-found');
}

// ── WAIT FOR request-leads + assignment-trigger ──────────────────────────────
log('Waiting 20s for request-leads and assignment-trigger calls');
await page.waitForTimeout(20000);
await ss('after-20s');

// ── WAIT ANOTHER 15s FOR LEADS TO POPULATE ───────────────────────────────────
log('Waiting another 15s for leads to populate in UI');
await page.waitForTimeout(15000);
await ss('after-35s-total');

// ── CHECK UI FOR LEADS ───────────────────────────────────────────────────────
log('Checking for leads in UI');
const pageText = await page.locator('body').innerText().catch(() => '');
// Look for lead count badge
const hasLeads = pageText.includes('/ 50') || pageText.includes('leads');
console.log(`   Has lead indicators: ${hasLeads}`);
// Look for "50 / 50" or similar
const countMatch = pageText.match(/(\d+)\s*\/\s*50/);
if (countMatch) console.log(`   Lead count badge: ${countMatch[0]}`);
await ss('final');

// ── SUMMARY ──────────────────────────────────────────────────────────────────
log('SUMMARY');
console.log('\n====== ALL CAPTURED NETWORK CALLS ======');
if (networkLog.length === 0) {
  console.log('  ❌ NO relevant network calls were captured!');
} else {
  networkLog.forEach((n, i) => {
    console.log(`\n[${i+1}] ${n.url}`);
    console.log(`  Status: ${n.status}`);
    if (n.body?.leads !== undefined) console.log(`  Leads: ${n.body.leads?.length ?? 'n/a'}`);
    if (n.body?.assigned !== undefined) console.log(`  Assigned: ${n.body.assigned}`);
    if (n.body?.needsMoreLeads !== undefined) console.log(`  needsMoreLeads: ${n.body.needsMoreLeads}`);
    if (n.body?.webhookSent !== undefined) console.log(`  webhookSent: ${n.body.webhookSent}`);
    if (n.body?.webhookResponse) console.log(`  webhookResponse:`, JSON.stringify(n.body.webhookResponse));
    if (n.body?.error) console.log(`  ❌ Error: ${n.body.error}`);
  });
}
console.log(`\n📁 Screenshots: ${SCREENSHOT_DIR}`);

await browser.close();
