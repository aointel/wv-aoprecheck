import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const supabase = createClient(
  'https://ycztjetxwpfgtrzeytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const email = 'alisaharrell@aoglobelife.com';

const { data: customer, error } = await supabase
  .from('customers')
  .select('states, market, company_email, personal_email')
  .or(`company_email.eq.${email},personal_email.eq.${email}`)
  .limit(1)
  .single();

console.log({ error, customer });










