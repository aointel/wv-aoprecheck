import { supabaseAdmin } from './server/supabase.ts';
import fs from 'fs';

async function setupTables() {
  try {
    console.log('🔧 Setting up presentation tracking tables...');
    
    const sql = fs.readFileSync('create-presentation-tracking-tables.sql', 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('📝 Executing:', statement.substring(0, 50) + '...');
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error('❌ Error:', error);
        } else {
          console.log('✅ Success');
        }
      }
    }
    
    console.log('🎉 All tables created successfully!');
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupTables();
