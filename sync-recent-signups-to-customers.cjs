const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncRecentSignupsToCustomers() {
  console.log('📊 Syncing recent signups (last 72 hours) to customers table...');
  
  try {
    // 1. Get all auth users created in last 72 hours
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    const recentUsers = authUsers.users.filter(user => {
      const createdAt = new Date(user.created_at);
      return createdAt > new Date(seventyTwoHoursAgo);
    });
    
    console.log(`✅ Found ${recentUsers.length} users created in last 72 hours`);
    
    if (recentUsers.length === 0) {
      console.log('No recent signups to sync');
      return;
    }
    
    // 2. Read Producer List CSV
    const csvContent = fs.readFileSync('Producer List 10.24.25.csv', 'utf-8');
    const lines = csvContent.split('\n');
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    console.log(`📋 Producer List has ${dataLines.length} total agents`);
    
    // Build lookup map: email -> producer data
    const producerMap = new Map();
    
    dataLines.forEach(line => {
      const columns = parseCSVLine(line);
      const associateId = parseInt(columns[0]);
      const companyEmail = columns[3]?.trim().toLowerCase();
      const personalEmail = columns[4]?.trim().toLowerCase();
      const phone = columns[5]?.trim();
      const aoiMarket = columns[6]?.trim();
      const aoMarket2 = columns[7]?.trim();
      const designatedMarket = columns[8]?.trim();
      const agentName = columns[9]?.trim();
      const states = columns[10]?.trim();
      
      if (companyEmail) {
        producerMap.set(companyEmail, {
          associateId,
          companyEmail,
          personalEmail,
          phone,
          aoiMarket,
          aoMarket2,
          designatedMarket,
          agentName,
          states
        });
      }
    });
    
    console.log(`✅ Built producer lookup map with ${producerMap.size} agents`);
    
    // 3. For each recent user, create customers and user_credit records (skip if exists)
    let customersCreated = 0;
    let creditsCreated = 0;
    let notFound = 0;
    let skipped = 0;
    
    for (const user of recentUsers) {
      const email = user.email.toLowerCase();
      const producerData = producerMap.get(email);
      
      if (!producerData) {
        console.log(`⚠️  ${email} not found in Producer List`);
        notFound++;
        continue;
      }
      
      // Check if customer already exists by associate_id
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('associate_id, company_email')
        .eq('associate_id', producerData.associateId)
        .maybeSingle();
      
      if (existingCustomer) {
        console.log(`⏭️  Skipping ${email} - associate_id ${producerData.associateId} already exists in customers`);
        skipped++;
        continue;
      }
      
      console.log(`📝 Creating customer record for ${email}...`);
      
      // Parse name from email if not in producer list
      const nameParts = email.split('@')[0].split(/[._-]/);
      const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'Agent';
      const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : 'User';
      
      // Create customer record
      const customerData = {
        company_email: email,
        personal_email: producerData.personalEmail || email,
        associate_id: producerData.associateId,
        first_name: firstName,
        last_name: lastName,
        phone: producerData.phone || '+1-555-0000',
        agent_name: producerData.agentName || `${firstName} ${lastName}`,
        states: producerData.states,
        primary_market: producerData.aoiMarket || '',
        secondary_market: producerData.aoMarket2 || '',
        designated_market: producerData.designatedMarket || '',
        VDPACTIVE: 'INACTIVE',
        PLUSACTIVE: 'INACTIVE',
        RECRUITACTIVE: 'INACTIVE',
        AOICONNECT: 'INACTIVE',
        CCPRO: false,
        status: 'offline',
        created_at: user.created_at
      };
      
      const { error: customerError } = await supabase
        .from('customers')
        .insert(customerData);
      
      if (customerError) {
        console.error(`❌ Failed to create customer for ${email}:`, customerError);
      } else {
        console.log(`✅ Customer created for ${email}`);
        customersCreated++;
      }
      
      // Create user_credit record only if it doesn't exist
      const { data: existingCredit } = await supabase
        .from('user_credit')
        .select('email')
        .eq('email', email)
        .maybeSingle();
      
      if (!existingCredit) {
        const creditData = {
          email: email,
          credits_remaining: 0,
          credits_used: 0,
          last_updated: new Date().toISOString()
        };
        
        const { error: creditError } = await supabase
          .from('user_credit')
          .insert(creditData);
        
        if (creditError) {
          console.error(`❌ Failed to create credit record for ${email}:`, creditError);
        } else {
          console.log(`✅ Credit record created for ${email}`);
          creditsCreated++;
        }
      } else {
        console.log(`⏭️  Credit record already exists for ${email}`);
      }
    }
    
    console.log('\n📊 Sync Summary:');
    console.log(`  - Recent signups: ${recentUsers.length}`);
    console.log(`  - Customers created: ${customersCreated}`);
    console.log(`  - Credits created: ${creditsCreated}`);
    console.log(`  - Skipped (already exists): ${skipped}`);
    console.log(`  - Not found in Producer List: ${notFound}`);
    
  } catch (error) {
    console.error('❌ Error syncing recent signups:', error);
  }
}

// Helper function to parse CSV line
function parseCSVLine(line) {
  const columns = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      columns.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  columns.push(current);
  return columns;
}

syncRecentSignupsToCustomers();

