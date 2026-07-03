/**
 * Check where screenshots are supposed to be saved
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkScreenshotStorage() {
  console.log('\n🔍 CHECKING SCREENSHOT STORAGE\n');
  console.log('='.repeat(60));

  try {
    // Check if presentation_screenshots table exists and has data
    console.log('📊 CHECKING presentation_screenshots TABLE:\n');
    
    const { data: tableInfo, error: tableError } = await supabase
      .from('presentation_screenshots')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ Error accessing presentation_screenshots table:', tableError);
      console.log('\n💡 This might mean:');
      console.log('   1. Table does not exist');
      console.log('   2. Wrong table name');
      console.log('   3. Permission issue');
      return;
    }

    console.log('✅ presentation_screenshots table exists and is accessible');

    // Get total count
    const { count: totalScreenshots, error: countError } = await supabase
      .from('presentation_screenshots')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error getting count:', countError);
    } else {
      console.log(`📊 Total screenshots in database: ${totalScreenshots || 0}`);
    }

    // Check recent screenshots
    const { data: recentScreenshots, error: recentError } = await supabase
      .from('presentation_screenshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      console.error('❌ Error getting recent screenshots:', recentError);
    } else {
      console.log(`\n📸 RECENT SCREENSHOTS (last 5):\n`);
      if (!recentScreenshots || recentScreenshots.length === 0) {
        console.log('   ❌ NO SCREENSHOTS FOUND!');
      } else {
        recentScreenshots.forEach((ss, idx) => {
          console.log(`   ${idx + 1}. Session: ${ss.session_id}`);
          console.log(`      Created: ${ss.created_at}`);
          console.log(`      Sequence: ${ss.sequence_number}`);
          console.log(`      Has Data: ${ss.screenshot_data ? 'Yes' : 'No'}`);
          console.log(`      Data Size: ${ss.screenshot_data ? ss.screenshot_data.length : 0} chars`);
          console.log(`      AI Analysis: ${ss.ai_analysis ? 'Yes' : 'No'}`);
          console.log('');
        });
      }
    }

    // Check table schema
    console.log('\n🔍 CHECKING TABLE SCHEMA:\n');
    
    const { data: sampleScreenshot, error: sampleError } = await supabase
      .from('presentation_screenshots')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Error getting sample:', sampleError);
    } else if (sampleScreenshot && sampleScreenshot.length > 0) {
      const sample = sampleScreenshot[0];
      console.log('📋 TABLE COLUMNS:');
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        const type = typeof value;
        const size = type === 'string' ? value.length : 'N/A';
        console.log(`   ${key}: ${type} (${size} chars)`);
      });
    } else {
      console.log('⚠️ No sample data to check schema');
    }

    // Check if there are any screenshots for Leyna's current session
    console.log('\n🔍 CHECKING LEYNA\'S CURRENT SESSION SCREENSHOTS:\n');
    
    const { data: leynaScreenshots, error: leynaError } = await supabase
      .from('presentation_screenshots')
      .select('*')
      .eq('session_id', '350dcb79-7ef0-4317-8cf0-875c51cdb01c'); // Leyna's current session ID

    if (leynaError) {
      console.error('❌ Error checking Leyna\'s screenshots:', leynaError);
    } else {
      console.log(`📸 Leyna's current session screenshots: ${leynaScreenshots?.length || 0}`);
      if (leynaScreenshots && leynaScreenshots.length > 0) {
        leynaScreenshots.forEach((ss, idx) => {
          console.log(`   ${idx + 1}. Sequence: ${ss.sequence_number}, Created: ${ss.created_at}`);
        });
      } else {
        console.log('   ❌ NO SCREENSHOTS for Leyna\'s current session!');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 SCREENSHOT CAPTURE FLOW:\n');
    console.log('   1. Agent opens HPPRO in Electron app');
    console.log('   2. Electron captures screenshots automatically');
    console.log('   3. Screenshots sent to /api/presentations/screenshot endpoint');
    console.log('   4. Screenshots saved to presentation_screenshots table');
    console.log('   5. AI analyzes screenshots for milestone detection');
    console.log('\n🚨 CURRENT ISSUE:');
    console.log('   Agents are NOT using Electron app → No screenshots captured');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkScreenshotStorage()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

