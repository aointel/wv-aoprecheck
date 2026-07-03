import { createReadStream } from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import { supabaseAdmin } from '../supabase';

type ProducerCsvRow = Record<string, string | undefined>;

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function clean(value: unknown): string | null {
  const v = String(value ?? '').trim();
  if (!v || v === '0' || v.toLowerCase() === 'null' || v.toLowerCase() === 'nan') return null;
  return v;
}

function normalizeEmail(value: unknown): string | null {
  const v = clean(value)?.toLowerCase() ?? null;
  return v && v.includes('@') ? v : null;
}

function normalizeHeader(value: string): string {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
}

function pick(row: ProducerCsvRow, key: string): string | undefined {
  const target = normalizeHeader(key);
  for (const [k, v] of Object.entries(row)) {
    if (normalizeHeader(k) === target) return v;
  }
  return undefined;
}

async function readCsvRows(filePath: string): Promise<ProducerCsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: ProducerCsvRow[] = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row: ProducerCsvRow) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function main() {
  if (!supabaseAdmin) throw new Error('Supabase admin client is not initialized');

  const csvPathArg = getArg('csv');
  if (!csvPathArg) {
    throw new Error('Missing --csv=<absolute path to Producer List csv>');
  }

  const csvPath = path.resolve(csvPathArg);
  console.log(`Reading producer CSV: ${csvPath}`);
  const rows = await readCsvRows(csvPath);
  console.log(`Rows read: ${rows.length}`);

  const payload = rows
    .map((row) => {
      const assocStr = clean(pick(row, 'Associate ID'));
      const associateId = assocStr ? Number(assocStr) : NaN;
      if (!Number.isFinite(associateId) || associateId <= 0) return null;

      return {
        associate_id: associateId,
        mga: clean(pick(row, 'Executive Producer')),
        rga: clean(pick(row, 'Chief Executive Producer')),
        company_email: normalizeEmail(pick(row, 'Company Email')),
        personal_email: normalizeEmail(pick(row, 'Personal Email')),
        phone: clean(pick(row, 'Phone')),
        aoi_market: clean(pick(row, 'AOI MARKET')),
        ao_market_2: clean(pick(row, 'AO Market 2')),
        designated_market: clean(pick(row, 'Designated Market')),
        agent_name: clean(pick(row, 'Agent')),
        life_and_health_states: clean(pick(row, 'Life-and-Health Licensed States')),
        life_only_licensed_states: clean(pick(row, 'Life-Only Licensed States')),
        health_only_licensed_states: clean(pick(row, 'Health-Only Licensed States')),
        updated_at: new Date().toISOString(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  console.log(`Valid rows for upsert: ${payload.length}`);
  if (payload.length === 0) {
    console.log('No valid rows found. Exiting.');
    return;
  }

  // CSV can contain repeated associate IDs; dedupe before upsert to avoid conflict-on-conflict.
  const dedupedByAssociate = new Map<number, (typeof payload)[number]>();
  for (const row of payload) {
    const prev = dedupedByAssociate.get(row.associate_id);
    if (!prev) {
      dedupedByAssociate.set(row.associate_id, row);
      continue;
    }
    // Prefer row with a company email; otherwise keep latest row.
    if (!prev.company_email && row.company_email) dedupedByAssociate.set(row.associate_id, row);
    else dedupedByAssociate.set(row.associate_id, row);
  }
  const dedupedPayload = [...dedupedByAssociate.values()];
  console.log(`Deduped rows by associate_id: ${dedupedPayload.length}`);

  const BATCH = 100;
  let upserted = 0;
  let failed = 0;
  for (let i = 0; i < dedupedPayload.length; i += BATCH) {
    const batch = dedupedPayload.slice(i, i + BATCH);
    const { error } = await supabaseAdmin
      .from('producerlist')
      .upsert(batch, { onConflict: 'associate_id', ignoreDuplicates: false });

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} failed: ${error.message} (falling back row-by-row)`);
      for (const row of batch) {
        const { error: rowErr } = await supabaseAdmin
          .from('producerlist')
          .upsert(row, { onConflict: 'associate_id', ignoreDuplicates: false });
        if (rowErr) {
          failed += 1;
          continue;
        }
        upserted += 1;
      }
      continue;
    }

    upserted += batch.length;
    console.log(`Upserted ${Math.min(i + BATCH, dedupedPayload.length)}/${dedupedPayload.length}`);
  }

  console.log(`Done. Upserted: ${upserted}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Import failed:', err?.message || err);
  process.exit(1);
});

