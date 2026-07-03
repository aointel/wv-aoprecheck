// Reset user password in production Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetPassword() {
  try {
    console.log('Listing users to find chrislafond@aoglobelife.com...');
    
    // List users to find the user ID
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }
    
    console.log(`Found ${users.users.length} users`);
    
    // Print all emails to debug
    console.log('All user emails:');
    users.users.forEach(user => console.log('  -', user.email));
    
    const targetUser = users.users.find(user => user.email === 'chrislafond@aoglobelife.com');
    
    if (!targetUser) {
      console.log('❌ User not found. Creating user...');
      
      // Create the user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: 'chrislafond@aoglobelife.com',
        password: 'CqConnectNow24',
        email_confirm: true
      });
      
      if (createError) {
        console.error('Error creating user:', createError);
        return;
      }
      
      console.log('✅ User created successfully:', newUser.user?.email);
      return;
    }
    
    console.log('✅ Found user:', targetUser.email, 'ID:', targetUser.id);
    
    // Reset password
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: 'CqConnectNow24'
    });
    
    if (error) {
      console.error('Error updating password:', error);
      return;
    }
    
    console.log('✅ Password updated successfully for:', targetUser.email);
    
  } catch (error) {
    console.error('Failed to reset password:', error);
  }
}

resetPassword();