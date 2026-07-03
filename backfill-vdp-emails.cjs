require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillVDPEmails() {
  try {
    console.log('🔧 BACKFILLING VDP CALL EMAILS\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all VDP calls today with null company_email but has agent (associate_id)
    const { data: vdpCalls, error } = await supabase
      .from('vdp_calls')
      .select('id, agent, mga, company_email')
      .gte('updated_at', today.toISOString())
      .is('company_email', null)
      .not('agent', 'is', null);
    
    if (error) {
      console.error('❌ Error fetching VDP calls:', error);
      return;
    }
    
    console.log(`📊 Found ${vdpCalls?.length || 0} VDP calls today with null email but has agent\n`);
    
    if (!vdpCalls || vdpCalls.length === 0) {
      console.log('✅ All VDP calls already have emails!');
      return;
    }
    
    // Get all unique associate IDs
    const uniqueAssociateIds = [...new Set(vdpCalls.map(c => c.agent))];
    console.log(`👥 Looking up ${uniqueAssociateIds.length} unique associate IDs...\n`);
    
    // Build associate_id to email mapping
    const { data: producers, error: prodError } = await supabase
      .from('producerlist')
      .select('associate_id, company_email, agent_name')
      .in('associate_id', uniqueAssociateIds);
    
    if (prodError) {
      console.error('❌ Error fetching producers:', prodError);
      return;
    }
    
    const associateIdToEmail = {};
    (producers || []).forEach(p => {
      associateIdToEmail[p.associate_id] = p.company_email;
      console.log(`   ${p.associate_id} → ${p.company_email} (${p.agent_name})`);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 UPDATING VDP CALLS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const call of vdpCalls) {
      const email = associateIdToEmail[call.agent];
      
      if (!email) {
        console.log(`⚠️ Skipped: Agent ${call.agent} (${call.mga}) - no email found`);
        skippedCount++;
        continue;
      }
      
      const { error: updateError } = await supabase
        .from('vdp_calls')
        .update({
          company_email: email,
          updated_at: new Date().toISOString()
        })
        .eq('id', call.id);
      
      if (updateError) {
        console.error(`❌ Failed to update call ${call.id}:`, updateError);
      } else {
        updatedCount++;
        if (updatedCount % 10 === 0) {
          console.log(`   ✅ Updated ${updatedCount} calls...`);
        }
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 BACKFILL COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log(`📈 Total: ${vdpCalls.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Show breakdown by agent
    console.log('📊 BREAKDOWN BY PRODUCER:\n');
    const byAgent = {};
    vdpCalls.forEach(call => {
      const email = associateIdToEmail[call.agent];
      if (email) {
        byAgent[email] = (byAgent[email] || 0) + 1;
      }
    });
    
    Object.entries(byAgent)
      .sort((a, b) => b[1] - a[1])
      .forEach(([email, count]) => {
        console.log(`   ${email}: ${count} connects`);
      });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

backfillVDPEmails();


