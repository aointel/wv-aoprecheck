/**
 * Diagnostic script to identify why VDP is not loading for specific agents
 * Usage: npx tsx diagnose-vdp-loading.ts <email>
 */

import { createClient } from '@supabase/supabase-js';
import { HARDCODED_CONFIG } from './server/hardcoded-config.js';

const supabase = createClient(HARDCODED_CONFIG.SUPABASE_URL, HARDCODED_CONFIG.SUPABASE_SERVICE_KEY);

async function diagnoseVDPLoading(email: string) {
  console.log(`\n🔍 DIAGNOSING VDP LOADING ISSUE FOR: ${email}\n`);
  console.log('='.repeat(60));
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // 1. Check customer record
  console.log('\n1️⃣ Checking customer record...');
  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .select('id, associate_id, first_name, last_name, company_email, personal_email, VDPACTIVE')
    .or(`company_email.ilike.${normalizedEmail},personal_email.ilike.${normalizedEmail}`);
  
  if (customerError) {
    console.error('   ❌ Error querying customers:', customerError);
  } else if (!customers || customers.length === 0) {
    console.error('   ❌ Customer record NOT FOUND');
    console.log('   💡 Fix: Add user to customers table with company_email or personal_email');
    return;
  } else {
    // Handle multiple records
    const customer = customers.length === 1 ? customers[0] : 
                     customers.find(c => c.associate_id && !String(c.associate_id).startsWith('333')) || 
                     customers[0];
    
    if (customers.length > 1) {
      console.warn(`   ⚠️ Multiple customer records found (${customers.length} records) - this can cause issues`);
      console.log(`   Selected record: ID=${customer.id}, associate_id=${customer.associate_id}`);
    }
    console.log('   ✅ Customer record found:');
    console.log(`      - ID: ${customer.id}`);
    console.log(`      - Associate ID: ${customer.associate_id || '❌ MISSING'}`);
    console.log(`      - VDPACTIVE: ${customer.VDPACTIVE || 'NULL'}`);
    console.log(`      - Name: ${customer.first_name} ${customer.last_name}`);
    
    if (!customer.associate_id) {
      console.error('   ❌ BLOCKER: Missing associate_id');
      console.log('   💡 Fix: Update customers table to set associate_id');
    }
    
    if (customer.associate_id && String(customer.associate_id).startsWith('333')) {
      console.error('   ❌ BLOCKER: Fake associate_id detected (starts with 333)');
      console.log('   💡 Fix: Update customers table with real associate_id');
    }
    
    if (customer.VDPACTIVE !== 'ACTIVE' && customer.VDPACTIVE !== 'true') {
      console.warn(`   ⚠️ VDPACTIVE is "${customer.VDPACTIVE}" (should be "ACTIVE" or "true")`);
    }
  }
  
  // 2. Check user_credits
  console.log('\n2️⃣ Checking user_credits...');
  const { data: credits, error: creditsError } = await supabase
    .from('user_credits')
    .select('email, credits_remaining, credits_purchased, credits_used')
    .eq('email', normalizedEmail)
    .maybeSingle();
  
  if (creditsError) {
    console.error('   ❌ Error querying user_credits:', creditsError);
  } else if (!credits) {
    console.warn('   ⚠️ user_credits record NOT FOUND (will be auto-created)');
  } else {
    console.log('   ✅ user_credits record found:');
    console.log(`      - Credits Remaining: ${credits.credits_remaining}`);
    console.log(`      - Credits Purchased: ${credits.credits_purchased || 0}`);
    console.log(`      - Credits Used: ${credits.credits_used || 0}`);
    
    if (credits.credits_remaining < 0) {
      console.error(`   ❌ BLOCKER: Negative credits (${credits.credits_remaining})`);
      console.log('   💡 Fix: Add credits to user_credits table');
    } else if (credits.credits_remaining <= -2) {
      console.error(`   ❌ BLOCKER: Credits too low (${credits.credits_remaining} <= -2)`);
      console.log('   💡 Fix: Add credits to user_credits table');
    } else {
      console.log('   ✅ Credits sufficient');
    }
  }
  
  // 3. Check agent_profiles (for disclaimer - though removed, check anyway)
  console.log('\n3️⃣ Checking agent_profiles...');
  const { data: profile, error: profileError } = await supabase
    .from('agent_profiles')
    .select('email, vdp_missed_call_disclaimer_accepted_at')
    .eq('email', normalizedEmail)
    .maybeSingle();
  
  if (profileError) {
    console.warn('   ⚠️ Error querying agent_profiles (non-critical):', profileError);
  } else if (!profile) {
    console.log('   ℹ️ No agent_profiles record (not required - disclaimers removed)');
  } else {
    console.log('   ✅ agent_profiles record found');
    console.log(`      - Disclaimer accepted: ${profile.vdp_missed_call_disclaimer_accepted_at ? 'Yes' : 'No (not required)'}`);
  }
  
  // 4. Test API endpoint
  console.log('\n4️⃣ Testing /api/vdp/routing endpoint...');
  try {
    const response = await fetch('http://localhost:5001/api/vdp/routing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ API endpoint returned success:');
      console.log(`      - Associate ID: ${data.associate_id || '❌ MISSING'}`);
      console.log(`      - States: ${data.states?.length || 0} states`);
      console.log(`      - Market: ${data.market || 'N/A'}`);
      console.log(`      - VDP Active: ${data.vdpActive || 'N/A'}`);
      
      if (!data.associate_id) {
        console.error('   ❌ BLOCKER: API returned no associate_id');
      }
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`   ❌ API endpoint returned error (${response.status}):`);
      console.error(`      - Error: ${errorData.error || 'Unknown'}`);
      console.error(`      - Message: ${errorData.message || 'No message'}`);
      
      if (errorData.error === 'VDP_BLOCKED_INSUFFICIENT_CREDITS') {
        console.error(`   ❌ BLOCKER: Insufficient credits (${errorData.creditsRemaining || 0})`);
      }
    }
  } catch (error) {
    console.error('   ❌ Failed to test API endpoint (is server running?):', error);
  }
  
  // 5. Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 SUMMARY:\n');
  
  const blockers: string[] = [];
  if (!customer) blockers.push('Missing customer record');
  if (customer && !customer.associate_id) blockers.push('Missing associate_id in customers table');
  if (customer && customer.associate_id && String(customer.associate_id).startsWith('333')) {
    blockers.push('Fake associate_id (starts with 333)');
  }
  if (credits && credits.credits_remaining < 0) {
    blockers.push(`Negative credits (${credits.credits_remaining})`);
  }
  
  if (blockers.length === 0) {
    console.log('✅ No obvious blockers found. VDP should load.');
    console.log('   💡 Check browser console for JavaScript errors');
    console.log('   💡 Check if TaalkVDP script is loading (https://lets.taalk.ai/sdk/vdp_client/michaelmandella)');
    console.log('   💡 Check network tab for failed API requests');
  } else {
    console.log('❌ BLOCKERS FOUND:');
    blockers.forEach((blocker, i) => {
      console.log(`   ${i + 1}. ${blocker}`);
    });
  }
  
  console.log('\n');
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error('❌ Usage: npx tsx diagnose-vdp-loading.ts <email>');
  process.exit(1);
}

diagnoseVDPLoading(email).catch(console.error);
