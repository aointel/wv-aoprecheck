import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { supabaseAdmin } from '../supabase.js';

type SourceRow = {
  companyEmail: string;
  associateId: string;
  agentName: string;
  source: 'active-contracts' | 'producer-list';
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_ACTIVE_CONTRACTS = path.resolve(__dirname, '../sql/Active Contracts 4.3.26.xlsx');
const DEFAULT_PRODUCER_LIST = path.resolve(__dirname, '../sql/Producer List 4.3.26.xlsx');
const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_INSERT_BATCH = 300;

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function normalizeEmail(value: unknown): string {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v || !v.includes('@')) return '';
  return v;
}

function normalizeAssoc(value: unknown): string {
  const v = String(value ?? '').trim();
  if (!v || v === '0' || v.toLowerCase() === 'nan') return '';
  return v;
}

function normalizeName(value: unknown): string {
  return String(value ?? '').trim();
}

function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Agent', lastName: 'User' };
  if (parts.length === 1) return { firstName: parts[0], lastName: 'User' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function readSheetRows(filePath: string): Record<string, unknown>[] {
  const workbook = XLSX.readFile(filePath);
  const first = workbook.SheetNames[0];
  const sheet = workbook.Sheets[first];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
}

function loadSourceRows(activeContractsPath: string, producerListPath: string): SourceRow[] {
  const out: SourceRow[] = [];

  const activeRows = readSheetRows(activeContractsPath);
  for (const row of activeRows) {
    const companyEmail = normalizeEmail(pick(row, ['Email', 'Company Email', 'company_email']));
    if (!companyEmail) continue;
    out.push({
      companyEmail,
      associateId: normalizeAssoc(pick(row, ['AssocID', 'Associate ID', 'associate_id'])),
      agentName: normalizeName(pick(row, ['Name', 'Agent', 'agent_name'])),
      source: 'active-contracts',
    });
  }

  const producerRows = readSheetRows(producerListPath);
  for (const row of producerRows) {
    const companyEmail = normalizeEmail(pick(row, ['Company Email', 'Email', 'company_email']));
    if (!companyEmail) continue;
    out.push({
      companyEmail,
      associateId: normalizeAssoc(pick(row, ['Associate ID', 'AssocID', 'associate_id'])),
      agentName: normalizeName(pick(row, ['Agent', 'Name', 'agent_name'])),
      source: 'producer-list',
    });
  }

  return out;
}

function dedupeRows(rows: SourceRow[]): SourceRow[] {
  const map = new Map<string, SourceRow>();
  for (const row of rows) {
    const existing = map.get(row.companyEmail);
    if (!existing) {
      map.set(row.companyEmail, row);
      continue;
    }
    // Prefer Producer List over Active Contracts and prefer rows with associateId.
    const existingScore = (existing.source === 'producer-list' ? 2 : 0) + (existing.associateId ? 1 : 0);
    const nextScore = (row.source === 'producer-list' ? 2 : 0) + (row.associateId ? 1 : 0);
    if (nextScore >= existingScore) {
      map.set(row.companyEmail, row);
    }
  }
  return [...map.values()];
}

async function loadExistingEmailSet(pageSize: number): Promise<Set<string>> {
  const emailSet = new Set<string>();
  let offset = 0;
  let page = 0;

  while (true) {
    const { data, error } = await supabaseAdmin!
      .from('customers')
      .select('company_email, personal_email')
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed loading customers page ${page}: ${error.message}`);
    }

    const rows = data || [];
    for (const row of rows) {
      const ce = normalizeEmail((row as any).company_email);
      const pe = normalizeEmail((row as any).personal_email);
      if (ce) emailSet.add(ce);
      if (pe) emailSet.add(pe);
    }

    page += 1;
    offset += rows.length;
    console.log(`Loaded customers page ${page}: ${rows.length} rows (unique emails so far: ${emailSet.size})`);

    if (rows.length < pageSize) break;
  }

  return emailSet;
}

async function insertMissingRows(
  rows: SourceRow[],
  pageSize: number,
  batchSize: number,
  apply: boolean,
): Promise<{
  inserted: number;
  skippedExisting: number;
  failed: number;
}> {
  const existing = await loadExistingEmailSet(pageSize);
  let inserted = 0;
  let skippedExisting = 0;
  let failed = 0;

  const missing = rows.filter((r) => {
    if (existing.has(r.companyEmail)) {
      skippedExisting += 1;
      return false;
    }
    return true;
  });

  console.log(`Missing emails to insert: ${missing.length}`);

  if (!apply) {
    console.log('Dry run mode: no inserts executed. Use --apply to write.');
    return { inserted: 0, skippedExisting, failed: 0 };
  }

  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const payload = batch.map((row) => {
      const nm = row.agentName || row.companyEmail.split('@')[0];
      const parsed = parseName(nm);
      const assocNum = Number(row.associateId);
      return {
        company_email: row.companyEmail,
        personal_email: row.companyEmail,
        associate_id: Number.isFinite(assocNum) && assocNum > 0 ? assocNum : null,
        first_name: parsed.firstName,
        last_name: parsed.lastName,
        agent_name: nm,
      };
    });

    const { error } = await supabaseAdmin!.from('customers').insert(payload);
    if (error) {
      // Fallback row-by-row so one bad record doesn't kill the whole sync.
      console.warn(`Batch insert failed at offset ${i}: ${error.message}. Falling back to row-by-row.`);
      for (const row of payload) {
        const { error: rowErr } = await supabaseAdmin!.from('customers').insert(row as any);
        if (rowErr) {
          if (String(rowErr.message || '').toLowerCase().includes('duplicate') || String((rowErr as any).code || '') === '23505') {
            skippedExisting += 1;
            continue;
          }
          failed += 1;
          continue;
        }
        inserted += 1;
      }
    } else {
      inserted += payload.length;
    }

    console.log(`Processed ${Math.min(i + batch.length, missing.length)}/${missing.length} missing rows`);
  }

  return { inserted, skippedExisting, failed };
}

async function main() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not initialized');
  }

  const activeContracts = getArg('active') || DEFAULT_ACTIVE_CONTRACTS;
  const producerList = getArg('producer') || DEFAULT_PRODUCER_LIST;
  const pageSize = Number(getArg('pageSize') || DEFAULT_PAGE_SIZE);
  const insertBatch = Number(getArg('batchSize') || DEFAULT_INSERT_BATCH);
  const apply = hasFlag('--apply');

  console.log('Active contracts file:', activeContracts);
  console.log('Producer list file:', producerList);
  console.log('Page size:', pageSize);
  console.log('Insert batch size:', insertBatch);
  console.log('Mode:', apply ? 'APPLY' : 'DRY-RUN');

  const source = loadSourceRows(activeContracts, producerList);
  console.log(`Loaded source rows: ${source.length}`);
  const deduped = dedupeRows(source);
  console.log(`Unique company emails in source: ${deduped.length}`);

  const result = await insertMissingRows(deduped, pageSize, insertBatch, apply);
  console.log('\nSummary');
  console.log('Inserted:', result.inserted);
  console.log('Skipped existing:', result.skippedExisting);
  console.log('Failed:', result.failed);
}

main().catch((err) => {
  console.error('Sync failed:', err?.message || err);
  process.exit(1);
});

