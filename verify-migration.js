// Verify Twilio data migration to Supabase
import { supabase } from './server/supabase.js';

async function verifyMigration() {
  console.log('🔍 VERIFYING TWILIO DATA IN SUPABASE');
  
  try {
    // Check total records
    const { data: allRecords, error: allError } = await supabase
      .from('twilio_call_logs')
      .select('*', { count: 'exact' });
      
    if (allError) {
      console.error('❌ Error querying records:', allError);
      return;
    }
    
    console.log(`📊 Total records in Supabase: ${allRecords?.length || 0}`);
    
    if (allRecords && allRecords.length > 0) {
      console.log('\n📋 Sample records:');
      console.log(allRecords.slice(0, 3));
      
      // Group by owner_email
      const ownerStats = {};
      allRecords.forEach(record => {
        const owner = record.owner_email;
        if (!ownerStats[owner]) {
          ownerStats[owner] = { total: 0, reached: 0 };
        }
        ownerStats[owner].total++;
        if (record.call_duration > 30) {
          ownerStats[owner].reached++;
        }
      });
      
      console.log('\n📞 Calls by Owner:');
      Object.entries(ownerStats).forEach(([owner, stats]) => {
        console.log(`${owner}: ${stats.total} calls (${stats.reached} reached 30+s)`);
      });
    } else {
      console.log('❌ No records found in Supabase table');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyMigration();