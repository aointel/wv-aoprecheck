/**
 * One-off: insert customers by company_email (skip if row already exists).
 * Run from repo root: npx tsx server/scripts/import-meeting-batch-customers.ts
 */
import { supabaseAdmin } from '../supabase';

const COMPANY_EMAILS = [
  'arthurkinsey@aoglobelife.com',
  'brandonwitherspoon@aoglobelife.com',
  'deannabeams@aoglobelife.com',
  'deborahrose@aoglobelife.com',
  'dennishamer@aoglobelife.com',
  'derriqkroberts@aoglobelife.com',
  'dianagonzales@aoglobelife.com',
  'douglaspatterson@aoglobelife.com',
  'farleycole@aoglobelife.com',
  'jenniferalvarez@aoglobelife.com',
  'johnenriquepena@aoglobelife.com',
  'josephdiecedue@aoglobelife.com',
  'kathleenramos@aoglobelife.com',
  'lisazgolli@aoglobelife.com',
  'lindseystakset@aoglobelife.com',
  'matthenderson@aoglobelife.com',
  'mayaceballos@aoglobelife.com',
  'nicholasgurasich@aoglobelife.com',
  'pauljohn@aoglobelife.com',
  'rachelpatstone@aoglobelife.com',
  'richardwilliamson@aoglobelife.com',
  'senikawitherspoon@aoglobelife.com',
  'wilbertwoods@aoglobelife.com',
];

function namesFromEmail(email: string): { first_name: string; last_name: string; agent_name: string } {
  const local = email.split('@')[0]?.toLowerCase() ?? 'agent';
  const rawParts = local.split(/[._-]+/).filter(Boolean);
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');
  if (rawParts.length === 0) {
    return { first_name: 'Agent', last_name: '', agent_name: local };
  }
  return {
    first_name: cap(rawParts[0]),
    last_name: rawParts.slice(1).map(cap).join(' '),
    agent_name: rawParts.map(cap).join(' '),
  };
}

async function main() {
  if (!supabaseAdmin) {
    console.error('supabaseAdmin not configured');
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const raw of COMPANY_EMAILS) {
    const company_email = raw.toLowerCase().trim();
    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('id')
      .or(`company_email.eq.${company_email},personal_email.eq.${company_email}`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`SKIP (exists): ${company_email}`);
      skipped++;
      continue;
    }

    const { first_name, last_name, agent_name } = namesFromEmail(company_email);
    const row = {
      company_email,
      personal_email: company_email,
      first_name,
      last_name,
      phone: '+1-555-0000',
      agent_name,
      VDPACTIVE: 'INACTIVE',
      PLUSACTIVE: 'INACTIVE',
      RECRUITACTIVE: 'INACTIVE',
      AOICONNECT: 'INACTIVE',
      CCPRO: false,
      primary_market: '',
      secondary_market: '',
      market: [] as string[],
      states: [] as string[],
      status: 'active',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from('customers').insert(row);
    if (error) {
      console.error(`FAIL ${company_email}:`, error.message);
      failed++;
    } else {
      console.log(`OK inserted: ${company_email}`);
      inserted++;
    }
  }

  console.log(`\nDone. inserted=${inserted} skipped=${skipped} failed=${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
