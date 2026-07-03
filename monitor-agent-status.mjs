// Real-time monitor for agent_live_call_status table
// Usage: node monitor-agent-status.mjs
// This will query Supabase every 5 seconds to show updates

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

let lastUpdateTime = null;

async function checkStatus() {
  try {
    const { data, error } = await supabase
      .from('agent_live_call_status')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('❌ Error querying Supabase:', error);
      return;
    }

    // Clear screen (works on most terminals)
    process.stdout.write('\x1B[2J\x1B[0f');
    
    console.log('🔍 Monitoring agent_live_call_status table');
    console.log(`⏰ Last check: ${new Date().toLocaleString()}`);
    console.log('='.repeat(80));
    console.log('');

    if (!data || data.length === 0) {
      console.log('⚠️  No records found in agent_live_call_status table');
      console.log('');
      console.log('💡 Make sure:');
      console.log('   1. An agent with CCPRO = true is sending heartbeats');
      console.log('   2. The table exists (run create-agent-live-call-status-table.sql)');
      console.log('');
      return;
    }

    console.log(`📊 Found ${data.length} record(s)\n`);

    data.forEach((record, index) => {
      const timeSinceUpdate = Math.floor((Date.now() - new Date(record.updated_at).getTime()) / 1000);
      const isNew = lastUpdateTime && new Date(record.updated_at) > lastUpdateTime;
      const indicator = isNew ? '🆕' : '  ';
      
      console.log(`${indicator} ${index + 1}. ${record.agent_email}`);
      console.log(`     Status: ${record.status}`);
      console.log(`     Last Update: ${record.updated_at} (${timeSinceUpdate}s ago)`);
      console.log(`     Last Heartbeat: ${record.last_heartbeat_at}`);
      console.log('');
    });

    // Update last check time
    if (data.length > 0) {
      lastUpdateTime = new Date(data[0].updated_at);
    }

    console.log('Press Ctrl+C to stop monitoring');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Check immediately, then every 5 seconds
checkStatus();
setInterval(checkStatus, 5000);

