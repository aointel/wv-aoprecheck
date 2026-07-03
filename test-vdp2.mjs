import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'
);

const email = 'savannadelph@aoglobelife.com';
const normalizedEmail = email.toLowerCase().trim();

const { data, error } = await sb.from('customers')
  .select('id, first_name, last_name, company_email, personal_email, associate_id, states, market, VDPACTIVE, PLUSCAMPAIGNID')
  .or(`company_email.ilike.${normalizedEmail},personal_email.ilike.${normalizedEmail}`);

console.log('Result count:', data?.length);
console.log('Data:', JSON.stringify(data, null, 2));
console.log('Error:', error?.message);
