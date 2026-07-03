/**
 * Twilio section routes - webhooks, voice, call-status, dial-action, recording-status.
 * Extracted for compartmentalized builds. Used by entry-twilio.ts and by routes.ts (monolith).
 */
import type { Express } from "express";
import express from "express";
import twilio from "twilio";
import { formatToE164 } from "../phone-utils";
import { LocalPresenceService } from "../local-presence-service";
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  PRODUCTION_URL,
} from "../hardcoded-config";
import { getAoirailDataServiceBaseUrl } from "../external-service-urls";

const PRODUCTION_BASE_URL = PRODUCTION_URL;
import { supabaseAdmin } from "../supabase";
import { masterleadClient } from "../local-masterlead-client";
import { twilioStatusRouter } from "../twilio-status-webhook";
import { incrementLeadCallAttemptCounter } from "../lead-call-counter";
import { enqueuePostCallJob } from "../queue/post-call-queue";

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

export async function registerTwilioRoutes(app: Express): Promise<void> {
  console.log("🔧 Registering Twilio section routes...");

  // Conference POC: dedicated route BEFORE the main webrtc handler to avoid auth rejection
  app.post("/webhook/webrtc-conference-test", async (req, res) => {
    const agentId = String(req.body?.agentId || req.query?.agentId || 'test-agent');
    const sessionId = String(req.body?.sessionId || req.query?.sessionId || '');
    const callSid = req.body?.CallSid || req.body?.callSid || '';
    const confName = `connect-${sessionId}`;
    try { const { handleAgentConferenceJoin } = await import('../connect-test-routes'); handleAgentConferenceJoin(agentId, sessionId, callSid); } catch (_) {}
    res.set('Content-Type', 'text/xml');
    return res.send(`<?xml version='1.0' encoding='UTF-8'?><Response><Dial><Conference startConferenceOnEnter='true' endConferenceOnExit='false' beep='false' statusCallback='${PRODUCTION_BASE_URL}/api/connect/conference-status' statusCallbackEvent='start end join leave mute hold' statusCallbackMethod='POST'>${confName}</Conference></Dial></Response>`);
  });

  // WebRTC voice webhook - MUST be early
  app.all("/webhook/webrtc", async (req, res) => {
    // Conference POC: Twilio sends params from device.connect({ params }) in the POST body
    // Check agentId/sessionId directly (no mode field needed since we use dedicated params)
    const agentId = req.body?.agentId || req.query?.agentId;
    const sessionId = req.body?.sessionId || req.query?.sessionId;
    if (agentId && sessionId && String(agentId).startsWith('test-')) {
      const callSid = req.body?.CallSid || req.body?.callSid || '';
      const conferenceName = `connect-${sessionId}`;
      try {
        const { handleAgentConferenceJoin } = await import('../connect-test-routes');
        handleAgentConferenceJoin(String(agentId), String(sessionId), callSid);
      } catch (e: any) {}
      res.set('Content-Type', 'text/xml');
      return res.send(`<?xml version='1.0' encoding='UTF-8'?><Response><Dial><Conference startConferenceOnEnter='true' endConferenceOnExit='false' beep='false' statusCallback='${PRODUCTION_BASE_URL}/api/connect/conference-status' statusCallbackEvent='start end join leave mute hold' statusCallbackMethod='POST'>${conferenceName}</Conference></Dial></Response>`);
    }

    const toNumber = req.body.To || req.query.To;
    const conferenceName = req.body.conference || req.body.conferenceName || req.query.conference || req.query.conferenceName;
    const leadState = req.body.leadState || req.query.leadState;
    // ONLY trust Twilio Caller/From (client:email). No call without logged-in user — never trust query/body.
    const callerIdentity = (req.body.Caller || req.body.From || req.query.Caller || req.query.From || "").toString();
    const hasClientIdentity = callerIdentity.toLowerCase().startsWith("client:") && callerIdentity.includes("@");
    const agentEmail = hasClientIdentity ? callerIdentity.replace(/^client:/i, "").trim().toLowerCase() : "";

    if (!agentEmail || !agentEmail.includes("@")) {
      console.warn("⚠️ WebRTC rejected: no user — Caller/From must be client:email (user must be logged in)");
      res.status(403).type("text/xml").send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Reject reason=\"rejected\"/></Response>");
      return;
    }
    if (agentEmail === "cnsysop@aoglobelife.com" || agentEmail === "unknown@aoglobelife.com") {
      console.warn(`⚠️ WebRTC rejected: invalid identity (${agentEmail}) — never cnsysop, never unknown`);
      res.status(403).type("text/xml").send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Reject reason=\"rejected\"/></Response>");
      return;
    }

    let twiml: string;
    if (toNumber) {
      const formattedToNumber = formatToE164(toNumber);
      let callerIdNumber = TWILIO_PHONE_NUMBER;
      const svc = (global as any).localPresenceService as LocalPresenceService | undefined;
      if (leadState && svc) {
        try {
          const localNumber = svc.getLocalNumber(leadState);
          if (localNumber && localNumber !== TWILIO_PHONE_NUMBER) callerIdNumber = localNumber;
        } catch (_) {}
      }
      const statusCallback = `${PRODUCTION_BASE_URL}/api/twilio/call-status?agentEmail=${encodeURIComponent(agentEmail)}`;
      const dialAction = `${PRODUCTION_BASE_URL}/api/twilio/dial-action?agentEmail=${encodeURIComponent(agentEmail)}`;
      const recordCb = `${PRODUCTION_BASE_URL}/api/twilio/recording-status`;
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerIdNumber}" action="${dialAction}" record="record-from-answer" recordingStatusCallback="${recordCb}" recordingStatusCallbackMethod="POST" statusCallback="${statusCallback}" statusCallbackMethod="POST" statusCallbackEvent="initiated,ringing,answered,completed">
    <Number statusCallback="${statusCallback}" statusCallbackMethod="POST" statusCallbackEvent="initiated,ringing,answered,completed">${formattedToNumber}</Number>
  </Dial>
</Response>`;
    } else {
      const confName = conferenceName || "Critical-Conference-" + Date.now();
      const recordCb = `${PRODUCTION_BASE_URL}/api/twilio/recording-status`;
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="false" maxParticipants="2" record="record-from-start" recordingStatusCallback="${recordCb}" recordingStatusCallbackMethod="POST">${confName}</Conference>
  </Dial>
</Response>`;
    }
    res.type("text/xml");
    res.send(twiml);
  });

  // Dial action callback
  app.post("/api/twilio/dial-action", async (req, res) => {
    const dialCallSid = req.body.DialCallSid;
    const dialCallStatus = req.body.DialCallStatus;
    let finalTo = req.body.To || req.body.DialCallTo || req.body.Called || req.body.DialCallToNumber;
    const from = req.body.From || req.body.Caller;
    const parentCallSid = req.body.ParentCallSid || req.body.CallSid;
    const recordingUrl = req.body.RecordingUrl || req.body.recording_url || null;
    const recordingSid = req.body.RecordingSid || req.body.recording_sid || null;

    if (dialCallSid && !finalTo) {
      try {
        const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const twilioCall = await twilioClient.calls(dialCallSid).fetch();
        if (twilioCall.to) finalTo = twilioCall.to;
      } catch (_) {}
    }

    if (dialCallSid && finalTo) {
      try {
        const callDuration = parseInt(String(req.body.DialCallDuration), 10) || 0;
        const logData: Record<string, unknown> = {
          twilio_call_sid: dialCallSid,
          to_number: finalTo,
          from_number: from || "",
          call_status: dialCallStatus || "initiated",
          call_duration: callDuration,
          call_direction: "outbound",
          call_started_at: new Date().toISOString(),
          parent_call_sid: parentCallSid,
          call_source: "webrtc_dial_action",
          metadata: req.body,
        };
        // Extract recording URL from request body if present
        if (recordingUrl) {
          logData.recording_url = recordingUrl;
          console.log(`📹 Dial-action: Found RecordingUrl for ${dialCallSid}: ${recordingUrl}`);
        }
        const BAD_OWNER = ["cnsysop@aoglobelife.com", "unknown@aoglobelife.com", "system@aoglobelife.com", "unknown", ""];
        const isBadOwner = (e: string | null | undefined) => !e || !e.includes("@") || BAD_OWNER.includes((e || "").trim().toLowerCase());
        let ownerToSet: string | null = null;
        if (from && from.startsWith("client:")) ownerToSet = from.replace("client:", "").trim().toLowerCase();
        if (ownerToSet && isBadOwner(ownerToSet) && parentCallSid) {
          const { data: parentRow } = await supabaseAdmin.from("twilio_call_logs").select("owner_email").eq("twilio_call_sid", parentCallSid).maybeSingle();
          const parentOwner = (parentRow as any)?.owner_email?.trim?.();
          if (parentOwner && parentOwner.includes("@") && !BAD_OWNER.includes(parentOwner.toLowerCase())) ownerToSet = parentOwner.toLowerCase();
        }
        if (ownerToSet && !isBadOwner(ownerToSet)) {
          logData.owner_email = ownerToSet;
          logData.agent_identity = `client:${ownerToSet}`;
        }
        const { error } = await supabaseAdmin.from("twilio_call_logs").upsert(logData, { onConflict: "twilio_call_sid" });
        // DEBUG: disabled during inbound API stabilization to reduce per-call DB work
      } catch (_) {}
    } else if (dialCallSid) {
      try {
        const logData: Record<string, unknown> = {
          twilio_call_sid: dialCallSid,
          call_status: dialCallStatus || "initiated",
          call_duration: parseInt(String(req.body.DialCallDuration), 10) || 0,
          call_direction: "outbound",
          call_started_at: new Date().toISOString(),
          parent_call_sid: parentCallSid,
          call_source: "webrtc_dial_action",
          metadata: req.body,
        };
        // Extract recording URL from request body if present
        if (recordingUrl) {
          logData.recording_url = recordingUrl;
          console.log(`📹 Dial-action: Found RecordingUrl for ${dialCallSid}: ${recordingUrl}`);
        }
        const to = req.body.To || req.body.DialCallTo || req.body.Called;
        if (!finalTo && !to) {
          try {
            const twilioCall = await client.calls(dialCallSid).fetch();
            if (twilioCall.to) logData.to_number = twilioCall.to;
            if (twilioCall.from) logData.from_number = twilioCall.from;
          } catch (_) {}
        } else if (to) {
          logData.to_number = to;
          logData.from_number = from || "";
        }
        const BAD_OWNER_ELSE = ["cnsysop@aoglobelife.com", "unknown@aoglobelife.com", "system@aoglobelife.com", "unknown", ""];
        const isBadOwnerElse = (e: string | null | undefined) => !e || !e.includes("@") || BAD_OWNER_ELSE.includes((e || "").trim().toLowerCase());
        let ownerToSetElse: string | null = null;
        if (from && from.startsWith("client:")) ownerToSetElse = from.replace("client:", "").trim().toLowerCase();
        if (ownerToSetElse && isBadOwnerElse(ownerToSetElse) && parentCallSid) {
          const { data: parentRow } = await supabaseAdmin.from("twilio_call_logs").select("owner_email").eq("twilio_call_sid", parentCallSid).maybeSingle();
          const parentOwner = (parentRow as any)?.owner_email?.trim?.();
          if (parentOwner && parentOwner.includes("@") && !BAD_OWNER_ELSE.includes(parentOwner.toLowerCase())) ownerToSetElse = parentOwner.toLowerCase();
        }
        if (ownerToSetElse && !isBadOwnerElse(ownerToSetElse)) {
          logData.owner_email = ownerToSetElse;
          logData.agent_identity = `client:${ownerToSetElse}`;
        }
        await supabaseAdmin.from("twilio_call_logs").upsert(logData, { onConflict: "twilio_call_sid" });
      } catch (_) {}
    }

    res.type("text/xml");
    res.send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>");
  });

  app.use("/api/twilio/status", twilioStatusRouter);

  // Recording status webhook -- responds immediately, enqueues DB writes
  app.post("/api/twilio/recording-status", (req, res) => {
    // Respond to Twilio instantly -- never block on DB here
    res.status(200).send("OK");

    const CallSid = req.body.CallSid;
    const ConferenceSid = req.body.ConferenceSid;
    const RecordingSid = req.body.RecordingSid;
    const RecordingUrl = req.body.RecordingUrl ?? req.body.recording_url ?? null;
    const RecordingStatus = req.body.RecordingStatus ?? req.body.recording_status ?? null;
    const RecordingDuration = req.body.RecordingDuration ?? req.body.recording_duration;

    if (RecordingStatus !== "completed" || !RecordingUrl) return;

    if (CallSid) {
      enqueuePostCallJob("update-recording-url", {
        callSid: CallSid,
        recordingUrl: RecordingUrl,
        recordingSid: RecordingSid || null,
        recordingDuration: RecordingDuration ? parseInt(String(RecordingDuration), 10) : null,
      });
      enqueuePostCallJob("find-child-calls", {
        parentCallSid: CallSid,
        recordingUrl: RecordingUrl,
      });
    }
    if (ConferenceSid && !CallSid) {
      enqueuePostCallJob("update-recording-url", {
        callSid: ConferenceSid,
        recordingUrl: RecordingUrl,
        recordingSid: RecordingSid || null,
        isConference: true,
      });
    }
  });
  // Call status webhook (simplified - full logic in routes.ts; this handles essential logging)
  app.post("/api/twilio/call-status", express.urlencoded({ extended: false }), express.json(), async (req, res) => {
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const query = (req.query && typeof req.query === "object") ? req.query : {};
    const CallSid = String((body as any).CallSid || (query as any).CallSid || "").trim();
    const CallStatus = String((body as any).CallStatus || (query as any).CallStatus || "").trim();
    const CallDuration = String((body as any).CallDuration || (query as any).CallDuration || "").trim();
    const From = String((body as any).From || (query as any).From || "").trim();
    const To = String((body as any).To || (query as any).To || "").trim();
    const Direction = String((body as any).Direction || (query as any).Direction || "").trim();
    const ParentCallSid = String((body as any).ParentCallSid || (query as any).ParentCallSid || "").trim();
    const ConferenceSid = String((body as any).ConferenceSid || (query as any).ConferenceSid || "").trim();
    if (!CallSid) {
      console.warn("⚠️ /api/twilio/call-status missing CallSid; skipping", {
        bodyKeys: Object.keys(body || {}),
        queryKeys: Object.keys(query || {}),
        contentType: req.headers["content-type"] || null,
      });
      return res.status(204).end();
    }
    let agentEmail = (
      (query as any).agentEmail ||
      (query as any).agent_email ||
      (body as any)["metadata[agent_email]"] ||
      (body as any).agent_email ||
      (body as any).AgentEmail ||
      (body as any).agentEmail ||
      ""
    ).toString().trim();
    if (!agentEmail && From && String(From).startsWith("client:") && String(From).includes("@")) {
      agentEmail = String(From).replace(/^client:/i, "").trim().toLowerCase();
    }
    const BAD_OWNER = ["cnsysop@aoglobelife.com", "unknown@aoglobelife.com", "system@aoglobelife.com", "unknown", ""];
    const isBadOwner = (e: string | null | undefined) => !e || !e.includes("@") || BAD_OWNER.includes((e || "").trim().toLowerCase());
    let ownerForLog: string | null = agentEmail && !isBadOwner(agentEmail) ? agentEmail.trim().toLowerCase() : null;
    if (CallSid && !ownerForLog) {
      try {
        // First, recover owner from current or parent call rows.
        const lookupSids = [CallSid, ParentCallSid].filter(Boolean);
        for (const sid of lookupSids) {
          const { data: sidRow } = await supabaseAdmin
            .from("twilio_call_logs")
            .select("owner_email")
            .eq("twilio_call_sid", sid)
            .maybeSingle();
          const sidOwner = String((sidRow as any)?.owner_email || "").trim().toLowerCase();
          if (sidOwner.includes("@") && !BAD_OWNER.includes(sidOwner)) {
            ownerForLog = sidOwner;
            break;
          }
        }
      } catch (ownerLookupErr) {
        console.warn("⚠️ Failed direct owner lookup from twilio_call_logs:", ownerLookupErr);
      }
    }
    if (CallSid && !ownerForLog) {
      const parentSidForChildren = ParentCallSid || CallSid;
      const { data: children } = await supabaseAdmin
        .from("twilio_call_logs")
        .select("owner_email")
        .eq("parent_call_sid", parentSidForChildren)
        .limit(5);
      const childOwner = (children || [])
        .map((r: any) => (r?.owner_email || "").trim())
        .find((e: string) => e.includes("@") && !BAD_OWNER.includes(e.toLowerCase()));
      if (childOwner) ownerForLog = childOwner.toLowerCase();
    }

    if (CallSid) {
      try {
        console.log(`📞 Call status webhook: CallSid=${CallSid}, Status=${CallStatus}, Duration=${CallDuration}, Owner=${ownerForLog || 'none'}`);
        
        let direction = /outbound/i.test(Direction || "") ? "outbound" : "inbound";
        if (direction === "inbound" && /^client:/i.test(String(From || ""))) {
          direction = "outbound";
        }
        if (direction === "inbound" && (CallSid || ParentCallSid)) {
          try {
            const lookupSids = [CallSid, ParentCallSid].filter(Boolean);
            for (const sid of lookupSids) {
              const { data: directionRow } = await supabaseAdmin
                .from("twilio_call_logs")
                .select("call_direction")
                .eq("twilio_call_sid", sid)
                .maybeSingle();
              const existingDirection = String((directionRow as any)?.call_direction || "").toLowerCase();
              if (existingDirection === "outbound") {
                direction = "outbound";
                break;
              }
            }
          } catch (directionLookupErr) {
            console.warn("⚠️ Failed direction lookup from twilio_call_logs:", directionLookupErr);
          }
        }
        const status = (CallStatus || "").toLowerCase();
        const duration = CallDuration ? parseInt(CallDuration, 10) : null;
        const callData: Record<string, unknown> = {
          twilio_call_sid: CallSid,
          owner_email: ownerForLog,
          agent_identity: ownerForLog ? `client:${ownerForLog}` : null,
          from_number: From || null,
          to_number: To || null,
          call_direction: direction,
          call_status: status || "initiated",
          call_duration: duration,
          call_started_at: new Date().toISOString(),
          parent_call_sid: ParentCallSid || null,
          call_source: "twilio_call_status_webhook",
        };
        if (status === "completed" || status === "failed") callData.call_ended_at = new Date().toISOString();
        
        const { data, error } = await supabaseAdmin.from("twilio_call_logs").upsert(callData, { onConflict: "twilio_call_sid" }).select("twilio_call_sid");
        
        if (error) {
          console.error(`❌ CRITICAL: Failed to upsert call ${CallSid} to twilio_call_logs:`, error);
          console.error(`   Error details:`, JSON.stringify(error, null, 2));
          console.error(`   Call data:`, JSON.stringify(callData, null, 2));
        } else {
          console.log(`✅ Successfully upserted call ${CallSid} to twilio_call_logs`);
        }

        // Increment lead call counter once per CallSid for outbound attempts.
        await incrementLeadCallAttemptCounter({
          callSid: CallSid,
          toNumber: To || null,
          direction,
          status,
        }).catch((counterErr) => {
          console.warn("⚠️ Lead call counter increment failed:", counterErr);
        });
        
        // 🔥 MARK LEAD AS AWAITING DISPOSITION: When outbound call starts (ringing/in-progress), mark lead as 'awaitingdisposition'
        // This prevents pending lead scripts from affecting the current call lead
        if (direction === "outbound" && (status === "ringing" || status === "in-progress") && ownerForLog && To) {
          try {
            const normalizedPhone = String(To).trim().replace(/\D/g, '').slice(-10);
            if (normalizedPhone && normalizedPhone.length >= 10) {
              // Find lead by phone number
              const { data: leadRecord } = await masterleadClient.from('masterlead')
                .select('id, cnresolution, cn_email')
                .or(`phone.eq.${normalizedPhone},phone.eq.1${normalizedPhone}`)
                .maybeSingle();
              
              if (leadRecord && leadRecord.cnresolution !== 'awaitingdisposition') {
                console.log(`🔥 MARKING LEAD AS AWAITING DISPOSITION: Lead ${leadRecord.id} (phone: ${normalizedPhone}) - Call ${status}`);
                await masterleadClient.from('masterlead')
                  .update({ 
                    cnresolution: 'awaitingdisposition',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', leadRecord.id);
              }
            }
          } catch (awaitingErr) {
            console.error('❌ Error marking lead as awaitingdisposition:', awaitingErr);
            // Non-blocking - don't fail the webhook if this fails
          }
        }
        
        // Resolve duration/to_number from Twilio log rows (child/parent legs can differ from raw webhook body).
        let effectiveDuration = Number(duration || 0);
        let effectiveTo = String(To || "").trim();
        let effectiveCallStartedAtIso: string | null = null;
        try {
          if (CallSid) {
            const { data: sidRow } = await supabaseAdmin
              .from("twilio_call_logs")
              .select("call_duration,to_number,parent_call_sid,call_started_at")
              .eq("twilio_call_sid", CallSid)
              .maybeSingle();
            const sidDuration = Number((sidRow as any)?.call_duration || 0);
            if (sidDuration > effectiveDuration) effectiveDuration = sidDuration;
            if (!effectiveTo && (sidRow as any)?.to_number) effectiveTo = String((sidRow as any).to_number || "").trim();
            if ((sidRow as any)?.call_started_at) effectiveCallStartedAtIso = String((sidRow as any).call_started_at);

            const parentSid = String((ParentCallSid || (sidRow as any)?.parent_call_sid || "")).trim();
            if (parentSid) {
              const { data: parentRow } = await supabaseAdmin
                .from("twilio_call_logs")
                .select("call_duration,to_number,call_started_at")
                .eq("twilio_call_sid", parentSid)
                .maybeSingle();
              const parentDuration = Number((parentRow as any)?.call_duration || 0);
              if (parentDuration > effectiveDuration) effectiveDuration = parentDuration;
              if (!effectiveTo && (parentRow as any)?.to_number) effectiveTo = String((parentRow as any).to_number || "").trim();
              if (!effectiveCallStartedAtIso && (parentRow as any)?.call_started_at) effectiveCallStartedAtIso = String((parentRow as any).call_started_at);
            }

            if (effectiveDuration <= 0) {
              const { data: childRows } = await supabaseAdmin
                .from("twilio_call_logs")
                .select("call_duration,to_number,call_started_at")
                .or(`parent_call_sid.eq.${CallSid}${ParentCallSid ? `,parent_call_sid.eq.${ParentCallSid}` : ""}`)
                .order("call_duration", { ascending: false })
                .limit(1);
              const child = Array.isArray(childRows) && childRows.length > 0 ? childRows[0] : null;
              const childDuration = Number((child as any)?.call_duration || 0);
              if (childDuration > effectiveDuration) effectiveDuration = childDuration;
              if (!effectiveTo && (child as any)?.to_number) effectiveTo = String((child as any).to_number || "").trim();
              if (!effectiveCallStartedAtIso && (child as any)?.call_started_at) effectiveCallStartedAtIso = String((child as any).call_started_at);
            }
          }
        } catch (resolveErr) {
          console.warn("⚠️ Failed resolving effective duration/to_number from Twilio logs:", resolveErr);
        }

        // ⚡ AUTO-LOG + AUTO-BOOK INSTANT PRESENTATION:
        // Force 10+ minute outbound calls into My Calendar as instant presentations.
        if (direction === "outbound" && status === "completed" && effectiveDuration >= 600 && ownerForLog && effectiveTo) {
          try {
            const { logDialMetric } = await import("../agent-dial-metrics-tracker");
            const normalizedPhone = String(effectiveTo).trim().replace(/\D/g, '').slice(-10);
            if (normalizedPhone && normalizedPhone.length >= 10) {
              console.log(`⚡ AUTO-LOGGING INSTANT PRESENTATION: agent=${ownerForLog}, phone=${normalizedPhone}, duration=${effectiveDuration}s (>= 600s/10min)`);
              await logDialMetric(supabaseAdmin, {
                agentEmail: ownerForLog,
                leadPhone: normalizedPhone,
                eventType: 'instant_presentation',
                disposition: 'instant_presentation',
                callDuration: effectiveDuration,
              }).catch((err) => {
                console.error('❌ Failed to auto-log instant presentation:', err);
              });

              // Force-create My Calendar entry for accountability tracking.
              const sourceCallSid = String(ParentCallSid || CallSid || "").trim();
              const dedupeTag = `AUTO_INSTANT_CALL_SID:${sourceCallSid}`;
              if (sourceCallSid) {
                const { data: existingInstant } = await supabaseAdmin
                  .from("appointments")
                  .select("id")
                  .eq("agent_email", ownerForLog)
                  .eq("disposition_source", "instant_presentation")
                  .ilike("internal_notes", `%${dedupeTag}%`)
                  .limit(1);

                if (!existingInstant || existingInstant.length === 0) {
                  const nowMs = Date.now();
                  const callDurationSeconds = Number(effectiveDuration) || 0;
                  const callStartedMs = effectiveCallStartedAtIso ? new Date(effectiveCallStartedAtIso).getTime() : NaN;
                  const hasStart = Number.isFinite(callStartedMs);
                  const startMs = hasStart ? callStartedMs : (nowMs - callDurationSeconds * 1000);
                  const endMs = Math.max(startMs + 15 * 60 * 1000, nowMs);
                  const startIso = new Date(startMs).toISOString();
                  const endIso = new Date(endMs).toISOString();

                  const { data: leadRecord } = await masterleadClient
                    .from("masterlead")
                    .select("id, taalk_lead_id, first_name, last_name, phone, taalk_market, market, taalk_state, state, city, taalk_city, email, address, taalk_groupcode, taalk_groupname")
                    .or(`phone.eq.${normalizedPhone},phone.eq.1${normalizedPhone}`)
                    .order("updated_at", { ascending: false })
                    .limit(1);

                  const lead = Array.isArray(leadRecord) && leadRecord.length > 0 ? leadRecord[0] : null;
                  const leadDbId = (lead as any)?.id ?? null;
                  const aoLeadId = (lead as any)?.taalk_lead_id ?? null;
                  const leadName = `${String((lead as any)?.first_name || "").trim()} ${String((lead as any)?.last_name || "").trim()}`.trim() || "Unknown Lead";
                  const leadMarket = String((lead as any)?.taalk_market || (lead as any)?.market || "").trim() || null;
                  const leadState = String((lead as any)?.taalk_state || (lead as any)?.state || "").trim().toUpperCase() || null;
                  const leadCity = String((lead as any)?.city || (lead as any)?.taalk_city || "").trim() || null;
                  const leadEmail = String((lead as any)?.email || "").trim() || null;
                  const leadAddress = String((lead as any)?.address || "").trim() || null;
                  const leadGroupCode = String((lead as any)?.taalk_groupcode || "").trim() || null;
                  const leadGroupName = String((lead as any)?.taalk_groupname || "").trim() || null;
                  const notes = [
                    `Auto-created from outbound call (${callDurationSeconds}s) after 10-minute instant threshold.`,
                    leadAddress ? `Address: ${leadAddress}` : "",
                    leadGroupCode ? `Group Code: ${leadGroupCode}` : "",
                    leadGroupName ? `Group Name: ${leadGroupName}` : "",
                    leadDbId ? `ML #${leadDbId}` : "",
                    aoLeadId ? `AO Lead ID ${aoLeadId}` : "",
                  ].filter(Boolean).join("\n");

                  const createPayload = {
                    title: `Instant Presentation - ${leadName}`,
                    appointmentType: "presentation",
                    startTime: startIso,
                    endTime: endIso,
                    duration: Math.max(15, Math.round((endMs - startMs) / 60000)),
                    timezone: "UTC",
                    agentId: ownerForLog,
                    agentEmail: ownerForLog,
                    agentName: ownerForLog.split("@")[0] || ownerForLog,
                    leadId: aoLeadId ?? leadDbId ?? null,
                    leadName,
                    leadPhone: (lead as any)?.phone || normalizedPhone,
                    leadEmail,
                    leadCity,
                    leadState,
                    leadMarket,
                    status: "scheduled",
                    dispositionSource: "instant_presentation",
                    outcome: "pending",
                    notes,
                    internalNotes: `${dedupeTag}; PARENT_CALL_SID:${String(ParentCallSid || "").trim() || "none"}`,
                  };

                  const dataServiceBase = getAoirailDataServiceBaseUrl() || PRODUCTION_BASE_URL;
                  const createEndpoint = `${dataServiceBase}/api/appointments`;
                  let apiCreateOk = false;
                  try {
                    const createRes = await fetch(createEndpoint, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(createPayload),
                    });
                    if (createRes.ok) {
                      apiCreateOk = true;
                    } else {
                      const errText = await createRes.text().catch(() => "");
                      console.error(`❌ Instant appointment API create failed: ${createRes.status} ${createRes.statusText} ${errText}`);
                    }
                  } catch (createErr) {
                    console.error("❌ Instant appointment API create threw:", createErr);
                  }

                  if (!apiCreateOk) {
                    const fallbackPayload = {
                      title: createPayload.title,
                      appointment_type: "presentation",
                      start_time: startIso,
                      end_time: endIso,
                      duration: createPayload.duration,
                      timezone: "UTC",
                      agent_id: createPayload.agentId,
                      agent_email: createPayload.agentEmail,
                      agent_name: createPayload.agentName,
                      lead_id: createPayload.leadId,
                      lead_name: createPayload.leadName,
                      lead_phone: createPayload.leadPhone,
                      lead_email: createPayload.leadEmail,
                      lead_market: createPayload.leadMarket,
                      lead_state: createPayload.leadState,
                      lead_city: createPayload.leadCity,
                      status: "scheduled",
                      confirmation_status: "pending",
                      outcome: "pending",
                      disposition_source: "instant_presentation",
                      notes: createPayload.notes,
                      internal_notes: createPayload.internalNotes,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    };
                    const { error: insertInstantError } = await supabaseAdmin
                      .from("appointments")
                      .insert(fallbackPayload);
                    if (insertInstantError) {
                      console.error("❌ Fallback instant appointment insert failed:", insertInstantError);
                    }
                  }

                  console.log(`✅ Auto-created instant presentation appointment for ${ownerForLog} at ${startIso} (callSid=${sourceCallSid})`);
                } else {
                  console.log(`ℹ️ Instant presentation already exists for callSid=${sourceCallSid} (skipping duplicate create)`);
                }
              }
            }
          } catch (importErr) {
            console.error('❌ Failed to import logDialMetric for instant presentation:', importErr);
          }
        }
        
        // DEBUG: disabled during inbound API stabilization to reduce per-call DB work
      } catch (error) {
        console.error(`❌ CRITICAL ERROR in call-status webhook for ${CallSid}:`, error);
        console.error(`   Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        console.error(`   Request body:`, JSON.stringify(req.body, null, 2));
      }
    }
    res.status(204).end();
  });

  // AMD (Answering Machine Detection) status callback
  app.post("/api/twilio/amd-status", async (req, res) => {
    try {
      const { CallSid, AnsweredBy, MachineDetectionDuration } = req.body;
      const agentEmail = req.query.agentEmail as string || req.body.agent_email || '';
      
      console.log(`📞 AMD callback received: CallSid=${CallSid}, AnsweredBy=${AnsweredBy}, Duration=${MachineDetectionDuration}ms, agentEmail=${agentEmail}`);
      console.log(`   Full request body:`, JSON.stringify(req.body, null, 2));
      
      if (!CallSid) {
        console.warn('⚠️ AMD callback missing CallSid - request body:', JSON.stringify(req.body));
        return res.status(200).send('OK'); // Always return 200 to Twilio
      }

      // Update twilio_call_logs with AMD result
      if (supabaseAdmin) {
        const { TwilioCallLogger } = await import('../twilio-call-logger');
        
        // Try to update by CallSid (could be parent or child)
        await TwilioCallLogger.updateAmdResult(CallSid, {
          answeredBy: AnsweredBy || null,
          machineDetectionDurationMs: MachineDetectionDuration ? parseInt(String(MachineDetectionDuration), 10) : null
        });
        
        // Also try to find child calls with this parent_call_sid and update them
        // (Twilio might send parent CallSid but we need to update child calls)
        const { data: childCalls } = await supabaseAdmin
          .from('twilio_call_logs')
          .select('twilio_call_sid')
          .eq('parent_call_sid', CallSid)
          .is('answered_by', null);
        
        if (childCalls && childCalls.length > 0) {
          console.log(`📞 Found ${childCalls.length} child calls with parent ${CallSid} - updating AMD for all`);
          for (const child of childCalls) {
            await TwilioCallLogger.updateAmdResult(child.twilio_call_sid, {
              answeredBy: AnsweredBy || null,
              machineDetectionDurationMs: MachineDetectionDuration ? parseInt(String(MachineDetectionDuration), 10) : null
            });
          }
        }
      } else {
        console.error('❌ AMD callback: supabaseAdmin is not available');
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ AMD callback error:', error);
      console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('   Request body:', JSON.stringify(req.body));
      res.status(200).send('OK'); // Always return 200 to Twilio even on error
    }
  });

  // Register connect test routes on twilio service (handles /api/connect/* callbacks from Twilio)
  try {
    const { registerConnectTestRoutes } = await import('../connect-test-routes');
    registerConnectTestRoutes(app, client, PRODUCTION_BASE_URL);
  } catch (e: any) {
    console.warn('[CONNECT_TEST] Failed to register connect test routes on twilio section:', e.message);
  }

  console.log("✅ Twilio section routes registered");
}

