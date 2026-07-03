import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'
);

const names = [
  "Aaron G Lawrence","Aaron Lowell Stander","Adaisha Darby","Alexandra Dominguez",
  "Amari J Kerr","Amy Jewell Beauchamp","Amy Jo Knight Commander","Andrew Walker",
  "Anthony Greco","Ashley Nicole Gamache","Aubrey Wolfe","Austin Wayne Smith",
  "Boris Koprivica","Brandon Quinn Cabeceiras","Bruce L Moxley","Camila Dalbem Andrade",
  "Carolina Jorge F Richmond","Cathleen Hairston","Christian Samuel Mercado",
  "Christina-Maria Mapuana Anna Altvater","Colby Devon Richards","Craig Stasiowski",
  "Cynthia Schomp","Dawid Liniewski","Dontaeja Smart","Drew Thomas Sharp",
  "Eleanor Rose Giles","Eric Geiss","Felipe R Machado Santanna","Fidel R Escobar",
  "Gabriel Arsene De Souza","George Carl Tockstein","Helen Bradley","Hortensia Angel Joseph",
  "Jakeline Ferreira Campos Olive","Janice Nicole Badger","Jiael Zenia Astwood",
  "Jonathan Angel Cantu","Jonathan Carrero","Junia Williams","Justin Zeramby",
  "Kaitlyn Lorraine Tuckmantel","Kendall Rena Grewer","Kimberly D Alston",
  "Kristian Portante","Krystal K Redding","Kyra Hopkins","Kywan Gilbert Jasper Sheppard",
  "Lalitha Janardhanan","Linda Scott","Lisa Yvette Smithson","Lleison Martinez",
  "Lynell Dominic Collier","Madison Smith","Matheus Bob","Michael N Locke",
  "Michael Ryan Shepler","Mistie Clontz Cockman","Monica Leticia Pina De Barros",
  "Natalia Lopes Monteiro","Nicholas Paul Triantafyllidis","Nicholas Walker",
  "Nicole Renee Paul","Nicolette Van Rensburg","Nikolaus Walter","Nivea Shanice Bryan",
  "Nolangie Rosado Pabon","Pallavi Varshney","Pamela Sue Faircloth","Paul Michael Demeo",
  "Philip Prata","Renata Johnson","Robert Gilman","Robert Lee Jones",
  "Rodney Jones","Ryan Wilson","Samantha P Nowak","Samuel Donadio",
  "Sean Gregory Melaven","Sean Hansen","Sergio D Vincenti","Sophia Limonciello",
  "Terrelle L Goslee-Adams","Teshaun Devoise","Theresa Jo Bryson","Timothy Matthew Wilson",
  "Towanya Thompson","Treyson Scott","Tyran Carter","Vitor Ingles Buche",
  "William Frederick Lawson","Yaury Victoria","Zaki Blanding"
];

async function searchAgent(page, name) {
  const parts = name.split(' ');
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];

  // Use the associate search page
  await page.goto('https://pod.planetaltig.com/Associates', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Try to find a search box
  try {
    const searchInput = page.locator('input[name="search"], input[type="search"], input[placeholder*="Search"], input[placeholder*="Name"], #searchInput, input.search').first();
    await searchInput.waitFor({ timeout: 5000 });
    await searchInput.fill(lastName);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 });
  } catch {
    // Try URL-based search
    await page.goto(`https://pod.planetaltig.com/Associates?search=${encodeURIComponent(lastName)}&firstName=${encodeURIComponent(firstName)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  }

  const content = await page.content();

  // Look for a link to the agent's detail page
  const linkMatch = content.match(/href="[^"]*AssociateDetails[^"]*u=([^"&]+)"/i);
  if (!linkMatch) {
    // Try alternate: direct search with first+last
    await page.goto(`https://pod.planetaltig.com/Associates?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const c2 = await page.content();
    const lm2 = c2.match(/href="[^"]*AssociateDetails[^"]*u=([^"&]+)"/i);
    if (!lm2) return null;
    return await getAgentDetails(page, lm2[1]);
  }

  return await getAgentDetails(page, linkMatch[1]);
}

async function getAgentDetails(page, alias) {
  await page.goto(`https://pod.planetaltig.com/AssociateDetails?u=${alias}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const content = await page.content();

  // Extract associate ID
  const assocMatch = content.match(/Associate\s*(?:ID|#|Number)[^<]*<[^>]+>([0-9]+)/i) ||
                     content.match(/<th[^>]*>Associate[^<]*<\/th>\s*<td[^>]*>([0-9]+)/i) ||
                     content.match(/AssociateID[^>]*>([0-9]+)/i);

  // Extract email
  const emailMatch = content.match(/[a-zA-Z0-9._%+\-]+@aoglobelife\.com/i) ||
                     content.match(/Company\s*Email[^<]*<[^>]+>([^<@\s]+@[^<\s]+)/i);

  // Extract name from page
  const nameMatch = content.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);

  return {
    alias,
    associate_id: assocMatch ? assocMatch[1].trim() : null,
    company_email: emailMatch ? emailMatch[0].trim() : null,
    page_name: nameMatch ? nameMatch[1].trim() : null,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login
  console.log('Logging in to pod.planetaltig.com...');
  await page.goto('https://pod.planetaltig.com/Account/Login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="Alias"]', 'michaelmandella');
  await page.fill('input[name="Password"]', 'C8fkef8agyeh!!');
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  console.log('Logged in. Current URL:', page.url());

  const results = [];
  const failed = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    console.log(`[${i+1}/${names.length}] Searching: ${name}`);
    try {
      const data = await searchAgent(page, name);
      if (data && (data.associate_id || data.company_email)) {
        console.log(`  ✅ Found: assoc=${data.associate_id}, email=${data.company_email}`);
        results.push({ name, ...data });
      } else {
        console.log(`  ⚠️  Not found on planet`);
        failed.push(name);
      }
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      failed.push(name);
    }
    await page.waitForTimeout(300); // be polite
  }

  await browser.close();

  console.log(`\n=== RESULTS: ${results.length} found, ${failed.length} failed ===`);

  // Insert into customers table
  if (results.length > 0) {
    console.log('\nInserting into customers table...');
    for (const r of results) {
      const nameParts = r.name.split(' ');
      const first_name = nameParts[0];
      const last_name = nameParts[nameParts.length - 1];

      // Check if already exists
      const { data: existing } = await sb.from('customers')
        .select('id, associate_id, company_email')
        .or(`associate_id.eq.${r.associate_id},company_email.eq.${r.company_email}`)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`  SKIP (exists): ${r.name} → ${existing[0].associate_id}`);
        continue;
      }

      const row = {
        first_name,
        last_name,
        agent_name: r.name,
        associate_id: r.associate_id ? parseInt(r.associate_id) : null,
        company_email: r.company_email || null,
        status: 'active',
      };

      const { error } = await sb.from('customers').insert(row);
      if (error) {
        console.log(`  ❌ Insert failed for ${r.name}: ${error.message}`);
      } else {
        console.log(`  ✅ Inserted: ${r.name} (assoc=${r.associate_id}, email=${r.company_email})`);
      }
    }
  }

  console.log('\nFailed to find:');
  failed.forEach(n => console.log('  -', n));
}

main().catch(console.error);
