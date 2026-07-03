#!/usr/bin/env node

/**
 * Test script to check what carringtonhanna@aoglobelife.com sees when visiting /connect
 * Tests Call Connector Pro access check and simulates the user experience
 */

const email = 'carringtonhanna@aoglobelife.com';
const baseUrl = process.env.API_URL || 'http://localhost:5000';

console.log('🧪 Testing Call Connector Pro Access for:', email);
console.log('📍 Base URL:', baseUrl);
console.log('─'.repeat(60));

async function testAccessCheck() {
  try {
    console.log('\n1️⃣  Testing Access Check Endpoint...');
    const accessUrl = `${baseUrl}/api/call-connector-pro/access-check/${encodeURIComponent(email)}`;
    console.log('   URL:', accessUrl);
    
    const response = await fetch(accessUrl);
    const data = await response.json();
    
    console.log('   Status:', response.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
    
    const hasAccess = data?.hasAccess === true;
    const source = data?.source || 'unknown';
    const hasDismissedPrimer = data?.hasDismissedPrimer || false;
    
    console.log('\n📊 Access Summary:');
    console.log('   ✅ Has Access:', hasAccess ? 'YES' : 'NO');
    console.log('   📍 Source:', source);
    console.log('   🚫 Primer Dismissed:', hasDismissedPrimer);
    
    return { hasAccess, source, data };
  } catch (error) {
    console.error('❌ Error checking access:', error.message);
    return { hasAccess: false, source: 'error', error: error.message };
  }
}

async function checkSubscriptionStatus() {
  try {
    console.log('\n2️⃣  Checking Subscription Status...');
    
    // Check if there's a subscription service or database check we can do
    // This would require access to the database or subscription service
    console.log('   ⚠️  Subscription check requires database access');
    console.log('   💡 Check connectnow_subscriptions table for this email');
    
    return null;
  } catch (error) {
    console.error('❌ Error checking subscription:', error.message);
    return null;
  }
}

async function checkBypassList() {
  console.log('\n3️⃣  Checking Bypass List...');
  const bypassEmails = [
    'richiealtig@aoglobelife.com',
    'coopertyler@aoglobelife.com',
    'jacobnavarre@aoglobelife.com',
    'kaylar@aoglobelife.com',
    'ryancarrion@aoglobelife.com',
    'makelaoutlawalexander@aoglobelife.com'
  ];
  
  const normalizedEmail = email.toLowerCase().trim();
  const isBypass = bypassEmails.includes(normalizedEmail);
  
  console.log('   Email:', normalizedEmail);
  console.log('   In Bypass List:', isBypass ? 'YES ✅' : 'NO ❌');
  
  return isBypass;
}

function simulateUserExperience(accessResult, isBypass) {
  console.log('\n4️⃣  Simulating User Experience on /connect...');
  console.log('─'.repeat(60));
  
  if (isBypass) {
    console.log('🎯 RESULT: User sees FULL ACCESS (Bypass Email)');
    console.log('   → User will see the full Call Connector Pro interface');
    console.log('   → No signup modal, no restrictions');
    console.log('   → Can immediately start dialing');
  } else if (accessResult.hasAccess) {
    console.log('✅ RESULT: User has ACCESS');
    console.log('   → User will see the full Call Connector Pro interface');
    console.log('   → Access granted via:', accessResult.source);
    console.log('   → Can start dialing immediately');
  } else {
    console.log('❌ RESULT: User does NOT have access');
    console.log('   → User will see the SIGNUP component');
    console.log('   → Shows "Call Connector Pro" signup card');
    console.log('   → Button: "Subscribe to Call Connector Pro"');
    console.log('   → Clicking button redirects to Stripe checkout');
    console.log('   → After payment, access is granted');
  }
  
  console.log('─'.repeat(60));
}

async function main() {
  console.log('\n🚀 Starting Test...\n');
  
  // Check bypass list
  const isBypass = await checkBypassList();
  
  // Check access
  const accessResult = await testAccessCheck();
  
  // Check subscription (if possible)
  await checkSubscriptionStatus();
  
  // Simulate what user sees
  simulateUserExperience(accessResult, isBypass);
  
  console.log('\n✅ Test Complete!\n');
  
  // Summary
  console.log('📋 SUMMARY:');
  console.log('   Email:', email);
  console.log('   Bypass:', isBypass ? 'YES' : 'NO');
  console.log('   Has Access:', accessResult.hasAccess ? 'YES' : 'NO');
  console.log('   What They See:', 
    isBypass ? 'Full Access (Bypass)' :
    accessResult.hasAccess ? 'Full Access' : 
    'Signup Screen → Stripe Checkout'
  );
}

// Run the test
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

