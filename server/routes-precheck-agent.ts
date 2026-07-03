import type { Express } from "express";
import { supabaseAdmin } from "./supabase";

export function registerAgentPrecheckAgentRoutes(app: Express) {
  console.log('🔧 Registering AOI Precheck Agent Routes...');
  
  // Simple test endpoint to verify routes are working
  app.get("/api/aoi-precheck/agent/test", (req, res) => {
    console.log('✅ Test endpoint hit');
    res.json({ success: true, message: 'Routes are working' });
  });
  
  app.get("/api/aoi-precheck/agent/recent", async (req, res) => {
    try {
      const headerEmail = (req.headers["x-user-email"] as string) || (req.headers["user-email"] as string) || (req.headers["User-Email"] as string);
      const sessionEmail = (req.session as any)?.user?.email;
      const userEmail = headerEmail || sessionEmail;

      if (!userEmail) {
        return res.status(401).json({ success: false, error: "User email required" });
      }

      const limitParam = parseInt(req.query.limit as string) || 5;
      const limit = Math.min(Math.max(limitParam, 1), 25);

      if (!supabaseAdmin) {
        console.error("❌ Supabase admin client not configured for agent recent verifications");
        return res.status(500).json({ success: false, error: "Service unavailable" });
      }

      const { data, error } = await supabaseAdmin
        .from("verification_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("❌ Failed to fetch agent recent verifications from Supabase:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch recent verifications",
          details: error.message || null,
        });
      }

      const normalizedEmail = userEmail.trim().toLowerCase();
      const now = new Date();

      const filtered = (data || []).filter((session: any) => {
        const companyEmail = (session.company_email || "").toLowerCase();
        const matchesEmail = companyEmail === normalizedEmail;

        // Exclude sessions past scheduled_delete_at (treated as deleted)
        const scheduledDelete = session.scheduled_delete_at ? new Date(session.scheduled_delete_at) : null;
        if (scheduledDelete && scheduledDelete.getTime() <= now.getTime()) {
          return false;
        }

        // Include both live and demo (training) - training sessions get Remove, not Transmit
        return matchesEmail;
      });

      const sessions = filtered.slice(0, limit).map((session: any) => {
        const statusRaw = session.status ?? "pending";
        const statusLower = statusRaw.toString().toLowerCase();
        const agentFirstName = session.agent_first_name || '';
        const agentLastName = session.agent_last_name || '';
        const rawPremium = session.premium_amount ?? session.premium ?? null;
        const normalizedPremium =
          typeof rawPremium === "number"
            ? rawPremium
            : typeof rawPremium === "string"
            ? (() => {
                const cleaned = rawPremium.replace(/[^0-9.]/g, "");
                const parsed = parseFloat(cleaned);
                return Number.isFinite(parsed) ? parsed : null;
              })()
            : null;

        const clientFirstName = session.first_name || "";
        const clientLastName = session.last_name || "";
        const combinedClientName = `${clientFirstName} ${clientLastName}`.trim();

        return {
          id: session.id,
          sessionId: session.session_id || session.id,
          companyEmail: session.company_email || null,
          agentFirstName,
          agentLastName,
          agentFullName: `${agentFirstName} ${agentLastName}`.trim() || null,
          agentMgaTeam: session.agent_mga_team || null,
          agentRgaTeam: session.agent_rga_team || null,
          clientName: session.client_name || combinedClientName || "Unknown Client",
          clientEmail: session.client_email || session.email || null,
          clientPhone: session.client_phone || session.phone || null,
          state: session.state || null,
          city: session.city || null,
          status: statusRaw,
          method: session.verification_method || "phone",
          createdAt: session.created_at || null,
          completedAt: session.completed_at || null,
          policyNumber: session.policy_number || session.policy || null,
          premiumAmount: normalizedPremium,
          premiumRaw: rawPremium,
          verificationScore: session.verification_score || session.qa_score || null,
          sessionType: session.session_type || null,
          sessionToken: session.session_token || null,
          certificateUrl:
            session.certificate_url ||
            (statusLower === "completed" && (session.session_id || session.id)
              ? `/api/aoi-precheck/download/certificate/${session.session_id || session.id}`
              : null),
          recordingUrl: session.recording_url || null,
          screenshotUrl: session.screenshot_url || session.screenshot_path || null,
          screenshotAnalysisComplete: session.screenshot_analysis_complete ?? null,
          screenshotAnalysisConfidence: session.screenshot_analysis_confidence ?? null,
          callAnalysisComplete: session.call_analysis_complete ?? null,
          callAnalysisConfidence: session.call_analysis_confidence ?? null,
          meetingUrl: session.meeting_url || session.room_url || null,
          relationship: session.relationship || session.spouse_name || null,
          notes: session.notes || session.verification_result || null,
          callDuration: session.taalk_call_duration || session.call_duration || null,
          transmitStatus: session.transmit_status || "pending_transmit",
          precheckType: session.precheck_type || "live",
          transmittedAt: session.transmitted_at || null,
          scheduledDeleteAt: session.scheduled_delete_at || null,
        };
      });

      res.json({ success: true, sessions });
    } catch (error) {
      console.error("❌ Agent recent verifications error:", error);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch recent verifications",
        details: message,
      });
    }
  });

  app.post("/api/aoi-precheck/agent/transmit", async (req, res) => {
    console.log('📤 TRANSMIT HIT:', req.method, req.path, req.body);
    try {
      const { sessionId, precheckType } = req.body;
      if (!sessionId) return res.status(400).json({ success: false, error: "sessionId required" });
      if (!supabaseAdmin) return res.status(500).json({ success: false, error: "Service unavailable" });

      // Find by session_id or id
      let { data: session } = await supabaseAdmin.from("verification_sessions").select("id").eq("session_id", sessionId).maybeSingle();
      if (!session) {
        const result = await supabaseAdmin.from("verification_sessions").select("id").eq("id", sessionId).maybeSingle();
        session = result.data || null;
      }
      if (!session) return res.status(404).json({ success: false, error: "Session not found" });

      // Update transmit_status
      const type = (precheckType || "live").toLowerCase();
      const now = new Date();
      const payload = type === "live" 
        ? { transmit_status: "transmitted", precheck_type: "live", transmitted_at: now.toISOString(), scheduled_delete_at: null }
        : { transmit_status: "scheduled_delete", precheck_type: type, transmitted_at: now.toISOString(), scheduled_delete_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() };

      const { error } = await supabaseAdmin.from("verification_sessions").update(payload).eq("id", session.id);
      if (error) {
        console.error("❌ Update error:", error);
        return res.status(500).json({ success: false, error: error.message });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("❌ Error:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed" });
    }
  });

  app.post("/api/aoi-precheck/agent/session/:sessionId/recover", async (req, res) => {
    try {
      const headerEmail = (req.headers["x-user-email"] as string) || (req.headers["user-email"] as string) || (req.headers["User-Email"] as string);
      const sessionEmail = (req.session as any)?.user?.email;
      const userEmail = headerEmail || sessionEmail;

      if (!userEmail) {
        return res.status(401).json({ success: false, error: "User email required" });
      }

      const sessionId = req.params.sessionId;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: "sessionId required" });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ success: false, error: "Service unavailable" });
      }

      const { data: session, error: fetchError } = await supabaseAdmin
        .from("verification_sessions")
        .select("id, session_id, company_email, transmit_status, scheduled_delete_at")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (fetchError || !session) {
        return res.status(404).json({ success: false, error: "Session not found" });
      }

      const normalizedEmail = userEmail.trim().toLowerCase();
      const companyEmail = (session.company_email || "").toLowerCase();
      const isOwner = companyEmail === normalizedEmail;

      if (!isOwner) {
        return res.status(403).json({ success: false, error: "Not authorized to recover this session" });
      }

      if (session.transmit_status !== "scheduled_delete" || !session.scheduled_delete_at) {
        return res.status(400).json({
          success: false,
          error: "Session is not scheduled for deletion. Nothing to recover.",
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from("verification_sessions")
        .update({
          transmit_status: "pending_transmit",
          scheduled_delete_at: null,
        })
        .eq("session_id", sessionId);

      if (updateError) {
        console.error("❌ Recover session error:", updateError);
        return res.status(500).json({ success: false, error: "Failed to recover session" });
      }

      res.json({ success: true, message: "Session recovered" });
    } catch (error) {
      console.error("❌ Recover session error:", error);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        success: false,
        error: "Failed to recover",
        details: message,
      });
    }
  });

  app.delete("/api/aoi-precheck/agent/session/:sessionId", async (req, res) => {
    try {
      const headerEmail = (req.headers["x-user-email"] as string) || (req.headers["user-email"] as string) || (req.headers["User-Email"] as string);
      const sessionEmail = (req.session as any)?.user?.email;
      const userEmail = headerEmail || sessionEmail;

      if (!userEmail) {
        return res.status(401).json({ success: false, error: "User email required" });
      }

      const sessionId = req.params.sessionId;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: "sessionId required" });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ success: false, error: "Service unavailable" });
      }

      const { data: session, error: fetchError } = await supabaseAdmin
        .from("verification_sessions")
        .select("id, session_id, company_email, transmit_status")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (fetchError || !session) {
        return res.status(404).json({ success: false, error: "Session not found" });
      }

      const normalizedEmail = userEmail.trim().toLowerCase();
      const companyEmail = (session.company_email || "").toLowerCase();
      const isOwner = companyEmail === normalizedEmail;

      if (!isOwner) {
        return res.status(403).json({ success: false, error: "Not authorized to delete this session" });
      }

      if (session.transmit_status === "transmitted") {
        return res.status(400).json({
          success: false,
          error: "Cannot delete transmitted sessions. Contact admin if needed.",
        });
      }

      const { error: deleteError } = await supabaseAdmin
        .from("verification_sessions")
        .delete()
        .eq("session_id", sessionId);

      if (deleteError) {
        console.error("❌ Agent delete session error:", deleteError);
        return res.status(500).json({ success: false, error: "Failed to delete session" });
      }

      res.json({ success: true, message: "Session removed" });
    } catch (error) {
      console.error("❌ Agent delete session error:", error);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        success: false,
        error: "Failed to delete session",
        details: message,
      });
    }
  });
  
  console.log('✅ AOI Precheck Agent Routes registered successfully');
}
