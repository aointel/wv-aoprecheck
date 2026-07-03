import { Router } from "express";
import { supabaseAdmin } from "./supabase";
import {
  parsePastedSubmittedApplications,
  runMatchingForSubmittedApplications,
  resolveAgentEmail,
  getValidSales,
  computeAlp,
} from "./submitted-applications";

const router = Router();

const IMPORT_BATCH_SIZE = 50;

/**
 * POST /api/submitted-applications/import
 * Body: { pasted: string } — pasted table from portal. Processes in batches to avoid timeouts.
 */
router.post("/import", async (req, res) => {
  try {
    const { pasted } = req.body as { pasted?: string };
    if (!pasted || typeof pasted !== "string") {
      return res.status(400).json({ error: "Body must include pasted (string)" });
    }

    const rows = parsePastedSubmittedApplications(pasted);
    if (rows.length === 0) {
      return res.json({ success: true, imported: 0, message: "No rows parsed" });
    }

    let inserted = 0;
    let updated = 0;

    for (let b = 0; b < rows.length; b += IMPORT_BATCH_SIZE) {
      const batch = rows.slice(b, b + IMPORT_BATCH_SIZE);
      const policyNumbers = [...new Set(batch.map((r) => r.policy_number).filter(Boolean))] as string[];

      const existingMap = new Map<string, number>();
      if (policyNumbers.length > 0) {
        const { data: existingRows } = await supabaseAdmin
          .from("submitted_applications")
          .select("id, policy_number, sga_submit")
          .in("policy_number", policyNumbers);
        for (const r of existingRows ?? []) {
          const key = `${r.policy_number ?? ""}\0${r.sga_submit ?? ""}`;
          existingMap.set(key, r.id);
        }
      }

      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { id: number; payload: Record<string, unknown> }[] = [];

      for (const row of batch) {
        const alp = computeAlp(row.lob, row.cwa);
        const payload = {
          insured: row.insured ?? null,
          agent_release: row.agent_release ?? null,
          sga_submit: row.sga_submit ?? null,
          tenure: row.tenure ?? null,
          policy_number: row.policy_number ?? null,
          lob: row.lob ?? null,
          cwa: row.cwa ?? null,
          alp: alp ?? null,
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
        const key = `${payload.policy_number ?? ""}\0${payload.sga_submit ?? ""}`;
        const existingId = existingMap.get(key);
        if (existingId != null) {
          toUpdate.push({ id: existingId, payload });
        } else {
          toInsert.push(payload);
        }
      }

      for (const { id, payload } of toUpdate) {
        const { error: upErr } = await supabaseAdmin
          .from("submitted_applications")
          .update(payload)
          .eq("id", id);
        if (!upErr) updated++;
      }
      if (toInsert.length > 0) {
        const { error: inErr } = await supabaseAdmin.from("submitted_applications").insert(toInsert);
        if (!inErr) inserted += toInsert.length;
      }
    }

    res.json({
      success: true,
      imported: inserted + updated,
      inserted,
      updated,
      parsedRows: rows.length,
    });
  } catch (e) {
    console.error("Submitted applications import error:", e);
    res.status(500).json({ error: String(e) });
  }
});

/**
 * GET /api/submitted-applications
 * Query: agent, dateFrom, dateTo, policyNumber, office (optional). No pagination — returns all matching rows.
 */
router.get("/", async (req, res) => {
  try {
    const { agent, dateFrom, dateTo, policyNumber, office } = req.query;

    let q = supabaseAdmin
      .from("submitted_applications")
      .select("*")
      .order("sga_submit", { ascending: false });

    if (agent && typeof agent === "string") {
      q = q.ilike("agent", `%${agent}%`);
    }
    if (dateFrom && typeof dateFrom === "string") {
      q = q.gte("sga_submit", `${dateFrom}T00:00:00`);
    }
    if (dateTo && typeof dateTo === "string") {
      q = q.lte("sga_submit", `${dateTo}T23:59:59`);
    }
    if (policyNumber && typeof policyNumber === "string") {
      q = q.ilike("policy_number", `%${policyNumber}%`);
    }
    if (office && typeof office === "string") {
      q = q.ilike("office", `%${office}%`);
    }

    // Supabase/PostgREST often caps at 1000 rows per request — paginate to get all
    const PAGE = 1000;
    const list: unknown[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data: chunk, error } = await q.range(offset, offset + PAGE - 1);
      if (error) {
        console.error("Submitted applications fetch error:", error);
        return res.status(500).json({ error: error.message });
      }
      const rows = chunk ?? [];
      list.push(...rows);
      hasMore = rows.length === PAGE;
      offset += PAGE;
    }

    res.json({ success: true, data: list, count: list.length });
  } catch (e) {
    console.error("Submitted applications list error:", e);
    res.status(500).json({ error: String(e) });
  }
});

/**
 * POST /api/submitted-applications/run-matching
 * Run matching for all rows with transfer_type null; update with aoi_connect or ccpro_reached (CCPRO = agent_dial_metrics reached only) when matched.
 */
router.post("/run-matching", async (req, res) => {
  try {
    const result = await runMatchingForSubmittedApplications();
    res.json({
      success: true,
      matched: result.matched,
      aoi_connect: result.aoi_connect,
      ccpro_reached: result.ccpro_reached,
      errors: result.errors,
    });
  } catch (e) {
    console.error("Submitted applications run-matching error:", e);
    res.status(500).json({ error: String(e) });
  }
});

/**
 * GET /api/submitted-applications/production-summary
 * Query: dateFrom, dateTo (YYYY-MM-DD). Returns per-agent production (submitted_applications count, ALP sum),
 * connects count (billing_transactions), booked count (agent_dial_metrics). No pagination.
 */
router.get("/production-summary", async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo || typeof dateFrom !== "string" || typeof dateTo !== "string") {
      return res.status(400).json({ error: "dateFrom and dateTo (YYYY-MM-DD) required" });
    }
    const start = `${dateFrom}T00:00:00`;
    const end = `${dateTo}T23:59:59`;

    const appsPage = 1000;
    const apps: { agent: string | null; cwa: string | null; id: number }[] = [];
    let appsOffset = 0;
    let appsHasMore = true;
    while (appsHasMore) {
      const res = await supabaseAdmin
        .from("submitted_applications")
        .select("agent, cwa, id")
        .gte("sga_submit", start)
        .lte("sga_submit", end)
        .range(appsOffset, appsOffset + appsPage - 1);
      const chunk = res.data ?? [];
      apps.push(...chunk);
      appsHasMore = chunk.length === appsPage;
      appsOffset += appsPage;
    }

    const [connectsRes, bookedRes] = await Promise.all([
      supabaseAdmin
        .from("billing_transactions")
        .select("agent_email")
        .eq("transaction_type", "connect")
        .gte("transaction_date", start)
        .lte("transaction_date", end),
      supabaseAdmin
        .from("agent_dial_metrics")
        .select("agent_email")
        .eq("event_type", "booked")
        .gte("event_timestamp", start)
        .lte("event_timestamp", end),
    ]);

    const connects = (connectsRes.data ?? []) as { agent_email: string }[];
    const booked = (bookedRes.data ?? []) as { agent_email: string }[];

    const productionByAgent = new Map<string, { count: number; alpSum: number }>();
    apps.forEach((r) => {
      if (!r.agent) return;
      const key = r.agent;
      const cur = productionByAgent.get(key) ?? { count: 0, alpSum: 0 };
      cur.count += 1;
      const cwa = r.cwa;
      if (cwa) {
        const num = parseFloat(String(cwa).replace(/[$,]/g, ""));
        if (!isNaN(num)) cur.alpSum += num;
      }
      productionByAgent.set(key, cur);
    });

    const connectsByAgent = new Map<string, number>();
    connects.forEach((r) => {
      const e = (r.agent_email || "").toLowerCase();
      connectsByAgent.set(e, (connectsByAgent.get(e) ?? 0) + 1);
    });
    const bookedByAgent = new Map<string, number>();
    booked.forEach((r) => {
      const e = (r.agent_email || "").toLowerCase();
      bookedByAgent.set(e, (bookedByAgent.get(e) ?? 0) + 1);
    });

    const rows: Array<{
      agent: string;
      agent_email: string | null;
      production_count: number;
      production_alp_sum: number;
      connects_count: number;
      booked_count: number;
    }> = [];
    const portalAgents = [...productionByAgent.keys()];
    const emailByPortal = new Map<string, string | null>();
    await Promise.all(
      portalAgents.map(async (pa) => {
        const email = await resolveAgentEmail(pa);
        emailByPortal.set(pa, email);
      })
    );

    portalAgents.forEach((agentKey) => {
      const prod = productionByAgent.get(agentKey) ?? { count: 0, alpSum: 0 };
      const agentEmail = emailByPortal.get(agentKey) ?? null;
      const connCount = agentEmail ? connectsByAgent.get(agentEmail.toLowerCase()) ?? 0 : 0;
      const bookCount = agentEmail ? bookedByAgent.get(agentEmail.toLowerCase()) ?? 0 : 0;
      rows.push({
        agent: agentKey,
        agent_email: agentEmail || null,
        production_count: prod.count,
        production_alp_sum: Math.round(prod.alpSum * 100) / 100,
        connects_count: connCount,
        booked_count: bookCount,
      });
    });

    rows.sort((a, b) => b.production_count - a.production_count);

    res.json({ success: true, data: rows, dateFrom, dateTo });
  } catch (e) {
    console.error("Production summary error:", e);
    res.status(500).json({ error: String(e) });
  }
});

/**
 * GET /api/submitted-applications/valid-sales
 * Query: dateFrom, dateTo (YYYY-MM-DD), agent (optional).
 * Returns only valid sales: exclude Cancel submit/nilico, exclude Declined verification.
 */
router.get("/valid-sales", async (req, res) => {
  try {
    const { dateFrom, dateTo, agent } = req.query;
    const result = await getValidSales({
      dateFrom: typeof dateFrom === "string" ? dateFrom : undefined,
      dateTo: typeof dateTo === "string" ? dateTo : undefined,
      agent: typeof agent === "string" ? agent : undefined,
    });
    res.json({
      success: true,
      totalCount: result.totalCount,
      validCount: result.validCount,
      totalCwa: result.totalCwa,
      data: result.rows,
    });
  } catch (e) {
    console.error("Valid sales error:", e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;
