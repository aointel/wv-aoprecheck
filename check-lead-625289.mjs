/**
 * Check lead 625289 specifically
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

async function checkLead() {
  const leadId = 625289;
  
  console.log(`🔍 Checking lead ${leadId}...\n`);
  
  // Check masterlead
  const { data: lead, error: leadError } = await supabase
    .from('masterlead')
    .select('id, phone, cn_email, cnresolution, first_name, last_name, state')
    .eq('id', leadId)
    .single();
  
  if (leadError) {
    console.error('❌ Error fetching lead:', leadError);
    return;
  }
  
  console.log('📋 Masterlead:', lead);
  console.log(`   Resolution: ${lead.cnresolution}\n`);
  
  // Check all dial metrics for this lead
  const { data: dialMetrics, error: metricsError } = await supabase
    .from('agent_dial_metrics')
    .select('id, event_type, disposition, call_duration, call_sid, agent_email, lead_phone, event_timestamp')
    .eq('lead_id', leadId)
    .order('event_timestamp', { ascending: false });
  
  if (metricsError) {
    console.error('❌ Error fetching dial metrics:', metricsError);
    return;
  }
  
  console.log(`📊 Found ${dialMetrics?.length || 0} dial metrics:`);
  dialMetrics?.forEach(m => {
    console.log(`   ID: ${m.id}, Type: ${m.event_type}, Disposition: ${m.disposition}, Duration: ${m.call_duration}s, SID: ${m.call_sid || 'null'}`);
  });
  
  // Find the one with duration 442
  const targetEvent = dialMetrics?.find(m => m.call_duration === 442);
  
  if (targetEvent) {
    console.log(`\n🎯 Found target event: ${targetEvent.id}`);
    console.log(`   Current: disposition=${targetEvent.disposition}, event_type=${targetEvent.event_type}`);
    
    if (targetEvent.disposition !== 'booked' || targetEvent.event_type !== 'booked') {
      console.log(`\n✅ Updating to booked...`);
      const { error: updateError } = await supabase
        .from('agent_dial_metrics')
        .update({
          disposition: 'booked',
          event_type: 'booked'
        })
        .eq('id', targetEvent.id);
      
      if (updateError) {
        console.error('❌ Update error:', updateError);
      } else {
        console.log('✅ Successfully updated!');
      }
    } else {
      console.log('✅ Already booked');
    }
  } else {
    console.log('\n⚠️  No event with duration 442 found');
  }
}

checkLead()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
