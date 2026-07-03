const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let SUPABASE_URL, SUPABASE_SERVICE_KEY;
const hardcodedConfigPath = path.join(__dirname, 'server', 'hardcoded-config.ts');
if (fs.existsSync(hardcodedConfigPath)) {
  const configContent = fs.readFileSync(hardcodedConfigPath, 'utf-8');
  const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
  if (urlMatch) SUPABASE_URL = urlMatch[1];
  const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
  if (keyMatch) SUPABASE_SERVICE_KEY = keyMatch[1];
}

if (!SUPABASE_URL) SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_SERVICE_KEY) SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse CSV line handling quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Check if date is 12/18/2025 before 2 PM PST
// 2 PM PST = 22:00 UTC (PST is UTC-8)
function isDec18Before2PM_PST(dateString) {
  if (!dateString) return false;
  
  let date;
  try {
    date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
  } catch (e) {
    return false;
  }
  
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  
  // December 18, 2025 and before 22:00 UTC (2 PM PST = 22:00 UTC)
  if (year === 2025 && month === 12 && day === 18) {
    return hour < 22;
  }
  
  return false;
}

async function main() {
  console.log(`🔍 CHECKING BILLING_TRANSACTIONS FROM 12/18 BEFORE 2 PM PST (EXCLUDING $64.99)\n`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    return;
  }

  const csvPath = path.join(__dirname, 'db', 'billing_transactions_rows.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ billing_transactions_rows.csv not found in db folder');
    return;
  }

  console.log(`📄 Reading CSV file...\n`);
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    console.error('❌ CSV file is empty');
    return;
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);
  const dateColumnIndex = headers.findIndex(h => h.toLowerCase() === 'transaction_date');
  const amountColumnIndex = headers.findIndex(h => h.toLowerCase() === 'amount_usd');

  if (dateColumnIndex === -1) {
    console.error('❌ Could not find transaction_date column');
    return;
  }

  console.log(`📋 CSV Structure: ${headers.length} columns`);
  console.log(`   Date column: "${headers[dateColumnIndex]}" (index ${dateColumnIndex})`);
  console.log(`   Amount column: "${headers[amountColumnIndex]}" (index ${amountColumnIndex})\n`);

  // Parse rows and filter for 12/18 before 2 PM PST, excluding $64.99
  const csvTransactions = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    
    const dateValue = values[dateColumnIndex];
    const amountValue = values[amountColumnIndex];
    
    // Check date
    if (!isDec18Before2PM_PST(dateValue)) continue;
    
    // Exclude $64.99 transactions
    const amount = parseFloat(amountValue);
    if (!isNaN(amount) && amount === 64.99) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || null;
    });
    csvTransactions.push(row);
  }

  console.log(`📊 Found ${csvTransactions.length} transactions from 12/18 before 2 PM PST (excluding $64.99) in CSV\n`);

  if (csvTransactions.length === 0) {
    console.log(`✅ No transactions found matching criteria`);
    return;
  }

  // Get existing transactions from Supabase for the same date range, excluding $64.99
  const startDate = '2025-12-18T00:00:00Z';
  const endDate = '2025-12-18T22:00:00Z';
  
  console.log(`🔍 Checking existing transactions in Supabase...\n`);
  
  const { data: existingTransactions, error } = await supabaseAdmin
    .from('billing_transactions')
    .select('*')
    .gte('transaction_date', startDate)
    .lt('transaction_date', endDate)
    .neq('amount_usd', 64.99);

  if (error) {
    console.error('❌ Error fetching existing transactions:', error.message);
    return;
  }

  console.log(`📊 Found ${existingTransactions?.length || 0} existing transactions in Supabase for this time period (excluding $64.99)\n`);

  // Find unique identifier
  const transactionIdColumn = headers.findIndex(h => h.toLowerCase() === 'transaction_id');
  const idColumn = headers.findIndex(h => h.toLowerCase() === 'id');

  // Create sets of existing transaction identifiers
  const existingIds = new Set();
  const existingTransactionIds = new Set();

  if (existingTransactions && existingTransactions.length > 0) {
    existingTransactions.forEach(t => {
      if (t.id) existingIds.add(t.id);
      if (t.transaction_id) existingTransactionIds.add(t.transaction_id);
    });
  }

  // Find new transactions
  const newTransactions = [];
  const duplicateTransactions = [];

  for (const csvTrans of csvTransactions) {
    let isNew = true;
    
    // Check by transaction_id first
    if (transactionIdColumn !== -1 && csvTrans[headers[transactionIdColumn]]) {
      const transId = csvTrans[headers[transactionIdColumn]];
      if (existingTransactionIds.has(transId)) {
        isNew = false;
      }
    }
    
    // Also check by id
    if (isNew && idColumn !== -1 && csvTrans[headers[idColumn]]) {
      const csvId = parseInt(csvTrans[headers[idColumn]], 10);
      if (!isNaN(csvId) && existingIds.has(csvId)) {
        isNew = false;
      }
    }
    
    if (isNew) {
      newTransactions.push(csvTrans);
    } else {
      duplicateTransactions.push(csvTrans);
    }
  }

  console.log(`\n📊 COMPARISON RESULTS:\n`);
  console.log(`   CSV transactions (12/18 before 2 PM PST, excluding $64.99): ${csvTransactions.length}`);
  console.log(`   Existing in Supabase: ${existingTransactions?.length || 0}`);
  console.log(`   NEW transactions to INSERT: ${newTransactions.length}`);
  console.log(`   Duplicate transactions (already exist): ${duplicateTransactions.length}`);

  if (newTransactions.length > 0) {
    console.log(`\n📋 NEW TRANSACTIONS TO INSERT (first 20):\n`);
    newTransactions.slice(0, 20).forEach((trans, idx) => {
      const id = idColumn !== -1 ? trans[headers[idColumn]] : 'N/A';
      const transId = transactionIdColumn !== -1 ? trans[headers[transactionIdColumn]] : 'N/A';
      const email = trans.agent_email || 'N/A';
      const amount = trans.amount_usd || 'N/A';
      const credits = trans.credits_charged || 'N/A';
      const date = trans.transaction_date || 'N/A';
      console.log(`   ${idx + 1}. ID: ${id}, transaction_id: ${transId}`);
      console.log(`      Email: ${email}, Amount: $${amount}, Credits: ${credits}, Date: ${date}\n`);
    });
    
    if (newTransactions.length > 20) {
      console.log(`   ... and ${newTransactions.length - 20} more\n`);
    }
  }

  console.log(`\n✅ Analysis complete!`);
}

main().catch(console.error);
