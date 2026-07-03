/**
 * Presentation Tracking Service
 * Monitors agent presentations, captures screenshots, and tracks KPIs
 */

import { supabaseAdmin } from './supabase';
import { presentationAIAnalyzer } from './presentation-ai-analyzer';
import { presentationLifecycleManager } from './presentation-lifecycle-manager';

interface PresentationSession {
  id: string;
  agent_email: string;
  agent_name: string;
  associate_id?: number;
  presentation_url: string;
  presentation_type: string;
  window_title?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  started_at: string;
  status: 'active' | 'completed' | 'interrupted';
}

interface Screenshot {
  session_id: string;
  screenshot_url: string;
  screenshot_data?: string; // Base64
  thumbnail_url?: string;
  sequence_number: number;
  time_offset_seconds: number;
}

class PresentationTracker {
  private activeSessions: Map<string, PresentationSession> = new Map();
  private screenshotIntervals: Map<string, NodeJS.Timeout> = new Map();
  private screenshotInterval = 10000; // Capture every 10 seconds

  /**
   * Start tracking a new presentation session
   */
  async startSession(data: {
    agent_email: string;
    agent_name: string;
    associate_id?: number;
    presentation_url: string;
    presentation_type: string;
    window_title?: string;
    client_name?: string;
    client_phone?: string;
    client_email?: string;
  }): Promise<string> {
    console.log('🎬 Starting presentation session for:', data.agent_email);

    try {
      // Generate a unique session_id
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create session in database
      const { data: session, error } = await supabaseAdmin
        .from('presentation_sessions')
        .insert({
          session_id: sessionId,
          agent_email: data.agent_email,
          agent_name: data.agent_name,
          associate_id: data.associate_id,
          presentation_url: data.presentation_url,
          presentation_type: data.presentation_type,
          window_title: data.window_title,
          client_name: data.client_name,
          client_phone: data.client_phone,
          client_email: data.client_email,
          started_at: new Date().toISOString(),
          status: 'active',
          is_recording: true
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create presentation session:', error);
        throw error;
      }

      console.log('✅ Presentation session created:', session.session_id);

      // END ANY PREVIOUS ACTIVE PRESENTATIONS for this agent (non-blocking)
      presentationLifecycleManager.endPreviousPresentations(data.agent_email, session.session_id).catch(err => {
        console.error('⚠️ Failed to end previous presentations (non-critical):', err);
      });

      // Create live tracking record (non-blocking, non-critical)
      supabaseAdmin
        .from('live_presentations')
        .insert({
          session_id: session.session_id,
          agent_email: data.agent_email,
          agent_name: data.agent_name,
          current_slide_number: 1,
          is_active: true
        })
        .then(() => console.log('✅ Live presentation record created'))
        .catch(err => console.error('⚠️ Failed to create live presentation record (non-critical):', err));

      // Store in memory
      this.activeSessions.set(session.session_id, session);

      return session.session_id;
    } catch (error) {
      console.error('❌ Error starting presentation session:', error);
      throw error;
    }
  }

  /**
   * Capture a screenshot from the presentation
   */
  async captureScreenshot(sessionId: string, screenshotData: string): Promise<string> {
    try {
      console.log(`📸 captureScreenshot called for session: ${sessionId}`);
      console.log(`   Screenshot data length: ${screenshotData?.length || 0} bytes`);
      
      // Get session from database (not just memory)
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('presentation_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();
        
      if (sessionError) {
        console.error('❌ Error querying session from database:');
        console.error('   Error:', sessionError);
        console.error('   Session ID:', sessionId);
      }
        
      if (!session) {
        console.error('❌ Session not found in database:', sessionId);
        console.error('   Queried presentation_sessions table with session_id:', sessionId);
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      console.log(`✅ Session found in database: ${session.id} (UUID)`);
      console.log(`   Session started: ${session.started_at}`);

      // Get current screenshot count for sequence number
      const { count } = await supabaseAdmin
        .from('presentation_screenshots')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id); // FIX: Use UUID id, not string session_id

      const sequenceNumber = (count || 0) + 1;

      // Calculate time offset
      const startTime = new Date(session.started_at).getTime();
      const currentTime = Date.now();
      const timeOffset = Math.floor((currentTime - startTime) / 1000);

      // Analyze screenshot with AI (async, don't wait)
      presentationAIAnalyzer.analyzeSlide(screenshotData).then(async (analysis) => {
        if (analysis) {
          // Update screenshot with AI analysis
          await supabaseAdmin
            .from('presentation_screenshots')
            .update({
              slide_title: analysis.slide_title,
              slide_content: analysis.text_content,
              slide_type: analysis.slide_type,
              detected_products: analysis.products_mentioned,
              ai_analysis: analysis as any
            })
            .eq('session_id', session.id)  // FIX: Use UUID
            .eq('sequence_number', sequenceNumber);
          
          console.log(`🤖 AI analysis complete for slide ${sequenceNumber}: ${analysis.slide_title}`);
        }
      }).catch(err => console.error('AI analysis error:', err));

      // Upload screenshot to Supabase Storage (NO compression)
      let signedUrl = null;
      let fileName = `PRES-${sessionId}-${Date.now()}.png`;
      
      try {
        const base64Data = screenshotData.includes('base64,') 
          ? screenshotData.split('base64,')[1] 
          : screenshotData;
        
        console.log(`📤 Preparing to upload screenshot to Supabase Storage...`);
        console.log(`   File name: ${fileName}`);
        console.log(`   Base64 data length: ${base64Data.length}`);
        
        const buffer = Buffer.from(base64Data, 'base64');
        console.log(`   Buffer size: ${buffer.length} bytes (${(buffer.length / 1024).toFixed(2)} KB)`);
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('verify_agent_screenshot')
          .upload(fileName, buffer, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('❌ Screenshot upload error to Supabase Storage:');
          console.error('   Error message:', uploadError.message);
          console.error('   Error details:', JSON.stringify(uploadError, null, 2));
          console.error('   File name:', fileName);
          console.error('   Buffer size:', buffer.length);
        } else {
          console.log('✅ Screenshot uploaded to Supabase Storage successfully');
          
          // Generate signed URL (1 year expiry)
          const { data: urlData, error: urlError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .createSignedUrl(fileName, 31536000);

          if (!urlError && urlData) {
            signedUrl = urlData.signedUrl;
            console.log('✅ Screenshot uploaded with signed URL');
          } else {
            console.error('❌ Failed to generate signed URL:', urlError);
          }
        }
      } catch (uploadError: any) {
        console.error('❌ Exception uploading screenshot to Supabase:');
        console.error('   Error message:', uploadError?.message);
        console.error('   Error stack:', uploadError?.stack);
      }

      // Store screenshot reference (NOT the base64 data - too large!)
      console.log(`💾 Inserting screenshot metadata into database...`);
      console.log(`   Session UUID: ${session.id}`);
      console.log(`   File path: ${fileName}`);
      console.log(`   Signed URL: ${signedUrl ? 'YES' : 'NO'}`);
      console.log(`   Sequence: ${sequenceNumber}`);
      
      const { data: screenshot, error } = await supabaseAdmin
        .from('presentation_screenshots')
        .insert({
          session_id: session.id, // Use the UUID id for foreign key
          file_path: fileName, // Reference to Storage file
          screenshot_url: signedUrl, // Signed URL for access
          sequence_number: sequenceNumber,
          time_offset_seconds: timeOffset,
          captured_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to insert screenshot metadata into database:');
        console.error('   Error:', error);
        console.error('   Session UUID:', session.id);
        console.error('   File path:', fileName);
        console.error('   Has signed URL:', !!signedUrl);
        throw error;
      }
      
      console.log(`✅ Screenshot metadata inserted successfully, screenshot ID: ${screenshot.id}`);

      // Update live presentation with latest screenshot
      await this.updateLivePresentation(sessionId, {
        current_screenshot_url: screenshotData,
        last_activity_at: new Date().toISOString()
      });

      return screenshot.id;
    } catch (error) {
      console.error('❌ Error capturing screenshot:', error);
      throw error;
    }
  }

  /**
   * Update live presentation state
   */
  async updateLivePresentation(sessionId: string, updates: {
    current_slide_number?: number;
    current_slide_title?: string;
    current_screenshot_url?: string;
    last_activity_at?: string;
  }): Promise<void> {
    try {
      await supabaseAdmin
        .from('live_presentations')
        .update(updates)
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('❌ Error updating live presentation:', error);
    }
  }

  /**
   * End a presentation session
   */
  async endSession(sessionId: string, outcome?: {
    sale_made?: boolean;
    follow_up_scheduled?: boolean;
    client_interest_level?: string;
  }): Promise<void> {
    console.log('🛑 Ending presentation session:', sessionId);

    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        console.error('❌ Session not found:', sessionId);
        return;
      }

      // Calculate duration
      const startTime = new Date(session.started_at).getTime();
      const endTime = Date.now();
      const durationSeconds = Math.floor((endTime - startTime) / 1000);

      // Get all screenshots
      const { data: screenshots, count } = await supabaseAdmin
        .from('presentation_screenshots')
        .select('*')
        .eq('session_id', sessionId)
        .order('sequence_number', { ascending: true });

      // Generate AI presentation summary
      let aiSummary = null;
      if (screenshots && screenshots.length > 0) {
        console.log('🤖 Generating AI presentation summary...');
        const analysis = await presentationAIAnalyzer.analyzePresentation(screenshots);
        if (analysis) {
          aiSummary = analysis;
          
          // Update session with AI insights
          await supabaseAdmin
            .from('presentation_sessions')
            .update({
              ai_summary: analysis.overall_summary,
              key_topics: analysis.products_covered,
              slides_data: { slides: analysis.slides_analysis }
            })
            .eq('id', sessionId);
        }
      }

      // Update session
      await supabaseAdmin
        .from('presentation_sessions')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          total_slides_shown: count || 0,
          status: 'completed'
        })
        .eq('id', sessionId);

      // Calculate and save KPIs
      await this.calculateKPIs(sessionId, outcome, aiSummary);

      // Transfer completed presentation to hppro_presentation_complete table
      try {
        const { hpproCompletionTransfer } = await import('./hppro-completion-transfer');
        await hpproCompletionTransfer.transferCompletedPresentation(sessionId);
        console.log('✅ Transferred presentation data to hppro_presentation_complete');
      } catch (transferError) {
        console.error('❌ Failed to transfer to hppro_presentation_complete:', transferError);
        // Don't throw - let the presentation still end successfully
      }

      // Mark live presentation as inactive
      await supabaseAdmin
        .from('live_presentations')
        .update({ is_active: false })
        .eq('session_id', sessionId);

      // Stop screenshot interval if running
      const interval = this.screenshotIntervals.get(sessionId);
      if (interval) {
        clearInterval(interval);
        this.screenshotIntervals.delete(sessionId);
      }

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      console.log('✅ Presentation session ended:', sessionId);
    } catch (error) {
      console.error('❌ Error ending presentation session:', error);
    }
  }

  /**
   * Calculate presentation KPIs
   */
  private async calculateKPIs(sessionId: string, outcome?: any, aiSummary?: any): Promise<void> {
    try {
      // Get all screenshots for analysis
      const { data: screenshots } = await supabaseAdmin
        .from('presentation_screenshots')
        .select('*')
        .eq('session_id', sessionId)
        .order('sequence_number', { ascending: true });

      if (!screenshots || screenshots.length === 0) {
        console.log('⚠️ No screenshots found for KPI calculation');
        return;
      }

      // Get session details
      const { data: session } = await supabaseAdmin
        .from('presentation_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!session) return;

      // Calculate metrics
      const totalSlides = screenshots.length;
      const durationSeconds = session.duration_seconds || 0;
      const avgTimePerSlide = durationSeconds / totalSlides;

      // Extract products from AI analysis
      const products_covered = aiSummary?.products_covered || [];
      const pricingSlides = screenshots.filter((s: any) => 
        s.ai_analysis?.has_pricing || s.slide_type === 'pricing'
      ).length;

      // Save KPIs
      await supabaseAdmin
        .from('presentation_kpis')
        .insert({
          session_id: sessionId,
          agent_email: session.agent_email,
          total_duration_seconds: durationSeconds,
          active_time_seconds: durationSeconds, // TODO: Calculate actual active time
          total_slides: totalSlides,
          unique_slides_shown: totalSlides,
          average_time_per_slide: avgTimePerSlide,
          products_covered: products_covered,
          pricing_slides_shown: pricingSlides,
          presentation_completed: true,
          completion_percentage: 100,
          last_slide_reached: totalSlides,
          presentation_flow_score: aiSummary?.quality_average || 0.5,
          sale_made: outcome?.sale_made || false,
          client_interest_level: outcome?.client_interest_level || null,
          follow_up_scheduled: outcome?.follow_up_scheduled || false,
          calculated_at: new Date().toISOString()
        });

      console.log('✅ KPIs calculated for session:', sessionId);
    } catch (error) {
      console.error('❌ Error calculating KPIs:', error);
    }
  }

  /**
   * Get active presentations
   */
  async getActivePresentations(): Promise<any[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('active_presentations')
        .select('*');

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error getting active presentations:', error);
      return [];
    }
  }

  /**
   * Get presentation session details
   */
  async getSession(sessionId: string): Promise<any> {
    try {
      const { data, error } = await supabaseAdmin
        .from('presentation_sessions')
        .select(`
          *,
          screenshots:presentation_screenshots(*),
          kpis:presentation_kpis(*),
          live:live_presentations(*)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('❌ Error getting session:', error);
      return null;
    }
  }

  /**
   * Get agent presentation history
   */
  async getAgentPresentations(agentEmail: string, limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('presentation_summary')
        .select('*')
        .eq('agent_email', agentEmail)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error getting agent presentations:', error);
      return [];
    }
  }

  /**
   * Add viewer to live presentation (for manager monitoring)
   */
  async addViewer(sessionId: string, managerEmail: string): Promise<void> {
    try {
      const { data: livePresentation } = await supabaseAdmin
        .from('live_presentations')
        .select('viewers')
        .eq('session_id', sessionId)
        .single();

      if (!livePresentation) return;

      const currentViewers = livePresentation.viewers || [];
      if (!currentViewers.includes(managerEmail)) {
        currentViewers.push(managerEmail);

        await supabaseAdmin
          .from('live_presentations')
          .update({
            viewers: currentViewers,
            viewer_count: currentViewers.length
          })
          .eq('session_id', sessionId);
      }
    } catch (error) {
      console.error('❌ Error adding viewer:', error);
    }
  }

  /**
   * Remove viewer from live presentation
   */
  async removeViewer(sessionId: string, managerEmail: string): Promise<void> {
    try {
      const { data: livePresentation } = await supabaseAdmin
        .from('live_presentations')
        .select('viewers')
        .eq('session_id', sessionId)
        .single();

      if (!livePresentation) return;

      const currentViewers = (livePresentation.viewers || []).filter(
        (email: string) => email !== managerEmail
      );

      await supabaseAdmin
        .from('live_presentations')
        .update({
          viewers: currentViewers,
          viewer_count: currentViewers.length
        })
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('❌ Error removing viewer:', error);
    }
  }

  // Update session with video URL
  async updateVideoUrl(sessionId: string, videoUrl: string) {
    try {
      const { error } = await supabaseAdmin
        .from('presentation_sessions')
        .update({ 
          video_url: videoUrl,
          video_uploaded_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);

      if (error) throw error;
      console.log('✅ Updated video URL for session:', sessionId);
    } catch (error) {
      console.error('❌ Error updating video URL:', error);
      throw error;
    }
  }

  // Get all presentation sessions with filters
  async getAllSessions(filters?: { search?: string; status?: string; dateRange?: string }) {
    try {
      let query = supabaseAdmin
        .from('presentation_sessions')
        .select('*')
        .order('started_at', { ascending: false });

      // Apply filters
      if (filters?.search) {
        query = query.or(`agent_name.ilike.%${filters.search}%,agent_email.ilike.%${filters.search}%`);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.dateRange) {
        const now = new Date();
        let startDate = new Date();

        switch (filters.dateRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
        }

        if (filters.dateRange !== 'all') {
          query = query.gte('started_at', startDate.toISOString());
        }
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      // For each session, get screenshot count
      const sessionsWithCounts = await Promise.all((data || []).map(async (session) => {
        const { count, error: countError } = await supabaseAdmin
          .from('presentation_screenshots')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.session_id);

        return {
          ...session,
          screenshot_count: count || 0
        };
      }));

      // Filter out only completely empty sessions (exclude truly empty/abandoned sessions)
      // Show all sessions - no filtering
      const validSessions = sessionsWithCounts;

      console.log(`📊 getAllSessions: ${sessionsWithCounts.length} total → ${validSessions.length} valid (filtered out ${sessionsWithCounts.length - validSessions.length} empty sessions)`);

      return validSessions;
    } catch (error) {
      console.error('❌ Error getting all sessions:', error);
      return [];
    }
  }
}

// Singleton instance
export const presentationTracker = new PresentationTracker();
