// Debug script to check Chris's leads in Supabase
import { createClient } from '@supabase/supabase-js';

async function debugChrisLeads() {
  const supabase = createClient(
    'https://jhnbimrzkurzjjwwhlzl.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobmJpbXJ6a3Vyempqd3dobHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgwNjA2MzAsImV4cCI6MjAzMzYzNjYzMH0.c2k1LNJLXrBRNKgq8vIE5EJuRp3JJvnRN_t6cVdQ0xY'
  );

  console.log('🔍 Checking masterlead table for Chris Lafond...');
  
  // Check both email variants
  const emails = [
    'chrislafond@aoglobelife.com',
    'chrislafond@aoglboelife.com',
    'christopher.lafond@aoglobelife.com',
    'chris.lafond@aoglobelife.com'
  ];
  
  for (const email of emails) {
    console.log(`\n📧 Checking email: ${email}`);
    
    const { data, error, count } = await supabase
      .from('masterlead')
      .select('*', { count: 'exact' })
      .eq('cn_email', email)
      .limit(5);
    
    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else {
      console.log(`📊 Found ${count || 0} leads for ${email}`);
      if (data && data.length > 0) {
        console.log(`📋 Sample lead:`, data[0]);
      }
    }
  }
  
  // Check for any similar email patterns
  console.log('\n🔍 Searching for any "lafond" or "chris" in cn_email...');
  
  const { data: similarLeads, error: similarError } = await supabase
    .from('masterlead')
    .select('cn_email, first_name, last_name, taalk_market')
    .or('cn_email.ilike.%lafond%,cn_email.ilike.%chris%,first_name.ilike.%chris%,last_name.ilike.%lafond%')
    .limit(10);
    
  if (similarError) {
    console.log(`❌ Error searching similar: ${similarError.message}`);
  } else {
    console.log(`📋 Found ${similarLeads?.length || 0} similar records:`);
    similarLeads?.forEach(lead => {
      console.log(`  - ${lead.cn_email} | ${lead.first_name} ${lead.last_name} | ${lead.taalk_market}`);
    });
  }
  
  // Check total count of masterlead table
  console.log('\n📊 Checking total masterlead table size...');
  const { count: totalCount, error: countError } = await supabase
    .from('masterlead')
    .select('*', { count: 'exact', head: true });
    
  if (countError) {
    console.log(`❌ Error counting: ${countError.message}`);
  } else {
    console.log(`📊 Total masterlead records: ${totalCount}`);
  }
}

debugChrisLeads().catch(console.error);