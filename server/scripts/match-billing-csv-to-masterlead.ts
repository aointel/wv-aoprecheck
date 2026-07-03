/**
 * Enrich billing_transactions export CSV with masterlead: taalk_lead_id, lead id, DB phone, names.
 *
 * Input CSV (Supabase export) has taalk_call_id, lead_phone, phone_number, metadata (JSON may contain Leadid).
 *
 * Match order: (1) metadata / taalk_call_id as taalk_lead_id on masterlead, (2) masterlead by phone,
 * (3) vdp_calls.sessionID = taalk_call_id → leadid → masterlead or vdp phone → masterlead,
 * (4) twilio_call_logs by phone → lead_id / taalk_lead_id → masterlead,
 * (5) billing_transactions.id → metadata / stored fields → masterlead.
 *
 * Run:
 *   npx tsx server/scripts/match-billing-csv-to-masterlead.ts [path-to.csv]
 *
 * Default input: %USERPROFILE%/Downloads/billing_transactions_rows (6).csv
 * Output: server/scripts/output/billing-masterlead-match-<timestamp>.csv
 */
import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";
import { supabaseAdmin } from "../supabase.js";

function normalize10(phone: string | null | undefined): string {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

function csvEscape(val: string | number | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function metadataToRecord(metadataRaw: unknown): Record<string, unknown> | null {
  if (metadataRaw == null) return null;
  if (typeof metadataRaw === "object" && !Array.isArray(metadataRaw)) {
    return metadataRaw as Record<string, unknown>;
  }
  const s = String(metadataRaw).trim();
  if (!s) return null;
  try {
    const m = JSON.parse(s) as Record<string, unknown>;
    return typeof m === "object" && m != null && !Array.isArray(m) ? m : null;
  } catch {
    return null;
  }
}

function extractMetadataLeadid(metadataRaw: unknown): string | null {
  const m = metadataToRecord(metadataRaw);
  if (!m) return null;
  const v =
    m.Leadid ??
    m.leadid ??
    m.lead_id ??
    m.taalk_lead_id ??
    m.Taalk_Leadid;
  if (v == null || v === "") return null;
  return String(v).trim();
}

async function readCsvRows(csvPath: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    fs.createReadStream(csvPath, { encoding: "utf8" })
      .pipe(csv())
      .on("data", (row: Record<string, string>) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

type MlRow = {
  id: number;
  taalk_lead_id: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  updated_at: string | null;
};

async function fetchByTaalkLeadIds(ids: string[]): Promise<Map<string, MlRow>> {
  const map = new Map<string, MlRow>();
  if (!supabaseAdmin || ids.length === 0) return map;
  const unique = [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabaseAdmin
      .from("masterlead")
      .select("id, taalk_lead_id, phone, first_name, last_name, updated_at")
      .in("taalk_lead_id", chunk);
    if (error) {
      console.warn("taalk_lead_id batch error:", error.message);
      continue;
    }
    for (const r of (data || []) as MlRow[]) {
      const key = String(r.taalk_lead_id || "").trim();
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || String(r.updated_at || "") > String(prev.updated_at || "")) map.set(key, r);
    }
  }
  return map;
}

async function fetchByPhone(p10: string): Promise<MlRow | null> {
  if (!supabaseAdmin || p10.length !== 10) return null;
  const { data, error } = await supabaseAdmin
    .from("masterlead")
    .select("id, taalk_lead_id, phone, first_name, last_name, updated_at")
    .or(`phone.eq.${p10},phone.eq.+1${p10}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("phone lookup error", p10, error.message);
    return null;
  }
  return (data as MlRow) || null;
}

type VdpSessionRow = {
  sessionID?: string | null;
  sessionid?: string | null;
  leadid?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  firstname?: string | null;
  lastname?: string | null;
};

function vdpSessionKey(r: VdpSessionRow): string {
  return String(r.sessionID ?? r.sessionid ?? "").trim();
}

async function fetchVdpBySessionIds(sessionIds: string[]): Promise<Map<string, VdpSessionRow>> {
  const map = new Map<string, VdpSessionRow>();
  if (!supabaseAdmin || sessionIds.length === 0) return map;
  const unique = [...new Set(sessionIds.map((x) => x.trim()).filter(Boolean))];
  const chunkSize = 100;

  const run = async (col: "sessionID" | "sessionid") => {
    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const { data, error } = await supabaseAdmin!
        .from("vdp_calls")
        .select(`${col}, leadid, phone, firstName, lastName, firstname, lastname`)
        .in(col, chunk);
      if (error) return error;
      for (const raw of (data || []) as VdpSessionRow[]) {
        const k = vdpSessionKey(raw);
        if (k) map.set(k, raw);
      }
    }
    return null as { message?: string } | null;
  };

  let err = await run("sessionID");
  if (err) {
    map.clear();
    err = await run("sessionid");
  }
  if (err) console.warn("vdp_calls session batch:", err.message);
  return map;
}

/** Index masterlead rows by both id and taalk_lead_id (string keys). */
function indexMlRows(rows: MlRow[], into: Map<string, MlRow>) {
  for (const r of rows) {
    into.set(String(r.id), r);
    const tl = String(r.taalk_lead_id || "").trim();
    if (tl) {
      const prev = into.get(tl);
      if (!prev || String(r.updated_at || "") > String(prev.updated_at || "")) into.set(tl, r);
    }
  }
}

async function fetchMasterleadByLeadKeys(keys: string[]): Promise<Map<string, MlRow>> {
  const map = new Map<string, MlRow>();
  if (!supabaseAdmin || keys.length === 0) return map;
  const unique = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabaseAdmin
      .from("masterlead")
      .select("id, taalk_lead_id, phone, first_name, last_name, updated_at")
      .in("taalk_lead_id", chunk);
    if (error) console.warn("masterlead taalk_lead_id (leadkey) batch:", error.message);
    else indexMlRows((data || []) as MlRow[], map);
  }
  const numericIds = unique.filter((k) => /^\d+$/.test(k)).map((k) => parseInt(k, 10));
  for (let i = 0; i < numericIds.length; i += chunkSize) {
    const chunk = numericIds.slice(i, i + chunkSize);
    const { data, error } = await supabaseAdmin
      .from("masterlead")
      .select("id, taalk_lead_id, phone, first_name, last_name, updated_at")
      .in("id", chunk);
    if (error) console.warn("masterlead id (leadkey) batch:", error.message);
    else indexMlRows((data || []) as MlRow[], map);
  }
  return map;
}

type TwilioRef = { lead_id: string | null; taalk_lead_id: string | null };

async function fetchTwilioRefsByPhones(p10s: string[]): Promise<Map<string, TwilioRef>> {
  const map = new Map<string, TwilioRef>();
  if (!supabaseAdmin || p10s.length === 0) return map;
  let n = 0;
  for (const p10 of p10s) {
    const { data, error } = await supabaseAdmin
      .from("twilio_call_logs")
      .select("lead_id, taalk_lead_id")
      .or(`from_number.ilike.%${p10},to_number.ilike.%${p10}`)
      .order("call_started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    n += 1;
    if (n % 50 === 0) process.stdout.write(`\r   Twilio log lookups: ${n}/${p10s.length}`);
    if (error) continue;
    const row = data as { lead_id?: string | null; taalk_lead_id?: string | null } | null;
    if (row && (row.lead_id != null && row.lead_id !== "" || row.taalk_lead_id != null && row.taalk_lead_id !== "")) {
      map.set(p10, {
        lead_id: row.lead_id != null ? String(row.lead_id) : null,
        taalk_lead_id: row.taalk_lead_id != null ? String(row.taalk_lead_id) : null,
      });
    }
  }
  if (p10s.length > 0) console.log(`\r   Twilio log lookups: ${p10s.length}/${p10s.length}`);
  return map;
}

type BillingLite = {
  id?: string | number;
  metadata?: string | Record<string, unknown> | null;
  taalk_call_id?: string | null;
  lead_phone?: string | null;
};

async function fetchBillingByIds(ids: string[]): Promise<Map<string, BillingLite>> {
  const map = new Map<string, BillingLite>();
  if (!supabaseAdmin || ids.length === 0) return map;
  const numeric = [...new Set(ids.map((id) => parseInt(String(id), 10)).filter((n) => Number.isFinite(n)))];
  const chunkSize = 100;
  for (let i = 0; i < numeric.length; i += chunkSize) {
    const chunk = numeric.slice(i, i + chunkSize);
    let { data, error } = await supabaseAdmin
      .from("billing_transactions")
      .select("id, metadata, taalk_call_id, lead_phone")
      .in("id", chunk);
    if (error?.message?.includes("taalk_call_id") || error?.message?.includes("column")) {
      ({ data, error } = await supabaseAdmin
        .from("billing_transactions")
        .select("id, metadata, lead_phone")
        .in("id", chunk));
    }
    if (error) {
      console.warn("billing_transactions batch:", error.message);
      continue;
    }
    for (const r of (data || []) as BillingLite[]) {
      if (r.id != null) map.set(String(r.id), r);
    }
  }
  return map;
}

async function main() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const defaultCsv = path.join(home, "Downloads", "billing_transactions_rows (6).csv");
  const csvPath = path.resolve(process.argv[2] || defaultCsv);

  if (!fs.existsSync(csvPath)) {
    console.error("❌ File not found:", csvPath);
    process.exit(1);
  }
  if (!supabaseAdmin) {
    console.error("❌ supabaseAdmin not configured (check hardcoded-config / env).");
    process.exit(1);
  }

  console.log("📥 Reading:", csvPath);
  const rows = await readCsvRows(csvPath);
  console.log("   Rows:", rows.length);

  const taalkKeys = new Set<string>();
  const phones = new Set<string>();
  for (const row of rows) {
    const metaId = extractMetadataLeadid(row.metadata);
    if (metaId) taalkKeys.add(metaId);
    const tc = (row.taalk_call_id || "").trim();
    if (tc) taalkKeys.add(tc);
    const p = normalize10(row.lead_phone || row.phone_number);
    if (p.length === 10) phones.add(p);
  }

  console.log("🔎 Unique taalk_lead_id keys (metadata + taalk_call_id):", taalkKeys.size);
  console.log("🔎 Unique phones (10-digit):", phones.size);

  const byTaalk = await fetchByTaalkLeadIds([...taalkKeys]);

  const byPhone = new Map<string, MlRow>();
  let pDone = 0;
  for (const p10 of phones) {
    const ml = await fetchByPhone(p10);
    if (ml) byPhone.set(p10, ml);
    pDone += 1;
    if (pDone % 100 === 0) process.stdout.write(`\r   Phone lookups: ${pDone}/${phones.size}`);
  }
  if (phones.size > 0) console.log(`\r   Phone lookups: ${phones.size}/${phones.size}`);

  const taalkCallIds = [...new Set(rows.map((r) => (r.taalk_call_id || "").trim()).filter(Boolean))];
  console.log("🔎 Loading vdp_calls by sessionID…");
  const vdpBySession = await fetchVdpBySessionIds(taalkCallIds);

  const leadKeysFromVdp = new Set<string>();
  for (const v of vdpBySession.values()) {
    const lid = String(v.leadid || "").trim();
    if (lid) leadKeysFromVdp.add(lid);
  }
  console.log("🔎 Unique vdp_calls.leadid values:", leadKeysFromVdp.size);
  const mlByLeadKey = await fetchMasterleadByLeadKeys([...leadKeysFromVdp]);

  const outCols = [
    "billing_id",
    "transaction_id",
    "taalk_call_id",
    "csv_lead_phone",
    "csv_phone_number",
    "phone_norm_10",
    "metadata_leadid",
    "match_source",
    "masterlead_id",
    "masterlead_taalk_lead_id",
    "masterlead_phone",
    "masterlead_first_name",
    "masterlead_last_name",
    "phone_matches_csv",
  ];

  type Resolved = { ml: MlRow | null; matchSource: string };
  const resolved: Resolved[] = [];

  let byTaalkMeta = 0;
  let byTaalkCall = 0;
  let byPhoneOnly = 0;
  let byVdpLeadid = 0;
  let byVdpPhone = 0;
  let byTwilioLog = 0;
  let byBillingMeta = 0;

  const resolvePrimary = (row: Record<string, string>): Resolved => {
    const taalkCallId = (row.taalk_call_id || "").trim();
    const csvPhone = row.lead_phone || "";
    const csvPhoneAlt = row.phone_number || "";
    const p10 = normalize10(csvPhone || csvPhoneAlt);
    const metaLead = extractMetadataLeadid(row.metadata);

    if (metaLead && byTaalk.get(metaLead)) {
      byTaalkMeta += 1;
      return { ml: byTaalk.get(metaLead)!, matchSource: "metadata_Leadid" };
    }
    if (taalkCallId && byTaalk.get(taalkCallId)) {
      byTaalkCall += 1;
      return { ml: byTaalk.get(taalkCallId)!, matchSource: "taalk_call_id_as_taalk_lead_id" };
    }
    if (p10.length === 10 && byPhone.get(p10)) {
      byPhoneOnly += 1;
      return { ml: byPhone.get(p10)!, matchSource: "masterlead_phone" };
    }
    return { ml: null, matchSource: "" };
  };

  for (const row of rows) {
    resolved.push(resolvePrimary(row));
  }

  for (let i = 0; i < rows.length; i++) {
    if (resolved[i].ml) continue;
    const taalkCallId = (rows[i].taalk_call_id || "").trim();
    const vdp = taalkCallId ? vdpBySession.get(taalkCallId) : undefined;
    if (!vdp) continue;
    const lid = String(vdp.leadid || "").trim();
    if (lid && mlByLeadKey.get(lid)) {
      resolved[i] = { ml: mlByLeadKey.get(lid)!, matchSource: "vdp_session_leadid" };
      byVdpLeadid += 1;
      continue;
    }
    const vPhone = normalize10(vdp.phone || "");
    if (vPhone.length === 10 && byPhone.get(vPhone)) {
      resolved[i] = { ml: byPhone.get(vPhone)!, matchSource: "vdp_session_phone" };
      byVdpPhone += 1;
    }
  }

  const phonesNeedingTwilio: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (resolved[i].ml) continue;
    const p10 = normalize10(rows[i].lead_phone || rows[i].phone_number);
    if (p10.length === 10) phonesNeedingTwilio.push(p10);
  }
  const uniqueTwilioPhones = [...new Set(phonesNeedingTwilio)];
  console.log("🔎 Twilio call_logs fallback phones:", uniqueTwilioPhones.length);
  const twilioByPhone = await fetchTwilioRefsByPhones(uniqueTwilioPhones);

  const twilioKeys = new Set<string>();
  for (const ref of twilioByPhone.values()) {
    if (ref.lead_id) twilioKeys.add(String(ref.lead_id).trim());
    if (ref.taalk_lead_id) twilioKeys.add(String(ref.taalk_lead_id).trim());
  }
  const mlByTwilioKey = await fetchMasterleadByLeadKeys([...twilioKeys]);

  for (let i = 0; i < rows.length; i++) {
    if (resolved[i].ml) continue;
    const p10 = normalize10(rows[i].lead_phone || rows[i].phone_number);
    if (p10.length !== 10) continue;
    const ref = twilioByPhone.get(p10);
    if (!ref) continue;
    const tl = ref.taalk_lead_id?.trim();
    const lid = ref.lead_id?.trim();
    const ml =
      (tl ? mlByTwilioKey.get(tl) : null) ||
      (lid ? mlByTwilioKey.get(lid) : null) ||
      null;
    if (ml) {
      resolved[i] = { ml, matchSource: "twilio_call_logs_lead" };
      byTwilioLog += 1;
    }
  }

  const billingIdsNeeding = rows
    .map((r, i) => (!resolved[i].ml && r.id ? String(r.id).trim() : ""))
    .filter(Boolean);
  const uniqueBillingIds = [...new Set(billingIdsNeeding)];
  console.log("🔎 billing_transactions fallback rows:", uniqueBillingIds.length);
  const billingById = await fetchBillingByIds(uniqueBillingIds);

  const billingMetaKeys = new Set<string>();
  for (const b of billingById.values()) {
    const mid = extractMetadataLeadid(b.metadata ?? undefined);
    if (mid) billingMetaKeys.add(mid);
    const m = metadataToRecord(b.metadata) ?? {};
    for (const k of ["lead_id", "leadId", "taalk_lead_id", "taalkLeadId"] as const) {
      const v = m[k];
      if (v != null && String(v).trim()) billingMetaKeys.add(String(v).trim());
    }
  }
  const mlByBillingMeta = await fetchMasterleadByLeadKeys([...billingMetaKeys]);

  for (let i = 0; i < rows.length; i++) {
    if (resolved[i].ml) continue;
    const bid = String(rows[i].id || "").trim();
    if (!bid) continue;
    const b = billingById.get(bid);
    if (!b) continue;
    const mid = extractMetadataLeadid(b.metadata ?? undefined);
    let ml: MlRow | null = null;
    if (mid) ml = mlByBillingMeta.get(mid) ?? null;
    if (!ml) {
      const m = metadataToRecord(b.metadata);
      if (m) {
        for (const key of ["lead_id", "leadId", "taalk_lead_id", "taalkLeadId"] as const) {
          const v = m[key];
          if (v == null) continue;
          const s = String(v).trim();
          const hit = mlByBillingMeta.get(s);
          if (hit) {
            ml = hit;
            break;
          }
        }
      }
    }
    if (ml) {
      resolved[i] = { ml, matchSource: "billing_transactions_metadata" };
      byBillingMeta += 1;
    }
  }

  let none = 0;
  const lines: string[] = [outCols.join(",")];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { ml, matchSource } = resolved[i];
    if (!ml) none += 1;

    const billingId = row.id ?? "";
    const transactionId = row.transaction_id ?? "";
    const taalkCallId = (row.taalk_call_id || "").trim();
    const csvPhone = row.lead_phone || "";
    const csvPhoneAlt = row.phone_number || "";
    const p10 = normalize10(csvPhone || csvPhoneAlt);
    const metaLead = extractMetadataLeadid(row.metadata);

    const mlPhoneNorm = ml ? normalize10(ml.phone) : "";
    const phoneMatches =
      ml && p10.length === 10 && mlPhoneNorm === p10 ? "yes" : ml && p10.length === 10 ? "no" : "";

    lines.push(
      [
        csvEscape(billingId),
        csvEscape(transactionId),
        csvEscape(taalkCallId),
        csvEscape(csvPhone),
        csvEscape(csvPhoneAlt),
        csvEscape(p10),
        csvEscape(metaLead),
        csvEscape(matchSource),
        csvEscape(ml?.id ?? ""),
        csvEscape(ml?.taalk_lead_id ?? ""),
        csvEscape(ml?.phone || ""),
        csvEscape(ml?.first_name ?? ""),
        csvEscape(ml?.last_name ?? ""),
        csvEscape(phoneMatches),
      ].join(","),
    );
  }

  const outDir = path.join(process.cwd(), "server", "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `billing-masterlead-match-${Date.now()}.csv`);
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  console.log("\n✅ Wrote:", outPath);
  console.log("   metadata_Leadid:", byTaalkMeta);
  console.log("   taalk_call_id as taalk_lead_id:", byTaalkCall);
  console.log("   masterlead_phone:", byPhoneOnly);
  console.log("   vdp_session_leadid:", byVdpLeadid);
  console.log("   vdp_session_phone:", byVdpPhone);
  console.log("   twilio_call_logs_lead:", byTwilioLog);
  console.log("   billing_transactions_metadata:", byBillingMeta);
  console.log("   No match:", none);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
