#!/usr/bin/env node

// DIRECT UPLOAD - 422 leads to production database
import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;

// Production Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Local PostgreSQL connection
const localPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function uploadLeadsToProduction() {
  try {
    console.log('🚀 UPLOADING 422 LEADS TO PRODUCTION SERVER...');

    // Get all leads from local database
    const localQuery = `SELECT * FROM veteran_leads ORDER BY id`;
    const localResult = await localPool.query(localQuery);
    const leads = localResult.rows;
    
    console.log(`📥 Found ${leads.length} leads in local database`);

    // Create table in Supabase if it doesn't exist
    console.log('🔧 Creating veteran_leads table in production...');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.veteran_leads (
        id SERIAL PRIMARY KEY,
        user_email TEXT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        status TEXT DEFAULT 'pending',
        call_attempts INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        taalk_market TEXT DEFAULT 'Veteran',
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
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      ALTER TABLE public.veteran_leads ENABLE ROW LEVEL SECURITY;
      CREATE POLICY IF NOT EXISTS "Allow all access to veteran_leads" ON public.veteran_leads FOR ALL USING (true);
    `;

    // Execute table creation via RPC
    const { error: tableError } = await supabase.rpc('exec', { sql: createTableSQL });
    if (tableError) {
      console.log('⚠️ Table creation warning (may already exist):', tableError.message);
    }

    // Upload leads in batches
    let uploaded = 0;
    const batchSize = 100;
    
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      
      console.log(`📤 Uploading batch ${Math.floor(i/batchSize) + 1} (${batch.length} leads)...`);
      
      const formattedBatch = batch.map(lead => ({
        user_email: 'chrislafond@aoglobelife.com',
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zip_code: lead.zip_code,
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

      const { data, error } = await supabase
        .from('veteran_leads')
        .upsert(formattedBatch, { 
          onConflict: 'phone',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`❌ Batch upload failed:`, error);
      } else {
        uploaded += batch.length;
        console.log(`✅ Uploaded ${uploaded}/${leads.length} leads`);
      }
    }

    // Verify upload
    console.log('🔍 Verifying production upload...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('veteran_leads')
      .select('count', { count: 'exact' });

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
    } else {
      console.log(`🎉 SUCCESS! ${verifyData.length || uploaded} leads now live on production server!`);
    }

  } catch (error) {
    console.error('❌ Upload failed:', error);
  } finally {
    await localPool.end();
  }
}

uploadLeadsToProduction();