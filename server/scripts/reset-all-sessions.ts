/**
 * Reset everyone's sessions (force all users to log in again).
 *
 * Supabase does not expose a single "revoke all sessions" admin API. The standard
 * way to invalidate all existing sessions is to rotate the JWT secret in the
 * Supabase project. That invalidates all current access and refresh tokens.
 *
 * This script:
 * 1. Lists all auth users (so you see who will be affected).
 * 2. Prints step-by-step instructions to rotate the JWT secret in the Dashboard.
 *
 * Usage: npx tsx server/scripts/reset-all-sessions.ts
 */

import { supabaseAdmin } from '../supabase';

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
    process.exit(1);
  }

  console.log('Resetting everyone\'s sessions – listing auth users first.\n');

  const users: { id: string; email: string | null; created_at?: string }[] = [];
  let page = 1;
  const perPage = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error('❌ Error listing users:', error.message);
      process.exit(1);
    }

    if (data?.users?.length) {
      users.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null, created_at: u.created_at })));
      hasMore = data.users.length === perPage;
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`Found ${users.length} auth user(s):`);
  users.slice(0, 50).forEach((u, i) => console.log(`  ${i + 1}. ${u.email ?? u.id}`));
  if (users.length > 50) console.log(`  ... and ${users.length - 50} more.\n`);
  else console.log('');

  console.log('--- How to reset all sessions ---');
  console.log('1. Open Supabase Dashboard → your project.');
  console.log('2. Go to: Project Settings (gear) → Auth → JWT Settings.');
  console.log('3. Click "Rotate JWT secret" (or "Generate new secret").');
  console.log('4. Confirm. Supabase will issue a new secret; all existing tokens become invalid.');
  console.log('5. No app env change is required: new logins will receive tokens signed with the new secret.');
  console.log('');
  console.log('After rotation, every user will need to sign in again on their next request.');
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
