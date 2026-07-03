import { createClient } from '@supabase/supabase-js';

// Test with anon key (what vdp-service-fixed uses)
const sbAnon = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNzQwMzcsImV4cCI6MjA1Mjc1MDAzN30.E0gNaQyQUhfN2I8XfdNVEViVv90HxKZS4Rcwcq19ldc'
);

const email = 'savannadelph@aoglobelife.com';
const { data, error } = await sbAnon.from('customers')
  .select('id, company_email, associate_id, VDPACTIVE, PLUSCAMPAIGNID')
  .or(`company_email.ilike.${email},personal_email.ilike.${email}`);

console.log('Anon result:', JSON.stringify(data), 'Error:', error?.message);
