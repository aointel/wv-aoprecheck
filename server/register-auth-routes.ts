/**
 * All /api/auth/* HTTP routes in one place.
 * Used by the full monolith (routes.ts) and by entry-auth.ts (standalone auth service).
 */
import type { Express } from "express";
import { AuthService } from "./auth-service";
import { supabaseAdmin } from "./supabase";
import agentProvisionRouter from "./routes-agent-provision";
import { HARDCODED_CONFIG } from "./hardcoded-config";
import crypto from "crypto";

export function registerAuthRoutes(app: Express): void {
  // Iframe bootstrap: create app session from associate_id without Supabase login UI.
  // Intended for trusted internal embeds only.
  app.get("/api/auth/iframe-assoc-login", async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ success: false, error: "Supabase admin unavailable" });
      }

      const assocIdRaw =
        (typeof req.query.assocId === "string" && req.query.assocId) ||
        (typeof req.query.associateId === "string" && req.query.associateId) ||
        (typeof req.query.asscID === "string" && req.query.asscID) ||
        "";
      const assocId = String(assocIdRaw).trim();
      if (!assocId) {
        return res.status(400).json({ success: false, error: "assocId is required" });
      }

      const providedKey =
        (typeof req.query.key === "string" && req.query.key) ||
        (typeof req.headers["x-iframe-key"] === "string" && req.headers["x-iframe-key"]) ||
        "";
      const expectedKey = String(process.env.PRECHECK_IFRAME_KEY || HARDCODED_CONFIG.SESSION_SECRET || "");
      const validKey =
        providedKey &&
        expectedKey &&
        Buffer.byteLength(providedKey) === Buffer.byteLength(expectedKey) &&
        crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey));
      if (!validKey) {
        return res.status(403).json({ success: false, error: "invalid iframe key" });
      }

      const { data: customer, error: customerErr } = await supabaseAdmin
        .from("customers")
        .select("associate_id,company_email,personal_email")
        .eq("associate_id", assocId)
        .limit(1)
        .maybeSingle();
      if (customerErr) {
        return res.status(500).json({ success: false, error: customerErr.message });
      }
      if (!customer) {
        return res.status(404).json({ success: false, error: "associate_id not found" });
      }

      const email = String(customer.company_email || customer.personal_email || "")
        .toLowerCase()
        .trim();
      if (!email.includes("@")) {
        return res.status(404).json({ success: false, error: "No email found for associate_id" });
      }

      const { data: profile } = await supabaseAdmin
        .from("agent_profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      const sessionUser = {
        id: String((profile as any)?.id || email),
        email,
      };

      if (req.session) {
        (req.session as any).user = sessionUser;
        (req.session as any).profile = profile ?? null;
      }

      const requestedNext = typeof req.query.next === "string" ? req.query.next : "/dashboard/verification-start";
      const safeNext = requestedNext.startsWith("/") ? requestedNext : "/dashboard/verification-start";

      const finish = () => {
        const asJson = String(req.query.format || "").toLowerCase() === "json";
        if (asJson) {
          return res.json({ success: true, email, associate_id: assocId, next: safeNext });
        }
        return res.redirect(safeNext);
      };

      if (req.session && typeof (req.session as any).save === "function") {
        return (req.session as any).save((err: any) => {
          if (err) return res.status(500).json({ success: false, error: "failed to persist session" });
          return finish();
        });
      }
      return finish();
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error?.message || String(error) });
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const email = req.body?.email || "unknown";
      console.log(`🔐 LOGIN ATTEMPT: ${email}`);
      await AuthService.login(req, res);
      console.log(`✅ LOGIN SUCCESS: ${email}`);
    } catch (error) {
      const email = req.body?.email || "unknown";
      console.error(`❌ CRITICAL: Login route error for ${email}:`, error);
      console.error(`   Error stack:`, error instanceof Error ? error.stack : "No stack");
      if (!res.headersSent) {
        res.status(500).json({
          error: "Login failed",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  app.post("/api/auth/signup", (_req, res) => {
    res.status(403).json({
      error: "This signup path is disabled. Use Get your account (/join) with your work email.",
      redirectTo: "/join",
    });
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      const requestId = String(req.headers["x-request-id"] || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const referer = String(req.headers.referer || "");
      const traceSession =
        referer.includes("/dashboard/verification-start") ||
        referer.includes("/precheck") ||
        Boolean(req.headers["x-desktop-app"]);

      const session = req.session as { user?: { id: string; email: string; created_at?: string }; profile?: unknown } | undefined;
      const user = session?.user;
      if (traceSession) {
        const hasCookie = typeof req.headers.cookie === "string" && req.headers.cookie.length > 0;
        const hasAuth = typeof req.headers.authorization === "string" && req.headers.authorization.length > 0;
        console.log(
          `[auth-session-trace] -> ${requestId} cookie=${hasCookie} auth=${hasAuth} desktop=${req.headers["x-desktop-app"] ? "1" : "0"} referer=${referer || "-"}`,
        );
      }
      if (user?.email) {
        if (traceSession) {
          console.log(`[auth-session-trace] <- ${requestId} source=session email=${user.email}`);
        }
        return res.json({
          user: {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
          },
          profile: session?.profile ?? null,
        });
      }

      // Session cookie can transiently miss during service transitions/restarts.
      // Recover auth from JWT middleware (Authorization Bearer) when available.
      const jwtUser = (req as any)?.user as { id?: string; email?: string; created_at?: string } | undefined;
      const jwtEmail = typeof jwtUser?.email === "string" ? jwtUser.email.trim().toLowerCase() : "";
      if (jwtEmail.includes("@")) {
        let profile: unknown = null;
        if (supabaseAdmin) {
          try {
            const { data } = await supabaseAdmin
              .from("agent_profiles")
              .select("*")
              .eq("email", jwtEmail)
              .maybeSingle();
            profile = data ?? null;
          } catch (profileError) {
            console.warn("⚠️ Session JWT recovery profile lookup failed:", profileError);
          }
        }

        const recoveredUser = {
          id: String(jwtUser?.id || (profile as any)?.id || jwtEmail),
          email: jwtEmail,
          created_at: jwtUser?.created_at,
        };

        if (req.session) {
          (req.session as any).user = recoveredUser;
          (req.session as any).profile = profile;
        }

        return res.json({
          user: recoveredUser,
          profile,
          recoveredFromJwt: true,
        });
      }

      if (traceSession) {
        console.warn(`[auth-session-trace] <- ${requestId} source=none user=null`);
      }
      return res.json({ user: null, profile: null });
    } catch (error) {
      console.error("❌ Session endpoint error:", error);
      res.json({ user: null, profile: null });
    }
  });

  app.post("/api/auth/logout", AuthService.logout);
  app.get("/api/auth/profile", AuthService.getProfile);
  app.put("/api/auth/profile", AuthService.updateProfile);
  app.post("/api/auth/forgot-password", AuthService.forgotPassword);
  app.post("/api/auth/reset-password-with-sms", AuthService.resetPasswordWithSMS);
  app.post("/api/auth/reset-password-with-token", AuthService.resetPasswordWithToken);
  app.post("/api/auth/reset-password", AuthService.resetPassword);

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ error: "Email and verification code are required" });
      }

      const { emailVerificationService } = await import("./email-verification-service");
      const result = await emailVerificationService.verifyCode(email, code);

      if (!result.success) {
        return res.status(400).json({ error: result.error || "Invalid verification code" });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ error: "Admin authentication not configured" });
      }

      const normalizedEmail = email.toLowerCase().trim();

      let user = null;
      let page = 1;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore && !user) {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: pageSize,
        });

        if (usersData?.users) {
          user = usersData.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
          if (user) break;
          hasMore = usersData.users.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });

      if (updateError) {
        console.error("❌ Error confirming email:", updateError);
        return res.status(500).json({ error: "Failed to verify email" });
      }

      console.log(`✅ Email verified for ${normalizedEmail}`);
      res.json({ success: true, message: "Email verified successfully" });
    } catch (error: unknown) {
      console.error("❌ Email verification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/resend-verification-email", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      let firstName: string | undefined;
      if (supabaseAdmin) {
        const { data: profile } = await supabaseAdmin
          .from("agent_profiles")
          .select("first_name")
          .eq("email", email.toLowerCase().trim())
          .maybeSingle();
        firstName = profile?.first_name;
      }

      const { emailVerificationService } = await import("./email-verification-service");
      const result = await emailVerificationService.sendVerificationEmail(email, firstName);

      if (!result.success) {
        return res.status(500).json({ error: result.error || "Failed to send verification email" });
      }

      res.json({
        success: true,
        message:
          "Verification email sent to both your @aoglobelife.com email and personal email on file",
      });
    } catch (error: unknown) {
      console.error("❌ Resend verification email error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/test-verification-email", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const { emailVerificationService } = await import("./email-verification-service");
      const result = await emailVerificationService.sendVerificationEmail(email);

      if (!result.success) {
        return res.status(500).json({ error: result.error || "Failed to send verification email" });
      }

      res.json({
        success: true,
        message: `Test verification email sent to ${email}`,
        code: result.code,
      });
    } catch (error: unknown) {
      console.error("❌ Test verification email error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/profile-completion-status", async (req, res) => {
    try {
      const userEmail = (req.query.email as string) || (req.headers["x-user-email"] as string);

      if (!userEmail) {
        return res.status(400).json({ error: "Email is required" });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ error: "Database not configured" });
      }

      const normalizedEmail = userEmail.toLowerCase().trim();

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("agent_profiles")
        .select("first_name, last_name, phone, email, mga_team, rga_team, zoom_id, profile_picture")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profileError) {
        console.error("❌ Error fetching profile:", profileError);
        return res.status(500).json({ error: "Failed to check profile status" });
      }

      if (!profile) {
        return res.json({
          isComplete: false,
          missingFields: [
            "first_name",
            "last_name",
            "phone",
            "zoom_id",
            "mga_team",
            "profile_picture",
          ],
          message: "Agent profile not found",
        });
      }

      const requiredFields = {
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        zoom_id: profile.zoom_id,
      };

      const missingFields: string[] = [];
      for (const [field, value] of Object.entries(requiredFields)) {
        if (!value || (typeof value === "string" && value.trim() === "")) {
          missingFields.push(field);
        }
      }

      const phoneClean = profile.phone?.replace(/\D/g, "") || "";
      if (phoneClean === "5550000" || phoneClean === "5550000000" || phoneClean.length < 10) {
        if (!missingFields.includes("phone")) {
          missingFields.push("phone");
        }
      }

      if (!profile.mga_team || profile.mga_team.trim() === "") {
        missingFields.push("mga_team");
      }
      if (!profile.profile_picture || String(profile.profile_picture).trim() === "") {
        missingFields.push("profile_picture");
      }

      const isComplete = missingFields.length === 0;

      res.json({
        isComplete,
        missingFields,
        profile: {
          firstName: profile.first_name,
          lastName: profile.last_name,
          phone: profile.phone,
          email: profile.email,
          mgaTeam: profile.mga_team,
          rgaTeam: profile.rga_team,
          zoomId: profile.zoom_id,
          profilePicture: profile.profile_picture || "",
        },
      });
    } catch (error: unknown) {
      console.error("❌ Profile completion check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.use("/api/auth", agentProvisionRouter);
}
