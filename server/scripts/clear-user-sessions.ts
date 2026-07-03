import { supabaseAdmin } from '../supabase';

const userEmail = process.argv[2]?.toLowerCase().trim();

if (!userEmail) {
  console.error('❌ Usage: ts-node clear-user-sessions.ts <email>');
  console.error('   Example: ts-node clear-user-sessions.ts adrianrodriguez@aoglobelife.com');
  process.exit(1);
}

async function clearUserSessions() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  console.log(`🧹 Clearing all sessions for: ${userEmail}`);

  try {
    // Clear agent_sessions
    const { data: agentSessions, error: agentError } = await supabaseAdmin
      .from('agent_sessions')
      .delete()
      .eq('agent_email', userEmail)
      .select();

    if (agentError) {
      console.error('❌ Error clearing agent_sessions:', agentError);
    } else {
      console.log(`✅ Cleared ${agentSessions?.length || 0} agent_sessions`);
    }

    // Clear active_logins (if table exists)
    try {
      const { data: activeLogins, error: activeError } = await supabaseAdmin
        .from('active_logins')
        .delete()
        .eq('user_email', userEmail)
        .select();

      if (activeError && activeError.code !== 'PGRST116') { // PGRST116 = table doesn't exist
        console.error('❌ Error clearing active_logins:', activeError);
      } else if (!activeError) {
        console.log(`✅ Cleared ${activeLogins?.length || 0} active_logins`);
      }
    } catch (e) {
      console.log('⚠️ active_logins table may not exist, skipping');
    }

    // Clear user_sessions
    try {
      const { data: userSessions, error: userError } = await supabaseAdmin
        .from('user_sessions')
        .delete()
        .eq('user_email', userEmail)
        .select();

      if (userError) {
        console.error('❌ Error clearing user_sessions:', userError);
      } else {
        console.log(`✅ Cleared ${userSessions?.length || 0} user_sessions`);
      }
    } catch (e) {
      console.log('⚠️ user_sessions table may not exist, skipping');
    }

    console.log(`✅ Done! User ${userEmail} can now log in.`);
  } catch (error) {
    console.error('❌ Failed to clear sessions:', error);
    process.exit(1);
  }
}

clearUserSessions();
