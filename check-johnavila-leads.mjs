/**
 * Check all masterlead records for johnavila@aoglobelife.com to see what resolutions exist
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const AGENT_EMAIL = 'johnavila@aoglobelife.com';

async function checkLeads() {
  console.log('\n🔍 CHECKING MASTERLEAD RECORDS FOR johnavila@aoglobelife.com\n');
  
  // Check all records for this email (any resolution)
  const { data: allLeads, error } = await supabase
    .from('masterlead')
    .select('id, taalk_lead_id, first_name, last_name, phone, cn_email, cnresolution, last_contacted, created_at')
    .ilike('cn_email', `%${AGENT_EMAIL}%`)
    .order('last_contacted', { ascending: false })
    .limit(100);

  if (error) {
    console.error('❌ Error fetching leads:', error);
    return;
  }

  if (!allLeads || allLeads.length === 0) {
    console.log('⚠️  No leads found for this email pattern');
    return;
  }

  console.log(`📋 Found ${allLeads.length} total leads\n`);

  // Group by resolution
  const byResolution = {};
  allLeads.forEach(lead => {
    const resolution = lead.cnresolution || 'null';
    if (!byResolution[resolution]) {
      byResolution[resolution] = [];
    }
    byResolution[resolution].push(lead);
  });

  console.log('📊 Breakdown by Resolution:');
  Object.keys(byResolution).forEach(resolution => {
    console.log(`   - ${resolution}: ${byResolution[resolution].length} leads`);
  });

  const bookedLeads = allLeads.filter(l => l.cnresolution === 'booked');
  if (bookedLeads.length > 0) {
    console.log(`\n📋 Found ${bookedLeads.length} booked leads:\n`);
    bookedLeads.slice(0, 10).forEach(lead => {
      console.log(`   - ID: ${lead.id} | ${lead.first_name} ${lead.last_name} | taalk_lead_id: ${lead.taalk_lead_id || 'N/A'} | Resolution: ${lead.cnresolution}`);
    });
    if (bookedLeads.length > 10) {
      console.log(`   ... and ${bookedLeads.length - 10} more`);
    }
  }

  // Show sample of what cn_email looks like
  console.log('\n📧 Sample cn_email values (first 5):');
  allLeads.slice(0, 5).forEach(lead => {
    console.log(`   - "${lead.cn_email}"`);
  });
}

checkLeads()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
