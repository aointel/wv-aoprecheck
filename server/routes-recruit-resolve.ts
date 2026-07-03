/**
 * Recruit candidate resolution - required disposition after a recruit schedule event
 */

import { Router } from 'express';
import { supabaseAdmin } from './supabase';

const router = Router();

const DISPOSITION_TO_STATUS: Record<string, string> = {
  hired: 'hired',
  not_interested: 'rejected',
  callback: 'contacted',
  no_show: 'contacted',
  interview_completed: 'interview',
  rejected: 'rejected',
  other: 'contacted',
};

/**
 * POST /api/recruit-candidates/:id/resolve
 * Record disposition for a recruit schedule event (required for recruiting)
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const id = req.params.id;
    const { disposition, notes } = req.body;
    if (!disposition || typeof disposition !== 'string') {
      return res.status(400).json({ error: 'disposition is required' });
    }
    const status = DISPOSITION_TO_STATUS[disposition.toLowerCase()] ?? 'contacted';
    const updatePayload: Record<string, unknown> = {
      status,
      last_contacted: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (notes) {
      const { data: row } = await supabaseAdmin.from('recruit_candidates').select('notes').eq('id', id).single();
      const appended = row?.notes ? `${row.notes}\n\n[${new Date().toISOString()}] ${disposition}: ${notes}` : `[${new Date().toISOString()}] ${disposition}: ${notes}`;
      updatePayload.notes = appended;
    }
    const { error } = await supabaseAdmin.from('recruit_candidates').update(updatePayload).eq('id', id);

    if (error) {
      console.error('❌ Recruit resolve error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true, status });
  } catch (e) {
    console.error('❌ Recruit resolve:', e);
    res.status(500).json({ error: 'Failed to save recruit disposition' });
  }
});

export default router;
