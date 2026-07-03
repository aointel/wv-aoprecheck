/**
 * Backfill aoi_alp and ccpro_alp from alp for all matched rows (so ALP shows by origin).
 * Run: npx tsx server/scripts/backfill-submitted-apps-alp-by-origin.ts
 */

import { supabaseAdmin } from "../supabase";

async function main() {
  if (!supabaseAdmin) {
    console.error("No Supabase admin client.");
    process.exit(1);
  }

  const PAGE = 1000;

  // AOI: set aoi_alp = alp where matched to AOI connect (paginate to get all)
  let aoiUpdated = 0;
  let aoiOffset = 0;
  let aoiHasMore = true;
  while (aoiHasMore) {
    const { data: aoiRows, error: aoiErr } = await supabaseAdmin
      .from("submitted_applications")
      .select("id, alp")
      .eq("transfer_type", "aoi_connect")
      .range(aoiOffset, aoiOffset + PAGE - 1);

    if (aoiErr) {
      console.error("AOI fetch error:", aoiErr);
      process.exit(1);
    }
    const list = aoiRows ?? [];
    for (const row of list) {
      const { error: uErr } = await supabaseAdmin
        .from("submitted_applications")
        .update({ aoi_alp: row.alp != null ? Number(row.alp) : null })
        .eq("id", row.id);
      if (!uErr) aoiUpdated++;
    }
    aoiHasMore = list.length === PAGE;
    aoiOffset += PAGE;
  }

  // CCPRO: set ccpro_alp = alp where matched to CCPRO (agent_dial_metrics reached only) (paginate to get all)
  let ccproUpdated = 0;
  let ccproOffset = 0;
  let ccproHasMore = true;
  while (ccproHasMore) {
    const { data: ccproRows, error: ccproErr } = await supabaseAdmin
      .from("submitted_applications")
      .select("id, alp")
      .eq("transfer_type", "ccpro_reached")
      .range(ccproOffset, ccproOffset + PAGE - 1);

    if (ccproErr) {
      console.error("CCPRO fetch error:", ccproErr);
      process.exit(1);
    }
    const list = ccproRows ?? [];
    for (const row of list) {
      const { error: uErr } = await supabaseAdmin
        .from("submitted_applications")
        .update({ ccpro_alp: row.alp != null ? Number(row.alp) : null })
        .eq("id", row.id);
      if (!uErr) ccproUpdated++;
    }
    ccproHasMore = list.length === PAGE;
    ccproOffset += PAGE;
  }

  console.log("Backfill done. AOI ALP updated: %d rows. CCPRO ALP updated: %d rows.", aoiUpdated, ccproUpdated);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
