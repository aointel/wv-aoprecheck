// Manual test script to demonstrate hotlead to masterlead transfer
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljeno3Rmd4d2djdGpydHplZXl0dCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU0NDcxMjEzLCJleHAiOjIwNzAwNDcyMTN9.hOIcZKpOjRc5S1wLgODjLPxGl7EzABaNmqpwWu0U-3U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLeadTransfer() {
  console.log('🔍 Testing lead transfer from hotleads to masterlead...');
  
  try {
    // Get FRANK (ID 44) from hotleads
    const { data: hotlead, error: hotleadError } = await supabase
      .from('hotleads')
      .select('*')
      .eq('id', '44')
      .single();
    
    if (hotleadError) {
      console.error('❌ Error getting hotlead:', hotleadError);
      return;
    }
    
    if (!hotlead) {
      console.log('⚠️ Hotlead 44 not found (may have been transferred already)');
      return;
    }
    
    console.log('📊 Found hotlead:', hotlead.first_name, hotlead.last_name);
    
    // Get Chris's associate_id (simulation - normally from customers table)
    const associateId = 'TEST123'; // Simulated associate ID
    const agentEmail = 'chrislafond@aoglobelife.com';
    
    // Insert into masterlead table
    const { data: insertResult, error: insertError } = await supabase
      .from('masterlead')
      .insert({
        first_name: hotlead.first_name,
        last_name: hotlead.last_name,
        phone: hotlead.phone,
        email: hotlead.email || hotlead.taalk_email,
        city: hotlead.city || hotlead.taalk_city,
        state: hotlead.state || hotlead.taalk_state,
        zip: hotlead.zip,
        address: hotlead.address || hotlead.taalk_address,
        cn_email: agentEmail,
        market: 'Hot Lead',
        group_name: hotlead.taalk_groupname || 'Hot Lead',
        group_code: hotlead.taalk_group_code || 'HOT',
        beneficiary: hotlead.taalk_beneficiary || '',
        relationship: hotlead.taalk_relationship || '',
        referred_by: hotlead.taalk_reffered || '',
        sponsor_org: hotlead.taalk_sponsor_org || '',
        status: 'IN_PROGRESS',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Failed to insert into masterlead:', insertError);
      return;
    }
    
    console.log('✅ Successfully transferred to masterlead:', insertResult?.id);
    
    // Send to Zapier webhook
    const zapierPayload = {
      associate_id: associateId,
      leadId: hotlead.id,
      agentEmail: agentEmail,
      duration: 125,
      autoAssigned: true,
      reason: 'manual_test_transfer',
      assignedAt: new Date().toISOString(),
      transferred: true,
      newMasterleadId: insertResult?.id
    };
    
    console.log('📤 Sending to Zapier webhook...');
    
    const response = await fetch('https://hooks.zapier.com/hooks/catch/2467580/u6o3xar/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zapierPayload)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Zapier webhook success:', result);
    } else {
      console.error('❌ Zapier webhook failed:', response.status);
    }
    
    // Remove from hotleads table
    const { error: deleteError } = await supabase
      .from('hotleads')
      .delete()
      .eq('id', hotlead.id);
    
    if (deleteError) {
      console.error('❌ Failed to remove from hotleads:', deleteError);
    } else {
      console.log('✅ Successfully removed from hotleads table');
    }
    
    console.log('🎉 Lead transfer complete!');
    
  } catch (error) {
    console.error('❌ Transfer failed:', error);
  }
}

testLeadTransfer();