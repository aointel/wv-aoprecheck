import { Router } from 'express';
import { supabaseAdmin } from './supabase';

const router = Router();

/**
 * POST /api/app/report-version
 * Electron app reports its version on startup
 */
router.post('/report-version', async (req, res) => {
  try {
    const { agentEmail, agentName, appVersion, platform, osVersion } = req.body;

    if (!agentEmail || !appVersion) {
      return res.status(400).json({ 
        error: 'Missing required fields: agentEmail, appVersion' 
      });
    }

    console.log(`📱 App version report: ${agentEmail} - v${appVersion} (${platform})`);

    // Upsert the app version
    const { data, error } = await supabaseAdmin
      .from('app_versions')
      .upsert({
        agent_email: agentEmail,
        agent_name: agentName,
        app_version: appVersion,
        platform: platform,
        os_version: osVersion,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'agent_email'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error storing app version:', error);
      return res.status(500).json({ 
        error: 'Failed to store app version',
        details: error.message 
      });
    }

    console.log('✅ App version stored successfully');

    res.json({
      success: true,
      message: 'App version recorded',
      data
    });

  } catch (error: any) {
    console.error('❌ Error processing app version:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

/**
 * GET /api/app/versions
 * Get all app versions
 */
router.get('/versions', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_versions')
      .select('*')
      .order('last_seen', { ascending: false });

    if (error) throw error;

    // Group by version
    const versionGroups: Record<string, any[]> = {};
    data?.forEach(record => {
      if (!versionGroups[record.app_version]) {
        versionGroups[record.app_version] = [];
      }
      versionGroups[record.app_version].push(record);
    });

    res.json({
      success: true,
      totalAgents: data?.length || 0,
      versions: versionGroups,
      allRecords: data
    });

  } catch (error: any) {
    console.error('❌ Error fetching app versions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch app versions',
      details: error.message 
    });
  }
});

/**
 * GET /api/app/version/:email
 * Get app version for specific agent
 */
router.get('/version/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const { data, error } = await supabaseAdmin
      .from('app_versions')
      .select('*')
      .eq('agent_email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({
      success: true,
      version: data || null
    });

  } catch (error: any) {
    console.error('❌ Error fetching agent version:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agent version',
      details: error.message 
    });
  }
});

export default router;

