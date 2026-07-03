/**
 * Prove `inbound_success_events` by associate id (`agent_id` column).
 *
 * Run from repo root:
 *   npx tsx server/scripts/prove-inbound-success-events.ts
 *   npx tsx server/scripts/prove-inbound-success-events.ts 1253
 */
import { supabaseAdmin } from "../supabase";

async function main() {
  if (!supabaseAdmin) {
    console.error("FAIL: supabaseAdmin is null (set Supabase env / hardcoded-config).");
    process.exit(1);
  }

  const arg = process.argv[2]?.trim();
  const ids: (string | number)[] = [];
  if (arg) {
    ids.push(arg);
    const n = Number(arg);
    if (Number.isFinite(n)) ids.push(n);
  }

  let q = supabaseAdmin
    .from("inbound_success_events")
    .select("id, agent_name, agent_id, market, state, connected_at")
    .order("connected_at", { ascending: false })
    .limit(45);

  if (ids.length) {
    q = q.in("agent_id", ids as any);
    console.log("Filter agent_id in", ids);
  } else {
    console.log("No associate id arg — last 45 rows (any agent)");
  }

  const wide = await q;

  if (wide.error) {
    console.error("FAIL:", wide.error.message);
    process.exit(1);
  }

  const rows = wide.data ?? [];
  console.log("OK: row_count=", rows.length);
  console.log(JSON.stringify(rows.slice(0, 10), null, 2));
  process.exit(rows.length ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
