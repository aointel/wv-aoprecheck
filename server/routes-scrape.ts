import { Router } from 'express';
import { supabaseAdmin } from './supabase';

const router = Router();

/**
 * POST /api/presentations/scrape-data
 * Store scraped page data from HP Pro popups (injected via frontend)
 */
router.post('/scrape-data', async (req, res) => {
  try {
    const { sessionId, scrapedData, timestamp } = req.body;

    if (!sessionId || !scrapedData) {
      return res.status(400).json({ 
        error: 'Missing required fields: sessionId, scrapedData' 
      });
    }

    console.log('🔍 SCRAPED DATA RECEIVED:');
    console.log('   Session ID:', sessionId);
    console.log('   URL:', scrapedData.url);
    console.log('   Title:', scrapedData.title);

    // Check if presentation session exists for this electron_session_id
    const { data: existingSession } = await supabaseAdmin
      .from('presentation_sessions')
      .select('id')
      .eq('electron_session_id', sessionId)
      .single();

    // If no session exists, create one
    if (!existingSession) {
      console.log('   ⚠️ No presentation_session found - creating one now...');
      
      // Extract agent email from scraped data or use placeholder
      const agentEmail = scrapedData.url?.includes('hppro') ? 'unknown@aoglobelife.com' : 'unknown@aoglobelife.com';
      
      const { data: newSession, error: createError } = await supabaseAdmin
        .from('presentation_sessions')
        .insert({
          electron_session_id: sessionId, // Track Electron's session ID
          agent_email: agentEmail,
          agent_name: agentEmail.split('@')[0],
          presentation_url: scrapedData.url || scrapedData?.metadata?.url || 'hppro-proxy',
          presentation_type: scrapedData.url?.includes('hppro') ? 'hppro' : 'other',
          started_at: timestamp || new Date().toISOString(),
          status: 'active'
        })
        .select()
        .single();

      if (createError) {
        console.error('   ❌ Failed to create session:', createError);
      } else {
        console.log('   ✅ Presentation session created!');
        console.log('   - UUID:', newSession.id);
        console.log('   - Electron ID:', sessionId);
      }
    } else {
      console.log('   ✅ Session exists:', existingSession.id);
    }

    // Store scraped data in database
    const { data, error } = await supabaseAdmin
      .from('scraped_presentation_data')
      .insert({
        session_id: sessionId,
        scraped_data: scrapedData,
        timestamp: timestamp || new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('❌ Database error storing scraped data:', error);
      return res.status(500).json({ 
        error: 'Failed to store scraped data',
        details: error.message 
      });
    }

    console.log('✅ Scraped data stored successfully');
    console.log('   Database ID:', data[0]?.id);

    res.json({
      success: true,
      message: 'Scraped data stored successfully',
      sessionId: sessionId
    });

  } catch (error) {
    console.error('❌ Error processing scraped data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/presentations/scrape-data/:sessionId
 * Retrieve scraped data for a session
 */
router.get('/scrape-data/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log('🔍 RETRIEVING SCRAPED DATA for session:', sessionId);

    const { data, error } = await supabaseAdmin
      .from('scraped_presentation_data')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('❌ Database error retrieving scraped data:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve scraped data',
        details: error.message 
      });
    }

    console.log(`✅ Retrieved ${data.length} scraped data entries`);

    res.json({
      success: true,
      sessionId: sessionId,
      count: data.length,
      data: data
    });

  } catch (error) {
    console.error('❌ Error retrieving scraped data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/presentations/start
 * Called by HPProTracker when it detects the HPPRO iframe is active
 */
router.post('/start', async (req, res) => {
  try {
    const { sessionId, agentEmail, url } = req.body;
    console.log('?? Presentation started:', { sessionId, agentEmail, url });
    res.json({ success: true, sessionId });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
export default router;

