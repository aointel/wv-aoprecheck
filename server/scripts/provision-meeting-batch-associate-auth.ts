/**
 * Assign unique 6-digit associate_id to each email, upsert customers, create/update Supabase Auth (password = ID).
 * Run: npx tsx server/scripts/provision-meeting-batch-associate-auth.ts
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

async function loadUsedAssociateIds(): Promise<Set<string>> {
  const used = new Set<string>();
  if (!supabaseAdmin) return used;

  for (const table of ['customers', 'producerlist'] as const) {
    let page = 0;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('associate_id')
        .not('associate_id', 'is', null)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (error) {
        console.warn(`[loadUsedAssociateIds] ${table}:`, error.message);
        break;
      }
      if (!data?.length) break;
      for (const row of data) {
        const id = row.associate_id != null ? String(row.associate_id).trim() : '';
        if (id) used.add(id);
      }
      if (data.length < 1000) break;
      page++;
    }
  }
  return used;
}

function allocateSixDigitId(used: Set<string>): string {
  for (let attempt = 0; attempt < 2_000_000; attempt++) {
    const n = 100000 + Math.floor(Math.random() * 900000);
    const s = String(n);
    if (!used.has(s)) {
      used.add(s);
      return s;
    }
  }
  throw new Error('Could not allocate a free 6-digit associate_id');
}

async function findAuthUserId(normalizedEmail: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data: a } = await supabaseAdmin.auth.admin.listUsers({ email: normalizedEmail });
  const u1 = a?.users?.find((u) => (u.email || '').toLowerCase().trim() === normalizedEmail);
  if (u1?.id) return u1.id;

  const adminAny = supabaseAdmin.auth.admin as unknown as {
    getUserByEmail?: (e: string) => Promise<{ data?: { user?: { id: string } } }>;
  };
  if (typeof adminAny.getUserByEmail === 'function') {
    const { data: b } = await adminAny.getUserByEmail(normalizedEmail);
    if (b?.user?.id) return b.user.id;
  }

  for (let page = 1; page <= 200; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    const u = data.users.find((x) => (x.email || '').toLowerCase().trim() === normalizedEmail);
    if (u?.id) return u.id;
  }
  return null;
}

async function main() {
  if (!supabaseAdmin) {
    console.error('supabaseAdmin not configured');
    process.exit(1);
  }

  const usedIds = await loadUsedAssociateIds();
  const assignments: { email: string; associate_id: string }[] = [];

  for (const raw of COMPANY_EMAILS) {
    const company_email = raw.toLowerCase().trim();
    const associateIdStr = allocateSixDigitId(usedIds);
    const associateIdNum = parseInt(associateIdStr, 10);
    const { first_name, last_name, agent_name } = namesFromEmail(company_email);

    const { data: existingRows } = await supabaseAdmin
      .from('customers')
      .select('id, company_email, first_name, last_name, agent_name')
      .or(`company_email.eq.${company_email},personal_email.eq.${company_email}`)
      .limit(1);
    const existing = existingRows?.[0];

    const baseRow = {
      company_email,
      personal_email: company_email,
      associate_id: associateIdNum,
      first_name: existing?.first_name || first_name,
      last_name: existing?.last_name || last_name,
      agent_name: existing?.agent_name || agent_name,
      phone: '+1-555-0000',
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
    };

    if (existing?.id) {
      const { error: upErr } = await supabaseAdmin
        .from('customers')
        .update({
          associate_id: associateIdNum,
          company_email,
          personal_email: company_email,
        })
        .eq('id', existing.id);
      if (upErr) {
        console.error(`FAIL customers update ${company_email}:`, upErr.message);
        continue;
      }
      console.log(`customers updated: ${company_email} → ${associateIdStr}`);
    } else {
      const { error: insErr } = await supabaseAdmin.from('customers').insert({
        ...baseRow,
        created_at: new Date().toISOString(),
      });
      if (insErr) {
        console.error(`FAIL customers insert ${company_email}:`, insErr.message);
        continue;
      }
      console.log(`customers inserted: ${company_email} → ${associateIdStr}`);
    }

    let userId: string | undefined;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: company_email,
      password: associateIdStr,
      email_confirm: true,
      user_metadata: {
        first_name: baseRow.first_name,
        last_name: baseRow.last_name,
        associate_id: associateIdStr,
        provisioned_by: 'provision-meeting-batch-associate-auth',
      },
    });

    if (createErr) {
      console.warn(`auth create ${company_email}:`, createErr.message);
      const uid = await findAuthUserId(company_email);
      if (uid) {
        const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(uid, {
          password: associateIdStr,
          user_metadata: {
            first_name: baseRow.first_name,
            last_name: baseRow.last_name,
            associate_id: associateIdStr,
            provisioned_by: 'provision-meeting-batch-associate-auth',
          },
        });
        if (pwdErr) {
          console.error(`FAIL auth update ${company_email}:`, pwdErr.message);
        } else {
          userId = uid;
          console.log(`auth password/metadata updated: ${company_email}`);
        }
      } else {
        console.error(`FAIL auth: no user and create failed ${company_email}:`, createErr.message);
      }
    } else if (created?.user?.id) {
      userId = created.user.id;
      console.log(`auth created: ${company_email}`);
    }

    if (userId) {
      const { error: linkErr } = await supabaseAdmin
        .from('customers')
        .update({ user_id: userId })
        .or(`company_email.eq.${company_email},personal_email.eq.${company_email}`);
      if (linkErr) {
        console.warn(`WARN link user_id ${company_email}:`, linkErr.message);
      }
    }

    assignments.push({ email: company_email, associate_id: associateIdStr });
  }

  console.log('\n--- Email → 6-digit Associate ID (password in Supabase) ---');
  for (const a of assignments) {
    console.log(`${a.email}\t${a.associate_id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
