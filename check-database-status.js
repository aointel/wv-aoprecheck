#!/usr/bin/env node
// Quick script to check database status for Chris's leads
import pkg from 'pg';
const { Pool } = pkg;
import { createClient } from '@supabase/supabase-js';

// Check local PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Check Supabase database
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkDatabaseStatus() {
  console.log('🔍 CHECKING DATABASE STATUS FOR CHRIS\'S LEADS...\n');
  
  try {
    // Check local Taalk2CN table
    console.log('📊 LOCAL DATABASE (Taalk2CN):');
    const localResult = await pool.query(`
      SELECT COUNT(*) as count FROM "Taalk2CN" 
      WHERE "CNEmail" = 'chrislafond@aoglobelife.com'
    `);
    console.log(`✅ Found ${localResult.rows[0].count} leads for chrislafond@aoglobelife.com\n`);
    
    // Check Supabase masterlead table
    console.log('📊 SUPABASE DATABASE (masterlead):');
    const { data: supabaseLeads, error } = await supabase
      .from('masterlead')
      .select('*')
      .eq('cn_email', 'chrislafond@aoglobelife.com');
    
    if (error) {
      console.log('❌ Supabase error:', error.message);
    } else {
      console.log(`✅ Found ${supabaseLeads?.length || 0} leads for chrislafond@aoglobelife.com\n`);
    }
    
    // Show sample from each database
    if (localResult.rows[0].count > 0) {
      console.log('📋 SAMPLE LOCAL LEADS:');
      const sampleLocal = await pool.query(`
        SELECT firstname, lastname, phone, taalk_market 
        FROM "Taalk2CN" 
        WHERE "CNEmail" = 'chrislafond@aoglobelife.com' 
        LIMIT 3
      `);
      sampleLocal.rows.forEach(lead => {
        console.log(`  - ${lead.firstname} ${lead.lastname} (${lead.phone}) - ${lead.taalk_market}`);
      });
      console.log('');
    }
    
    if (supabaseLeads && supabaseLeads.length > 0) {
      console.log('📋 SAMPLE SUPABASE LEADS:');
      supabaseLeads.slice(0, 3).forEach(lead => {
        console.log(`  - ${lead.first_name} ${lead.last_name} (${lead.phone}) - ${lead.taalk_market}`);
      });
      console.log('');
    }
    
    // Summary
    console.log('🎯 STATUS SUMMARY:');
    console.log(`📍 Local database: ${localResult.rows[0].count} leads`);
    console.log(`📍 Supabase database: ${supabaseLeads?.length || 0} leads`);
    
    if (localResult.rows[0].count > 0 && (!supabaseLeads || supabaseLeads.length === 0)) {
      console.log('\n⚠️  ISSUE IDENTIFIED:');
      console.log('   Chris\'s leads exist in local database but NOT in Supabase');
      console.log('   System needs Supabase masterlead migration to work properly');
    } else if (supabaseLeads && supabaseLeads.length > 0) {
      console.log('\n✅ All systems operational - leads available in Supabase');
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await pool.end();
  }
}

checkDatabaseStatus();