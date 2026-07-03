import { supabaseAdmin } from "../supabase";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function countWithFilters(params: { minCreatedAt?: string; maxCreatedAt?: string }) {
  if (!supabaseAdmin) throw new Error("supabaseAdmin not configured");
  let q = supabaseAdmin
    .from("masterlead")
    .select("id", { head: true, count: "exact" })
    .or("taalk_market.ilike.%globe market%,market.ilike.%globe market%")
    .or("cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.,cnresolution.eq.null");

  if (params.minCreatedAt) q = q.gte("created_at", params.minCreatedAt);
  if (params.maxCreatedAt) q = q.lt("created_at", params.maxCreatedAt);

  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return Number(count || 0);
}

async function main() {
  const nowIso = new Date().toISOString();
  const twoDaysAgo = isoDaysAgo(2);
  const thirtyDaysAgo = isoDaysAgo(30);

  const [total, bucket0to2, bucket3to30] = await Promise.all([
    countWithFilters({}),
    countWithFilters({ minCreatedAt: twoDaysAgo }),
    countWithFilters({ minCreatedAt: thirtyDaysAgo, maxCreatedAt: twoDaysAgo }),
  ]);

  console.log(
    JSON.stringify(
      {
        scope: "globe-market pending/null cnresolution",
        as_of_utc: nowIso,
        total_pending_null: total,
        bucket_0_2_days: bucket0to2,
        bucket_3_30_days: bucket3to30,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exitCode = 1;
});

