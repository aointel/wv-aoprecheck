#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse the INSERT data you provided
const insertData = [
  { id: '29240', leadid: '18594170', agent: '200388', phone: '+14235721339', duration: '' },
  { id: '29239', leadid: '18594170', agent: '200388', phone: '+14235721339', duration: '44.716' },
  { id: '29236', leadid: '18652733', agent: '145691', phone: '+15712177711', duration: '' },
  { id: '29235', leadid: '18652733', agent: '145691', phone: '+15712177711', duration: '772.821' },
  { id: '29227', leadid: '18639706', agent: '197816', phone: '+15743275922', duration: '415.782' },
  { id: '28910', leadid: '18651658', agent: '131252', phone: '+19788864966', duration: '29.547' },
  { id: '29228', leadid: '18640703', agent: '63603', phone: '+13609014671', duration: '55.134' },
  { id: '28510', leadid: '18632086', agent: '131252', phone: '+13606609293', duration: '132.498' },
  { id: '28511', leadid: '18632086', agent: '131252', phone: '+13606609293', duration: '' },
  { id: '28534', leadid: '18631449', agent: '131252', phone: '+16025072891', duration: '401.224' },
  { id: '28535', leadid: '18631449', agent: '131252', phone: '+16025072891', duration: '' },
  { id: '28562', leadid: '18637594', agent: '131252', phone: '+13089911704', duration: '251.054' },
  { id: '28330', leadid: '18636687', agent: '131252', phone: '+18584806859', duration: '754.895' },
  { id: '29014', leadid: '18600515', agent: '131252', phone: '+19064935144', duration: '666.084' },
  { id: '29224', leadid: '18653488', agent: '145691', phone: '+12767010210', duration: '' },
  { id: '29223', leadid: '18653488', agent: '145691', phone: '+12767010210', duration: '158.646' },
  { id: '29213', leadid: '18651285', agent: '213793', phone: '+17036062102', duration: '60.322' },
  { id: '29210', leadid: '18651262', agent: '213793', phone: '+15409866783', duration: '' },
  { id: '29209', leadid: '18651262', agent: '213793', phone: '+15409866783', duration: '50.432' },
  // ... (truncated for brevity, but you get the pattern)
];

async function analyzeDuplicates() {
  console.log('🔍 Analyzing duplicate VDP calls by agent email...\n');
  
  // Group by leadid + agent to find duplicates
  const callsByLead = {};
  insertData.forEach(call => {
    const key = `${call.leadid}_${call.agent}`;
    if (!callsByLead[key]) {
      callsByLead[key] = [];
    }
    callsByLead[key].push(call);
  });
  
  // Find duplicates (2+ entries for same leadid)
  const duplicates = {};
  Object.keys(callsByLead).forEach(key => {
    if (callsByLead[key].length > 1) {
      const [leadid, agent] = key.split('_');
      if (!duplicates[agent]) {
        duplicates[agent] = { leadIds: [], count: 0 };
      }
      duplicates[agent].leadIds.push(leadid);
      duplicates[agent].count += callsByLead[key].length - 1; // Extra entries
    }
  });
  
  // Map associate_id to email
  const uniqueAgents = [...new Set(Object.keys(duplicates))];
  const agentEmailMap = {};
  
  for (const agentId of uniqueAgents) {
    const { data: customer } = await supabase
      .from('customers')
      .select('company_email, first_name, last_name')
      .eq('associate_id', agentId)
      .maybeSingle();
    
    agentEmailMap[agentId] = customer?.company_email || `unknown-${agentId}`;
  }
  
  // Print results
  console.log('📊 DUPLICATE VDP CALLS BY AGENT EMAIL:\n');
  Object.keys(duplicates).sort((a, b) => duplicates[b].count - duplicates[a].count).forEach(agentId => {
    const email = agentEmailMap[agentId];
    const dupCount = duplicates[agentId].count;
    console.log(`${email}: ${dupCount} duplicate entries`);
  });
  
  const totalDuplicates = Object.values(duplicates).reduce((sum, d) => sum + d.count, 0);
  console.log(`\n📈 TOTAL DUPLICATES: ${totalDuplicates}`);
}

analyzeDuplicates().catch(console.error);

