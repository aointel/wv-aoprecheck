/**
 * One-off: set cn_email and cnresolution to null for given masterlead ids.
 * Usage: npx tsx server/scripts/clear-cn-for-leads.ts
 */

import { supabaseAdmin } from '../supabase';

const IDS = [
  686632, 689945, 692303, 687424, 688128, 686630, 686612, 692070, 687755, 687368,
  689144, 686835, 625566, 687535, 687980, 687807, 688112, 689944, 688441, 679894,
  687036, 686992, 691080, 531318, 690010, 686830, 689378, 686942, 689395, 687981,
  689339, 687023, 688599, 689884, 687756, 687363, 688265, 686584, 687089, 687364,
  692300, 689045, 687416, 687366, 690007, 624813,
];

async function main() {
  if (!supabaseAdmin) throw new Error('Supabase admin not available');
  const uniqueIds = [...new Set(IDS)];
  console.log(`Updating ${uniqueIds.length} masterlead rows: cn_email = null, cnresolution = null`);

  const { data, error } = await supabaseAdmin
    .from('masterlead')
    .update({ cn_email: null, cnresolution: null })
    .in('id', uniqueIds)
    .select('id');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  console.log('Updated', data?.length ?? 0, 'rows.');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
