/**
 * Migration script to add AI validation columns to verification_sessions table
 * 
 * This script provides the SQL you need to run in Supabase Dashboard
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('\n🔧 AI VALIDATION COLUMN MIGRATION');
  console.log('═'.repeat(70));
  
  // Read the SQL file
  const sql = fs.readFileSync('add-ai-validation-columns.sql', 'utf8');
  
  console.log('\n📋 STEP 1: Copy the SQL below');
  console.log('═'.repeat(70));
  console.log(sql);
  console.log('═'.repeat(70));
  
  console.log('\n📋 STEP 2: Run in Supabase Dashboard');
  console.log('  1. Go to: https://supabase.com/dashboard/project/ycztjetxwpfgtrzeyytt/sql');
  console.log('  2. Paste the SQL above');
  console.log('  3. Click "Run"\n');
  
  console.log('⏳ Checking current table structure...\n');
  
  try {
    // Try to query the table to see if columns exist
    const { data, error } = await supabase
      .from('verification_sessions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error querying table:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      const sampleRow = data[0];
      const hasScreenshotUrl = 'screenshot_url' in sampleRow;
      const hasScreenshotValidation = 'screenshot_validation' in sampleRow;
      const hasRecordingUrl = 'recording_url' in sampleRow;
      const hasAudioAnalysis = 'audio_analysis' in sampleRow;
      
      console.log('📊 Current Columns:');
      console.log(`   screenshot_url: ${hasScreenshotUrl ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`   screenshot_validation: ${hasScreenshotValidation ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`   recording_url: ${hasRecordingUrl ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`   audio_analysis: ${hasAudioAnalysis ? '✅ EXISTS' : '❌ MISSING'}`);
      
      if (hasScreenshotUrl && hasScreenshotValidation && hasRecordingUrl && hasAudioAnalysis) {
        console.log('\n✅ ALL COLUMNS EXIST! Migration already complete!\n');
        console.log('🚀 Next step: Run analyze-all-existing-sessions.cjs to process data\n');
      } else {
        console.log('\n⚠️  COLUMNS MISSING! Please run the SQL above in Supabase Dashboard\n');
      }
    } else {
      console.log('⚠️  No sessions found in database yet\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('═'.repeat(70) + '\n');
}

runMigration();
