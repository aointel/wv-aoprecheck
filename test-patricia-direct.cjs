#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testPatricia() {
  const email = 'patriciasantamarina@aoglobelife.com';
  
  console.log('🔍 Step 1: Check Patricia in customers table');
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('company_email, states, market, CCPRO')
    .or(`company_email.eq.${email},personal_email.eq.${email}`)
    .maybeSingle();
  
  if (customerError) {
    console.error('❌ Error:', customerError);
    return;
  }
  
  console.log('✅ Customer found:', customer);
  console.log('   CCPRO:', customer.CCPRO);
  console.log('   Market:', customer.market);
  console.log('   States:', customer.states);
  
  console.log('\n🔍 Step 2: Count Patricia\'s current leads');
  const { count: currentLeads } = await supabase
    .from('masterlead')
    .select('*', { count: 'exact', head: true })
    .eq('cn_email', email)
    .eq('cnresolution', 'pending');
  
  console.log('   Current pending leads:', currentLeads);
  
  console.log('\n🔍 Step 3: Count available Veteran leads');
  const { count: availableLeads } = await supabase
    .from('masterlead')
    .select('*', { count: 'exact', head: true })
    .is('cn_email', null)
    .eq('dnc', false)
    .eq('cnresolution', 'pending')
    .eq('taalk_market', 'Veteran');
  
  console.log('   Available unassigned Veteran leads:', availableLeads);
  
  if (currentLeads <= 10 && availableLeads > 0) {
    console.log('\n✅ AUTO-REFILL SHOULD TRIGGER');
    console.log('   Needs:', 50 - currentLeads, 'leads');
  } else {
    console.log('\n⚠️ Auto-refill conditions not met');
  }
}

testPatricia();

