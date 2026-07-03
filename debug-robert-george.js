import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dkwhstkcuxdkjdkmngpl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrd2hzdGtjdXhka2pka21uZ3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTA3ODk2ODEsImV4cCI6MjAyNjM2NTY4MX0.BZVl2LcQa3JCBj11b96SFjU65kPJh-n5dUmGaF7OL-s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findRobertGeorge() {
  console.log('🔍 Searching for Robert George in Supabase...');
  
  const { data, error } = await supabase
    .from('masterlead')
    .select('first_name, last_name, phone, taalk_lead_id, taalk_group_code, taalk_groupname, taalk_beneficiary, taalk_relationship, taalk_reffered, taalk_sponsor_org')
    .eq('first_name', 'Robert')
    .eq('last_name', 'George')
    .ilike('phone', '%6514856671%');
  
  if (error) {
    console.error('❌ Supabase Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('❌ No Robert George found with that phone number');
    return;
  }
  
  console.log('✅ Found Robert George:');
  data.forEach((lead, index) => {
    console.log(`\n--- Lead ${index + 1} ---`);
    console.log('Name:', lead.first_name, lead.last_name);
    console.log('Phone:', lead.phone);
    console.log('Lead ID:', lead.taalk_lead_id);
    console.log('Group Code:', lead.taalk_group_code);
    console.log('Group Name (taalk_groupname):', JSON.stringify(lead.taalk_groupname));
    console.log('Beneficiary:', JSON.stringify(lead.taalk_beneficiary));
    console.log('Relationship:', JSON.stringify(lead.taalk_relationship));
    console.log('Referred By:', JSON.stringify(lead.taalk_reffered));
    console.log('Sponsor Org:', JSON.stringify(lead.taalk_sponsor_org));
  });
}

findRobertGeorge().catch(console.error);