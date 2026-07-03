/**
 * Create or update a demo lead in masterlead with the TEST phone number.
 * That number = Twilio "from" when we run send-test-inbound-call, so inbound
 * lookup finds this lead and shows "Demo Lead" in the modal and card.
 */
import { supabaseAdmin } from '../supabase';
import { TWILIO_PHONE_NUMBER } from '../hardcoded-config';

const DEMO_PHONE = TWILIO_PHONE_NUMBER || '+19142289324';

const DEMO_LEAD = {
  first_name: 'Demo',
  last_name: 'Lead',
  phone: DEMO_PHONE,
  city: 'Demo City',
  state: 'TX',
  taalk_market: 'Demo Market',
  taalk_lead_source: 'demo_inbound_test',
  cn_email: 'chrislafond@aoglobelife.com',
  cnresolution: 'pending',
  updated_at: new Date().toISOString(),
};

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  console.log('Demo phone number (use this for testing):', DEMO_PHONE);

  const { data: existing } = await supabaseAdmin
    .from('masterlead')
    .select('id, first_name, last_name, phone')
    .eq('phone', DEMO_PHONE)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from('masterlead')
      .update(DEMO_LEAD)
      .eq('id', existing.id);
    if (error) {
      console.error('Update failed:', error.message);
      process.exit(1);
    }
    console.log('✅ Updated existing demo lead id=', existing.id, DEMO_LEAD.first_name, DEMO_LEAD.last_name);
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from('masterlead')
      .insert(DEMO_LEAD)
      .select('id')
      .single();
    if (error) {
      console.error('Insert failed:', error.message);
      process.exit(1);
    }
    console.log('✅ Created demo lead id=', inserted?.id, DEMO_LEAD.first_name, DEMO_LEAD.last_name);
  }

  console.log('');
  console.log('Test with: npx tsx server/scripts/send-test-inbound-call.ts');
  console.log('Inbound From will be', DEMO_PHONE, '→ lead-by-phone will return this demo lead.');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
