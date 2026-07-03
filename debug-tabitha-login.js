import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

async function debugTabithaLogin() {
  console.log('🔍 Debugging Tabitha McDermid login issue...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // 1. Check if user exists in customers table
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('company_email', 'tabithamcdermid@aoglobelife.com')
      .single();
      
    console.log('👤 Customer record:', customer ? 'EXISTS' : 'NOT FOUND');
    if (customer) {
      console.log('   - user_id:', customer.user_id);
      console.log('   - associate_id:', customer.associate_id);
      console.log('   - first_name:', customer.first_name);
      console.log('   - last_name:', customer.last_name);
    }
    if (customerError) console.log('❌ Customer error:', customerError.message);
    
    // 2. List all auth users to find Tabitha
    const { data: allUsers, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.log('❌ Error listing users:', usersError);
      return;
    }
    
    console.log(`📊 Total auth users: ${allUsers?.users?.length || 0}`);
    
    const tabithaUsers = allUsers?.users?.filter(user => 
      user.email?.includes('tabitha') || user.email?.includes('mcdermid')
    );
    
    console.log('🔍 Tabitha-related users found:', tabithaUsers?.length || 0);
    tabithaUsers?.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id}) - Created: ${user.created_at}`);
      console.log(`     Confirmed: ${user.email_confirmed_at ? 'YES' : 'NO'}`);
      console.log(`     Last login: ${user.last_sign_in_at || 'NEVER'}`);
    });
    
    // 3. Try to create/reset Tabitha's account
    console.log('\n🔧 Attempting to fix Tabitha\'s account...');
    
    const { data: createResult, error: createError } = await supabase.auth.admin.createUser({
      email: 'tabithamcdermid@aoglobelife.com',
      password: 'TabithaTempPass2025!',
      email_confirm: true,
      user_metadata: {
        name: 'Tabitha McDermid',
        associate_id: 38431,
        first_name: 'Tabitha',
        last_name: 'McDermid'
      }
    });
    
    if (createError) {
      if (createError.message.includes('already been registered') || createError.message.includes('email_exists')) {
        console.log('📧 User exists, updating password...');
        
        // Find the exact user ID and update
        const tabithaUser = tabithaUsers?.[0];
        if (tabithaUser) {
          const { data: updateResult, error: updateError } = await supabase.auth.admin.updateUserById(
            tabithaUser.id,
            {
              password: 'TabithaTempPass2025!',
              email_confirm: true,
              user_metadata: {
                name: 'Tabitha McDermid',
                associate_id: 38431,
                first_name: 'Tabitha',
                last_name: 'McDermid'
              }
            }
          );
          
          if (updateError) {
            console.log('❌ Password update failed:', updateError.message);
          } else {
            console.log('✅ Password updated successfully');
            
            // Update customers table to link properly
            if (customer && customer.user_id !== tabithaUser.id) {
              await supabase
                .from('customers')
                .update({ user_id: tabithaUser.id })
                .eq('company_email', 'tabithamcdermid@aoglobelife.com');
              console.log('✅ Linked auth user to customer record');
            }
          }
        }
      } else {
        console.log('❌ Create user failed:', createError.message);
      }
    } else {
      console.log('✅ New user created successfully');
      
      // Link to customer record
      if (customer) {
        await supabase
          .from('customers')
          .update({ user_id: createResult.user.id })
          .eq('company_email', 'tabithamcdermid@aoglobelife.com');
        console.log('✅ Linked new auth user to customer record');
      }
    }
    
    console.log('\n🎯 TABITHA LOGIN CREDENTIALS:');
    console.log('   📧 Email: tabithamcdermid@aoglobelife.com');
    console.log('   🔑 Password: TabithaTempPass2025!');
    console.log('   💡 This should work now!');
    
  } catch (e) {
    console.log('❌ Error:', e.message);
  }
}

debugTabithaLogin();