/**
 * Reset customers.states to Producer List values for everyone in
 * Lafond, ENO IFTIU (Ifitu), Kawaji, Carrington Hanna, Taulant Bane.
 *
 * Usage: npx tsx server/reset-team-states-from-producer.ts [path-to-producer-csv] [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import csv from 'csv-parser';
import { supabaseAdmin } from './supabase.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const PRODUCER_CSV = args[0] || path.join(process.cwd(), 'Producer List 1.23.26.csv');
const FALLBACK_CSV = 'C:\\Users\\mmand\\Downloads\\Producer List 1.23.26.csv';
const DRY_RUN = process.argv.includes('--dry-run');

const BOM = '\uFEFF';
function getRow(row: Record<string, string>, key: string): string {
  const v = row[key] ?? row[BOM + key] ?? '';
  return typeof v === 'string' ? v : String(v ?? '');
}

const LIFE_AND_HEALTH = 'Life-and-Health Licensed States';
const LIFE_ONLY = 'Life-Only Licensed States';
const HEALTH_ONLY = 'Health-Only Licensed States';

function parseStateList(s: string): string[] {
  if (!s || typeof s !== 'string') return [];
  return s
    .split(',')
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}

/** Union of Life-and-Health + Life-Only + Health-Only. Stored as JSON array in customers.states. */
function parseProducerStates(row: Record<string, string>): string[] {
  const lifeAndHealth = parseStateList(getRow(row, LIFE_AND_HEALTH));
  const lifeOnly = parseStateList(getRow(row, LIFE_ONLY));
  const healthOnly = parseStateList(getRow(row, HEALTH_ONLY));
  const combined = [...new Set([...lifeAndHealth, ...lifeOnly, ...healthOnly])].sort();
  return combined;
}

function inTargetTeam(row: Record<string, string>): boolean {
  const ep = getRow(row, 'Executive Producer').toUpperCase();
  const cep = getRow(row, 'Chief Executive Producer').toUpperCase();
  const agent = getRow(row, 'Agent').toUpperCase();
  const search = `${ep} ${cep} ${agent}`;
  const patterns = ['LAFOND', 'ENO IFTIU', 'IFTIU', 'CARRINGTON HANNA', 'TAULANT BANE', 'BANE', 'KAWAJI', 'KAWAJ'];
  return patterns.some((p) => search.includes(p));
}

function readProducerCsv(filePath: string): Promise<Record<string, string>[]> {
  let p = filePath;
  if (!fs.existsSync(p)) p = FALLBACK_CSV;
  if (!fs.existsSync(p)) throw new Error(`Producer CSV not found: ${filePath} or ${FALLBACK_CSV}`);
  const rows: Record<string, string>[] = [];
  return new Promise((resolve, reject) => {
    createReadStream(p)
      .pipe(csv())
      .on('data', (r: Record<string, string>) => rows.push(r))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function main() {
  console.log('Producer CSV:', PRODUCER_CSV);
  console.log('Mode:', DRY_RUN ? 'DRY RUN (no updates)' : 'LIVE UPDATE');
  console.log('');

  const producerRows = await readProducerCsv(PRODUCER_CSV);
  const teamRows = producerRows.filter(inTargetTeam);
  const byEmail = new Map<string, { states: string[]; row: Record<string, string> }>();
  const byAid = new Map<string, { states: string[]; row: Record<string, string> }>();
  let sampleLhPlusLo: { agent: string; lh: number; lo: number; health: number; total: number } | null = null;
  for (const row of teamRows) {
    const states = parseProducerStates(row);
    const email = getRow(row, 'Company Email').toLowerCase().trim();
    const aid = getRow(row, 'Associate ID').trim();
    const e = { states, row };
    if (email) byEmail.set(email, e);
    if (aid) byAid.set(aid, e);
    if (!sampleLhPlusLo) {
      const lh = parseStateList(getRow(row, LIFE_AND_HEALTH));
      const lo = parseStateList(getRow(row, LIFE_ONLY));
      const ho = parseStateList(getRow(row, HEALTH_ONLY));
      if (lo.length > 0 || ho.length > 0) {
        sampleLhPlusLo = {
          agent: getRow(row, 'Agent'),
          lh: lh.length,
          lo: lo.length,
          health: ho.length,
          total: states.length,
        };
      }
    }
  }
  console.log(`Target teams: ${teamRows.length} producers.`);
  if (sampleLhPlusLo) {
    console.log(
      `  (Life-and-Health + Life-Only + Health-Only → JSON array; e.g. ${sampleLhPlusLo.agent}: ${sampleLhPlusLo.lh} L+H, ${sampleLhPlusLo.lo} Life-Only, ${sampleLhPlusLo.health} Health-Only → ${sampleLhPlusLo.total} total)`
    );
  }

  if (!supabaseAdmin) throw new Error('Supabase admin not available');

  const PAGE = 1000;
  const customers: { id: string; company_email?: string; personal_email?: string; associate_id?: unknown }[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data: page, error } = await supabaseAdmin
      .from('customers')
      .select('id, company_email, personal_email, associate_id')
      .or('company_email.not.is.null,personal_email.not.is.null')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Customers fetch failed: ${error.message}`);
    if (!page?.length) break;
    customers.push(...(page as typeof customers));
    hasMore = page.length === PAGE;
    from += PAGE;
  }
  console.log(`Fetched ${customers.length} customers.`);

  const toUpdate: { id: string; email: string; aid: string; agent: string; states: string[] }[] = [];
  for (const c of customers) {
    const email = (c.company_email || c.personal_email || '').toString().toLowerCase().trim();
    const aid = c.associate_id != null ? String(c.associate_id).trim() : '';
    const prod = (aid && byAid.get(aid)) ?? (email ? byEmail.get(email) : null);
    if (!prod) continue;
    const agent = getRow(prod.row, 'Agent') || email;
    toUpdate.push({ id: c.id, email, aid, agent, states: prod.states });
  }
  console.log(`Matched ${toUpdate.length} customers to reset.`);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN: would update ---');
    for (const u of toUpdate.slice(0, 20)) {
      console.log(`  ${u.agent} (${u.email}) → ${u.states.length} states: ${u.states.slice(0, 8).join(', ')}${u.states.length > 8 ? '...' : ''}`);
    }
    if (toUpdate.length > 20) console.log(`  ... and ${toUpdate.length - 20} more.`);
    console.log('\nRun without --dry-run to apply.');
    return;
  }

  let ok = 0;
  let err = 0;
  for (const u of toUpdate) {
    // customers.states: JSON array (Life-and-Health ∪ Life-Only ∪ Health-Only)
    const { error } = await supabaseAdmin!
      .from('customers')
      .update({ states: u.states })
      .eq('id', u.id);
    if (error) {
      console.error(`  ❌ ${u.agent} (${u.email}): ${error.message}`);
      err++;
    } else ok++;
  }
  console.log(`\nUpdated ${ok} customers. Errors: ${err}.`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
