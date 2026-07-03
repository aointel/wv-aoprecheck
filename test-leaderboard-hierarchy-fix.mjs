/**
 * TEST: Verify leaderboard hierarchy fix
 * This script tests the actual leaderboard API to see if hierarchy data is returned
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testLeaderboardHierarchy() {
  console.log('🧪 TESTING LEADERBOARD HIERARCHY FIX...\n');
  console.log('='.repeat(100));
  
  // Simulate the leaderboard API logic
  console.log('\n📊 Step 1: Loading agent_hierarchy...');
  const { data: allHierarchyData, error: hierarchyError } = await supabase
    .from('agent_hierarchy')
    .select('agent_email, agent_name, agent_associate_id, mga_name, mga_associate_id, rga_name, rga_associate_id')
    .not('agent_email', 'is', null)
    .limit(100000);
  
  if (hierarchyError) {
    console.error('❌ Error:', hierarchyError);
    return;
  }
  
  const allHierarchyMap = new Map();
  allHierarchyData.forEach(row => {
    if (row.agent_email) {
      const email = String(row.agent_email).toLowerCase().trim();
      allHierarchyMap.set(email, row);
    }
  });
  
  console.log(`✅ Loaded ${allHierarchyMap.size} agents from agent_hierarchy`);
  
  // Count how many have MGA/RGA
  const withMga = Array.from(allHierarchyMap.values()).filter(r => r.mga_name && r.mga_name.trim() !== '').length;
  const withRga = Array.from(allHierarchyMap.values()).filter(r => r.rga_name && r.rga_name.trim() !== '').length;
  console.log(`   - Agents with MGA: ${withMga} (${Math.round((withMga / allHierarchyMap.size) * 100)}%)`);
  console.log(`   - Agents with RGA: ${withRga} (${Math.round((withRga / allHierarchyMap.size) * 100)}%)`);
  
  console.log('\n📊 Step 2: Loading agent_profiles...');
  const { data: agentProfiles, error: profilesError } = await supabase
    .from('agent_profiles')
    .select('email, mga_team, rga_team')
    .not('email', 'is', null)
    .limit(100000);
  
  if (profilesError) {
    console.error('⚠️ Error (non-fatal):', profilesError);
  }
  
  const profilesMap = new Map();
  (agentProfiles || []).forEach(profile => {
    if (profile.email) {
      profilesMap.set(String(profile.email).toLowerCase().trim(), profile);
    }
  });
  
  console.log(`✅ Loaded ${profilesMap.size} agent profiles`);
  
  console.log('\n📊 Step 3: Testing hierarchy mapping logic...');
  
  // Test with agents that have activity
  const { data: activeAgents } = await supabase
    .from('billing_transactions')
    .select('agent_email')
    .eq('transaction_type', 'connect')
    .not('agent_email', 'is', null)
    .neq('agent_email', '')
    .limit(50);
  
  const testEmails = [...new Set((activeAgents || []).map(a => a.agent_email?.toLowerCase().trim()).filter(Boolean))].slice(0, 10);
  
  console.log(`\n🧪 Testing with ${testEmails.length} active agents:\n`);
  
  let agentsWithMga = 0;
  let agentsWithRga = 0;
  let agentsWithoutHierarchy = 0;
  
  for (const email of testEmails) {
    const hierarchyRow = allHierarchyMap.get(email);
    
    if (!hierarchyRow) {
      console.log(`  ❌ ${email}: NOT FOUND in agent_hierarchy`);
      agentsWithoutHierarchy++;
      continue;
    }
    
    // Apply the same logic as the leaderboard API
    let mga = hierarchyRow?.mga_name || null;
    let rga = hierarchyRow?.rga_name || null;
    
    // Clean up hierarchy data first
    if (mga && (typeof mga === 'string' && (mga.trim() === '' || mga.trim() === '-'))) mga = null;
    if (rga && (typeof rga === 'string' && (rga.trim() === '' || rga.trim() === '-'))) rga = null;
    
    // Fallback to agent_profiles
    if ((!mga || !rga) && profilesMap.has(email)) {
      const profile = profilesMap.get(email);
      if (profile) {
        if (!mga && profile.mga_team && profile.mga_team.trim() !== '' && profile.mga_team.trim() !== '-') {
          mga = String(profile.mga_team).trim();
        }
        if (!rga && profile.rga_team && profile.rga_team.trim() !== '' && profile.rga_team.trim() !== '-') {
          rga = String(profile.rga_team).trim();
        }
      }
    }
    
    // Final cleanup
    if (mga && (mga === '' || mga === '-')) mga = null;
    if (rga && (rga === '' || rga === '-')) rga = null;
    
    if (mga) agentsWithMga++;
    if (rga) agentsWithRga++;
    
    const status = mga || rga ? '✅' : '⚠️';
    console.log(`  ${status} ${email}:`);
    console.log(`      MGA: ${mga || 'NULL'}`);
    console.log(`      RGA: ${rga || 'NULL'}`);
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('📊 SUMMARY:');
  console.log(`  Total test agents: ${testEmails.length}`);
  console.log(`  Agents with MGA: ${agentsWithMga} (${Math.round((agentsWithMga / testEmails.length) * 100)}%)`);
  console.log(`  Agents with RGA: ${agentsWithRga} (${Math.round((agentsWithRga / testEmails.length) * 100)}%)`);
  console.log(`  Agents not in hierarchy: ${agentsWithoutHierarchy}`);
  console.log('\n✅ TEST COMPLETE');
}

testLeaderboardHierarchy().catch(console.error);
