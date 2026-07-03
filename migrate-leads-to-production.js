#!/usr/bin/env node

// Migration script to copy 422 Taalk2CN leads from local to production database
import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;

// Production Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Local PostgreSQL connection
const localPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/connectnow'
});

async function migrateLeadsToProduction() {
  try {
    console.log('🔍 Starting migration of 422 Taalk2CN leads to production...');

    // Step 1: Fetch all leads from local veteran_leads table
    console.log('📥 Fetching leads from local veteran_leads table...');
    const localQuery = `
      SELECT * FROM veteran_leads 
      WHERE user_email = 'chrislafond@aoglobelife.com'
      ORDER BY id
    `;
    
    const localResult = await localPool.query(localQuery);
    const localLeads = localResult.rows;
    
    console.log(`✅ Found ${localLeads.length} leads in local database`);
    
    if (localLeads.length === 0) {
      console.error('❌ No leads found in local database');
      return;
    }

    // Step 2: Check if veteran_leads table exists in Supabase
    console.log('🔍 Checking Supabase veteran_leads table...');
    const { data: existingLeads, error: fetchError } = await supabase
      .from('veteran_leads')
      .select('id')
      .limit(1);

    if (fetchError) {
      console.log('⚠️ veteran_leads table may not exist in Supabase, it should already exist from previous migrations');
    }

    // Step 3: Prepare veteran leads for Supabase insertion
    console.log('🔄 Preparing veteran leads for Supabase insertion...');
    const leadsForSupabase = localLeads.map(lead => ({
      user_email: lead.user_email,
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      status: lead.status || 'pending',
      call_attempts: lead.call_attempts || 0,
      notes: lead.notes || '',
      taalk_market: lead.taalk_market || 'Veteran',
      taalk_state: lead.taalk_state,
      taalk_lead_id: lead.taalk_lead_id,
      taalk_group_code: lead.taalk_group_code,
      taalk_email: lead.taalk_email,
      taalk_lead_source: lead.taalk_lead_source,
      taalk_sponsor_org: lead.taalk_sponsor_org,
      taalk_referred: lead.taalk_referred,
      taalk_relationship: lead.taalk_relationship,
      taalk_secret_key: lead.taalk_secret_key,
      taalk_city: lead.taalk_city,
      taalk_zip: lead.taalk_zip,
      taalk_address: lead.taalk_address,
      assigned_at: lead.assigned_at,
      created_at: lead.created_at,
      updated_at: lead.updated_at
    }));

    // Step 4: Insert in batches to avoid timeout
    const BATCH_SIZE = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < leadsForSupabase.length; i += BATCH_SIZE) {
      const batch = leadsForSupabase.slice(i, i + BATCH_SIZE);
      console.log(`📤 Inserting batch ${Math.floor(i/BATCH_SIZE) + 1} (${batch.length} leads)...`);
      
      const { data, error } = await supabase
        .from('veteran_leads')
        .insert(batch)
        .select('id');
      
      if (error) {
        console.error('❌ Batch insertion error:', error);
        console.error('Failed batch size:', batch.length);
        console.error('Sample record:', JSON.stringify(batch[0], null, 2));
        
        // Try individual insertions for this batch
        console.log('🔄 Trying individual insertions for failed batch...');
        for (const lead of batch) {
          const { error: individualError } = await supabase
            .from('veteran_leads')
            .insert([lead]);
          
          if (individualError) {
            console.error(`❌ Failed to insert lead: ${lead.first_name} ${lead.last_name}`, individualError);
          } else {
            totalInserted++;
          }
        }
      } else {
        totalInserted += batch.length;
        console.log(`✅ Successfully inserted batch of ${batch.length} leads`);
      }
    }

    // Step 5: Verify the migration
    console.log('🔍 Verifying migration...');
    const { data: verificationData, error: verificationError } = await supabase
      .from('veteran_leads')
      .select('id, first_name, last_name, phone, user_email')
      .eq('user_email', 'chrislafond@aoglobelife.com');

    if (verificationError) {
      console.error('❌ Verification failed:', verificationError);
    } else {
      console.log(`✅ Migration completed successfully!`);
      console.log(`📊 Total leads migrated: ${totalInserted}`);
      console.log(`📊 Verification shows: ${verificationData.length} leads in production`);
      console.log(`📋 Sample production lead:`, verificationData[0]);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await localPool.end();
  }
}

// Run the migration
migrateLeadsToProduction();