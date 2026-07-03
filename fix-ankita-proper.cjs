#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';
const API_URL = 'https://aoirail-production.up.railway.app/api/outbound-dialer/leads';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixAnkita() {
  const email = 'ankitadas@aoglobelife.com';
  
  console.log('🔍 Step 1: Checking Ankita\'s customer configuration...\n');
  
  // Get Ankita's market and states
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('company_email, first_name, last_name, states, market, associate_id')
    .eq('company_email', email)
    .maybeSingle();
  
  if (customerError || !customer) {
    console.error('❌ Could not find Ankita in customers table:', customerError);
    return;
  }
  
  console.log('✅ Ankita\'s Configuration:');
  console.log(`   Email: ${customer.company_email}`);
  console.log(`   Name: ${customer.first_name} ${customer.last_name}`);
  console.log(`   States: ${JSON.stringify(customer.states)}`);
  console.log(`   Market: ${JSON.stringify(customer.market)}`);
  console.log(`   Associate ID: ${customer.associate_id}\n`);
  
  // Determine market for API call
  let marketParam = 'Veteran'; // Default
  if (customer.market) {
    if (Array.isArray(customer.market)) {
      marketParam = customer.market[0] || 'Veteran';
    } else if (typeof customer.market === 'string') {
      try {
        const parsed = JSON.parse(customer.market);
        marketParam = Array.isArray(parsed) ? parsed[0] : customer.market;
      } catch {
        marketParam = customer.market;
      }
    }
  }
  
  console.log(`📋 Step 2: Unassigning incorrectly assigned leads...\n`);
  
  // Unassign all current pending leads for Ankita
  const { data: unassigned, error: unassignError } = await supabase
    .from('masterlead')
    .update({
      cn_email: null,
      cnresolution: 'pending',
      last_assigned_date: null,
      updated_at: new Date().toISOString()
    })
    .eq('cn_email', email)
    .eq('cnresolution', 'pending')
    .select('id, first_name, last_name, state, taalk_market');
  
  if (unassignError) {
    console.error('❌ Error unassigning leads:', unassignError);
    return;
  }
  
  console.log(`✅ Unassigned ${unassigned?.length || 0} leads from Ankita\n`);
  
  console.log(`🔄 Step 3: Triggering proper auto-refill with market "${marketParam}"...\n`);
  
  // Trigger auto-refill with correct market
  try {
    const response = await fetch(`${API_URL}?userEmail=${encodeURIComponent(email)}&market=${encodeURIComponent(marketParam)}&queueType=plus&limit=50`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Auto-refill failed: ${response.status} - ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log(`✅ Auto-refill complete: ${data.leads?.length || 0} leads assigned`);
    console.log(`   Market: ${marketParam}`);
    console.log(`   States: Filtered by her licensed states`);
    console.log(`   Leads are properly assigned and ready in Call Connector Pro`);
    
  } catch (error) {
    console.error(`❌ Error triggering auto-refill:`, error.message);
  }
}

fixAnkita();

