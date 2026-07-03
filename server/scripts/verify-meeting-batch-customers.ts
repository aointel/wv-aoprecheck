/**
 * Read-only: verify customers rows for meeting batch emails.
 * Run: npx tsx server/scripts/verify-meeting-batch-customers.ts
 */
import { supabaseAdmin } from '../supabase';

const EMAILS = [
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

async function main() {
  if (!supabaseAdmin) {
    console.error('No supabase');
    process.exit(1);
  }

  let withId = 0;
  let withUserId = 0;
  let missing = 0;
  let dupes = 0;

  for (const email of EMAILS) {
    const { data: rows, error } = await supabaseAdmin
      .from('customers')
      .select('id, company_email, associate_id, user_id')
      .or(`company_email.eq.${email},personal_email.eq.${email}`);

    if (error) {
      console.log(`${email}\tERROR\t${error.message}`);
      missing++;
      continue;
    }
    if (!rows?.length) {
      console.log(`${email}\tNO_ROW`);
      missing++;
      continue;
    }
    if (rows.length > 1) {
      dupes++;
      console.log(`${email}\tDUPLICATE_ROWS\tcount=${rows.length}`);
      for (const r of rows) {
        console.log(`  id=${r.id} associate_id=${r.associate_id} user_id=${r.user_id ? 'yes' : 'no'}`);
      }
      const best = rows.find((r) => r.associate_id != null) ?? rows[0];
      if (best.associate_id != null) withId++;
      if (best.user_id) withUserId++;
      continue;
    }

    const r = rows[0];
    const aid = r.associate_id;
    const ok = aid != null && String(aid).length >= 5;
    if (ok) withId++;
    if (r.user_id) withUserId++;
    console.log(
      `${email}\tassociate_id=${aid ?? 'NULL'}\tuser_id=${r.user_id ? 'linked' : 'missing'}\t${ok ? 'OK' : 'BAD'}`,
    );
  }

  console.log(`\nSummary: ${EMAILS.length} emails — rows with associate_id: ${withId}, with user_id: ${withUserId}, problems: ${missing}, duplicate-email rows (any): ${dupes}`);
}

main().catch(console.error);
