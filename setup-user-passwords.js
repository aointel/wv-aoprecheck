import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

async function setupUserPasswords() {
  console.log('🔧 Setting up user passwords for all main users...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  const users = [
    { 
      email: 'cnsysop@aoglobelife.com', 
      password: 'CNsysop2025!',
      user_id: '27b38cbf-09dd-4801-992e-65d8c1ce2e83' // from customers table
    },
    { 
      email: 'martintoma@aoglobelife.com', 
      password: 'Martin2025!',
      user_id: 'c28a4b4e-1764-4c08-ae68-7f32d968ed85' // from customers table
    },
    { 
      email: 'tabithamcdermid@aoglobelife.com', 
      password: 'TabithaTempPass2025!',
      user_id: '303edc55-bb49-4a60-9800-1cbbc26247c8' // from customers table
    }
  ];
  
  for (const user of users) {
    try {
      console.log(`\n🔧 Updating password for ${user.email}...`);
      
      // Update password using the user_id from customers table
      const { data, error } = await supabase.auth.admin.updateUserById(
        user.user_id,
        {
          password: user.password,
          email_confirm: true
        }
      );
      
      if (error) {
        console.log(`❌ Failed to update ${user.email}:`, error.message);
      } else {
        console.log(`✅ Successfully updated password for ${user.email}`);
      }
      
    } catch (e) {
      console.log(`❌ Error updating ${user.email}:`, e.message);
    }
  }
  
  console.log('\n🎯 USER CREDENTIALS SUMMARY:');
  console.log('=====================================');
  users.forEach(user => {
    console.log(`📧 ${user.email}`);
    console.log(`🔑 ${user.password}`);
    console.log('');
  });
  
  console.log('💡 All users should change their passwords after first login');
}

setupUserPasswords();