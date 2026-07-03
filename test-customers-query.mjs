/**
 * TEST CUSTOMERS QUERY
 * Tests if we can actually fetch customers from Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// Use hardcoded config values
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

if (!supabaseServiceKey) {
  console.error('❌ Missing service key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCustomersQuery() {
  console.log('🔍 Testing customers query...\n');
  
  try {
    // Test 1: Check what columns exist
    console.log('📊 Test 1: Checking table structure...');
    const { data: sampleCustomer, error: sampleError } = await supabase
      .from('customers')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleError) {
      console.error('❌ Error getting sample:', sampleError);
    } else {
      console.log('✅ Available columns:', Object.keys(sampleCustomer || {}));
    }
    
    // Test 2: Query with company_email (without team/market first)
    console.log('\n📊 Test 2: Querying customers with company_email...');
    const { data: companyEmailCustomers, error: error1 } = await supabase
      .from('customers')
      .select('associate_id, first_name, last_name, company_email, personal_email')
      .not('company_email', 'is', null)
      .order('last_name')
      .limit(10);
    
    if (error1) {
      console.error('❌ Error 1:', error1);
    } else {
      console.log(`✅ Found ${companyEmailCustomers?.length || 0} customers with company_email`);
      if (companyEmailCustomers && companyEmailCustomers.length > 0) {
        console.log('   Sample:', companyEmailCustomers[0]);
      }
    }
    
    // Test 3: Query with only personal_email (no company_email)
    console.log('\n📊 Test 3: Querying customers with only personal_email...');
    const { data: personalEmailCustomers, error: error2 } = await supabase
      .from('customers')
      .select('associate_id, first_name, last_name, company_email, personal_email')
      .is('company_email', null)
      .not('personal_email', 'is', null)
      .order('last_name')
      .limit(10);
    
    if (error2) {
      console.error('❌ Error 2:', error2);
    } else {
      console.log(`✅ Found ${personalEmailCustomers?.length || 0} customers with personal_email only`);
      if (personalEmailCustomers && personalEmailCustomers.length > 0) {
        console.log('   Sample:', personalEmailCustomers[0]);
      }
    }
    
    // Test 4: Count total
    console.log('\n📊 Test 4: Counting total customers...');
    const { count, error: countError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Count Error:', countError);
    } else {
      console.log(`✅ Total customers in table: ${count}`);
    }
    
    // Test 5: Combined results
    console.log('\n📊 Test 5: Combining results...');
    const combined = [
      ...(companyEmailCustomers || []),
      ...(personalEmailCustomers || [])
    ];
    
    const agents = [];
    const seenEmails = new Set();
    
    for (const c of combined) {
      const email = c.company_email || c.personal_email;
      if (!email || seenEmails.has(email.toLowerCase())) {
        continue;
      }
      seenEmails.add(email.toLowerCase());
      
      agents.push({
        associate_id: c.associate_id || 0,
        agent_name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || email,
        company_email: email,
        mga: null, // Will need to check actual column name
        rga: null  // Will need to check actual column name
      });
    }
    
    console.log(`✅ Combined unique agents: ${agents.length}`);
    if (agents.length > 0) {
      console.log('\n📋 First 5 agents:');
      agents.slice(0, 5).forEach((agent, i) => {
        console.log(`   ${i + 1}. ${agent.agent_name} (${agent.company_email})`);
      });
    }
    
    if (agents.length === 0) {
      console.error('\n❌ NO AGENTS FOUND! The query is not working!');
      process.exit(1);
    } else {
      console.log('\n✅ Query is working! Found agents.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

testCustomersQuery()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

