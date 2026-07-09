require('dotenv').config();
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listCalls() {
  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const startDate = threeDaysAgo.toISOString().split('T')[0];

    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?StartTime>=${startDate}&PageSize=1000`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    const data = await response.json();
    const calls = data.calls || [];

    const outboundLong = calls.filter(c => 
      c.direction === 'outbound-dial' &&
      c.status === 'completed' &&
      parseInt(c.duration) >= 60
    );

    console.log(`🔥 ${outboundLong.length} OUTBOUND CALLS OVER 60 SECONDS\n`);

    // Get caller ID to email mapping
    const callerIds = [...new Set(outboundLong.map(c => c.from))];
    const { data: callLogs } = await supabase
      .from('twilio_call_logs')
      .select('from_number, owner_email')
      .in('from_number', callerIds);

    const callerMap = {};
    (callLogs || []).forEach(log => {
      callerMap[log.from_number] = log.owner_email;
    });

    // Get associate IDs
    const emails = [...new Set(Object.values(callerMap))];
    const { data: producers } = await supabase
      .from('producerlist')
      .select('company_email, associate_id')
      .in('company_email', emails);

    const assocMap = {};
    (producers || []).forEach(p => {
      assocMap[p.company_email] = p.associate_id;
    });

    // Get leads
    const phones = [...new Set(outboundLong.map(c => c.to.replace(/^\+1/, '')))];
    const { data: leads } = await supabase
      .from('masterlead')
      .select('taalk_lead_id, first_name, last_name, phone')
      .in('phone', phones)
      .not('taalk_lead_id', 'is', null);

    const leadMap = {};
    (leads || []).forEach(l => {
      leadMap[l.phone] = l;
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    outboundLong.forEach((call, i) => {
      const phone = call.to.replace(/^\+1/, '');
      const lead = leadMap[phone];
      const email = callerMap[call.from];
      const assocId = email ? assocMap[email] : null;

      const leadName = lead ? `${lead.first_name} ${lead.last_name}` : 'Unknown Lead';
      const leadId = lead?.taalk_lead_id || 'NO TAALK_LEAD_ID';
      const agentInfo = email ? `${email} → ${assocId || 'NO ASSOC_ID'}` : 'NO EMAIL';

      console.log(`${(i + 1).toString().padStart(2)}. ${leadName.padEnd(30)} | Lead ID: ${leadId.toString().padEnd(10)} | ${call.duration.toString().padStart(4)}s | ${agentInfo}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const valid = outboundLong.filter(c => {
      const phone = c.to.replace(/^\+1/, '');
      const lead = leadMap[phone];
      const email = callerMap[c.from];
      const assocId = email ? assocMap[email] : null;
      return lead && lead.taalk_lead_id && assocId && assocId !== '999';
    });

    console.log(`✅ READY TO SEND: ${valid.length}`);
    console.log(`⚠️  MISSING DATA: ${outboundLong.length - valid.length}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

listCalls();

