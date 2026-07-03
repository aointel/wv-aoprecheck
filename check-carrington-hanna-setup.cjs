#!/usr/bin/env node

/**
 * Check if Carrington Hanna is set up for Live Call Board
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkCarringtonHanna() {
  const email = 'carringtonhanna@aoglobelife.com';
  
  console.log('🔍 Checking Carrington Hanna setup for Live Call Board...\n');
  
  // 1. Check if they're in customers table
  console.log('1️⃣ Checking customers table...');
  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .select('associate_id, first_name, last_name, company_email')
    .eq('company_email', email.toLowerCase())
    .maybeSingle();
  
  if (customerError) {
    console.error('❌ Error:', customerError);
    return;
  }
  
  if (!customerData) {
    console.log('❌ NOT FOUND in customers table');
    console.log('   They need to be added to the customers table first');
    return;
  }
  
  console.log('✅ Found in customers table:');
  console.log(`   Associate ID: ${customerData.associate_id}`);
  console.log(`   Name: ${customerData.first_name} ${customerData.last_name}`);
  console.log(`   Email: ${customerData.company_email}\n`);
  
  // 2. Check if they're an MGA (managing any agents)
  console.log('2️⃣ Checking if they are an MGA...');
  const { data: mgaData, error: mgaError } = await supabase
    .from('agent_hierarchy')
    .select('agent_associate_id, agent_email')
    .eq('mga_associate_id', customerData.associate_id)
    .limit(10);
  
  if (mgaError) {
    console.error('❌ Error checking MGA:', mgaError);
  } else {
    console.log(`   ${mgaData?.length || 0} agents have them as MGA`);
    if (mgaData && mgaData.length > 0) {
      console.log('   Agents they manage:');
      mgaData.forEach(agent => {
        console.log(`     - ${agent.agent_email} (ID: ${agent.agent_associate_id})`);
      });
    }
  }
  
  // 3. Check if they're an RGA (managing any agents)
  console.log('\n3️⃣ Checking if they are an RGA...');
  const { data: rgaData, error: rgaError } = await supabase
    .from('agent_hierarchy')
    .select('agent_associate_id, agent_email')
    .eq('rga_associate_id', customerData.associate_id)
    .limit(10);
  
  if (rgaError) {
    console.error('❌ Error checking RGA:', rgaError);
  } else {
    console.log(`   ${rgaData?.length || 0} agents have them as RGA`);
    if (rgaData && rgaData.length > 0) {
      console.log('   Agents they manage:');
      rgaData.forEach(agent => {
        console.log(`     - ${agent.agent_email} (ID: ${agent.agent_associate_id})`);
      });
    }
  }
  
  // 4. Summary
  console.log('\n📊 SUMMARY:');
  const isMGA = mgaData && mgaData.length > 0;
  const isRGA = rgaData && rgaData.length > 0;
  
  if (isMGA || isRGA) {
    const role = (isMGA && isRGA) ? 'BOTH (MGA & RGA)' : (isMGA ? 'MGA' : 'RGA');
    console.log(`✅ Carrington Hanna is set up as ${role}`);
    console.log('✅ They will see their team in Live Call Board');
  } else {
    console.log('⚠️  Carrington Hanna is NOT set up as MGA or RGA');
    console.log('⚠️  They will see limited data in Live Call Board');
    console.log('   To fix: Add agents to agent_hierarchy table with');
    console.log(`   mga_associate_id = ${customerData.associate_id} OR`);
    console.log(`   rga_associate_id = ${customerData.associate_id}`);
  }
}

checkCarringtonHanna();

