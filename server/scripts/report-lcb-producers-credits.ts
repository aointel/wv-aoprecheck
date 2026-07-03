/**
 * Report: credits for LCB producers. Uses the same API as the Live Call Board
 * (fetchUserCreditsForLcb + fetchCustomersForLcb + buildCreditsMap from lcb-credits).
 * Run: npm run report-lcb-credits
 */

import { supabaseAdmin } from '../supabase';
import { fetchUserCreditsForLcb, fetchCustomersForLcb, buildCreditsMap } from '../lcb-credits';
import * as fs from 'fs';
import * as path from 'path';

const PRODUCER_EMAILS = [
  'thomasgunn@aoglobelife.com', 'randyortizalarcon@aoglobelife.com', 'philippefiore@aoglobelife.com',
  'kaylar@aoglobelife.com', 'necodiluccia@aoglobelife.com', 'nikkifoster@aoglobelife.com',
  'christopherhamm@aoglobelife.com', 'jaredcircle@aoglobelife.com', 'justintinoco@aoglobelife.com',
  'williampalizo@aoglobelife.com', 'kennethhollobaugh@aoglobelife.com', 'santinodesilvio@aoglobelife.com',
  'sebastianquintero@aoglobelife.com', 'dominicribeiro@aoglobelife.com', 'kianamais@aoglobelife.com',
  'gibsonwein@aoglobelife.com', 'abelklug@aoglobelife.com', 'shaneculbert@aoglobelife.com',
  'josephesshaki@aoglobelife.com', 'thomasmccarter@aoglobelife.com', 'saundrajester@aoglobelife.com',
  'lanebeasley@aoglobelife.com', 'beattyheather@aoglobelife.com', 'douglaslewis@aoglobelife.com',
  'michellefritchle@aoglobelife.com', 'cuttercameau@aoglobelife.com', 'paulissenowusuansah@aoglobelife.com',
  'dylanwhite@aoglobelife.com', 'gianakless@aoglobelife.com', 'ellayarian@aoglobelife.com',
  'josephsilvani@aoglobelife.com', 'joelguzmanvazquez@aoglobelife.com', 'danielbeasley@aoglobelife.com',
  'crisseanwilliams@aoglobelife.com', 'braydonstevens@aoglobelife.com', 'mckayjohnson@aoglobelife.com',
  'faithjennings@aoglobelife.com', 'donnalauer@aoglobelife.com', 'magdalinamelkonyan@aoglobelife.com',
  'andreabrienza@aoglobelife.com', 'robertaanderson@aoglobelife.com', 'markarmistead@aoglobelife.com',
  'ankitadas@aoglobelife.com', 'dennleyvensyryussapini@aoglobelife.com', 'woodysargent@aoglobelife.com',
  'katelynarnoldsen@aoglobelife.com', 'adamhaydel@aoglobelife.com', 'johnavila@aoglobelife.com',
  'bryanjesuslozadapacheco@aoglobelife.com', 'wilmerfernandez@aoglobelife.com', 'jacobvaldellon@aoglobelife.com',
  'francesbrewer@aoglobelife.com', 'cameronbergau@aoglobelife.com', 'averyfuller@aoglobelife.com',
  'rochellemagpantay@aoglobelife.com', 'aidenbauer@aoglobelife.com', 'kellygagegaunt@aoglobelife.com',
  'hardyswann@aoglobelife.com', 'jersonhernandez@aoglobelife.com', 'matiaswinfieldstefani@aoglobelife.com',
  'davidnjoku@aoglobelife.com', 'anthonyhines@aoglobelife.com', 'williamtomazin@aoglobelife.com',
  'tylerhampton@aoglobelife.com', 'connorgrochowski@aoglobelife.com', 'richardchabala@aoglobelife.com',
  'randolphpark@aoglobelife.com', 'austinwilbert@aoglobelife.com', 'keithgindlesperger@aoglobelife.com',
  'shawnortiz@aoglobelife.com', 'arinagerguis@aoglobelife.com', 'ranaelayyan@aoglobelife.com',
  'robertomurillo@aoglobelife.com', 'jameslang@aoglobelife.com', 'shawntoma@aoglobelife.com',
  'karlamendoza@aoglobelife.com', 'tyjeremorrow@aoglobelife.com', 'camrenmoore@aoglobelife.com',
  'tabithamcdermid@aoglobelife.com', 'chrislafond@aoglobelife.com', 'jakobleblue@aoglobelife.com',
  'zakiyatianyvu@aoglobelife.com', 'calebbrown@aoglobelife.com', 'erickurzynski@aoglobelife.com',
  'gabrielbisrat@aoglobelife.com', 'diankablash@aoglobelife.com', 'markuswest@aoglobelife.com',
  'nathanlittin@aoglobelife.com', 'tylermenge@aoglobelife.com', 'kadiyonsweat@aoglobelife.com',
  'nicolasmahaffy@aoglobelife.com', 'imaadjalloh@aoglobelife.com', 'omarionstokes@aoglobelife.com',
  'domonicbirtha@aoglobelife.com', 'victoralonsogil@aoglobelife.com', 'jacobmares@aoglobelife.com',
  'hannasheff@aoglobelife.com', 'stevenpenawhalen@aoglobelife.com', 'lindagojcaj@aoglobelife.com',
  'mohammadalisaad@aoglobelife.com', 'scottmoerman@aoglobelife.com', 'kendallgildersleeve@aoglobelife.com',
  'jacobnavarre@aoglobelife.com', 'glover.alexandria@aoglobelife.com', 'shawnsipes@aoglobelife.com',
  'chrissingletary@aoglobelife.com', 'candacefimbres@aoglobelife.com', 'alisaad@aoglobelife.com',
  'smithterrell@aoglobelife.com', 'collindickinson@aoglobelife.com', 'lukegoodman@aoglobelife.com',
  'amandaarrieta@aoglobelife.com', 'nataliaaljamal@aoglobelife.com', 'martinaustin@aoglobelife.com',
  'jonni@aoglobelife.com', '132403@aoglobelife.com', 'jameelamers@aoglobelife.com',
  '193769@aoglobelife.com', '205407@aoglobelife.com', '218240@aoglobelife.com', '220279@aoglobelife.com',
  '225564@aoglobelife.com', '226424@aoglobelife.com', '38431@aoglobelife.com', 'farzannaghoon@aoglobelife.com',
  'willmusick@aoglobelife.com',
];

function escapeCsv(s: string): string {
  const t = String(s ?? '').replace(/"/g, '""');
  return t.includes(',') || t.includes('"') || t.includes('\n') || t.includes('\r') ? `"${t}"` : t;
}

async function main() {
  if (!supabaseAdmin) {
    console.error('Supabase not initialized');
    process.exit(1);
  }

  const emails = [...new Set(PRODUCER_EMAILS.map((e) => e.toLowerCase().trim()))];
  const chunk = 200;
  console.log(`Using same LCB credits API (fetchUserCreditsForLcb + fetchCustomersForLcb + buildCreditsMap).`);
  console.log(`Fetching credits + hierarchy for ${emails.length} producers...`);

  const [{ data: creditsList }, { rows: customerRows }] = await Promise.all([
    fetchUserCreditsForLcb(supabaseAdmin),
    fetchCustomersForLcb(supabaseAdmin),
  ]);
  const creditsMap = buildCreditsMap(creditsList || [], customerRows || []);
  const creditsByEmail = new Map<string, { credits_remaining: number; credits_used?: number; credits_purchased?: number }>();
  creditsMap.forEach((row, key) => {
    creditsByEmail.set(key, {
      credits_remaining: Number(row?.credits_remaining) ?? 0,
      credits_used: (row as any)?.credits_used != null ? Number((row as any).credits_used) : undefined,
      credits_purchased: (row as any)?.credits_purchased != null ? Number((row as any).credits_purchased) : undefined,
    });
  });
  console.log(`Credits map (LCB API): ${creditsMap.size} keys from ${(creditsList || []).length} user_credits rows.`);

  let hierarchyRows: any[] = [];
  for (let i = 0; i < emails.length; i += chunk) {
    const slice = emails.slice(i, i + chunk);
    const { data, error } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_email, agent_name, mga_name, rga_name')
      .in('agent_email', slice);
    if (error) {
      console.warn('agent_hierarchy error (continuing):', error.message);
      break;
    }
    if (data?.length) hierarchyRows = hierarchyRows.concat(data);
  }
  const hierarchyByEmail = new Map<string, { agent_name?: string; mga_name?: string; rga_name?: string }>();
  hierarchyRows.forEach((r: any) => {
    const k = (r.agent_email ?? '').toString().toLowerCase().trim();
    if (k) {
      hierarchyByEmail.set(k, {
        agent_name: r.agent_name ?? undefined,
        mga_name: r.mga_name ?? undefined,
        rga_name: r.rga_name ?? undefined,
      });
    }
  });
  console.log(`Found agent_hierarchy for ${hierarchyByEmail.size} of ${emails.length} producers.`);

  const lines: string[] = [
    'MGA,RGA,producer,agent_name,credits_remaining,credits_used,credits_purchased',
  ];

  for (const email of emails) {
    const cred = creditsByEmail.get(email) ?? {
      credits_remaining: 0,
      credits_used: undefined as number | undefined,
      credits_purchased: undefined as number | undefined,
    };
    const h = hierarchyByEmail.get(email);
    const mga = h?.mga_name ?? '';
    const rga = h?.rga_name ?? '';
    const name = h?.agent_name ?? '';
    const cr = cred.credits_remaining;
    const cu = cred.credits_used != null ? String(cred.credits_used) : '';
    const cp = cred.credits_purchased != null ? String(cred.credits_purchased) : '';
    lines.push([escapeCsv(mga), escapeCsv(rga), escapeCsv(email), escapeCsv(name), cr, cu, cp].join(','));
  }

  const outPath = path.join(process.cwd(), 'report-lcb-producers-credits.csv');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${outPath}`);

  const noCredits = emails.filter((e) => !creditsByEmail.has(e));
  if (noCredits.length) {
    console.log(`\nNo credits (LCB API) for ${noCredits.length} producers:`);
    noCredits.slice(0, 20).forEach((e) => console.log(`  ${e}`));
    if (noCredits.length > 20) console.log(`  ... and ${noCredits.length - 20} more`);
  }

  const totalRemaining = [...creditsByEmail.values()].reduce((s, c) => s + c.credits_remaining, 0);
  console.log(`\nTotal credits_remaining (among those with a row): ${totalRemaining}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
