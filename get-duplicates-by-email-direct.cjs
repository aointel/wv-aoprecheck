#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getDuplicatesByEmail() {
  console.log('🔍 Counting duplicate VDP calls by agent email...\n');
  
  // Get all VDP calls from today
  const today = new Date().toISOString().split('T')[0];
  const { data: allCalls, error } = await supabase
    .from('vdp_calls')
    .select('id, leadid, company_email, agent, duration, time')
    .gte('updated_at', today);
  
  if (error) {
    console.error('❌ Error fetching calls:', error);
    return;
  }
  
  console.log(`📊 Total VDP calls today: ${allCalls.length}`);
  
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
          duplicatesByEmail[email] = 0;
        }
        duplicatesByEmail[email] += 1; // Count each duplicate entry
      });
    }
  });
  
  // Print results sorted by count
  console.log('\n📊 DUPLICATE VDP CALLS BY AGENT EMAIL:\n');
  Object.keys(duplicatesByEmail)
    .sort((a, b) => duplicatesByEmail[b] - duplicatesByEmail[a])
    .forEach(email => {
      console.log(`${email}: ${duplicatesByEmail[email]} duplicate entries`);
    });
  
  const total = Object.values(duplicatesByEmail).reduce((sum, count) => sum + count, 0);
  console.log(`\n📈 TOTAL DUPLICATE ENTRIES: ${total}`);
}

getDuplicatesByEmail().catch(console.error);

