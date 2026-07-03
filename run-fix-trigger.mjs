/**
 * Fix the trigger that's blocking agent_dial_metrics inserts
 * Run with: node run-fix-trigger.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runFix() {
  console.log('\n🔧 FIXING TRIGGER TO ALLOW agent_dial_metrics INSERTS');
  console.log('═'.repeat(70));
  
  const sql = fs.readFileSync('fix-trigger-missing-table.sql', 'utf8');
  
  console.log('\n📋 SQL to execute:');
  console.log('═'.repeat(70));
  console.log(sql);
  console.log('═'.repeat(70));
  
  // Split SQL into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`\n📊 Found ${statements.length} SQL statements to execute\n`);
  
  // Try to execute via Supabase RPC (may not work for DDL)
  // Most Supabase instances don't allow DDL via RPC, so we'll just show the SQL
  console.log('⚠️  Supabase typically requires DDL (CREATE/DROP) to be run in the SQL Editor');
  console.log('📋 Please run the SQL above in Supabase Dashboard:\n');
  console.log('   1. Go to: https://supabase.com/dashboard/project/ycztjetxwpfgtrzeyytt/sql');
  console.log('   2. Paste the SQL from fix-trigger-missing-table.sql');
  console.log('   3. Click "Run"\n');
  
  // But try to execute anyway (might work if they have exec_sql function)
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement || statement.length < 10) continue;
    
    console.log(`\n[${i + 1}/${statements.length}] Attempting to execute...`);
    console.log(`   ${statement.substring(0, 80)}...`);
    
    try {
      // Try direct query execution (won't work for DDL, but worth trying)
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        console.log(`   ⚠️  Cannot execute via API (expected for DDL): ${error.message}`);
        console.log(`   ✅ This is normal - please run in Supabase SQL Editor`);
      } else {
        console.log(`   ✅ Executed successfully`);
      }
    } catch (err) {
      console.log(`   ⚠️  Cannot execute via API: ${err.message}`);
      console.log(`   ✅ This is normal - please run in Supabase SQL Editor`);
    }
  }
  
  console.log('\n✅ Fix script complete!');
  console.log('📋 IMPORTANT: Run the SQL in Supabase Dashboard SQL Editor to apply the fix\n');
}

runFix().catch(console.error);
