// DISABLED: Generic reassign hotleads script - no longer Chris-specific
// import { supabaseAdmin } from './supabase.js';

async function reassignHotleads() {
  console.log('⚠️ Reassign hotleads script disabled - was Chris-specific');
  return;
  /*
  try {
    console.log('🔄 Reassigning hotleads from source to target...');
    
    // Update hotleads in masterlead table
    const { data: updated, error } = await supabaseAdmin
      .from('masterlead')
      .update({ cn_email: 'cnsysop@aoglobelife.com' })
      .eq('cn_email', 'chrislafond@aoglobelife.com')
      .eq('is_hot_lead', true);

    if (error) {
      console.error('❌ Error reassigning hotleads:', error);
      return;
    }

    console.log('✅ Successfully reassigned hotleads:', updated?.length || 0);
    
    // Verify the change
    const { data: newLeads, error: checkError } = await supabaseAdmin
      .from('masterlead')
      .select('*')
      .eq('cn_email', 'cnsysop@aoglobelife.com')
      .eq('is_hot_lead', true);

    if (checkError) {
      console.error('❌ Error checking reassigned hotleads:', checkError);
      return;
    }

    console.log(`🎯 Now cnsysop@aoglobelife.com has ${newLeads?.length || 0} hotleads`);
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

  } catch (error) {
    console.error('❌ Script error:', error);
  }
  */
}

// reassignHotleads(); // Disabled