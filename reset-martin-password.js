import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljeno0amV0eHdwZmd0cnpleXl0dCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3MjI4Nzg5NDEsImV4cCI6MjAzODQ1NDk0MX0.Bvg6MIVSi57F8yEVLO_CsZfSdfgYEW8VbIrlr8UrN84';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFixMartin() {
  try {
    console.log('🔍 Checking Martin Toma account...');
    
    // List all users
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    
    const martin = users.users.find(u => u.email === 'martin.toma@aoglobelife.com');
    
    if (martin) {
      console.log('✅ Martin account exists:', martin.email);
      console.log('📧 Martin ID:', martin.id);
      console.log('📅 Created:', martin.created_at);
      
      // Reset password to system default
      console.log('🔄 Resetting password to Martin2025!...');
      const { data, error: resetError } = await supabase.auth.admin.updateUserById(
        martin.id,
        { password: 'Martin2025!' }
      );
      
      if (resetError) {
        console.error('❌ Password reset failed:', resetError.message);
      } else {
        console.log('✅ Password reset successful for Martin');
      }
    } else {
      console.log('❌ Martin account not found in Supabase');
      console.log('📝 Available users:');
      users.users.forEach(u => console.log(`  - ${u.email}`));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAndFixMartin();