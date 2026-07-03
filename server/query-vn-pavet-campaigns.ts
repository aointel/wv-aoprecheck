/**
 * Query Taalk API for campaigns containing "VN" or "PAVET" in the title
 * along with a state abbreviation, and output a table of campaign IDs
 */

import fetch from 'node-fetch';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

// US State abbreviations (2-letter codes)
const STATE_ABBREVIATIONS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC'
];

interface Campaign {
  _id: string;
  name: string;
  type?: string;
  contactCount?: number;
  [key: string]: any;
}

interface CampaignResult {
  campaignId: string;
  campaignName: string;
  state: string;
  type: 'VN' | 'PAVET';
}

/**
 * Check if a campaign name contains a state abbreviation
 */
function extractStateAbbreviation(campaignName: string): string | null {
  const upperName = campaignName.toUpperCase();
  
  // Check for state abbreviations in the name
  // Look for 2-letter codes that are standalone (word boundaries)
  for (const state of STATE_ABBREVIATIONS) {
    // Match state abbreviation as a whole word (with word boundaries)
    const regex = new RegExp(`\\b${state}\\b`, 'i');
    if (regex.test(campaignName)) {
      return state;
    }
  }
  
  return null;
}

/**
 * Check if campaign name contains VN or PAVET and has a state abbreviation
 */
function matchesCriteria(campaignName: string): { matches: boolean; type: 'VN' | 'PAVET' | null; state: string | null } {
  const upperName = campaignName.toUpperCase();
  
  // Check if name contains VN or PAVET
  const hasVN = upperName.includes('VN') && !upperName.includes('PAVET');
  const hasPAVET = upperName.includes('PAVET');
  
  if (!hasVN && !hasPAVET) {
    return { matches: false, type: null, state: null };
  }
  
  // Extract state abbreviation
  const state = extractStateAbbreviation(campaignName);
  
  if (!state) {
    return { matches: false, type: null, state: null };
  }
  
  // Determine type (PAVET takes precedence if both are present)
  const type = hasPAVET ? 'PAVET' : 'VN';
  
  return { matches: true, type, state };
}

async function queryVNAndPAVETCampaigns() {
  console.log('\n🔍 Querying Taalk API for VN and PAVET campaigns with state abbreviations...\n');
  
  try {
    let allCampaigns: Campaign[] = [];
    let page = 1;
    let totalPages = 1;
    
    // Fetch all campaigns with pagination
    do {
      console.log(`📄 Fetching page ${page}...`);
      
      const response = await fetch(`https://api.taalk.ai/api/campaign2s?db=michaelmandella&page=${page}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${TAALK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ Taalk API returned ${response.status}`);
        const text = await response.text();
        console.error('Response:', text);
        break;
      }
      
      const responseData = await response.json();
      const campaigns = responseData.payload || [];
      const total = responseData.total || 0;
      
      allCampaigns = allCampaigns.concat(campaigns);
      
      // Taalk returns 20 per page regardless of limit param
      const itemsPerPage = campaigns.length || 20;
      totalPages = Math.ceil(total / itemsPerPage);
      
      console.log(`   ✅ Page ${page}: ${campaigns.length} campaigns (${allCampaigns.length}/${total} total)`);
      
      page++;
      
      // Small delay to avoid rate limiting
      if (page <= totalPages) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } while (page <= totalPages);
    
    console.log(`\n✅ Fetched ${allCampaigns.length} total campaigns from Taalk API\n`);
    
    // Filter campaigns that match criteria (VN or PAVET with state abbreviation)
    const matchingCampaigns: CampaignResult[] = [];
    
    for (const campaign of allCampaigns) {
      const { matches, type, state } = matchesCriteria(campaign.name || '');
      
      if (matches && type && state) {
        matchingCampaigns.push({
          campaignId: campaign._id,
          campaignName: campaign.name,
          state: state,
          type: type
        });
      }
    }
    
    // Sort by type (PAVET first), then by state
    matchingCampaigns.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'PAVET' ? -1 : 1;
      }
      return a.state.localeCompare(b.state);
    });
    
    // Display results
    console.log('═'.repeat(100));
    console.log(`📊 FOUND ${matchingCampaigns.length} MATCHING CAMPAIGNS\n`);
    console.log('═'.repeat(100));
    
    if (matchingCampaigns.length === 0) {
      console.log('❌ No campaigns found matching criteria (VN or PAVET with state abbreviation)');
      return;
    }
    
    // Print table header
    console.log(
      'Type'.padEnd(8) + ' | ' +
      'State'.padEnd(6) + ' | ' +
      'Campaign ID'.padEnd(30) + ' | ' +
      'Campaign Name'
    );
    console.log('-'.repeat(100));
    
    // Print each campaign
    for (const campaign of matchingCampaigns) {
      console.log(
        campaign.type.padEnd(8) + ' | ' +
        campaign.state.padEnd(6) + ' | ' +
        campaign.campaignId.padEnd(30) + ' | ' +
        campaign.campaignName
      );
    }
    
    console.log('\n' + '═'.repeat(100));
    console.log(`\n📋 SUMMARY:\n`);
    console.log(`   Total campaigns queried: ${allCampaigns.length}`);
    console.log(`   Matching campaigns: ${matchingCampaigns.length}`);
    console.log(`   PAVET campaigns: ${matchingCampaigns.filter(c => c.type === 'PAVET').length}`);
    console.log(`   VN campaigns: ${matchingCampaigns.filter(c => c.type === 'VN').length}`);
    console.log(`   Unique states: ${new Set(matchingCampaigns.map(c => c.state)).size}`);
    
    // Export to CSV format
    console.log('\n' + '═'.repeat(100));
    console.log('\n📄 CSV FORMAT (for easy copy/paste):\n');
    console.log('campaignId,campaignName,state,type');
    for (const campaign of matchingCampaigns) {
      console.log(`${campaign.campaignId},"${campaign.campaignName}",${campaign.state},${campaign.type}`);
    }
    
    // Export campaign IDs only (one per line)
    console.log('\n' + '═'.repeat(100));
    console.log('\n🆔 CAMPAIGN IDs ONLY (one per line):\n');
    for (const campaign of matchingCampaigns) {
      console.log(campaign.campaignId);
    }
    
    console.log('\n' + '═'.repeat(100));
    console.log('\n✅ Done!\n');
    
  } catch (error) {
    console.error('\n❌ Error querying Taalk API:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
queryVNAndPAVETCampaigns().catch(console.error);




