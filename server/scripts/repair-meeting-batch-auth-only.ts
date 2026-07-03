/**
 * Fix auth password + user_id for emails where main batch could not resolve auth user.
 * Run: npx tsx server/scripts/repair-meeting-batch-auth-only.ts
 */
import { supabaseAdmin } from '../supabase';

const PAIRS: [string, string][] = [
  ['deborahrose@aoglobelife.com', '164243'],
  ['lisazgolli@aoglobelife.com', '538468'],
  ['lindseystakset@aoglobelife.com', '133686'],
  ['pauljohn@aoglobelife.com', '255183'],
  ['richardwilliamson@aoglobelife.com', '985084'],
];

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
    console.error('no supabase');
    process.exit(1);
  }
  for (const [rawEmail, associateIdStr] of PAIRS) {
    const email = rawEmail.toLowerCase().trim();
    const uid = await findAuthUserId(email);
    if (!uid) {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: associateIdStr,
        email_confirm: true,
        user_metadata: { associate_id: associateIdStr, provisioned_by: 'repair-meeting-batch-auth' },
      });
      if (cErr || !created?.user?.id) {
        console.error(`FAIL ${email}: no uid and create:`, cErr?.message);
        continue;
      }
      const newId = created.user.id;
      await supabaseAdmin.from('customers').update({ user_id: newId }).or(`company_email.eq.${email},personal_email.eq.${email}`);
      console.log(`created auth + linked: ${email}`);
      continue;
    }
    const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(uid, {
      password: associateIdStr,
      user_metadata: { associate_id: associateIdStr, provisioned_by: 'repair-meeting-batch-auth' },
    });
    if (pwdErr) {
      console.error(`FAIL update ${email}:`, pwdErr.message);
      continue;
    }
    await supabaseAdmin.from('customers').update({ user_id: uid }).or(`company_email.eq.${email},personal_email.eq.${email}`);
    console.log(`OK repair: ${email} → ${associateIdStr}`);
  }
}

main().catch(console.error);
