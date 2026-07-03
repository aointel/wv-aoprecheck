import { chromium } from 'playwright';
import fs from 'fs';

const consoleMessages = [];
const networkErrors = [];
const badResponses = [];

const SCREENSHOT_DIR = 'C:/dev/AOIrail/tmp-audit-screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ss = (name) => `${SCREENSHOT_DIR}/${name}.png`;
function log(msg) { console.log(`\n${msg}`); }

const browser = await chromium.launch({ headless: false, slowMo: 300, args: ['--start-maximized'] });
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();

page.on('console', msg => {
  const entry = { type: msg.type(), text: msg.text(), location: msg.location() };
  consoleMessages.push(entry);
  if (msg.type() === 'error' || msg.type() === 'warning') {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()} (${JSON.stringify(msg.location())})`);
  }
});

page.on('requestfailed', req => {
  const entry = { url: req.url(), method: req.method(), failure: req.failure() };
  networkErrors.push(entry);
  console.log(`[REQUEST FAILED] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
});

page.on('response', async res => {
  if (res.status() >= 400) {
    let body = '';
    try { body = await res.text(); } catch(e) {}
    const entry = { url: res.url(), status: res.status(), statusText: res.statusText(), body: body.substring(0, 500) };
    badResponses.push(entry);
    console.log(`[HTTP ERROR] ${res.status()} ${res.url()}`);
    if (body) console.log(`  Body: ${body.substring(0, 500)}`);
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
log('[STEP 1] Navigate + Login');
await page.goto('https://aoirail-production.up.railway.app', { waitUntil: 'networkidle' });
await page.waitForSelector('input[type="email"]', { timeout: 10000 });
await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
await page.fill('input[type="password"]', 'aointel2025');
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
console.log('URL after login:', page.url());
await page.screenshot({ path: ss('01-after-login') });

// ─── Dismiss "Got it" onboarding dialog ──────────────────────────────────────
log('[STEP 2] Dismiss onboarding dialog if present');
try {
  await page.waitForSelector('button:has-text("Got it")', { timeout: 3000 });
  await page.click('button:has-text("Got it")');
  await page.waitForTimeout(1500);
  console.log('  Dismissed "Got it" dialog');
} catch(e) { console.log('  No "Got it" dialog'); }

// ─── Click "Ignite Queue" (the real queue request button) ────────────────────
log('[STEP 3] Click "Ignite Queue" to request leads');
await page.screenshot({ path: ss('02-before-ignite') });
try {
  const igniteBtn = await page.waitForSelector('button:has-text("Ignite Queue")', { timeout: 5000 });
  if (igniteBtn) {
    const prevBad = badResponses.length;
    const prevNet = networkErrors.length;
    await igniteBtn.dispatchEvent('click');
    await page.waitForTimeout(5000);
    console.log(`  New HTTP errors after Ignite: ${badResponses.length - prevBad}`);
    console.log(`  New network failures after Ignite: ${networkErrors.length - prevNet}`);
    await page.screenshot({ path: ss('03-after-ignite') });
  }
} catch(e) {
  console.log('  [WARN] Ignite Queue not found:', e.message);
}

// ─── Dismiss the "System Diagnostics" overlay if it appeared ─────────────────
log('[STEP 4] Dismiss System Diagnostics overlay if present');
await page.waitForTimeout(2000);

// Look for the overlay text to confirm it appeared
const overlayPresent = await page.$('text=System Diagnostics');
if (overlayPresent) {
  console.log('  System Diagnostics overlay is present');
  const overlayText = await page.evaluate(() => {
    const el = document.querySelector('[class*="fixed"]');
    return el ? el.innerText?.substring(0, 800) : 'not found';
  });
  console.log('  Overlay content:\n', overlayText);
  await page.screenshot({ path: ss('04-system-diagnostics') });

  // Try pressing Escape or clicking Close
  const closeBtn = await page.$('button:has-text("Close")');
  if (closeBtn) {
    await closeBtn.dispatchEvent('click');
    await page.waitForTimeout(2000);
    console.log('  Closed overlay via Close button');
  } else {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    console.log('  Tried Escape');
  }
} else {
  console.log('  No System Diagnostics overlay');
}
await page.screenshot({ path: ss('05-after-overlay') });

// ─── Capture what's in the connect page now ───────────────────────────────────
log('[STEP 5] Capture full page state on /connect');
const bodyText = await page.evaluate(() => document.body.innerText?.substring(0, 5000));
console.log('Page body text:\n', bodyText);
await page.screenshot({ path: ss('06-connect-state') });

// ─── Try to click on AO Queue tab to see queue ────────────────────────────────
log('[STEP 6] Click AO Queue tab');
try {
  const aqBtn = await page.$('button:has-text("AO Queue")');
  if (aqBtn) {
    await aqBtn.dispatchEvent('click');
    await page.waitForTimeout(2000);
    console.log('  Clicked AO Queue');
  }
} catch(e) {}
await page.screenshot({ path: ss('07-ao-queue-tab') });

// ─── Try clicking Plus tab ────────────────────────────────────────────────────
log('[STEP 7] Click Plus tab');
try {
  const plusBtn = await page.$('button:has-text("Plus")');
  if (plusBtn) {
    await plusBtn.dispatchEvent('click');
    await page.waitForTimeout(2000);
    console.log('  Clicked Plus');
    await page.screenshot({ path: ss('08-plus-tab') });
    const plusText = await page.evaluate(() => document.body.innerText?.substring(0, 3000));
    console.log('Plus tab body text:\n', plusText);
  }
} catch(e) {}

// ─── Directly try the API endpoint that loads leads (seen in earlier error) ──
log('[STEP 8] Hit the outbound-dialer leads API directly and capture response');
try {
  const apiUrl = 'https://aoirail-data-production.up.railway.app/api/outbound-dialer/leads?userEmail=chrislafond%40aoglobelife.com';
  console.log('  Attempting fetch of:', apiUrl);
  const apiResponse = await page.evaluate(async (url) => {
    try {
      const res = await fetch(url, { credentials: 'include' });
      const text = await res.text();
      return { status: res.status, statusText: res.statusText, body: text.substring(0, 500) };
    } catch(e) {
      return { error: e.message };
    }
  }, apiUrl);
  console.log('  API response:', JSON.stringify(apiResponse, null, 2));
} catch(e) {
  console.log('  [ERROR]', e.message);
}

// ─── Try hitting main app API endpoints to see disposition endpoint ───────────
log('[STEP 9] Try app API endpoints for disposition');
const apiEndpoints = [
  'https://aoirail-production.up.railway.app/api/update-resolution',
  'https://aoirail-production.up.railway.app/api/ccp-disposition',
  'https://aoirail-production.up.railway.app/api/disposition',
  'https://aoirail-data-production.up.railway.app/api/outbound-dialer/leads',
];

for (const apiUrl of apiEndpoints) {
  console.log(`\n  Testing: ${apiUrl}`);
  try {
    const result = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        const text = await res.text();
        return { status: res.status, statusText: res.statusText, body: text.substring(0, 300) };
      } catch(e) {
        return { error: e.message };
      }
    }, apiUrl);
    console.log(`  Result: ${JSON.stringify(result)}`);
  } catch(e) {
    console.log(`  [ERROR] ${e.message}`);
  }
}

// ─── Try POST to update-resolution to check what error comes back ─────────────
log('[STEP 10] POST to /api/update-resolution to audit error response');
try {
  const result = await page.evaluate(async () => {
    try {
      const res = await fetch('https://aoirail-production.up.railway.app/api/update-resolution', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: 'test-lead-id-12345',
          resolution: 'not_interested',
          agentEmail: 'chrislafond@aoglobelife.com'
        })
      });
      const text = await res.text();
      return { status: res.status, statusText: res.statusText, body: text.substring(0, 500) };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('POST /api/update-resolution result:', JSON.stringify(result, null, 2));
} catch(e) {
  console.log('[ERROR]', e.message);
}

// ─── Try POST to /api/ccp-disposition ─────────────────────────────────────────
log('[STEP 11] POST to /api/ccp-disposition');
try {
  const result = await page.evaluate(async () => {
    try {
      const res = await fetch('https://aoirail-production.up.railway.app/api/ccp-disposition', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: 'test-lead-id-12345',
          disposition: 'not_interested',
          agentEmail: 'chrislafond@aoglobelife.com'
        })
      });
      const text = await res.text();
      return { status: res.status, statusText: res.statusText, body: text.substring(0, 500) };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('POST /api/ccp-disposition result:', JSON.stringify(result, null, 2));
} catch(e) {
  console.log('[ERROR]', e.message);
}

// ─── Final screenshot ─────────────────────────────────────────────────────────
await page.waitForTimeout(2000);
await page.screenshot({ path: ss('final') });
console.log('\nFinal URL:', page.url());

// ─── PRINT FULL AUDIT SUMMARY ─────────────────────────────────────────────────
console.log('\n\n========================================');
console.log('           FULL AUDIT SUMMARY          ');
console.log('========================================');

console.log(`\nTotal console messages: ${consoleMessages.length}`);
console.log(`Console ERRORS: ${consoleMessages.filter(m => m.type === 'error').length}`);
console.log(`Console WARNINGS: ${consoleMessages.filter(m => m.type === 'warning').length}`);
console.log(`Network request failures: ${networkErrors.length}`);
console.log(`HTTP 4xx/5xx responses: ${badResponses.length}`);

console.log('\n─── ALL CONSOLE ERRORS ───');
consoleMessages.filter(m => m.type === 'error').forEach((m, i) => {
  console.log(`[${i+1}] ${m.text}`);
  if (m.location?.url) console.log(`     @ ${m.location.url}:${m.location.lineNumber}`);
});

console.log('\n─── ALL CONSOLE WARNINGS ───');
consoleMessages.filter(m => m.type === 'warning').forEach((m, i) => {
  console.log(`[${i+1}] ${m.text}`);
  if (m.location?.url) console.log(`     @ ${m.location.url}:${m.location.lineNumber}`);
});

console.log('\n─── ALL CONSOLE LOG MESSAGES ───');
consoleMessages.filter(m => m.type === 'log' || m.type === 'info').forEach((m, i) => {
  console.log(`[${i+1}] ${m.text}`);
});

console.log('\n─── NETWORK REQUEST FAILURES ───');
if (networkErrors.length === 0) console.log('  (none)');
networkErrors.forEach((e, i) => {
  console.log(`[${i+1}] ${e.method} ${e.url}`);
  console.log(`     Error: ${e.failure?.errorText}`);
});

console.log('\n─── HTTP 4xx/5xx RESPONSES ───');
if (badResponses.length === 0) console.log('  (none)');
badResponses.forEach((e, i) => {
  console.log(`[${i+1}] HTTP ${e.status} ${e.statusText}`);
  console.log(`     URL: ${e.url}`);
  console.log(`     Body: ${e.body}`);
});

fs.writeFileSync('C:/dev/AOIrail/tmp-audit-report.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  consoleMessages,
  networkErrors,
  badResponses,
}, null, 2));
console.log('\nFull report saved to: C:/dev/AOIrail/tmp-audit-report.json');

await browser.close();
console.log('\nAudit complete.');
