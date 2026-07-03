/**
 * Find billing_transactions connects whose lead_name matches submitted_applications
 * insured names (case-insensitive), then filter by agent or hierarchy (same MGA).
 *
 * Run: npx tsx server/scripts/match-connects-by-last-name.ts [paste-file.txt]
 * With no arg: reads from Supabase submitted_applications.
 * With file arg: parses paste and runs same matching against billing connects.
 */

import * as fs from "fs";
import * as path from "path";
import { supabaseAdmin } from "../supabase";
import {
  nameToMatchVariants,
  leadNameMatchesVariants,
  resolveAgentEmail,
  getMgaForEmail,
  getMasterleadNameVariants,
  parsePastedSubmittedApplications,
  computeAlp,
} from "../submitted-applications";

const DATE_WINDOW_DAYS = 14; // required: sale connect within 2 weeks of SGA submit

type SubmittedRow = { insured: string | null; policy_number: string | null; sga_submit: string | null; agent: string | null; lob: string | null; cwa: string | null };

/** True if connectDate is within sgaSubmitDate ± DATE_WINDOW_DAYS. */
function withinDateWindow(sgaSubmitStr: string | null, connectDateStr: string | null): boolean {
  if (!sgaSubmitStr || !connectDateStr) return false;
  const sga = new Date(sgaSubmitStr);
  const conn = new Date(connectDateStr);
  if (isNaN(sga.getTime()) || isNaN(conn.getTime())) return false;
  const start = new Date(sga);
  start.setDate(start.getDate() - DATE_WINDOW_DAYS);
  const end = new Date(sga);
  end.setDate(end.getDate() + DATE_WINDOW_DAYS);
  return conn >= start && conn <= end;
}

/** Build variants that include "First Last" as well as "Last First" for portal "LAST,FIRST" format. */
function insuredToVariants(insured: string): { full: string[]; lastOnly: string[] } {
  const base = nameToMatchVariants(insured);
  if (!insured || !insured.trim()) return base;
  const raw = insured.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const lastName = parts[0]!;
    const firstName = parts[1]!;
    const firstLast = `${firstName} ${lastName}`;
    const lastFirst = `${lastName} ${firstName}`;
    for (const form of [firstLast, lastFirst]) {
      base.full.push(form, form.toLowerCase(), form.toUpperCase());
      base.lastOnly.push(lastName, lastName.toLowerCase(), lastName.toUpperCase());
    }
  } else if (parts.length === 1) {
    base.lastOnly.push(parts[0]!, parts[0]!.toLowerCase(), parts[0]!.toUpperCase());
  }
  return {
    full: [...new Set(base.full)],
    lastOnly: [...new Set(base.lastOnly)],
  };
}

function mergeVariants(
  a: { full: string[]; lastOnly: string[] },
  b: { full: string[]; lastOnly: string[] }
): { full: string[]; lastOnly: string[] } {
  return {
    full: [...new Set([...a.full, ...b.full])],
    lastOnly: [...new Set([...a.lastOnly, ...b.lastOnly])],
  };
}

async function main() {
  if (!supabaseAdmin) {
    console.error("No Supabase admin client");
    process.exit(1);
  }

  const fileArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  let submitted: SubmittedRow[];
  if (fileArg) {
    const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
    if (!fs.existsSync(filePath)) {
      console.error("File not found:", filePath);
      process.exit(1);
    }
    const buf = fs.readFileSync(filePath);
    const content =
      buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe
        ? buf.toString("utf16le").replace(/^\uFEFF/, "")
        : buf.toString("utf8").replace(/^\uFEFF/, "");
    const rows = parsePastedSubmittedApplications(content);
    submitted = rows.map((r) => ({
      insured: r.insured,
      policy_number: r.policy_number,
      sga_submit: r.sga_submit,
      agent: r.agent,
      lob: r.lob,
      cwa: r.cwa,
    }));
    console.log("Loaded %d rows from paste file: %s", submitted.length, filePath);
  } else {
    const { data: data, error: subErr } = await supabaseAdmin
      .from("submitted_applications")
      .select("insured, policy_number, sga_submit, agent, lob, cwa");
    if (subErr) {
      console.error("submitted_applications error:", subErr);
      process.exit(1);
    }
    submitted = (data ?? []) as SubmittedRow[];
    console.log("Loaded %d rows from Supabase submitted_applications", submitted.length);
  }

  const insuredList = [...new Set(submitted.map((r) => r.insured).filter(Boolean) as string[])];
  console.log("Unique insured names: %d", insuredList.length);

  // Resolve portal agent -> email and MGA (cache by agent string)
  const agentToEmail = new Map<string, string | null>();
  const emailToMga = new Map<string, string | null>();
  const uniqueAgents = [...new Set(submitted.map((r) => r.agent).filter(Boolean) as string[])].filter(
    (a) => (a || "").toLowerCase().trim() !== "agent"
  );
  for (const agentStr of uniqueAgents) {
    const email = await resolveAgentEmail(agentStr);
    agentToEmail.set(agentStr, email);
    if (email) {
      if (!emailToMga.has(email)) emailToMga.set(email, await getMgaForEmail(email));
    }
  }
  console.log("Resolved %d unique portal agents to email/MGA", uniqueAgents.length);
  for (const a of uniqueAgents) {
    const e = agentToEmail.get(a);
    const mga = e ? emailToMga.get(e) ?? null : null;
    console.log("  Portal agent: %s -> email: %s, MGA: %s", a, e ?? "(not found)", mga ?? "(none)");
  }

  const { data: connects, error: connErr } = await supabaseAdmin
    .from("billing_transactions")
    .select("id, lead_name, agent_email, transaction_date, transaction_id")
    .eq("transaction_type", "connect")
    .limit(10000);
  if (connErr) {
    console.error("billing_transactions error:", connErr);
    process.exit(1);
  }
  const allConnects = connects ?? [];
  // Explicitly fetch Chris Lafond's connects so we're definitely checking his data (no 1k default cutoff)
  const lafondEmail = "chrislafond@aoglobelife.com";
  const { data: lafondConnects, error: lafondErr } = await supabaseAdmin
    .from("billing_transactions")
    .select("id, lead_name, agent_email, transaction_date, transaction_id")
    .eq("transaction_type", "connect")
    .ilike("agent_email", lafondEmail)
    .limit(10000);
  const lafondList = lafondConnects ?? [];
  if (!lafondErr && lafondList.length > 0) {
    console.log("Chris Lafond's connects (agent_email = %s): %d", lafondEmail, lafondList.length);
    // How many of his connects fall in SGA submit ± 14 days (from submitted rows)?
    const sgaDates = submitted.map((r) => r.sga_submit).filter(Boolean) as string[];
    if (sgaDates.length > 0) {
      const parsed = sgaDates.map((d) => new Date(d)).filter((d) => !isNaN(d.getTime()));
      if (parsed.length === 0) {
        console.log("No valid SGA dates in submitted rows, skipping Chris Lafond window check");
      } else {
      const minSga = new Date(Math.min(...parsed.map((d) => d.getTime())));
      const maxSga = new Date(Math.max(...parsed.map((d) => d.getTime())));
      const windowStart = new Date(minSga);
      windowStart.setDate(windowStart.getDate() - DATE_WINDOW_DAYS);
      const windowEnd = new Date(maxSga);
      windowEnd.setDate(windowEnd.getDate() + DATE_WINDOW_DAYS);
      const inWindow = lafondList.filter((c) => {
        const t = (c as { transaction_date?: string }).transaction_date;
        if (!t) return false;
        const d = new Date(t);
        return !isNaN(d.getTime()) && d >= windowStart && d <= windowEnd;
      });
      console.log("Chris Lafond connects in 14-day window (SGA %s to %s ± %d days): %d", minSga.toISOString().slice(0, 10), maxSga.toISOString().slice(0, 10), DATE_WINDOW_DAYS, inWindow.length);
      // Masterlead: any lead that booked or set appointment, updated_at within 4 weeks of SGA window
      const MASTERLEAD_WINDOW_DAYS = 28; // 4 weeks
      const mlWindowStart = new Date(minSga);
      mlWindowStart.setDate(mlWindowStart.getDate() - MASTERLEAD_WINDOW_DAYS);
      const mlWindowEnd = new Date(maxSga);
      mlWindowEnd.setDate(mlWindowEnd.getDate() + MASTERLEAD_WINDOW_DAYS);
      const { data: mlBooked, error: mlBookedErr } = await supabaseAdmin
        .from("masterlead")
        .select("id, first_name, last_name, cnresolution, updated_at")
        .ilike("cn_email", lafondEmail)
        .in("cnresolution", ["booked", "appointment", "appointment_set"])
        .limit(5000);
      if (!mlBookedErr && mlBooked) {
        const inWindowBooked = mlBooked.filter((r) => {
          const u = (r as { updated_at?: string }).updated_at ? new Date((r as { updated_at: string }).updated_at) : null;
          return u && !isNaN(u.getTime()) && u >= mlWindowStart && u <= mlWindowEnd;
        });
        console.log("Chris Lafond masterlead booked/appointment (updated_at within 4 weeks of SGA): %d", inWindowBooked.length);
      }
      }
    }
    // Chris Lafond masterlead (leads assigned to him, total)
    const { count: mlCount, error: mlErr } = await supabaseAdmin
      .from("masterlead")
      .select("id", { count: "exact", head: true })
      .ilike("cn_email", lafondEmail);
    if (!mlErr) console.log("Chris Lafond masterlead (cn_email = %s): %d rows", lafondEmail, mlCount ?? 0);
  }
  // Dedupe: merge lafond into all, keyed by id, so we have general connects + all of Chris's
  const connectById = new Map(allConnects.map((c: { id?: string }) => [(c as { id: string }).id, c]));
  for (const c of lafondConnects ?? []) {
    const id = (c as { id?: string }).id;
    if (id) connectById.set(id, c);
  }
  const connectsToUse = Array.from(connectById.values());
  console.log("Connects in billing_transactions (incl. Chris Lafond): %d (match window: SGA submit ± %d days)", connectsToUse.length, DATE_WINDOW_DAYS);

  // Call Connector Pro: agent_dial_metrics "booked" in same 14-day window
  // Include event_type in ('booked','instant_presentation') and disposition-based booked (event_type='dial', disposition in booked-like)
  const sgaDates = submitted.map((r) => r.sga_submit).filter(Boolean) as string[];
  const bookedRowType: { id: number; lead_name: string | null; agent_email: string | null; event_timestamp: string | null } = {
    id: 0,
    lead_name: null,
    agent_email: null,
    event_timestamp: null,
  };
  let bookedRows: typeof bookedRowType[] = [];
  if (sgaDates.length > 0) {
    const parsed = sgaDates.map((d) => new Date(d)).filter((d) => !isNaN(d.getTime()));
    if (parsed.length === 0) {
      console.log("No valid SGA dates, skipping Call Connector Pro window");
    } else {
    const minSga = new Date(Math.min(...parsed.map((d) => d.getTime())));
    const maxSga = new Date(Math.max(...parsed.map((d) => d.getTime())));
    const bookStart = new Date(minSga);
    bookStart.setDate(bookStart.getDate() - DATE_WINDOW_DAYS);
    const bookEnd = new Date(maxSga);
    bookEnd.setDate(bookEnd.getDate() + DATE_WINDOW_DAYS);
    const byId = new Map<number, (typeof bookedRowType)>();
    // 1) event_type in ('booked', 'instant_presentation')
    const { data: bookedByType } = await supabaseAdmin
      .from("agent_dial_metrics")
      .select("id, lead_name, agent_email, event_timestamp")
      .in("event_type", ["booked", "instant_presentation"])
      .gte("event_timestamp", bookStart.toISOString())
      .lte("event_timestamp", bookEnd.toISOString())
      .limit(10000);
    for (const r of bookedByType ?? []) {
      const row = r as typeof bookedRowType;
      if (row.id && !byId.has(row.id)) byId.set(row.id, row);
    }
    // 2) disposition-based booked (many records are event_type='dial' with disposition='booked')
    const { data: bookedByDisposition } = await supabaseAdmin
      .from("agent_dial_metrics")
      .select("id, lead_name, agent_email, event_timestamp")
      .eq("event_type", "dial")
      .in("disposition", ["booked", "instant_presentation", "appointment", "appointment_set", "set_appointment", "qualified"])
      .gte("event_timestamp", bookStart.toISOString())
      .lte("event_timestamp", bookEnd.toISOString())
      .limit(10000);
    for (const r of bookedByDisposition ?? []) {
      const row = r as typeof bookedRowType;
      if (row.id && !byId.has(row.id)) byId.set(row.id, row);
    }
    bookedRows = Array.from(byId.values());
    console.log("Call Connector Pro (agent_dial_metrics booked/instant_presentation or disposition=booked) in window: %d", bookedRows.length);
    }
  }

  // Build variants once per insured (portal + masterlead) and print exact names we check
  const variantsByInsured = new Map<string, { full: string[]; lastOnly: string[] }>();
  for (const ins of insuredList) {
    const portalVariants = insuredToVariants(ins);
    const masterleadVariants = await getMasterleadNameVariants(ins);
    const variants = mergeVariants(portalVariants, masterleadVariants);
    variantsByInsured.set(ins, variants);
  }
  console.log("\n--- Exact names we check (portal + masterlead) per insured ---");
  for (const ins of insuredList) {
    const variants = variantsByInsured.get(ins)!;
    console.log("\nInsured: %s", ins);
    console.log("  full (match connect lead_name exactly, any case): %s", variants.full.length ? variants.full.slice(0, 25).join(" | ") + (variants.full.length > 25 ? " ..." : "") : "(none)");
    console.log("  lastOnly (match if connect last word equals): %s", variants.lastOnly.length ? [...new Set(variants.lastOnly)].join(" | ") : "(none)");
  }
  console.log("\n--- Matching ---");

  type MatchRow = {
    insured: string;
    policy_number: string;
    sga_submit: string;
    agent: string | null;
    lob: string | null;
    cwa: string | null;
    alp: number | null;
    submitted_agent_email: string | null;
    submitted_mga: string | null;
    source: "connect" | "ccpro_booked";
    match_id: string;
    lead_name: string;
    agent_email: string | null;
    connect_mga: string | null;
    event_date: string | null;
    agent_match: boolean;
    hierarchy_match: boolean;
  };

  const allNameMatches: MatchRow[] = [];

  for (const sub of submitted) {
    const ins = sub.insured;
    if (!ins) continue;
    const variants = variantsByInsured.get(ins);
    if (!variants) continue;
    const portalAgent = sub.agent ?? null;
    const submittedEmail = portalAgent ? agentToEmail.get(portalAgent) ?? null : null;
    const submittedMga = submittedEmail ? emailToMga.get(submittedEmail) ?? await getMgaForEmail(submittedEmail) : null;
    if (submittedEmail && !emailToMga.has(submittedEmail)) emailToMga.set(submittedEmail, submittedMga);

    const sgaSubmit = sub.sga_submit ?? null;
    for (const row of connectsToUse) {
      const leadName = (row as { lead_name?: string }).lead_name;
      if (!leadNameMatchesVariants(leadName, variants)) continue;
      const connectDate = (row as { transaction_date?: string }).transaction_date ?? null;
      if (!withinDateWindow(sgaSubmit, connectDate)) continue;
      const connectEmail = ((row as { agent_email?: string }).agent_email ?? "").toLowerCase().trim() || null;
      let connectMga = connectEmail ? emailToMga.get(connectEmail) : null;
      if (connectEmail && connectMga === undefined) {
        connectMga = await getMgaForEmail(connectEmail);
        emailToMga.set(connectEmail, connectMga);
      }
      const agentMatch = !!(
        submittedEmail &&
        connectEmail &&
        submittedEmail.toLowerCase() === connectEmail
      );
      const hierarchyMatch = !!(
        submittedMga &&
        connectMga &&
        submittedMga.toLowerCase().trim() === connectMga.toLowerCase().trim()
      );
      const lob = sub.lob ?? null;
      const cwa = sub.cwa ?? null;
      const alp = computeAlp(lob, cwa);
      allNameMatches.push({
        insured: ins,
        policy_number: sub.policy_number ?? "",
        sga_submit: sub.sga_submit ?? "",
        agent: portalAgent,
        lob,
        cwa,
        alp,
        submitted_agent_email: submittedEmail,
        submitted_mga: submittedMga,
        source: "connect",
        match_id: String((row as { id?: string }).id ?? ""),
        lead_name: leadName ?? "",
        agent_email: connectEmail,
        connect_mga: connectMga,
        event_date: (row as { transaction_date?: string }).transaction_date ?? null,
        agent_match: agentMatch,
        hierarchy_match: hierarchyMatch,
      });
    }
    // Call Connector Pro (agent_dial_metrics booked)
    for (const row of bookedRows) {
      const leadName = row.lead_name;
      if (!leadNameMatchesVariants(leadName, variants)) continue;
      if (!withinDateWindow(sgaSubmit, row.event_timestamp)) continue;
      const connectEmail = (row.agent_email ?? "").toLowerCase().trim() || null;
      let connectMga = connectEmail ? emailToMga.get(connectEmail) : null;
      if (connectEmail && connectMga === undefined) {
        connectMga = await getMgaForEmail(connectEmail);
        emailToMga.set(connectEmail, connectMga);
      }
      const agentMatch = !!(submittedEmail && connectEmail && submittedEmail.toLowerCase() === connectEmail);
      const hierarchyMatch = !!(submittedMga && connectMga && submittedMga.toLowerCase().trim() === connectMga.toLowerCase().trim());
      const lob = sub.lob ?? null;
      const cwa = sub.cwa ?? null;
      const alp = computeAlp(lob, cwa);
      allNameMatches.push({
        insured: ins,
        policy_number: sub.policy_number ?? "",
        sga_submit: sub.sga_submit ?? "",
        agent: portalAgent,
        lob,
        cwa,
        alp,
        submitted_agent_email: submittedEmail,
        submitted_mga: submittedMga,
        source: "ccpro_booked",
        match_id: String(row.id),
        lead_name: leadName ?? "",
        agent_email: connectEmail,
        connect_mga: connectMga,
        event_date: row.event_timestamp ?? null,
        agent_match: agentMatch,
        hierarchy_match: hierarchyMatch,
      });
    }
  }

  // Sales = name + date match AND (same agent OR same MGA) AND LOB = Life (each app = one sale)
  const withAgentOrHierarchy = allNameMatches.filter((m) => m.agent_match || m.hierarchy_match);
  const lifeSales = withAgentOrHierarchy.filter((m) => m.lob && m.lob.trim().toLowerCase() === "life");
  const uniqueEntriesWithSale = new Set(lifeSales.map((m) => `${m.insured}\t${m.policy_number}`));
  const alpByEntry = new Map<string, number>();
  for (const m of lifeSales) {
    const key = `${m.insured}\t${m.policy_number}`;
    if (m.alp != null && !alpByEntry.has(key)) alpByEntry.set(key, m.alp);
  }
  const totalAlpUnique = Array.from(alpByEntry.values()).reduce((a, b) => a + b, 0);
  const fromConnect = lifeSales.filter((m) => m.source === "connect");
  const fromCcpro = lifeSales.filter((m) => m.source === "ccpro_booked");
  const uniqueByConnect = new Set(fromConnect.map((m) => `${m.insured}\t${m.policy_number}`)).size;
  const uniqueByCcpro = new Set(fromCcpro.map((m) => `${m.insured}\t${m.policy_number}`)).size;
  // ALP by source: each unique (insured, policy) contributes its ALP to AOI and/or CCPRO depending on source(s)
  const aoiAlpByKey = new Map<string, number>();
  const ccproAlpByKey = new Map<string, number>();
  for (const m of lifeSales) {
    const key = `${m.insured}\t${m.policy_number}`;
    const alpVal = m.alp ?? 0;
    if (m.source === "connect") aoiAlpByKey.set(key, alpVal);
    if (m.source === "ccpro_booked") ccproAlpByKey.set(key, alpVal);
  }
  const aoiAlpTotal = Array.from(aoiAlpByKey.values()).reduce((a, b) => a + b, 0);
  const ccproAlpTotal = Array.from(ccproAlpByKey.values()).reduce((a, b) => a + b, 0);
  console.log("\nName + date matches: %d (submitted row × connect or CCPRO pairs)", allNameMatches.length);
  console.log(
    "Sales (Life only, same agent or same MGA): %d apps | Total ALP (CWA×12): %s",
    uniqueEntriesWithSale.size,
    totalAlpUnique.toFixed(2)
  );
  console.log("  From Connects (billing): %d apps | From Call Connector Pro (booked): %d apps", uniqueByConnect, uniqueByCcpro);
  console.log("  AOI ALP (Connects): %s | Call Connector Pro ALP: %s", aoiAlpTotal.toFixed(2), ccproAlpTotal.toFixed(2));

  // Show sample of name-only matches when no sales (for debugging)
  if (allNameMatches.length > 0 && lifeSales.length === 0) {
    const sample = allNameMatches.slice(0, 10);
    console.log("\nSample name-only matches (no agent/MGA match):");
    for (const m of sample) {
      console.log("  %s (%s) (portal agent %s -> %s / %s) | lead: %s by %s (MGA: %s)", m.insured, m.source, m.agent ?? "", m.submitted_agent_email ?? "?", m.submitted_mga ?? "?", m.lead_name, m.agent_email ?? "?", m.connect_mga ?? "?");
    }
  }
  console.log("");

  if (lifeSales.length > 0) {
    // One row per unique (insured, policy); show Source = Connect and/or CCPRO
    const seen = new Set<string>();
    const sourceByKey = new Map<string, Set<"connect" | "ccpro_booked">>();
    for (const m of lifeSales) {
      const key = `${m.insured}\t${m.policy_number}`;
      if (!sourceByKey.has(key)) sourceByKey.set(key, new Set());
      sourceByKey.get(key)!.add(m.source);
    }
    console.log(
      "Insured\tPolicy #\tLOB\tCWA\tALP (CWA×12)\tSource\tSGA Submit\tPortal Agent\tLead name\tAgent email\tAgent?\tMGA?\tevent_date"
    );
    for (const m of lifeSales) {
      const key = `${m.insured}\t${m.policy_number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sources = sourceByKey.get(key)!;
      const sourceLabel = sources.has("connect") && sources.has("ccpro_booked") ? "Connect, CCPRO" : sources.has("connect") ? "Connect" : "CCPRO";
      console.log(
        [
          m.insured,
          m.policy_number,
          m.lob ?? "",
          m.cwa ?? "",
          m.alp != null ? m.alp.toFixed(2) : "",
          sourceLabel,
          m.sga_submit,
          m.agent ?? "",
          m.lead_name,
          m.agent_email ?? "",
          m.agent_match ? "Y" : "",
          m.hierarchy_match ? "Y" : "",
          m.event_date ?? "",
        ].join("\t")
      );
    }
    console.log("(Total unique Life sales: %d, Total ALP: %s)", seen.size, totalAlpUnique.toFixed(2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
