#!/usr/bin/env node

// Direct migration script to create table and migrate leads in one step
import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const localPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createTableAndMigrate() {
  try {
    console.log('🚀 Creating veteran_leads table and migrating data...');

    // Step 1: Create the table via RPC call
    console.log('🏗️ Creating veteran_leads table in Supabase...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS "veteran_leads" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        status TEXT DEFAULT 'pending',
        call_attempts INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        taalk_market TEXT,
        taalk_state TEXT,
        taalk_lead_id TEXT,
        taalk_group_code TEXT,
        taalk_email TEXT,
        taalk_lead_source TEXT,
        taalk_sponsor_org TEXT,
        taalk_referred TEXT,
        taalk_relationship TEXT,
        taalk_secret_key TEXT,
        taalk_city TEXT,
        taalk_zip TEXT,
        taalk_address TEXT,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        called_at TIMESTAMP WITH TIME ZONE,
        dnc BOOLEAN DEFAULT false,
        try_count INTEGER DEFAULT 0,
        answered BOOLEAN DEFAULT false,
        has_sent_sms BOOLEAN DEFAULT false,
        has_open_link BOOLEAN DEFAULT false,
        has_redirect_call BOOLEAN DEFAULT false,
        duration INTEGER,
        duration_after_transfer INTEGER,
        has_summary BOOLEAN DEFAULT false,
        disposition TEXT,
        last_called_at TIMESTAMP WITH TIME ZONE,
        call_disposition TEXT,
        disposition_notes TEXT,
        disposition_timestamp TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_veteran_leads_user_email ON "veteran_leads"(user_email);
      CREATE INDEX IF NOT EXISTS idx_veteran_leads_status ON "veteran_leads"(status);
      CREATE INDEX IF NOT EXISTS idx_veteran_leads_taalk_market ON "veteran_leads"(taalk_market);
      
      ALTER TABLE "veteran_leads" ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY IF NOT EXISTS "Users can access their assigned leads" ON "veteran_leads"
        FOR ALL USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');
      
      GRANT ALL ON "veteran_leads" TO service_role;
      GRANT ALL ON "veteran_leads" TO authenticated;
    `;

    const { error: tableError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (tableError) {
      console.log('⚠️ Table creation via RPC failed, table may already exist:', tableError.message);
    } else {
      console.log('✅ Table created successfully');
    }

    // Step 2: Fetch local leads
    console.log('📥 Fetching leads from local database...');
    const localResult = await localPool.query(`
      SELECT * FROM veteran_leads 
      WHERE user_email = 'chrislafond@aoglobelife.com'
      ORDER BY id
    `);
    
    const localLeads = localResult.rows;
    console.log(`✅ Found ${localLeads.length} leads in local database`);

    if (localLeads.length === 0) {
      console.log('❌ No leads found in local database');
      return;
    }

    // Step 3: Prepare and insert leads
    console.log('🔄 Preparing leads for insertion...');
    const leadsForSupabase = localLeads.map(lead => ({
      user_email: lead.user_email,
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone,
      email: lead.email || null,
      address: lead.address || null,
      city: lead.city || null,
      state: lead.state || null,
      zip: lead.zip || null,
      status: lead.status || 'pending',
      call_attempts: lead.call_attempts || 0,
      notes: lead.notes || '',
      taalk_market: lead.taalk_market || 'Veteran',
      taalk_state: lead.taalk_state || null,
      taalk_lead_id: lead.taalk_lead_id || null,
      taalk_group_code: lead.taalk_group_code || null,
      taalk_email: lead.taalk_email || null,
      taalk_lead_source: lead.taalk_lead_source || null,
      taalk_sponsor_org: lead.taalk_sponsor_org || null,
      taalk_referred: lead.taalk_referred || null,
      taalk_relationship: lead.taalk_relationship || null,
      taalk_secret_key: lead.taalk_secret_key || null,
      taalk_city: lead.taalk_city || null,
      taalk_zip: lead.taalk_zip || null,
      taalk_address: lead.taalk_address || null,
      assigned_at: lead.assigned_at || new Date().toISOString(),
      created_at: lead.created_at || new Date().toISOString(),
      updated_at: lead.updated_at || new Date().toISOString()
    }));

    // Step 4: Insert in smaller batches
    const BATCH_SIZE = 25;
    let totalInserted = 0;
    
    for (let i = 0; i < leadsForSupabase.length; i += BATCH_SIZE) {
      const batch = leadsForSupabase.slice(i, i + BATCH_SIZE);
      console.log(`📤 Inserting batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(leadsForSupabase.length/BATCH_SIZE)} (${batch.length} leads)...`);
      
      const { data, error } = await supabase
        .from('veteran_leads')
        .insert(batch)
        .select('id');
      
      if (error) {
        console.error(`❌ Batch ${Math.floor(i/BATCH_SIZE) + 1} failed:`, error.message);
        
        // Try individual insertions
        for (const lead of batch) {
          const { error: individualError } = await supabase
            .from('veteran_leads')
            .insert([lead]);
          
          if (!individualError) {
            totalInserted++;
          }
        }
      } else {
        totalInserted += batch.length;
        console.log(`✅ Batch ${Math.floor(i/BATCH_SIZE) + 1} inserted successfully`);
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Step 5: Verify
    console.log('🔍 Verifying migration...');
    const { data: verificationData, error: verificationError } = await supabase
      .from('veteran_leads')
      .select('id, first_name, last_name, phone')
      .eq('user_email', 'chrislafond@aoglobelife.com');

    if (verificationError) {
      console.error('❌ Verification failed:', verificationError.message);
    } else {
      console.log(`🎉 MIGRATION COMPLETE!`);
      console.log(`📊 Total leads inserted: ${totalInserted}`);
      console.log(`📊 Verification count: ${verificationData.length}`);
      console.log(`📋 Sample lead: ${verificationData[0]?.first_name} ${verificationData[0]?.last_name} - ${verificationData[0]?.phone}`);
      console.log(`🚀 Production server should now show ${verificationData.length} veteran leads for Chris!`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await localPool.end();
  }
}

createTableAndMigrate();