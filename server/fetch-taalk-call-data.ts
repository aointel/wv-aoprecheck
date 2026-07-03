/**
 * Fetch last 5 calls directly from Taalk API
 * Maps to CSV columns: Date, Phone, Duration, Transferred, Duration After Transfer, Agent
 */

import { supabaseAdmin } from './supabase';
import { sendEmail } from './email-service';

const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

interface TaalkCall {
  _id: string;
  status?: string;
  name?: string;
  phone?: string;
  serverNumber?: string;
  duration?: number; // in milliseconds
  durationAfterTransfer?: number; // in milliseconds
  hasRedirectCall?: boolean;
  agent?: string;
  params?: {
    Taalk_ClientPhone?: string;
    Taalk_MemberPhone?: string;
    Taalk_Persona?: string;
    [key: string]: any;
  };
  createdAt?: string;
  created_at?: string;
  [key: string]: any;
}

async function fetchTaalkCallDetails(taalkCallId: string): Promise<TaalkCall | null> {
  try {
    const callUrl = `https://api.taalk.ai/api/calls/${taalkCallId}?db=michaelmandella`;
    const response = await fetch(callUrl, {
      headers: { 'Authorization': `Bearer ${taalkApiKey}` }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch call ${taalkCallId}: ${response.status} ${response.statusText}`);
      console.error(`   Error details: ${errorText.substring(0, 500)}`);
      return null;
    }
    
    const data = await response.json();
    
    // Log full response to see what's available
    console.log(`\n🔍 FULL API RESPONSE for call ${taalkCallId}:`, JSON.stringify(data, null, 2));
    
    // API returns data in payload object, extract it
    const callData = data.payload || data;
    
    // Try to fetch persona/agent name from Taalk API using agent ID
    if (callData.agent) {
      try {
        const agentUrl = `https://api.taalk.ai/api/agents/${callData.agent}?db=michaelmandella`;
        const agentResponse = await fetch(agentUrl, {
          headers: { 'Authorization': `Bearer ${taalkApiKey}` }
        });
        if (agentResponse.ok) {
          const agentData = await agentResponse.json();
          console.log(`  🤖 Agent/Persona data:`, JSON.stringify(agentData, null, 2));
          if (agentData.payload) {
            callData.agentDetails = agentData.payload;
            // Extract persona name if available
            if (agentData.payload.name) {
              callData.personaName = agentData.payload.name;
            } else if (agentData.payload.persona) {
              callData.personaName = agentData.payload.persona;
            }
          }
        }
      } catch (e) {
        console.log(`  ⚠️ Could not fetch agent details: ${e}`);
      }
    }
    
    // Also try fetching transcript/summary endpoints which might have persona info
    try {
      const summaryUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/summary?db=michaelmandella`;
      const summaryResponse = await fetch(summaryUrl, {
        headers: { 'Authorization': `Bearer ${taalkApiKey}` }
      });
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        if (summaryData.payload && Array.isArray(summaryData.payload.summary)) {
          // Extract persona name from summary if available (e.g., "Agent: Alex")
          const preview = summaryData.payload.summary.find((s: any) => s.key === 'PREVIEW');
          if (preview && preview.value) {
            const agentMatch = preview.value.match(/Agent:\s*([^,]+)/);
            if (agentMatch) {
              callData.personaNameFromSummary = agentMatch[1].trim();
            }
          }
        }
      }
    } catch (e) {
      // Ignore summary errors
    }
    
    return callData;
  } catch (error: any) {
    console.error(`❌ Error fetching call ${taalkCallId}:`, error.message);
    return null;
  }
}

function formatDuration(milliseconds: number | undefined): string {
  if (milliseconds === undefined || milliseconds === null) return '';
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

async function fetchAllTaalkCalls(limit: number = 100, startDate?: string, endDate?: string): Promise<TaalkCall[]> {
  try {
    const allCalls: TaalkCall[] = [];
    let offset = 0;
    const pageSize = 20; // API seems to return max 20 per request
    
    while (allCalls.length < limit) {
      const url = `https://api.taalk.ai/api/calls?db=michaelmandella&limit=${pageSize}&offset=${offset}&tz=America/Los_Angeles`;
      
      console.log(`📞 Fetching calls ${offset + 1}-${offset + pageSize} from Taalk API...`);
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${taalkApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to fetch calls: ${response.status} ${response.statusText}`);
        console.error(`   Error details: ${errorText.substring(0, 300)}`);
        break;
      }
      
      const data = await response.json();
      
      // API returns data in different structures - handle all cases
      let calls: TaalkCall[] = [];
      if (Array.isArray(data)) {
        calls = data;
      } else if (Array.isArray(data.payload)) {
        calls = data.payload;
      } else if (data.data && Array.isArray(data.data)) {
        calls = data.data;
      } else if (data.calls && Array.isArray(data.calls)) {
        calls = data.calls;
      }
      
      if (calls.length === 0) {
        break; // No more calls to fetch
      }
      
      allCalls.push(...calls);
      console.log(`   ✅ Fetched ${calls.length} calls (total: ${allCalls.length})`);
      
      if (calls.length < pageSize || allCalls.length >= limit) {
        break; // Reached end or limit
      }
      
      offset += pageSize;
      
      // Rate limiting between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Limit to requested number
    const limitedCalls = allCalls.slice(0, limit);
    console.log(`✅ Total fetched: ${limitedCalls.length} calls from Taalk API\n`);
    return limitedCalls;
  } catch (error: any) {
    console.error(`❌ Error fetching calls from Taalk API:`, error.message);
    return [];
  }
}

async function processCallsForDate(calls: TaalkCall[], targetDate: string): Promise<any[]> {
  // Filter calls for the specific date (24-hour period in PST/PDT)
  // Date format: "1/14/2026" (M/D/YYYY)
  const [month, day, year] = targetDate.split('/').map(Number);
  
  // Create date range in PST/PDT (America/Los_Angeles timezone)
  // Start of day: 00:00:00 PST/PDT
  // End of day: 23:59:59 PST/PDT
  const startOfDayPST = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-08:00`);
  const endOfDayPST = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59-08:00`);
  
  // Also try PDT (UTC-7) in case it's daylight saving time
  const startOfDayPDT = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-07:00`);
  const endOfDayPDT = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59-07:00`);
  
  // Use the earlier start and later end to cover both timezones
  const startUTC = Math.min(startOfDayPST.getTime(), startOfDayPDT.getTime());
  const endUTC = Math.max(endOfDayPST.getTime(), endOfDayPDT.getTime());
  
  const filteredCalls = calls.filter(call => {
    const callTimestamp = call.createdAt || call.created_at;
    if (!callTimestamp) return false;
    
    // Parse the call date
    const callDateObj = new Date(callTimestamp);
    const callYear = callDateObj.getFullYear();
    const callMonth = callDateObj.getMonth() + 1; // getMonth() returns 0-11
    const callDay = callDateObj.getDate();
    
    // Compare with target date
    const [targetMonth, targetDay, targetYear] = targetDate.split('/').map(Number);
    
    // Check if the call date matches the target date (ignoring time)
    const dateMatches = callYear === targetYear && callMonth === targetMonth && callDay === targetDay;
    
    return dateMatches;
  });
  
  console.log(`📅 Filtered ${filteredCalls.length} calls for date ${targetDate} (from ${calls.length} total calls)`);
  
  const csvData: any[] = [];
  let errors = 0;
  
  for (const callData of filteredCalls) {
    try {
      const callDate = callData.createdAt || callData.created_at
        ? new Date(callData.createdAt || callData.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
        : '';
      
      // Extract phone
      let phone = '';
      if (callData.params?.Taalk_ClientPhone) {
        phone = callData.params.Taalk_ClientPhone.replace(/[+\s-()]/g, '');
      } else if (callData.params?.Taalk_MemberPhone) {
        phone = callData.params.Taalk_MemberPhone.replace(/[+\s-()]/g, '');
      } else if (callData.phone) {
        if (callData.phone.startsWith('+')) {
          phone = callData.phone.replace(/[+\s-()]/g, '');
        } else {
          const phoneParts = callData.phone.split(',');
          for (let i = 1; i < phoneParts.length; i++) {
            const part = phoneParts[i];
            if (part && part.includes('#')) {
              const cleaned = part.split('#')[0].trim();
              if (cleaned && cleaned.length >= 10 && /^\d+$/.test(cleaned)) {
                phone = cleaned;
                break;
              }
            }
          }
          if (!phone && phoneParts[0]) {
            const firstPart = phoneParts[0].replace(/[+\s-()]/g, '');
            if (firstPart && firstPart.length >= 10 && /^\d+$/.test(firstPart)) {
              phone = firstPart;
            }
          }
        }
      }
      
      // Duration
      let duration = '0:00';
      if (callData.duration !== undefined && callData.duration !== null && typeof callData.duration === 'number') {
        duration = formatDuration(callData.duration);
      }
      
      // Duration after transfer
      let durationAfterTransfer = '0:00';
      if (callData.durationAfterTransfer !== undefined && callData.durationAfterTransfer !== null && typeof callData.durationAfterTransfer === 'number') {
        durationAfterTransfer = formatDuration(callData.durationAfterTransfer);
      }
      
      // Transferred status
      const hasRedirect = callData.hasRedirectCall === true;
      const hasDurationAfterTransfer = callData.durationAfterTransfer !== undefined && callData.durationAfterTransfer !== null && callData.durationAfterTransfer > 0;
      const transferred = (hasRedirect || hasDurationAfterTransfer) ? 'Yes' : 'No';
      
      // Persona
      let persona = '';
      if (callData.agent) {
        try {
          const agentUrl = `https://api.taalk.ai/api/agents/${callData.agent}?db=michaelmandella`;
          const agentResponse = await fetch(agentUrl, {
            headers: { 'Authorization': `Bearer ${taalkApiKey}` }
          });
          if (agentResponse.ok) {
            const agentData = await agentResponse.json();
            let personaName = '';
            if (agentData.payload?.triggerName) {
              personaName = agentData.payload.triggerName;
            } else if (agentData.payload?.name) {
              personaName = agentData.payload.name;
            }
            if (personaName) {
              persona = `${personaName}(${callData.agent})`;
            } else {
              persona = callData.agent;
            }
          } else {
            persona = callData.agent;
          }
        } catch (e) {
          persona = callData.agent || '';
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      csvData.push({
        Date: callDate,
        Phone: phone,
        Duration: duration,
        Transferred: transferred,
        'Duration After Transfer': durationAfterTransfer,
        Persona: persona
      });
    } catch (error: any) {
      console.error(`  ❌ Error processing call ${callData._id}:`, error.message);
      errors++;
    }
  }
  
  return csvData;
}

async function generateAndEmailDateCSV(dateStr: string, calls: TaalkCall[]) {
  const csvData = await processCallsForDate(calls, dateStr);
  
  if (csvData.length === 0) {
    console.log(`⚠️  No calls found for date ${dateStr}, skipping CSV generation`);
    return;
  }
  
  const columns = ['Date', 'Phone', 'Duration', 'Transferred', 'Duration After Transfer', 'Persona'];
  const csvRows = csvData.map(row => {
    return columns.map(col => {
      const val = row[col] || '';
      const strVal = String(val);
      if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
        return `"${strVal.replace(/"/g, '""')}"`;
      }
      return strVal;
    }).join(',');
  });
  
  const csvContent = [columns.join(','), ...csvRows].join('\n');
  
  // Generate filename from date (e.g., "1-14-2026.csv")
  const dateParts = dateStr.split('/');
  const filename = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}.csv`;
  const fs = await import('fs');
  fs.writeFileSync(filename, csvContent, 'utf-8');
  console.log(`✅ CSV written to ${filename} (${csvData.length} calls)`);
  
  // Email the CSV
  try {
    const emailSent = await sendEmail({
      to: 'michaelmandella@aoglobelife.com',
      subject: `Taalk Call Data - ${dateStr}`,
      html: `<p>Attached is the call data for ${dateStr}.</p><p>Total calls: ${csvData.length}</p>`,
      attachments: [{
        filename: filename,
        content: csvContent,
        contentType: 'text/csv'
      }]
    });
    
    if (emailSent) {
      console.log(`✅ Email sent successfully for ${dateStr}`);
    } else {
      console.error(`❌ Failed to send email for ${dateStr}`);
    }
  } catch (emailError: any) {
    console.error(`❌ Error sending email for ${dateStr}:`, emailError?.message || emailError);
  }
}

async function fetchAndExportCallData(testMode: boolean = false) {
  console.log('\n🔄 FETCHING LAST 1000 CALLS DIRECTLY FROM TALK API\n');
  console.log('='.repeat(60));

  try {
    // Query Taalk API directly for last 1000 calls
    const calls = await fetchAllTaalkCalls(1000);
    
    if (calls.length === 0) {
      console.log('✅ No calls found in Taalk API');
      return;
    }
    
    console.log(`📊 Processing ${calls.length} calls...\n`);
    
    const csvData: any[] = [];
    let errors = 0;
    
    for (const callData of calls) {
      try {
        // Debug: Log calls with transfers to see what fields indicate a transfer
        if (callData.hasRedirectCall === true || (callData.durationAfterTransfer !== undefined && callData.durationAfterTransfer !== null && callData.durationAfterTransfer > 0)) {
          console.log(`\n🔍 DEBUG: Found call with transfer - ID: ${callData._id}`);
          console.log(`   hasRedirectCall: ${callData.hasRedirectCall}`);
          console.log(`   durationAfterTransfer: ${callData.durationAfterTransfer}`);
          console.log(`   transferType: ${callData.transferType}`);
          console.log(`   Full data:`, JSON.stringify(callData, null, 2).substring(0, 2000));
        }
        
        // DUMP ALL DATA - extract everything from the API response
        const callDate = callData.createdAt || callData.created_at
          ? new Date(callData.createdAt || callData.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
          : '';
        
        // Extract phone - prefer client phone from params, then from phone field
        let phone = '';
        if (callData.params?.Taalk_ClientPhone) {
          phone = callData.params.Taalk_ClientPhone.replace(/[+\s-()]/g, '');
        } else if (callData.params?.Taalk_MemberPhone) {
          phone = callData.params.Taalk_MemberPhone.replace(/[+\s-()]/g, '');
        } else if (callData.phone) {
          // Handle formats: "+12064715110" or "6692192599,,5897015416#,,#,,1#"
          if (callData.phone.startsWith('+')) {
            // Simple format: just remove + and formatting
            phone = callData.phone.replace(/[+\s-()]/g, '');
          } else {
            // Complex format: extract from "6692192599,,5897015416#,,#,,1#"
            const phoneParts = callData.phone.split(',');
            for (let i = 1; i < phoneParts.length; i++) {
              const part = phoneParts[i];
              if (part && part.includes('#')) {
                const cleaned = part.split('#')[0].trim();
                if (cleaned && cleaned.length >= 10 && /^\d+$/.test(cleaned)) {
                  phone = cleaned;
                  break;
                }
              }
            }
            // If no phone found in complex format, try first part
            if (!phone && phoneParts[0]) {
              const firstPart = phoneParts[0].replace(/[+\s-()]/g, '');
              if (firstPart && firstPart.length >= 10 && /^\d+$/.test(firstPart)) {
                phone = firstPart;
              }
            }
          }
        }
        
        // Duration - ALWAYS extract from Taalk API (in milliseconds), format to MM:SS
        // Every call has a duration field from Taalk API
        let duration = '0:00';
        if (callData.duration !== undefined && callData.duration !== null && typeof callData.duration === 'number') {
          duration = formatDuration(callData.duration);
        }
        
        // Duration after transfer - ALWAYS extract from Taalk API (in milliseconds), format to MM:SS
        let durationAfterTransfer = '0:00';
        if (callData.durationAfterTransfer !== undefined && callData.durationAfterTransfer !== null && typeof callData.durationAfterTransfer === 'number') {
          durationAfterTransfer = formatDuration(callData.durationAfterTransfer);
        }
        
        // Transferred status - ALWAYS show Yes or No
        // ONLY check hasRedirectCall === true OR durationAfterTransfer > 0 (actual transfer happened)
        const hasRedirect = callData.hasRedirectCall === true;
        const hasDurationAfterTransfer = callData.durationAfterTransfer !== undefined && callData.durationAfterTransfer !== null && callData.durationAfterTransfer > 0;
        const transferred = (hasRedirect || hasDurationAfterTransfer) ? 'Yes' : 'No';
        
        // Debug: Log if we found a transfer
        if (transferred === 'Yes') {
          console.log(`✅ Marking call ${callData._id} as transferred - hasRedirectCall: ${callData.hasRedirectCall}, durationAfterTransfer: ${callData.durationAfterTransfer}`);
        }
        
        // Persona - get from agent details API, format as "Name(agent_id)"
        let persona = '';
        if (callData.agent) {
          try {
            const agentUrl = `https://api.taalk.ai/api/agents/${callData.agent}?db=michaelmandella`;
            const agentResponse = await fetch(agentUrl, {
              headers: { 'Authorization': `Bearer ${taalkApiKey}` }
            });
            if (agentResponse.ok) {
              const agentData = await agentResponse.json();
              let personaName = '';
              if (agentData.payload?.triggerName) {
                personaName = agentData.payload.triggerName;
              } else if (agentData.payload?.name) {
                personaName = agentData.payload.name;
              }
              // Format as "Name(agent_id)"
              if (personaName) {
                persona = `${personaName}(${callData.agent})`;
              } else {
                persona = callData.agent; // Just use agent ID if no name found
              }
            } else {
              // If agent API fails, just use agent ID
              persona = callData.agent;
            }
          } catch (e) {
            // If error, use agent ID as fallback
            persona = callData.agent || '';
          }
          // Rate limiting - wait a bit between agent API calls
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        
        // Extract only required fields for CSV
        const allData: any = {
          Date: callDate,
          Phone: phone,
          Duration: duration,
          Transferred: transferred,
          'Duration After Transfer': durationAfterTransfer,
          Persona: persona
        };
        
        csvData.push(allData);
        
      } catch (error: any) {
        console.error(`  ❌ Error processing call ${callData._id}:`, error.message);
        errors++;
      }
    }
    
    // Fixed column order for CSV
    const columns = ['Date', 'Phone', 'Duration', 'Transferred', 'Duration After Transfer', 'Persona'];
    
    // Display CSV data
    console.log('\n📋 CSV DATA:');
    console.log('='.repeat(60));
    console.log(columns.join(','));
    csvData.forEach(row => {
      console.log(columns.map(col => {
        const val = row[col] || '';
        // Escape commas and quotes in CSV values
        if (String(val).includes(',') || String(val).includes('"') || String(val).includes('\n')) {
          return `"${String(val).replace(/"/g, '""')}"`;
        }
        return val;
      }).join(','));
    });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Processed: ${csvData.length} calls`);
    console.log(`   ❌ Errors: ${errors} calls`);
    
    // Write to CSV file with ALL columns (columns already defined above)
    const fs = await import('fs');
    
    // Build CSV content with proper escaping
    const csvRows = csvData.map(row => {
      return columns.map(col => {
        const val = row[col] || '';
        const strVal = String(val);
        // Escape commas, quotes, and newlines
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(',');
    });
    
    const csvContent = [columns.join(','), ...csvRows].join('\n');
    
    const outputFile = 'Book1.csv';
    fs.writeFileSync(outputFile, csvContent, 'utf-8');
    console.log(`\n✅ CSV data written to ${outputFile}\n`);

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
  }
}

async function generateDateSpecificCSVs() {
  console.log('\n🔄 GENERATING DATE-SPECIFIC CSVs AND EMAILING THEM\n');
  console.log('='.repeat(60));
  
  // Dates to process: 1/14, 1/15, 1/16, 1/17, 1/18, 1/19 (all 2026)
  const dates = ['1/14/2026', '1/15/2026', '1/16/2026', '1/17/2026', '1/18/2026', '1/19/2026'];
  
  try {
    // Fetch a large batch of calls (enough to cover all dates)
    // We'll fetch 5000 calls to ensure we get all calls from these dates
    console.log('📞 Fetching calls from Taalk API (this may take a while)...');
    const allCalls = await fetchAllTaalkCalls(5000);
    
    if (allCalls.length === 0) {
      console.log('❌ No calls found in Taalk API');
      return;
    }
    
    console.log(`✅ Fetched ${allCalls.length} total calls\n`);
    
    // Process each date
    for (const date of dates) {
      console.log(`\n📅 Processing date: ${date}`);
      await generateAndEmailDateCSV(date, allCalls);
      // Small delay between dates to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✅ All date-specific CSVs generated and emailed!\n');
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
  }
}

// Run if called directly
const isTestMode = process.argv.includes('--test') || process.argv.includes('-t');
const isDateMode = process.argv.includes('--dates') || process.argv.includes('-d');

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('fetch-taalk-call-data')) {
  if (isDateMode) {
    generateDateSpecificCSVs()
      .then(() => {
        console.log('✅ Script completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
      });
  } else {
    fetchAndExportCallData(isTestMode)
      .then(() => {
        console.log('✅ Script completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
      });
  }
}

export { fetchAndExportCallData };
