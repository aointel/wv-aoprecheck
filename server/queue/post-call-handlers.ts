/**
 * Handlers for post-call queue jobs.
 * These do the actual DB writes that previously happened synchronously in Twilio webhooks.
 * Each handler runs inside the queue worker at controlled concurrency.
 */

import { registerQueueHandler } from './post-call-queue';
import { pool, dispositionWritePool } from '../db';
import { masterleadClient } from '../local-masterlead-client';

let handlersRegistered = false;

export function registerPostCallHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  // ─── Recording URL Updates ───────────────────────────────────────────────
  registerQueueHandler('update-recording-url', async (payload) => {
    const { callSid, recordingUrl, recordingSid, parentCallSid } = payload;
    if (!callSid || !recordingUrl) return;

    // Update twilio_call_logs
    await pool.query(
      `UPDATE twilio_call_logs
       SET recording_url = $1, recording_sid = $2, updated_at = NOW()
       WHERE twilio_call_sid = $3 OR twilio_call_sid = $4`,
      [recordingUrl, recordingSid || null, callSid, parentCallSid || callSid]
    );

    // Update masterlead via last_contacted match if we have a lead reference
    if (payload.leadId) {
      await masterleadClient.update(
        { id: payload.leadId },
        { recording_url: recordingUrl }
      );
    }

    console.log(`[POST_CALL_QUEUE] recording-url updated for ${callSid}`);
  });

  // ─── Find + Update Child Call Recording URLs ─────────────────────────────
  registerQueueHandler('find-child-calls', async (payload) => {
    const { parentCallSid, recordingUrl } = payload;
    if (!parentCallSid) return;

    // Find child calls and propagate recording URL
    const result = await pool.query(
      `SELECT twilio_call_sid FROM twilio_call_logs WHERE parent_call_sid = $1`,
      [parentCallSid]
    );

    if (result.rows.length === 0) return;

    const childSids = result.rows.map((r: any) => r.twilio_call_sid);
    await pool.query(
      `UPDATE twilio_call_logs
       SET recording_url = $1, updated_at = NOW()
       WHERE twilio_call_sid = ANY($2::text[])`,
      [recordingUrl, childSids]
    );

    console.log(`[POST_CALL_QUEUE] child-calls updated for parent ${parentCallSid} (${childSids.length} children)`);
  });

  // ─── Disposition Writes ───────────────────────────────────────────────────
  registerQueueHandler('update-disposition', async (payload) => {
    const { leadId, taalkLeadId, phone, disposition, agentEmail, cnresolution } = payload;
    if (!disposition) return;

    const updates: Record<string, any> = {
      cnresolution: cnresolution || disposition,
      last_contacted: new Date().toISOString(),
    };
    if (agentEmail) updates.cn_email = agentEmail;

    // Try update by ID first, fallback to phone
    if (leadId) {
      await masterleadClient.update({ id: leadId }, updates);
    } else if (taalkLeadId) {
      await masterleadClient.update({ taalk_lead_id: taalkLeadId }, updates);
    } else if (phone) {
      await masterleadClient.update({ phone }, updates);
    }

    console.log(`[POST_CALL_QUEUE] disposition written: ${disposition} for lead ${leadId || phone}`);
  });

  // ─── Call Log Upserts ─────────────────────────────────────────────────────
  registerQueueHandler('update-call-log', async (payload) => {
    const { callSid, ...fields } = payload;
    if (!callSid) return;

    const columns = Object.keys(fields);
    if (columns.length === 0) return;

    const setClause = columns
      .map((col, i) => `${col} = $${i + 2}`)
      .join(', ');
    const values = [callSid, ...columns.map(c => fields[c])];

    await pool.query(
      `UPDATE twilio_call_logs SET ${setClause}, updated_at = NOW() WHERE twilio_call_sid = $1`,
      values
    );
  });

  // ─── Agent Dial Metrics ───────────────────────────────────────────────────
  registerQueueHandler('update-agent-metrics', async (payload) => {
    const { agentEmail, eventType, leadId, callSid, duration } = payload;
    if (!agentEmail || !eventType) return;

    await dispositionWritePool.query(
      `INSERT INTO agent_dial_metrics
         (agent_email, event_type, lead_id, twilio_call_sid, duration_seconds, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [agentEmail, eventType, leadId || null, callSid || null, duration || null]
    );
  });

  console.log('[POST_CALL_QUEUE] All handlers registered');
}
