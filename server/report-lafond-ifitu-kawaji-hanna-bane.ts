/**
 * Full report: agent name, hierarchy (EP, CEP, MGA, RGA), and state deviation
 * for everyone in Lafond, ENO IFTIU (Ifitu), Kawaji, Carrington Hanna, Taulant Bane.
 *
 * Usage: npx tsx server/report-lafond-ifitu-kawaji-hanna-bane.ts [path-to-producer-csv]
 */

import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import csv from 'csv-parser';
import { supabaseAdmin } from './supabase.js';

const PRODUCER_CSV = process.argv[2] || path.join(process.cwd(), 'Producer List 1.23.26.csv');
const FALLBACK_CSV = 'C:\\Users\\mmand\\Downloads\\Producer List 1.23.26.csv';
const OUT_CSV = path.join(process.cwd(), 'report-lafond-ifitu-kawaji-hanna-bane.csv');

const BOM = '\uFEFF';
function getRow(row: Record<string, string>, key: string): string {
  const v = row[key] ?? row[BOM + key] ?? '';
  return typeof v === 'string' ? v : String(v ?? '');
}

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

function csvEscape(val: string): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  console.log('Producer CSV:', PRODUCER_CSV);
  console.log('Output:', OUT_CSV);
  console.log('');

  const producerRows = await readProducerCsv(PRODUCER_CSV);
  const teamRows = producerRows.filter(inTargetTeam);
  const byEmail = new Map<string, { states: Set<string>; row: Record<string, string> }>();
  const byAid = new Map<string, { states: Set<string>; row: Record<string, string> }>();
  for (const row of teamRows) {
    const states = parseProducerStates(row);
    const email = getRow(row, 'Company Email').toLowerCase().trim();
    const aid = getRow(row, 'Associate ID').trim();
    const e = { states, row };
    if (email) byEmail.set(email, e);
    if (aid) byAid.set(aid, e);
  }

  console.log(`Target teams (Lafond, Ifitu, Kawaji, Hanna, Bane): ${teamRows.length} producers.`);

  if (!supabaseAdmin) throw new Error('Supabase admin not available');

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
    if (error) throw new Error(`Customers fetch failed: ${error.message}`);
    if (!page?.length) break;
    customers.push(...page);
    hasMore = page.length === PAGE;
    from += PAGE;
  }
  console.log(`Fetched ${customers.length} customers.`);

  const { data: hierarchy } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_email, agent_name, agent_associate_id, mga_name, rga_name');

  const hierarchyByEmail = new Map<string, { mga_name?: string; rga_name?: string }>();
  for (const h of hierarchy || []) {
    const e = (h.agent_email as string)?.toLowerCase?.();
    if (e) hierarchyByEmail.set(e, { mga_name: h.mga_name as string, rga_name: h.rga_name as string });
  }

  const report: {
    associate_id: string;
    company_email: string;
    agent_name: string;
    executive_producer: string;
    chief_executive_producer: string;
    mga_name: string;
    rga_name: string;
    deviation: number;
    current_states_count: number;
    producer_states_count: number;
  }[] = [];

  for (const c of customers) {
    const email = (c.company_email || c.personal_email || '').toString().toLowerCase().trim();
    const aid = c.associate_id != null ? String(c.associate_id).trim() : '';
    let prod = (aid && byAid.get(aid)) ?? (email ? byEmail.get(email) : null);
    if (!prod) continue;

    const custStates = new Set(parseArrayField(c.states).map((s) => s.toUpperCase().trim()).filter(Boolean));
    const prodStates = prod.states;
    const onlyInC = [...custStates].filter((s) => !prodStates.has(s));
    const onlyInP = [...prodStates].filter((s) => !custStates.has(s));
    const deviation = onlyInC.length + onlyInP.length;

    const ep = getRow(prod.row, 'Executive Producer');
    const cep = getRow(prod.row, 'Chief Executive Producer');
    const agent = getRow(prod.row, 'Agent') || [c.first_name, c.last_name].filter(Boolean).join(' ') || (c.agent_name as string) || '';
    const hi = hierarchyByEmail.get(email) || {};

    report.push({
      associate_id: aid || '',
      company_email: email || '',
      agent_name: agent,
      executive_producer: ep,
      chief_executive_producer: cep,
      mga_name: (hi.mga_name as string) || '',
      rga_name: (hi.rga_name as string) || '',
      deviation,
      current_states_count: custStates.size,
      producer_states_count: prodStates.size,
    });
  }

  report.sort((a, b) => b.deviation - a.deviation);

  const header = [
    'associate_id',
    'company_email',
    'agent_name',
    'executive_producer',
    'chief_executive_producer',
    'mga_name',
    'rga_name',
    'deviation',
    'current_states_count',
    'producer_states_count',
  ];
  const lines = [header.map(csvEscape).join(',')];
  for (const r of report) {
    lines.push(header.map((k) => csvEscape((r as Record<string, string>)[k])).join(','));
  }
  fs.writeFileSync(OUT_CSV, lines.join('\n'), 'utf-8');

  console.log(`\nWrote ${report.length} rows to ${OUT_CSV}\n`);
  console.log('--- Full report (agent | hierarchy | deviation) ---\n');
  for (const r of report) {
    const hierarchyStr = [r.executive_producer, r.chief_executive_producer, r.mga_name, r.rga_name]
      .filter(Boolean)
      .join(' → ');
    console.log(`${r.agent_name} | ${r.company_email} | ${hierarchyStr || '—'} | deviation ${r.deviation}`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
