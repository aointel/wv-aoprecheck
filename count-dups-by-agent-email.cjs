#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function countDuplicatesByAgent() {
  console.log('🔍 Counting duplicate VDP calls by agent email...\n');
  
  // Get all VDP calls from today
  const { data: allCalls, error } = await supabase
    .from('vdp_calls')
    .select('id, leadid, agent, company_email, duration, time')
    .gte('updated_at', new Date().toISOString().split('T')[0]);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  // Group by leadid to find duplicates
  const callsByLead = {};
  allCalls.forEach(call => {
    if (!callsByLead[call.leadid]) {
      callsByLead[call.leadid] = [];
    }
    callsByLead[call.leadid].push(call);
  });
  
  // Count duplicates by agent email
  const duplicatesByEmail = {};
  
  Object.keys(callsByLead).forEach(leadid => {
    const calls = callsByLead[leadid];
    if (calls.length > 1) {
      // Multiple entries for same leadid = duplicates
      calls.forEach(call => {
        const email = call.company_email || `agent-${call.agent}`;
        if (!duplicatesByEmail[email]) {
          duplicatesByEmail[email] = { associateId: call.agent, count: 0, leads: [] };
        }
        duplicatesByEmail[email].count += 1;
        if (!duplicatesByEmail[email].leads.includes(leadid)) {
          duplicatesByEmail[email].leads.push(leadid);
        }
      });
    }
  });
  
  // Print results
  console.log('📊 DUPLICATE VDP CALLS BY AGENT EMAIL:\n');
  Object.keys(duplicatesByEmail)
    .sort((a, b) => duplicatesByEmail[b].count - duplicatesByEmail[a].count)
    .forEach(email => {
      const data = duplicatesByEmail[email];
      console.log(`${email} (ID: ${data.associateId}): ${data.count} duplicate entries across ${data.leads.length} leads`);
    });
  
  const total = Object.values(duplicatesByEmail).reduce((sum, d) => sum + d.count, 0);
  console.log(`\n📈 TOTAL DUPLICATE ENTRIES: ${total}`);
}

countDuplicatesByAgent();

