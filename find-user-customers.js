import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

async function findUserCustomers() {
  console.log('🔍 Searching for user customers...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Search by email fields
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .or('company_email.eq.cnsysop@aoglobelife.com,company_email.eq.martintoma@aoglobelife.com,personal_email.eq.cnsysop@aoglobelife.com,personal_email.eq.martintoma@aoglobelife.com');
      
    if (error) {
      console.log('❌ Email search error:', error);
    } else {
      console.log('📧 Found customers by email:', data);
    }
    
    // Search by agent name patterns
    const { data: nameData, error: nameError } = await supabase
      .from('customers')
      .select('*')
      .or('agent_name.ilike.%michael%,agent_name.ilike.%martin%,agent_name.ilike.%toma%,agent_name.ilike.%mandella%');
      
    if (nameError) {
      console.log('❌ Name search error:', nameError);
    } else {
      console.log('👤 Found customers by name pattern:', nameData);
    }
    
    // Get all customers with non-null associate_id to see what real data looks like
    const { data: realAssociates, error: realError } = await supabase
      .from('customers')
      .select('*')
      .not('associate_id', 'is', null)
      .limit(5);
      
    if (realError) {
      console.log('❌ Real associates search error:', realError);
    } else {
      console.log('🎯 Real customers with associate_id:', realAssociates);
    }
    
  } catch (e) {
    console.log('❌ Error:', e.message);
  }
}

findUserCustomers();