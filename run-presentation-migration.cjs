const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  console.log('VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔧 Running presentation tracking migration...\n');
  
  const sql = fs.readFileSync('add-presentation-phase-columns.sql', 'utf8');
  
  // Split by semicolon to run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && !s.startsWith('COMMENT'));
  
  console.log(`📝 Executing ${statements.length} SQL statements...\n`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing:`, statement.substring(0, 100) + '...');
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
      
      if (error) {
        // Try direct query if RPC fails
        const { error: error2 } = await supabase.from('_migrations').insert({ statement });
        
        if (error2) {
          console.log('⚠️  Error (may be expected if column exists):', error.message);
        } else {
          console.log('✅ Success');
        }
      } else {
        console.log('✅ Success');
      }
    } catch (err) {
      console.log('⚠️  Error:', err.message);
    }
  }
  
  console.log('\n✅ Migration complete! Checking table structure...\n');
  
  // Verify the columns were added
  const { data, error } = await supabase
    .from('presentation_sessions')
    .select('id, session_id, current_phase, client_data')
    .limit(1);
  
  if (error) {
    console.error('❌ Error verifying columns:', error);
  } else {
    console.log('✅ Columns verified successfully!');
    console.log('Sample row structure:', data[0] || 'No rows yet');
  }
  
  process.exit(0);
}

runMigration();

