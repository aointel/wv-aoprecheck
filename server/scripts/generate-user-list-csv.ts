import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function generateUserList() {
  console.log('🚀 Generating user list CSV...\n');
  
  const startDate = '2025-01-01T00:00:00Z';
  const now = new Date().toISOString();
  
  console.log(`📅 Date range: ${startDate} to ${now}\n`);
  
  // Get all unique agent emails from billing_transactions since Jan 1
  console.log('1️⃣ Fetching users from billing_transactions...');
  const { data: billingUsers, error: billingError } = await supabaseAdmin
    .from('billing_transactions')
    .select('agent_email')
    .gte('transaction_date', startDate)
    .not('agent_email', 'is', null)
    .neq('agent_email', '');
  
  if (billingError) {
    console.error('❌ Error fetching billing_transactions:', billingError);
    throw billingError;
  }
  
  const billingEmails = new Set<string>();
  (billingUsers || []).forEach((row: any) => {
    if (row.agent_email) {
      billingEmails.add(row.agent_email.toLowerCase().trim());
    }
  });
  
  console.log(`   Found ${billingEmails.size} unique users from billing_transactions\n`);
  
  // Get all users with active Call Connector Pro accounts since Jan 1
  console.log('2️⃣ Fetching users with active Call Connector Pro...');
  
  // Check customers table with CCPRO = true
  const { data: ccproCustomers, error: ccproError } = await supabaseAdmin
    .from('customers')
    .select('company_email, personal_email, first_name, last_name')
    .eq('CCPRO', true)
    .not('company_email', 'is', null)
    .neq('company_email', '');
  
  if (ccproError) {
    console.error('❌ Error fetching CCPRO customers:', ccproError);
    throw ccproError;
  }
  
  // Check connectnow_subscriptions for active/trialing professional/elite subscriptions
  const { data: subscriptions, error: subError } = await supabaseAdmin
    .from('connectnow_subscriptions')
    .select('user_email, plan, status, created_at')
    .in('status', ['active', 'trialing'])
    .in('plan', ['professional', 'elite'])
    .gte('created_at', startDate);
  
  if (subError) {
    console.error('❌ Error fetching subscriptions:', subError);
    throw subError;
  }
  
  const ccproEmails = new Set<string>();
  (ccproCustomers || []).forEach((row: any) => {
    if (row.company_email) ccproEmails.add(row.company_email.toLowerCase().trim());
    if (row.personal_email) ccproEmails.add(row.personal_email.toLowerCase().trim());
  });
  
  (subscriptions || []).forEach((row: any) => {
    if (row.user_email) ccproEmails.add(row.user_email.toLowerCase().trim());
  });
  
  console.log(`   Found ${ccproEmails.size} unique users with active Call Connector Pro\n`);
  
  // Combine all emails
  const allEmails = new Set<string>();
  billingEmails.forEach(email => allEmails.add(email));
  ccproEmails.forEach(email => allEmails.add(email));
  
  console.log(`📊 Total unique users: ${allEmails.size}\n`);
  
  // Get names from customers table
  console.log('3️⃣ Fetching user names from customers table...');
  const emailArray = Array.from(allEmails);
  const emailBatches: string[][] = [];
  for (let i = 0; i < emailArray.length; i += 200) {
    emailBatches.push(emailArray.slice(i, i + 200));
  }
  
  const userMap = new Map<string, { firstName: string; lastName: string }>();
  
  for (const batch of emailBatches) {
    const { data: customers, error: custError } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email, first_name, last_name')
      .or(`company_email.in.(${batch.join(',')}),personal_email.in.(${batch.join(',')})`);
    
    if (custError) {
      console.error('❌ Error fetching customers:', custError);
      continue;
    }
    
    (customers || []).forEach((row: any) => {
      const firstName = (row.first_name || '').trim();
      const lastName = (row.last_name || '').trim();
      
      if (row.company_email) {
        const email = row.company_email.toLowerCase().trim();
        if (!userMap.has(email) && firstName && lastName) {
          userMap.set(email, { firstName, lastName });
        }
      }
      
      if (row.personal_email) {
        const email = row.personal_email.toLowerCase().trim();
        if (!userMap.has(email) && firstName && lastName) {
          userMap.set(email, { firstName, lastName });
        }
      }
    });
  }
  
  console.log(`   Found names for ${userMap.size} users\n`);
  
  // Format as "lastname, firstname" and create CSV
  console.log('4️⃣ Generating CSV...');
  const csvRows: string[] = [];
  
  for (const email of allEmails) {
    const user = userMap.get(email);
    if (user && user.firstName && user.lastName) {
      const formatted = `${user.lastName}, ${user.firstName}`;
      csvRows.push(formatted);
    } else {
      // If no name found, use email prefix as fallback
      const emailPrefix = email.split('@')[0];
      const nameParts = emailPrefix.split(/[._-]/);
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts[1] || 'User';
      csvRows.push(`${lastName}, ${firstName}`);
    }
  }
  
  // Sort alphabetically by last name
  csvRows.sort((a, b) => {
    const aLast = a.split(',')[0].trim();
    const bLast = b.split(',')[0].trim();
    return aLast.localeCompare(bLast);
  });
  
  // Write to CSV file
  const csvContent = csvRows.join('\n');
  const outputPath = path.join(process.cwd(), 'user-list.csv');
  fs.writeFileSync(outputPath, csvContent, 'utf-8');
  
  console.log(`✅ CSV generated successfully!`);
  console.log(`📁 File: ${outputPath}`);
  console.log(`📊 Total users: ${csvRows.length}\n`);
  
  // Show sample
  console.log('📋 Sample (first 10):');
  csvRows.slice(0, 10).forEach((row, i) => {
    console.log(`   ${i + 1}. ${row}`);
  });
}

generateUserList()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
