import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljeno0dGpldHh3cGZndHJ6ZXl5dHQiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzU5MTMzMDgxLCJleHAiOjIwNzQ3MDkwODF9.3rGhKPEWLZYr_yMQxZHYM94xsQFYuZ0yqnFEy8FxkVQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
  console.log('🔧 Attempting to add taalk_call_url column to Supabase...');
  
  // First check if column exists by trying to select it
  const { data: testData, error: testError } = await supabase
    .from('verification_sessions')
    .select('taalk_call_url')
    .limit(1);
  
  if (testError) {
    if (testError.code === '42703' || testError.message.includes('does not exist')) {
      console.log('❌ Column does not exist. You need to add it manually in Supabase dashboard:');
      console.log('   1. Go to https://supabase.com/dashboard/project/ycztjetxwpfgtrzeyytt');
      console.log('   2. Navigate to Database > Tables > verification_sessions');
      console.log('   3. Click "New Column" and add:');
      console.log('      - Name: taalk_call_url');
      console.log('      - Type: text');
      console.log('      - Default value: NULL');
      console.log('      - Nullable: Yes');
    } else {
      console.log('❌ Error checking column:', testError);
    }
  } else {
    console.log('✅ Column already exists!');
  }
}

addColumn();
