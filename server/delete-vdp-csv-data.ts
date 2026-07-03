import { supabaseAdmin } from './supabase';

async function deleteVdpCsvData() {
  try {
    console.log('🗑️ Deleting VDP CSV data for 12/6/2025...');
    
    // Delete from vdp_calls_BLASTPICK for 12/6/2025
    const { error: vdpError, count: vdpCount } = await supabaseAdmin
      .from('vdp_calls_BLASTPICK')
      .delete({ count: 'exact' })
      .gte('time', '2025-12-06T00:00:00')
      .lte('time', '2025-12-06T23:59:59');
    
    if (vdpError) {
      console.error('❌ Error deleting vdp_calls_BLASTPICK:', vdpError);
    } else {
      console.log(`✅ Deleted ${vdpCount || 0} records from vdp_calls_BLASTPICK`);
    }
    
    console.log('✅ Deletion complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteVdpCsvData().then(() => process.exit(0));

