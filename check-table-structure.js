import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableStructure() {
  try {
    console.log('🔍 Checking qm_mga_assignments table structure...');
    
    // Try to get a sample row to see the actual structure
    const { data, error } = await supabase
      .from('qm_mga_assignments')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error accessing table:', error);
      
      // Check if table exists at all
      console.log('\n🔍 Checking if table exists...');
      const { data: tables, error: tablesError } = await supabase
        .rpc('exec_sql', {
          sql: `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%qm%' OR table_name LIKE '%mga%'
            ORDER BY table_name;
          `
        });
      
      if (!tablesError && tables) {
        console.log('📋 Tables found:');
        tables.forEach(table => console.log(`   - ${table.table_name}`));
      }
      
      return;
    }
    
    console.log('✅ Table structure:');
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.log('Sample data:', data[0]);
    } else {
      console.log('Table is empty');
    }
    
    // Get all data
    const { data: allData, error: allError } = await supabase
      .from('qm_mga_assignments')
      .select('*');
    
    if (!allError && allData) {
      console.log(`\n📊 Total records: ${allData.length}`);
      
      if (allData.length > 0) {
        const groupedByQM = {};
        allData.forEach(assignment => {
          const qmEmail = assignment.qm_email || assignment.quality_manager || 'unknown';
          if (!groupedByQM[qmEmail]) {
            groupedByQM[qmEmail] = [];
          }
          const teamName = assignment.mga_name || assignment.mga || 'unknown';
          groupedByQM[qmEmail].push(teamName);
        });
        
        console.log('\n📧 Current assignments:');
        Object.entries(groupedByQM).forEach(([qmEmail, teams]) => {
          console.log(`${qmEmail}:`);
          teams.forEach(team => console.log(`   - ${team}`));
          console.log('');
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTableStructure();
