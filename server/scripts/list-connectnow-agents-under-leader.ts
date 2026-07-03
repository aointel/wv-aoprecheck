/**
 * Agents under a leader in Supabase `agent_hierarchy` who have a **Supabase Auth** user
 * (auth.users via `auth.admin.listUsers` on the same email). Not `user_credits` or Stripe.
 *
 * Leader from `mga_rga_directory` (name ilike + optional first-name substring).
 * `role` may be MGA, RGA, or BOTH — that is still **one associate_id per directory row**.
 * Downline is everyone whose **mga_associate_id** OR **rga_associate_id** is in the leader id set
 * (same id used for both columns in the data).
 *
 * Default: David Carpenter (--leader-substring=carpenter --leader-first=david).
 * Optional: --leader-email=... (restrict to directory rows for that email),
 *            --leader-associate-id=46179 (use this id only; skips name match).
 *
 *   npx tsx server/scripts/list-connectnow-agents-under-leader.ts
 *   npx tsx server/scripts/list-connectnow-agents-under-leader.ts --delay-ms=20
 *
 *   npx tsx server/scripts/list-connectnow-agents-under-leader.ts --hierarchy-only
 *   (all agents in agent_hierarchy under leader’s MGA or RGA — no Supabase Auth checks; fast CSV)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { supabaseAdmin } from '../supabase';

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (prefix: string, def: string) => {
    const a = argv.find((x) => x.startsWith(prefix));
    return a ? a.slice(prefix.length) : def;
  };
  const leaderSubstring = get('--leader-substring=', 'carpenter').toLowerCase();
  const leaderFirst = get('--leader-first=', 'david').toLowerCase();
  const delayMs = Math.max(0, parseInt(get('--delay-ms=', '30'), 10) || 0);
  const leaderEmailArg = get('--leader-email=', '').trim();
  const leaderAssociateIdArg = get('--leader-associate-id=', '').trim();
  const hierarchyOnly = argv.includes('--hierarchy-only');
  return { leaderSubstring, leaderFirst, delayMs, leaderEmailArg, leaderAssociateIdArg, hierarchyOnly };
}

async function fetchAllRows<T>(
  table: string,
  select: string,
  apply: (q: any) => any,
): Promise<T[]> {
  const page = 1000;
  let from = 0;
  const out: T[] = [];
  for (;;) {
    let q = supabaseAdmin!.from(table).select(select);
    q = apply(q);
    const { data, error } = await q.order('agent_email', { ascending: true }).range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    out.push(...(data as T[]));
    if (data.length < page) break;
    from += page;
  }
  return out;
}

function csvEscape(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

/** Lowercase emails in `agent_profiles` (batched `.in` — matches typical stored lowercase). */
async function agentProfileEmailsPresent(emails: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  const uniq = [...new Set(emails.map(norm).filter(Boolean))];
  const CHUNK = 100;
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const part = uniq.slice(i, i + CHUNK);
    const { data, error } = await supabaseAdmin!.from('agent_profiles').select('email').in('email', part);
    if (error) throw new Error(`agent_profiles batch: ${error.message}`);
    for (const r of data || []) {
      if (r && typeof (r as { email?: string }).email === 'string') {
        found.add(norm((r as { email: string }).email));
      }
    }
  }
  return found;
}

async function findAuthUserByEmail(email: string) {
  const normalized = norm(email);
  const { data, error } = await supabaseAdmin!.auth.admin.listUsers({ email: normalized });
  if (error) throw new Error(`listUsers(${normalized}): ${error.message}`);
  return data?.users?.find((u) => norm(u.email) === normalized) ?? null;
}

async function main() {
  const { leaderSubstring, leaderFirst, delayMs, hierarchyOnly } = parseArgs();

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  if (hierarchyOnly) {
    console.log('\n📋 agent_hierarchy CSV — all agents under leader MGA ∪ RGA (no Auth filter)');
  } else {
    console.log('\n📋 Supabase Auth users under leader (auth.users ∩ agent_hierarchy)');
  }
  console.log(`   Leader filter: first contains "${leaderFirst}", name contains "${leaderSubstring}"`);
  if (!hierarchyOnly) {
    console.log(`   Login = Supabase Auth account for same email; delay between lookups: ${delayMs}ms`);
  }
  console.log('');

  const { data: dirRaw, error: dirErr } = await supabaseAdmin
    .from('mga_rga_directory')
    .select('associate_id, name, email, role')
    .ilike('name', `%${leaderSubstring}%`);

  if (dirErr) {
    console.error('❌ mga_rga_directory:', dirErr.message);
    process.exit(1);
  }

  const leaders = (dirRaw || []).filter((r: Record<string, unknown>) => {
    const n = norm(r.name);
    if (!n.includes(leaderSubstring)) return false;
    if (leaderFirst && !n.includes(leaderFirst)) return false;
    return typeof r.associate_id === 'number' && r.associate_id > 0;
  });

  if (leaders.length === 0) {
    console.warn(
      `⚠️ No rows in mga_rga_directory matched (name ilike %${leaderSubstring}%${leaderFirst ? ` and contains "${leaderFirst}"` : ''}). Try different --leader-substring / --leader-first.`,
    );
    console.log('   Sample directory names containing substring (first 15):');
    const { data: sample } = await supabaseAdmin
      .from('mga_rga_directory')
      .select('name, associate_id')
      .ilike('name', `%${leaderSubstring}%`)
      .limit(15);
    (sample || []).forEach((r: any) => console.log(`     ${r.associate_id}\t${r.name}`));
    process.exit(1);
  }

  console.log('✅ Matched leader(s) in mga_rga_directory:');
  leaders.forEach((r: any) => {
    console.log(`   associate_id=${r.associate_id}\tname=${r.name}\temail=${r.email ?? ''}\trole=${r.role ?? ''}`);
  });

  const leaderIds = [...new Set(leaders.map((r: any) => Number(r.associate_id)).filter((n) => Number.isFinite(n) && n > 0))];
  const leaderDirectorySnapshot = leaders
    .map((r: any) => `${r.associate_id}:${String(r.name ?? '').trim()}`)
    .join(' | ');

  type Hier = {
    agent_email: string | null;
    agent_name: string | null;
    agent_associate_id: number | null;
    mga_name: string | null;
    rga_name: string | null;
    mga_associate_id: number | null;
    rga_associate_id: number | null;
  };

  const underMga = leaderIds.length
    ? await fetchAllRows<Hier>('agent_hierarchy', 'agent_email, agent_name, agent_associate_id, mga_name, rga_name, mga_associate_id, rga_associate_id', (q) =>
        q.in('mga_associate_id', leaderIds),
      )
    : [];

  const underRga = leaderIds.length
    ? await fetchAllRows<Hier>('agent_hierarchy', 'agent_email, agent_name, agent_associate_id, mga_name, rga_name, mga_associate_id, rga_associate_id', (q) =>
        q.in('rga_associate_id', leaderIds),
      )
    : [];

  const byEmail = new Map<string, Hier & { under: 'MGA' | 'RGA' | 'BOTH' }>();
  const mark = (row: Hier, kind: 'MGA' | 'RGA') => {
    const em = norm(row.agent_email);
    if (!em) return;
    const prev = byEmail.get(em);
    if (!prev) {
      byEmail.set(em, { ...row, under: kind });
      return;
    }
    if (prev.under !== kind && prev.under !== 'BOTH') {
      byEmail.set(em, { ...prev, under: 'BOTH' });
    }
  };
  underMga.forEach((r) => mark(r, 'MGA'));
  underRga.forEach((r) => mark(r, 'RGA'));

  console.log(`\n📊 Agents in agent_hierarchy under this MGA/RGA (by associate_id): ${byEmail.size}`);

  if (hierarchyOnly) {
    const rows = [...byEmail.entries()]
      .map(([email, h]) => ({
        agent_email: email,
        agent_name: h.agent_name || '',
        agent_associate_id: h.agent_associate_id != null ? String(h.agent_associate_id) : '',
        mga_associate_id: h.mga_associate_id != null ? String(h.mga_associate_id) : '',
        rga_associate_id: h.rga_associate_id != null ? String(h.rga_associate_id) : '',
        mga_name: h.mga_name || '',
        rga_name: h.rga_name || '',
        under_leader_as: h.under,
      }))
      .sort((a, b) => a.agent_email.localeCompare(b.agent_email));

    const profileEmails = await agentProfileEmailsPresent(rows.map((r) => r.agent_email));
    const withProfile = rows.filter((r) => profileEmails.has(r.agent_email));
    console.log(
      `\n👤 agent_profiles row (email match, case-normalized): ${withProfile.length} / ${rows.length}`,
    );

    const outDir = path.join(process.cwd(), 'server', 'scripts', 'output');
    fs.mkdirSync(outDir, { recursive: true });
    const safeLeader = leaderSubstring.replace(/[^a-z0-9]+/gi, '-');
    const outPath = path.join(outDir, `agents-hierarchy-under-leader-${safeLeader}-${Date.now()}.csv`);
    const header =
      'agent_email,agent_name,agent_associate_id,mga_associate_id,rga_associate_id,mga_name,rga_name,under_leader_as_mga_or_rga,has_agent_profile,leader_directory_associate_ids,leader_directory_snapshot\n';
    const lines = rows.map((r) =>
      [
        r.agent_email,
        csvEscape(r.agent_name),
        r.agent_associate_id,
        r.mga_associate_id,
        r.rga_associate_id,
        csvEscape(r.mga_name),
        csvEscape(r.rga_name),
        r.under_leader_as,
        profileEmails.has(r.agent_email) ? 'true' : 'false',
        leaderIds.join(';'),
        csvEscape(leaderDirectorySnapshot),
      ].join(','),
    );
    fs.writeFileSync(outPath, header + lines.join('\n') + '\n', 'utf8');
    console.log(`\n📁 Wrote ${rows.length} rows → ${outPath}\n`);
    return;
  }

  const emailsSorted = [...byEmail.keys()].sort();
  const authByEmail = new Map<
    string,
    { id: string; created_at: string; email_confirmed_at: string; last_sign_in_at: string }
  >();

  console.log(`\n🔐 Checking Supabase Auth for ${emailsSorted.length} emails…`);
  for (let i = 0; i < emailsSorted.length; i++) {
    const email = emailsSorted[i]!;
    if ((i + 1) % 40 === 0 || i === 0) {
      console.log(`   … ${i + 1}/${emailsSorted.length}`);
    }
    const u = await findAuthUserByEmail(email);
    if (u) {
      authByEmail.set(email, {
        id: u.id,
        created_at: u.created_at ? String(u.created_at) : '',
        email_confirmed_at: u.email_confirmed_at ? String(u.email_confirmed_at) : '',
        last_sign_in_at: u.last_sign_in_at ? String(u.last_sign_in_at) : '',
      });
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  const loginSource = 'supabase_auth';
  console.log(`📊 With Supabase Auth account: ${authByEmail.size} / ${emailsSorted.length}\n`);

  const matched: {
    email: string;
    agent_name: string;
    agent_associate_id: string;
    mga_name: string;
    rga_name: string;
    under: string;
    auth_user_id: string;
    auth_created_at: string;
    email_confirmed_at: string;
    last_sign_in_at: string;
    login_source: string;
  }[] = [];

  for (const [email, h] of byEmail) {
    const auth = authByEmail.get(email);
    if (!auth) continue;
    matched.push({
      email,
      agent_name: h.agent_name || '',
      agent_associate_id: h.agent_associate_id != null ? String(h.agent_associate_id) : '',
      mga_name: h.mga_name || '',
      rga_name: h.rga_name || '',
      under: h.under,
      auth_user_id: auth.id,
      auth_created_at: auth.created_at,
      email_confirmed_at: auth.email_confirmed_at,
      last_sign_in_at: auth.last_sign_in_at,
      login_source: loginSource,
    });
  }

  matched.sort((a, b) => a.email.localeCompare(b.email));

  const withoutAuth = emailsSorted.length - matched.length;
  console.log(`✅ Intersection (hierarchy under leader ∩ Supabase Auth): ${matched.length} agents`);
  console.log(`   No Auth user for hierarchy email: ${withoutAuth}\n`);
  for (const m of matched) {
    console.log(`  ${m.email}\t${m.agent_name}\tunder=${m.under}\tauth_id=${m.auth_user_id}`);
  }

  const outDir = path.join(process.cwd(), 'server', 'scripts', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `supabase-auth-agents-under-leader-${leaderSubstring}-${Date.now()}.csv`);
  const header =
    'email,agent_name,agent_associate_id,mga_name,rga_name,under_leader_as,supabase_auth_user_id,auth_created_at,email_confirmed_at,last_sign_in_at,login_source\n';
  const lines = matched.map(
    (m) =>
      [
        m.email,
        `"${(m.agent_name || '').replace(/"/g, '""')}"`,
        m.agent_associate_id,
        `"${(m.mga_name || '').replace(/"/g, '""')}"`,
        `"${(m.rga_name || '').replace(/"/g, '""')}"`,
        m.under,
        m.auth_user_id,
        m.auth_created_at,
        m.email_confirmed_at,
        m.last_sign_in_at,
        `"${m.login_source.replace(/"/g, '""')}"`,
      ].join(','),
  );
  fs.writeFileSync(outPath, header + lines.join('\n') + '\n', 'utf8');
  console.log(`\n📁 Wrote ${outPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
