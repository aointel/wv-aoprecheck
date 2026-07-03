import { createClient } from '@supabase/supabase-js';

// Hardcoded values from server/hardcoded-config.ts
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testLeaderboardHierarchies() {
  console.log('🔍 Testing leaderboard hierarchy data...\n');
  console.log('='.repeat(100));

  // Step 1: Get all agents from agent_hierarchy
  console.log('\n📋 Step 1: Fetching from agent_hierarchy...');
  const { data: hierarchyData } = await supabase
    .from('agent_hierarchy')
    .select('agent_email, agent_name, mga_name, rga_name')
    .not('agent_email', 'is', null)
    .limit(10000);

  console.log(`   Found ${hierarchyData?.length || 0} agents in agent_hierarchy`);

  // Step 2: Get from producerlist
  console.log('\n📋 Step 2: Fetching from producerlist...');
  const { data: producerlistData } = await supabase
    .from('producerlist')
    .select('company_email, agent_name, mga, rga')
    .not('company_email', 'is', null)
    .limit(10000);

  console.log(`   Found ${producerlistData?.length || 0} agents in producerlist`);

  // Step 3: Get from customers
  console.log('\n📋 Step 3: Fetching from customers...');
  const { data: customersData } = await supabase
    .from('customers')
    .select('company_email, personal_email, first_name, last_name, mga_team, rga_team')
    .or('company_email.not.is.null,personal_email.not.is.null')
    .limit(10000);

  console.log(`   Found ${customersData?.length || 0} records in customers`);

  // Step 4: Get from agent_profiles
  console.log('\n📋 Step 4: Fetching from agent_profiles...');
  const { data: profilesData } = await supabase
    .from('agent_profiles')
    .select('email, mga_team, rga_team')
    .not('email', 'is', null)
    .limit(10000);

  console.log(`   Found ${profilesData?.length || 0} profiles in agent_profiles`);

  // Build maps for lookup
  const hierarchyMap = new Map();
  (hierarchyData || []).forEach(row => {
    if (row.agent_email) {
      hierarchyMap.set(String(row.agent_email).toLowerCase().trim(), {
        source: 'agent_hierarchy',
        email: String(row.agent_email).toLowerCase().trim(),
        name: row.agent_name,
        mga: row.mga_name,
        rga: row.rga_name
      });
    }
  });

  const producerlistMap = new Map();
  (producerlistData || []).forEach(row => {
    if (row.company_email) {
      const email = String(row.company_email).toLowerCase().trim();
      producerlistMap.set(email, {
        source: 'producerlist',
        email: email,
        name: row.agent_name,
        mga: row.mga,
        rga: row.rga
      });
    }
  });

  const customersMap = new Map();
  (customersData || []).forEach(row => {
    const email = String(row.company_email || row.personal_email).toLowerCase().trim();
    if (email) {
      customersMap.set(email, {
        source: 'customers',
        email: email,
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        mga: row.mga_team,
        rga: row.rga_team
      });
    }
  });

  const profilesMap = new Map();
  (profilesData || []).forEach(row => {
    if (row.email) {
      profilesMap.set(String(row.email).toLowerCase().trim(), {
        source: 'agent_profiles',
        email: String(row.email).toLowerCase().trim(),
        name: null,
        mga: row.mga_team,
        rga: row.rga_team
      });
    }
  });

  // Combine all unique emails
  const allEmailsSet = new Set();
  hierarchyMap.forEach((v, k) => allEmailsSet.add(k));
  producerlistMap.forEach((v, k) => allEmailsSet.add(k));
  customersMap.forEach((v, k) => allEmailsSet.add(k));
  profilesMap.forEach((v, k) => allEmailsSet.add(k));

  const allEmails = Array.from(allEmailsSet);
  console.log(`\n📊 Total unique agent emails: ${allEmails.length}\n`);

  // Now simulate the leaderboard logic
  console.log('🔍 Simulating leaderboard hierarchy lookup...\n');
  
  const isValidName = (name) => {
    if (!name) return false;
    const trimmed = String(name).trim();
    return trimmed !== '' && trimmed !== '-' && trimmed.length > 0;
  };

  const results = [];

  for (const email of allEmails) {
    const hierarchy = hierarchyMap.get(email);
    let mga = hierarchy?.mga || null;
    let rga = hierarchy?.rga || null;

    // Clean up
    if (mga && !isValidName(mga)) mga = null;
    if (rga && !isValidName(rga)) rga = null;

    // Fallback to producerlist
    if ((!mga || !rga) && producerlistMap.has(email)) {
      const producer = producerlistMap.get(email);
      if (!mga && isValidName(producer.mga)) mga = String(producer.mga).trim();
      if (!rga && isValidName(producer.rga)) rga = String(producer.rga).trim();
    }

    // Fallback to customers
    if ((!mga || !rga) && customersMap.has(email)) {
      const customer = customersMap.get(email);
      if (!mga && isValidName(customer.mga)) mga = String(customer.mga).trim();
      if (!rga && isValidName(customer.rga)) rga = String(customer.rga).trim();
    }

    // Fallback to agent_profiles
    if ((!mga || !rga) && profilesMap.has(email)) {
      const profile = profilesMap.get(email);
      if (!mga && isValidName(profile.mga)) mga = String(profile.mga).trim();
      if (!rga && isValidName(profile.rga)) rga = String(profile.rga).trim();
    }

    // Final cleanup
    if (mga && !isValidName(mga)) mga = null;
    if (rga && !isValidName(rga)) rga = null;

    results.push({
      email: email,
      name: hierarchy?.name || producerlistMap.get(email)?.name || customersMap.get(email)?.name || 'Unknown',
      mga: mga || 'NULL',
      rga: rga || 'NULL',
      hasHierarchy: !!(mga || rga)
    });
  }

  // Sort by has hierarchy, then by email
  results.sort((a, b) => {
    if (a.hasHierarchy !== b.hasHierarchy) return b.hasHierarchy ? 1 : -1;
    return a.email.localeCompare(b.email);
  });

  // Show summary
  const withHierarchy = results.filter(r => r.hasHierarchy).length;
  const withoutHierarchy = results.filter(r => !r.hasHierarchy).length;

  console.log('📊 SUMMARY:');
  console.log(`   Total agents: ${results.length}`);
  console.log(`   With hierarchy (MGA or RGA): ${withHierarchy} (${((withHierarchy/results.length)*100).toFixed(1)}%)`);
  console.log(`   Without hierarchy: ${withoutHierarchy} (${((withoutHierarchy/results.length)*100).toFixed(1)}%)\n`);

  // Show first 50 agents WITH hierarchy
  console.log(`\n✅ FIRST 50 AGENTS WITH HIERARCHY:`);
  console.log('='.repeat(100));
  console.log(`${'Email'.padEnd(40)} | ${'Name'.padEnd(30)} | ${'MGA'.padEnd(25)} | RGA`);
  console.log('-'.repeat(100));
  
  const withHierarchyList = results.filter(r => r.hasHierarchy).slice(0, 50);
  withHierarchyList.forEach(r => {
    const email = r.email.padEnd(40);
    const name = (r.name || 'Unknown').padEnd(30);
    const mga = r.mga.padEnd(25);
    const rga = r.rga;
    console.log(`${email} | ${name} | ${mga} | ${rga}`);
  });

  // Show first 50 agents WITHOUT hierarchy
  console.log(`\n\n❌ FIRST 50 AGENTS WITHOUT HIERARCHY:`);
  console.log('='.repeat(100));
  console.log(`${'Email'.padEnd(40)} | ${'Name'.padEnd(30)}`);
  console.log('-'.repeat(100));
  
  const withoutHierarchyList = results.filter(r => !r.hasHierarchy).slice(0, 50);
  withoutHierarchyList.forEach(r => {
    const email = r.email.padEnd(40);
    const name = (r.name || 'Unknown').padEnd(30);
    console.log(`${email} | ${name}`);
  });

  // Show source breakdown for agents with hierarchy
  console.log(`\n\n📊 SOURCE BREAKDOWN (agents with hierarchy):`);
  const sourceBreakdown = {
    'agent_hierarchy': 0,
    'producerlist': 0,
    'customers': 0,
    'agent_profiles': 0
  };

  for (const email of results.filter(r => r.hasHierarchy).map(r => r.email)) {
    if (hierarchyMap.has(email) && (hierarchyMap.get(email).mga || hierarchyMap.get(email).rga)) {
      sourceBreakdown['agent_hierarchy']++;
    } else if (producerlistMap.has(email) && (producerlistMap.get(email).mga || producerlistMap.get(email).rga)) {
      sourceBreakdown['producerlist']++;
    } else if (customersMap.has(email) && (customersMap.get(email).mga || customersMap.get(email).rga)) {
      sourceBreakdown['customers']++;
    } else if (profilesMap.has(email) && (profilesMap.get(email).mga || profilesMap.get(email).rga)) {
      sourceBreakdown['agent_profiles']++;
    }
  }

  Object.entries(sourceBreakdown).forEach(([source, count]) => {
    console.log(`   ${source}: ${count}`);
  });

  console.log('\n✅ Test complete!\n');
}

testLeaderboardHierarchies().catch(console.error);
