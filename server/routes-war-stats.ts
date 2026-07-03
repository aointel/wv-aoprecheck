import { Router } from 'express';
import { supabaseAdmin } from './supabase';

const router = Router();

/**
 * GET /api/war/agent-stats
 * Get daily WAR stats for an agent
 */
router.get('/agent-stats', async (req, res) => {
  try {
    const { email, date } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const targetDate = date ? new Date(date as string) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`📊 Fetching WAR stats for ${email} on ${targetDate.toDateString()}`);

    // Count presentations today
    const { data: presentations, error: presError } = await supabaseAdmin
      .from('presentation_sessions')
      .select('id, status, client_data')
      .eq('agent_email', email)
      .gte('started_at', startOfDay.toISOString())
      .lte('started_at', endOfDay.toISOString());

    if (presError) {
      console.error('Error fetching presentations:', presError);
    }

    // Count sales (presentations with ENROLLMENT disposition or sale_made = true)
    const sales = presentations?.filter(p => {
      let clientData = p.client_data;
      if (typeof clientData === 'string') {
        try { clientData = JSON.parse(clientData); } catch (e) { }
      }
      // Check for sale indicators
      return p.status === 'completed' || clientData?.disposition === 'ENROLLMENT';
    }) || [];

    // Calculate total ALP from client_data or extract from AI summary
    let totalALP = 0;
    presentations?.forEach(p => {
      let clientData = p.client_data;
      if (typeof clientData === 'string') {
        try { clientData = JSON.parse(clientData); } catch (e) { }
      }
      
      // Try to extract ALP from various fields
      const alp = clientData?.alp || clientData?.selected_plan_alp || 0;
      if (typeof alp === 'string') {
        // Parse "$123.45" format
        totalALP += parseFloat(alp.replace(/[$,]/g, '')) || 0;
      } else if (typeof alp === 'number') {
        totalALP += alp;
      }
    });

    // ALSO count AO Precheck completions as sales
    const { data: precheckSales, error: precheckError } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, premium, status, company_email')
      .eq('status', 'completed')  // FIXED: lowercase to match database
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    if (precheckError) {
      console.error('Error fetching precheck sales:', precheckError);
    }

    // Add precheck ALP (premium × 12)
    // Filter to only include sales by THIS agent
    const agentPrecheckSales = precheckSales?.filter(sale => 
      sale.company_email === email
    ) || [];
    
    let precheckALP = 0;
    agentPrecheckSales.forEach(sale => {
      const monthlyPremium = parseFloat(sale.premium) || 0;
      precheckALP += monthlyPremium * 12;
    });

    const stats = {
      presentations: presentations?.length || 0,
      sales: sales.length + agentPrecheckSales.length, // Include precheck sales
      totalALP: Math.round(totalALP + precheckALP), // Include precheck ALP
      breakdown: {
        hppro: { presentations: presentations?.length || 0, sales: sales.length, alp: Math.round(totalALP) },
        precheck: { sales: agentPrecheckSales.length, alp: Math.round(precheckALP) }
      }
    };

    console.log(`✅ WAR stats:`, stats);

    res.json({ 
      success: true, 
      stats,
      date: targetDate.toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error fetching WAR stats:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/war/weekly-agency-stats
 * Get weekly WAR stats for ALL agents (for Weekly Agency Report page)
 */
router.get('/weekly-agency-stats', async (req, res) => {
  try {
    console.log('📊 Fetching weekly agency WAR stats...');
    
    // Get start and end of current week (Sunday to Saturday)
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Go to Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    
    console.log(`📅 Week: ${startOfWeek.toDateString()} to ${endOfWeek.toDateString()}`);
    
    // Get all agents who had activity this week
    const { data: presentations } = await supabaseAdmin
      .from('presentation_sessions')
      .select('agent_email, status, client_data')
      .gte('started_at', startOfWeek.toISOString())
      .lt('started_at', endOfWeek.toISOString());
    
    const { data: precheckSales } = await supabaseAdmin
      .from('verification_sessions')
      .select('company_email, premium, status')
      .eq('status', 'completed')  // FIXED: lowercase to match database
      .gte('created_at', startOfWeek.toISOString())
      .lt('created_at', endOfWeek.toISOString());
    
    // Group by agent
    const agentStats = new Map();
    
    // Process presentations
    presentations?.forEach(p => {
      if (!agentStats.has(p.agent_email)) {
        agentStats.set(p.agent_email, {
          presentations: 0,
          sales: 0,
          alp: 0
        });
      }
      
      const stats = agentStats.get(p.agent_email);
      stats.presentations++;
      
      if (p.status === 'completed') {
        stats.sales++;
        
        let clientData = p.client_data;
        if (typeof clientData === 'string') {
          try { clientData = JSON.parse(clientData); } catch (e) { }
        }
        
        const alp = clientData?.alp || clientData?.selected_plan_alp || 0;
        stats.alp += typeof alp === 'string' ? parseFloat(alp.replace(/[$,]/g, '')) || 0 : alp;
      }
    });
    
    // Process precheck sales
    precheckSales?.forEach(sale => {
      const email = sale.company_email;
      if (!agentStats.has(email)) {
        agentStats.set(email, {
          presentations: 0,
          sales: 0,
          alp: 0
        });
      }
      
      const stats = agentStats.get(email);
      stats.sales++;
      stats.alp += (parseFloat(sale.premium) || 0) * 12;
    });
    
    // Format for frontend
    const agents = Array.from(agentStats.entries()).map(([email, stats]) => ({
      id: email,
      name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      email,
      weeklyStats: {
        dialed: 0, // TODO: Get from call logs
        reached: 0, // TODO: Get from call logs
        booked: 0, // TODO: Get from appointments
        presentations: stats.presentations,
        sales: stats.sales,
        alp: Math.round(stats.alp)
      },
      trend: 'stable' as const,
      alpGoal: 6000
    }));
    
    // Sort by ALP descending
    agents.sort((a, b) => b.weeklyStats.alp - a.weeklyStats.alp);
    
    console.log(`✅ Found ${agents.length} active agents this week`);
    
    res.json({
      success: true,
      agents,
      weekStart: startOfWeek.toISOString(),
      weekEnd: endOfWeek.toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching weekly agency stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

