/**
 * Trace why matching fails for a heavy-user agent: show portal resolution, date window,
 * connects/reach in window, name-match counts, and MGA resolution for connect/reach agent_emails.
 * Run: npx tsx server/scripts/trace-matching-for-agent.ts "LAFOND, CHRISTOPHER - ZT971"
 */

import { supabaseAdmin } from "../supabase";
import {
  resolveAgentEmail,
  getMgaForEmail,
  nameToMatchVariants,
  leadNameMatchesVariants,
} from "../submitted-applications";

const DATE_WINDOW_DAYS = 14;

async function main() {
  if (!supabaseAdmin) {
    console.error("No Supabase admin client.");
    process.exit(1);
  }

  const agentStr = process.argv[2]?.trim();
  if (!agentStr) {
    console.error('Usage: npx tsx server/scripts/trace-matching-for-agent.ts "AGENT, NAME - CODE"');
    process.exit(1);
  }

  console.log("=== Trace matching for agent ===\n");
  console.log("Portal agent:", agentStr);

  const portalEmail = await resolveAgentEmail(agentStr);
  const portalMga = portalEmail ? await getMgaForEmail(portalEmail) : null;
  console.log("  -> resolved email:", portalEmail ?? "(null)");
  console.log("  -> resolved MGA:  ", portalMga ?? "(null)\n");

  const { data: rows, error } = await supabaseAdmin
    .from("submitted_applications")
    .select("id, insured, agent, sga_submit, agent_release")
    .eq("agent", agentStr)
    .not("sga_submit", "is", null)
    .order("sga_submit", { ascending: false })
    .limit(3);

  if (error || !rows?.length) {
    console.log("No submitted_applications rows with this agent (or error):", error?.message ?? "none");
    return;
  }

  const row = rows[0]!;
  const dateStr = row.agent_release || row.sga_submit;
  const centerDate = new Date(dateStr!);
  const start = new Date(centerDate);
  start.setDate(start.getDate() - DATE_WINDOW_DAYS);
  const end = new Date(centerDate);
  end.setHours(23, 59, 59, 999);
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  console.log("Sample row id:", row.id, "insured:", row.insured);
  console.log("Date window:", startStr, "->", endStr);

  const variants = nameToMatchVariants(row.insured);
  console.log("Name variants (surname):", variants.lastOnly.slice(0, 4).join(", "));

  const { data: connects } = await supabaseAdmin
    .from("billing_transactions")
    .select("id, lead_name, agent_email")
    .eq("transaction_type", "connect")
    .gte("transaction_date", startStr)
    .lte("transaction_date", endStr)
    .limit(200);

  const { data: reach } = await supabaseAdmin
    .from("agent_dial_metrics")
    .select("id, lead_name, agent_email")
    .eq("event_type", "reach")
    .gte("event_timestamp", startStr)
    .lte("event_timestamp", endStr)
    .limit(200);

  const connectList = connects ?? [];
  const reachList = reach ?? [];
  const nameMatchConnects = connectList.filter((r) => leadNameMatchesVariants(r.lead_name, variants));
  const nameMatchReach = reachList.filter((r) => leadNameMatchesVariants(r.lead_name, variants));

  console.log("\nIn window: connects", connectList.length, ", reach", reachList.length);
  console.log("Name-match: connects", nameMatchConnects.length, ", reach", nameMatchReach.length);

  const emails = [
    ...new Set([
      ...nameMatchConnects.map((c) => (c.agent_email || "").trim().toLowerCase()).filter(Boolean),
      ...nameMatchReach.map((r) => (r.agent_email || "").trim().toLowerCase()).filter(Boolean),
    ]),
  ];

  console.log("\nConnect/reach agent_emails (name-match only), MGA lookup:");
  for (const e of emails.slice(0, 15)) {
    const mga = await getMgaForEmail(e);
    const matches = portalMga && mga && portalMga.toLowerCase().trim() === mga.toLowerCase().trim();
    console.log("  ", e, " -> MGA:", mga ?? "(null)", matches ? " [MATCH]" : "");
  }
  if (emails.length > 15) console.log("  ... and", emails.length - 15, "more");

  console.log("\nSample lead_name values in connects (first 10):");
  connectList.slice(0, 10).forEach((c) => {
    const match = leadNameMatchesVariants(c.lead_name, variants);
    console.log("  ", JSON.stringify(c.lead_name), match ? " [name-match]" : "");
  });

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
