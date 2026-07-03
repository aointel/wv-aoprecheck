/**
 * Send leads from pavetfix.csv to VN and PAVET campaigns
 * 
 * Distribution Logic:
 * - All leads have "No-Cost Burial and Will Kit for Veterans" (Veteran-related)
 * - Taalk_GroupCode "PAVET" → PAVET campaign
 * - Taalk_GroupCode "VBEU1" → PAVET campaign (all are Veteran-related)
 * - Empty Taalk_GroupCode → PAVET campaign (based on group name)
 * - Match by Taalk_State to campaign mapping
 */

import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

interface CampaignMapping {
  campaignId: string;
  campaignName: string;
  state: string;
  type: 'VN' | 'PAVET';
}

interface CSVLead {
  Taalk_LeadId: string;
  firstName: string;
  lastName: string;
  Taalk_Address: string;
  phone: string;
  CellPhone: string;
  Email: string;
  Taalk_City: string;
  Taalk_State: string;
  Talk_Zip: string;
  Taalk_GroupCode: string;
  Taalk_secretkey?: string;
  Taalk_GroupName: string;
  Taalk_Market?: string;
}

/**
 * Load campaign mappings from CSV
 */
function loadCampaignMappings(): Map<string, CampaignMapping> {
  const csvPath = path.join(process.cwd(), 'vn-pavet-campaigns.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) return new Map();
  
  // Parse header
  const header = parseCSVLine(lines[0]);
  const mappings = new Map<string, CampaignMapping>();
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length < header.length) continue;
    
    const campaign: any = {};
    header.forEach((col, index) => {
      campaign[col] = values[index] || '';
    });
    
    const campaignId = campaign.campaignId?.trim();
    const campaignName = campaign.campaignName?.trim();
    const state = campaign.state?.trim();
    const type = campaign.type?.trim();
    
    if (!campaignId || !state || !type) continue;
    
    // Create key: "PAVET-CA" or "VN-CA"
    const key = `${type}-${state}`;
    
    mappings.set(key, {
      campaignId,
      campaignName: campaignName || '',
      state,
      type: type as 'VN' | 'PAVET'
    });
  }
  
  return mappings;
}

/**
 * Parse CSV line (handling quoted fields)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
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

/**
 * Load leads from pavetfix.csv
 */
function loadLeadsFromCSV(): CSVLead[] {
  const csvPath = path.join(process.cwd(), 'asdfa.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) return [];
  
  // Parse header
  const header = parseCSVLine(lines[0]);
  const leads: CSVLead[] = [];
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length < header.length) continue;
    
    const lead: any = {};
    header.forEach((col, index) => {
      lead[col] = values[index] || '';
    });
    
    leads.push(lead as CSVLead);
  }
  
  return leads;
}

/**
 * Normalize state to 2-letter uppercase code
 */
function normalizeState(state: string | null | undefined): string | null {
  if (!state || state.trim() === '') return null;
  
  const upperState = state.trim().toUpperCase();
  
  // If already 2 letters, return as-is
  if (upperState.length === 2) {
    return upperState;
  }
  
  // Full state name to abbreviation mapping
  const stateMap: { [key: string]: string } = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
    'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
    'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
    'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
    'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
    'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC'
  };
  
  return stateMap[upperState] || upperState;
}

/**
 * Determine campaign type from Taalk_GroupCode
 * All leads in this CSV are Veteran-related, so default to PAVET
 */
function getCampaignType(groupCode: string | null | undefined): 'PAVET' {
  // All leads in pavetfix.csv are "No-Cost Burial and Will Kit for Veterans"
  // So they all go to PAVET campaigns regardless of group code
  return 'PAVET';
}

/**
 * Format phone number for Taalk (E.164 format)
 */
function formatPhoneForTaalk(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If it's 10 digits, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it's 11 digits and starts with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it already has +, return as-is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Default: add +1
  return `+1${digits}`;
}

/**
 * Send lead to Taalk campaign
 */
async function sendLeadToCampaign(
  lead: CSVLead,
  campaignId: string,
  campaignName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use CellPhone if available, otherwise use phone
    const phoneNumber = lead.CellPhone?.trim() || lead.phone?.trim();
    
    if (!phoneNumber) {
      return {
        success: false,
        error: 'No phone number available'
      };
    }
    
    const contact: any = {
      phone: formatPhoneForTaalk(phoneNumber),
      firstName: lead.firstName?.trim() || 'Unknown',
      lastName: lead.lastName?.trim() || 'Unknown'
    };
    
    // Add all Taalk_ prefixed fields and other fields from CSV
    if (lead.Taalk_LeadId) contact.Taalk_LeadId = lead.Taalk_LeadId.trim();
    if (lead.Taalk_Address) contact.Taalk_Address = lead.Taalk_Address.trim();
    if (lead.Email) contact.Taalk_Email = lead.Email.trim();
    if (lead.Taalk_City) contact.Taalk_City = lead.Taalk_City.trim();
    if (lead.Taalk_State) contact.Taalk_State = lead.Taalk_State.trim();
    if (lead.Talk_Zip) contact.Talk_Zip = lead.Talk_Zip.trim();
    if (lead.Taalk_GroupCode) contact.Taalk_GroupCode = lead.Taalk_GroupCode.trim();
    if (lead.Taalk_secretkey) contact.Taalk_secretkey = lead.Taalk_secretkey.trim();
    if (lead.Taalk_GroupName) contact.Taalk_GroupName = lead.Taalk_GroupName.trim();
    if (lead.Taalk_secretkey) contact.Taalk_secretkey = lead.Taalk_secretkey.trim();
    if (lead.Taalk_Market) contact.Taalk_Market = lead.Taalk_Market.trim();
    
    const requestBody = {
      append: [contact]
    };
    
    // Log the contact data being sent
    console.log(`   📋 Sending contact with fields: ${Object.keys(contact).join(', ')}`);
    console.log(`   📋 Contact data: ${JSON.stringify(contact).substring(0, 300)}...`);
    
    const response = await fetch(
      `https://api.taalk.ai/api/campaign2s/${campaignId}/contacts?db=michaelmandella`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TAALK_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    const responseText = await response.text();
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText.substring(0, 200)}`
      };
    }
    
    // Log the API response to verify contact was added
    try {
      const result = JSON.parse(responseText);
      // Check if response indicates successful contact addition
      if (result.payload) {
        console.log(`   ✅ Contact added to campaign: ${result.payload.name || 'Unknown'}`);
      } else if (result.success !== false) {
        console.log(`   ✅ API returned success response`);
      } else {
        console.log(`   📋 API Response: ${JSON.stringify(result).substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`   ✅ API returned 200 OK status`);
    }
    
    return { success: true };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function sendLeadsFromCSV() {
  console.log('\n🚀 Sending leads from asdfa.csv to campaigns...\n');
  console.log('═'.repeat(100));
  
  try {
    // Load campaign mappings
    console.log('\n📋 Loading campaign mappings from vn-pavet-campaigns.csv...');
    const campaignMappings = loadCampaignMappings();
    console.log(`✅ Loaded ${campaignMappings.size} campaign mappings\n`);
    
    // Load leads from CSV
    console.log('📥 Loading leads from asdfa.csv...');
    const leads = loadLeadsFromCSV();
    console.log(`✅ Loaded ${leads.length} total leads from CSV`);
    console.log(`🚀 Processing all ${leads.length} leads\n`);
    
    // Analyze leads (for the test batch)
    const groupCodeBreakdown = new Map<string, number>();
    const stateBreakdown = new Map<string, number>();
    
    for (const lead of leads) {
      const groupCode = lead.Taalk_GroupCode?.trim() || '(empty)';
      groupCodeBreakdown.set(groupCode, (groupCodeBreakdown.get(groupCode) || 0) + 1);
      
      const state = lead.Taalk_State?.trim() || '(empty)';
      stateBreakdown.set(state, (stateBreakdown.get(state) || 0) + 1);
    }
    
    console.log('📊 Lead Analysis:\n');
    console.log('Taalk_GroupCode breakdown:');
    Array.from(groupCodeBreakdown.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([code, count]) => {
        console.log(`   ${code}: ${count} leads`);
      });
    
    console.log(`\nTotal unique states in test batch: ${stateBreakdown.size}`);
    console.log(`Leads with empty state: ${stateBreakdown.get('(empty)') || 0}\n`);
    
    // Process leads
    let sent = 0;
    let skipped = 0;
    let errors = 0;
    const errorsList: Array<{ lead: CSVLead; error: string }> = [];
    const skippedList: Array<{ lead: CSVLead; reason: string }> = [];
    
    console.log('🔄 Processing leads...\n');
    
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      
      // Determine campaign type (all PAVET for this CSV)
      const campaignType = getCampaignType(lead.Taalk_GroupCode);
      
      // Get state
      const state = normalizeState(lead.Taalk_State);
      if (!state) {
        const reason = `No valid state (Taalk_State: "${lead.Taalk_State}")`;
        skippedList.push({ lead, reason });
        console.log(`⏭️  [${i + 1}/${leads.length}] Skipping lead ${lead.Taalk_LeadId}: ${reason}`);
        skipped++;
        continue;
      }
      
      // Find matching campaign
      const key = `${campaignType}-${state}`;
      const campaign = campaignMappings.get(key);
      
      if (!campaign) {
        const reason = `No campaign found for ${campaignType}-${state}`;
        skippedList.push({ lead, reason });
        console.log(`⏭️  [${i + 1}/${leads.length}] Skipping lead ${lead.Taalk_LeadId}: ${reason}`);
        skipped++;
        continue;
      }
      
      // Check for phone number
      const phoneNumber = lead.CellPhone?.trim() || lead.phone?.trim();
      if (!phoneNumber) {
        const reason = 'No phone number available';
        skippedList.push({ lead, reason });
        console.log(`⏭️  [${i + 1}/${leads.length}] Skipping lead ${lead.Taalk_LeadId}: ${reason}`);
        skipped++;
        continue;
      }
      
      // Send lead to campaign
      console.log(`📤 [${i + 1}/${leads.length}] Sending lead ${lead.Taalk_LeadId} (${lead.firstName} ${lead.lastName}, ${state}, ${lead.Taalk_GroupCode || 'empty'}) to ${campaign.campaignName}...`);
      
      const result = await sendLeadToCampaign(lead, campaign.campaignId, campaign.campaignName);
      
      if (result.success) {
        console.log(`   ✅ Success`);
        sent++;
      } else {
        console.log(`   ❌ Error: ${result.error}`);
        errors++;
        errorsList.push({ lead, error: result.error || 'Unknown error' });
      }
      
      // Rate limiting - small delay between requests
      if (i < leads.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Summary
    console.log('\n' + '═'.repeat(100));
    console.log('\n📊 SUMMARY:\n');
    console.log(`   Total leads processed: ${leads.length}`);
    console.log(`   ✅ Successfully sent: ${sent}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    
    if (skippedList.length > 0 && skippedList.length <= 20) {
      console.log('\n⏭️  Skipped leads (first 20):\n');
      skippedList.slice(0, 20).forEach(({ lead, reason }) => {
        console.log(`   Lead ${lead.Taalk_LeadId} (${lead.firstName} ${lead.lastName}): ${reason}`);
      });
    }
    
    if (errorsList.length > 0) {
      console.log('\n❌ Errors (first 20):\n');
      errorsList.slice(0, 20).forEach(({ lead, error }) => {
        console.log(`   Lead ${lead.Taalk_LeadId} (${lead.firstName} ${lead.lastName}): ${error}`);
      });
      if (errorsList.length > 20) {
        console.log(`   ... and ${errorsList.length - 20} more errors`);
      }
    }
    
    console.log('\n' + '═'.repeat(100));
    console.log('\n✅ Done!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
sendLeadsFromCSV().catch(console.error);

