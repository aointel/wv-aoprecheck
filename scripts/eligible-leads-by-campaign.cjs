/**
 * Eligible masterlead leads by Taalk campaign (state + market).
 * Uses vn-pavet-campaigns.csv and masterlead; outputs:
 * - summary CSV: campaign_id, campaign_name, state, market_type, eligible_lead_count
 * - one CSV per campaign with lead rows for insert (id, first_name, last_name, phone, ...)
 *
 * Run: node scripts/eligible-leads-by-campaign.cjs
 * Output: AOIrail/output/campaign-eligible-leads/
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const STATE_MAP = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR',
  CALIFORNIA: 'CA', COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE',
  FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID',
  ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS',
  KENTUCKY: 'KY', LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD',
  MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS',
  MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH', OKLAHOMA: 'OK',
  OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT',
  VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI', WYOMING: 'WY', 'DISTRICT OF COLUMBIA': 'DC'
};

function normalizeState(state) {
  if (!state) return null;
  const u = String(state).trim().toUpperCase();
  if (u.length === 2) return u;
  return STATE_MAP[u] || u;
}

function getCampaignType(taalkMarket) {
  if (!taalkMarket) return null;
  const u = String(taalkMarket).toUpperCase();
  if (u.includes('VETERAN') || u.includes('VET')) return 'PAVET';
  if (u.includes('GLOBE')) return 'VN';
  return null;
}

function loadCampaignMappings() {
  const csvPath = path.join(process.cwd(), 'vn-pavet-campaigns.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error('vn-pavet-campaigns.csv not found in project root');
  }
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter((l) => l.trim());
  const mappings = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^([^,]+),(".*?"|[^,]*),([^,]+),([^,]+)$/);
    if (!match) continue;
    const [, campaignId, campaignName, state, type] = match;
    const key = `${type.trim()}-${state.trim()}`;
    mappings.set(key, {
      campaignId: campaignId.trim(),
      campaignName: (campaignName || '').replace(/^"|"$/g, '').trim(),
      state: state.trim(),
      type: type.trim()
    });
  }
  return mappings;
}

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  console.log('\nEligible masterlead leads by Taalk campaign (state + market)\n');
  console.log('═'.repeat(70));

  const campaignMappings = loadCampaignMappings();
  console.log('Loaded', campaignMappings.size, 'campaign mappings from vn-pavet-campaigns.csv\n');

  // Eligible: has phone, name, not DNC, not TaalkResolve, Veteran or Globe market (paginate to get all)
  console.log('Fetching eligible leads from masterlead...');
  let leads = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const from = page * pageSize;
    const { data: chunk, error } = await supabase
      .from('masterlead')
      .select('id, first_name, last_name, phone, email, city, state, taalk_market, taalk_state, dnc, TaalkResolve')
      .or('taalk_market.ilike.%Veteran%,taalk_market.ilike.%Globe%')
      .not('phone', 'is', null)
      .not('first_name', 'is', null)
      .not('last_name', 'is', null)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Supabase error:', error.message);
      process.exit(1);
    }
    leads = leads.concat(chunk || []);
    hasMore = (chunk && chunk.length === pageSize);
    page++;
    if (chunk && chunk.length > 0) console.log('  Fetched', leads.length, 'rows...');
  }

  const eligible = leads.filter((l) => l.dnc !== true && l.TaalkResolve !== true);
  console.log('Eligible leads (Veteran/Globe, has phone/name, not DNC, not TaalkResolve):', eligible.length, '\n');

  // Group by campaign key (type-state)
  const byCampaign = new Map();
  let noMatch = 0;
  let noState = 0;
  let noType = 0;

  for (const lead of eligible) {
    const state = normalizeState(lead.taalk_state || lead.state);
    if (!state) {
      noState++;
      continue;
    }
    const type = getCampaignType(lead.taalk_market);
    if (!type) {
      noType++;
      continue;
    }
    const key = `${type}-${state}`;
    const campaign = campaignMappings.get(key);
    if (!campaign) {
      noMatch++;
      continue;
    }
    const ckey = campaign.campaignId;
    if (!byCampaign.has(ckey)) {
      byCampaign.set(ckey, { campaign, leads: [] });
    }
    byCampaign.get(ckey).leads.push(lead);
  }

  if (noState) console.log('Skipped (no state):', noState);
  if (noType) console.log('Skipped (unknown market type):', noType);
  if (noMatch) console.log('Skipped (no campaign for state/type):', noMatch);

  const outDir = path.join(process.cwd(), 'output', 'campaign-eligible-leads');
  fs.mkdirSync(outDir, { recursive: true });

  const summaryRows = [
    ['campaign_id', 'campaign_name', 'state', 'market_type', 'eligible_lead_count'].join(',')
  ];

  for (const [campaignId, { campaign, leads: campaignLeads }] of byCampaign.entries()) {
    summaryRows.push([
      campaignId,
      escapeCsv(campaign.campaignName),
      campaign.state,
      campaign.type,
      campaignLeads.length
    ].join(','));

    const safeName = campaign.campaignName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60);
    const campaignCsvPath = path.join(outDir, `leads_${campaign.type}_${campaign.state}_${safeName}.csv`);
    const header = 'id,first_name,last_name,phone,email,city,state,taalk_market';
    const leadLines = campaignLeads.map((l) => [
      l.id,
      escapeCsv(l.first_name),
      escapeCsv(l.last_name),
      escapeCsv(l.phone),
      escapeCsv(l.email),
      escapeCsv(l.city),
      escapeCsv(l.state),
      escapeCsv(l.taalk_market)
    ].join(','));
    fs.writeFileSync(campaignCsvPath, [header, ...leadLines].join('\n'), 'utf-8');
  }

  const summaryPath = path.join(outDir, 'summary_by_campaign.csv');
  fs.writeFileSync(summaryPath, summaryRows.join('\n'), 'utf-8');

  console.log('\nOutput written to:', outDir);
  console.log('  summary_by_campaign.csv  → campaign_id, campaign_name, state, market_type, eligible_lead_count');
  console.log('  leads_<type>_<state>_<name>.csv → one file per campaign with lead rows for insert\n');

  const totalInsertable = summaryRows.slice(1).reduce((acc, row) => {
    const count = parseInt(row.split(',').pop(), 10);
    return acc + (isNaN(count) ? 0 : count);
  }, 0);
  console.log('Total eligible leads that would be inserted (by campaign):', totalInsertable);
  console.log('═'.repeat(70));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
