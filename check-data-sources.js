// Simple check to understand the data inconsistency
import { supabase } from './server/supabase.js';
import { sql } from './server/db.js';

async function checkDataSources() {
  console.log('🔍 CHECKING DATA SOURCE INCONSISTENCY...');
  
  try {
    // Check Supabase hotleads
    const { data: supabaseHotleads, error: supabaseError } = await supabase
      .from('hotleads')
      .select('cnresolution, COUNT(*)', { count: 'exact' })
      .not('cnresolution', 'is', null);
    
    if (supabaseError) {
      console.error('❌ Supabase error:', supabaseError);
    } else {
      console.log('📊 Supabase hotleads resolutions:', supabaseHotleads);
    }
    
    // Check PostgreSQL appointments
    const pgAppointments = await sql`
      SELECT 
        status, 
        COUNT(*) as count
      FROM appointments 
      GROUP BY status
    `;
    
    console.log('📊 PostgreSQL appointments by status:', pgAppointments);
    
    // The disconnect: User's screenshot shows many "booked" calls but our Supabase query shows 0
    // This suggests either:
    // 1. Different database environment
    // 2. Data not synced
    // 3. Different table/field being queried
    
    console.log('\n🔍 ANALYSIS:');
    console.log('User screenshot shows calls with cnresolution="booked"');
    console.log('But our Supabase query found 0 records with cnresolution="booked"');
    console.log('This indicates we may be querying the wrong database instance.');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkDataSources().catch(console.error);