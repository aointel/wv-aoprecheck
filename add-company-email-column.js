import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addCompanyEmailColumn() {
  try {
    console.log('🔧 Adding company_email column to verification_sessions table...');

    // Check if the column already exists by trying to select it
    const { data, error } = await supabase
      .from('verification_sessions')
      .select('company_email')
      .limit(1);

    if (error) {
      if (error.code === '42703') { // Column doesn't exist
        console.log('📝 Column company_email does not exist, adding it...');
        
        // Add the column using RPC call
        const { error: addColumnError } = await supabase.rpc('exec_sql', {
          sql: 'ALTER TABLE verification_sessions ADD COLUMN company_email TEXT;'
        });

        if (addColumnError) {
          console.error('❌ Error adding company_email column:', addColumnError);
        } else {
          console.log('✅ Successfully added company_email column');
        }
      } else {
        console.error('❌ Error checking column:', error);
      }
    } else {
      console.log('✅ Column company_email already exists');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addCompanyEmailColumn();

