const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const ZAPIER_URL = "https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/";

const envPaths = [
  path.join(__dirname, "..", ".env"),
  path.join(__dirname, "..", ".env.local"),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require("dotenv").config({ path: p });
    break;
  }
}

let SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  const configPath = path.join(__dirname, "..", "server", "hardcoded-config.ts");
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf-8");
    const urlM = content.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
    const keyM = content.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
    if (urlM) SUPABASE_URL = urlM[1];
    if (keyM) SUPABASE_SERVICE_KEY = keyM[1];
  }
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function resolveAssociateId(email) {
  const normalized = String(email || "").toLowerCase().trim();
  if (!normalized) return null;

  const { data: byCompany } = await supabase
    .from("customers")
    .select("associate_id")
    .eq("company_email", normalized)
    .limit(1)
    .maybeSingle();
  if (byCompany?.associate_id != null) return byCompany.associate_id;

  const { data: byPersonal } = await supabase
    .from("customers")
    .select("associate_id")
    .eq("personal_email", normalized)
    .limit(1)
    .maybeSingle();
  if (byPersonal?.associate_id != null) return byPersonal.associate_id;

  const { data: byProducer } = await supabase
    .from("producerlist")
    .select("associate_id")
    .eq("company_email", normalized)
    .limit(1)
    .maybeSingle();
  if (byProducer?.associate_id != null) return byProducer.associate_id;

  return null;
}

async function run() {
  const ptDay = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const startUtc = new Date(`${ptDay}T00:00:00-07:00`).toISOString();
  const endUtc = new Date(new Date(`${ptDay}T00:00:00-07:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const { data: bookedRowsData, error: bookedErr } = await supabase
    .from("masterlead")
    .select("id, taalk_lead_id, cn_email, cnresolution, updated_at")
    .in("cnresolution", ["booked", "appointment", "appointment_set"])
    .gte("updated_at", startUtc)
    .lt("updated_at", endUtc)
    .order("updated_at", { ascending: false })
    .limit(5000);
  if (bookedErr) throw bookedErr;
  const bookedRows = bookedRowsData || [];

  let sent = 0;
  let skippedNoLeadId = 0;
  let skippedNoAssociate = 0;
  let failed = 0;
  const details = [];

  for (const row of bookedRows) {
    const taalkLeadId = String(row.taalk_lead_id || "").trim();
    const email = String(row.cn_email || "").trim();

    if (!taalkLeadId) {
      skippedNoLeadId++;
      details.push({
        id: row.id,
        taalk_lead_id: row.taalk_lead_id,
        cn_email: email,
        status: "skipped_no_taalk_lead_id",
      });
      continue;
    }

    const associateId = await resolveAssociateId(email);
    if (associateId == null || String(associateId).trim() === "") {
      skippedNoAssociate++;
      details.push({
        id: row.id,
        taalk_lead_id: taalkLeadId,
        cn_email: email,
        status: "skipped_no_associate_id",
      });
      continue;
    }

    const payload = {
      lead_id: taalkLeadId,
      associate_id: associateId,
    };

    try {
      const resp = await fetch(ZAPIER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        failed++;
        details.push({
          id: row.id,
          taalk_lead_id: taalkLeadId,
          cn_email: email,
          associate_id: associateId,
          status: "webhook_failed",
          http_status: resp.status,
        });
        continue;
      }

      await supabase
        .from("masterlead")
        .update({ webhook_sent_at: new Date().toISOString() })
        .eq("id", row.id);

      sent++;
      details.push({
        id: row.id,
        taalk_lead_id: taalkLeadId,
        cn_email: email,
        associate_id: associateId,
        status: "sent",
      });
    } catch (err) {
      failed++;
      details.push({
        id: row.id,
        taalk_lead_id: taalkLeadId,
        cn_email: email,
        associate_id: associateId,
        status: "webhook_exception",
        error: err?.message || String(err),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        ptDay,
        bookedRows: bookedRows.length,
        sent,
        skippedNoLeadId,
        skippedNoAssociate,
        failed,
        details,
      },
      null,
      2,
    ),
  );
}

run().catch((err) => {
  console.error(err.message || String(err));
  process.exitCode = 1;
});
