import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

async function createTabithaAuth() {
  console.log('🔧 Creating missing auth account for Tabitha McDermid...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // First check if she exists in auth.users
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.log('❌ Error listing users:', listError);
      return;
    }
    
    const existingUser = existingUsers?.users?.find(user => 
      user.email === 'tabithamcdermid@aoglobelife.com'
    );
    
    if (existingUser) {
      console.log('✅ Auth account already exists for Tabitha:', existingUser.id);
      return;
    }
    
    console.log('🔧 Creating new auth user for tabithamcdermid@aoglobelife.com...');
    
    // Create the auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: 'tabithamcdermid@aoglobelife.com',
      password: 'TempPassword123!', // She'll need to reset this
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        name: 'Tabitha McDermid',
        associate_id: 38431,
        first_name: 'TABITHA',
        last_name: 'MCDERMID'
      }
    });
    
    if (createError) {
      console.log('❌ Error creating auth user:', createError);
      return;
    }
    
    console.log('✅ Successfully created auth user for Tabitha:', {
      id: newUser.user.id,
      email: newUser.user.email,
      created_at: newUser.user.created_at
    });
    
    // Update the customers table to link to the new auth user
    const { data: updateData, error: updateError } = await supabase
      .from('customers')
      .update({ 
        user_id: newUser.user.id 
      })
      .eq('company_email', 'tabithamcdermid@aoglobelife.com');
      
    if (updateError) {
      console.log('❌ Error updating customer user_id:', updateError);
    } else {
      console.log('✅ Updated customer record with new user_id');
    }
    
    console.log('\n🎉 Tabitha McDermid can now login with:');
    console.log('   📧 Email: tabithamcdermid@aoglobelife.com');  
    console.log('   🔑 Password: TempPassword123! (she should change this)');
    
  } catch (e) {
    console.log('❌ Error:', e.message);
  }
}

createTabithaAuth();