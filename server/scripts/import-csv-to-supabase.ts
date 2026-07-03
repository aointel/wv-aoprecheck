/**
 * Import billing_transactions into Supabase; import masterlead into Postgres (DATABASE_URL).
 * Run: npx tsx server/scripts/import-csv-to-supabase.ts [--billing=path] [--masterlead=path]
 * Defaults: db/billing_transactions_rows.csv, db/masterlead_rows (23).csv (or first masterlead_rows*.csv in db/)
 */

import * as fs from "fs";
import * as path from "path";
import { createReadStream } from "fs";
import csvParser from "csv-parser";
import { supabaseAdmin } from "../supabase";
import { masterleadClient } from "../local-masterlead-client";

const DEFAULT_BILLING_CSV = path.join(process.cwd(), "db", "billing_transactions_rows.csv");

function readCsvRows<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const rows: T[] = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row: T) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

function parseMeta(s: unknown): unknown {
  if (s == null || s === "") return null;
  const str = String(s);
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

async function importBilling(csvPath: string) {
  if (!supabaseAdmin) {
    console.error("No Supabase admin client");
    return;
  }
  const rows = await readCsvRows<Record<string, string>>(csvPath);
  console.log(`Billing CSV: ${rows.length} rows`);

  const BATCH = 200;
  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const payloads = batch.map((o) => ({
      transaction_id: o.transaction_id ?? `import-${Date.now()}-${i}`,
      agent_email: o.agent_email ?? "unknown@aoglobelife.com",
      agent_associate_id: o.agent_associate_id ? parseInt(o.agent_associate_id, 10) : null,
      agent_name: o.agent_name ?? null,
      transaction_type: o.transaction_type ?? "connect",
      transaction_date: o.transaction_date ?? new Date().toISOString(),
      amount_usd: parseFloat(o.amount_usd || "0") || 8,
      credits_charged: parseInt(o.credits_charged || "0", 10) || 0,
      lead_name: o.lead_name ?? null,
      lead_phone: o.lead_phone ?? null,
      lead_email: o.lead_email ?? null,
      source_table: o.source_table ?? null,
      source_id: o.source_id ? parseInt(o.source_id, 10) : null,
      description: o.description ?? null,
      notes: o.notes ?? null,
      metadata: parseMeta(o.metadata),
      status: o.status ?? "completed",
      created_at: o.created_at ?? new Date().toISOString(),
      updated_at: o.updated_at ?? new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from("billing_transactions")
      .upsert(payloads, { onConflict: "transaction_id", ignoreDuplicates: false });

    if (error) {
      console.error("Billing batch error:", error.message);
      skipped += batch.length;
    } else {
      inserted += payloads.length;
    }
    if ((i + BATCH) % 1000 === 0 || i + BATCH >= rows.length) {
      console.log(`  Billing: ${inserted} upserted`);
    }
  }
  console.log(`Billing import done: ${inserted} rows upserted.`);
}

async function importMasterlead(csvPath: string) {
  const rows = await readCsvRows<Record<string, string>>(csvPath);
  console.log(`Masterlead CSV: ${rows.length} rows.`);

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const payloads = batch.map((o) => ({
      first_name: o.first_name ?? null,
      last_name: o.last_name ?? null,
      phone: o.phone ?? null,
      email: o.email ?? null,
      address: o.address ?? null,
      city: o.city ?? null,
      state: o.state ?? null,
      zip: o.zip ?? null,
      created_at: o.created_at || null,
      updated_at: o.updated_at || null,
      last_contacted: o.last_contacted || null,
      dnc: String(o.dnc || "").toLowerCase() === "true",
      status: o.status ?? "pending",
      disposition_notes: o.disposition_notes ?? null,
      cn_email: o.cn_email ?? null,
      cnresolution: o.cnresolution ?? "pending",
      taalk_lead_id: o.taalk_lead_id ?? null,
      taalk_market: o.taalk_market ?? null,
      taalk_sponsor_org: o.taalk_sponsor_org ?? null,
      is_hot_lead: String(o.is_hot_lead || o.isHotLead || "").toLowerCase() === "true",
      priority_score: o.priority_score != null && o.priority_score !== "" ? parseInt(o.priority_score, 10) : 1,
      associate_id: o.associate_id != null && o.associate_id !== "" ? parseInt(o.associate_id, 10) : null,
    }));

    const { error } = await masterleadClient.from("masterlead").insert(payloads);
    if (error) {
      console.error("Masterlead batch error:", error.message);
    } else {
      inserted += payloads.length;
    }
    if ((i + BATCH) % 500 === 0 || i + BATCH >= rows.length) {
      console.log(`  Masterlead: ${inserted} inserted`);
    }
  }
  console.log(`Masterlead import done: ${inserted} rows.`);
}

async function main() {
  const args = process.argv.slice(2);
  let billingPath = DEFAULT_BILLING_CSV;
  let masterleadPath = "";

  for (const a of args) {
    if (a.startsWith("--billing=")) billingPath = a.slice("--billing=".length).trim();
    if (a.startsWith("--masterlead=")) masterleadPath = a.slice("--masterlead=".length).trim();
  }

  if (!fs.existsSync(billingPath)) {
    const alt = path.join(process.cwd(), "billing_transactions_rows.csv");
    if (fs.existsSync(alt)) billingPath = alt;
  }

  if (billingPath && fs.existsSync(billingPath)) {
    await importBilling(billingPath);
  } else {
    console.log("No billing CSV found at", billingPath, "- skip billing.");
  }

  if (!masterleadPath) {
    const dbDir = path.join(process.cwd(), "db");
    if (fs.existsSync(dbDir)) {
      const files = fs.readdirSync(dbDir).filter((f) => f.startsWith("masterlead_rows") && f.endsWith(".csv"));
      if (files.length > 0) masterleadPath = path.join(dbDir, files[0]!);
    }
  }
  if (masterleadPath && fs.existsSync(masterleadPath)) {
    await importMasterlead(masterleadPath);
  } else {
    console.log("No masterlead CSV found - skip masterlead.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
