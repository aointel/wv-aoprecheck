// Create production user account
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUser() {
  try {
    console.log('Creating user chrislafond@aoglobelife.com in production...');
    
    // Create user in Supabase auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: 'chrislafond@aoglobelife.com',
      password: 'CqConnectNow24',
      email_confirm: true
    });

    if (error) {
      console.error('Error creating user:', error);
      if (error.message.includes('already registered')) {
        console.log('✅ User already exists, that\'s good!');
        return;
      }
      throw error;
    }

    console.log('✅ User created successfully:', data.user?.email);
    console.log('User ID:', data.user?.id);
    
  } catch (error) {
    console.error('Failed to create user:', error);
  }
}

createUser();