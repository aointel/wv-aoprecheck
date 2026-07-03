import { createReadStream } from 'fs';
import csvParser from 'csv-parser';
import { supabaseAdmin } from '../supabase';

type CsvRow = {
  LeadID?: string;
  GroupCode?: string;
  GroupMarketName?: string;
  CreateDate?: string;
  LeadAge?: string;
  FirstName?: string;
  LastName?: string;
  PrimaryPhone?: string;
  CellPhone?: string;
  PrimaryEmail?: string;
  City?: string;
  Zip?: string;
  StateCode?: string;
  Beneficiary?: string;
  Relationship?: string;
  DateOfBirth?: string;
};

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeLeadId(value: unknown): string {
  return clean(value).replace(/\.0+$/, '');
}

function normalizeHeader(value: string): string {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase();
}

function pick(row: CsvRow, key: string): string | undefined {
  const target = normalizeHeader(key);
  for (const [k, v] of Object.entries(row)) {
    if (normalizeHeader(k) === target) return String(v ?? '');
  }
  return undefined;
}

function normalizePhone(value: unknown): string {
  const digits = clean(value).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function normalizeEmail(value: unknown): string {
  const e = clean(value).toLowerCase();
  return e.includes('@') ? e : '';
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

async function fetchMatchedIdsByColumn(column: 'taalk_lead_id' | 'lead_id', ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const chunkSize = 500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabaseAdmin!
      .from('masterlead')
      .select(column)
      .in(column, chunk as any);

    if (error) throw new Error(`${column} match query failed: ${error.message}`);
    for (const row of data || []) {
      const id = normalizeLeadId((row as any)?.[column]);
      if (id) out.add(id);
    }
  }
  return out;
}

async function fetchMatchedPhones(phones: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const chunkSize = 500;
  for (let i = 0; i < phones.length; i += chunkSize) {
    const chunk = phones.slice(i, i + chunkSize);
    const { data, error } = await supabaseAdmin!
      .from('masterlead')
      .select('phone')
      .in('phone', chunk as any);
    if (error) throw new Error(`phone match query failed: ${error.message}`);
    for (const row of data || []) {
      const p = normalizePhone((row as any)?.phone);
      if (p) out.add(p);
    }
  }
  return out;
}

async function main() {
  if (!supabaseAdmin) throw new Error('Supabase admin client unavailable');
  const csvPath = getArg('csv');
  if (!csvPath) throw new Error('Missing required --csv=<absolute path>');

  const rows = await readRows(csvPath);
  const totalRows = rows.length;

  const leadIds = rows.map((r) => normalizeLeadId(pick(r, 'LeadID'))).filter(Boolean);
  const uniqueLeadIds = [...new Set(leadIds)];

  const taalkMatches = await fetchMatchedIdsByColumn('taalk_lead_id', uniqueLeadIds);
  const legacyLeadMatches = await fetchMatchedIdsByColumn('lead_id', uniqueLeadIds);
  const matchedIds = new Set<string>([...taalkMatches, ...legacyLeadMatches]);

  let rowsMatchedByLeadId = 0;
  let rowsWouldBeAdded = 0;
  for (const row of rows) {
    const id = normalizeLeadId(pick(row, 'LeadID'));
    if (id && matchedIds.has(id)) rowsMatchedByLeadId += 1;
    else rowsWouldBeAdded += 1;
  }

  const uniqueLeadIdsWouldAdd = uniqueLeadIds.filter((id) => !matchedIds.has(id)).length;

  const unmatchedRows = rows.filter((r) => {
    const id = normalizeLeadId(pick(r, 'LeadID'));
    return !id || !matchedIds.has(id);
  });
  const unmatchedPhones = [
    ...new Set(unmatchedRows.map((r) => normalizePhone(pick(r, 'PrimaryPhone'))).filter(Boolean)),
  ];
  const unmatchedPhonesFound = await fetchMatchedPhones(unmatchedPhones);
  const unmatchedRowsWithPhone = unmatchedRows.filter((r) => !!normalizePhone(pick(r, 'PrimaryPhone'))).length;
  const unmatchedRowsWithPhoneAlreadyInMasterlead = unmatchedRows.filter((r) => {
    const p = normalizePhone(pick(r, 'PrimaryPhone'));
    return !!p && unmatchedPhonesFound.has(p);
  }).length;

  const nonEmptyCounts = {
    leadId: rows.filter((r) => !!normalizeLeadId(pick(r, 'LeadID'))).length,
    groupCode: rows.filter((r) => !!clean(pick(r, 'GroupCode'))).length,
    groupMarketName: rows.filter((r) => !!clean(pick(r, 'GroupMarketName'))).length,
    createDate: rows.filter((r) => !!clean(pick(r, 'CreateDate'))).length,
    firstName: rows.filter((r) => !!clean(pick(r, 'FirstName'))).length,
    lastName: rows.filter((r) => !!clean(pick(r, 'LastName'))).length,
    primaryPhone: rows.filter((r) => !!normalizePhone(pick(r, 'PrimaryPhone'))).length,
    cellPhone: rows.filter((r) => !!normalizePhone(pick(r, 'CellPhone'))).length,
    primaryEmail: rows.filter((r) => !!normalizeEmail(pick(r, 'PrimaryEmail'))).length,
    city: rows.filter((r) => !!clean(pick(r, 'City'))).length,
    zip: rows.filter((r) => !!clean(pick(r, 'Zip'))).length,
    stateCode: rows.filter((r) => !!clean(pick(r, 'StateCode'))).length,
    beneficiary: rows.filter((r) => !!clean(pick(r, 'Beneficiary'))).length,
    relationship: rows.filter((r) => !!clean(pick(r, 'Relationship'))).length,
    dateOfBirth: rows.filter((r) => !!clean(pick(r, 'DateOfBirth'))).length,
  };

  const output = {
    csvPath,
    totalRows,
    uniqueLeadIds: uniqueLeadIds.length,
    matchedByLeadId: {
      taalk_lead_id: taalkMatches.size,
      lead_id: legacyLeadMatches.size,
      combinedDistinct: matchedIds.size,
    },
    wouldAdd: {
      rows: rowsWouldBeAdded,
      uniqueLeadIds: uniqueLeadIdsWouldAdd,
    },
    unmatchedPhoneOverlap: {
      rowsWithoutLeadIdMatch: unmatchedRows.length,
      rowsWithPrimaryPhone: unmatchedRowsWithPhone,
      uniquePrimaryPhones: unmatchedPhones.length,
      uniquePhonesAlreadyInMasterlead: unmatchedPhonesFound.size,
      rowsWhosePrimaryPhoneAlreadyExistsInMasterlead: unmatchedRowsWithPhoneAlreadyInMasterlead,
    },
    rowsAlreadyExistByLeadId: rowsMatchedByLeadId,
    csvFieldNonEmptyCounts: nonEmptyCounts,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

