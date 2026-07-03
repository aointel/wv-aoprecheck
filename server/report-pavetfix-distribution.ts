/**
 * Report: Where leads from pavetfix.csv WOULD be distributed
 * (Dry-run report without actually sending to campaigns)
 */

import * as fs from 'fs';
import * as path from 'path';

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
  Taalk_secretkey: string;
  Taalk_GroupName: string;
}

interface DistributionResult {
  lead: CSVLead;
  campaign?: CampaignMapping;
  reason: string;
  status: 'matched' | 'no_state' | 'no_phone' | 'no_campaign';
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
 * Load leads from pavetfix.csv
 */
function loadLeadsFromCSV(): CSVLead[] {
  const csvPath = path.join(process.cwd(), 'pavetfix.csv');
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
 * Generate distribution report
 */
function generateDistributionReport() {
  console.log('\n📊 DISTRIBUTION REPORT: pavetfix.csv Leads\n');
  console.log('═'.repeat(100));
  
  // Load data
  console.log('\n📋 Loading campaign mappings...');
  const campaignMappings = loadCampaignMappings();
  console.log(`✅ Loaded ${campaignMappings.size} campaign mappings`);
  
  console.log('\n📥 Loading leads from pavetfix.csv...');
  const leads = loadLeadsFromCSV();
  console.log(`✅ Loaded ${leads.length} leads\n`);
  
  // Process each lead
  const results: DistributionResult[] = [];
  const campaignDistribution = new Map<string, number>(); // campaignId -> count
  const stateDistribution = new Map<string, number>(); // state -> count
  const statusCounts = new Map<string, number>();
  
  console.log('🔄 Analyzing leads...\n');
  
  for (const lead of leads) {
    let result: DistributionResult;
    
    // Check for phone number
    const phoneNumber = lead.CellPhone?.trim() || lead.phone?.trim();
    if (!phoneNumber) {
      result = {
        lead,
        reason: 'No phone number available',
        status: 'no_phone'
      };
      results.push(result);
      statusCounts.set('no_phone', (statusCounts.get('no_phone') || 0) + 1);
      continue;
    }
    
    // Get state
    const state = normalizeState(lead.Taalk_State);
    if (!state) {
      result = {
        lead,
        reason: `No valid state (Taalk_State: "${lead.Taalk_State}")`,
        status: 'no_state'
      };
      results.push(result);
      statusCounts.set('no_state', (statusCounts.get('no_state') || 0) + 1);
      continue;
    }
    
    // Find matching campaign (all PAVET for this CSV)
    const key = `PAVET-${state}`;
    const campaign = campaignMappings.get(key);
    
    if (!campaign) {
      result = {
        lead,
        reason: `No PAVET campaign found for state: ${state}`,
        status: 'no_campaign'
      };
      results.push(result);
      statusCounts.set('no_campaign', (statusCounts.get('no_campaign') || 0) + 1);
      continue;
    }
    
    // Successfully matched
    result = {
      lead,
      campaign,
      reason: 'Would be sent to campaign',
      status: 'matched'
    };
    results.push(result);
    
    // Update distribution counts
    campaignDistribution.set(campaign.campaignId, (campaignDistribution.get(campaign.campaignId) || 0) + 1);
    stateDistribution.set(state, (stateDistribution.get(state) || 0) + 1);
    statusCounts.set('matched', (statusCounts.get('matched') || 0) + 1);
  }
  
  // Print Summary
  console.log('═'.repeat(100));
  console.log('\n📊 SUMMARY\n');
  console.log(`Total leads analyzed: ${leads.length}`);
  console.log(`✅ Would be distributed: ${statusCounts.get('matched') || 0}`);
  console.log(`⏭️  Skipped (no state): ${statusCounts.get('no_state') || 0}`);
  console.log(`⏭️  Skipped (no phone): ${statusCounts.get('no_phone') || 0}`);
  console.log(`⏭️  Skipped (no campaign): ${statusCounts.get('no_campaign') || 0}`);
  
  // Distribution by Campaign
  console.log('\n' + '═'.repeat(100));
  console.log('\n🎯 DISTRIBUTION BY CAMPAIGN\n');
  
  const campaignEntries = Array.from(campaignDistribution.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20); // Top 20 campaigns
  
  console.log('Campaign ID'.padEnd(30) + ' | ' + 'Campaign Name'.padEnd(40) + ' | ' + 'Leads'.padEnd(10));
  console.log('-'.repeat(100));
  
  for (const [campaignId, count] of campaignEntries) {
    const campaign = Array.from(campaignMappings.values()).find(c => c.campaignId === campaignId);
    const campaignName = campaign?.campaignName || 'Unknown';
    console.log(
      campaignId.padEnd(30) + ' | ' +
      campaignName.substring(0, 40).padEnd(40) + ' | ' +
      count.toString().padStart(10)
    );
  }
  
  if (campaignDistribution.size > 20) {
    console.log(`\n... and ${campaignDistribution.size - 20} more campaigns`);
  }
  
  // Distribution by State
  console.log('\n' + '═'.repeat(100));
  console.log('\n🗺️  DISTRIBUTION BY STATE\n');
  
  const stateEntries = Array.from(stateDistribution.entries())
    .sort((a, b) => b[1] - a[1]);
  
  console.log('State'.padEnd(10) + ' | ' + 'Leads'.padEnd(10) + ' | Campaign');
  console.log('-'.repeat(80));
  
  for (const [state, count] of stateEntries) {
    const key = `PAVET-${state}`;
    const campaign = campaignMappings.get(key);
    const campaignName = campaign?.campaignName || 'No campaign';
    
    console.log(
      state.padEnd(10) + ' | ' +
      count.toString().padStart(10) + ' | ' +
      campaignName
    );
  }
  
  // Status Breakdown
  console.log('\n' + '═'.repeat(100));
  console.log('\n📈 STATUS BREAKDOWN\n');
  
  console.log('Status'.padEnd(20) + ' | ' + 'Count'.padEnd(10) + ' | ' + 'Percentage');
  console.log('-'.repeat(50));
  
  for (const [status, count] of Array.from(statusCounts.entries()).sort((a, b) => b[1] - a[1])) {
    const percentage = ((count / leads.length) * 100).toFixed(2);
    const statusLabel = status === 'matched' ? '✅ Matched' :
                       status === 'no_state' ? '⏭️  No State' :
                       status === 'no_phone' ? '⏭️  No Phone' :
                       status === 'no_campaign' ? '⏭️  No Campaign' : status;
    
    console.log(
      statusLabel.padEnd(20) + ' | ' +
      count.toString().padStart(10) + ' | ' +
      percentage.padStart(8) + '%'
    );
  }
  
  // Export detailed CSV report
  console.log('\n' + '═'.repeat(100));
  console.log('\n💾 Generating detailed CSV report...\n');
  
  const reportCsv: string[] = [
    'Taalk_LeadId,firstName,lastName,phone,Taalk_State,normalizedState,Taalk_GroupCode,status,campaignId,campaignName,reason'
  ];
  
  for (const result of results) {
    const lead = result.lead;
    const phone = lead.CellPhone?.trim() || lead.phone?.trim() || '';
    const normalizedState = normalizeState(lead.Taalk_State) || '';
    const campaignId = result.campaign?.campaignId || '';
    const campaignName = result.campaign?.campaignName.replace(/"/g, '""') || '';
    const reason = result.reason.replace(/"/g, '""');
    
    reportCsv.push(
      `"${lead.Taalk_LeadId}","${lead.firstName}","${lead.lastName}","${phone}","${lead.Taalk_State}","${normalizedState}","${lead.Taalk_GroupCode}","${result.status}","${campaignId}","${campaignName}","${reason}"`
    );
  }
  
  const reportPath = path.join(process.cwd(), 'pavetfix-distribution-report.csv');
  fs.writeFileSync(reportPath, reportCsv.join('\n'), 'utf-8');
  console.log(`✅ Detailed report saved to: pavetfix-distribution-report.csv`);
  
  console.log('\n' + '═'.repeat(100));
  console.log('\n✅ Report complete!\n');
}

// Run the report
generateDistributionReport();

