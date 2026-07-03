/**
 * Reset passwords for whitelisted CCPro users to "aointel2026"
 */

import { supabaseAdmin } from '../supabase';

const WHITELISTED_EMAILS = [
  'richiealtig@aoglobelife.com',
  'coopertyler@aoglobelife.com',
  'jacobnavarre@aoglobelife.com',
  'kaylar@aoglobelife.com',
  'ryancarrion@aoglobelife.com',
  'makelaoutlawalexander@aoglobelife.com',
  'langjames@aoglobelife.com',
  'vernawillbur@aoglobelife.com',
  'nicolasmahaffy@aoglobelife.com',
  'veeolalitvinenko@aoglobelife.com',
  'kristinapleshakova@aoglobelife.com',
  'williamlafond@aoglobelife.com',
  'annaswacker@aoglobelife.com',
  'leandratafoya@aoglobelife.com',
  'allenlane@aoglobelife.com',
  'margaretrudy@aoglobelife.com',
  'russellerhardt@aoglobelife.com'
];

const NEW_PASSWORD = 'aointel2026';

async function resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string; created?: boolean }> {
  if (!supabaseAdmin) {
    return { success: false, error: 'Supabase admin client not available' };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`\n🔄 Processing: ${normalizedEmail}`);

    // First, find the user by email (check all pages)
    let user = null;
    let page = 1;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore && !user) {
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: pageSize
      });
      
      if (listError) {
        console.error(`❌ Error listing users:`, listError);
        return { success: false, error: listError.message };
      }

      if (usersData?.users) {
        user = usersData.users.find(u => u.email?.toLowerCase().trim() === normalizedEmail);
        if (user) break;
        hasMore = usersData.users.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    // If user doesn't exist, create them
    if (!user) {
      console.log(`📝 User not found, creating account for: ${normalizedEmail}`);
      
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: NEW_PASSWORD,
        email_confirm: true, // Auto-confirm email
      });

      if (createError) {
        console.error(`❌ Error creating user:`, createError);
        return { success: false, error: createError.message };
      }

      if (!createData.user) {
        return { success: false, error: 'Failed to create user account' };
      }

      console.log(`✅ Account created and password set for ${normalizedEmail}`);
      return { success: true, created: true };
    }

    console.log(`✅ Found existing user: ${user.email} (ID: ${user.id})`);

    // Reset password using user ID
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: NEW_PASSWORD }
    );

    if (updateError) {
      console.error(`❌ Error resetting password:`, updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`✅ Password reset successful for ${normalizedEmail}`);
    return { success: true, created: false };
  } catch (error: any) {
    console.error(`❌ Unexpected error for ${email}:`, error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

async function main() {
  console.log('🚀 Starting password reset for whitelisted CCPro users...');
  console.log(`📋 Total users: ${WHITELISTED_EMAILS.length}`);
  console.log(`🔑 New password: ${NEW_PASSWORD}\n`);

  const results: Array<{ email: string; success: boolean; error?: string; created?: boolean }> = [];

  for (const email of WHITELISTED_EMAILS) {
    const result = await resetPasswordForEmail(email);
    results.push({ email, ...result });
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Summary:');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const created = results.filter(r => r.created);
  const updated = results.filter(r => r.success && !r.created);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  if (created.length > 0) {
    console.log(`\n   📝 Created new accounts (${created.length}):`);
    created.forEach(r => console.log(`      ✓ ${r.email}`));
  }
  if (updated.length > 0) {
    console.log(`\n   🔄 Updated existing accounts (${updated.length}):`);
    updated.forEach(r => console.log(`      ✓ ${r.email}`));
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => console.log(`   ✗ ${r.email}: ${r.error || 'Unknown error'}`));
  }

  console.log('='.repeat(60));
  console.log('\n✅ Password reset complete!');
}

// Always run when executed directly
main().catch(console.error);
