import { supabaseAdmin } from '../supabase.js';

/**
 * Transfer all leads assigned to associate_id 228095 TODAY to associate_id 213
 */
async function transferLeadsBetweenAssociates() {
  try {
    console.log('🚀 Starting lead transfer from associate_id 228095 to associate_id 213 (today only)...\n');

    // Step 1: Get agent email for associate_id 228095 (source)
    const { data: sourceAgent, error: sourceError } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email, associate_id, first_name, last_name')
      .eq('associate_id', 228095)
      .maybeSingle();

    if (sourceError) {
      console.error('❌ Error fetching source agent (228095):', sourceError);
      return;
    }

    if (!sourceAgent) {
      console.error('❌ No agent found with associate_id 228095');
      return;
    }

    const sourceEmail = (sourceAgent.company_email || sourceAgent.personal_email)?.toLowerCase().trim();
    if (!sourceEmail) {
      console.error('❌ Source agent (228095) has no email');
      return;
    }

    console.log(`📧 Source Agent (228095): ${sourceEmail} (${sourceAgent.first_name} ${sourceAgent.last_name})`);

    // Step 2: Get agent email for associate_id 213 (destination)
    const { data: destAgent, error: destError } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email, associate_id, first_name, last_name')
      .eq('associate_id', 213)
      .maybeSingle();

    if (destError) {
      console.error('❌ Error fetching destination agent (213):', destError);
      return;
    }

    if (!destAgent) {
      console.error('❌ No agent found with associate_id 213');
      return;
    }

    const destEmail = (destAgent.company_email || destAgent.personal_email)?.toLowerCase().trim();
    if (!destEmail) {
      console.error('❌ Destination agent (213) has no email');
      return;
    }

    console.log(`📧 Destination Agent (213): ${destEmail} (${destAgent.first_name} ${destAgent.last_name})`);

    // Step 3: Get TODAY's date (start and end of day in UTC)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    console.log(`\n📅 Searching for leads assigned TODAY (${todayStart.toISOString()} to ${todayEnd.toISOString()})`);

    // Step 4: Find all leads assigned to source agent TODAY
    // Get all leads assigned to source agent, then filter by date in JavaScript
    const { data: allLeads, error: leadsError } = await supabaseAdmin
      .from('masterlead')
      .select('id, first_name, last_name, phone, cn_email, assigned_date, last_assigned_date, taalk_lead_id, created_at')
      .eq('cn_email', sourceEmail)
      .order('assigned_date', { ascending: false, nullsFirst: false });

    if (leadsError) {
      console.error('❌ Error fetching leads:', leadsError);
      return;
    }

    if (!allLeads || allLeads.length === 0) {
      console.log('✅ No leads found assigned to associate_id 228095');
      return;
    }

    // Filter to only leads that were actually assigned TODAY
    const todayLeads = allLeads.filter((lead: any) => {
      const assignedDate = lead.assigned_date ? new Date(lead.assigned_date) : null;
      const lastAssignedDate = lead.last_assigned_date ? new Date(lead.last_assigned_date) : null;
      
      const assignedToday = assignedDate && assignedDate >= todayStart && assignedDate <= todayEnd;
      const lastAssignedToday = lastAssignedDate && lastAssignedDate >= todayStart && lastAssignedDate <= todayEnd;
      
      return assignedToday || lastAssignedToday;
    });

    console.log(`\n📊 Found ${todayLeads.length} leads assigned to ${sourceEmail} TODAY`);

    if (todayLeads.length === 0) {
      console.log('✅ No leads were assigned TODAY to associate_id 228095');
      return;
    }

    // Step 5: Update leads to destination agent
    const leadIds = todayLeads.map((lead: any) => lead.id);
    const now = new Date().toISOString();

    console.log(`\n🔄 Transferring ${leadIds.length} leads to ${destEmail} (associate_id 213)...`);

    const { data: updatedLeads, error: updateError } = await supabaseAdmin
      .from('masterlead')
      .update({
        cn_email: destEmail,
        previous_cn_email: sourceEmail,
        last_assigned_date: now,
        assigned_date: now,
        updated_at: now
      })
      .in('id', leadIds)
      .select('id, first_name, last_name, phone, cn_email');

    if (updateError) {
      console.error('❌ Error updating leads:', updateError);
      return;
    }

    console.log(`\n✅ SUCCESS! Transferred ${updatedLeads?.length || 0} leads from associate_id 228095 to associate_id 213`);
    console.log(`   Source: ${sourceEmail} (${sourceAgent.first_name} ${sourceAgent.last_name})`);
    console.log(`   Destination: ${destEmail} (${destAgent.first_name} ${destAgent.last_name})`);
    console.log(`   Date: ${todayStart.toISOString().split('T')[0]}`);

    // Show sample of transferred leads
    if (updatedLeads && updatedLeads.length > 0) {
      console.log(`\n📋 Sample of transferred leads (first 10):`);
      updatedLeads.slice(0, 10).forEach((lead: any, index: number) => {
        console.log(`   ${index + 1}. ${lead.first_name} ${lead.last_name} (${lead.phone}) - ID: ${lead.id}`);
      });
      if (updatedLeads.length > 10) {
        console.log(`   ... and ${updatedLeads.length - 10} more`);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  transferLeadsBetweenAssociates()
    .then(() => {
      console.log('\n✅ Transfer completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Transfer failed:', error);
      process.exit(1);
    });
}

export { transferLeadsBetweenAssociates };
