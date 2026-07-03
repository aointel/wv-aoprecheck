import { supabaseAdmin } from '../supabase.js';

async function checkAgentProfiles() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  console.log('🔍 Checking agent_profiles table...\n');

  // Check for chrislafond specifically
  const testEmails = [
    'chrislafond@aoglobelife.com',
    'CHRISLAFOND@aoglobelife.com',
    'chrislafond@aoglobelife.com',
    'chrislafond@AOGLOBELIFE.COM'
  ];

  for (const email of testEmails) {
    console.log(`\n📧 Testing email: "${email}"`);
    
    // Try exact match
    const { data: exact, error: exactError } = await supabaseAdmin
      .from('agent_profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    
    console.log(`  Exact match: ${exact ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (exact) {
      console.log(`    ID: ${exact.id}`);
      console.log(`    Email in DB: "${exact.email}"`);
      console.log(`    First Name: ${exact.first_name}`);
      console.log(`    Last Name: ${exact.last_name}`);
    }
    if (exactError) {
      console.log(`    Error: ${exactError.message}`);
    }
    
    // Try lowercase
    const { data: lower, error: lowerError } = await supabaseAdmin
      .from('agent_profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    
    console.log(`  Lowercase match: ${lower ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (lower) {
      console.log(`    Email in DB: "${lower.email}"`);
    }
  }

  // Get a sample of all profiles to see email formats
  console.log('\n\n📋 Sample of ALL agent_profiles (first 20):');
  const { data: allProfiles, error: allError } = await supabaseAdmin
    .from('agent_profiles')
    .select('id, email, first_name, last_name')
    .limit(20);
  
  if (allError) {
    console.error('❌ Error fetching profiles:', allError);
  } else {
    console.log(`✅ Found ${allProfiles?.length || 0} profiles\n`);
    allProfiles?.forEach((profile, idx) => {
      console.log(`  ${idx + 1}. Email: "${profile.email}" | Name: ${profile.first_name} ${profile.last_name}`);
    });
  }

  // Check total count
  const { count, error: countError } = await supabaseAdmin
    .from('agent_profiles')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Total profiles in table: ${count || 0}`);
  
  // Check for chrislafond with any case
  console.log('\n🔍 Searching for chrislafond with ilike (case-insensitive):');
  const { data: ilikeResults, error: ilikeError } = await supabaseAdmin
    .from('agent_profiles')
    .select('*')
    .ilike('email', '%chrislafond%')
    .limit(10);
  
  if (ilikeError) {
    console.error('❌ Error with ilike:', ilikeError);
  } else {
    console.log(`Found ${ilikeResults?.length || 0} profiles matching "chrislafond":`);
    ilikeResults?.forEach(profile => {
      console.log(`  - Email: "${profile.email}" | ID: ${profile.id}`);
    });
  }
}

checkAgentProfiles().catch(console.error);
