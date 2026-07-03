/**
 * Import 5 entries from CSV files into billing_transactions
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
  // Match pattern: /calls/{24-char-hex}/recording
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

async function import5Entries() {
  console.log('📥 Importing 5 entries from CSV files...\n');

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

  // Parse all CSV files
  for (const csvFile of csvFiles) {
    const filePath = path.join(process.cwd(), csvFile);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${csvFile}`);
      continue;
    }
    
    console.log(`📄 Processing ${csvFile}...`);
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
    
    console.log(`   ✅ Found ${rows.length} transfers`);
  }

  console.log(`\n📊 Total transfers found: ${allTransfers.length}`);
  
  // Take first 5
  const entriesToImport = allTransfers.slice(0, 5);
  
  console.log(`\n📥 Importing ${entriesToImport.length} entries...\n`);

  const scheduler = callAnalyticsScheduler as any;
  let imported = 0;
  let failed = 0;

  // Helper function to resolve agent info with teams (EXACT SAME AS LIVE CALL BOARD)
  async function resolveAgentInfo(companyEmail: string | null, agent: string | null): Promise<{
    email: string;
    associateId: number | null;
    name: string;
    rgaTeam: string | null;
    mgaTeam: string | null;
  }> {
    let resolvedEmail = companyEmail?.toLowerCase().trim() || null;
    let resolvedAssociateId: number | null = null;
    let resolvedName = 'Unknown Agent';
    let rgaTeam: string | null = null;
    let mgaTeam: string | null = null;

    // Try to find by company_email in customers table
    if (resolvedEmail) {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id, first_name, last_name, rga_team, mga_team')
        .or(`company_email.ilike.%${resolvedEmail}%,personal_email.ilike.%${resolvedEmail}%`)
        .limit(1)
        .maybeSingle();

      if (customer) {
        resolvedEmail = (customer.company_email || customer.personal_email || resolvedEmail)?.toLowerCase() || resolvedEmail;
        resolvedAssociateId = customer.associate_id || null;
        if (customer.first_name || customer.last_name) {
          resolvedName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || resolvedName;
        }
        rgaTeam = customer.rga_team || null;
        mgaTeam = customer.mga_team || null;
      }
    }

    // Try agent_hierarchy by associate ID if agent is numeric OR if we have associate_id
    const associateIdToCheck = resolvedAssociateId || (agent && /^\d+$/.test(String(agent)) ? parseInt(agent, 10) : null);
    
    if (associateIdToCheck) {
      if (!resolvedAssociateId) {
        resolvedAssociateId = associateIdToCheck;
      }

      // FIRST: Try agent_hierarchy by associate_id (PRIORITY - ALWAYS CHECK THIS FIRST)
      const { data: hierarchy, error: hierarchyError } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('agent_email, agent_associate_id, agent_name, rga_name, mga_name')
        .eq('agent_associate_id', associateIdToCheck)
        .limit(1)
        .maybeSingle();

      if (hierarchyError) {
        console.warn(`   ⚠️ Error querying agent_hierarchy for associate_id ${associateIdToCheck}:`, hierarchyError.message);
      }

      if (hierarchy) {
        if (!resolvedEmail && hierarchy.agent_email) {
          resolvedEmail = hierarchy.agent_email.toLowerCase();
        }
        if (hierarchy.agent_name) {
          resolvedName = hierarchy.agent_name; // ALWAYS USE IF AVAILABLE
        }
        if (!resolvedAssociateId && hierarchy.agent_associate_id) {
          resolvedAssociateId = hierarchy.agent_associate_id;
        }
        if (hierarchy.rga_name) {
          rgaTeam = hierarchy.rga_name; // ALWAYS USE IF AVAILABLE
        }
        if (hierarchy.mga_name) {
          mgaTeam = hierarchy.mga_name; // ALWAYS USE IF AVAILABLE
        }
      }

      // SECOND: Try customers table by associate_id (FALLBACK - ONLY IF NAME STILL UNKNOWN)
      if (resolvedName === 'Unknown Agent' || !rgaTeam || !mgaTeam) {
        const { data: customerByAssoc, error: customerError } = await supabaseAdmin
          .from('customers')
          .select('rga_team, mga_team, first_name, last_name, company_email, personal_email')
          .eq('associate_id', associateIdToCheck)
          .limit(1)
          .maybeSingle();

        if (customerError) {
          console.warn(`   ⚠️ Error querying customers for associate_id ${associateIdToCheck}:`, customerError.message);
        }

        if (customerByAssoc) {
          if (!resolvedEmail && (customerByAssoc.company_email || customerByAssoc.personal_email)) {
            resolvedEmail = (customerByAssoc.company_email || customerByAssoc.personal_email)?.toLowerCase();
          }
          if (resolvedName === 'Unknown Agent' && (customerByAssoc.first_name || customerByAssoc.last_name)) {
            resolvedName = `${customerByAssoc.first_name || ''} ${customerByAssoc.last_name || ''}`.trim();
          }
          if (!rgaTeam && customerByAssoc.rga_team) {
            rgaTeam = customerByAssoc.rga_team;
          }
          if (!mgaTeam && customerByAssoc.mga_team) {
            mgaTeam = customerByAssoc.mga_team;
          }
        }
      }
    }

    return {
      email: resolvedEmail || 'unknown@aoglobelife.com',
      associateId: resolvedAssociateId,
      name: resolvedName,
      rgaTeam,
      mgaTeam
    };
  }

  for (const transfer of entriesToImport) {
    try {
      console.log(`🔍 Importing: ${transfer.name} (${transfer.phone}) - ${transfer.sessionID}`);

      // Look up vdp_calls by phone number to get agent info
      let vdpCall = null;
      let agentInfo = {
        email: 'unknown@aoglobelife.com',
        associateId: null as number | null,
        name: 'Unknown Agent',
        rgaTeam: null as string | null,
        mgaTeam: null as string | null
      };

      if (transfer.phone) {
        // Normalize phone number (remove +, spaces, dashes, parentheses)
        const normalizedPhone = transfer.phone.replace(/[\s\-+()]/g, '');
        const last10 = normalizedPhone.slice(-10); // Last 10 digits

        console.log(`   🔍 Looking up vdp_calls by phone: ${last10}`);

        const { data: vdpCalls, error: vdpError } = await supabaseAdmin
          .from('vdp_calls')
          .select('id, phone, company_email, agent, firstName, lastName, sessionID, market')
          .or(`phone.ilike.%${last10}%,phone.ilike.%${normalizedPhone}%`)
          .order('updated_at', { ascending: false })
          .limit(5);

        if (!vdpError && vdpCalls && vdpCalls.length > 0) {
          // Find best match by sessionID or phone
          vdpCall = vdpCalls.find(c => 
            c.sessionID === transfer.sessionID || 
            c.phone?.replace(/[\s\-+()]/g, '').slice(-10) === last10
          ) || vdpCalls[0];

          console.log(`   ✅ Found vdp_call: ID ${vdpCall.id}, agent: ${vdpCall.agent}, email: ${vdpCall.company_email}`);

          // Resolve agent info from vdp_call
          agentInfo = await resolveAgentInfo(vdpCall.company_email, vdpCall.agent);
          console.log(`   ✅ Resolved agent: ${agentInfo.email} (ID: ${agentInfo.associateId}, Name: ${agentInfo.name}, RGA: ${agentInfo.rgaTeam || 'N/A'}, MGA: ${agentInfo.mgaTeam || 'N/A'})`);
        } else {
          console.log(`   ⚠️ No vdp_call found for phone ${last10}`);
        }
      }

      // Parse date/time
      const dateStr = transfer.date; // Format: 01/27/2026
      const timeStr = transfer.time; // Format: 7:41:02 PM
      
      let transactionDate = new Date().toISOString();
      if (dateStr && timeStr) {
        try {
          // Parse MM/DD/YYYY HH:MM:SS AM/PM
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

      // Create billing transaction with resolved agent info (INCLUDING TEAMS)
      const transaction = {
        transaction_id: `csv-${transfer.sessionID}`,
        transaction_type: 'connect',
        agent_email: agentInfo.email,
        agent_name: agentInfo.name,
        agent_associate_id: agentInfo.associateId,
        agent_rga_team: agentInfo.rgaTeam,
        agent_mga_team: agentInfo.mgaTeam,
        transaction_date: transactionDate,
        amount_usd: 8.0,
        credits_charged: 0,
        lead_name: transfer.name || `${transfer.firstName || ''} ${transfer.lastName || ''}`.trim() || null,
        lead_phone: transfer.phone || null,
        source_table: 'vdp_calls',
        source_id: vdpCall?.id || null, // Use vdp_call ID if found
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

      // Upsert billing transaction (update if exists, insert if not)
      const { error: upsertError } = await supabaseAdmin
        .from('billing_transactions')
        .upsert(transaction, { onConflict: 'transaction_id' });

      if (upsertError) {
        throw upsertError;
      } else {
        console.log(`   ✅ Upserted billing_transaction: ${transaction.transaction_id}`);
        console.log(`      Agent: ${transaction.agent_email} (ID: ${transaction.agent_associate_id || 'N/A'})`);
      }

      // Trigger analysis
      console.log(`   🔍 Triggering analysis...`);
      await scheduler.analyzeCall(transaction);
      
      imported++;
      console.log(`   ✅ Successfully imported and queued for analysis\n`);
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Import complete: ${imported} succeeded, ${failed} failed`);
}

import5Entries().catch(console.error);
