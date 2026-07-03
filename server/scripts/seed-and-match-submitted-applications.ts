/**
 * Seed submitted_applications with test data and run matching.
 * Run: npx tsx server/scripts/seed-and-match-submitted-applications.ts
 * Or: node (compiled) equivalent.
 *
 * Requires: SUBMITTED_APPLICATIONS_TABLE exists (run database/create-submitted-applications-table.sql in Supabase).
 */

import { supabaseAdmin } from "../supabase";
import {
  parsePastedSubmittedApplications,
  runMatchingForSubmittedApplications,
} from "../submitted-applications";

const TEST_DATA = `
SPRAAGS,JAVETTA	2/2/2026 8:12:02 PM	02/04/2026 10:42:30 AM	5 year(s), 10 month(s) & 25 day(s)	20953498	Life	$85.00	(200) - Submit Standard	(300) - Std SUB - MF Exported	MORROW, TYJERE - AWG57	AO Apex	Gore, Ben	Johnson, Kyle	Pending	Pass AV [Account Verified]	Ben, Gore	Ready To Release
SPRAAGS III,JAMES	2/2/2026 8:12:02 PM	02/04/2026 10:42:31 AM	5 year(s), 10 month(s) & 25 day(s)	20953497	Life	$85.00	(200) - Submit Standard	(300) - Std SUB - MF Exported	MORROW, TYJERE - AWG57	AO Apex	Gore, Ben	Johnson, Kyle	Pending	Pass AV [Account Verified]	Ben, Gore	Ready To Release
SCALZI,NICOLE	1/30/2026 3:12:01 PM	02/04/2026 10:22:52 AM	4 year(s), 6 month(s) & 8 day(s)	20948596	Life	$61.27	(200) - Submit Standard	(300) - Std SUB - MF Exported	BREGU, PANARIS - BJE01	AO Apex	Gore, Ben	Johnson, Kyle	Pending	Pass AV [Account Verified]	Ben, Gore	Ready To Release
BURNETT,BETH	2/9/2026 4:29:46 PM	02/11/2026 9:30:19 AM	3 year(s), 11 month(s) & 23 day(s)	20966836	Life	$99.86	(200) - Submit Standard	(300) - Std SUB - MF Exported	BILBILI, FRANKO - BHE76	AO Apex	Gore, Ben	Johnson, Kyle	Pending		Ben, Gore	Ready To Release
MCDONALD,DONALD	2/11/2026 10:48:04 AM	02/11/2026 11:43:37 AM	3 year(s), 11 month(s) & 23 day(s)	20970816	Life	$138.19	(200) - Submit Standard	(300) - Std SUB - MF Exported	BILBILI, FRANKO - BHK59	AO Apex	Gore, Ben	Johnson, Kyle	Pending		Ben, Gore	Ready To Release
`;

async function main() {
  if (!supabaseAdmin) {
    console.error("No supabase admin client");
    process.exit(1);
  }

  console.log("Parsing test data...");
  const rows = parsePastedSubmittedApplications(TEST_DATA);
  console.log(`Parsed ${rows.length} rows`);

  if (rows.length === 0) {
    console.log("No rows to insert");
    return;
  }

  let inserted = 0;
  for (const row of rows) {
    const payload = {
      insured: row.insured ?? null,
      agent_release: row.agent_release ?? null,
      sga_submit: row.sga_submit ?? null,
      tenure: row.tenure ?? null,
      policy_number: row.policy_number ?? null,
      lob: row.lob ?? null,
      cwa: row.cwa ?? null,
      submit_type: row.submit_type ?? null,
      nilico_status: row.nilico_status ?? null,
      agent: row.agent ?? null,
      office: row.office ?? null,
      qa_specialist: row.qa_specialist ?? null,
      director: row.director ?? null,
      telecheck: row.telecheck ?? null,
      verification_result: row.verification_result ?? null,
      submitted_by: row.submitted_by ?? null,
      mac_status: row.mac_status ?? null,
    };
    const { error } = await supabaseAdmin.from("submitted_applications").insert(payload);
    if (error) {
      console.warn("Insert error for", row.policy_number, error.message);
    } else {
      inserted++;
    }
  }
  console.log(`Inserted ${inserted} rows`);

  console.log("Running matching (name + agent + date window)...");
  const result = await runMatchingForSubmittedApplications();
  console.log("Match result:", {
    matched: result.matched,
    aoi_connect: result.aoi_connect,
    ccpro_booked: result.ccpro_booked,
    errors: result.errors,
  });

  const { data: list } = await supabaseAdmin
    .from("submitted_applications")
    .select("id, insured, agent, policy_number, transfer_type, matched_billing_transaction_id, matched_agent_dial_metric_id")
    .order("id", { ascending: false })
    .limit(20);
  console.log("Sample rows after match:", JSON.stringify(list, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
