/**
 * DELETE ALL rows from taalk_call_analytics
 */
import { supabaseAdmin } from '../supabase';

async function main() {
  let totalDeleted = 0;
  for (let i = 0; i < 100; i++) {
    const { data: batch } = await supabaseAdmin.from('taalk_call_analytics').select('id').limit(1000);
    if (!batch?.length) break;
    const ids = batch.map((r: any) => r.id);
    const { error } = await supabaseAdmin.from('taalk_call_analytics').delete().in('id', ids);
    if (error) {
      console.error('Delete error:', error);
      process.exit(1);
    }
    totalDeleted += ids.length;
    console.log('Deleted', totalDeleted, 'rows...');
  }
  const { count } = await supabaseAdmin.from('taalk_call_analytics').select('*', { count: 'exact', head: true });
  console.log('✅ taalk_call_analytics cleared. Remaining:', count, 'rows');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
