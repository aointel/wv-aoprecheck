import { Router } from 'express';
import { supabaseAdmin } from './supabase';
import { upsertMasterSchedule } from './master-schedule-service';

const router = Router();

/**
 * POST /api/meets/create
 * Create a new meet (appointment)
 */
router.post('/create', async (req, res) => {
  try {
    const {
      agent_email,
      agent_name,
      client_first_name,
      client_last_name,
      client_phone,
      client_email,
      client_city,
      client_state,
      client_zip,
      scheduled_date,
      scheduled_time,
      duration_minutes,
      market_type,
      meet_type,
      notes,
      created_from,
      whereby_room_url,
      meeting_link: body_meeting_link,
      meeting_password: body_meeting_password,
      timezone: body_timezone
    } = req.body;

    let meeting_link = body_meeting_link ?? null;
    let meeting_password = body_meeting_password ?? null;
    const timezone = body_timezone ?? 'America/Los_Angeles';

    if (!meeting_link && agent_email) {
      const { data: profile } = await supabaseAdmin
        .from('agent_profiles')
        .select('zoom_id, zoom_password')
        .eq('email', agent_email)
        .maybeSingle();
      if (profile?.zoom_id) {
        meeting_link = `https://zoom.us/j/${profile.zoom_id}`;
        if (profile.zoom_password && String(profile.zoom_password).trim() && String(profile.zoom_password) !== '1') {
          meeting_password = String(profile.zoom_password).trim();
        }
      }
    }

    console.log('📅 Creating new meet:', {
      agent: agent_email,
      client: `${client_first_name} ${client_last_name}`,
      phone: client_phone,
      scheduled: `${scheduled_date} ${scheduled_time}`
    });

    const { data, error } = await supabaseAdmin
      .from('meets')
      .insert({
        agent_email,
        agent_name,
        client_first_name,
        client_last_name,
        client_phone,
        client_email,
        client_city,
        client_state,
        client_zip,
        scheduled_date,
        scheduled_time,
        duration_minutes: duration_minutes || 60,
        market_type,
        meet_type: meet_type || 'presentation',
        status: 'scheduled',
        notes,
        created_from: created_from || 'manual',
        internal_notes: whereby_room_url ? `Whereby room: ${whereby_room_url}` : null,
        meeting_link: meeting_link ?? null,
        meeting_password: meeting_password || null,
        timezone
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating meet:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create meet',
        details: error.message 
      });
    }

    console.log('✅ Meet created:', data.id);

    // Write-through to master_schedule for countdown/accountability
    try {
      const slotStart = typeof scheduled_date === 'string' ? scheduled_date : new Date(scheduled_date).toISOString();
      const slotEnd = new Date(new Date(slotStart).getTime() + (duration_minutes || 60) * 60 * 1000).toISOString();
      const clientName = [client_first_name, client_last_name].filter(Boolean).join(' ') || client_phone;
      await upsertMasterSchedule({
        agentEmail: agent_email,
        slotStart,
        slotEnd,
        scheduleType: 'meet',
        sourceTable: 'meets',
        sourceId: data.id,
        title: `Meet with ${clientName}`,
        metadata: { client_phone, client_name: clientName },
      });
    } catch (masterErr) {
      console.warn('⚠️ Failed to write meet to master_schedule:', (masterErr as Error)?.message);
    }
    
    // Track appointment scheduled for usage stats
    try {
      const { usageTracker } = await import('./usage-tracker');
      await usageTracker.trackAppointment(agent_email);
      console.log('📊 Appointment tracked in usage stats');
    } catch (trackError) {
      console.error('⚠️ Failed to track appointment:', trackError);
    }
    
    res.json({ success: true, meet: data });

  } catch (error: any) {
    console.error('❌ Error in create meet:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

/**
 * GET /api/meets/agent/:agentEmail/needing-disposition
 * Get meets that have passed and need disposition (blocking - agent must resolve before other actions)
 */
router.get('/agent/:agentEmail/needing-disposition', async (req, res) => {
  try {
    const { agentEmail } = req.params;
    if (!agentEmail) {
      return res.status(400).json({ error: 'Missing agent email' });
    }
    const now = new Date();
    // Slot has ended if scheduled_date + duration < now; use 60 min default
    const cutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('meets')
      .select('id, client_first_name, client_last_name, client_phone, scheduled_date, scheduled_time, meeting_link, presentation_session_id, duration_minutes')
      .eq('agent_email', agentEmail)
      .in('status', ['scheduled', 'in_progress'])
      .lt('scheduled_date', cutoff)
      .order('scheduled_date', { ascending: true });

    if (error) throw error;
    res.json({ meets: data || [] });
  } catch (err: any) {
    console.error('❌ Error fetching meets needing disposition:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/meets/agent/:agentEmail
 * Get all meets for an agent
 */
router.get('/agent/:agentEmail', async (req, res) => {
  try {
    const { agentEmail } = req.params;
    const { status, date } = req.query;

    let query = supabaseAdmin
      .from('meets')
      .select('*')
      .eq('agent_email', agentEmail)
      .order('scheduled_date', { ascending: true });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (date) {
      // Filter by specific date
      const startOfDay = new Date(date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date as string);
      endOfDay.setHours(23, 59, 59, 999);
      
      query = query.gte('scheduled_date', startOfDay.toISOString())
                   .lte('scheduled_date', endOfDay.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, meets: data || [] });

  } catch (error: any) {
    console.error('❌ Error fetching meets:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/meets/:meetId/link-presentation
 * Link a meet to a presentation session when agent starts presenting
 */
router.post('/:meetId/link-presentation', async (req, res) => {
  try {
    const { meetId } = req.params;
    const { presentation_session_id } = req.body;

    const { error } = await supabaseAdmin
      .from('meets')
      .update({ 
        presentation_session_id,
        status: 'in_progress'
      })
      .eq('id', meetId);

    if (error) throw error;

    console.log(`✅ Linked meet ${meetId} to presentation ${presentation_session_id}`);
    res.json({ success: true });

  } catch (error: any) {
    console.error('❌ Error linking presentation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/meets/:meetId/complete
 * Mark meet as completed with disposition
 */
router.post('/:meetId/complete', async (req, res) => {
  try {
    const { meetId } = req.params;
    const { disposition, sale_amount, products_sold, notes } = req.body;

    const updateData: any = {
      status: 'completed',
      disposition,
      completed_at: new Date().toISOString()
    };

    if (sale_amount) updateData.sale_amount = sale_amount;
    if (products_sold) updateData.products_sold = products_sold;
    if (notes) updateData.notes = notes;

    const { error } = await supabaseAdmin
      .from('meets')
      .update(updateData)
      .eq('id', meetId);

    if (error) throw error;

    // Get the meet data for tracking
    const { data: completedMeet } = await supabaseAdmin
      .from('meets')
      .select('agent_email')
      .eq('id', meetId)
      .single();

    // Track sale in usage stats if this is a sale
    if (disposition === 'SALE' && sale_amount && completedMeet?.agent_email) {
      try {
        const { usageTracker } = await import('./usage-tracker');
        await usageTracker.trackSale(completedMeet.agent_email, parseFloat(sale_amount) || 0);
        console.log(`📊 Sale tracked in usage stats: $${sale_amount} ALP for ${completedMeet.agent_email}`);
      } catch (trackError) {
        console.error('⚠️ Failed to track sale:', trackError);
      }
    }

    // If disposition is THINK, create callback meet
    if (disposition === 'THINK') {
      const { data: originalMeet } = await supabaseAdmin
        .from('meets')
        .select('*')
        .eq('id', meetId)
        .single();

      if (originalMeet) {
        const callbackDate = new Date();
        callbackDate.setDate(callbackDate.getDate() + 3); // 3 days from now

        await supabaseAdmin
          .from('meets')
          .insert({
            agent_email: originalMeet.agent_email,
            agent_name: originalMeet.agent_name,
            client_first_name: originalMeet.client_first_name,
            client_last_name: originalMeet.client_last_name,
            client_phone: originalMeet.client_phone,
            client_email: originalMeet.client_email,
            client_city: originalMeet.client_city,
            client_state: originalMeet.client_state,
            client_zip: originalMeet.client_zip,
            scheduled_date: callbackDate.toISOString(),
            scheduled_time: originalMeet.scheduled_time,
            meet_type: 'callback',
            is_callback: true,
            parent_meet_id: meetId,
            callback_reason: 'Client needs time to think',
            notes: notes || 'Follow-up from initial presentation',
            created_from: 'auto_callback'
          });

        console.log('✅ Created callback meet for THINK disposition');
      }
    }

    res.json({ success: true });

  } catch (error: any) {
    console.error('❌ Error completing meet:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
