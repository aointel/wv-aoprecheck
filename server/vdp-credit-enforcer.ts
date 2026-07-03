/**
 * VDP Credit Enforcer
 * Automatically disables VDP for agents with credits <= -8
 * Runs every 10 minutes to ensure compliance
 */

import { supabaseAdmin } from './supabase';

const CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const CREDIT_LIMIT = 0; // Block ANY negative credits (0, -8, -10, -1000, etc.)

async function enforceVDPCredits() {
  console.log(`\n💰 [${new Date().toLocaleTimeString()}] Checking VDP credit limits...`);
  
  try {
    // Get all agents with VDP ACTIVE
    const { data: activeAgents, error: agentsError } = await supabaseAdmin
      .from('customers')
      .select('company_email, VDPACTIVE, associate_id')
      .eq('VDPACTIVE', 'ACTIVE')
      .not('company_email', 'is', null);
    
    if (agentsError) {
      console.error('❌ Error fetching active VDP agents:', agentsError);
      return;
    }
    
    if (!activeAgents || activeAgents.length === 0) {
      console.log('✅ No active VDP agents to check');
      return;
    }
    
    console.log(`📊 Checking ${activeAgents.length} active VDP agents...`);
    
    let disabledCount = 0;
    let checkedCount = 0;
    
    for (const agent of activeAgents) {
      if (!agent.company_email) continue;
      
      // Get agent credits
      const { data: credits } = await supabaseAdmin
        .from('user_credits')
        .select('credits_remaining')
        .eq('email', agent.company_email.trim())
        .maybeSingle();
      
      const creditsRemaining = credits?.credits_remaining || 0;
      checkedCount++;
      
      // If credits are NEGATIVE (ANY negative number), disable VDP
      if (creditsRemaining < 0) {
        console.log(`🚫 Disabling VDP for ${agent.company_email} (${creditsRemaining} credits - NEGATIVE)`);
        
        await supabaseAdmin
          .from('customers')
          .update({ VDPACTIVE: 'INACTIVE' })
          .eq('company_email', agent.company_email);
        
        disabledCount++;
      }
    }
    
    console.log(`\n📊 VDP Credit Enforcement Summary:`);
    console.log(`  ✅ Checked: ${checkedCount} agents`);
    console.log(`  🚫 Disabled: ${disabledCount} agents`);
    console.log(`  💰 Credit limit: ${CREDIT_LIMIT}`);
    
  } catch (error) {
    console.error('❌ VDP credit enforcement error:', error);
  }
}

let enforcerInterval: NodeJS.Timeout | null = null;

export const vdpCreditEnforcer = {
  start: () => {
    if (enforcerInterval) {
      console.log('⚠️ VDP credit enforcer already running');
      return;
    }
    
    console.log('⏱️ Starting VDP credit enforcer (checks every 10 minutes)...');
    
    // Run immediately on start
    enforceVDPCredits();
    
    // Then run every 10 minutes
    enforcerInterval = setInterval(enforceVDPCredits, CHECK_INTERVAL);
  },
  
  stop: () => {
    if (enforcerInterval) {
      clearInterval(enforcerInterval);
      enforcerInterval = null;
      console.log('🛑 VDP credit enforcer stopped');
    }
  }
};

