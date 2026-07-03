/**
 * Delete the previous 5 imported calls and re-import them
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsScheduler } from './server/call-analytics-scheduler';
import * as fs from 'fs';
import * as path from 'path';

interface CSVRow {
  Date: string;
  Time: string;
  Phone: string;
  Name: string;
  Recording: string;
  firstName?: string;
  lastName?: string;
  [key: string]: string | undefined;
}

function extractSessionID(recordingUrl: string): string | null {
  const match = recordingUrl.match(/\/calls\/([a-f0-9]{24})\//);
  return match ? match[1] : null;
}

function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row: CSVRow = {} as CSVRow;
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    
    if (row.Recording) {
      rows.push(row);
    }
  }
  
  return rows;
}

async function deleteAndReimport() {
  console.log('🗑️ Deleting previous 5 imported calls...\n');

  const csvFiles = [
    '8c1000c3-93ef-4e96-a701-4ec2a6189cb7.csv',
    '8e01ed9b-54a8-4524-8dd5-bf90673c1bd7.csv',
    '643ba479-0181-4d19-9034-91ef6ecbb589.csv',
    '6660fef8-d882-4fe9-af55-242265fed36b.csv'
  ];

  const allTransfers: Array<{ 
    sessionID: string; 
    phone: string; 
    name: string; 
    firstName?: string;
    lastName?: string;
    date: string; 
    time: string;
    market?: string;
  }> = [];

  // Parse all CSV files to get the 5 entries
  for (const csvFile of csvFiles) {
    const filePath = path.join(process.cwd(), csvFile);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${csvFile}`);
      continue;
    }
    
    const rows = parseCSV(filePath);
    
    for (const row of rows) {
      if (!row.Recording) continue;
      
      const sessionID = extractSessionID(row.Recording);
      if (!sessionID) continue;
      
      allTransfers.push({
        sessionID,
        phone: row.Phone || '',
        name: row.Name || '',
        firstName: row.firstName,
        lastName: row.lastName,
        date: row.Date || '',
        time: row.Time || '',
        market: row.Taalk_Market || row.Taalk_market || 'Veteran'
      });
    }
  }

  const entriesToDelete = allTransfers.slice(0, 5);
  const transactionIds = entriesToDelete.map(t => `csv-${t.sessionID}`);

  console.log(`📋 Found ${entriesToDelete.length} entries to delete:\n`);
  entriesToDelete.forEach((e, i) => {
    console.log(`   ${i + 1}. ${e.name} (${e.phone}) - ${e.sessionID}`);
  });
  console.log();

  // Delete billing_transactions
  console.log('🗑️ Deleting billing_transactions...');
  const { error: deleteTransactionsError } = await supabaseAdmin
    .from('billing_transactions')
    .delete()
    .in('transaction_id', transactionIds);

  if (deleteTransactionsError) {
    console.error(`❌ Error deleting transactions:`, deleteTransactionsError);
  } else {
    console.log(`✅ Deleted ${transactionIds.length} billing_transactions`);
  }

  // Delete corresponding taalk_call_analytics
  console.log('🗑️ Deleting taalk_call_analytics...');
  const { data: analyticsToDelete } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id')
    .in('billing_transaction_id', transactionIds);

  if (analyticsToDelete && analyticsToDelete.length > 0) {
    const analyticsIds = analyticsToDelete.map(a => a.id);
    const { error: deleteAnalyticsError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .delete()
      .in('id', analyticsIds);

    if (deleteAnalyticsError) {
      console.error(`❌ Error deleting analytics:`, deleteAnalyticsError);
    } else {
      console.log(`✅ Deleted ${analyticsIds.length} taalk_call_analytics entries`);
    }
  } else {
    console.log(`   No analytics entries found to delete`);
  }

  console.log('\n✅ Deletion complete!\n');
  console.log('📥 Now re-importing the same 5 entries...\n');

  // Now re-import using the same logic as import-5-csv-entries.ts
  const scheduler = callAnalyticsScheduler as any;
  let imported = 0;
  let failed = 0;

  async function resolveAgentInfo(companyEmail: string | null, agent: string | null): Promise<{
    email: string;
    associateId: number | null;
    name: string;
  }> {
    let resolvedEmail = companyEmail?.toLowerCase().trim() || null;
    let resolvedAssociateId: number | null = null;
    let resolvedName = 'Unknown Agent';

    if (resolvedEmail) {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id, first_name, last_name')
        .or(`company_email.ilike.%${resolvedEmail}%,personal_email.ilike.%${resolvedEmail}%`)
        .limit(1)
        .maybeSingle();

      if (customer) {
        resolvedEmail = (customer.company_email || customer.personal_email || resolvedEmail)?.toLowerCase() || resolvedEmail;
        resolvedAssociateId = customer.associate_id || null;
        if (customer.first_name || customer.last_name) {
          resolvedName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || resolvedName;
        }
      }
    }

    if (agent && /^\d+$/.test(String(agent))) {
      const associateIdNum = parseInt(agent, 10);
      if (!resolvedAssociateId) {
        resolvedAssociateId = associateIdNum;
      }

      const { data: hierarchy } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('agent_email, agent_associate_id, agent_name')
        .eq('agent_associate_id', associateIdNum)
        .limit(1)
        .maybeSingle();

      if (hierarchy) {
        if (!resolvedEmail && hierarchy.agent_email) {
          resolvedEmail = hierarchy.agent_email.toLowerCase();
        }
        if (!resolvedName && hierarchy.agent_name) {
          resolvedName = hierarchy.agent_name;
        }
        if (!resolvedAssociateId && hierarchy.agent_associate_id) {
          resolvedAssociateId = hierarchy.agent_associate_id;
        }
      }
    }

    return {
      email: resolvedEmail || 'unknown@aoglobelife.com',
      associateId: resolvedAssociateId,
      name: resolvedName
    };
  }

  for (const transfer of entriesToDelete) {
    try {
      console.log(`🔍 Importing: ${transfer.name} (${transfer.phone}) - ${transfer.sessionID}`);

      let vdpCall = null;
      let agentInfo = {
        email: 'unknown@aoglobelife.com',
        associateId: null as number | null,
        name: 'Unknown Agent'
      };

      if (transfer.phone) {
        const normalizedPhone = transfer.phone.replace(/[\s\-+()]/g, '');
        const last10 = normalizedPhone.slice(-10);

        console.log(`   🔍 Looking up vdp_calls by phone: ${last10}`);

        const { data: vdpCalls, error: vdpError } = await supabaseAdmin
          .from('vdp_calls')
          .select('id, phone, company_email, agent, firstName, lastName, sessionID, market')
          .or(`phone.ilike.%${last10}%,phone.ilike.%${normalizedPhone}%`)
          .order('updated_at', { ascending: false })
          .limit(5);

        if (!vdpError && vdpCalls && vdpCalls.length > 0) {
          vdpCall = vdpCalls.find(c => 
            c.sessionID === transfer.sessionID || 
            c.phone?.replace(/[\s\-+()]/g, '').slice(-10) === last10
          ) || vdpCalls[0];

          console.log(`   ✅ Found vdp_call: ID ${vdpCall.id}, agent: ${vdpCall.agent}, email: ${vdpCall.company_email}`);

          agentInfo = await resolveAgentInfo(vdpCall.company_email, vdpCall.agent);
          console.log(`   ✅ Resolved agent: ${agentInfo.email} (ID: ${agentInfo.associateId}, Name: ${agentInfo.name})`);
        } else {
          console.log(`   ⚠️ No vdp_call found for phone ${last10}`);
        }
      }

      const dateStr = transfer.date;
      const timeStr = transfer.time;
      
      let transactionDate = new Date().toISOString();
      if (dateStr && timeStr) {
        try {
          const [month, day, year] = dateStr.split('/');
          const [time, ampm] = timeStr.split(' ');
          const [hours, minutes, seconds] = time.split(':');
          let hour24 = parseInt(hours);
          if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
          if (ampm === 'AM' && hour24 === 12) hour24 = 0;
          
          transactionDate = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            hour24,
            parseInt(minutes),
            parseInt(seconds || '0')
          ).toISOString();
        } catch (e) {
          console.warn(`   ⚠️ Could not parse date/time, using current date`);
        }
      }

      const transaction = {
        transaction_id: `csv-${transfer.sessionID}`,
        transaction_type: 'connect',
        agent_email: agentInfo.email,
        agent_name: agentInfo.name,
        agent_associate_id: agentInfo.associateId,
        transaction_date: transactionDate,
        amount_usd: 8.0,
        credits_charged: 0,
        lead_name: transfer.name || `${transfer.firstName || ''} ${transfer.lastName || ''}`.trim() || null,
        lead_phone: transfer.phone || null,
        source_table: 'vdp_calls',
        source_id: vdpCall?.id || null,
        description: 'AO Connect charge (CSV import)',
        metadata: {
          sessionID: transfer.sessionID,
          taalk_call_id: transfer.sessionID,
          source: 'csv_import',
          phone: transfer.phone,
          name: transfer.name,
          market: transfer.market || vdpCall?.market || 'Veteran'
        },
        status: 'completed'
      };

      const { error: upsertError } = await supabaseAdmin
        .from('billing_transactions')
        .upsert(transaction, { onConflict: 'transaction_id' });

      if (upsertError) {
        throw upsertError;
      } else {
        console.log(`   ✅ Upserted billing_transaction: ${transaction.transaction_id}`);
        console.log(`      Agent: ${transaction.agent_email} (ID: ${transaction.agent_associate_id || 'N/A'})`);
      }

      console.log(`   🔍 Triggering analysis...`);
      await scheduler.analyzeCall(transaction);
      
      imported++;
      console.log(`   ✅ Successfully imported and queued for analysis\n`);
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Re-import complete: ${imported} succeeded, ${failed} failed`);
}

deleteAndReimport().catch(console.error);
