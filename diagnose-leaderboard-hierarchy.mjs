/**
 * DIAGNOSTIC: Figure out why leaderboard API is not returning proper hierarchy info
 * This script will check all data sources and identify the issue
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnoseLeaderboardHierarchy() {
  console.log('🔍 DIAGNOSING LEADERBOARD HIERARCHY ISSUES...\n');
  console.log('='.repeat(100));
  
  // 1. Check agent_hierarchy table structure and sample data
  console.log('\n📊 STEP 1: Checking agent_hierarchy table...');
  const { data: hierarchySample, error: hierarchyError } = await supabase
    .from('agent_hierarchy')
    .select('agent_email, agent_name, agent_associate_id, mga_name, mga_associate_id, rga_name, rga_associate_id')
    .limit(20);
  
  if (hierarchyError) {
    console.error('❌ Error fetching agent_hierarchy:', hierarchyError);
  } else {
    console.log(`✅ Found ${hierarchySample?.length || 0} rows in agent_hierarchy`);
    console.log('\n📋 Sample agent_hierarchy data:');
    hierarchySample?.slice(0, 5).forEach((row, idx) => {
      console.log(`\n  Row ${idx + 1}:`);
      console.log(`    Email: ${row.agent_email}`);
      console.log(`    Name: ${row.agent_name}`);
      console.log(`    Associate ID: ${row.agent_associate_id}`);
      console.log(`    MGA Name: ${row.mga_name || 'NULL/EMPTY'}`);
      console.log(`    MGA Associate ID: ${row.mga_associate_id || 'NULL/EMPTY'}`);
      console.log(`    RGA Name: ${row.rga_name || 'NULL/EMPTY'}`);
      console.log(`    RGA Associate ID: ${row.rga_associate_id || 'NULL/EMPTY'}`);
    });
    
    // Count how many have MGA/RGA data
    const withMga = hierarchySample?.filter(r => r.mga_name && r.mga_name.trim() !== '').length || 0;
    const withRga = hierarchySample?.filter(r => r.rga_name && r.rga_name.trim() !== '').length || 0;
    console.log(`\n  📈 Statistics (from sample):`);
    console.log(`    Rows with MGA: ${withMga}/${hierarchySample?.length || 0} (${Math.round((withMga / (hierarchySample?.length || 1)) * 100)}%)`);
    console.log(`    Rows with RGA: ${withRga}/${hierarchySample?.length || 0} (${Math.round((withRga / (hierarchySample?.length || 1)) * 100)}%)`);
  }
  
  // 2. Check agent_profiles table
  console.log('\n📊 STEP 2: Checking agent_profiles table...');
  const { data: profilesSample, error: profilesError } = await supabase
    .from('agent_profiles')
    .select('email, mga_team, rga_team')
    .not('email', 'is', null)
    .limit(20);
  
  if (profilesError) {
    console.error('❌ Error fetching agent_profiles:', profilesError);
  } else {
    console.log(`✅ Found ${profilesSample?.length || 0} rows in agent_profiles`);
    console.log('\n📋 Sample agent_profiles data:');
    profilesSample?.slice(0, 5).forEach((row, idx) => {
      console.log(`\n  Row ${idx + 1}:`);
      console.log(`    Email: ${row.email}`);
      console.log(`    MGA Team: ${row.mga_team || 'NULL/EMPTY'}`);
      console.log(`    RGA Team: ${row.rga_team || 'NULL/EMPTY'}`);
    });
    
    const withMgaTeam = profilesSample?.filter(r => r.mga_team && r.mga_team.trim() !== '').length || 0;
    const withRgaTeam = profilesSample?.filter(r => r.rga_team && r.rga_team.trim() !== '').length || 0;
    console.log(`\n  📈 Statistics (from sample):`);
    console.log(`    Rows with MGA Team: ${withMgaTeam}/${profilesSample?.length || 0} (${Math.round((withMgaTeam / (profilesSample?.length || 1)) * 100)}%)`);
    console.log(`    Rows with RGA Team: ${withRgaTeam}/${profilesSample?.length || 0} (${Math.round((withRgaTeam / (profilesSample?.length || 1)) * 100)}%)`);
  }
  
  // 3. Check customers table
  console.log('\n📊 STEP 3: Checking customers table...');
  const { data: customersSample, error: customersError } = await supabase
    .from('customers')
    .select('company_email, mga_team, rga_team')
    .not('company_email', 'is', null)
    .limit(20);
  
  if (customersError) {
    console.error('❌ Error fetching customers:', customersError);
  } else {
    console.log(`✅ Found ${customersSample?.length || 0} rows in customers`);
    console.log('\n📋 Sample customers data:');
    customersSample?.slice(0, 5).forEach((row, idx) => {
      console.log(`\n  Row ${idx + 1}:`);
      console.log(`    Email: ${row.company_email}`);
      console.log(`    MGA Team: ${row.mga_team || 'NULL/EMPTY'}`);
      console.log(`    RGA Team: ${row.rga_team || 'NULL/EMPTY'}`);
    });
    
    const withMgaTeam = customersSample?.filter(r => r.mga_team && r.mga_team.trim() !== '').length || 0;
    const withRgaTeam = customersSample?.filter(r => r.rga_team && r.rga_team.trim() !== '').length || 0;
    console.log(`\n  📈 Statistics (from sample):`);
    console.log(`    Rows with MGA Team: ${withMgaTeam}/${customersSample?.length || 0} (${Math.round((withMgaTeam / (customersSample?.length || 1)) * 100)}%)`);
    console.log(`    Rows with RGA Team: ${withRgaTeam}/${customersSample?.length || 0} (${Math.round((withRgaTeam / (customersSample?.length || 1)) * 100)}%)`);
  }
  
  // 4. Test the actual leaderboard API logic with a few sample agents
  console.log('\n📊 STEP 4: Testing leaderboard API logic with sample agents...');
  
  // Get agents that have activity (from billing_transactions)
  const { data: activeAgents } = await supabase
    .from('billing_transactions')
    .select('agent_email')
    .eq('transaction_type', 'connect')
    .not('agent_email', 'is', null)
    .neq('agent_email', '')
    .limit(10);
  
  const testEmails = [...new Set((activeAgents || []).map(a => a.agent_email?.toLowerCase().trim()).filter(Boolean))].slice(0, 5);
  
  console.log(`\n🧪 Testing with ${testEmails.length} active agents:`);
  
  for (const email of testEmails) {
    console.log(`\n  🔍 Agent: ${email}`);
    
    // Check agent_hierarchy
    const { data: hierarchyData } = await supabase
      .from('agent_hierarchy')
      .select('agent_email, agent_name, mga_name, rga_name')
      .eq('agent_email', email.toLowerCase().trim())
      .maybeSingle();
    
    console.log(`    agent_hierarchy: MGA=${hierarchyData?.mga_name || 'NULL'}, RGA=${hierarchyData?.rga_name || 'NULL'}`);
    
    // Check agent_profiles
    const { data: profileData } = await supabase
      .from('agent_profiles')
      .select('email, mga_team, rga_team')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    
    console.log(`    agent_profiles: MGA=${profileData?.mga_team || 'NULL'}, RGA=${profileData?.rga_team || 'NULL'}`);
    
    // Check customers
    const { data: customerData } = await supabase
      .from('customers')
      .select('company_email, mga_team, rga_team')
      .eq('company_email', email.toLowerCase().trim())
      .maybeSingle();
    
    console.log(`    customers: MGA=${customerData?.mga_team || 'NULL'}, RGA=${customerData?.rga_team || 'NULL'}`);
    
    // Simulate the leaderboard logic
    let mga = hierarchyData?.mga_name || null;
    let rga = hierarchyData?.rga_name || null;
    
    if (profileData) {
      if (!mga && profileData.mga_team) mga = String(profileData.mga_team).trim();
      if (!rga && profileData.rga_team) rga = String(profileData.rga_team).trim();
    }
    
    if ((!mga || !rga) && customerData) {
      if (!mga && customerData.mga_team) mga = String(customerData.mga_team).trim();
      if (!rga && customerData.rga_team) rga = String(customerData.rga_team).trim();
    }
    
    if (mga && (mga === '' || mga === '-')) mga = null;
    if (rga && (rga === '' || rga === '-')) rga = null;
    
    console.log(`    ✅ FINAL RESULT: MGA=${mga || 'NULL'}, RGA=${rga || 'NULL'}`);
  }
  
  // 5. Check if there's a mismatch in field names or data types
  console.log('\n📊 STEP 5: Checking for data inconsistencies...');
  
  // Get all unique MGA/RGA values from agent_hierarchy
  const { data: allHierarchy } = await supabase
    .from('agent_hierarchy')
    .select('mga_name, rga_name')
    .not('mga_name', 'is', null)
    .limit(1000);
  
  const uniqueMgaNames = new Set((allHierarchy || []).map(h => h.mga_name?.trim()).filter(Boolean));
  const uniqueRgaNames = new Set((allHierarchy || []).map(h => h.rga_name?.trim()).filter(Boolean));
  
  console.log(`\n  Unique MGA names in agent_hierarchy: ${uniqueMgaNames.size}`);
  console.log(`  Unique RGA names in agent_hierarchy: ${uniqueRgaNames.size}`);
  console.log(`  Sample MGA names: ${Array.from(uniqueMgaNames).slice(0, 5).join(', ')}`);
  console.log(`  Sample RGA names: ${Array.from(uniqueRgaNames).slice(0, 5).join(', ')}`);
  
  // 6. Check total counts
  console.log('\n📊 STEP 6: Total counts...');
  const { count: hierarchyCount } = await supabase
    .from('agent_hierarchy')
    .select('*', { count: 'exact', head: true });
  
  const { count: profilesCount } = await supabase
    .from('agent_profiles')
    .select('*', { count: 'exact', head: true });
  
  const { count: customersCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });
  
  console.log(`  Total agent_hierarchy rows: ${hierarchyCount || 0}`);
  console.log(`  Total agent_profiles rows: ${profilesCount || 0}`);
  console.log(`  Total customers rows: ${customersCount || 0}`);
  
  // 7. Check if agent_hierarchy has the data but it's not being used
  console.log('\n📊 STEP 7: Checking if agent_hierarchy has data but leaderboard is not using it...');
  const { data: hierarchyWithData } = await supabase
    .from('agent_hierarchy')
    .select('agent_email, mga_name, rga_name')
    .or('mga_name.not.is.null,rga_name.not.is.null')
    .limit(10);
  
  console.log(`\n  Found ${hierarchyWithData?.length || 0} agents with MGA/RGA data in agent_hierarchy`);
  if (hierarchyWithData && hierarchyWithData.length > 0) {
    console.log('  Sample agents with hierarchy data:');
    hierarchyWithData.slice(0, 3).forEach(h => {
      console.log(`    ${h.agent_email}: MGA=${h.mga_name || 'NULL'}, RGA=${h.rga_name || 'NULL'}`);
    });
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('✅ DIAGNOSIS COMPLETE');
  console.log('\n💡 SUMMARY:');
  console.log('  1. Check if agent_hierarchy has MGA/RGA data populated');
  console.log('  2. Check if field names match (mga_name vs mga_team)');
  console.log('  3. Check if email matching is case-sensitive');
  console.log('  4. Check if data is being filtered out somewhere');
}

diagnoseLeaderboardHierarchy().catch(console.error);
