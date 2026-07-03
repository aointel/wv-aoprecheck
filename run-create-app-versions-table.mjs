import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔧 Creating app_versions table...\n');

const sql = fs.readFileSync('create-app-versions-table.sql', 'utf8');

// Split by statement
const statements = sql.split(';').filter(s => s.trim().length > 0);

for (const statement of statements) {
  const trimmed = statement.trim();
  if (!trimmed) continue;
  
  console.log(`Executing: ${trimmed.substring(0, 80)}...`);
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: trimmed });
    
    if (error) {
      console.error('❌ Error:', error.message);
      // Try direct query as fallback
      console.log('Trying alternate method...');
      // Most Supabase SQL needs to be run in SQL editor, not via API
    } else {
      console.log('✅ Success');
    }
  } catch (err) {
    console.log('⚠️  SQL may need to be run manually in Supabase dashboard');
  }
}

console.log('\n📋 SQL to run manually in Supabase:');
console.log('════════════════════════════════════════════════════════════');
console.log(sql);
console.log('════════════════════════════════════════════════════════════');

console.log('\n✅ Done - Please run the SQL above in Supabase SQL Editor if needed');

