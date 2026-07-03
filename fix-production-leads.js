#!/usr/bin/env node

// Quick fix to get Chris's leads working on production by pushing them to Supabase
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
const localPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixProduction() {
  try {
    console.log('🚀 Fixing production leads for Chris...');

    // Step 1: Get leads from local database
    const localResult = await localPool.query(`
      SELECT * FROM veteran_leads 
      WHERE user_email = 'chrislafond@aoglobelife.com' 
      AND phone IS NOT NULL
      ORDER BY id LIMIT 50
    `);
    
    console.log(`✅ Found ${localResult.rows.length} leads locally`);
    
    if (localResult.rows.length === 0) {
      console.log('❌ No leads found in local database');
      return;
    }

    // Step 2: Create a simple Taalk2CN table structure in Supabase
    console.log('🏗️ Creating Taalk2CN table in Supabase...');
    
    const { error: createError } = await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS "Taalk2CN" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "CNEmail" TEXT NOT NULL,
          firstname TEXT,
          lastname TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          zip TEXT,
          status TEXT DEFAULT 'pending',
          taalk_market TEXT DEFAULT 'Veteran',
          taalk_state TEXT,
          taalk_leadid TEXT,
          taalk_groupcode TEXT,
          taalk_email TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_taalk2cn_cnemail ON "Taalk2CN"("CNEmail");
        
        GRANT ALL ON "Taalk2CN" TO service_role;
        GRANT ALL ON "Taalk2CN" TO authenticated;
      `
    });

    if (createError) {
      console.log('⚠️ Table creation warning (may already exist):', createError.message);
    }

    // Step 3: Convert and insert leads 
    console.log('🔄 Converting and inserting leads...');
    
    const leadsForSupabase = localResult.rows.slice(0, 50).map(lead => ({
      CNEmail: 'chrislafond@aoglobelife.com',
      firstname: lead.first_name,
      lastname: lead.last_name,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      status: 'pending',
      taalk_market: lead.taalk_market || 'Veteran',
      taalk_state: lead.taalk_state || lead.state,
      taalk_leadid: lead.taalk_lead_id,
      taalk_groupcode: lead.taalk_group_code,
      taalk_email: lead.taalk_email || lead.email
    }));

    // Insert in small batches
    let totalInserted = 0;
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < leadsForSupabase.length; i += BATCH_SIZE) {
      const batch = leadsForSupabase.slice(i, i + BATCH_SIZE);
      
      const { data, error } = await supabase
        .from('Taalk2CN')
        .insert(batch);
      
      if (error) {
        console.log(`⚠️ Batch ${i/BATCH_SIZE + 1} error:`, error.message);
        
        // Try individual inserts
        for (const lead of batch) {
          const { error: indError } = await supabase
            .from('Taalk2CN')
            .insert([lead]);
          
          if (!indError) {
            totalInserted++;
          }
        }
      } else {
        totalInserted += batch.length;
        console.log(`✅ Inserted batch ${i/BATCH_SIZE + 1} (${batch.length} leads)`);
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Step 4: Verify
    const { data: verification, error: verifyError } = await supabase
      .from('Taalk2CN')
      .select('*')
      .eq('CNEmail', 'chrislafond@aoglobelife.com')
      .limit(5);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
    } else {
      console.log(`🎉 SUCCESS! Inserted ${totalInserted} leads`);
      console.log(`📊 Verification: ${verification.length} leads in Supabase`);
      console.log(`📋 Sample: ${verification[0]?.firstname} ${verification[0]?.lastname} - ${verification[0]?.phone}`);
      console.log(`🚀 Production server should now load Chris's leads!`);
    }

  } catch (error) {
    console.error('❌ Fix production failed:', error.message);
  } finally {
    await localPool.end();
  }
}

fixProduction();