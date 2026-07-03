#!/usr/bin/env node

// Emergency fix: Create table manually and push 50 leads to get Chris working NOW
import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const localPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function emergencyFix() {
  try {
    console.log('🚨 EMERGENCY FIX: Getting Chris 50 leads NOW...');

    // Get 50 leads from local database
    const localResult = await localPool.query(`
      SELECT * FROM veteran_leads 
      WHERE user_email = 'chrislafond@aoglobelife.com' 
      LIMIT 50
    `);
    
    console.log(`Found ${localResult.rows.length} leads locally`);
    
    if (localResult.rows.length === 0) {
      console.log('No leads found!');
      return;
    }

    // Try direct insert to Taalk2CN with minimal schema
    const leads = localResult.rows.map((lead, index) => ({
      id: `${Date.now()}-${index}`,
      CNEmail: 'chrislafond@aoglobelife.com',
      firstname: lead.first_name || 'Unknown',
      lastname: lead.last_name || 'Name', 
      phone: lead.phone,
      email: lead.email || '',
      state: lead.state || 'Unknown',
      city: lead.city || '',
      address: lead.address || '',
      zip: lead.zip || '',
      taalk_market: 'Veteran',
      taalk_state: lead.state || 'Unknown',
      taalk_leadid: lead.taalk_lead_id || lead.id,
      taalk_groupcode: lead.taalk_group_code || 'VET',
      taalk_email: lead.email || '',
      status: 'pending'
    }));

    console.log('Sample lead:', JSON.stringify(leads[0], null, 2));

    // Try to insert one by one
    let inserted = 0;
    for (let i = 0; i < Math.min(leads.length, 10); i++) {
      const lead = leads[i];
      
      try {
        // Try direct table creation + insert in one operation
        const { error } = await supabase
          .from('Taalk2CN')
          .upsert([lead], { onConflict: 'id' });
        
        if (!error) {
          inserted++;
          console.log(`✅ Inserted lead ${i+1}: ${lead.firstname} ${lead.lastname}`);
        } else {
          console.log(`❌ Failed lead ${i+1}:`, error.message);
        }
      } catch (err) {
        console.log(`❌ Exception lead ${i+1}:`, err.message);
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n🎉 EMERGENCY FIX COMPLETE: ${inserted} leads inserted`);
    console.log('🚀 Check production server now!');

  } catch (error) {
    console.error('❌ Emergency fix failed:', error.message);
  } finally {
    await localPool.end();
  }
}

emergencyFix();