import { supabaseAdmin } from './supabase';

/**
 * Auto-analyze presentations with scraped data that haven't been analyzed yet
 * Runs every 5 minutes
 */
export class AutoAnalyzeService {
  private intervalId: NodeJS.Timeout | null = null;

  async analyzeUnprocessedSessions() {
    try {
      console.log('🤖 Checking for unanalyzed presentations...');

      // Find sessions with scraped data but no analysis
      const { data: sessions } = await supabaseAdmin
        .from('presentation_sessions')
        .select('id, electron_session_id, agent_email')
        .eq('status', 'completed')
        .is('ai_summary', null)
        .limit(10);

      if (!sessions || sessions.length === 0) {
        console.log('   No unanalyzed sessions found');
        return;
      }

      console.log(`   Found ${sessions.length} sessions to analyze`);

      for (const session of sessions) {
        const sessionId = session.electron_session_id || session.id;
        
        // Check if this session has scraped data
        const { data: scrapedData, count } = await supabaseAdmin
          .from('scraped_presentation_data')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionId);

        if (!count || count === 0) {
          console.log(`   ⏭️  Skipping ${sessionId} - no scraped data`);
          continue;
        }

        console.log(`   🔬 Analyzing ${sessionId} (${count} data points)...`);

        try {
          // Trigger analysis via API
          const response = await fetch(`http://localhost:5000/api/presentations/analyze/${sessionId}`, {
            method: 'POST'
          });

          const data = await response.json();

          if (data.success) {
            console.log(`   ✅ Analysis complete for ${sessionId}`);
          } else {
            console.log(`   ❌ Analysis failed for ${sessionId}:`, data.error);
          }
        } catch (error: any) {
          console.error(`   ❌ Error analyzing ${sessionId}:`, error.message);
        }

        // Wait 3 seconds between analyses to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      console.log('✅ Auto-analysis batch complete');

    } catch (error) {
      console.error('❌ Error in auto-analyze:', error);
    }
  }

  start() {
    console.log('🚀 Starting auto-analyze service (runs every 5 minutes)...');
    
    // Run immediately
    this.analyzeUnprocessedSessions();

    // Then run every 5 minutes
    this.intervalId = setInterval(() => {
      this.analyzeUnprocessedSessions();
    }, 5 * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Auto-analyze service stopped');
    }
  }
}

export const autoAnalyzeService = new AutoAnalyzeService();

