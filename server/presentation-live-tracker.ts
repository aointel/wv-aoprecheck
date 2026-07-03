/**
 * Presentation Live Tracker
 * Tracks real-time HPPro presentations for Live Board display
 */

interface LivePresentation {
  sessionId: string;
  agentEmail: string;
  agentName: string;
  clientName?: string;
  clientPhone?: string;
  presentationType: 'hppro' | 'other';
  presentationUrl?: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  confirmedLive: boolean; // Only true if presentation has been active for >30s or AI detected content
  screenshotCount: number; // Track how many screenshots captured
  lastScreenshotAt?: Date;
  latestScreenshot?: string;
  currentPhase?: string;
}

class PresentationLiveTracker {
  private activePresentations: Map<string, LivePresentation> = new Map(); // Key: sessionId

  /**
   * Start tracking a new presentation
   */
  startPresentation(data: {
    sessionId: string;
    agentEmail: string;
    agentName: string;
    clientName?: string;
    clientPhone?: string;
    presentationType?: 'hppro' | 'other';
    presentationUrl?: string;
  }) {
    console.log(`🎬 Presentation Tracker: Starting presentation ${data.sessionId} for ${data.agentEmail}`);
    
    const presentation: LivePresentation = {
      sessionId: data.sessionId,
      agentEmail: data.agentEmail,
      agentName: data.agentName,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      presentationType: data.presentationType || 'hppro',
      presentationUrl: data.presentationUrl,
      startedAt: new Date(),
      confirmedLive: false, // Start as unconfirmed until proven active
      screenshotCount: 0,
      lastScreenshotAt: undefined
    };

    this.activePresentations.set(data.sessionId, presentation);
    
    // Auto-confirm after 30 seconds if still active (agent didn't just quickly open/close)
    setTimeout(() => {
      const stillActive = this.activePresentations.get(data.sessionId);
      if (stillActive && !stillActive.confirmedLive) {
        stillActive.confirmedLive = true;
        console.log(`✅ Presentation ${data.sessionId} confirmed LIVE after 30 seconds`);
      }
    }, 30000);
    
    return presentation;
  }

  /**
   * End a presentation
   */
  endPresentation(sessionId: string) {
    const presentation = this.activePresentations.get(sessionId);
    if (!presentation) {
      console.log(`⚠️ Presentation Tracker: Presentation ${sessionId} not found`);
      return null;
    }

    console.log(`🎬 Presentation Tracker: Ending presentation ${sessionId}`);
    
    presentation.endedAt = new Date();
    presentation.durationSeconds = Math.floor((presentation.endedAt.getTime() - presentation.startedAt.getTime()) / 1000);
    
    // Remove from active presentations immediately
    this.activePresentations.delete(sessionId);
    console.log(`🗑️ Presentation Tracker: Removed completed presentation ${sessionId}`);
    
    return presentation;
  }

  /**
   * Update presentation with latest screenshot
   */
  updateScreenshot(sessionId: string, screenshotUrl: string) {
    const presentation = this.activePresentations.get(sessionId);
    if (!presentation) {
      console.log(`⚠️ Presentation Tracker: Presentation ${sessionId} not found for screenshot update`);
      return null;
    }

    presentation.latestScreenshot = screenshotUrl;
    presentation.screenshotCount++;
    presentation.lastScreenshotAt = new Date();
    
    // Auto-confirm as LIVE after 2 screenshots (30-60 seconds of activity)
    if (presentation.screenshotCount >= 2 && !presentation.confirmedLive) {
      presentation.confirmedLive = true;
      console.log(`✅ Presentation ${sessionId} confirmed LIVE after ${presentation.screenshotCount} screenshots`);
    }
    
    console.log(`📸 Presentation Tracker: Updated screenshot for ${sessionId} (count: ${presentation.screenshotCount})`);
    
    return presentation;
  }

  /**
   * Update current phase/slide info
   */
  updatePhase(sessionId: string, phase: string) {
    const presentation = this.activePresentations.get(sessionId);
    if (!presentation) {
      return null;
    }

    presentation.currentPhase = phase;
    return presentation;
  }

  /**
   * Get all active presentations (only confirmed LIVE ones)
   */
  getActivePresentations(): LivePresentation[] {
    // Calculate duration for active presentations
    const now = new Date();
    const presentations = Array.from(this.activePresentations.values());
    
    // Clean up stale presentations (older than 5 minutes with no recent screenshot)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    presentations.forEach(p => {
      const lastActivity = p.lastScreenshotAt || p.startedAt;
      if (lastActivity < fiveMinutesAgo) {
        console.log(`🧹 Cleaning up stale presentation ${p.sessionId} (last activity: ${lastActivity.toISOString()})`);
        this.activePresentations.delete(p.sessionId);
      }
    });
    
    // Get fresh list after cleanup
    const activePresentations = Array.from(this.activePresentations.values());
    
    // Only return CONFIRMED LIVE presentations that haven't ended
    return activePresentations
      .filter(p => p.confirmedLive && !p.endedAt)
      .map(p => {
        const duration = Math.floor((now.getTime() - p.startedAt.getTime()) / 1000);
        return {
          ...p,
          durationSeconds: duration
        };
      })
      .filter(p => p.durationSeconds > 0); // Remove 0-duration presentations
  }

  /**
   * Get active presentations for a specific agent
   */
  getAgentPresentations(agentEmail: string): LivePresentation[] {
    return this.getActivePresentations().filter(p => p.agentEmail === agentEmail);
  }
}

// Singleton instance
export const presentationLiveTracker = new PresentationLiveTracker();

