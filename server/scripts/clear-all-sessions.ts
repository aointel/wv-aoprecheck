/**
 * Clear All Active Sessions
 * 
 * Clears all session tracking mechanisms:
 * 1. active_logins table (JWT iat tracking)
 * 2. agent_sessions table (agent activity tracking)
 * 3. user_sessions table (user session tracking)
 * 
 * This forces all users to log in again on their next request.
 */

import { supabaseAdmin } from '../supabase';

async function clearAllSessions() {
  try {
    console.log('🔄 Starting session clear process...\n');

    let totalCleared = 0;

    // 1. Clear active_logins table (JWT iat tracking)
    try {
      const { count: beforeCount } = await supabaseAdmin
        .from('active_logins')
        .select('*', { count: 'exact', head: true });

      const { error: deleteError } = await supabaseAdmin
        .from('active_logins')
        .delete()
        .neq('user_email', 'never-match-this'); // Delete all rows

      if (deleteError) {
        console.warn(`⚠️ active_logins table doesn't exist or error: ${deleteError.message}`);
      } else {
        const { count: afterCount } = await supabaseAdmin
          .from('active_logins')
          .select('*', { count: 'exact', head: true });
        
        const cleared = (beforeCount || 0) - (afterCount || 0);
        totalCleared += cleared;
        console.log(`✅ Cleared ${cleared} active_logins entries`);
      }
    } catch (error: any) {
      if (error.code === '42P01') {
        console.log(`ℹ️ active_logins table doesn't exist (skipping)`);
      } else {
        console.warn(`⚠️ Error clearing active_logins: ${error.message}`);
      }
    }

    // 2. Clear agent_sessions table (mark all as expired/inactive)
    try {
      const { count: beforeCount } = await supabaseAdmin
        .from('agent_sessions')
        .select('*', { count: 'exact', head: true });

      // Delete all agent_sessions to force re-login
      const { error: deleteError } = await supabaseAdmin
        .from('agent_sessions')
        .delete()
        .neq('agent_email', 'never-match-this'); // Delete all rows

      if (deleteError) {
        console.warn(`⚠️ Error clearing agent_sessions: ${deleteError.message}`);
      } else {
        const { count: afterCount } = await supabaseAdmin
          .from('agent_sessions')
          .select('*', { count: 'exact', head: true });
        
        const cleared = (beforeCount || 0) - (afterCount || 0);
        totalCleared += cleared;
        console.log(`✅ Cleared ${cleared} agent_sessions entries`);
      }
    } catch (error: any) {
      if (error.code === '42P01') {
        console.log(`ℹ️ agent_sessions table doesn't exist (skipping)`);
      } else {
        console.warn(`⚠️ Error clearing agent_sessions: ${error.message}`);
      }
    }

    // 3. Clear user_sessions table (mark all as inactive)
    try {
      const { count: beforeCount } = await supabaseAdmin
        .from('user_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Mark all active sessions as inactive
      const { error: updateError } = await supabaseAdmin
        .from('user_sessions')
        .update({ 
          is_active: false,
          logout_time: new Date().toISOString()
        })
        .eq('is_active', true);

      if (updateError) {
        console.warn(`⚠️ Error clearing user_sessions: ${updateError.message}`);
      } else {
        const { count: afterCount } = await supabaseAdmin
          .from('user_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);
        
        const cleared = (beforeCount || 0) - (afterCount || 0);
        totalCleared += cleared;
        console.log(`✅ Cleared ${cleared} user_sessions entries`);
      }
    } catch (error: any) {
      if (error.code === '42P01') {
        console.log(`ℹ️ user_sessions table doesn't exist (skipping)`);
      } else {
        console.warn(`⚠️ Error clearing user_sessions: ${error.message}`);
      }
    }

    console.log(`\n✅ Session clear complete!`);
    console.log(`   Total sessions cleared: ${totalCleared}`);
    console.log(`\n🔒 All users will be forced to log in again on their next request.`);
    console.log(`⚠️ NOTE: In-memory session store (MemoryStore) will need to be cleared on the server.`);
    console.log(`   This may require a server restart or calling sessionStore.clear() on the live server.`);

  } catch (error) {
    console.error('❌ Fatal error clearing sessions:', error);
    throw error;
  }
}

// Run the script if executed directly
clearAllSessions()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

export { clearAllSessions };
