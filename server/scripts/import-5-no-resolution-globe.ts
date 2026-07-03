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

function normalizeLeadId(value: string): string {
  return String(value || '').trim().replace(/\.0+$/, '');
}

function normalizePhone(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeEmail(value: string): string {
  const e = String(value || '').trim().toLowerCase();
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

async function leadIdExists(leadId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin!
    .from('masterlead')
    .select('id')
    .or(`taalk_lead_id.eq.${leadId},lead_id.eq.${leadId}`)
    .limit(1);
  if (error) throw new Error(`lookup failed for ${leadId}: ${error.message}`);
  return !!(data && data.length > 0);
}

async function main() {
  if (!supabaseAdmin) throw new Error('Supabase admin client unavailable');
  const csvPath = getArg('csv');
  if (!csvPath) throw new Error('Missing --csv=<absolute path>');

  const rows = await readRows(csvPath);
  const toInsert: any[] = [];

  for (const row of rows) {
    if (toInsert.length >= 5) break;
    const leadId = normalizeLeadId(pick(row, 'LeadID'));
    if (!leadId) continue;

    const exists = await leadIdExists(leadId);
    if (exists) continue;

    const createdAt = parseUsDateToIso(pick(row, 'CreateDate')) || new Date().toISOString();
    const dateOfBirth = parseUsDateToIso(pick(row, 'DateOfBirth'));

    toInsert.push({
      taalk_lead_id: leadId,
      lead_id: leadId,
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
      created_at: createdAt,
      updated_at: new Date().toISOString(),
      status: 'pending',
      cnresolution: 'pending',
      date_of_birth: dateOfBirth,
    });
  }

  if (toInsert.length < 5) {
    throw new Error(`Only found ${toInsert.length} insertable rows (need 5)`);
  }

  const { data: inserted, error } = await supabaseAdmin!
    .from('masterlead')
    .insert(toInsert)
    .select('id, taalk_lead_id, first_name, last_name, phone, state, taalk_group_code, taalk_market, cnresolution');

  if (error) throw new Error(`insert failed: ${error.message}`);

  const insertedIds = (inserted || []).map((r: any) => String(r.taalk_lead_id));
  const { data: verify, error: verifyError } = await supabaseAdmin!
    .from('masterlead')
    .select('id, taalk_lead_id, first_name, last_name, cnresolution, created_at')
    .in('taalk_lead_id', insertedIds);

  if (verifyError) throw new Error(`verify failed: ${verifyError.message}`);

  console.log(
    JSON.stringify(
      {
        insertedCount: inserted?.length || 0,
        inserted,
        verifiedCount: verify?.length || 0,
        verified: verify,
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

