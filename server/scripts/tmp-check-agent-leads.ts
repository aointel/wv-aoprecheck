import { leaseDialerPool } from "../db";
import { supabaseAdmin } from "../supabase";

async function main() {
  const email = String(process.argv[2] || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    throw new Error("Usage: npx tsx server/scripts/tmp-check-agent-leads.ts <agent_email>");
  }

  let pendingOwnedCount: number | null = null;
  try {
    const pendingOwned = await leaseDialerPool.query<{ n: number }>(
      `
        select count(*)::int as n
        from masterlead
        where lower(cn_email) = lower($1)
          and lower(trim(coalesce(cnresolution, 'pending'))) in ('pending','new','','null')
      `,
      [email],
    );
    pendingOwnedCount = Number(pendingOwned.rows[0]?.n || 0);
  } catch {
    pendingOwnedCount = null;
  }

  const assignmentRows = await leaseDialerPool.query<{ n: number }>(
    `
      select count(*)::int as n
      from leasedialer_assignments
      where lower(agent_email) = lower($1)
        and queue = 'hotlead'
        and status in ('queued','active')
    `,
    [email],
  );

  const plusAssignmentRows = await leaseDialerPool.query<{ n: number }>(
    `
      select count(*)::int as n
      from leasedialer_assignments
      where lower(agent_email) = lower($1)
        and queue = 'plus'
        and status in ('queued','active')
    `,
    [email],
  );

  const clientBuffer = await leaseDialerPool.query<{ buffer_count: number; updated_at: string }>(
    `
      select coalesce(local_leased_lead_count, 0)::int as buffer_count, updated_at
      from leasedialer_client_status
      where lower(agent_email) = lower($1)
      order by updated_at desc
      limit 1
    `,
    [email],
  );

  const routingProfile = await leaseDialerPool.query(
    `
      select markets, states, source, updated_at
      from agent_routing_profiles
      where lower(agent_email) = lower($1)
      limit 1
    `,
    [email],
  );

  let customer: any = null;
  let liveStatus: any = null;
  let plusInventoryByAssociate: any = null;
  let plusInventoryByEmailAnyAssociate: any = null;
  let plusResolutionBreakdown: any[] = [];
  let ownedPendingDiagnostics: any = null;
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("customers")
      .select("company_email, personal_email, market, states, mga, rga, associate_id")
      .or(`company_email.eq.${email},personal_email.eq.${email}`)
      .limit(1)
      .maybeSingle();
    customer = data || null;

    const { data: liveData } = await supabaseAdmin
      .from("agent_live_call_status")
      .select("agent_email,status,ccpro_enabled,last_heartbeat_at,updated_at")
      .eq("agent_email", email)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    liveStatus = liveData || null;

    const associateId = Number((customer as any)?.associate_id || 0);
    if (associateId > 0) {
      const { data: plusData } = await supabaseAdmin
        .from("masterlead")
        .select("cnresolution, dnc, taalk_market, market", { count: "exact" })
        .eq("associate_id", associateId)
        .or("taalk_market.ilike.%plus%,market.ilike.%plus%")
        .limit(50000);

      const rows = plusData || [];
      const normalizeRes = (v: unknown) => String(v ?? "").toLowerCase().trim();
      const totalPlus = rows.length;
      const callablePlus = rows.filter((r: any) => {
        const res = normalizeRes(r.cnresolution);
        const dnc = String(r.dnc ?? "false").toLowerCase();
        if (["true", "t", "yes", "1"].includes(dnc)) return false;
        return res === "" || res === "pending" || res === "new";
      }).length;
      const dncPlus = rows.filter((r: any) => {
        const dnc = String(r.dnc ?? "false").toLowerCase();
        return ["true", "t", "yes", "1"].includes(dnc);
      }).length;
      plusInventoryByAssociate = {
        associate_id: associateId,
        total_plus: totalPlus,
        callable_plus: callablePlus,
        dnc_plus: dncPlus,
      };

      const breakdownMap = new Map<string, number>();
      for (const row of rows) {
        const key = normalizeRes((row as any).cnresolution) || "(empty)";
        breakdownMap.set(key, (breakdownMap.get(key) || 0) + 1);
      }
      plusResolutionBreakdown = Array.from(breakdownMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([resolution, count]) => ({ resolution, count }));
    }

    const { data: plusByEmailRows } = await supabaseAdmin
      .from("masterlead")
      .select("associate_id, cnresolution, dnc, taalk_market, market")
      .eq("cn_email", email)
      .or("taalk_market.ilike.%plus%,market.ilike.%plus%")
      .limit(50000);

    const byEmailRows = plusByEmailRows || [];
    const normalizeRes = (v: unknown) => String(v ?? "").toLowerCase().trim();
    plusInventoryByEmailAnyAssociate = {
      total_plus: byEmailRows.length,
      callable_plus: byEmailRows.filter((r: any) => {
        const res = normalizeRes(r.cnresolution);
        const dnc = String(r.dnc ?? "false").toLowerCase();
        if (["true", "t", "yes", "1"].includes(dnc)) return false;
        return res === "" || res === "pending" || res === "new";
      }).length,
      distinct_associate_ids: Array.from(
        new Set(
          byEmailRows
            .map((r: any) => Number(r.associate_id || 0))
            .filter((n: number) => n > 0),
        ),
      ).sort((a, b) => a - b),
    };

    const { data: ownedRows } = await supabaseAdmin
      .from("masterlead")
      .select("id, cnresolution, dnc, taalk_lead_id, taalk_market, market, taalk_state, state")
      .eq("cn_email", email)
      .limit(50000);

    const allOwned = ownedRows || [];
    const pendingOwned = allOwned.filter((r: any) => {
      const res = String(r.cnresolution ?? "").toLowerCase().trim();
      return res === "" || res === "pending" || res === "new" || res === "null";
    });
    const normalizeMarket = (lead: any): string => {
      const raw = String(lead.taalk_market || lead.market || "").toLowerCase().replace(/\s+/g, "");
      if (raw.includes("globe")) return "Globe Market";
      if (raw.includes("veteran")) return "Veteran";
      return String(lead.taalk_market || lead.market || "").trim();
    };
    const normalizeState = (lead: any): string =>
      String(lead.taalk_state || lead.state || "")
        .toUpperCase()
        .trim();
    const agentMarkets = new Set(
      Array.isArray((customer as any)?.market) ? (customer as any).market.map((m: any) => String(m)) : [],
    );
    const agentStates = new Set(
      Array.isArray((customer as any)?.states)
        ? (customer as any).states.map((s: any) => String(s).toUpperCase().trim())
        : [],
    );

    const blockers = {
      missing_taalk_lead_id: 0,
      dnc_true: 0,
      market_mismatch: 0,
      state_mismatch: 0,
      likely_assignable: 0,
    };

    const nonAssignableSample: any[] = [];
    for (const lead of pendingOwned) {
      const hasTaalkId = String(lead.taalk_lead_id || "").trim() !== "";
      const dnc = ["true", "t", "yes", "1"].includes(String(lead.dnc ?? "false").toLowerCase());
      const market = normalizeMarket(lead);
      const st = normalizeState(lead);
      const marketMatch = market ? agentMarkets.has(market) : false;
      const stateMatch = st ? agentStates.has(st) : false;
      const reasons: string[] = [];
      if (!hasTaalkId) {
        blockers.missing_taalk_lead_id++;
        reasons.push("missing_taalk_lead_id");
      }
      if (dnc) {
        blockers.dnc_true++;
        reasons.push("dnc_true");
      }
      if (!marketMatch) {
        blockers.market_mismatch++;
        reasons.push("market_mismatch");
      }
      if (!stateMatch) {
        blockers.state_mismatch++;
        reasons.push("state_mismatch");
      }
      if (reasons.length === 0) {
        blockers.likely_assignable++;
      } else if (nonAssignableSample.length < 12) {
        nonAssignableSample.push({
          id: lead.id,
          market,
          state: st,
          taalk_lead_id: lead.taalk_lead_id || null,
          dnc: lead.dnc,
          reasons,
        });
      }
    }
    ownedPendingDiagnostics = {
      owned_total: allOwned.length,
      owned_pending_like: pendingOwned.length,
      blockers,
      non_assignable_sample: nonAssignableSample,
    };
  }

  console.log(
    JSON.stringify(
      {
        email,
        pending_owned_masterlead: pendingOwnedCount,
        active_hotlead_assignments: assignmentRows.rows[0]?.n ?? 0,
        active_plus_assignments: plusAssignmentRows.rows[0]?.n ?? 0,
        client_buffer: clientBuffer.rows[0] || null,
        live_status: liveStatus,
        routing_profile: routingProfile.rows[0] || null,
        customer,
        plus_inventory_by_associate: plusInventoryByAssociate,
        plus_inventory_by_email_any_associate: plusInventoryByEmailAnyAssociate,
        plus_resolution_breakdown: plusResolutionBreakdown,
        owned_pending_diagnostics: ownedPendingDiagnostics,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error("tmp-check-agent-leads failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await leaseDialerPool.end().catch(() => undefined);
  });

