import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('📊 Creating meets table in Supabase...\n');

const sql = fs.readFileSync('create-meets-table.sql', 'utf8');

try {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('❌ Error creating table:', error);
    console.log('\n📋 Run this SQL manually in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/ycztjetxwpfgtrzeyytt/sql');
    console.log('\nSQL:');
    console.log(sql);
  } else {
    console.log('✅ meets table created successfully!');
  }
} catch (err) {
  console.error('❌ Failed:', err.message);
  console.log('\n📋 Run this SQL manually in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/ycztjetxwpfgtrzeyytt/sql/new');
  console.log('\n--- Copy and paste this SQL ---\n');
  console.log(sql);
}

