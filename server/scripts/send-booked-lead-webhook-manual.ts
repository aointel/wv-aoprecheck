import { supabaseAdmin } from '../supabase';

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

async function sendBookedLeadWebhookManual(leadId: number, agentEmail: string) {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not initialized');
    process.exit(1);
  }

  // Get the lead
  const { data: lead, error: leadError } = await supabaseAdmin
    .from('masterlead')
    .select('id, taalk_lead_id, cnresolution')
    .eq('id', leadId)
    .maybeSingle();

  if (leadError) {
    console.error('❌ Error fetching lead:', leadError);
    process.exit(1);
  }

  if (!lead) {
    console.error(`❌ Lead ${leadId} not found`);
    process.exit(1);
  }

  if (!lead.taalk_lead_id) {
    console.error(`❌ Lead ${leadId} has no taalk_lead_id`);
    process.exit(1);
  }

  console.log(`🔍 Resolving associate_id for agent: ${agentEmail}`);

  // Get associate_id for the agent
  const { data: agent } = await supabaseAdmin
    .from('customers')
    .select('associate_id')
    .eq('company_email', agentEmail.toLowerCase().trim())
    .limit(1)
    .maybeSingle();

  if (!agent?.associate_id) {
    // Try personal email
    const { data: agentPersonal } = await supabaseAdmin
      .from('customers')
      .select('associate_id')
      .eq('personal_email', agentEmail.toLowerCase().trim())
      .limit(1)
      .maybeSingle();

    if (!agentPersonal?.associate_id) {
      console.error(`❌ No associate_id found for agent ${agentEmail}`);
      process.exit(1);
    }

    const payload = {
      lead_id: lead.taalk_lead_id.toString(),
      associate_id: agentPersonal.associate_id
    };

    console.log(`📤 Sending webhook for lead ${leadId} (taalk_lead_id: ${lead.taalk_lead_id}, associate_id: ${agentPersonal.associate_id}, agent: ${agentEmail})`);

    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`✅ Webhook sent successfully for lead ${leadId}`);
    } else {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ Webhook failed: ${response.status} - ${errorText}`);
      process.exit(1);
    }
  } else {
    const payload = {
      lead_id: lead.taalk_lead_id.toString(),
      associate_id: agent.associate_id
    };

    console.log(`📤 Sending webhook for lead ${leadId} (taalk_lead_id: ${lead.taalk_lead_id}, associate_id: ${agent.associate_id}, agent: ${agentEmail})`);

    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`✅ Webhook sent successfully for lead ${leadId}`);
    } else {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ Webhook failed: ${response.status} - ${errorText}`);
      process.exit(1);
    }
  }
}

const leadId = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const agentEmail = process.argv[3] || null;

if (!leadId || isNaN(leadId)) {
  console.error('❌ Usage: npx tsx send-booked-lead-webhook-manual.ts <lead_id> <agent_email>');
  process.exit(1);
}

if (!agentEmail) {
  console.error('❌ Usage: npx tsx send-booked-lead-webhook-manual.ts <lead_id> <agent_email>');
  process.exit(1);
}

sendBookedLeadWebhookManual(leadId, agentEmail).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
