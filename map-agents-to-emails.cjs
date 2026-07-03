#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const duplicatesByAgent = {
  '95059': 19,
  '203499': 14,
  '200388': 12,
  '131252': 10,
  '174701': 10,
  '197159': 9,
  '409': 8,
  '213793': 8,
  '145691': 4,
  '155251': 4,
  '206353': 4,
  '209153': 3,
  '159521': 2,
  '167595': 2,
  '187440': 2,
  '196676': 2,
  '198033': 2,
  '205226': 2
};

async function mapToEmails() {
  console.log('📊 DUPLICATE VDP CALLS BY AGENT EMAIL:\n');
  
  const agentIds = Object.keys(duplicatesByAgent);
  
  for (const agentId of agentIds) {
    const { data: customer } = await supabase
      .from('customers')
      .select('company_email, first_name, last_name')
      .eq('associate_id', parseInt(agentId))
      .maybeSingle();
    
    const email = customer?.company_email || `unknown-${agentId}`;
    const name = customer ? `${customer.first_name} ${customer.last_name}` : '';
    const count = duplicatesByAgent[agentId];
    
    console.log(`${email}${name ? ` (${name})` : ''}: ${count} duplicate entries`);
  }
  
  const total = Object.values(duplicatesByAgent).reduce((sum, count) => sum + count, 0);
  console.log(`\n📈 TOTAL DUPLICATE ENTRIES: ${total}`);
}

mapToEmails().catch(console.error);

