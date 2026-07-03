import { supabaseAdmin } from '../supabase';

const AGENT_EMAIL = 'dennleyvensyryussapini@aoglobelife.com';

async function resetAgentLeadsToPending() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not initialized');
    process.exit(1);
  }

  const normalizedEmail = AGENT_EMAIL.toLowerCase().trim();
  console.log(`🔄 Resetting all leads for ${normalizedEmail} to pending...`);

  // First, count how many leads we'll be updating
  const { count: cnEmailCount } = await supabaseAdmin
    .from('masterlead')
    .select('*', { count: 'exact', head: true })
    .eq('cn_email', normalizedEmail);

  const { count: previousEmailCount } = await supabaseAdmin
    .from('masterlead')
    .select('*', { count: 'exact', head: true })
    .eq('previous_cn_email', normalizedEmail);

  const totalCount = (cnEmailCount || 0) + (previousEmailCount || 0);
  console.log(`📊 Found ${cnEmailCount || 0} leads with cn_email, ${previousEmailCount || 0} with previous_cn_email (${totalCount} total)`);

  if (totalCount === 0) {
    console.log('✅ No leads found for this agent');
    process.exit(0);
  }

  // Update leads with cn_email matching
  let updated = 0;
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: batch, error } = await supabaseAdmin
      .from('masterlead')
      .select('id, cnresolution')
      .eq('cn_email', normalizedEmail)
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Error fetching leads:', error);
      break;
    }

    if (!batch || batch.length === 0) break;

    const { error: updateError } = await supabaseAdmin
      .from('masterlead')
      .update({
        cnresolution: 'pending',
        resolved_at: null,
        webhook_sent_at: null,
        disposition_notes: null,
        resolution_notes: null,
        appointment_date: null,
        appointment_type: null,
        appointment_details: null,
        callback_date: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', batch.map(l => l.id));

    if (updateError) {
      console.error('❌ Error updating leads:', updateError);
      break;
    }

    updated += batch.length;
    console.log(`✅ Updated ${updated} leads (batch of ${batch.length})...`);

    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  // Update leads with previous_cn_email matching
  offset = 0;
  while (true) {
    const { data: batch, error } = await supabaseAdmin
      .from('masterlead')
      .select('id, cnresolution')
      .eq('previous_cn_email', normalizedEmail)
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Error fetching leads:', error);
      break;
    }

    if (!batch || batch.length === 0) break;

    const { error: updateError } = await supabaseAdmin
      .from('masterlead')
      .update({
        cnresolution: 'pending',
        resolved_at: null,
        webhook_sent_at: null,
        disposition_notes: null,
        resolution_notes: null,
        appointment_date: null,
        appointment_type: null,
        appointment_details: null,
        callback_date: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', batch.map(l => l.id));

    if (updateError) {
      console.error('❌ Error updating leads:', updateError);
      break;
    }

    updated += batch.length;
    console.log(`✅ Updated ${updated} total leads (batch of ${batch.length} from previous_cn_email)...`);

    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`\n✅ Successfully reset ${updated} leads to pending for ${normalizedEmail}`);
}

// Run the script
resetAgentLeadsToPending().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
