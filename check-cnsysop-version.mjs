import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔍 CHECKING CNSYSOP VERSION...\n');

const { data: versionData } = await supabase
  .from('app_versions')
  .select('*')
  .eq('agent_email', 'cnsysop@aoglobelife.com')
  .single();

if (versionData) {
  console.log('✅ cnsysop has app version recorded:');
  console.log(`   Version: ${versionData.app_version}`);
  console.log(`   Platform: ${versionData.platform}`);
  console.log(`   Last seen: ${versionData.last_seen}`);
  console.log(`   First seen: ${versionData.first_seen}`);
} else {
  console.log('❌ NO VERSION DATA for cnsysop');
  console.log('   Either:');
  console.log('   1. Using web browser (no Electron app)');
  console.log('   2. Using old Electron version that doesn\'t report version');
  console.log('   3. Never opened a presentation with v1.0.3');
}

