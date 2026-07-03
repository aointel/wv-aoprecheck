import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';

// PostgreSQL Schema import
const callLogs = {
  twilioCallSid: String,
  agentEmail: String,
  toNumber: String,
  fromNumber: String,
  callStatus: String,
  callDuration: Number,
  callStartedAt: Date,
  callEndedAt: Date,
  isReached: Boolean,
  isBooked: Boolean
};

async function migrateSupabaseData() {
  console.log('🔄 Starting Supabase → PostgreSQL migration...');

  // Initialize Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // Initialize PostgreSQL
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  try {
    // Get all Supabase call logs
    console.log('📊 Fetching all Supabase call logs...');
    
    let allCalls = [];
    let from = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data: batch, error } = await supabase
        .from('twilio_call_logs')
        .select('*')
        .range(from, from + batchSize - 1)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('❌ Failed to fetch batch:', error);
        break;
      }
      
      if (!batch || batch.length === 0) {
        break;
      }
      
      allCalls = allCalls.concat(batch);
      from += batchSize;
      
      console.log(`📊 Fetched ${allCalls.length} total calls...`);
      
      if (batch.length < batchSize) {
        break;
      }
    }
    
    console.log(`📊 Total Supabase calls: ${allCalls.length}`);
    
    // Get existing PostgreSQL calls to avoid duplicates
    console.log('🔍 Checking existing PostgreSQL calls...');
    const existingCalls = await db.execute(
      'SELECT twilio_call_sid FROM call_logs'
    );
    const existingSids = new Set(existingCalls.rows.map(r => r.twilio_call_sid));
    console.log(`📊 Existing PostgreSQL calls: ${existingSids.size}`);
    
    // Filter out existing calls
    const newCalls = allCalls.filter(call => !existingSids.has(call.twilio_call_sid));
    console.log(`📊 New calls to migrate: ${newCalls.length}`);
    
    if (newCalls.length === 0) {
      console.log('✅ All calls already migrated!');
      return { success: true, migrated: 0, skipped: allCalls.length };
    }
    
    // Migrate in batches
    let migratedCount = 0;
    const insertBatchSize = 50;
    
    for (let i = 0; i < newCalls.length; i += insertBatchSize) {
      const batch = newCalls.slice(i, i + insertBatchSize);
      
      // Prepare insert values
      const values = batch.map(call => {
        const duration = call.call_duration || 0;
        return {
          twilio_call_sid: call.twilio_call_sid,
          agent_email: call.owner_email || 'unknown@aoglobelife.com',
          to_number: call.to_number,
          from_number: call.from_number,
          call_status: call.call_status,
          call_duration: duration,
          call_started_at: new Date(call.call_started_at || call.created_at),
          call_ended_at: call.call_ended_at ? new Date(call.call_ended_at) : null,
          is_reached: duration > 30,
          is_booked: duration > 120
        };
      });
      
      // Insert batch
      for (const value of values) {
        try {
          await db.execute(`
            INSERT INTO call_logs (
              twilio_call_sid, agent_email, to_number, from_number, call_status, 
              call_duration, call_started_at, call_ended_at, is_reached, is_booked
            ) VALUES (
              '${value.twilio_call_sid}', '${value.agent_email}', '${value.to_number}', 
              '${value.from_number}', '${value.call_status}', ${value.call_duration},
              '${value.call_started_at.toISOString()}',
              ${value.call_ended_at ? `'${value.call_ended_at.toISOString()}'` : 'NULL'},
              ${value.is_reached}, ${value.is_booked}
            )
          `);
          migratedCount++;
        } catch (error) {
          console.error(`❌ Failed to insert call ${value.twilio_call_sid}:`, error.message);
        }
      }
      
      console.log(`📊 Migrated ${migratedCount}/${newCalls.length} calls...`);
    }
    
    console.log(`✅ Migration complete! Migrated ${migratedCount} calls.`);
    return { success: true, migrated: migratedCount, skipped: allCalls.length - newCalls.length };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { success: false, error: error.message };
  }
}

// Run migration
migrateSupabaseData()
  .then(result => {
    console.log('📊 Final result:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Migration crashed:', error);
    process.exit(1);
  });

export { migrateSupabaseData };