import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabaseFunctions() {
  try {
    console.log('🔍 Checking Supabase functions and triggers...');

    // Check for functions
    const functionsResult = await supabase.rpc('exec_sql', {
      sql: `
        SELECT routine_name, routine_definition
        FROM information_schema.routines 
        WHERE routine_name LIKE '%verification%' OR routine_name LIKE '%session%'
        ORDER BY routine_name
      `
    });

    if (functionsResult.data && functionsResult.data.length > 0) {
      console.log(`\n📋 Supabase functions:`);
      functionsResult.data.forEach(func => {
        console.log(`   ${func.routine_name}`);
      });
    } else {
      console.log(`\n📋 No relevant functions found`);
    }

    // Check for triggers
    const triggersResult = await supabase.rpc('exec_sql', {
      sql: `
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers 
        WHERE event_object_table = 'verification_sessions'
        ORDER BY trigger_name
      `
    });

    if (triggersResult.data && triggersResult.data.length > 0) {
      console.log(`\n📋 Supabase triggers on verification_sessions:`);
      triggersResult.data.forEach(trigger => {
        console.log(`   ${trigger.trigger_name}: ${trigger.event_manipulation} -> ${trigger.action_statement}`);
      });
    } else {
      console.log(`\n📋 No triggers found on verification_sessions`);
    }

    // Check if there are any views that might be adding associate_id
    const viewsResult = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name, view_definition
        FROM information_schema.views 
        WHERE table_name LIKE '%verification%' OR table_name LIKE '%session%'
      `
    });

    if (viewsResult.data && viewsResult.data.length > 0) {
      console.log(`\n📋 Supabase views:`);
      viewsResult.data.forEach(view => {
        console.log(`   ${view.table_name}: ${view.view_definition.substring(0, 100)}...`);
      });
    } else {
      console.log(`\n📋 No relevant views found`);
    }

    // Check the actual data in Supabase
    console.log(`\n📊 Checking actual data in Supabase verification_sessions...`);
    const dataResult = await supabase
      .from('verification_sessions')
      .select('id, associate_id, agent_first_name, agent_last_name, agent_mga_team, created_at')
      .order('id', { ascending: false })
      .limit(5);

    if (dataResult.error) {
      console.error('❌ Error fetching data from Supabase:', dataResult.error);
    } else {
      console.log(`📊 Sample data from Supabase:`);
      dataResult.data.forEach(session => {
        console.log(`   ID ${session.id}: ${session.agent_first_name} ${session.agent_last_name} (associate_id: ${session.associate_id}) -> MGA: ${session.agent_mga_team || 'NULL'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking Supabase functions:', error);
  }
}

// Run the check
checkSupabaseFunctions();

