/**
 * Check actual column names in vdp_calls table
 */

import { supabaseAdmin } from './server/supabase';

async function checkColumns() {
  console.log('🔍 Checking vdp_calls table structure...\n');

  // Try to get one record with all columns
  const { data: call, error } = await supabaseAdmin
    .from('vdp_calls')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    console.error('Full error:', JSON.stringify(error, null, 2));
  } else if (call) {
    console.log('✅ Sample record columns:');
    Object.keys(call).forEach(key => {
      const value = call[key];
      const type = typeof value;
      const preview = typeof value === 'string' && value.length > 50 
        ? value.substring(0, 50) + '...' 
        : value;
      console.log(`   - ${key}: ${type} = ${preview}`);
    });
  } else {
    console.log('⚠️ No records found in vdp_calls');
  }

  process.exit(0);
}

checkColumns().catch(console.error);
