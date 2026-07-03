/**
 * Add missing columns to Supabase tables
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function addMissingColumns() {
  try {
    console.log('🔧 Adding missing columns to Supabase...\n');
    
    // Check if ccpro_call_minutes exists
    const { data: checkData, error: checkError } = await supabase
      .from('weekly_usage_stats')
      .select('ccpro_call_minutes')
      .limit(1);
    
    if (checkError && checkError.message.includes('column') && checkError.message.includes('does not exist')) {
      console.log('❌ ccpro_call_minutes column does NOT exist');
      console.log('💡 You need to run this SQL in Supabase SQL Editor:');
      console.log('');
      console.log('ALTER TABLE weekly_usage_stats');
      console.log('ADD COLUMN IF NOT EXISTS ccpro_call_minutes INTEGER DEFAULT 0;');
      console.log('');
      console.log('⚠️ Cannot add columns via Supabase JS client - must use SQL editor');
      return;
    } else if (checkError) {
      console.error('❌ Error checking column:', checkError);
      return;
    } else {
      console.log('✅ ccpro_call_minutes column already exists!');
    }
    
    // Test inserting with ccpro_call_minutes
    console.log('\n🧪 Testing insert with ccpro_call_minutes...');
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const { data: testInsert, error: insertError } = await supabase
      .from('weekly_usage_stats')
      .upsert({
        agent_email: 'test-column-check@aoglobelife.com',
        week_start_date: weekStart.toISOString().split('T')[0],
        week_end_date: weekEnd.toISOString().split('T')[0],
        ccpro_call_minutes: 30,
        total_dials_made: 5,
        total_call_minutes: 30,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'agent_email,week_start_date'
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Insert test failed:', insertError);
      console.error('Details:', JSON.stringify(insertError, null, 2));
    } else {
      console.log('✅ Insert test successful:', testInsert);
      // Clean up
      await supabase
        .from('weekly_usage_stats')
        .delete()
        .eq('agent_email', 'test-column-check@aoglobelife.com');
    }
    
    console.log('\n✅✅✅ Column check complete! ✅✅✅\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addMissingColumns();
