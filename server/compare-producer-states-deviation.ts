/**
 * Compare Producer List CSV vs customers.states; output CSV of anyone with
 * state deviation >= 4 (symmetric difference). No DB changes.
 *
 * Usage: npx tsx server/compare-producer-states-deviation.ts [path-to-producer-csv]
 * Default CSV: Producer List 1.23.26.csv in project root or C:\Users\...\Downloads
 *
 * Output: state-deviation-4-or-more.csv (same dir as script)
 */

import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import csv from 'csv-parser';
import { supabaseAdmin } from './supabase.js';

const PRODUCER_CSV = process.argv[2] || path.join(process.cwd(), 'Producer List 1.23.26.csv');
const FALLBACK_CSV = 'C:\\Users\\mmand\\Downloads\\Producer List 1.23.26.csv';
const OUT_CSV = path.join(process.cwd(), 'state-deviation-4-or-more.csv');

function parseArrayField(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return (value as string[]).filter(Boolean).map(String);
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t);
      return Array.isArray(p) ? p.filter(Boolean).map(String) : [];
    } catch {
      return t.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

const BOM = '\uFEFF';
function getRow(row: Record<string, string>, key: string): string {
  const v = row[key] ?? row[BOM + key] ?? '';
  return typeof v === 'string' ? v : String(v ?? '');
}

function parseStateList(s: string): string[] {
  if (!s || typeof s !== 'string') return [];
  return s.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
}

function parseProducerStates(row: Record<string, string>): Set<string> {
  const lifeAndHealth = parseStateList(getRow(row, 'Life-and-Health Licensed States'));
  const lifeOnly = parseStateList(getRow(row, 'Life-Only Licensed States'));
  const healthOnly = parseStateList(getRow(row, 'Health-Only Licensed States'));
  return new Set([...lifeAndHealth, ...lifeOnly, ...healthOnly]);
}

function producerKeyAssociate(row: Record<string, string>): string {
  const id = getRow(row, 'Associate ID');
  return id.trim() !== '' ? id.trim() : '';
}

function producerKeyEmail(row: Record<string, string>): string {
  const e = getRow(row, 'Company Email');
  return e ? e.toLowerCase().trim() : '';
}

function csvEscape(val: string): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function readProducerCsv(filePath: string): Promise<Record<string, string>[]> {
  let p = filePath;
  if (!fs.existsSync(p)) p = FALLBACK_CSV;
  if (!fs.existsSync(p)) {
    throw new Error(`Producer CSV not found: ${filePath} or ${FALLBACK_CSV}`);
  }
  const rows: Record<string, string>[] = [];
  return new Promise((resolve, reject) => {
    createReadStream(p)
      .pipe(csv())
      .on('data', (row: Record<string, string>) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function main() {
  console.log('Producer CSV:', PRODUCER_CSV);
  console.log('Output CSV:', OUT_CSV);
  console.log('');

  const producerRows = await readProducerCsv(PRODUCER_CSV);
  const byAssociateId = new Map<string, { states: Set<string>; row: Record<string, string> }>();
  const byEmail = new Map<string, { states: Set<string>; row: Record<string, string> }>();

  for (const row of producerRows) {
    const states = parseProducerStates(row);
    const aid = producerKeyAssociate(row);
    const email = producerKeyEmail(row);
    const entry = { states, row };
    if (aid) byAssociateId.set(aid, entry);
    if (email) byEmail.set(email, entry);
  }

  console.log(`Loaded ${producerRows.length} producer rows; ${byAssociateId.size} by Associate ID, ${byEmail.size} by Company Email.`);

  if (!supabaseAdmin) {
    throw new Error('Supabase admin not available');
  }

  const PAGE = 1000;
  const customers: Record<string, unknown>[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: page, error } = await supabaseAdmin
      .from('customers')
      .select('id, company_email, personal_email, associate_id, first_name, last_name, agent_name, states')
      .or('company_email.not.is.null,personal_email.not.is.null')
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Failed to fetch customers: ${error.message}`);
    if (!page?.length) break;
    customers.push(...page);
    hasMore = page.length === PAGE;
    from += PAGE;
  }

  console.log(`Fetched ${customers.length} customers (all rows, no pagination).`);

  const results: {
    associate_id: string;
    company_email: string;
    first_name: string;
    last_name: string;
    agent_name: string;
    current_states_count: number;
    producer_states_count: number;
    deviation: number;
    states_only_in_customer: string;
    states_only_in_producer: string;
    current_states: string;
    producer_states: string;
  }[] = [];

  for (const c of customers) {
    const email = (c.company_email || c.personal_email || '').toString().toLowerCase().trim();
    const aid = c.associate_id != null ? String(c.associate_id).trim() : '';
    let producer = aid ? byAssociateId.get(aid) : null;
    if (!producer && email) producer = byEmail.get(email) ?? null;
    if (!producer) continue;

    const custStates = new Set(parseArrayField(c.states).map((s) => s.toUpperCase().trim()).filter(Boolean));
    const prodStates = producer.states;

    const onlyInCustomer = [...custStates].filter((s) => !prodStates.has(s));
    const onlyInProducer = [...prodStates].filter((s) => !custStates.has(s));
    const deviation = onlyInCustomer.length + onlyInProducer.length;

    if (deviation < 4) continue;

    results.push({
      associate_id: aid || '',
      company_email: email || '',
      first_name: (c.first_name ?? '').toString(),
      last_name: (c.last_name ?? '').toString(),
      agent_name: (c.agent_name ?? '').toString(),
      current_states_count: custStates.size,
      producer_states_count: prodStates.size,
      deviation,
      states_only_in_customer: onlyInCustomer.sort().join(', '),
      states_only_in_producer: onlyInProducer.sort().join(', '),
      current_states: [...custStates].sort().join(', '),
      producer_states: [...prodStates].sort().join(', '),
    });
  }

  const header = [
    'associate_id',
    'company_email',
    'first_name',
    'last_name',
    'agent_name',
    'current_states_count',
    'producer_states_count',
    'deviation',
    'states_only_in_customer',
    'states_only_in_producer',
    'current_states',
    'producer_states',
  ];
  const lines = [header.map(csvEscape).join(',')];
  for (const r of results) {
    lines.push(
      header.map((k) => csvEscape((r as Record<string, string>)[k])).join(',')
    );
  }

  fs.writeFileSync(OUT_CSV, lines.join('\n'), 'utf-8');
  console.log(`Wrote ${results.length} rows to ${OUT_CSV}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
