/**
 * Verify oliviabergamo booked count is fixed
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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
  console.log('🔍 Verifying oliviabergamo@aoglobelife.com booked count...\n');
  
  // Check live call board
  const { data: boardData } = await supabase
    .from('live_call_boardt')
    .select('*')
    .eq('agent_email', 'oliviabergamo@aoglobelife.com')
    .single();
  
  if (boardData) {
    console.log('📊 Live Call Board:');
    console.log(`   today_dialed: ${boardData.today_dialed}`);
    console.log(`   today_reached: ${boardData.today_reached}`);
    console.log(`   today_booked: ${boardData.today_booked}`);
    console.log(`   updated_at: ${boardData.updated_at}\n`);
  }
  
  // Check agent_dial_metrics
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  
  const { data: bookedEvents } = await supabase
    .from('agent_dial_metrics')
    .select('*')
    .eq('agent_email', 'oliviabergamo@aoglobelife.com')
    .or('event_type.eq.booked,disposition.eq.booked')
    .gte('event_timestamp', yesterday.toISOString())
    .lt('event_timestamp', tomorrow.toISOString());
  
  console.log(`📊 Agent Dial Metrics:`);
  console.log(`   Total booked events: ${bookedEvents?.length || 0}`);
  
  if (bookedEvents && bookedEvents.length > 0) {
    const valid = bookedEvents.filter(e => {
      const hasCallSid = e.call_sid && e.call_sid.trim() !== '';
      const hasDuration = e.call_duration !== null && e.call_duration > 120;
      return hasCallSid && hasDuration;
    });
    console.log(`   Valid (has call_sid AND duration > 120): ${valid.length}`);
    console.log(`   Invalid: ${bookedEvents.length - valid.length}`);
  }
  
  console.log('\n✅ Verification complete!');
}

verify().catch(console.error);
