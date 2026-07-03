// Check if there's something wrong with Leyna's session or account that's different from cnsysop

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zrkzadkgjvzwgupryuha.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpya3phZGtnanZ6d2d1cHJ5dWhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDY2MzU4MiwiZXhwIjoyMDQ2MjM5NTgyfQ.hJ9r5_aSKx7TZu91XbA0ZyUdFAU5WcRPU8b8_Y3Vr2A';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function compareAccounts() {
  console.log('\n🔍 COMPARING LEYNA VS CNSYSOP...\n');
  
  const leynaEmail = 'leynatran@aoglobelife.com';
  const cnsysopEmail = 'cnsysop@aoglobelife.com';
  
  // Check auth.users for both
  console.log('👤 Checking auth.users...');
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  
  const leyna = authUsers?.users?.find(u => u.email === leynaEmail);
  const cnsysop = authUsers?.users?.find(u => u.email === cnsysopEmail);
  
  if (!leyna) {
    console.log('❌ Leyna not found in auth.users!');
  } else {
    console.log('\n📊 LEYNA AUTH DATA:');
    console.log('  ID:', leyna.id);
    console.log('  Email:', leyna.email);
    console.log('  Email Confirmed:', leyna.email_confirmed_at);
    console.log('  Last Sign In:', leyna.last_sign_in_at);
    console.log('  Created:', leyna.created_at);
    console.log('  Banned:', leyna.banned_until || 'No');
    console.log('  Role:', leyna.role);
    console.log('  App Metadata:', JSON.stringify(leyna.app_metadata, null, 2));
    console.log('  User Metadata:', JSON.stringify(leyna.user_metadata, null, 2));
  }
  
  if (cnsysop) {
    console.log('\n📊 CNSYSOP AUTH DATA:');
    console.log('  ID:', cnsysop.id);
    console.log('  Email:', cnsysop.email);
    console.log('  Email Confirmed:', cnsysop.email_confirmed_at);
    console.log('  Last Sign In:', cnsysop.last_sign_in_at);
    console.log('  Role:', cnsysop.role);
    console.log('  App Metadata:', JSON.stringify(cnsysop.app_metadata, null, 2));
  }
  
  // Check if there are any active sessions
  console.log('\n🔐 Checking active sessions...');
  const { data: leynaSessions, error: leynaSessionError } = await supabase
    .from('auth.sessions')
    .select('*')
    .eq('user_id', leyna?.id);
    
  if (leynaSessionError) {
    console.log('⚠️ Could not check sessions (table might not be accessible)');
  } else {
    console.log(`Leyna active sessions: ${leynaSessions?.length || 0}`);
  }
  
  console.log('\n✅ Comparison complete!\n');
  
  // Key things that could cause WebRTC to fail:
  console.log('🔍 POTENTIAL ISSUES TO CHECK:');
  console.log('1. Is Leyna banned or suspended?', leyna?.banned_until ? '❌ YES' : '✅ No');
  console.log('2. Is her email confirmed?', leyna?.email_confirmed_at ? '✅ Yes' : '❌ NO');
  console.log('3. Does she have the same role as cnsysop?', leyna?.role === cnsysop?.role ? '✅ Yes' : '❌ NO');
  console.log('4. Is her account older than 5 minutes?', 
    leyna && (Date.now() - new Date(leyna.created_at).getTime() > 5 * 60 * 1000) ? '✅ Yes' : '⚠️ Very new');
}

compareAccounts().catch(console.error);

