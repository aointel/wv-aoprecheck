/**
 * Fix Script: Create or update customer record for an agent
 * 
 * This script creates a customer record in the customers table if the agent
 * exists in other tables (producerlist, agent_profiles, user_credits) but
 * is missing from customers table.
 * 
 * Run with: tsx server/fix-agent-customer-record.ts <agent-email> [--markets="Market1,Market2"] [--states="State1,State2"]
 * 
 * Example: tsx server/fix-agent-customer-record.ts wallacejohnson@aoglobelife.com --markets="Veteran,Senior" --states="TX,CA"
 */

import { supabaseAdmin } from './supabase';

const AGENT_EMAIL = process.argv[2];

if (!AGENT_EMAIL) {
  console.error('❌ Usage: tsx server/fix-agent-customer-record.ts <agent-email> [--markets="Market1,Market2"] [--states="State1,State2"]');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
let markets: string[] = [];
let states: string[] = [];

for (const arg of args) {
  if (arg.startsWith('--markets=')) {
    markets = arg.split('=')[1].split(',').map(m => m.trim()).filter(m => m);
  } else if (arg.startsWith('--states=')) {
    states = arg.split('=')[1].split(',').map(s => s.trim()).filter(s => s);
  }
}

async function fixAgentCustomerRecord() {
  console.log(`\n🔧 FIXING CUSTOMER RECORD FOR: ${AGENT_EMAIL}\n`);
  console.log('='.repeat(80));
  
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  // Check if customer record already exists
  const { data: existingCustomer } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('company_email', AGENT_EMAIL)
    .maybeSingle();
  
  if (existingCustomer) {
    console.log(`✅ Customer record already exists!`);
    console.log(`   ID: ${existingCustomer.id}`);
    console.log(`   Associate ID: ${existingCustomer.associate_id || 'N/A'}`);
    console.log(`   Market: ${JSON.stringify(existingCustomer.market || [])}`);
    console.log(`   States: ${JSON.stringify(existingCustomer.states || [])}`);
    
    // Update if markets/states provided
    if (markets.length > 0 || states.length > 0) {
      const updateData: any = {};
      if (markets.length > 0) {
        updateData.market = markets; // Note: column is 'market' not 'markets'
        console.log(`\n   Updating market to: ${markets.join(', ')}`);
      }
      if (states.length > 0) {
        updateData.states = states;
        console.log(`   Updating states to: ${states.join(', ')}`);
      }
      
      const { error: updateError } = await supabaseAdmin
        .from('customers')
        .update(updateData)
        .eq('id', existingCustomer.id);
      
      if (updateError) {
        console.error(`   ❌ Error updating customer record:`, updateError);
        process.exit(1);
      } else {
        console.log(`   ✅ Customer record updated successfully!`);
      }
    }
    
    return;
  }

  // Gather info from other tables
  console.log(`📋 Gathering agent information from other tables...\n`);
  
  let firstName = '';
  let lastName = '';
  let associateId: number | null = null;
  let foundInTables: string[] = [];
  
  // Check producerlist
  const { data: producer } = await supabaseAdmin
    .from('producerlist')
    .select('*')
    .eq('company_email', AGENT_EMAIL)
    .maybeSingle();
  
  if (producer) {
    console.log(`✅ Found in producerlist table`);
    firstName = producer.first_name || firstName;
    lastName = producer.last_name || lastName;
    associateId = producer.associate_id || associateId;
    foundInTables.push('producerlist');
  }
  
  // Check agent_profiles
  const { data: agentProfile } = await supabaseAdmin
    .from('agent_profiles')
    .select('*')
    .eq('email', AGENT_EMAIL)
    .maybeSingle();
  
  if (agentProfile) {
    console.log(`✅ Found in agent_profiles table`);
    firstName = agentProfile.first_name || firstName;
    lastName = agentProfile.last_name || lastName;
    associateId = agentProfile.associate_id || agentProfile.agent_id || associateId;
    foundInTables.push('agent_profiles');
  }
  
  // Check user_credits
  const { data: userCredit } = await supabaseAdmin
    .from('user_credits')
    .select('*')
    .eq('email', AGENT_EMAIL)
    .maybeSingle();
  
  if (userCredit) {
    console.log(`✅ Found in user_credits table`);
    if (userCredit.name) {
      const nameParts = userCredit.name.split(' ');
      firstName = nameParts[0] || firstName;
      lastName = nameParts.slice(1).join(' ') || lastName;
    }
    associateId = userCredit.associate_id || associateId;
    foundInTables.push('user_credits');
  }
  
  if (foundInTables.length === 0) {
    console.log(`\n⚠️ Agent not found in any table (producerlist, agent_profiles, user_credits)`);
    console.log(`   Will create customer record with minimal information (email only).`);
    console.log(`   You'll need to update markets/states manually or via command line.`);
    
    // Extract name from email if possible
    const emailParts = AGENT_EMAIL.split('@')[0].split('.');
    if (emailParts.length >= 2) {
      firstName = emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1);
      lastName = emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1);
      console.log(`   Inferred name from email: ${firstName} ${lastName}`);
    }
  }
  
  console.log(`\n📝 Creating customer record with:`);
  console.log(`   Email: ${AGENT_EMAIL}`);
  console.log(`   Name: ${firstName} ${lastName}`);
  console.log(`   Associate ID: ${associateId || 'N/A'}`);
  console.log(`   Market (array): ${markets.length > 0 ? markets.join(', ') : '[] (empty - will need to be configured)'}`);
  console.log(`   States (array): ${states.length > 0 ? states.join(', ') : '[] (empty - will need to be configured)'}`);
  
  // Create customer record (using correct column names from auth-service.ts)
  const customerData: any = {
    company_email: AGENT_EMAIL,
    personal_email: AGENT_EMAIL,
    first_name: firstName,
    last_name: lastName,
    agent_name: `${firstName} ${lastName}`.trim() || AGENT_EMAIL.split('@')[0],
    market: markets.length > 0 ? markets : [], // Note: column is 'market' not 'markets'
    states: states.length > 0 ? states : [],
    VDPACTIVE: 'INACTIVE',
    PLUSACTIVE: 'INACTIVE',
    RECRUITACTIVE: 'INACTIVE',
    AOICONNECT: 'INACTIVE',
    CCPRO: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  if (associateId) {
    customerData.associate_id = associateId;
  }
  
  const { data: newCustomer, error: createError } = await supabaseAdmin
    .from('customers')
    .insert(customerData)
    .select()
    .single();
  
  if (createError) {
    console.error(`\n❌ Error creating customer record:`, createError);
    process.exit(1);
  }
  
  console.log(`\n✅ SUCCESS! Customer record created:`);
  console.log(`   ID: ${newCustomer.id}`);
  console.log(`   Email: ${newCustomer.company_email}`);
  console.log(`   Name: ${newCustomer.first_name} ${newCustomer.last_name}`);
  console.log(`   Associate ID: ${newCustomer.associate_id || 'N/A'}`);
  console.log(`   Market: ${JSON.stringify(newCustomer.market || [])}`);
  console.log(`   States: ${JSON.stringify(newCustomer.states || [])}`);
  
  if (markets.length === 0 && states.length === 0) {
    console.log(`\n⚠️ WARNING: No markets or states configured!`);
    console.log(`   The agent will NOT receive leads until markets/states are configured.`);
    console.log(`   Update the record with:`);
    console.log(`   tsx server/fix-agent-customer-record.ts ${AGENT_EMAIL} --markets="Market1,Market2" --states="State1,State2"`);
  } else {
    console.log(`\n✅ Agent should now be eligible for lead assignment!`);
    console.log(`   Run the diagnostic again to verify:`);
    console.log(`   tsx server/diagnose-agent-leads.ts ${AGENT_EMAIL}`);
  }
  
  console.log(`\n` + '='.repeat(80) + `\n`);
}

// Run the fix
fixAgentCustomerRecord()
  .then(() => {
    console.log('✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });








