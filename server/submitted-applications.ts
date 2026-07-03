/**
 * Submitted Applications: parse pasted portal data and match to connects (billing) / booked (agent_dial_metrics).
 * No phone from portal — match by insured name + agent + date window.
 */

import { supabaseAdmin } from "./supabase";
import { masterleadClient } from "./local-masterlead-client";

export interface SubmittedApplicationRow {
  insured: string | null;
  agent_release: string | null; // ISO or parseable
  sga_submit: string | null;
  tenure: string | null;
  policy_number: string | null;
  lob: string | null;
  cwa: string | null;
  submit_type: string | null;
  nilico_status: string | null;
  agent: string | null;
  office: string | null;
  qa_specialist: string | null;
  director: string | null;
  telecheck: string | null;
  verification_result: string | null;
  submitted_by: string | null;
  mac_status: string | null;
}

/** Parse CWA string (e.g. "$72.68" or "72.68") to number. Returns 0 if invalid. */
export function parseCwaToNumber(cwa: string | null | undefined): number {
  if (cwa == null || typeof cwa !== "string") return 0;
  const n = parseFloat(String(cwa).replace(/[$,]/g, "").trim());
  return isNaN(n) ? 0 : n;
}

/** ALP = CWA × 12 (annualized). Only for Life LOB; otherwise null. */
export function computeAlp(lob: string | null | undefined, cwa: string | null | undefined): number | null {
  if (!lob || typeof lob !== "string") return null;
  if (lob.trim().toLowerCase() !== "life") return null;
  const c = parseCwaToNumber(cwa);
  return c === 0 ? null : c * 12;
}

const PORTAL_COLUMNS = [
  "insured",
  "agent_release",
  "sga_submit",
  "tenure",
  "policy_number",
  "lob",
  "cwa",
  "submit_type",
  "nilico_status",
  "agent",
  "office",
  "qa_specialist",
  "director",
  "telecheck",
  "verification_result",
  "submitted_by",
  "mac_status",
] as const;

function parseDate(s: string | null | undefined): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  // "2/2/2026 8:12:02 PM" or "02/04/2026 10:42:30 AM"
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Parse pasted table text (tab or newline-separated; first row may be header).
 * Returns array of row objects keyed by PORTAL_COLUMNS.
 */
export function parsePastedSubmittedApplications(pasted: string): SubmittedApplicationRow[] {
  const lines = pasted
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const rows: SubmittedApplicationRow[] = [];
  const sep = lines[0].includes("\t") ? "\t" : /\t/.test(lines[0]) ? "\t" : ",";
  let start = 0;

  // If first line looks like header (Insured, Agent Release, ...), skip it
  const firstCells = lines[0].split(sep).map((c) => c.trim().toLowerCase());
  if (
    firstCells[0] === "insured" ||
    firstCells[0] === "agent release" ||
    firstCells.some((c) => c === "policy #" || c === "policy #")
  ) {
    start = 1;
  }

  for (let i = start; i < lines.length; i++) {
    const cells = lines[i].split(sep).map((c) => c.trim());
    const row: SubmittedApplicationRow = {
      insured: cells[0] ?? null,
      agent_release: parseDate(cells[1]) ?? cells[1] ?? null,
      sga_submit: parseDate(cells[2]) ?? cells[2] ?? null,
      tenure: cells[3] ?? null,
      policy_number: cells[4] ?? null,
      lob: cells[5] ?? null,
      cwa: cells[6] ?? null,
      submit_type: cells[7] ?? null,
      nilico_status: cells[8] ?? null,
      agent: cells[9] ?? null,
      office: cells[10] ?? null,
      qa_specialist: cells[11] ?? null,
      director: cells[12] ?? null,
      telecheck: cells[13] ?? null,
      verification_result: cells[14] ?? null,
      submitted_by: cells[15] ?? null,
      mac_status: cells[16] ?? null,
    };
    // Skip empty rows (no insured and no policy)
    if (!row.insured && !row.policy_number) continue;
    rows.push(row);
  }

  return rows;
}

/** Normalize name for matching: uppercase, collapse spaces, optional "LAST,FIRST" -> "LAST FIRST" */
export function normalizeName(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "";
  return name
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Map portal agent string "LAST, FIRST - CODE" to agent_email. Look up by last name in customers, then agent_profiles. */
export async function resolveAgentEmail(agentStr: string | null | undefined): Promise<string | null> {
  if (!agentStr || !supabaseAdmin) return null;
  const trimmed = agentStr.trim();
  if (!trimmed) return null;

  // "MORROW, TYJERE - AWG57" -> last = morrow, first = tyjere
  const namePart = trimmed.replace(/\s*-\s*[A-Z0-9]+\s*$/i, "").trim();
  const [lastPart, firstPart] = namePart.split(/\s*,\s*/).map((s) => s?.trim() || "");
  const last = (lastPart ?? "").toLowerCase();
  const first = (firstPart ?? "").toLowerCase();
  if (!last) return null;

  const pickEmail = (c: { company_email?: string | null; personal_email?: string | null; email?: string | null }) =>
    (c as { company_email?: string | null; personal_email?: string | null }).company_email ||
    (c as { personal_email?: string | null }).personal_email ||
    (c as { email?: string | null }).email ||
    null;

  // 1) Customers by last name
  const { data: custRows } = await supabaseAdmin
    .from("customers")
    .select("company_email, personal_email, first_name, last_name")
    .ilike("last_name", last)
    .or("company_email.not.is.null,personal_email.not.is.null")
    .limit(20);

  const custCandidates = custRows ?? [];
  if (custCandidates.length === 1) return pickEmail(custCandidates[0]);
  if (custCandidates.length > 1 && first) {
    const byFirst = custCandidates.find((c) => {
      const fn = (c.first_name || "").toLowerCase();
      return fn && (fn.includes(first) || first.includes(fn));
    });
    if (byFirst) return pickEmail(byFirst);
  }
  if (custCandidates.length > 0) return pickEmail(custCandidates[0]);

  // 2) Fallback: agent_profiles by last name
  const { data: profileRows } = await supabaseAdmin
    .from("agent_profiles")
    .select("email, first_name, last_name")
    .ilike("last_name", last)
    .not("email", "is", null)
    .limit(20);

  const profileCandidates = profileRows ?? [];
  if (profileCandidates.length === 1) return (profileCandidates[0].email || "").toLowerCase() || null;
  if (profileCandidates.length > 1 && first) {
    const byFirst = profileCandidates.find((c) => {
      const fn = (c.first_name || "").toLowerCase();
      return fn && (fn.includes(first) || first.includes(fn));
    });
    if (byFirst) return (byFirst.email || "").toLowerCase() || null;
  }
  if (profileCandidates.length > 0) return (profileCandidates[0].email || "").toLowerCase() || null;

  // 3) Fallback: agent_hierarchy by agent_name (e.g. "LAST, FIRST" or "First Last") so MGA lookup works
  const { data: hierRows } = await supabaseAdmin
    .from("agent_hierarchy")
    .select("agent_email, agent_name")
    .not("agent_email", "is", null)
    .ilike("agent_name", `%${last}%`)
    .limit(20);
  const hierCandidates = hierRows ?? [];
  if (hierCandidates.length === 1) return (hierCandidates[0].agent_email || "").toLowerCase().trim() || null;
  if (hierCandidates.length > 1 && first) {
    const byFirst = hierCandidates.find((h) => {
      const name = (h.agent_name || "").toLowerCase();
      return name && (name.includes(first) || first.includes(name.split(/[\s,]+/)[0] || ""));
    });
    if (byFirst) return (byFirst.agent_email || "").toLowerCase().trim() || null;
  }
  if (hierCandidates.length > 0) return (hierCandidates[0].agent_email || "").toLowerCase().trim() || null;

  return null;
}

/** Match connect/booked if within this many days *before* agent release (never after). */
const DATE_WINDOW_DAYS = 14;

/** Get MGA for an agent email (agent_profiles then agent_hierarchy). */
export async function getMgaForEmail(email: string | null | undefined): Promise<string | null> {
  if (!email || !supabaseAdmin) return null;
  const e = email.toLowerCase().trim();
  const { data: profile } = await supabaseAdmin
    .from("agent_profiles")
    .select("mga_team")
    .eq("email", e)
    .maybeSingle();
  if (profile?.mga_team) return profile.mga_team.trim() || null;
  const { data: hier } = await supabaseAdmin
    .from("agent_hierarchy")
    .select("mga_name")
    .eq("agent_email", e)
    .maybeSingle();
  return hier?.mga_name?.trim() || null;
}

/** Normalize portal agent string "LAST, FIRST - CODE" to comparable form (lowercase "last, first"). */
function normalizePortalAgentForCompare(agentStr: string | null | undefined): string | null {
  if (!agentStr || typeof agentStr !== "string") return null;
  const namePart = agentStr.trim().replace(/\s*-\s*[A-Z0-9]+\s*$/i, "").trim();
  if (!namePart) return null;
  return namePart.toLowerCase().replace(/\s+/g, " ");
}

/**
 * Get agent "writing name" for an email so we can compare to portal agent string.
 * Look up: customers (company_email/personal_email), then agent_profiles, then agent_hierarchy.
 * Returns normalized "last, first" or agent_name for comparison.
 */
export async function getAgentNameForEmail(email: string | null | undefined): Promise<string | null> {
  if (!email || !supabaseAdmin) return null;
  const e = email.toLowerCase().trim();
  if (!e) return null;

  // 1) Customers: match on company_email or personal_email (check both so @ in email is safe)
  const { data: custByCompany } = await supabaseAdmin
    .from("customers")
    .select("first_name, last_name")
    .eq("company_email", e)
    .limit(1)
    .maybeSingle();
  const cust = custByCompany ?? (await supabaseAdmin
    .from("customers")
    .select("first_name, last_name")
    .eq("personal_email", e)
    .limit(1)
    .maybeSingle()).data;
  if (cust?.last_name) {
    const last = (cust.last_name || "").trim();
    const first = (cust.first_name || "").trim();
    return `${last}, ${first}`.trim().toLowerCase();
  }

  // 2) agent_profiles by email
  const { data: profile } = await supabaseAdmin
    .from("agent_profiles")
    .select("first_name, last_name")
    .eq("email", e)
    .maybeSingle();
  if (profile?.last_name) {
    const last = (profile.last_name || "").trim();
    const first = (profile.first_name || "").trim();
    return `${last}, ${first}`.trim().toLowerCase();
  }

  // 3) agent_hierarchy agent_name (often "LAST, FIRST")
  const { data: hier } = await supabaseAdmin
    .from("agent_hierarchy")
    .select("agent_name")
    .eq("agent_email", e)
    .maybeSingle();
  if (hier?.agent_name) return (hier.agent_name || "").trim().toLowerCase().replace(/\s+/g, " ");

  return null;
}

/** True if connect's agent email resolves to a name that matches the portal agent string. */
export async function connectAgentMatchesPortal(
  connectAgentEmail: string | null | undefined,
  portalAgentStr: string | null | undefined
): Promise<boolean> {
  if (!connectAgentEmail || !portalAgentStr) return false;
  const portalNorm = normalizePortalAgentForCompare(portalAgentStr);
  if (!portalNorm) return false;
  const nameForEmail = await getAgentNameForEmail(connectAgentEmail);
  if (!nameForEmail) return false;
  return namesMatchForSameAgent(portalNorm, nameForEmail);
}

function namesMatchForSameAgent(portalNorm: string, nameForEmail: string): boolean {
  const a = portalNorm.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const b = nameForEmail.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (a === b) return true;
  const aParts = a.split(/\s+/).filter(Boolean);
  const bParts = b.split(/\s+/).filter(Boolean);
  if (aParts.length >= 2 && bParts.length >= 2) {
    const aLast = aParts[aParts.length - 1] ?? "";
    const aFirst = aParts[0] ?? "";
    const bLast = bParts[bParts.length - 1] ?? "";
    const bFirst = bParts[0] ?? "";
    if (aLast === bLast && aFirst === bFirst) return true;
  }
  return false;
}

const BATCH_IN_LIMIT = 100;

/** Batch resolve agent names for many emails (few round trips). Priority: customers > agent_profiles > agent_hierarchy. */
async function batchGetAgentNamesForEmails(emails: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const normalized = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean))];
  if (normalized.length === 0 || !supabaseAdmin) return out;

  const toName = (first: string, last: string) => `${(last || "").trim()}, ${(first || "").trim()}`.trim().toLowerCase();

  for (let i = 0; i < normalized.length; i += BATCH_IN_LIMIT) {
    const chunk = normalized.slice(i, i + BATCH_IN_LIMIT);
    if (chunk.length === 0) continue;
    const { data: cust } = await supabaseAdmin.from("customers").select("company_email, first_name, last_name").in("company_email", chunk);
    for (const r of cust ?? []) {
      const e = (r as { company_email?: string }).company_email?.toLowerCase();
      if (e && !out.has(e)) out.set(e, toName((r as { first_name?: string }).first_name ?? "", (r as { last_name?: string }).last_name ?? ""));
    }
    const { data: custPersonal } = await supabaseAdmin
      .from("customers")
      .select("personal_email, first_name, last_name")
      .in("personal_email", chunk);
    for (const r of custPersonal ?? []) {
      const e = (r as { personal_email?: string }).personal_email?.toLowerCase();
      if (e && !out.has(e)) out.set(e, toName((r as { first_name?: string }).first_name ?? "", (r as { last_name?: string }).last_name ?? ""));
    }
  }
  for (let i = 0; i < normalized.length; i += BATCH_IN_LIMIT) {
    const chunk = normalized.slice(i, i + BATCH_IN_LIMIT);
    if (chunk.length === 0) continue;
    const { data: profile } = await supabaseAdmin.from("agent_profiles").select("email, first_name, last_name").in("email", chunk);
    for (const r of profile ?? []) {
      const e = (r as { email?: string }).email?.toLowerCase();
      if (e && !out.has(e)) out.set(e, toName((r as { first_name?: string }).first_name ?? "", (r as { last_name?: string }).last_name ?? ""));
    }
  }
  for (let i = 0; i < normalized.length; i += BATCH_IN_LIMIT) {
    const chunk = normalized.slice(i, i + BATCH_IN_LIMIT);
    if (chunk.length === 0) continue;
    const { data: hier } = await supabaseAdmin.from("agent_hierarchy").select("agent_email, agent_name").in("agent_email", chunk);
    for (const r of hier ?? []) {
      const e = (r as { agent_email?: string }).agent_email?.toLowerCase();
      if (e && !out.has(e)) out.set(e, ((r as { agent_name?: string }).agent_name || "").trim().toLowerCase().replace(/\s+/g, " "));
    }
  }
  return out;
}

/** Batch resolve MGA for many emails (2 round trips). */
async function batchGetMgaForEmails(emails: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const normalized = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean))];
  if (normalized.length === 0 || !supabaseAdmin) return out;

  for (let i = 0; i < normalized.length; i += BATCH_IN_LIMIT) {
    const chunk = normalized.slice(i, i + BATCH_IN_LIMIT);
    if (chunk.length === 0) continue;
    const { data: profile } = await supabaseAdmin.from("agent_profiles").select("email, mga_team").in("email", chunk);
    for (const r of profile ?? []) {
      const e = (r as { email?: string }).email?.toLowerCase();
      const mga = (r as { mga_team?: string }).mga_team?.trim();
      if (e && !out.has(e) && mga) out.set(e, mga);
    }
  }
  for (let i = 0; i < normalized.length; i += BATCH_IN_LIMIT) {
    const chunk = normalized.slice(i, i + BATCH_IN_LIMIT);
    if (chunk.length === 0) continue;
    const { data: hier } = await supabaseAdmin.from("agent_hierarchy").select("agent_email, mga_name").in("agent_email", chunk);
    for (const r of hier ?? []) {
      const e = (r as { agent_email?: string }).agent_email?.toLowerCase();
      const mga = (r as { mga_name?: string }).mga_name?.trim();
      if (e && !out.has(e) && mga) out.set(e, mga);
    }
  }
  return out;
}

/** Extract portal surname (first segment before comma, or whole insured). For listing/common-name backfill. */
export function getPortalSurname(insured: string | null | undefined): string | null {
  if (!insured || typeof insured !== "string") return null;
  const rawTrimmed = insured.trim();
  const surnameRaw = rawTrimmed.includes(",")
    ? (rawTrimmed.split(",")[0] ?? rawTrimmed).trim()
    : rawTrimmed;
  const surnameNorm = normalizeName(surnameRaw) || surnameRaw;
  const parts = surnameNorm.split(/\s+/).filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? surnameNorm) : surnameNorm;
}

/** Portal insured is LAST NAME ONLY. Build variants for matching lead_name by last name (and exact full if present). */
export function nameToMatchVariants(insured: string | null | undefined): { full: string[]; lastOnly: string[] } {
  if (!insured || typeof insured !== "string") return { full: [], lastOnly: [] };
  const normalized = normalizeName(insured);
  if (!normalized) return { full: [], lastOnly: [] };
  const surname = getPortalSurname(insured);
  if (!surname) return { full: [], lastOnly: [] };
  const surnameNorm = normalizeName(surname) || surname;
  const parts = surnameNorm.split(/\s+/).filter(Boolean);
  const lastOnlyBase = parts.length > 0 ? parts[parts.length - 1]! : surnameNorm;
  const full = [normalized, normalized.toLowerCase(), normalized.toUpperCase(), toTitleCase(normalized.toLowerCase())];
  const lastOnly = [surname, surname.toLowerCase(), surname.toUpperCase(), toTitleCase(surname.toLowerCase())];
  return { full: [...new Set(full)], lastOnly: [...new Set(lastOnly)] };
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** True if connect/booked lead_name matches any of the portal insured name variants (case-insensitive). Match is by full name or by last name only: we use the last word of lead_name as the lead's surname (billing is "First Last"). */
export function leadNameMatchesVariants(
  leadName: string | null | undefined,
  variants: { full: string[]; lastOnly: string[] }
): boolean {
  if (!leadName || typeof leadName !== "string") return false;
  const raw = leadName.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return false;
  const leadLower = raw.toLowerCase();
  const leadParts = raw.split(/\s+/).filter(Boolean);
  const leadLast = leadParts.length > 0 ? leadParts[leadParts.length - 1]!.toLowerCase() : "";
  for (const v of variants.full) {
    if (v && leadLower === v.toLowerCase()) return true;
  }
  for (const v of variants.lastOnly) {
    if (v && leadLast === v.toLowerCase()) return true;
  }
  return false;
}

/** When portal insured is "LAST,FIRST" or "LAST, FIRST M", return the first name (first word after comma), else null. Used to tighten match for common last names. */
export function getPortalFirstName(insured: string | null | undefined): string | null {
  if (!insured || typeof insured !== "string") return null;
  const raw = insured.trim();
  if (!raw.includes(",")) return null;
  const afterComma = (raw.split(",")[1] ?? "").trim();
  if (!afterComma) return null;
  const firstWord = afterComma.split(/\s+/)[0] ?? "";
  return firstWord.length >= 2 ? firstWord : null; // require at least 2 chars to avoid single initial false positives
}

const FIRST_NAME_MATCH_THRESHOLD = 0.8; // 80% similarity or full/contains match

/** Levenshtein distance. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i]![0] = i;
  for (let j = 0; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + cost
      );
    }
  }
  return d[m]![n]!;
}

/** Similarity ratio 0..1 (1 = identical). Uses 1 - normalized Levenshtein distance. */
function nameSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

/** True if portal first name and lead first name match: exact, one contains the other (e.g. John/Johnathan), or >= 80% similarity. */
export function firstNamesMatch(portalFirst: string, leadFirst: string): boolean {
  const p = portalFirst.trim().toLowerCase();
  const l = leadFirst.trim().toLowerCase();
  if (!p || !l) return false;
  if (p === l) return true;
  if (p.includes(l) || l.includes(p)) return true; // Smith, Johnathan <-> Smith, John
  return nameSimilarity(p, l) >= FIRST_NAME_MATCH_THRESHOLD;
}

/** Lead's first name from "First Last" or "Last, First": everything except the last word (surname). */
function getLeadFirstName(leadName: string): string {
  const raw = leadName.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join(" ");
}

/** True if lead_name matches portal first name: full name match (exact or high similarity) or first-name match (exact, contains, or >= 80% similar). E.g. Smith, Johnathan matches "Smith, John" or "John Smith". */
export function leadNameMatchesFirst(leadName: string | null | undefined, portalFirstName: string): boolean {
  if (!leadName || typeof leadName !== "string" || !portalFirstName) return false;
  const leadLower = leadName.replace(/,/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const portalLower = portalFirstName.trim().toLowerCase();
  if (leadLower.includes(portalLower)) return true; // full name contains portal first
  const leadFirst = getLeadFirstName(leadName);
  if (!leadFirst) return false;
  return firstNamesMatch(portalFirstName, leadFirst);
}

/** Fetch masterlead rows by last name (and first) in different cases; return name variants from first_name/last_name. */
export async function getMasterleadNameVariants(
  insured: string | null | undefined
): Promise<{ full: string[]; lastOnly: string[] }> {
  if (!insured || !supabaseAdmin) return { full: [], lastOnly: [] };
  const normalized = normalizeName(insured);
  if (!normalized) return { full: [], lastOnly: [] };
  const parts = normalized.split(/\s+/).filter(Boolean);
  const lastPart = parts.length > 0 ? parts[parts.length - 1]! : "";
  const firstPart = parts.length > 1 ? parts[0]! : "";
  if (!lastPart) return { full: [], lastOnly: [] };

  const fullSet = new Set<string>();
  const lastSet = new Set<string>();

  // Query masterlead by last name (all cases: exact ilike covers case-insensitive)
  const { data: rows } = await masterleadClient.from('masterlead')
    .select("first_name, last_name")
    .ilike("last_name", lastPart)
    .limit(100);
  for (const r of rows ?? []) {
    const ln = (r.last_name || "").trim();
    const fn = (r.first_name || "").trim();
    if (!ln) continue;
    lastSet.add(ln);
    lastSet.add(ln.toLowerCase());
    lastSet.add(ln.toUpperCase());
    lastSet.add(toTitleCase(ln.toLowerCase()));
    if (fn) {
      const a = `${ln} ${fn}`.trim();
      const b = `${fn} ${ln}`.trim();
      for (const s of [a, b]) {
        fullSet.add(s);
        fullSet.add(s.toLowerCase());
        fullSet.add(s.toUpperCase());
        fullSet.add(toTitleCase(s.toLowerCase()));
      }
    }
  }

  return {
    full: [...fullSet],
    lastOnly: [...lastSet],
  };
}

/** Merge two variant sets (portal + masterlead). */
function mergeVariants(
  a: { full: string[]; lastOnly: string[] },
  b: { full: string[]; lastOnly: string[] }
): { full: string[]; lastOnly: string[] } {
  return {
    full: [...new Set([...a.full, ...b.full])],
    lastOnly: [...new Set([...a.lastOnly, ...b.lastOnly])],
  };
}

/**
 * Match by: (1) billing connects (AOI), (2) agent_dial_metrics reached (CCPRO only).
 * CCPRO = agent_dial_metrics event_type 'reach' only. Name + date window; same agent OR same MGA.
 */
export async function matchSubmittedApplicationRow(row: {
  insured: string | null;
  agent: string | null;
  sga_submit: string | null;
  agent_release: string | null;
}): Promise<{ type: "aoi_connect" | "ccpro_reached"; id: number } | null> {
  if (!supabaseAdmin) return null;
  const variants = nameToMatchVariants(row.insured);
  if (variants.full.length === 0 && variants.lastOnly.length === 0) return null;

  const dateStr = row.agent_release || row.sga_submit;
  if (!dateStr) return null;
  const centerDate = new Date(dateStr);
  if (isNaN(centerDate.getTime())) return null;
  const start = new Date(centerDate);
  start.setDate(start.getDate() - DATE_WINDOW_DAYS);
  const end = new Date(centerDate);
  end.setHours(23, 59, 59, 999);

  flushLog(`    [match] resolving agent/MGA for row...`);
  const portalAgentEmail = await resolveAgentEmail(row.agent);
  const portalMga = portalAgentEmail ? await getMgaForEmail(portalAgentEmail) : null;
  const portalNorm = normalizePortalAgentForCompare(row.agent);

  // Supabase API "Max Rows" (Project Settings → API) must be >= PAGE or requests are truncated
  const PAGE = 5000;
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  // 1) Billing connects (AOI) — fetch by transaction_date in window (no cap)
  flushLog(`    [match] fetching connects in window...`);
  const connectRows: { id: number; lead_name?: string | null; agent_email?: string | null }[] = [];
  for (let off = 0; ; off += PAGE) {
    const { data: chunk } = await supabaseAdmin
      .from("billing_transactions")
      .select("id, lead_name, agent_email")
      .eq("transaction_type", "connect")
      .gte("transaction_date", startStr)
      .lte("transaction_date", endStr)
      .order("id", { ascending: true })
      .range(off, off + PAGE - 1);
    const list = chunk ?? [];
    connectRows.push(...list);
    if (off > 0 && off % 5000 === 0) flushLog(`    (connects: ${connectRows.length} rows)`);
    if (list.length < PAGE) break;
  }
  flushLog(`    (billing_transactions connects in window: ${connectRows.length} total)`);

  // 2) CCPRO = agent_dial_metrics reached only (event_type = 'reach') — fetch all in window (no cap)
  const reachedRows: { id: number; lead_name: string | null; agent_email: string | null }[] = [];
  for (let off = 0; ; off += PAGE) {
    const { data: chunk } = await supabaseAdmin
      .from("agent_dial_metrics")
      .select("id, lead_name, agent_email")
      .eq("event_type", "reach")
      .gte("event_timestamp", startStr)
      .lte("event_timestamp", endStr)
      .order("id", { ascending: true })
      .range(off, off + PAGE - 1);
    const list = chunk ?? [];
    reachedRows.push(...list);
    if (off > 0 && off % 5000 === 0) flushLog(`    (reach: ${reachedRows.length} rows)`);
    if (list.length < PAGE) break;
  }
  flushLog(`    (agent_dial_metrics reach in window: ${reachedRows.length} total)`);
  let nameMatchConnects = connectRows.filter((r) => leadNameMatchesVariants(r.lead_name, variants));
  let nameMatchReached = reachedRows.filter((r) => leadNameMatchesVariants(r.lead_name, variants));

  // For common last names: when portal has "LAST,FIRST", require full name or ~80% first-name match (e.g. Smith, Johnathan <-> Smith, John)
  const portalFirstName = getPortalFirstName(row.insured);
  if (portalFirstName) {
    nameMatchConnects = nameMatchConnects.filter((r) => leadNameMatchesFirst(r.lead_name, portalFirstName));
    nameMatchReached = nameMatchReached.filter((r) => leadNameMatchesFirst(r.lead_name, portalFirstName));
  }

  // Batch lookup names and MGA for all unique connect/reached agent emails (fixed round trips per row)
  const uniqueEmails = [
    ...new Set([
      ...nameMatchConnects.map((c) => (c.agent_email || "").trim().toLowerCase()).filter(Boolean),
      ...nameMatchReached.map((r) => (r.agent_email || "").trim().toLowerCase()).filter(Boolean),
    ]),
  ];
  flushLog(`    [match] batch lookup names/mga (${uniqueEmails.length} emails, ${nameMatchConnects.length} name-match connects, ${nameMatchReached.length} name-match reach)...`);
  const [nameByEmail, mgaByEmail] = await Promise.all([
    batchGetAgentNamesForEmails(uniqueEmails),
    batchGetMgaForEmails(uniqueEmails),
  ]);
  flushLog(`    [match] batch lookup done, checking same-agent/MGA...`);

  const sameAgent = (connectEmail: string): boolean => {
    const c = connectEmail.toLowerCase().trim();
    if (portalAgentEmail && c === portalAgentEmail.toLowerCase()) return true;
    if (!portalNorm) return false;
    const name = nameByEmail.get(c) ?? null;
    if (!name) return false;
    return namesMatchForSameAgent(portalNorm, name);
  };
  const getMga = (email: string): string | null => mgaByEmail.get(email.toLowerCase()) ?? null;
  const normalizeMga = (s: string | null): string =>
    (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
  const mgaMatch = (a: string | null, b: string | null): boolean =>
    !!a && !!b && normalizeMga(a) === normalizeMga(b);

  // Match only when same agent OR same MGA (MGA must match when we use it)
  for (const c of nameMatchConnects) {
    const connectAgentEmail = (c.agent_email || "").trim();
    if (!connectAgentEmail) continue;
    if (sameAgent(connectAgentEmail)) return { type: "aoi_connect", id: c.id };
    const connectMga = getMga(connectAgentEmail);
    if (mgaMatch(portalMga, connectMga)) return { type: "aoi_connect", id: c.id };
  }
  for (const r of nameMatchReached) {
    const connectAgentEmail = (r.agent_email || "").trim();
    if (!connectAgentEmail) continue;
    if (sameAgent(connectAgentEmail)) return { type: "ccpro_reached", id: r.id };
    const connectMga = getMga(connectAgentEmail);
    if (mgaMatch(portalMga, connectMga)) return { type: "ccpro_reached", id: r.id };
  }

  return null;
}

const MATCHING_BATCH_SIZE = 100;
const ROW_TIMEOUT_MS = 20000;

function flushLog(s: string): void {
  process.stdout.write(s + "\n");
}

/** Run matching for submitted_applications. By default only rows with transfer_type IS NULL. Use recheckExisting: true to re-run on already-matched rows and rewrite (or clear) with current logic. */
export async function runMatchingForSubmittedApplications(options?: {
  startAfterId?: number;
  recheckExisting?: boolean;
}): Promise<{
  matched: number;
  aoi_connect: number;
  ccpro_reached: number;
  cleared: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let matched = 0;
  let aoi_connect = 0;
  let ccpro_reached = 0;
  let cleared = 0;

  if (!supabaseAdmin) return { matched: 0, aoi_connect: 0, ccpro_reached: 0, cleared: 0, errors: ["No supabase admin"] };

  const recheck = options?.recheckExisting === true;
  let lastId = options?.startAfterId ?? 0;
  let totalProcessed = 0;
  if (lastId > 0) flushLog(`  Resuming: only processing rows with id > ${lastId}`);
  if (recheck) flushLog(`  Recheck mode: re-evaluating rows that already have transfer_type set (will rewrite or clear).`);

  while (true) {
    const filterDesc = recheck ? "transfer_type IS NOT NULL" : "transfer_type IS NULL";
    flushLog(`  Fetching batch: id > ${lastId}, limit ${MATCHING_BATCH_SIZE} (${filterDesc})...`);
    let q = supabaseAdmin
      .from("submitted_applications")
      .select("id, insured, agent, sga_submit, agent_release, alp, policy_number, transfer_type")
      .order("id", { ascending: true })
      .limit(MATCHING_BATCH_SIZE);
    if (recheck) q = q.not("transfer_type", "is", null);
    else q = q.is("transfer_type", null);
    if (lastId > 0) q = q.gt("id", lastId);
    const { data: batch, error: fetchErr } = await q;
    if (fetchErr) {
      errors.push(fetchErr.message);
      console.error("  Fetch error:", fetchErr.message);
      return { matched, aoi_connect, ccpro_reached, cleared, errors };
    }
    const rows = batch ?? [];
    flushLog(`  Got ${rows.length} rows, processing...`);
    if (rows.length === 0) break;

    const batchUpdates: Array<{ id: number; update: Record<string, unknown> }> = [];

    for (const row of rows) {
      totalProcessed++;
      if (!recheck && row.transfer_type != null && String(row.transfer_type).trim() !== "") {
        flushLog(`  Row ${totalProcessed}: id ${row.id} SKIP (transfer_type already set)`);
        continue;
      }
      flushLog(`  Row ${totalProcessed}: id ${row.id} (insured: ${(row.insured ?? "").slice(0, 40)}...)${recheck ? " [recheck]" : ""}`);
      try {
        const result = await Promise.race([
          matchSubmittedApplicationRow({
            insured: row.insured,
            agent: row.agent,
            sga_submit: row.sga_submit,
            agent_release: row.agent_release,
          }),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), ROW_TIMEOUT_MS)
          ),
        ]);
        if (!result) {
          if (recheck) {
            batchUpdates.push({
              id: row.id,
              update: {
                transfer_type: null,
                matched_billing_transaction_id: null,
                matched_agent_dial_metric_id: null,
                aoi_alp: null,
                ccpro_alp: null,
              },
            });
            cleared++;
            flushLog(`  Row ${totalProcessed}: id ${row.id} done (no match, cleared)`);
          } else {
            flushLog(`  Row ${totalProcessed}: id ${row.id} done (no match)`);
          }
          continue;
        }

        const rowAlp = row.alp != null ? Number(row.alp) : null;
        const update: Record<string, unknown> = {
          transfer_type: result.type,
          matched_billing_transaction_id: result.type === "aoi_connect" ? result.id : null,
          matched_agent_dial_metric_id: result.type === "ccpro_reached" ? result.id : null,
          aoi_alp: result.type === "aoi_connect" ? rowAlp : null,
          ccpro_alp: result.type === "ccpro_reached" ? rowAlp : null,
        };
        batchUpdates.push({ id: row.id, update });
        matched++;
        if (result.type === "aoi_connect") aoi_connect++;
        else ccpro_reached++;
        flushLog(`  Row ${totalProcessed}: id ${row.id} done (matched ${result.type})`);

        if (recheck) continue; // no sibling updates when rechecking
        const policyNum = row.policy_number != null ? parseInt(String(row.policy_number).replace(/\D/g, ""), 10) : NaN;
        if (!isNaN(policyNum) && row.agent != null && (row.agent_release != null || row.sga_submit != null)) {
          const prevPolicy = String(policyNum - 1);
          const nextPolicy = String(policyNum + 1);
          let sibQ = supabaseAdmin
            .from("submitted_applications")
            .select("id, alp")
            .is("transfer_type", null)
            .eq("agent", row.agent)
            .in("policy_number", [prevPolicy, nextPolicy]);
          if (row.agent_release != null) sibQ = sibQ.eq("agent_release", row.agent_release);
          else if (row.sga_submit != null) sibQ = sibQ.eq("sga_submit", row.sga_submit);
          const { data: siblings } = await sibQ;
          for (const s of siblings ?? []) {
            if (s.id === row.id) continue;
            const sAlp = s.alp != null ? Number(s.alp) : null;
            const siblingUpdate: Record<string, unknown> = {
              transfer_type: result.type,
              matched_billing_transaction_id: result.type === "aoi_connect" ? result.id : null,
              matched_agent_dial_metric_id: result.type === "ccpro_reached" ? result.id : null,
              aoi_alp: result.type === "aoi_connect" ? sAlp : null,
              ccpro_alp: result.type === "ccpro_reached" ? sAlp : null,
            };
            batchUpdates.push({ id: s.id, update: siblingUpdate });
            matched++;
            if (result.type === "aoi_connect") aoi_connect++;
            else ccpro_reached++;
            flushLog(`  [household] Matched sibling id ${s.id} (policy ±1) -> ${result.type}`);
          }
        }
      } catch (e) {
        const msg = String(e);
        if (msg.includes("timeout")) {
          process.stderr.write(`  SKIPPED id ${row.id} (timeout after ${ROW_TIMEOUT_MS / 1000}s)\n`);
          errors.push(`id ${row.id}: timeout`);
        } else {
          errors.push(`id ${row.id}: ${msg}`);
        }
      }
    }

    for (const { id, update } of batchUpdates) {
      const { error: upErr } = await supabaseAdmin
        .from("submitted_applications")
        .update(update)
        .eq("id", id);
      if (upErr) errors.push(`id ${id}: ${upErr.message}`);
    }
    if (batchUpdates.length > 0) flushLog(`  Batch written: ${batchUpdates.length} updates applied.`);

    lastId = rows[rows.length - 1]?.id ?? lastId;
    if (rows.length < MATCHING_BATCH_SIZE) break;
  }

  return { matched, aoi_connect, ccpro_reached, cleared, errors };
}

/** Whether a submitted_applications row counts as a valid sale (exclude cancels, declined). */
export function isValidSale(row: {
  submit_type?: string | null;
  nilico_status?: string | null;
  verification_result?: string | null;
}): boolean {
  const st = (row.submit_type || "").toLowerCase();
  const ns = (row.nilico_status || "").toLowerCase();
  const vr = (row.verification_result || "").toLowerCase();
  if (st.includes("cancel") || ns.includes("cancel")) return false;
  if (vr.includes("declined")) return false;
  return true;
}

/** Fetch rows from submitted_applications that are valid sales AND tied to a connect or booked. */
export async function getValidSales(options?: {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;
  agent?: string;
}): Promise<{ rows: any[]; totalCount: number; validCount: number; totalCwa: number }> {
  if (!supabaseAdmin) {
    return { rows: [], totalCount: 0, validCount: 0, totalCwa: 0 };
  }
  let q = supabaseAdmin.from("submitted_applications").select("*").order("sga_submit", { ascending: false });
  if (options?.dateFrom) {
    q = q.gte("sga_submit", `${options.dateFrom}T00:00:00`);
  }
  if (options?.dateTo) {
    q = q.lte("sga_submit", `${options.dateTo}T23:59:59`);
  }
  if (options?.agent) {
    q = q.ilike("agent", `%${options.agent}%`);
  }
  // Paginate to get all rows. Supabase API "Max Rows" must be >= PAGE.
  const PAGE = 5000;
  const rows: any[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data: chunk, error } = await q.range(offset, offset + PAGE - 1);
    if (error) throw error;
    const list = chunk ?? [];
    rows.push(...list);
    hasMore = list.length === PAGE;
    offset += PAGE;
  }
  // Sales = not cancel/declined AND tied to a connect or booked
  const valid = rows.filter(
    (r) =>
      isValidSale(r) &&
      (r.transfer_type === "aoi_connect" || r.transfer_type === "ccpro_reached")
  );
  let totalCwa = 0;
  valid.forEach((r) => {
    const cwa = r.cwa;
    if (cwa) {
      const num = parseFloat(String(cwa).replace(/[$,]/g, ""));
      if (!isNaN(num)) totalCwa += num;
    }
  });
  return {
    rows: valid,
    totalCount: rows.length,
    validCount: valid.length,
    totalCwa: Math.round(totalCwa * 100) / 100,
  };
}
