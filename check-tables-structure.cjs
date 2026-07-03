const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkStructure() {
  try {
    // Check user_credits structure
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .limit(1);
    
    if (credits && credits.length > 0) {
      console.log('user_credits columns:', Object.keys(credits[0]));
    }
    
    // Check agent_profiles structure
    const { data: profiles, error: profilesError } = await supabase
      .from('agent_profiles')
      .select('*')
      .limit(1);
    
    if (profiles && profiles.length > 0) {
      console.log('agent_profiles columns:', Object.keys(profiles[0]));
    }
    
    // Check transactions structure
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*')
      .limit(1);
    
    if (transactions && transactions.length > 0) {
      console.log('transactions columns:', Object.keys(transactions[0]));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkStructure();






