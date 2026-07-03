// Setup script for agent availability tracking
// Run this to create the database table and functions

import { supabaseAdmin } from './server/supabase.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function setupAgentTracking() {
  console.log('🚀 Setting up Agent Availability Tracking...');
  
  try {
    // Read the SQL file
    const sqlPath = join(process.cwd(), 'create-agent-availability-tracking.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');
    
    // Split into individual statements (basic split on semicolon)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabaseAdmin.rpc('exec_sql', { 
          sql: statement + ';' 
        });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      }
    }
    
    console.log('🎉 Agent Availability Tracking setup complete!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupAgentTracking();
}

export { setupAgentTracking };


