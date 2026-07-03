import { SupabaseClient } from '@supabase/supabase-js';

export type ActivityType = 'active' | 'idle' | 'away' | 'on_call' | 'on_presentation' | 'browsing';

export async function logAgentActivity(
  client: SupabaseClient,
  params: {
    agentEmail: string;
    activityType: ActivityType;
    sessionId?: string | null;
    pagePath?: string | null;
    feature?: string | null;
    metadata?: Record<string, any> | null;
    startedAt?: string;
  }
) {
  const now = params.startedAt ?? new Date().toISOString();

  const { error } = await client.from('agent_activity_log').insert({
    agent_email: params.agentEmail.toLowerCase(),
    activity_type: params.activityType,
    session_id: params.sessionId ?? null,
    page_path: params.pagePath ?? null,
    feature: params.feature ?? null,
    started_at: now,
    metadata: params.metadata ?? null,
  });

  if (error) {
    console.error('logAgentActivity failed', error, params);
  } else {
    console.log(`✅ Activity logged: ${params.activityType} for ${params.agentEmail}`);
  }
}

export async function initializeAgentSession(
  client: SupabaseClient,
  params: {
    agentEmail: string;
    sessionId: string;
    metadata?: Record<string, any> | null;
  }
) {
  const now = new Date().toISOString();

  // Create/update session record with initial active state
  const { error } = await client.from('agent_sessions').upsert({
    agent_email: params.agentEmail.toLowerCase(),
    session_id: params.sessionId,
    current_status: 'active',
    last_activity_at: now,
    last_heartbeat_at: now,
    total_active_seconds: 0,
    total_idle_seconds: 0,
    total_call_seconds: 0,
    total_presentation_seconds: 0,
    metadata: params.metadata ?? null,
    updated_at: now,
  }, {
    onConflict: 'session_id',
  });

  if (error) {
    console.error('initializeAgentSession failed', error, params);
  } else {
    console.log(`✅ Session initialized: ${params.agentEmail} (session: ${params.sessionId})`);
  }
}

export async function updateAgentStatus(
  client: SupabaseClient,
  params: {
    agentEmail: string;
    sessionId: string;
    status: 'active' | 'idle' | 'away' | 'on_call' | 'on_presentation' | 'browsing';
    pagePath?: string | null;
    feature?: string | null;
    metadata?: Record<string, any> | null;
  }
) {
  const now = new Date().toISOString();

  // Get current session to calculate duration in previous state
  const { data: currentSession } = await client
    .from('agent_sessions')
    .select('current_status, last_activity_at, total_active_seconds, total_idle_seconds, total_call_seconds, total_presentation_seconds')
    .eq('session_id', params.sessionId)
    .eq('agent_email', params.agentEmail.toLowerCase())
    .maybeSingle();

  if (currentSession) {
    // Calculate duration in previous state
    const lastActivity = currentSession.last_activity_at ? new Date(currentSession.last_activity_at) : new Date(now);
    const durationSeconds = Math.floor((new Date(now).getTime() - lastActivity.getTime()) / 1000);

    // Log previous state change to activity_log
    if (currentSession.current_status !== params.status && durationSeconds > 0) {
      await logAgentActivity(client, {
        agentEmail: params.agentEmail,
        activityType: currentSession.current_status as ActivityType,
        sessionId: params.sessionId,
        pagePath: params.pagePath,
        feature: params.feature,
        metadata: params.metadata,
        startedAt: currentSession.last_activity_at || now,
      });

      // Update duration counters based on previous state
      const updates: any = {
        current_status: params.status,
        last_activity_at: now,
        last_heartbeat_at: now,
        current_page: params.pagePath ?? null,
        current_feature: params.feature ?? null,
        updated_at: now,
      };

      if (currentSession.current_status === 'active' || currentSession.current_status === 'browsing') {
        updates.total_active_seconds = (currentSession.total_active_seconds || 0) + durationSeconds;
      } else if (currentSession.current_status === 'idle' || currentSession.current_status === 'away') {
        updates.total_idle_seconds = (currentSession.total_idle_seconds || 0) + durationSeconds;
      } else if (currentSession.current_status === 'on_call') {
        updates.total_call_seconds = (currentSession.total_call_seconds || 0) + durationSeconds;
      } else if (currentSession.current_status === 'on_presentation') {
        updates.total_presentation_seconds = (currentSession.total_presentation_seconds || 0) + durationSeconds;
      }

      // Update session
      const { error } = await client
        .from('agent_sessions')
        .update(updates)
        .eq('session_id', params.sessionId)
        .eq('agent_email', params.agentEmail.toLowerCase());

      if (error) {
        console.error('updateAgentStatus failed', error, params);
      } else {
        console.log(`✅ Status updated: ${params.agentEmail} ${currentSession.current_status} -> ${params.status} (${durationSeconds}s)`);
      }
    } else {
      // Same status, just update heartbeat
      const { error } = await client
        .from('agent_sessions')
        .update({
          last_activity_at: now,
          last_heartbeat_at: now,
          current_page: params.pagePath ?? null,
          current_feature: params.feature ?? null,
          updated_at: now,
        })
        .eq('session_id', params.sessionId)
        .eq('agent_email', params.agentEmail.toLowerCase());

      if (error) {
        console.error('updateAgentStatus heartbeat failed', error, params);
      }
    }
  } else {
    // No session found, initialize it
    await initializeAgentSession(client, {
      agentEmail: params.agentEmail,
      sessionId: params.sessionId,
      metadata: params.metadata,
    });
  }
}

export async function heartbeat(
  client: SupabaseClient,
  params: {
    agentEmail: string;
    sessionId: string;
    isActive: boolean; // true if user is actively using the system (mouse/keyboard), false if idle
    pagePath?: string | null;
    feature?: string | null;
    metadata?: Record<string, any> | null;
  }
) {
  const now = new Date().toISOString();
  const status: 'active' | 'idle' = params.isActive ? 'active' : 'idle';

  // Update status (this will handle duration calculations)
  await updateAgentStatus(client, {
    agentEmail: params.agentEmail,
    sessionId: params.sessionId,
    status: status,
    pagePath: params.pagePath,
    feature: params.feature,
    metadata: params.metadata,
  });
}

