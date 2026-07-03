import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

console.log('Logging in...');
await page.goto('https://pod.planetaltig.com/Account/Login', { waitUntil: 'domcontentloaded' });
await page.fill('input[name="Alias"]', 'michaelmandella');
await page.fill('input[name="Password"]', 'C8fkef8agyeh!!');
await page.click('button[type="submit"], input[type="submit"]');
await page.waitForLoadState('domcontentloaded');
console.log('URL after login:', page.url());

// Try searching for one agent by last name - Blanding (unique)
console.log('\nGoing to Associates page...');
await page.goto('https://pod.planetaltig.com/Associates', { waitUntil: 'domcontentloaded' });
console.log('Associates URL:', page.url());

// Dump form inputs and links
const inputs = await page.$$eval('input', els => els.map(e => ({ name: e.name, type: e.type, id: e.id, placeholder: e.placeholder })));
console.log('Inputs:', JSON.stringify(inputs, null, 2));

// Try the URL with query params
await page.goto('https://pod.planetaltig.com/Associates?lastName=Blanding', { waitUntil: 'domcontentloaded' });
const content = await page.content();
const snippet = content.substring(0, 3000);
console.log('\nPage snippet (search by lastName=Blanding):');
console.log(snippet);

await browser.close();
