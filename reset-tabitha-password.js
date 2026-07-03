import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

async function resetTabithaPassword() {
  console.log('🔧 Resetting Tabitha McDermid password...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // First, let's try to create the user if they don't exist
    console.log('🔧 Attempting to create or update user account...');
    
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: 'tabithamcdermid@aoglobelife.com',
      password: 'TabithaTempPass2025!',
      email_confirm: true,
      user_metadata: {
        name: 'Tabitha McDermid',
        associate_id: 38431,
        first_name: 'TABITHA',
        last_name: 'MCDERMID'
      }
    });
    
    if (createError) {
      if (createError.message.includes('already been registered') || createError.message.includes('email_exists')) {
        console.log('📧 User exists, attempting password update...');
        
        // User exists, let's update their password
        const { data: updateUser, error: updateError } = await supabase.auth.admin.updateUserById(
          '303edc55-bb49-4a60-9800-1cbbc26247c8', // Use the user_id from customers table
          {
            password: 'TabithaTempPass2025!',
            email_confirm: true
          }
        );
        
        if (updateError) {
          console.log('❌ Password update failed:', updateError);
          
          // Try generating a reset link instead
          console.log('🔄 Trying password reset link generation...');
          const { data: resetData, error: resetError } = await supabase.auth.api.resetPasswordForEmail('tabithamcdermid@aoglobelife.com');
          
          if (resetError) {
            console.log('❌ Reset link failed:', resetError);
          } else {
            console.log('✅ Password reset email sent');
          }
        } else {
          console.log('✅ Password updated successfully');
        }
      } else {
        console.log('❌ Create user failed:', createError);
      }
    } else {
      console.log('✅ New user created successfully:', newUser.user.id);
      
      // Update the customers table to link to the new auth user
      const { error: updateError } = await supabase
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
    }
    
    console.log('\n🎯 Tabitha can now try logging in with:');
    console.log('   📧 Email: tabithamcdermid@aoglobelife.com');  
    console.log('   🔑 Password: TabithaTempPass2025!');
    console.log('   💡 She should change this password after first login');
    
  } catch (e) {
    console.log('❌ Error:', e.message);
  }
}

resetTabithaPassword();