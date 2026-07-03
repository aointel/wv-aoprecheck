import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getLastWebhooks() {
  try {
    console.log('🔍 Checking last 10 Planet ALTIG webhook sends...\n');
    
    const { data: webhooks, error } = await supabase
      .from('hotlead_webhooks')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Error:', error);
      // Fallback to call_logs
      const { data: booked } = await supabase
        .from('call_logs')
        .select('id, agent_email, lead_name, lead_phone, disposition, created_at')
        .or('disposition.eq.booked,disposition.eq.Meet')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (booked) {
        console.log(`📋 Last 10 "booked" dispositions:\n`);
        booked.forEach((call, i) => {
          console.log(`${i+1}. ${call.agent_email} - ${call.lead_name} (${call.lead_phone})`);
          console.log(`   ${call.disposition} at ${call.created_at}\n`);
        });
      }
      return;
    }
    
    if (!webhooks || webhooks.length === 0) {
      console.log('⚠️  No webhooks found. Checking booked dispositions...\n');
      const { data: booked } = await supabase
        .from('call_logs')
        .select('id, agent_email, lead_name, lead_phone, disposition, created_at')
        .or('disposition.eq.booked,disposition.eq.Meet')
        .order('created_at', { ascending: false })
        .limit(10);
      
      booked?.forEach((call, i) => {
        console.log(`${i+1}. ${call.agent_email} - ${call.lead_name}`);
        console.log(`   ${call.disposition} at ${call.created_at}\n`);
      });
      return;
    }
    
    console.log(`📋 Last ${webhooks.length} Planet webhooks:\n`);
    webhooks.forEach((w, i) => {
      console.log(`${i+1}. Agent: ${w.agent_email}`);
      console.log(`   Lead ID: ${w.hotlead_id || w.lead_id}`);
      console.log(`   Time: ${w.sent_at || w.created_at}`);
      console.log(`   Status: ${w.webhook_status}`);
      if (w.webhook_payload) {
        const p = typeof w.webhook_payload === 'string' ? JSON.parse(w.webhook_payload) : w.webhook_payload;
        console.log(`   Payload: lead_id=${p.lead_id}, associate_id=${p.associate_id}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

getLastWebhooks();

