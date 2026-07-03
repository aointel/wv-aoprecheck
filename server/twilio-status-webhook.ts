// Implementation of the roadmap's identity-based call attribution system
import express from "express";
import bodyParser from "body-parser";
import { supabaseAdmin } from './supabase';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './hardcoded-config';

export const twilioStatusRouter = express.Router();

// --- Batch buffer: coalesces concurrent status callbacks into a single upsert every 2s ---
const pendingTwilioCallLogUpserts = new Map<string, Record<string, any>>();

async function flushTwilioCallLogBuffer() {
  if (pendingTwilioCallLogUpserts.size === 0) return;
  const rows = [...pendingTwilioCallLogUpserts.values()];
  pendingTwilioCallLogUpserts.clear();
  if (!supabaseAdmin) return;
  try {
    const { error } = await supabaseAdmin
      .from('twilio_call_logs')
      .upsert(rows, { onConflict: 'twilio_call_sid' });
    if (error) {
      console.error(`❌ STEP STATUS: Batch upsert error (${rows.length} rows):`, error);
    } else {
      console.log(`✅ STEP STATUS: Batch upserted ${rows.length} call log row(s)`);
    }
  } catch (err) {
    console.error(`❌ STEP STATUS: Batch upsert exception:`, err);
  }
}

setInterval(flushTwilioCallLogBuffer, 5000);

// Create Twilio client for API lookups
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

twilioStatusRouter.use(bodyParser.urlencoded({ extended: false }));

twilioStatusRouter.post("/", (req, res) => {
  console.log('🔥🔥🔥 STEP STATUS: /api/twilio/call-status WEBHOOK HIT 🔥🔥🔥');
  console.log('🔍 DEBUG: Request body:', JSON.stringify(req.body, null, 2));
  console.log('🔍 DEBUG: Request query:', JSON.stringify(req.query, null, 2));

  const b = req.body as any;
  const callSid = b.CallSid as string;
  const status = (b.CallStatus || "").toLowerCase();

  const to = b.To || b.to || b.Called || b.CalledNumber || b.DialCallTo || null;
  const from = b.From || b.from || b.Caller || b.CallerNumber || null;
  const parentSid = b.ParentCallSid || b.ParentCallSid || null;

  console.log(`🔍 DEBUG: callSid=${callSid}, status=${status}`);
  console.log(`🎯 STATUS WEBHOOK: ${callSid} - ${status} - To: ${to} - From: ${from}`);

  if (from && from.startsWith('client:') && !to && !parentSid) {
    console.log(`⏭️ STEP STATUS: Skipping parent WebRTC call (no to_number) - callSid=${callSid}. Child call will be logged by dial-action endpoint.`);
    res.status(204).end();
    return;
  }

  // Acknowledge immediately so Twilio is not blocked on Supabase / Twilio REST
  res.status(204).end();

  if (!callSid || !status) {
    console.warn(`⚠️ STEP STATUS: Missing required fields - callSid=${callSid}, status=${status}`);
    return;
  }

  void (async () => {
    console.log(`✅ STEP STATUS: (async) Logging call - callSid=${callSid}, to=${to || 'MISSING'}, from=${from || 'MISSING'}, status=${status}`);
    try {
      if (!supabaseAdmin) return;

      const logData: any = {
        twilio_call_sid: callSid,
        call_status: status,
        call_started_at: new Date().toISOString(),
      };

      if (to) {
        logData.to_number = to;
      } else {
        try {
          const twilioCall = await twilioClient.calls(callSid).fetch();
          if (twilioCall.to) {
            logData.to_number = twilioCall.to;
          } else {
            logData.to_number = '';
          }
          if (!logData.from_number && twilioCall.from) {
            logData.from_number = twilioCall.from;
          }
        } catch (twilioError) {
          console.error(`❌ Failed to fetch call details from Twilio API:`, twilioError);
          logData.to_number = '';
        }
      }

      if (from) {
        logData.from_number = from;
        if (from.startsWith('client:')) {
          const agentEmail = from.replace('client:', '');
          logData.owner_email = agentEmail;
          logData.agent_identity = from;
        }
      }

      if (parentSid) {
        logData.parent_call_sid = parentSid;
      }

      if (to && !from?.startsWith('client:')) {
        logData.call_direction = 'outbound';
      } else if (from?.startsWith('client:')) {
        logData.call_direction = 'outbound';
      }

      // Merge into buffer; newer fields overwrite older ones for the same SID.
      // The flush interval will batch-upsert all pending rows every 2s.
      const existing = pendingTwilioCallLogUpserts.get(callSid) || {};
      pendingTwilioCallLogUpserts.set(callSid, { ...existing, ...logData });
      console.log(`📥 STEP STATUS: Queued ${callSid} - ${status} (buffer size: ${pendingTwilioCallLogUpserts.size})`);
    } catch (error) {
      console.error(`❌ STEP STATUS: Exception while logging:`, error);
    }
  })();
});
