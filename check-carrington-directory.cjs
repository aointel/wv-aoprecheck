const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  // Check by associate_id
  const { data: byId } = await supabase
    .from('mga_rga_directory')
    .select('*')
    .eq('associate_id', 91167)
    .maybeSingle();

  console.log('\n📋 By Associate ID (91167):');
  console.log(JSON.stringify(byId, null, 2));

  // Check by email
  const { data: byEmail } = await supabase
    .from('mga_rga_directory')
    .select('*')
    .eq('email', 'carringtonhanna@aoglobelife.com')
    .maybeSingle();

  console.log('\n📋 By Email (carringtonhanna@aoglobelife.com):');
  console.log(JSON.stringify(byEmail, null, 2));

  // Check customers table
  const { data: customer } = await supabase
    .from('customers')
    .select('associate_id, company_email, personal_email, first_name, last_name')
    .eq('associate_id', 91167)
    .maybeSingle();

  console.log('\n📋 Customer Record:');
  console.log(JSON.stringify(customer, null, 2));
}

check().catch(console.error);










