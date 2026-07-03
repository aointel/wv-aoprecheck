/**
 * Presentation Lifecycle Manager
 * Handles presentation state transitions, timeouts, and validation
 */

import { supabaseAdmin } from './supabase';

export interface PresentationPhase {
  name: string;
  isRealPresentation: boolean; // True if client is confirmed present
  maxIdleMinutes: number; // Max time with no activity before marking stale
}

export const PRESENTATION_PHASES: Record<string, PresentationPhase> = {
  'data_entry': { 
    name: 'Data Entry',
    isRealPresentation: false, // Agent just entering info, no client
    maxIdleMinutes: 30
  },
  'intro_screen': { 
    name: 'Intro/Welcome',
    isRealPresentation: true, // ** CLIENT IS PRESENT ** - This is the threshold
    maxIdleMinutes: 120
  },
  'needs_analysis': { 
    name: 'Needs Analysis',
    isRealPresentation: true,
    maxIdleMinutes: 120
  },
  'plan_generation': { 
    name: 'Plan Generation',
    isRealPresentation: true,
    maxIdleMinutes: 120
  },
  'plan_presentation': { 
    name: 'Plan Presentation',
    isRealPresentation: true,
    maxIdleMinutes: 120
  },
  'benefits_summary': { 
    name: 'Benefits Summary',
    isRealPresentation: true,
    maxIdleMinutes: 120
  },
  'eapp_enrollment': { 
    name: 'E-App/Enrollment',
    isRealPresentation: true,
    maxIdleMinutes: 120
  },
  'complete': { 
    name: 'Complete',
    isRealPresentation: true,
    maxIdleMinutes: 0
  }
};

class PresentationLifecycleManager {
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start the lifecycle manager
   * Runs periodic checks for stale/timeout presentations
   */
  start() {
    console.log('🔄 Presentation Lifecycle Manager starting...');
    
    // Check every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkStalePresentations();
    }, 5 * 60 * 1000);

    // Run immediately on start
    this.checkStalePresentations();
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check for stale/abandoned presentations and auto-end them
   */
  async checkStalePresentations() {
    // Reduced logging - only log if in dev mode
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 Checking for stale presentations...');
    }

    try {
      // Get all active presentations (exclude null session_id)
      const { data: sessions, error } = await supabaseAdmin
        .from('presentation_sessions')
        .select('*')
        .eq('status', 'active')
        .not('session_id', 'is', null);

      if (error || !sessions || sessions.length === 0) {
        return;
      }

      const now = Date.now();
      let staleCount = 0;

      for (const session of sessions) {
        // Skip sessions with null session_id (invalid data)
        if (!session.session_id) {
          console.warn(`⚠️ Skipping presentation with null session_id (id: ${session.id || 'unknown'})`);
          continue;
        }

        const updatedAt = new Date(session.updated_at || session.started_at).getTime();
        const idleMinutes = (now - updatedAt) / (60 * 1000);
        
        const currentPhase = PRESENTATION_PHASES[session.current_phase || 'data_entry'];
        const maxIdleMinutes = currentPhase?.maxIdleMinutes || 120;

        // Check if presentation is stale
        if (idleMinutes > maxIdleMinutes) {
          // Only log if really stale (over 24 hours) to reduce noise
          if (idleMinutes > 1440) {
            console.log(`⏰ Presentation ${session.session_id} is stale (${Math.floor(idleMinutes)} mins idle)`);
          }
          await this.endPresentationAsAbandoned(session.session_id, 'timeout');
          staleCount++;
        }

        // Check for duplicate screenshots (stuck on same screen for 30+ mins)
        await this.checkDuplicateScreenshots(session.session_id);
      }

      // Only log if we actually ended presentations
      if (staleCount > 0 && process.env.NODE_ENV !== 'production') {
        console.log(`✅ Ended ${staleCount} stale presentations`);
      }

    } catch (error) {
      console.error('❌ Error checking stale presentations:', error);
    }
  }

  /**
   * Check if presentation is stuck on the same screenshot
   */
  async checkDuplicateScreenshots(sessionId: string) {
    try {
      // Get last 10 screenshots
      const { data: screenshots } = await supabaseAdmin
        .from('presentation_screenshots')
        .select('file_path, created_at')
        .eq('session_id', sessionId)
        .order('sequence_number', { ascending: false })
        .limit(10);

      if (!screenshots || screenshots.length < 5) {
        return; // Not enough data
      }

      // Check if all recent screenshots are similar (same file size would indicate same content)
      // For now, just check timestamps - if 30+ mins with screenshots but no phase change
      const oldestScreenshot = new Date(screenshots[screenshots.length - 1].created_at).getTime();
      const newestScreenshot = new Date(screenshots[0].created_at).getTime();
      const minutesDiff = (newestScreenshot - oldestScreenshot) / (60 * 1000);

      if (minutesDiff > 30) {
        // Check if phase changed during this time
        const { data: session } = await supabaseAdmin
          .from('presentation_sessions')
          .select('current_phase, phase_updated_at')
          .eq('session_id', sessionId)
          .single();

        if (session) {
          const phaseUpdatedAt = new Date(session.phase_updated_at || 0).getTime();
          const phaseIdleMinutes = (Date.now() - phaseUpdatedAt) / (60 * 1000);

          if (phaseIdleMinutes > 30) {
            console.log(`⚠️ Presentation ${sessionId} stuck on same phase for ${Math.floor(phaseIdleMinutes)} mins`);
            await this.endPresentationAsAbandoned(sessionId, 'stuck');
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error checking duplicate screenshots for ${sessionId}:`, error);
    }
  }

  /**
   * End a presentation as abandoned/incomplete
   */
  async endPresentationAsAbandoned(sessionId: string, reason: 'timeout' | 'stuck' | 'new_session') {
    console.log(`❌ Ending presentation ${sessionId} as abandoned (reason: ${reason})`);

    try {
      const endedAt = new Date().toISOString();

      // Get session start time to calculate duration
      const { data: session } = await supabaseAdmin
        .from('presentation_sessions')
        .select('started_at, current_phase')
        .eq('session_id', sessionId)
        .single();

      if (!session) return;

      const durationSeconds = Math.floor(
        (new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 1000
      );

      // Update session
      await supabaseAdmin
        .from('presentation_sessions')
        .update({
          status: 'abandoned',
          ended_at: endedAt,
          duration_seconds: durationSeconds,
          presentation_outcome: reason === 'timeout' ? 'TIMEOUT' : 'ABANDONED',
          updated_at: endedAt
        })
        .eq('session_id', sessionId);

      // Remove from live presentations
      await supabaseAdmin
        .from('live_presentations')
        .update({ is_active: false })
        .eq('session_id', sessionId);

      console.log(`✅ Presentation ${sessionId} marked as abandoned`);
    } catch (error) {
      console.error(`❌ Error ending presentation ${sessionId}:`, error);
    }
  }

  /**
   * End any active presentations for an agent when they start a new one
   */
  async endPreviousPresentations(agentEmail: string, newSessionId: string) {
    console.log(`🔄 Ending previous presentations for ${agentEmail}...`);

    try {
      const { data: sessions } = await supabaseAdmin
        .from('presentation_sessions')
        .select('session_id')
        .eq('agent_email', agentEmail)
        .eq('status', 'active')
        .neq('session_id', newSessionId);

      if (sessions && sessions.length > 0) {
        console.log(`📛 Found ${sessions.length} active presentations to end`);
        
        for (const session of sessions) {
          await this.endPresentationAsAbandoned(session.session_id, 'new_session');
        }
      }
    } catch (error) {
      console.error(`❌ Error ending previous presentations for ${agentEmail}:`, error);
    }
  }

  /**
   * Update presentation phase and validate if it's a "real" presentation
   */
  async updatePhase(sessionId: string, newPhase: string) {
    console.log(`📍 Updating presentation ${sessionId} to phase: ${newPhase}`);

    try {
      const phase = PRESENTATION_PHASES[newPhase];
      if (!phase) {
        console.warn(`⚠️ Unknown phase: ${newPhase}`);
        return;
      }

      const updateData: any = {
        current_phase: newPhase,
        phase_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // If this is the first "real" presentation phase (client confirmed present)
      if (phase.isRealPresentation) {
        const { data: session } = await supabaseAdmin
          .from('presentation_sessions')
          .select('client_confirmed_at')
          .eq('session_id', sessionId)
          .single();

        if (!session?.client_confirmed_at) {
          updateData.client_confirmed_at = new Date().toISOString();
          console.log(`✅ Client confirmed present for presentation ${sessionId}`);
        }
      }

      await supabaseAdmin
        .from('presentation_sessions')
        .update(updateData)
        .eq('session_id', sessionId);

    } catch (error) {
      console.error(`❌ Error updating phase for ${sessionId}:`, error);
    }
  }

  /**
   * Get presentation progress for display on Call Board
   */
  async getPresentationProgress(sessionId: string) {
    try {
      const { data: session } = await supabaseAdmin
        .from('presentation_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (!session) return null;

      const currentPhase = PRESENTATION_PHASES[session.current_phase || 'data_entry'];
      const isRealPresentation = currentPhase?.isRealPresentation || false;
      
      // Calculate progress percentage
      const phaseOrder = Object.keys(PRESENTATION_PHASES);
      const currentIndex = phaseOrder.indexOf(session.current_phase || 'data_entry');
      const progressPercent = Math.floor((currentIndex / (phaseOrder.length - 1)) * 100);

      // Calculate time in current phase
      const phaseUpdatedAt = new Date(session.phase_updated_at || session.started_at).getTime();
      const timeInPhaseMinutes = Math.floor((Date.now() - phaseUpdatedAt) / (60 * 1000));

      return {
        sessionId: session.session_id,
        agentEmail: session.agent_email,
        agentName: session.agent_name,
        currentPhase: currentPhase?.name || 'Unknown',
        phaseKey: session.current_phase,
        isRealPresentation,
        progressPercent,
        timeInPhaseMinutes,
        startedAt: session.started_at,
        clientConfirmedAt: session.client_confirmed_at,
        status: session.status
      };
    } catch (error) {
      console.error(`❌ Error getting progress for ${sessionId}:`, error);
      return null;
    }
  }
}

export const presentationLifecycleManager = new PresentationLifecycleManager();

