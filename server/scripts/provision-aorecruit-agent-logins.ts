/**
 * Create Supabase auth + customers + agent_profiles + user_credits for AO Recruit agents.
 *
 * Run: npx tsx server/scripts/provision-aorecruit-agent-logins.ts
 *
 * Requires server hardcoded Supabase service credentials (same as other scripts).
 */

import { supabaseAdmin } from '../supabase.js';

const PASSWORD = 'aointel2026';
const MARKET = 'aorecruit';

const AGENTS: { email: string; firstName: string; lastName: string }[] = [
  { email: 'marygracefranza@aoglobelife.com', firstName: 'Marygrace', lastName: 'Franza' },
  { email: 'dextersaludares@aoglobelife.com', firstName: 'Dexter', lastName: 'Saludares' },
  { email: 'rafunslearramos@aoglobelife.com', firstName: 'Rafunslear', lastName: 'Ramos' },
  { email: 'charlyndinglasa@aoglobelife.com', firstName: 'Charlyn', lastName: 'Dinglasa' },
];

function randomSixDigitAssociateId(): number {
  return 100000 + Math.floor(Math.random() * 900000);
}

async function isAssociateIdTaken(id: number): Promise<boolean> {
  if (!supabaseAdmin) return true;
  const { data: c } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('associate_id', id)
    .limit(1)
    .maybeSingle();
  if (c) return true;
  const { data: p } = await supabaseAdmin
    .from('producerlist')
    .select('id')
    .eq('associate_id', id)
    .limit(1)
    .maybeSingle();
  return !!p;
}

async function allocateAssociateId(): Promise<number> {
  for (let i = 0; i < 80; i++) {
    const id = randomSixDigitAssociateId();
    if (!(await isAssociateIdTaken(id))) return id;
  }
  throw new Error('Could not find a free 6-digit associate_id');
}

async function findAuthUser(email: string) {
  const normalized = email.toLowerCase().trim();
  const { data, error } = await supabaseAdmin!.auth.admin.listUsers({ email: normalized });
  if (error) throw error;
  return data?.users?.find((u) => u.email?.toLowerCase().trim() === normalized) ?? null;
}

async function ensureAuth(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  let user = await findAuthUser(normalized);
  if (!user) {
    const { data, error } = await supabaseAdmin!.auth.admin.createUser({
      email: normalized,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser ${normalized}: ${error.message}`);
    if (!data.user?.id) throw new Error(`createUser ${normalized}: no user id`);
    console.log(`✅ Auth created: ${normalized}`);
    return data.user.id;
  }
  const { error: upd } = await supabaseAdmin!.auth.admin.updateUserById(user.id, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (upd) throw new Error(`updateUser ${normalized}: ${upd.message}`);
  console.log(`✅ Auth exists — password set to ${PASSWORD}: ${normalized}`);
  return user.id;
}

async function ensureCustomer(
  email: string,
  firstName: string,
  lastName: string,
  associateId: number,
): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const agentName = `${firstName} ${lastName}`.trim();
  const marketArr = [MARKET];
  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin!
    .from('customers')
    .select('id, associate_id')
    .or(`company_email.ilike.${normalized},personal_email.ilike.${normalized}`)
    .limit(1)
    .maybeSingle();

  const row: Record<string, unknown> = {
    company_email: normalized,
    personal_email: normalized,
    first_name: firstName,
    last_name: lastName,
    agent_name: agentName,
    associate_id: associateId,
    market: marketArr,
    states: [] as string[],
    VDPACTIVE: 'INACTIVE',
    PLUSACTIVE: 'INACTIVE',
    RECRUITACTIVE: 'INACTIVE',
    AOICONNECT: 'INACTIVE',
    CCPRO: false,
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin!.from('customers').update(row).eq('id', existing.id);
    if (error) throw new Error(`customers update: ${error.message}`);
    console.log(`✅ customers updated id=${existing.id} associate_id=${associateId}`);
    return;
  }

  const { error } = await supabaseAdmin!.from('customers').insert({ ...row, created_at: now });
  if (error) throw new Error(`customers insert: ${error.message}`);
  console.log(`✅ customers inserted associate_id=${associateId}`);
}

async function ensureAgentProfile(
  supabaseUserId: string,
  email: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin!
    .from('agent_profiles')
    .select('id')
    .ilike('email', normalized)
    .limit(1)
    .maybeSingle();

  const base: Record<string, unknown> = {
    supabase_user_id: supabaseUserId,
    email: normalized,
    first_name: firstName,
    last_name: lastName,
    phone: '+15550000000',
    zoom_id: '',
    zoom_password: '1',
    mga_team: '',
    rga_team: '',
    authorized_markets: [MARKET],
    license_states: [] as string[],
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin!.from('agent_profiles').update(base).eq('id', existing.id);
    if (error) throw new Error(`agent_profiles update: ${error.message}`);
    console.log(`✅ agent_profiles updated id=${existing.id}`);
    return;
  }

  const { error } = await supabaseAdmin!.from('agent_profiles').insert({
    ...base,
    created_at: now,
  });
  if (error) throw new Error(`agent_profiles insert: ${error.message}`);
  console.log(`✅ agent_profiles inserted`);
}

async function ensureUserCredits(email: string, associateId: number, name: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const { data: ex } = await supabaseAdmin!.from('user_credits').select('email').eq('email', normalized).maybeSingle();
  if (ex) {
    const { error } = await supabaseAdmin!
      .from('user_credits')
      .update({ associate_id: associateId, name })
      .eq('email', normalized);
    if (error) console.warn('user_credits update:', error.message);
    else console.log(`✅ user_credits updated`);
    return;
  }
  const { error } = await supabaseAdmin!.from('user_credits').insert({
    email: normalized,
    associate_id: associateId,
    name,
    credits_remaining: 0,
    credits_used: 0,
    last_updated: new Date().toISOString(),
  });
  if (error) console.warn('user_credits insert:', error.message);
  else console.log(`✅ user_credits inserted`);
}

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  console.log(`\n🔐 Password for all: ${PASSWORD}\n`);

  for (const a of AGENTS) {
    console.log('\n' + '='.repeat(60));
    console.log(`→ ${a.email}`);
    const associateId = await allocateAssociateId();
    console.log(`   associate_id: ${associateId} (6-digit)`);

    const uid = await ensureAuth(a.email);
    await ensureCustomer(a.email, a.firstName, a.lastName, associateId);
    await ensureAgentProfile(uid, a.email, a.firstName, a.lastName);
    await ensureUserCredits(a.email, associateId, `${a.firstName} ${a.lastName}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
