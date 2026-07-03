import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let leadApiUrl = null;
let allUrls = [];
page.on('response', async resp => {
  allUrls.push(resp.url().substring(0, 80));
  if (resp.url().includes('outbound-dialer/leads')) leadApiUrl = resp.url();
});

const resp = await page.goto('https://aoirail-production.up.railway.app/dashboard/connect', {
  waitUntil: 'domcontentloaded'
});
const html = await resp.text();
const hasInjection = html.includes('__AOIRAIL_DATA_SERVICE_URL__');
const match = html.match(/__AOIRAIL_DATA_SERVICE_URL__\s*=\s*["']([^"']+)["']/);

console.log('Response URL:', resp.url());
console.log('HTML length:', html.length);
console.log('Has __AOIRAIL_DATA_SERVICE_URL__:', hasInjection);
console.log('Value:', match ? match[1] : 'not found');

// Show head section
const headEnd = html.indexOf('</head>');
if (headEnd > 0) {
  console.log('\nHead section (last 500 chars):');
  console.log(html.substring(Math.max(0, headEnd - 500), headEnd + 10));
}

// Check window variable
await page.waitForTimeout(2000);
const windowVal = await page.evaluate(() => window.__AOIRAIL_DATA_SERVICE_URL__);
console.log('\nwindow.__AOIRAIL_DATA_SERVICE_URL__:', windowVal || 'not set');

await page.waitForTimeout(3000);
console.log('Lead API called at:', leadApiUrl || 'none');

await browser.close();
