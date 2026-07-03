import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;

// Initialize Supabase with service key
const supabaseUrl = 'https://chjcwolkdwhpgapgvvby.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Local PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrateToSupabase() {
  try {
    console.log('🔄 Starting Taalk2CN migration to Supabase...');
    
    // Get all Taalk2CN leads from local database
    const localResult = await pool.query('SELECT * FROM "Taalk2CN" ORDER BY createdat ASC');
    const localLeads = localResult.rows;
    
    console.log(`📊 Found ${localLeads.length} leads in local Taalk2CN table`);
    
    if (localLeads.length === 0) {
      console.log('❌ No leads found in local database');
      return;
    }
    
    // Check if Taalk2CN table exists in Supabase
    const { data: existingData, error: checkError } = await supabase
      .from('Taalk2CN')
      .select('id')
      .limit(1);
    
    if (checkError && checkError.code === '42P01') {
      console.log('❌ Taalk2CN table does not exist in Supabase');
      console.log('ℹ️  Please create the Taalk2CN table in Supabase dashboard first');
      return;
    }
    
    // Check existing records in Supabase
    const { data: existingLeads, error: countError } = await supabase
      .from('Taalk2CN')
      .select('id')
      .eq('CNEmail', 'chrislafond@aoglobelife.com');
    
    if (countError) {
      console.error('❌ Error checking existing Supabase data:', countError);
      return;
    }
    
    console.log(`📊 Found ${existingLeads?.length || 0} existing leads for Chris in Supabase`);
    
    if (existingLeads && existingLeads.length > 0) {
      console.log('✅ Chris already has leads in Supabase Taalk2CN table');
      return;
    }
    
    // Migrate leads in batches of 100
    const batchSize = 100;
    let totalMigrated = 0;
    
    for (let i = 0; i < localLeads.length; i += batchSize) {
      const batch = localLeads.slice(i, i + batchSize);
      
      console.log(`🔄 Migrating batch ${Math.floor(i/batchSize) + 1} (${batch.length} leads)...`);
      
      // Format leads for Supabase insertion
      const supabaseLeads = batch.map(lead => ({
        firstname: lead.firstname,
        lastname: lead.lastname,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        taalk_market: lead.taalk_market,
        taalk_state: lead.taalk_state,
        taalk_leadid: lead.taalk_leadid,
        taalk_groupcode: lead.taalk_groupcode,
        taalk_email: lead.taalk_email,
        CNEmail: lead.CNEmail || 'chrislafond@aoglobelife.com',
        status: lead.status || 'pending',
        createdat: lead.createdat || new Date().toISOString(),
        updatedat: lead.updatedat || new Date().toISOString()
      }));
      
      const { data: insertedData, error: insertError } = await supabase
        .from('Taalk2CN')
        .insert(supabaseLeads);
      
      if (insertError) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError);
        continue;
      }
      
      totalMigrated += batch.length;
      console.log(`✅ Migrated batch ${Math.floor(i/batchSize) + 1} successfully`);
    }
    
    console.log(`🎉 Migration complete! ${totalMigrated} leads migrated to Supabase`);
    
    // Verify migration
    const { data: verifyData, error: verifyError } = await supabase
      .from('Taalk2CN')
      .select('id')
      .eq('CNEmail', 'chrislafond@aoglobelife.com');
    
    if (!verifyError && verifyData) {
      console.log(`✅ Verification: ${verifyData.length} leads now in Supabase for Chris`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrateToSupabase();