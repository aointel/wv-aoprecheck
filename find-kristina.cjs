require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findKristina() {
  try {
    console.log('🔍 Searching for Kristina in producerlist...\n');
    
    const { data: producerlist, error: plError } = await supabase
      .from('producerlist')
      .select('associate_id, agent_name, company_email')
      .ilike('agent_name', '%kristina%');
    
    console.log('Producerlist results:', producerlist);
    console.log('');
    
    console.log('🔍 Searching for Kristina in producers...\n');
    
    const { data: producers, error: pError } = await supabase
      .from('producers')
      .select('associate_id, agent_name, email')
      .ilike('email', '%kristina%');
    
    console.log('Producers results:', producers);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findKristina();

