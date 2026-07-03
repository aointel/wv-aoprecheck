import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const responses = [];
page.on('response', async (resp) => {
  const url = resp.url();
  if (
    url.includes('/api/recruit/candidates') ||
    url.includes('/api/outbound-dialer/masterrecruit-queue')
  ) {
    let body = null;
    try {
      body = await resp.json();
    } catch {
      body = null;
    }
    responses.push({
      url,
      status: resp.status(),
      success: body?.success,
      candidatesCount: Array.isArray(body?.candidates) ? body.candidates.length : null,
      leadsCount: Array.isArray(body?.leads) ? body.leads.length : null,
      dataCount: Array.isArray(body?.data) ? body.data.length : null,
      keys: body && typeof body === 'object' ? Object.keys(body).slice(0, 12) : [],
      sampleCandidate: Array.isArray(body?.candidates) && body.candidates[0]
        ? {
            id: body.candidates[0].id,
            first_name: body.candidates[0].first_name ?? body.candidates[0].firstName,
            last_name: body.candidates[0].last_name ?? body.candidates[0].lastName,
            agent_email: body.candidates[0].agent_email ?? body.candidates[0].agentEmail,
            phone: body.candidates[0].phone,
          }
        : null,
    });
  }
});

await page.goto('https://aoirail-production.up.railway.app/login', { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'chrislafond@aoglobelife.com');
await page.fill('input[type="password"]', 'aointel2025');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

await page.goto('https://aoirail-production.up.railway.app/aorecruit', { waitUntil: 'networkidle' });
await page.waitForTimeout(7000);

const ui = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button')).map((b) => (b.textContent || '').trim());
  const relevant = buttons.filter((t) =>
    t.includes('My Candidates') || t.includes('AO Recruit') || t.includes('Ignite')
  );
  const bodyText = document.body?.innerText || '';
  return {
    relevantButtons: relevant,
    hasNoCandidatesMessage: bodyText.includes('No candidates in this queue right now.'),
    hasMyCandidatesLabel: bodyText.includes('My Candidates'),
  };
});

console.log('=== UI SNAPSHOT ===');
console.log(JSON.stringify(ui, null, 2));

console.log('=== API SNAPSHOT ===');
console.log(JSON.stringify(responses, null, 2));

await page.screenshot({ path: 'c:/dev/AOIrail/tmp-playwright-trace/aorecruit-check.png', fullPage: false });
await browser.close();
