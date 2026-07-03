import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔍 CHECKING PATRICIA\'S APP VERSION...\n');

// Check app_versions table
const { data: versionData } = await supabase
  .from('app_versions')
  .select('*')
  .eq('agent_email', 'patriciasantamarina@aoglobelife.com')
  .single();

if (versionData) {
  console.log('✅ Found version record:');
  console.log(`   Version: ${versionData.app_version}`);
  console.log(`   Last seen: ${versionData.last_seen}`);
  console.log(`   Platform: ${versionData.platform}`);
} else {
  console.log('❌ NO VERSION DATA - She never reported a version');
  console.log('   This means she\'s using an OLD version (pre-v1.0.3)');
}

console.log('\n🔍 CHECKING LEYNA\'S APP VERSION (for comparison)...\n');

const { data: leynaVersion } = await supabase
  .from('app_versions')
  .select('*')
  .eq('agent_email', 'leynatran@aoglobelife.com')
  .single();

if (leynaVersion) {
  console.log('✅ Leyna has:');
  console.log(`   Version: ${leynaVersion.app_version}`);
  console.log(`   Last seen: ${leynaVersion.last_seen}`);
} else {
  console.log('❌ Leyna has NO version data either');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('💡 DIAGNOSIS:');
console.log('If Patricia has NO version or version < 1.0.3:');
console.log('   → She needs to download and install v1.0.3');
console.log('   → Old version has NO screenshot capture');
console.log('   → Old version has NO scraping');
console.log();
console.log('If Patricia has v1.0.3:');
console.log('   → Screenshot capture is broken in v1.0.3');
console.log('   → Need to fix the code and release v1.0.4');
console.log();

