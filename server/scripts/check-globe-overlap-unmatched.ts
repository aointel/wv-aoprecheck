import { createReadStream } from 'fs';
import csvParser from 'csv-parser';
import { supabaseAdmin } from '../supabase';

type Row = Record<string, string | undefined>;

const CSV_PATH = 'C:\\Users\\mmand\\OneDrive\\Documents\\90 days no resolution globe leads 04.22.26.csv';

const clean = (v: unknown) => String(v ?? '').trim();
const leadId = (v: unknown) => clean(v).replace(/\.0+$/, '');
const phone10 = (v: unknown) => {
  const d = clean(v).replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
};
const normH = (v: string) => String(v || '').replace(/^\uFEFF/, '').trim().toLowerCase();
const pick = (row: Row, key: string) => {
  const t = normH(key);
  for (const [k, v] of Object.entries(row)) if (normH(k) === t) return String(v ?? '');
  return '';
};

async function readRows(path: string): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const rows: Row[] = [];
    createReadStream(path)
      .pipe(csvParser())
      .on('data', (r: Row) => rows.push(r))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function main() {
  if (!supabaseAdmin) throw new Error('supabase admin unavailable');
  const rows = await readRows(CSV_PATH);
  const ids = [...new Set(rows.map((r) => leadId(pick(r, 'LeadID'))).filter(Boolean))];

  const matched = new Set<string>();
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    for (const col of ['taalk_lead_id', 'lead_id'] as const) {
      const { data, error } = await supabaseAdmin
        .from('masterlead')
        .select(col)
        .in(col, chunk as any);
      if (error) throw error;
      for (const r of data || []) {
        const v = leadId((r as any)?.[col]);
        if (v) matched.add(v);
      }
    }
  }

  const unmatchedRows = rows.filter((r) => !matched.has(leadId(pick(r, 'LeadID'))));
  const unmatchedPhones = [...new Set(unmatchedRows.map((r) => phone10(pick(r, 'PrimaryPhone'))).filter(Boolean))];

  const globePhonesFound = new Set<string>();
  for (let i = 0; i < unmatchedPhones.length; i += CHUNK) {
    const chunk = unmatchedPhones.slice(i, i + CHUNK);
    const { data, error } = await supabaseAdmin
      .from('masterlead')
      .select('phone, taalk_market')
      .in('phone', chunk as any)
      .ilike('taalk_market', '%globe%');
    if (error) throw error;
    for (const r of data || []) {
      const p = phone10((r as any)?.phone);
      if (p) globePhonesFound.add(p);
    }
  }

  const rowsWhosePhoneMatchesGlobe = unmatchedRows.filter((r) => globePhonesFound.has(phone10(pick(r, 'PrimaryPhone')))).length;

  console.log(
    JSON.stringify(
      {
        unmatchedRows: unmatchedRows.length,
        unmatchedRowsWithPrimaryPhone: unmatchedRows.filter((r) => !!phone10(pick(r, 'PrimaryPhone'))).length,
        uniqueUnmatchedPhones: unmatchedPhones.length,
        uniqueUnmatchedPhonesMatchingExistingGlobe: globePhonesFound.size,
        unmatchedRowsWhosePhoneMatchesExistingGlobe: rowsWhosePhoneMatchesGlobe,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});

