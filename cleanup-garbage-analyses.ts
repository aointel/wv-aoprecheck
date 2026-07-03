/**
 * Delete all garbage/failed call analyses
 */

import { supabaseAdmin } from './server/supabase';

async function cleanupGarbage() {
  console.log('🧹 Cleaning up garbage call analyses...\n');
  
  try {
    // Delete all failed analyses
    const { data: failed, error: failedError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id, taalk_call_id, analysis_status')
      .eq('analysis_status', 'failed');
    
    if (failedError) {
      console.error('❌ Error fetching failed analyses:', failedError);
      return;
    }
    
    console.log(`📊 Found ${failed?.length || 0} failed analyses`);
    
    if (failed && failed.length > 0) {
      const failedIds = failed.map(f => f.id);
      const { error: deleteError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .delete()
        .in('id', failedIds);
      
      if (deleteError) {
        console.error('❌ Error deleting failed analyses:', deleteError);
      } else {
        console.log(`✅ Deleted ${failed.length} failed analyses`);
      }
    }
    
    // Delete analyses with invalid/missing taalk_call_id
    const { data: invalid, error: invalidError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id, taalk_call_id')
      .or('taalk_call_id.is.null,taalk_call_id.eq.,taalk_call_id.like.twilio-%');
    
    if (invalidError) {
      console.error('❌ Error fetching invalid analyses:', invalidError);
      return;
    }
    
    console.log(`📊 Found ${invalid?.length || 0} invalid analyses (no taalk_call_id or Twilio calls)`);
    
    if (invalid && invalid.length > 0) {
      const invalidIds = invalid.map(i => i.id);
      const { error: deleteError2 } = await supabaseAdmin
        .from('taalk_call_analytics')
        .delete()
        .in('id', invalidIds);
      
      if (deleteError2) {
        console.error('❌ Error deleting invalid analyses:', deleteError2);
      } else {
        console.log(`✅ Deleted ${invalid.length} invalid analyses`);
      }
    }
    
    // Delete analyses that are "analyzing" but old (stuck)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { data: stuck, error: stuckError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id, analysis_status, analyzed_at')
      .eq('analysis_status', 'analyzing')
      .lt('analyzed_at', oneDayAgo.toISOString());
    
    if (stuckError) {
      console.error('❌ Error fetching stuck analyses:', stuckError);
      return;
    }
    
    console.log(`📊 Found ${stuck?.length || 0} stuck analyses (analyzing for >1 day)`);
    
    if (stuck && stuck.length > 0) {
      const stuckIds = stuck.map(s => s.id);
      const { error: deleteError3 } = await supabaseAdmin
        .from('taalk_call_analytics')
        .delete()
        .in('id', stuckIds);
      
      if (deleteError3) {
        console.error('❌ Error deleting stuck analyses:', deleteError3);
      } else {
        console.log(`✅ Deleted ${stuck.length} stuck analyses`);
      }
    }
    
    console.log('\n✅ Cleanup complete!');
    
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

cleanupGarbage();
