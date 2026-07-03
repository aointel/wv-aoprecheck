/**
 * Sync CQ-format CSV to Supabase masterlead table.
 * - Match by taalk_lead_id (CSV LeadID). CSV trumps: overwrite mapped fields.
 * - Duplicate LeadID in CSV: last row wins.
 * - Usage: tsx server/scripts/sync-cq-leads-to-masterlead.ts [path/to/file.csv] [--dry-run]
 */

import { createReadStream } from 'fs';
import { resolve } from 'path';
import csv from 'csv-parser';
import { supabaseAdmin } from '../supabase.js';
import { masterleadClient } from '../local-masterlead-client';

const BATCH_SELECT_SIZE = 200;
const BATCH_INSERT_SIZE = 100;
/** Number of updates to run in parallel (each update is still one row). */
const BATCH_UPDATE_CONCURRENCY = 50;


const BOM = '\uFEFF';
function normKey(k: string): string {
  return k.replace(BOM, '').trim();
}

/** Map CSV LeadBank to values that match frontend selectedLeadPool normalization (lowercase, no spaces/dashes). */
function normalizeLeadBankForFrontend(raw: string): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'in town' || v === 'intown') return 'In Town';
  if (v === 'road trip' || v === 'roadtrip') return 'Road Trip';
  if (v === 'list lead pool' || v === 'listleadpool' || v === 'list') return 'list';
  if (v === 'lapse lead pool' || v === 'lapseleadpool' || v === 'lapse') return 'lapse';
  return raw.trim();
}
function getCsvVal(row: Record<string, unknown>, ...keys: string[]): string {
  const normRow = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normKey(k), v])
  );
  for (const k of keys) {
    const v = normRow[k] ?? row[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function rowToPayload(row: Record<string, unknown>): Record<string, unknown> {
  const phone = getCsvVal(row, 'PrimaryPhone', 'primaryphone') || getCsvVal(row, 'CellPhone', 'cellphone');
  const associateIdRaw = getCsvVal(row, 'AssociateID', 'Associate ID', 'associateid', 'associate_id');
  const associateId = associateIdRaw ? parseInt(associateIdRaw, 10) : null;
  if (associateId !== null && isNaN(associateId)) throw new Error(`Invalid AssociateID: ${associateIdRaw}`);

  const leadBankRaw = getCsvVal(row, 'LeadBank', 'leadbank');
  const aoLeadBox = normalizeLeadBankForFrontend(leadBankRaw);

  return {
    taalk_lead_id: getCsvVal(row, 'LeadID', 'leadid') || null,
    associate_id: associateId,
    ao_lead_box: aoLeadBox,
    first_name: getCsvVal(row, 'FirstName', 'firstname') || null,
    last_name: getCsvVal(row, 'LastName', 'lastname') || null,
    phone: phone || null,
    email: getCsvVal(row, 'PrimaryEmail', 'primaryemail') || null,
    state: getCsvVal(row, 'StateCode', 'statecode') || null,
    taalk_state: getCsvVal(row, 'StateCode', 'statecode') || null,
    taalk_group_code: getCsvVal(row, 'GroupCode', 'groupcode') || null,
    taalk_groupname: getCsvVal(row, 'GroupName', 'groupname') || null,
    taalk_market: getCsvVal(row, 'GroupMarketName', 'groupmarketname') || null,
    date_of_birth: getCsvVal(row, 'DateOfBirth', 'dateofbirth') || null,
    taalk_reffered: getCsvVal(row, 'Referred', 'referred') || null,
    taalk_sponsor_org: getCsvVal(row, 'SponsorOrg', 'sponsororg') || null,
    taalk_relationship: getCsvVal(row, 'Relationship', 'relationship') || null,
    taalk_beneficiary: getCsvVal(row, 'Beneficiary', 'beneficiary') || null,
    taalk_secretkey: getCsvVal(row, 'SecurityKeyword', 'securitykeyword') || null,
  };
}

function parseCsv(filePath: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolvePromise, reject) => {
    const rows: Record<string, unknown>[] = [];
    createReadStream(filePath)
      .pipe(csv({ skipLines: 0 }))
      .on('data', (row: Record<string, unknown>) => rows.push(row))
      .on('end', () => resolvePromise(rows))
      .on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.filter((a) => a !== '--dry-run')[0];
  const csvPath = resolve(fileArg || 'cqtestleads.csv');

  console.log('📂 CSV path:', csvPath);
  if (dryRun) console.log('🔍 DRY RUN – no Supabase writes\n');

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  let rows: Record<string, unknown>[];
  try {
    rows = await parseCsv(csvPath);
  } catch (e) {
    console.error('❌ Failed to read CSV:', e);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log('No rows in CSV.');
    return;
  }
  // Dedupe by LeadID – last wins
  const byLeadId = new Map<string, Record<string, unknown>>();
  let skipped = 0;
  for (const row of rows) {
    const leadId = getCsvVal(row, 'LeadID', 'leadid');
    if (!leadId) {
      skipped++;
      continue;
    }
    try {
      byLeadId.set(leadId, rowToPayload(row));
    } catch (err) {
      console.warn('Skipping row with invalid data:', err);
      skipped++;
    }
  }

  const payloads = Array.from(byLeadId.entries()).map(([taalk_lead_id, p]) => ({ ...p, taalk_lead_id }));
  console.log(`📊 CSV rows: ${rows.length}, unique LeadIDs: ${payloads.length}, skipped: ${skipped}`);
  const sample = payloads[0];
  if (sample) {
    console.log(`📌 Sample payload associate_id: ${sample.associate_id} (taalk_lead_id: ${sample.taalk_lead_id}, ao_lead_box: ${sample.ao_lead_box})\n`);
  }

  if (dryRun) {
    console.log('Would process', payloads.length, 'leads (update or insert by taalk_lead_id).');
    return;
  }

  const leadIds = payloads.map((p) => p.taalk_lead_id as string);
  const existingMap = new Map<string, { id: number }>();

  for (let i = 0; i < leadIds.length; i += BATCH_SELECT_SIZE) {
    const chunk = leadIds.slice(i, i + BATCH_SELECT_SIZE);
    const { data, error } = await supabaseAdmin
      .from('masterlead')
      .select('id, taalk_lead_id')
      .in('taalk_lead_id', chunk);
    if (error) {
      console.error('❌ Error fetching existing leads:', error);
      process.exit(1);
    }
    for (const row of data ?? []) {
      const tid = row.taalk_lead_id as string;
      if (tid != null) existingMap.set(String(tid), { id: row.id as number });
    }
  }

  const toUpdate: { id: number; payload: Record<string, unknown> }[] = [];
  const toInsert: Record<string, unknown>[] = [];
  for (const payload of payloads) {
    const taalkLeadId = payload.taalk_lead_id as string;
    const existing = existingMap.get(taalkLeadId);
    if (existing) {
      toUpdate.push({
        id: existing.id,
        payload: {
          ...payload,
          associate_id: payload.associate_id ?? null,
          updated_at: new Date().toISOString(),
        },
      });
    } else {
      toInsert.push({
        ...payload,
        associate_id: payload.associate_id ?? null,
        cnresolution: 'pending',
        status: 'pending',
        updated_at: new Date().toISOString(),
      });
    }
  }

  let updated = 0;
  let inserted = 0;
  let errors = 0;

  // Run updates in parallel batches (Supabase has no bulk update with per-row values)
  for (let i = 0; i < toUpdate.length; i += BATCH_UPDATE_CONCURRENCY) {
    const chunk = toUpdate.slice(i, i + BATCH_UPDATE_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async ({ id, payload }) => {
        const { error } = await masterleadClient.from('masterlead').update(payload).eq('id', id);
        return error;
      })
    );
    const chunkErrors = results.filter(Boolean);
    updated += chunk.length - chunkErrors.length;
    errors += chunkErrors.length;
    if (chunkErrors.length > 0) {
      chunkErrors.slice(0, 3).forEach((e: any) => console.error('Update failed:', e?.message));
    }
    if ((i + chunk.length) % 5000 === 0 || i + chunk.length === toUpdate.length) {
      console.log(`  … updated ${Math.min(i + chunk.length, toUpdate.length)} / ${toUpdate.length}`);
    }
  }

  // Bulk insert in batches
  for (let i = 0; i < toInsert.length; i += BATCH_INSERT_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_INSERT_SIZE);
    const { error } = await masterleadClient.from('masterlead').insert(batch);
    if (error) {
      console.error(`Insert batch at ${i} failed:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
    if ((i + batch.length) % 5000 === 0 || i + batch.length === toInsert.length) {
      console.log(`  … inserted ${Math.min(i + batch.length, toInsert.length)} / ${toInsert.length}`);
    }
  }

  console.log('✅ Updated:', updated, '| Inserted:', inserted, '| Errors:', errors);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
