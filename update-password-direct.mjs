import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read hardcoded config - it's a TypeScript file but we'll import the values directly
// Or use environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const email = 'aointeldemo@aoglobelife.com';
const newPassword = 'aointel2026';

console.log(`🔄 Updating password for ${email} to: ${newPassword}`);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updatePassword() {
  try {
    // Find user by email - list all and find exact match
    console.log(`🔍 Looking up user: ${email}`);
    const normalizedEmail = email.toLowerCase().trim();
    
    let user = null;
    let page = 1;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore && !user) {
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: pageSize
      });
      
      if (listError) {
        console.error('❌ Error looking up user:', listError);
        process.exit(1);
      }
      
      if (usersData && usersData.users) {
        user = usersData.users.find(u => u.email?.toLowerCase() === normalizedEmail);
        if (user) {
          console.log(`✅ Found user on page ${page}`);
          break;
        }
        
        hasMore = usersData.users.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }
    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    
    // Update password
    console.log(`🔄 Updating password...`);
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { 
        password: newPassword,
        email_confirm: true
      }
    );
    
    if (updateError) {
      console.error('❌ Password update error:', updateError);
      console.error('❌ Error details:', JSON.stringify(updateError, null, 2));
      process.exit(1);
    }
    
    if (!updateData || !updateData.user) {
      console.error('❌ Password update returned no user data');
      process.exit(1);
    }
    
    console.log(`✅ Password updated successfully!`);
    console.log(`✅ User ID: ${updateData.user.id}`);
    console.log(`✅ Email: ${updateData.user.email}`);
    console.log(`✅ New password: ${newPassword}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updatePassword();

