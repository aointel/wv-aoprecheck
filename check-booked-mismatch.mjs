/**
 * Check for leads marked as booked in masterlead but missing booked events in agent_dial_metrics
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  const hardcodedConfigPath = join(__dirname, 'server', 'hardcoded-config.ts');
  try {
    const configContent = readFileSync(hardcodedConfigPath, 'utf-8');
    const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
    if (urlMatch && !supabaseUrl) supabaseUrl = urlMatch[1];
    const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
    if (keyMatch && !supabaseServiceKey) supabaseServiceKey = keyMatch[1];
  } catch (error) {}
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMismatch() {
  console.log('🔍 Checking for leads marked as booked but missing booked events...\n');
  
  // Get a sample of booked leads
  const { data: bookedLeads } = await supabase
    .from('masterlead')
    .select('id, phone, cn_email, cnresolution')
    .eq('cnresolution', 'booked')
    .limit(100);
  
  if (!bookedLeads || bookedLeads.length === 0) {
    console.log('No booked leads found');
    return;
  }
  
  console.log(`Found ${bookedLeads.length} booked leads, checking for dial events...\n`);
  
  let needsFix = 0;
  let hasValidBooked = 0;
  let hasDialButNotBooked = 0;
  
  for (const lead of bookedLeads) {
    // Check for booked events
    const { data: bookedEvents } = await supabase
      .from('agent_dial_metrics')
      .select('id, call_duration, disposition, event_type')
      .eq('lead_id', lead.id)
      .or('disposition.eq.booked,event_type.eq.booked')
      .gt('call_duration', 240);
    
    if (bookedEvents && bookedEvents.length > 0) {
      hasValidBooked++;
      continue;
    }
    
    // Check for dial events with valid duration
    const { data: dialEvents } = await supabase
      .from('agent_dial_metrics')
      .select('id, call_duration, disposition, event_type')
      .eq('lead_id', lead.id)
      .gt('call_duration', 240);
    
    if (dialEvents && dialEvents.length > 0) {
      const notBooked = dialEvents.filter(e => 
        !(e.disposition === 'booked' && e.event_type === 'booked')
      );
      
      if (notBooked.length > 0) {
        hasDialButNotBooked++;
        needsFix++;
        console.log(`⚠️  Lead ${lead.id} (${lead.phone}): Has dial event(s) with duration > 240s but not marked as booked`);
        notBooked.forEach(e => {
          console.log(`     Event ${e.id}: disposition=${e.disposition}, event_type=${e.event_type}, duration=${e.call_duration}s`);
        });
      }
    } else {
      needsFix++;
      console.log(`⚠️  Lead ${lead.id} (${lead.phone}): Marked as booked but no dial events with duration > 240s`);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total checked: ${bookedLeads.length}`);
  console.log(`   ✅ Has valid booked event: ${hasValidBooked}`);
  console.log(`   ⚠️  Has dial event but not booked: ${hasDialButNotBooked}`);
  console.log(`   ❌ Needs fix: ${needsFix}`);
}

checkMismatch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
