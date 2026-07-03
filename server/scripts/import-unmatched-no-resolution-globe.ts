import { createReadStream } from 'fs';
import csvParser from 'csv-parser';
import { supabaseAdmin } from '../supabase';

type CsvRow = Record<string, string | undefined>;

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function normalizeHeader(value: string): string {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase();
}

function pick(row: CsvRow, key: string): string {
  const target = normalizeHeader(key);
  for (const [k, v] of Object.entries(row)) {
    if (normalizeHeader(k) === target) return String(v ?? '').trim();
  }
  return '';
}

function normalizeLeadId(value: unknown): string {
  return String(value ?? '').trim().replace(/\.0+$/, '');
}

function normalizePhone(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function normalizeEmail(value: unknown): string {
  const e = String(value ?? '').trim().toLowerCase();
  return e.includes('@') ? e : '';
}

function parseUsDateToIso(value: string): string | null {
  const v = String(value || '').trim();
  if (!v) return null;
  const parts = v.split('/');
  if (parts.length !== 3) return null;
  const mm = Number(parts[0]);
  const dd = Number(parts[1]);
  const yyyy = Number(parts[2]);
  if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yyyy)) return null;
  if (yyyy < 1900 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0)).toISOString();
}

async function readRows(csvPath: string): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    createReadStream(csvPath)
      .pipe(csvParser())
      .on('data', (row: CsvRow) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function fetchExistingLeadIds(ids: string[]): Promise<Set<string>> {
  const existing = new Set<string>();
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    for (const col of ['taalk_lead_id', 'lead_id'] as const) {
      const { data, error } = await supabaseAdmin!
        .from('masterlead')
        .select(col)
        .in(col, chunk as any);
      if (error) throw new Error(`failed checking ${col}: ${error.message}`);
      for (const row of data || []) {
        const id = normalizeLeadId((row as any)?.[col]);
        if (id) existing.add(id);
      }
    }
  }
  return existing;
}

async function main() {
  if (!supabaseAdmin) throw new Error('Supabase admin unavailable');
  const csvPath = getArg('csv');
  if (!csvPath) throw new Error('Missing --csv=<absolute path>');

  const rows = await readRows(csvPath);
  const byLeadId = new Map<string, CsvRow>();
  for (const row of rows) {
    const id = normalizeLeadId(pick(row, 'LeadID'));
    if (!id) continue;
    if (!byLeadId.has(id)) byLeadId.set(id, row); // keep first for uniqueness
  }

  const uniqueIds = [...byLeadId.keys()];
  const existingIds = await fetchExistingLeadIds(uniqueIds);
  const unmatchedIds = uniqueIds.filter((id) => !existingIds.has(id));

  const nowIso = new Date().toISOString();
  const payload = unmatchedIds.map((id) => {
    const row = byLeadId.get(id)!;
    return {
      taalk_lead_id: id,
      lead_id: id,
      first_name: pick(row, 'FirstName') || null,
      last_name: pick(row, 'LastName') || null,
      phone: normalizePhone(pick(row, 'PrimaryPhone')) || null,
      email: normalizeEmail(pick(row, 'PrimaryEmail')) || null,
      city: pick(row, 'City') || null,
      zip: pick(row, 'Zip') || null,
      state: pick(row, 'StateCode') || null,
      taalk_state: pick(row, 'StateCode') || null,
      taalk_market: pick(row, 'GroupMarketName') || null,
      taalk_group_code: pick(row, 'GroupCode') || null,
      taalk_beneficiary: pick(row, 'Beneficiary') || null,
      taalk_relationship: pick(row, 'Relationship') || null,
      created_at: parseUsDateToIso(pick(row, 'CreateDate')) || nowIso,
      updated_at: nowIso,
      status: 'pending',
      cnresolution: 'pending',
      date_of_birth: parseUsDateToIso(pick(row, 'DateOfBirth')),
    };
  });

  console.log(
    JSON.stringify(
      {
        totalCsvRows: rows.length,
        uniqueLeadIds: uniqueIds.length,
        existingLeadIds: existingIds.size,
        toInsertUniqueLeadIds: unmatchedIds.length,
      },
      null,
      2,
    ),
  );

  if (payload.length === 0) {
    console.log('No unmatched rows to insert.');
    return;
  }

  const BATCH = 300;
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < payload.length; i += BATCH) {
    const batch = payload.slice(i, i + BATCH);
    const { error } = await supabaseAdmin!.from('masterlead').insert(batch);
    if (error) {
      // Fallback row-by-row so one bad row does not block whole import
      for (const row of batch) {
        const { error: rowErr } = await supabaseAdmin!.from('masterlead').insert(row as any);
        if (rowErr) {
          failed += 1;
          continue;
        }
        inserted += 1;
      }
    } else {
      inserted += batch.length;
    }
    console.log(`Inserted ${Math.min(i + BATCH, payload.length)}/${payload.length}`);
  }

  const { count } = await supabaseAdmin!
    .from('masterlead')
    .select('*', { count: 'exact', head: true })
    .in('taalk_lead_id', unmatchedIds as any);

  console.log(
    JSON.stringify(
      {
        attemptedInserts: payload.length,
        inserted,
        failed,
        verifyCountByTaalkLeadId: count ?? 0,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

