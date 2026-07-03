/**
 * Send leads from masterlead to VN and PAVET campaigns based on state and market
 * - Veteran market → PAVET campaign
 * - Globe market → VN campaign
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface CampaignMapping {
  campaignId: string;
  campaignName: string;
  state: string;
  type: 'VN' | 'PAVET';
}

interface Lead {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  taalk_market?: string;
  taalk_state?: string;
}

/**
 * Load campaign mappings from CSV
 */
function loadCampaignMappings(): Map<string, CampaignMapping> {
  const csvPath = path.join(process.cwd(), 'vn-pavet-campaigns.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  // Skip header
  const dataLines = lines.slice(1);
  
  const mappings = new Map<string, CampaignMapping>();
  
  for (const line of dataLines) {
    // Parse CSV line (handling quoted fields)
    const match = line.match(/^([^,]+),(".*?"|[^,]*),([^,]+),([^,]+)$/);
    if (!match) continue;
    
    const [, campaignId, campaignName, state, type] = match;
    const cleanCampaignName = campaignName.replace(/^"|"$/g, ''); // Remove quotes
    
    // Create key: "PAVET-CA" or "VN-CA"
    const key = `${type}-${state}`;
    
    mappings.set(key, {
      campaignId: campaignId.trim(),
      campaignName: cleanCampaignName,
      state: state.trim(),
      type: type.trim() as 'VN' | 'PAVET'
    });
  }
  
  return mappings;
}

/**
 * Normalize state to 2-letter uppercase code
 */
function normalizeState(state: string | null | undefined): string | null {
  if (!state) return null;
  
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
 * Determine campaign type from market
 */
function getCampaignType(market: string | null | undefined): 'VN' | 'PAVET' | null {
  if (!market) return null;
  
  const upperMarket = market.toUpperCase();
  
  if (upperMarket.includes('VETERAN') || upperMarket.includes('VET')) {
    return 'PAVET';
  }
  
  if (upperMarket.includes('GLOBE')) {
    return 'VN';
  }
  
  return null;
}

/**
 * Format phone number for Taalk (E.164 format)
 */
function formatPhoneForTaalk(phone: string): string {
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
  lead: Lead,
  campaignId: string,
  campaignName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const contact = {
      phone: formatPhoneForTaalk(lead.phone),
      firstName: lead.first_name || 'Unknown',
      lastName: lead.last_name || 'Unknown'
    };
    
    const requestBody = {
      append: [contact]
    };
    
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
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`
      };
    }
    
    return { success: true };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function sendLeadsToCampaigns() {
  console.log('\n🚀 Sending leads from masterlead to VN and PAVET campaigns...\n');
  console.log('═'.repeat(100));
  
  try {
    // Load campaign mappings
    console.log('\n📋 Loading campaign mappings from CSV...');
    const campaignMappings = loadCampaignMappings();
    console.log(`✅ Loaded ${campaignMappings.size} campaign mappings\n`);
    
    // Fetch leads from masterlead that have Veteran or Globe market
    console.log('📥 Fetching leads from masterlead...');
    
    const { data: leads, error: leadsError } = await supabase
      .from('masterlead')
      .select('id, first_name, last_name, phone, email, city, state, taalk_market, taalk_state')
      .or('taalk_market.ilike.%Veteran%,taalk_market.ilike.%Globe%')
      .not('phone', 'is', null)
      .not('first_name', 'is', null)
      .not('last_name', 'is', null);
    
    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }
    
    if (!leads || leads.length === 0) {
      console.log('⚠️  No leads found matching criteria');
      return;
    }
    
    console.log(`✅ Found ${leads.length} leads with Veteran or Globe market\n`);
    
    // Process leads
    let sent = 0;
    let skipped = 0;
    let errors = 0;
    const errorsList: Array<{ lead: Lead; error: string }> = [];
    
    console.log('🔄 Processing leads...\n');
    
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i] as Lead;
      
      // Determine campaign type from market
      const campaignType = getCampaignType(lead.taalk_market);
      if (!campaignType) {
        console.log(`⏭️  [${i + 1}/${leads.length}] Skipping lead ${lead.id}: Unknown market "${lead.taalk_market}"`);
        skipped++;
        continue;
      }
      
      // Get state (prefer taalk_state, fallback to state)
      const state = normalizeState(lead.taalk_state || lead.state);
      if (!state) {
        console.log(`⏭️  [${i + 1}/${leads.length}] Skipping lead ${lead.id}: No state found`);
        skipped++;
        continue;
      }
      
      // Find matching campaign
      const key = `${campaignType}-${state}`;
      const campaign = campaignMappings.get(key);
      
      if (!campaign) {
        console.log(`⏭️  [${i + 1}/${leads.length}] Skipping lead ${lead.id}: No campaign found for ${campaignType}-${state}`);
        skipped++;
        continue;
      }
      
      // Send lead to campaign
      console.log(`📤 [${i + 1}/${leads.length}] Sending lead ${lead.id} (${lead.first_name} ${lead.last_name}, ${state}) to ${campaign.campaignName}...`);
      
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
    
    if (errorsList.length > 0) {
      console.log('\n❌ Errors:\n');
      errorsList.slice(0, 10).forEach(({ lead, error }) => {
        console.log(`   Lead ${lead.id} (${lead.first_name} ${lead.last_name}): ${error}`);
      });
      if (errorsList.length > 10) {
        console.log(`   ... and ${errorsList.length - 10} more errors`);
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
sendLeadsToCampaigns().catch(console.error);




