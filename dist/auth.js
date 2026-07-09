var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/hardcoded-config.ts
var hardcoded_config_exports = {};
__export(hardcoded_config_exports, {
  DATABASE_URL: () => DATABASE_URL,
  HARDCODED_CONFIG: () => HARDCODED_CONFIG,
  IPINFO_API_KEY: () => IPINFO_API_KEY,
  NODE_ENV: () => NODE_ENV,
  OPENAI_API_KEY: () => OPENAI_API_KEY,
  PORT: () => PORT,
  PRODUCTION_URL: () => PRODUCTION_URL,
  S3_ACCESS_KEY_ID: () => S3_ACCESS_KEY_ID,
  S3_BUCKET: () => S3_BUCKET,
  S3_BUCKET_NAME: () => S3_BUCKET_NAME,
  S3_ENDPOINT: () => S3_ENDPOINT,
  S3_REGION: () => S3_REGION,
  S3_SECRET_ACCESS_KEY: () => S3_SECRET_ACCESS_KEY,
  SESSION_SECRET: () => SESSION_SECRET,
  SUPABASE_ANON_KEY: () => SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: () => SUPABASE_SERVICE_KEY,
  SUPABASE_URL: () => SUPABASE_URL,
  TWILIO_ACCOUNT_SID: () => TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY: () => TWILIO_API_KEY,
  TWILIO_API_SECRET: () => TWILIO_API_SECRET,
  TWILIO_AUTH_TOKEN: () => TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: () => TWILIO_PHONE_NUMBER,
  TWILIO_PHONE_NUMBER_SID: () => TWILIO_PHONE_NUMBER_SID,
  TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID: () => TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID,
  TWILIO_TASKROUTER_WORKSPACE_SID: () => TWILIO_TASKROUTER_WORKSPACE_SID,
  TWILIO_TWIML_APP_SID: () => TWILIO_TWIML_APP_SID,
  WEBHOOK_BASE_URL: () => WEBHOOK_BASE_URL,
  WHEREBY_API_KEY: () => WHEREBY_API_KEY,
  getBaseUrl: () => getBaseUrl,
  getConfig: () => getConfig,
  hasConfig: () => hasConfig
});
function getConfig(key) {
  return String(HARDCODED_CONFIG[key]);
}
function hasConfig(key) {
  return !!HARDCODED_CONFIG[key];
}
function getBaseUrl(req) {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  if (req) {
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (host) {
      return `${protocol}://${host}`;
    }
  }
  return HARDCODED_CONFIG.PRODUCTION_URL;
}
var HARDCODED_CONFIG, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID, TWILIO_PHONE_NUMBER_SID, TWILIO_PHONE_NUMBER, TWILIO_TASKROUTER_WORKSPACE_SID, TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID, WHEREBY_API_KEY, OPENAI_API_KEY, IPINFO_API_KEY, PRODUCTION_URL, WEBHOOK_BASE_URL, SESSION_SECRET, DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, S3_REGION, S3_BUCKET, NODE_ENV, PORT, S3_BUCKET_NAME;
var init_hardcoded_config = __esm({
  "server/hardcoded-config.ts"() {
    "use strict";
    HARDCODED_CONFIG = {
      // Redis fallback when process.env.REDIS_URL is unset (Railway private network only). Web + worker use server/redis-config getRedisUrl().
      REDIS_URL: "redis://default:PPuJmoYFxPgRTqLmiZJbAMXyqsDdsjmS@redis.railway.internal:6379",
      // Twilio Account Keys - Updated with your new working account
      TWILIO_ACCOUNT_SID: "AC25d37aa41aed0df4fddd81ecf7abf00d",
      TWILIO_AUTH_TOKEN: "b275d646252457344ff62528e3538ea9",
      // Twilio API Keys for WebRTC tokens - Your new API key
      TWILIO_API_KEY: "SKda62cc0dd6b62fa233efbfbb67c5aaf5",
      TWILIO_API_SECRET: "dNeGYk0Wj8KXp2PghiHuz7GVa4OmAYtX",
      // Twilio App and Phone SIDs - Your new TwiML app
      TWILIO_TWIML_APP_SID: "AP958ebb1810e2315e9ff008cc06e91c1d",
      TWILIO_PHONE_NUMBER_SID: "PNa1d67508986206fa137ef97f239314d7",
      TWILIO_PHONE_NUMBER: "+19142289324",
      // TaskRouter for inbound voice routing (provisioned via npm run provision-taskrouter)
      TWILIO_TASKROUTER_WORKSPACE_SID: "WS6a978202496f59f6cd478c1310f5c2eb",
      TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID: "WW7c3e36b25267cd0489d855dd0b195f3e",
      // Production app URL (aoirail only; no baa2)
      PRODUCTION_URL: "https://aoirail-production.up.railway.app",
      // Base URL for Twilio webhooks, 609 inbound, and assignment callback. Same as production.
      WEBHOOK_BASE_URL: "https://aoirail-production.up.railway.app",
      // Session and Security
      SESSION_SECRET: "ao-precheck-production-secret-2024",
      // Database - Use Replit database URL or fallback to Neon
      DATABASE_URL: process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL || "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
      // Supabase Configuration
      SUPABASE_URL: "https://ycztjetxwpfgtrzeyytt.supabase.co",
      SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNzQwMzcsImV4cCI6MjA1Mjc1MDAzN30.E0gNaQyQUhfN2I8XfdNVEViVv90HxKZS4Rcwcq19ldc",
      SUPABASE_SERVICE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0",
      // S3 Storage Configuration for Supabase
      S3_ACCESS_KEY_ID: "28d0095786f39a89e8f40f73b9015357",
      S3_SECRET_ACCESS_KEY: "e5a1acbe3f9c68a569e33e70e27a6651a9d720fdd07beb0398626ae2ab7db967",
      S3_ENDPOINT: "https://ycztjetxwpfgtrzeyytt.storage.supabase.co/storage/v1/s3",
      S3_REGION: "us-east-1",
      S3_BUCKET: "verify_agent_screenshot",
      // Whereby API Key - UPDATED November 5, 2025
      WHEREBY_API_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmFwcGVhci5pbiIsImF1ZCI6Imh0dHBzOi8vYXBpLmFwcGVhci5pbi92MSIsImV4cCI6OTAwNzE5OTI1NDc0MDk5MSwiaWF0IjoxNzYyMzgzNDQyLCJvcmdhbml6YXRpb25JZCI6MzIyMzg4LCJqdGkiOiIwZDVhODdjZC01MmZjLTRjZTctOGZiZC1iMWMxMTFlNDI0MTMifQ.To1zA1SWOJaUxoE70fSiep5n798cp5yPXX6AgoLgUAI",
      // OpenAI API Key - SCREENSHOT VALIDATION ONLY
      OPENAI_API_KEY: "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",
      // IPinfo.io API Key - IP Geolocation (better accuracy than ip-api.com)
      IPINFO_API_KEY: "4dbb9166a24cc6",
      // Stripe (if needed)
      STRIPE_SECRET_KEY: "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",
      STRIPE_PUBLISHABLE_KEY: "pk_live_51QUWLbDB901D7nogTsLhaocdKc8HT8jWMs6F43v8CSeB9E8wUdg9RAh4K4ZpSUV0lY9eOVi6Sd8a5OrfaV9EnCtE00eKP0VSwF",
      // Other settings - Use environment variables if available, fallback to hardcoded values
      NODE_ENV: process.env.NODE_ENV || "production",
      PORT: process.env.PORT || 5e3
    };
    ({
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      TWILIO_TWIML_APP_SID,
      TWILIO_PHONE_NUMBER_SID,
      TWILIO_PHONE_NUMBER,
      TWILIO_TASKROUTER_WORKSPACE_SID,
      TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID,
      WHEREBY_API_KEY,
      OPENAI_API_KEY,
      IPINFO_API_KEY,
      PRODUCTION_URL,
      WEBHOOK_BASE_URL,
      SESSION_SECRET,
      DATABASE_URL,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_KEY,
      S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY,
      S3_ENDPOINT,
      S3_REGION,
      S3_BUCKET,
      NODE_ENV,
      PORT
    } = HARDCODED_CONFIG);
    S3_BUCKET_NAME = S3_BUCKET;
  }
});

// server/perf-observability.ts
async function timedDependency(kind, target, fn) {
  const start = Date.now();
  try {
    const out = await fn();
    perfStore.recordDependency(kind, target, Date.now() - start, true);
    return out;
  } catch (error) {
    perfStore.recordDependency(kind, target, Date.now() - start, false);
    throw error;
  }
}
function compactUrl(input) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
  try {
    const u = new URL(raw);
    const firstPath = u.pathname.split("/").filter(Boolean).slice(0, 2).join("/");
    return `${u.host}/${firstPath || ""}`.replace(/\/$/, "");
  } catch {
    return raw.slice(0, 120);
  }
}
function wrapFetchWithPerf(kind, fetchFn) {
  return async (input, init) => {
    const target = compactUrl(input);
    return timedDependency(kind, target, () => fetchFn(input, init));
  };
}
var MAX_POINTS_PER_KEY, MAX_AGE_MS, PerfStore, perfStore, LOOP_SAMPLE_MS, expected, lagTimer;
var init_perf_observability = __esm({
  "server/perf-observability.ts"() {
    "use strict";
    MAX_POINTS_PER_KEY = 400;
    MAX_AGE_MS = 24 * 60 * 60 * 1e3;
    PerfStore = class {
      requests = /* @__PURE__ */ new Map();
      dependencies = /* @__PURE__ */ new Map();
      upsert(map, key) {
        let agg = map.get(key);
        if (!agg) {
          agg = { key, count: 0, errors: 0, totalMs: 0, maxMs: 0, points: [] };
          map.set(key, agg);
        }
        return agg;
      }
      record(map, key, durationMs, ok) {
        const agg = this.upsert(map, key);
        const now = Date.now();
        agg.count += 1;
        agg.totalMs += durationMs;
        if (!ok) agg.errors += 1;
        if (durationMs > agg.maxMs) agg.maxMs = durationMs;
        agg.points.push({ ts: now, durationMs, ok });
        if (agg.points.length > MAX_POINTS_PER_KEY) {
          agg.points.splice(0, agg.points.length - MAX_POINTS_PER_KEY);
        }
        const cutoff = now - MAX_AGE_MS;
        while (agg.points.length && agg.points[0].ts < cutoff) {
          agg.points.shift();
        }
      }
      recordRequest(method, path4, statusCode, durationMs) {
        const key = `${method.toUpperCase()} ${path4}`;
        const ok = statusCode < 500;
        this.record(this.requests, key, durationMs, ok);
      }
      recordDependency(kind, target, durationMs, ok) {
        const key = `${kind}:${target}`;
        this.record(this.dependencies, key, durationMs, ok);
      }
      toRows(map, limit) {
        const rows = Array.from(map.values()).map((agg) => {
          const samples = agg.points.map((p2) => p2.durationMs).sort((a, b) => a - b);
          const p = (q) => {
            if (!samples.length) return 0;
            const idx = Math.min(samples.length - 1, Math.floor(q / 100 * samples.length));
            return samples[idx];
          };
          return {
            key: agg.key,
            count: agg.count,
            errors: agg.errors,
            errorRate: agg.count ? Number((agg.errors / agg.count).toFixed(4)) : 0,
            avgMs: agg.count ? Number((agg.totalMs / agg.count).toFixed(2)) : 0,
            p50Ms: p(50),
            p95Ms: p(95),
            p99Ms: p(99),
            maxMs: agg.maxMs
          };
        });
        rows.sort((a, b) => b.p95Ms - a.p95Ms || b.maxMs - a.maxMs || b.count - a.count);
        return rows.slice(0, limit);
      }
      getSummary(limit = 25) {
        return {
          generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          topRoutesByP95: this.toRows(this.requests, limit),
          topDependenciesByP95: this.toRows(this.dependencies, limit)
        };
      }
      reset() {
        this.requests.clear();
        this.dependencies.clear();
      }
    };
    perfStore = new PerfStore();
    LOOP_SAMPLE_MS = 1e3;
    expected = Date.now() + LOOP_SAMPLE_MS;
    lagTimer = setInterval(() => {
      const now = Date.now();
      const lag = Math.max(0, now - expected);
      perfStore.recordDependency("runtime", "eventloop.lag", lag, true);
      expected = now + LOOP_SAMPLE_MS;
    }, LOOP_SAMPLE_MS);
    if (typeof lagTimer.unref === "function") lagTimer.unref();
  }
});

// server/hot-table-mode.ts
function isHotTablesEodOnly() {
  return false;
}
var init_hot_table_mode = __esm({
  "server/hot-table-mode.ts"() {
    "use strict";
  }
});

// server/hot-table-write-gate.ts
function isWithinEodHour(now = /* @__PURE__ */ new Date()) {
  return now.getHours() === 23;
}
function shouldBlockHotTableSupabaseWrite(url, method) {
  if (!isHotTablesEodOnly()) return false;
  const upperMethod = method.toUpperCase();
  if (READ_METHODS.has(upperMethod)) return false;
  if (!HOT_TABLE_PATHS.some((path4) => url.includes(path4))) return false;
  if (bypassCounter > 0) return false;
  if (isWithinEodHour()) return false;
  return true;
}
var bypassCounter, HOT_TABLE_PATHS, READ_METHODS;
var init_hot_table_write_gate = __esm({
  "server/hot-table-write-gate.ts"() {
    "use strict";
    init_hot_table_mode();
    bypassCounter = 0;
    HOT_TABLE_PATHS = [
      "/rest/v1/twilio_call_logs",
      "/rest/v1/agent_dial_metrics"
    ];
    READ_METHODS = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
  }
});

// shared/lead-tracking-schema.ts
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
  integer,
  text,
  boolean
} from "drizzle-orm/pg-core";
var agentLeadProgress, ftcComplianceLog, hotleadAssignments;
var init_lead_tracking_schema = __esm({
  "shared/lead-tracking-schema.ts"() {
    "use strict";
    agentLeadProgress = pgTable("agent_lead_progress", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      agentEmail: varchar("agent_email").notNull(),
      market: varchar("market").notNull(),
      lastLeadId: varchar("last_lead_id"),
      // ID of the last lead they worked on
      lastLeadPhone: varchar("last_lead_phone"),
      // Phone number for backup identification
      currentPosition: integer("current_position").default(0),
      // Position in the lead queue
      sessionStartedAt: timestamp("session_started_at").defaultNow(),
      lastUpdated: timestamp("last_updated").defaultNow(),
      isActive: boolean("is_active").default(true),
      notes: text("notes")
    }, (table) => ({
      // Composite unique constraint for agent + market combination
      agentMarketIdx: {
        columns: [table.agentEmail, table.market],
        unique: true
      }
    }));
    ftcComplianceLog = pgTable("ftc_compliance_log", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      leadId: varchar("lead_id").notNull(),
      leadPhone: varchar("lead_phone").notNull(),
      leadState: varchar("lead_state").notNull(),
      agentEmail: varchar("agent_email").notNull(),
      actionTaken: varchar("action_taken").notNull(),
      // 'skipped', 'allowed', 'deferred'
      leadLocalTime: varchar("lead_local_time").notNull(),
      timeZone: varchar("time_zone").notNull(),
      nextCallableTime: varchar("next_callable_time"),
      createdAt: timestamp("created_at").defaultNow(),
      reason: text("reason")
    });
    hotleadAssignments = pgTable("hotlead_assignments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      agentEmail: varchar("agent_email").notNull(),
      hotleadPhone: varchar("hotlead_phone").notNull(),
      // References hotleads table in Supabase
      hotleadId: varchar("hotlead_id"),
      // Supabase hotlead ID if available
      assignedAt: timestamp("assigned_at").defaultNow(),
      assignmentReason: varchar("assignment_reason"),
      // 'state_match', 'market_match', 'activity_level', 'manual'
      isActive: boolean("is_active").default(true),
      // Whether assignment is still active
      completedAt: timestamp("completed_at"),
      // When hotlead was marked complete/resolved
      // Track lead details at assignment time (for audit trail)
      leadState: varchar("lead_state"),
      leadMarket: varchar("lead_market"),
      leadFirstName: varchar("lead_first_name"),
      leadLastName: varchar("lead_last_name"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    }, (table) => ({
      // Unique constraint to prevent duplicate assignments
      agentHotleadIdx: {
        columns: [table.agentEmail, table.hotleadPhone],
        unique: true
      }
    }));
  }
});

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  DEFAULT_PAGE_PERMISSIONS: () => DEFAULT_PAGE_PERMISSIONS,
  PAGE_KEYS: () => PAGE_KEYS,
  ROLES: () => ROLES,
  adminLogs: () => adminLogs,
  adminRoles: () => adminRoles,
  agentAccessControl: () => agentAccessControl,
  agentAvailability: () => agentAvailability,
  agentCredits: () => agentCredits,
  agentDialMetrics: () => agentDialMetrics,
  agentLeadProgress: () => agentLeadProgress,
  agentMetrics: () => agentMetrics,
  agentProfileSchema: () => agentProfileSchema,
  agentProfiles: () => agentProfiles,
  aoiConnects: () => aoiConnects,
  aoiFollowups: () => aoiFollowups,
  appointmentOutcomes: () => appointmentOutcomes,
  appointmentQuerySchema: () => appointmentQuerySchema,
  appointmentReminders: () => appointmentReminders,
  appointmentReviews: () => appointmentReviews,
  appointments: () => appointments,
  callCenterEvents: () => callCenterEvents,
  callDispositionInconsistencies: () => callDispositionInconsistencies,
  callDispositionOutcomes: () => callDispositionOutcomes,
  callLogs: () => callLogs,
  callLogsRelations: () => callLogsRelations,
  callTracker: () => callTracker,
  callUsageTracking: () => callUsageTracking,
  clientApprovalSchema: () => clientApprovalSchema,
  clientInfoSchema: () => clientInfoSchema,
  connectnowUsers: () => connectnowUsers,
  connectnowUsersRelations: () => connectnowUsersRelations,
  creditTransactions: () => creditTransactions,
  dailyAccountability: () => dailyAccountability,
  dailyBillingReports: () => dailyBillingReports,
  dailyUserStats: () => dailyUserStats,
  featureUsageLogs: () => featureUsageLogs,
  feedbackReports: () => feedbackReports,
  ftcComplianceLog: () => ftcComplianceLog,
  helpRequests: () => helpRequests,
  hotleadAssignments: () => hotleadAssignments,
  inboundCallRouting: () => inboundCallRouting,
  incomingCalls: () => incomingCalls,
  incomingCallsRelations: () => incomingCallsRelations,
  incomingLeads: () => incomingLeads,
  insertAdminLogSchema: () => insertAdminLogSchema,
  insertAdminRoleSchema: () => insertAdminRoleSchema,
  insertAgentAccessControlSchema: () => insertAgentAccessControlSchema,
  insertAgentMetricsSchema: () => insertAgentMetricsSchema,
  insertAgentProfileSchema: () => insertAgentProfileSchema,
  insertAppointmentOutcomeSchema: () => insertAppointmentOutcomeSchema,
  insertAppointmentReviewSchema: () => insertAppointmentReviewSchema,
  insertAppointmentSchema: () => insertAppointmentSchema,
  insertCallCenterEventSchema: () => insertCallCenterEventSchema,
  insertCallDispositionInconsistencySchema: () => insertCallDispositionInconsistencySchema,
  insertCallLogSchema: () => insertCallLogSchema,
  insertCallTrackerSchema: () => insertCallTrackerSchema,
  insertCallUsageTrackingSchema: () => insertCallUsageTrackingSchema,
  insertConnectNowUserSchema: () => insertConnectNowUserSchema,
  insertDailyAccountabilitySchema: () => insertDailyAccountabilitySchema,
  insertDailyUserStatsSchema: () => insertDailyUserStatsSchema,
  insertFeatureUsageLogSchema: () => insertFeatureUsageLogSchema,
  insertFeedbackReportSchema: () => insertFeedbackReportSchema,
  insertIncomingLeadSchema: () => insertIncomingLeadSchema,
  insertLeadCampaignSchema: () => insertLeadCampaignSchema,
  insertOutboundCallSchema: () => insertOutboundCallSchema,
  insertPageActivityLogSchema: () => insertPageActivityLogSchema,
  insertQualityManagerTeamAssignmentSchema: () => insertQualityManagerTeamAssignmentSchema,
  insertRecruitCandidateSchema: () => insertRecruitCandidateSchema,
  insertRolePagePermissionSchema: () => insertRolePagePermissionSchema,
  insertRoleSchema: () => insertRoleSchema,
  insertTeamSchema: () => insertTeamSchema,
  insertUserRoleSchema: () => insertUserRoleSchema,
  insertUserSchema: () => insertUserSchema,
  insertUserSessionSchema: () => insertUserSessionSchema,
  insertVdpCallSchema: () => insertVdpCallSchema,
  insertVerificationSessionSchema: () => insertVerificationSessionSchema,
  insertVeteranLeadSchema: () => insertVeteranLeadSchema,
  insertVideoMeetingTrackingSchema: () => insertVideoMeetingTrackingSchema,
  insertWalkthroughCompletionSchema: () => insertWalkthroughCompletionSchema,
  insertWalkthroughProgressSchema: () => insertWalkthroughProgressSchema,
  insertWalkthroughVideoSchema: () => insertWalkthroughVideoSchema,
  insertWarConnectSchema: () => insertWarConnectSchema,
  insertWarMetricsSchema: () => insertWarMetricsSchema,
  insertWarSubmissionSchema: () => insertWarSubmissionSchema,
  insertWarTeamMemberSchema: () => insertWarTeamMemberSchema,
  insertWarTeamSchema: () => insertWarTeamSchema,
  leadCampaigns: () => leadCampaigns,
  leaderboard: () => leaderboard,
  masterlead: () => masterlead,
  masterleadrecruit: () => masterleadrecruit,
  masterrecruit: () => masterrecruit,
  methodSelectionSchema: () => methodSelectionSchema,
  mgaTeams: () => mgaTeams,
  outboundCallHistory: () => outboundCallHistory,
  outboundCalls: () => outboundCalls,
  pageActivityLogs: () => pageActivityLogs,
  phantomBookingResolutions: () => phantomBookingResolutions,
  producers: () => producers,
  qualityManagerAssignments: () => qualityManagerAssignments,
  qualityManagerRoles: () => qualityManagerRoles,
  qualityManagerTeamAssignments: () => qualityManagerTeamAssignments,
  recruitCandidates: () => recruitCandidates,
  recruitUserSettings: () => recruitUserSettings,
  rolePagePermissions: () => rolePagePermissions,
  roles: () => roles,
  rolesRelations: () => rolesRelations,
  screenshotUploadSchema: () => screenshotUploadSchema,
  smsVerificationSchema: () => smsVerificationSchema,
  supportBookings: () => supportBookings,
  supportQueue: () => supportQueue,
  taalkVdpLogs: () => taalkVdpLogs,
  teams: () => teams,
  teamsRelations: () => teamsRelations,
  updateAppointmentSchema: () => updateAppointmentSchema,
  updateRecruitCandidateSchema: () => updateRecruitCandidateSchema,
  userCredits: () => userCredits,
  userExperience: () => userExperience,
  userGameStats: () => userGameStats,
  userGameStatsRelations: () => userGameStatsRelations,
  userRoles: () => userRoles,
  userSessions: () => userSessions,
  users: () => users,
  vdpCalls: () => vdpCalls,
  vdpCallsRelations: () => vdpCallsRelations,
  vdpConnects: () => vdpConnects,
  vdpMissedCalls: () => vdpMissedCalls,
  verificationSessions: () => verificationSessions,
  veteranLeads: () => veteranLeads,
  videoMeetingTracking: () => videoMeetingTracking,
  walkthroughCompletion: () => walkthroughCompletion,
  walkthroughProgress: () => walkthroughProgress,
  walkthroughVideos: () => walkthroughVideos,
  warConnects: () => warConnects,
  warMetrics: () => warMetrics,
  warSubmissions: () => warSubmissions,
  warTeamMembers: () => warTeamMembers,
  warTeams: () => warTeams
});
import { pgTable as pgTable2, text as text2, serial, integer as integer2, boolean as boolean2, timestamp as timestamp2, decimal, jsonb, varchar as varchar2, uuid, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql as sql2 } from "drizzle-orm";
import { z } from "zod";
var ROLES, PAGE_KEYS, users, callLogs, agentDialMetrics, agentProfiles, rolePagePermissions, qualityManagerTeamAssignments, callDispositionInconsistencies, taalkVdpLogs, vdpCalls, aoiFollowups, callDispositionOutcomes, vdpConnects, vdpMissedCalls, aoiConnects, producers, agentCredits, creditTransactions, dailyBillingReports, helpRequests, supportQueue, supportBookings, phantomBookingResolutions, leadCampaigns, feedbackReports, recruitCandidates, masterrecruit, recruitUserSettings, outboundCalls, callCenterEvents, agentMetrics, appointmentReminders, agentAvailability, callTracker, warConnects, warSubmissions, verificationSessions, walkthroughVideos, walkthroughProgress, walkthroughCompletion, appointments, userExperience, warMetrics, warTeams, warTeamMembers, insertUserSchema, insertAgentProfileSchema, agentProfileSchema, masterlead, masterleadrecruit, veteranLeads, insertVeteranLeadSchema, incomingLeads, insertIncomingLeadSchema, insertOutboundCallSchema, insertCallCenterEventSchema, insertAgentMetricsSchema, insertWarMetricsSchema, insertWarTeamSchema, insertWarTeamMemberSchema, insertCallTrackerSchema, insertVerificationSessionSchema, clientInfoSchema, methodSelectionSchema, screenshotUploadSchema, smsVerificationSchema, clientApprovalSchema, insertWarConnectSchema, insertAppointmentSchema, updateAppointmentSchema, appointmentQuerySchema, insertWarSubmissionSchema, appointmentReviews, insertAppointmentReviewSchema, insertWalkthroughVideoSchema, insertWalkthroughProgressSchema, insertWalkthroughCompletionSchema, dailyAccountability, appointmentOutcomes, agentAccessControl, insertDailyAccountabilitySchema, insertAgentAccessControlSchema, insertAppointmentOutcomeSchema, insertCallDispositionInconsistencySchema, insertLeadCampaignSchema, outboundCallHistory, inboundCallRouting, teams, roles, connectnowUsers, qualityManagerRoles, mgaTeams, qualityManagerAssignments, callUsageTracking, videoMeetingTracking, userCredits, incomingCalls, userGameStats, leaderboard, teamsRelations, rolesRelations, connectnowUsersRelations, callLogsRelations, vdpCallsRelations, incomingCallsRelations, userGameStatsRelations, insertTeamSchema, insertRoleSchema, insertConnectNowUserSchema, insertCallLogSchema, insertVdpCallSchema, adminRoles, userRoles, adminLogs, insertAdminRoleSchema, insertUserRoleSchema, insertAdminLogSchema, insertFeedbackReportSchema, insertRecruitCandidateSchema, updateRecruitCandidateSchema, insertCallUsageTrackingSchema, insertVideoMeetingTrackingSchema, userSessions, pageActivityLogs, featureUsageLogs, dailyUserStats, insertUserSessionSchema, insertPageActivityLogSchema, insertFeatureUsageLogSchema, insertDailyUserStatsSchema, insertRolePagePermissionSchema, insertQualityManagerTeamAssignmentSchema, DEFAULT_PAGE_PERMISSIONS;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    init_lead_tracking_schema();
    ROLES = ["system_admin", "rga", "mga", "agent", "quality_manager", "ao_quality_manager"];
    PAGE_KEYS = [
      "billing-dashboard",
      "aoi-report",
      "appointments",
      "ao-recruit",
      "ao-precheck",
      "settings",
      "ao-intelligence",
      "ao-connect",
      "subscription",
      "ao-precheck-management",
      "admin",
      "user-management",
      "teams-management"
    ];
    users = pgTable2("users", {
      id: serial("id").primaryKey(),
      username: text2("username").notNull().unique(),
      password: text2("password").notNull(),
      agentPhone: text2("agent_phone"),
      // Agent's phone number for SMS notifications
      agentName: text2("agent_name")
      // Agent's full name
    });
    callLogs = pgTable2("call_logs", {
      id: serial("id").primaryKey(),
      twilioCallSid: text2("twilio_call_sid").notNull().unique(),
      agentEmail: text2("agent_email").notNull(),
      // Who made the call
      toNumber: text2("to_number").notNull(),
      // Number called
      fromNumber: text2("from_number").notNull(),
      // Number calling from
      callStatus: text2("call_status").notNull(),
      // completed, no-answer, busy, failed
      callDuration: integer2("call_duration").default(0),
      // Duration in seconds
      callStartedAt: timestamp2("call_started_at").notNull(),
      callEndedAt: timestamp2("call_ended_at"),
      isReached: boolean2("is_reached").default(false),
      // Duration > 30 seconds
      isBooked: boolean2("is_booked").default(false),
      // Duration > 120 seconds  
      createdAt: timestamp2("created_at").defaultNow()
    });
    agentDialMetrics = pgTable2("agent_dial_metrics", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      // Who made the call
      agentName: text2("agent_name"),
      leadId: integer2("lead_id"),
      // Reference to masterlead.id (nullable since leads can be deleted/reassigned)
      leadPhone: text2("lead_phone").notNull(),
      // Store phone for historical tracking even if lead is deleted
      leadName: text2("lead_name"),
      leadState: text2("lead_state"),
      eventType: text2("event_type").notNull(),
      // 'dial', 'reach', 'booked'
      eventTimestamp: timestamp2("event_timestamp", { withTimezone: true }).notNull().defaultNow(),
      callDuration: integer2("call_duration"),
      // Duration in seconds
      callStatus: text2("call_status"),
      // 'completed', 'no_answer', 'busy', 'failed', etc.
      disposition: text2("disposition"),
      // Call disposition if available
      callSid: text2("call_sid"),
      // Twilio call SID if available
      source: text2("source"),
      // 'dialer', 'vdp', 'manual', 'hotlead', etc.
      notes: text2("notes"),
      createdAt: timestamp2("created_at", { withTimezone: true }).notNull().defaultNow()
    });
    agentProfiles = pgTable2("agent_profiles", {
      id: serial("id").primaryKey(),
      supabaseUserId: text2("supabase_user_id").notNull().unique(),
      // Links to Supabase auth.users.id
      firstName: text2("first_name").notNull(),
      lastName: text2("last_name").notNull(),
      phone: text2("phone").notNull(),
      email: text2("email").notNull(),
      zoomId: text2("zoom_id"),
      zoomPassword: text2("zoom_password").default("1"),
      profilePicture: text2("profile_picture"),
      googleTokens: text2("google_tokens"),
      // Google Calendar OAuth tokens JSON
      // HOTLEAD DISTRIBUTION FIELDS
      isActive: boolean2("is_active").default(true),
      // Whether agent is active for lead distribution
      licenseStates: jsonb("license_states").default(sql2`'[]'::jsonb`),
      // Array of state codes agent is licensed in ["TX", "FL", "CA"]
      authorizedMarkets: jsonb("authorized_markets").default(sql2`'[]'::jsonb`),
      // Array of markets agent can work ["Market A", "Market B"]
      maxHotleads: integer2("max_hotleads").default(50),
      // Maximum hotleads this agent can handle
      currentHotleadCount: integer2("current_hotlead_count").default(0),
      // Current number of assigned hotleads
      lastActivityDate: timestamp2("last_activity_date"),
      // Last time agent was active (calls, logins, etc.)
      distributionPriority: integer2("distribution_priority").default(1),
      // 1=highest, 5=lowest priority for lead assignment
      // ACCESS CONTROL
      callConnectorProAccess: boolean2("call_connector_pro_access").default(false),
      // Whether user can access Call Connector Pro
      ccproPrimerDismissedAt: timestamp2("ccpro_primer_dismissed_at"),
      // When agent dismissed CCPro primer modal (persists across browsers)
      vdpMissedCallDisclaimerAcceptedAt: timestamp2("vdp_missed_call_disclaimer_accepted_at"),
      // When agent accepted VDP missed call billing disclaimer (persists across browsers/devices)
      callConnectorProDisclaimerAcceptedAt: timestamp2("call_connector_pro_disclaimer_accepted_at"),
      // When agent accepted Call Connector Pro disclaimer (persists across browsers/devices)
      // TEAM MANAGEMENT
      mgaTeam: text2("mga_team"),
      // MGA name this agent belongs to (e.g., "John Smith")
      rgaTeam: text2("rga_team"),
      // RGA name this agent belongs to (e.g., "ENO IFTIU")
      teamRole: text2("team_role").default("agent"),
      // "agent", "team_lead", "manager", "mga", "rga"
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    rolePagePermissions = pgTable2("role_page_permissions", {
      role: text2("role").notNull(),
      page: text2("page").notNull(),
      allowed: boolean2("allowed").notNull().default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    }, (table) => {
      return {
        pk: primaryKey({ columns: [table.role, table.page] })
      };
    });
    qualityManagerTeamAssignments = pgTable2("quality_manager_team_assignments", {
      id: serial("id").primaryKey(),
      qmEmail: text2("qm_email").notNull(),
      mgaTeam: text2("mga_team").notNull(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    callDispositionInconsistencies = pgTable2("call_disposition_inconsistencies", {
      id: serial("id").primaryKey(),
      callSid: text2("call_sid").notNull(),
      agentEmail: text2("agent_email").notNull(),
      callDate: text2("call_date").notNull(),
      callDuration: integer2("call_duration"),
      toNumber: text2("to_number"),
      fromNumber: text2("from_number"),
      callDirection: text2("call_direction"),
      // 'inbound' or 'outbound-api'
      reportedOutcome: text2("reported_outcome").notNull(),
      // What agent reported (sale, set_appointment, etc.)
      issueType: text2("issue_type").notNull(),
      // booked_without_appointment, missing_appointment_data, etc.
      accountabilityDate: text2("accountability_date").notNull(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    taalkVdpLogs = pgTable2("taalk_vdp_logs", {
      id: serial("id").primaryKey(),
      callId: text2("call_id"),
      // Taalk call ID
      agentName: text2("agent_name"),
      // Agent who made the verification call
      clientName: text2("client_name"),
      // Client name being verified
      phoneNumber: text2("phone_number"),
      // Phone number called
      callDate: text2("call_date"),
      // Date of the verification call
      callStatus: text2("call_status"),
      // Status (completed, failed, etc.)
      duration: integer2("duration"),
      // Call duration in seconds
      verificationResult: text2("verification_result"),
      // Success/failed verification
      premiumAmount: decimal("premium_amount", { precision: 10, scale: 2 }),
      // Premium amount
      policyDetails: jsonb("policy_details"),
      // Any additional policy data
      rawData: jsonb("raw_data"),
      // Store original CSV row data
      resolved: boolean2("resolved").default(false),
      resolutionNotes: text2("resolution_notes"),
      uploadedAt: timestamp2("uploaded_at").defaultNow(),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    vdpCalls = pgTable2("vdp_calls", {
      id: serial("id").primaryKey(),
      Date: text2("Date"),
      // Call date
      Time: text2("Time"),
      // Call time
      Event: text2("Event"),
      // Event type (CONNECT, NEW, ASSIGN_TO, etc.)
      Phone: text2("Phone"),
      // Phone number
      Agent: text2("Agent"),
      // Agent ID
      Params: text2("Params"),
      // JSON parameters
      MGA: text2("MGA"),
      // Master General Agent from producers lookup
      RGA: text2("RGA"),
      // Regional General Agent from producers lookup
      duration: text2("duration"),
      // Call duration
      leadid: text2("leadid"),
      // Lead ID
      firstname: text2("firstname"),
      // First name
      lastname: text2("lastname"),
      // Last name
      market: text2("market"),
      // Market segment
      email: text2("email"),
      // Email address
      address: text2("address"),
      // Address
      city: text2("city"),
      // City
      state: text2("state"),
      // State
      resolutionStatus: text2("resolution_status"),
      // Resolution status (sold, appointment_set, not_interested, callback_requested, etc.)
      resolutionNotes: text2("resolution_notes"),
      // Additional notes about the resolution
      resolvedAt: timestamp2("resolved_at"),
      // When the call was resolved
      isFollowupRequired: boolean2("is_followup_required").default(false),
      // Whether this resolution requires follow-up
      followupDeadline: timestamp2("followup_deadline"),
      // When follow-up is due
      finalOutcome: text2("final_outcome"),
      // Final business outcome (sold, no_show, etc.
      finalOutcomeNotes: text2("final_outcome_notes"),
      // Notes about final outcome
      finalOutcomeAt: timestamp2("final_outcome_at"),
      // When final outcome was recorded
      createdAt: timestamp2("created_at").defaultNow()
      // When the record was created
    });
    aoiFollowups = pgTable2("aoi_followups", {
      id: serial("id").primaryKey(),
      vdpCallId: integer2("vdp_call_id").references(() => vdpCalls.id).notNull(),
      taalk_leadid: text2("taalk_leadid").notNull(),
      // Links to masterleads table using taalk_leadid
      agentEmail: text2("agent_email").notNull(),
      followupType: text2("followup_type").notNull(),
      // "appointment", "callback"
      initialResolution: text2("initial_resolution").notNull(),
      // "appointment_set", "callback_requested"
      initialResolutionAt: timestamp2("initial_resolution_at").notNull(),
      initialNotes: text2("initial_notes"),
      // Notes from initial resolution
      // Follow-up Requirements
      dueDate: timestamp2("due_date").notNull(),
      // When follow-up is due
      status: text2("status").notNull().default("pending"),
      // "pending", "completed", "overdue"
      // Final Outcome Tracking
      finalOutcome: text2("final_outcome"),
      // "sold", "attended_declined", "no_show", "cancelled", "rescheduled", "not_interested", "unable_to_reach"
      finalNotes: text2("final_notes"),
      // Notes about final outcome
      completedAt: timestamp2("completed_at"),
      // When final outcome was recorded
      completedBy: text2("completed_by"),
      // Email of who recorded final outcome
      // Appointment Specific Fields
      appointmentDate: timestamp2("appointment_date"),
      // Scheduled appointment date/time
      appointmentType: text2("appointment_type"),
      // "zoom", "phone", "in_person"
      appointmentDetails: text2("appointment_details"),
      // Zoom link, phone number, address
      // Callback Specific Fields
      callbackDate: timestamp2("callback_date"),
      // When callback should happen
      callbackPhone: text2("callback_phone"),
      // Phone number to call back
      callbackNotes: text2("callback_notes"),
      // Special callback instructions
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    callDispositionOutcomes = pgTable2("call_disposition_outcomes", {
      id: serial("id").primaryKey(),
      accountabilityId: integer2("accountability_id").notNull(),
      callSid: text2("call_sid").notNull(),
      outcome: text2("outcome").notNull(),
      // sale, refused, set_appointment, etc.
      saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).default("0.00"),
      notes: text2("notes"),
      agentEmail: text2("agent_email").notNull(),
      callDate: text2("call_date").notNull(),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    vdpConnects = pgTable2("vdp_connects", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull(),
      // VDP agent ID (e.g., "409") 
      associateId: integer2("associate_id"),
      // Associate ID number
      phone: text2("phone").notNull(),
      // Phone number called
      durationSeconds: integer2("duration_seconds").notNull(),
      // Call duration in seconds
      clientName: text2("client_name"),
      // Client name if available
      leadId: text2("lead_id"),
      // Lead ID if available
      leadid: text2("leadid"),
      // Lead ID from VDP params
      firstname: text2("firstname"),
      // First name from VDP params
      lastname: text2("lastname"),
      // Last name from VDP params
      market: text2("market"),
      // Market segment (Veteran, etc.)
      mga: text2("mga"),
      // MGA (Master General Agent)
      rga: text2("rga"),
      // RGA (Regional General Agent)
      connectDate: text2("connect_date").notNull(),
      // Date of connect
      pickupTime: text2("pickup_time"),
      // When call was picked up (text format)
      endTime: text2("end_time"),
      // When call ended (text format)
      eventType: text2("event_type"),
      // Event type (CONNECT, END, etc.)
      params: text2("params"),
      // JSON params
      processedAt: timestamp2("processed_at").defaultNow()
    });
    vdpMissedCalls = pgTable2("vdp_missed_calls", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull(),
      // VDP agent ID (e.g., "409")
      agentName: text2("agent_name"),
      // Agent full name  
      associateId: integer2("associate_id"),
      // Associate ID number
      phoneNumber: text2("phone_number").notNull(),
      // Phone number called
      duration: integer2("duration").default(0),
      // Duration attempted (0 for missed)
      clientName: text2("client_name"),
      // Client name if available
      leadId: text2("lead_id"),
      // Lead ID if available
      market: text2("market"),
      // Market segment (Veteran, etc.)
      mga: text2("mga"),
      // MGA (Master General Agent)
      rga: text2("rga"),
      // RGA (Regional General Agent)
      missedDate: text2("missed_date").notNull(),
      // Date of missed call
      missedTime: timestamp2("missed_time").notNull(),
      // When call was missed
      createdAt: timestamp2("created_at").defaultNow()
    });
    aoiConnects = pgTable2("aoi_connects", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull(),
      // Agent ID (associate_id from Supabase)
      supabaseVdpId: integer2("supabase_vdp_id").notNull().unique(),
      // ID from Supabase vdp_calls table
      clientPhone: text2("client_phone").notNull(),
      // Phone number called
      clientName: text2("client_name"),
      // Client full name (firstname + lastname)
      firstName: text2("first_name"),
      // Client first name
      lastName: text2("last_name"),
      // Client last name
      leadId: text2("lead_id"),
      // Lead ID
      market: text2("market"),
      // Market segment
      callDate: text2("call_date").notNull(),
      // Date of call
      callTime: text2("call_time").notNull(),
      // Time of call
      duration: text2("duration"),
      // Call duration
      billingAmount: decimal("billing_amount", { precision: 10, scale: 2 }).default("8.00"),
      // $8.00 per AOI connect
      billed: boolean2("billed").default(false),
      // Whether this has been billed
      notified: boolean2("notified").default(false),
      // Whether agent was notified
      syncedAt: timestamp2("synced_at").defaultNow(),
      // When synced from Supabase
      createdAt: timestamp2("created_at").defaultNow()
    });
    producers = pgTable2("producers", {
      id: serial("id").primaryKey(),
      associateId: integer2("associate_id").notNull().unique(),
      // Associate ID from Excel
      agentName: text2("agent_name").notNull(),
      // Full agent name
      mga: text2("mga"),
      // Master General Agent
      rga: text2("rga"),
      // Regional General Agent  
      companyEmail: text2("company_email"),
      // Company email
      personalEmail: text2("personal_email"),
      // Personal email
      phone: text2("phone"),
      // Phone number
      aoiMarket: text2("aoi_market"),
      // AOI Market
      designatedMarket: text2("designated_market"),
      // Designated Market
      licensedStates: text2("licensed_states"),
      // Life-and-Health Licensed States
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    agentCredits = pgTable2("agent_credits", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull().unique(),
      // VDP agent ID (e.g., "409")
      associateId: integer2("associate_id"),
      // Associate ID from producer hierarchy
      agentName: text2("agent_name").notNull(),
      // Agent full name
      agentEmail: text2("agent_email"),
      // Agent email for notifications
      currentBalance: decimal("current_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
      // Current credit balance
      totalPurchased: decimal("total_purchased", { precision: 10, scale: 2 }).default("0.00"),
      // Total credits purchased
      totalUsed: decimal("total_used", { precision: 10, scale: 2 }).default("0.00"),
      // Total credits used
      aoiConnectRate: decimal("aoi_connect_rate", { precision: 10, scale: 2 }).default("8.00"),
      // Cost per AOI connect
      aoiMissedRate: decimal("aoi_missed_rate", { precision: 10, scale: 2 }).default("4.00"),
      // Cost per AOI missed call
      aoiRecruitRate: decimal("aoi_recruit_rate", { precision: 10, scale: 2 }).default("5.00"),
      // Cost per AOI recruit
      aoiPrecheckRate: decimal("aoi_precheck_rate", { precision: 10, scale: 2 }).default("3.00"),
      // Cost per AOI precheck
      aoiPlusRate: decimal("aoi_plus_rate", { precision: 10, scale: 2 }).default("6.00"),
      // Cost per AOI plus lead
      mga: text2("mga"),
      // MGA for team reporting
      rga: text2("rga"),
      // RGA for team reporting
      isActive: boolean2("is_active").default(true),
      // Whether agent can use credits
      lowBalanceThreshold: decimal("low_balance_threshold", { precision: 10, scale: 2 }).default("10.00"),
      // When to send low balance alerts
      autoReloadEnabled: boolean2("auto_reload_enabled").default(false),
      // Auto-reload credits when low
      autoReloadAmount: decimal("auto_reload_amount", { precision: 10, scale: 2 }).default("50.00"),
      // Amount to auto-reload
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    creditTransactions = pgTable2("credit_transactions", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull(),
      // VDP agent ID
      transactionType: text2("transaction_type").notNull(),
      // "purchase", "usage", "refund", "adjustment"
      serviceType: text2("service_type"),
      // "aoi_connect", "aoi_missed", "aoi_recruit", "aoi_precheck"
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      // Transaction amount (positive for credits, negative for usage)
      balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }).notNull(),
      // Balance before transaction
      balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
      // Balance after transaction
      description: text2("description").notNull(),
      // Transaction description
      vdpConnectId: integer2("vdp_connect_id"),
      // Link to vdp_connects table if usage transaction
      phoneNumber: text2("phone_number"),
      // Phone number for connect transactions
      clientName: text2("client_name"),
      // Client name for connect transactions
      connectDuration: integer2("connect_duration"),
      // Connect duration in seconds
      market: text2("market"),
      // Market segment
      paymentMethod: text2("payment_method"),
      // "stripe", "admin", "auto_reload"
      paymentId: text2("payment_id"),
      // External payment system ID
      createdAt: timestamp2("created_at").defaultNow()
    });
    dailyBillingReports = pgTable2("daily_billing_reports", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull(),
      reportDate: text2("report_date").notNull(),
      // YYYY-MM-DD format
      connectCount: integer2("connect_count").default(0),
      // Total connects for the day
      missedCallCount: integer2("missed_call_count").default(0),
      // Total missed calls for the day
      totalCharges: decimal("total_charges", { precision: 10, scale: 2 }).default("0.00"),
      // Total charges for the day
      averageConnectDuration: integer2("average_connect_duration").default(0),
      // Average connect duration in seconds
      topClientMarket: text2("top_client_market"),
      // Most active market for the day
      balanceStart: decimal("balance_start", { precision: 10, scale: 2 }).notNull(),
      // Balance at start of day
      balanceEnd: decimal("balance_end", { precision: 10, scale: 2 }).notNull(),
      // Balance at end of day
      emailSent: boolean2("email_sent").default(false),
      // Whether daily recap email was sent
      emailSentAt: timestamp2("email_sent_at"),
      // When recap email was sent
      createdAt: timestamp2("created_at").defaultNow()
    });
    helpRequests = pgTable2("help_requests", {
      id: serial("id").primaryKey(),
      name: text2("name").notNull(),
      email: text2("email").notNull(),
      subject: text2("subject").notNull(),
      message: text2("message").notNull(),
      page: text2("page"),
      // Which page the help was requested from
      status: text2("status").default("new"),
      // new, in_progress, resolved
      resolvedBy: text2("resolved_by"),
      // Admin who resolved it
      resolutionNotes: text2("resolution_notes"),
      createdAt: timestamp2("created_at").defaultNow(),
      resolvedAt: timestamp2("resolved_at")
    });
    supportQueue = pgTable2("support_queue", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull(),
      name: text2("name").notNull(),
      issueCategory: text2("issue_category").notNull(),
      joinedAt: timestamp2("joined_at", { withTimezone: true }).notNull().defaultNow(),
      position: integer2("position").notNull().default(1),
      status: text2("status").notNull().default("waiting"),
      // waiting, in_session, completed, abandoned
      zoomLink: text2("zoom_link"),
      bookingId: integer2("booking_id"),
      createdAt: timestamp2("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp2("updated_at", { withTimezone: true }).notNull().defaultNow()
    });
    supportBookings = pgTable2("support_bookings", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull(),
      name: text2("name").notNull(),
      slotStart: timestamp2("slot_start", { withTimezone: true }).notNull(),
      slotEnd: timestamp2("slot_end", { withTimezone: true }).notNull(),
      issueCategory: text2("issue_category").notNull().default("general"),
      createdAt: timestamp2("created_at", { withTimezone: true }).notNull().defaultNow()
    });
    phantomBookingResolutions = pgTable2("phantom_booking_resolutions", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      leadName: text2("lead_name").notNull(),
      leadPhone: text2("lead_phone").notNull(),
      market: text2("market").notNull(),
      resolutionType: text2("resolution_type").notNull(),
      // data_error, forgot_appointment, incorrect_marking
      explanation: text2("explanation").notNull(),
      resolvedAt: timestamp2("resolved_at").defaultNow(),
      originalBookingDate: text2("original_booking_date").notNull(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    leadCampaigns = pgTable2("lead_campaigns", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      campaignName: text2("campaign_name").notNull(),
      campaignType: text2("campaign_type").notNull(),
      // 'smart' or 'custom'
      leadCount: integer2("lead_count").default(0),
      filters: jsonb("filters"),
      // Smart campaign filters
      leadPhones: jsonb("lead_phones"),
      // Custom campaign phone numbers array
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    feedbackReports = pgTable2("feedback_reports", {
      id: serial("id").primaryKey(),
      reportType: text2("report_type").notNull(),
      // "bug", "feature_request", "feedback"
      title: text2("title").notNull(),
      description: text2("description").notNull(),
      severity: text2("severity").notNull().default("medium"),
      // "low", "medium", "high", "critical"
      status: text2("status").notNull().default("open"),
      // "open", "in_progress", "resolved", "closed"
      reporterEmail: text2("reporter_email").notNull(),
      reporterName: text2("reporter_name"),
      browserInfo: text2("browser_info"),
      // User agent string
      pageUrl: text2("page_url"),
      // URL where issue occurred
      stepsToReproduce: text2("steps_to_reproduce"),
      expectedBehavior: text2("expected_behavior"),
      actualBehavior: text2("actual_behavior"),
      attachments: jsonb("attachments"),
      // Array of attachment URLs/paths
      adminNotes: text2("admin_notes"),
      // Private admin notes
      assignedTo: text2("assigned_to"),
      // Admin email assigned to handle this
      priority: integer2("priority").default(3),
      // 1=highest, 5=lowest
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow(),
      resolvedAt: timestamp2("resolved_at")
    });
    recruitCandidates = pgTable2("recruit_candidates", {
      id: serial("id").primaryKey(),
      firstName: text2("first_name").notNull(),
      lastName: text2("last_name").notNull(),
      phone: text2("phone").notNull(),
      email: text2("email").notNull(),
      city: text2("city"),
      state: text2("state"),
      zipCode: text2("zip_code"),
      // Recruitment specific fields
      status: text2("status").notNull().default("new"),
      // new, contacted, interview, pending, hired, rejected
      position: text2("position"),
      // Position they're applying for
      experience: text2("experience"),
      // Years of experience
      rating: decimal("rating", { precision: 3, scale: 1 }),
      // 1-5 rating
      notes: text2("notes"),
      // Notes about the candidate
      aiSummary: text2("ai_summary"),
      // AI-generated summary from screening call
      // Agent who added this candidate
      agentId: text2("agent_id").notNull(),
      agentEmail: text2("agent_email").notNull(),
      // Appointment scheduling
      appointmentDate: timestamp2("appointment_date"),
      appointmentNotes: text2("appointment_notes"),
      // Stage tracking
      currentStageId: integer2("current_stage_id"),
      stageEnteredAt: timestamp2("stage_entered_at"),
      // ExamFX Licensing Tracker
      examfxVoucherCode: text2("examfx_voucher_code"),
      // voucher code issued to candidate
      examfxEnrolledAt: timestamp2("examfx_enrolled_at"),
      // when they were enrolled
      examfxState: text2("examfx_state"),
      // which state's course (e.g. "TX", "CA")
      examfxCourseType: text2("examfx_course_type"),
      // "Life & Health", "Property & Casualty", etc.
      examfxStatus: text2("examfx_status"),
      // "not_enrolled" | "enrolled" | "studying" | "exam_scheduled" | "passed" | "failed"
      examfxProgressPercent: integer2("examfx_progress_percent"),
      // 0-100 course completion
      examfxPracticeScores: text2("examfx_practice_scores"),
      // JSON array of practice exam scores e.g. "[72, 81, 88]"
      examfxExamDate: timestamp2("examfx_exam_date"),
      // scheduled real exam date
      examfxExamResult: text2("examfx_exam_result"),
      // "passed" | "failed" | null
      examfxExamResultAt: timestamp2("examfx_exam_result_at"),
      // when they took the real exam
      examfxNotes: text2("examfx_notes"),
      // recruiter notes on licensing progress
      examfxLastSyncAt: timestamp2("examfx_last_sync_at"),
      // last time data was synced from ExamFX
      // Call tracking (similar to masterlead.last_contacted)
      lastContacted: timestamp2("last_contacted"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    masterrecruit = pgTable2("masterrecruit", {
      id: serial("id").primaryKey(),
      firstName: text2("first_name").notNull(),
      lastName: text2("last_name").notNull(),
      phone: text2("phone").notNull(),
      email: text2("email").notNull(),
      city: text2("city"),
      state: text2("state"),
      zipCode: text2("zip_code"),
      status: text2("status").notNull().default("new"),
      position: text2("position"),
      experience: text2("experience"),
      rating: decimal("rating", { precision: 3, scale: 1 }),
      notes: text2("notes"),
      aiSummary: text2("ai_summary"),
      agentId: text2("agent_id"),
      // Null until converted to recruit_candidates
      agentEmail: text2("agent_email"),
      // Null until converted
      isHotCandidate: boolean2("is_hot_candidate").default(false),
      // Hot candidate queue
      priorityScore: integer2("priority_score").default(0),
      // Queue order (higher = first)
      appointmentDate: timestamp2("appointment_date"),
      appointmentNotes: text2("appointment_notes"),
      currentStageId: integer2("current_stage_id"),
      stageEnteredAt: timestamp2("stage_entered_at"),
      lastContacted: timestamp2("last_contacted"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    recruitUserSettings = pgTable2("recruit_user_settings", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull().unique(),
      // Pipeline order customization - JSON array of stage IDs in custom order
      pipelineOrder: jsonb("pipeline_order"),
      // e.g., [1, 2, 3, 4, 5, 6, 7, 8]
      // Custom stage names - JSON object mapping stage ID to custom name
      customStageNames: jsonb("custom_stage_names"),
      // e.g., { "3": "My Virtual Overview", "5": "Group Meeting" }
      // Stage URLs - JSON object mapping stage ID to custom SMS URL (Virtual Overview is hardcoded, not editable)
      stageUrls: jsonb("stage_urls"),
      // e.g., { "5": "https://example.com/group-final", "6": "https://example.com/final-interview" }
      // Legacy URL fields (kept for backward compatibility, but stageUrls is preferred)
      virtualOverviewUrl: text2("virtual_overview_url"),
      // Deprecated: Virtual Overview URL is now hardcoded
      groupFinalUrl: text2("group_final_url"),
      // Deprecated: Use stageUrls instead
      finalInterviewUrl: text2("final_interview_url"),
      // Deprecated: Use stageUrls instead
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    outboundCalls = pgTable2("outbound_calls", {
      id: serial("id").primaryKey(),
      // Twilio Call Information
      twilioCallSid: text2("twilio_call_sid").notNull().unique(),
      twilioConferenceSid: text2("twilio_conference_sid"),
      twilioParentCallSid: text2("twilio_parent_call_sid"),
      // For connecting related calls
      // Agent Information
      agentEmail: text2("agent_email").notNull(),
      agentPhone: text2("agent_phone"),
      agentName: text2("agent_name"),
      // Lead Information
      leadName: text2("lead_name").notNull(),
      leadPhone: text2("lead_phone").notNull(),
      leadId: text2("lead_id"),
      leadMarket: text2("lead_market"),
      leadState: text2("lead_state"),
      leadCity: text2("lead_city"),
      // Call Status and Timing
      callStatus: text2("call_status").notNull().default("initiated"),
      // initiated, ringing, in-progress, completed, failed, no-answer, busy
      callDirection: text2("call_direction").notNull().default("outbound"),
      startTime: timestamp2("start_time").defaultNow(),
      answerTime: timestamp2("answer_time"),
      endTime: timestamp2("end_time"),
      duration: integer2("duration").default(0),
      // Duration in seconds
      // Call Quality and Technical Details
      callQuality: decimal("call_quality", { precision: 3, scale: 2 }),
      // 0.00 to 5.00 rating
      localPresenceNumber: text2("local_presence_number"),
      // Which local number was used
      recordingUrl: text2("recording_url"),
      // Disposition and Results
      callDisposition: text2("call_disposition"),
      // no-answer, voicemail, callback, appointment, not-interested, do-not-call
      appointmentScheduled: boolean2("appointment_scheduled").default(false),
      appointmentDate: timestamp2("appointment_date"),
      notes: text2("notes"),
      // System Information
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    callCenterEvents = pgTable2("call_center_events", {
      id: serial("id").primaryKey(),
      eventType: text2("event_type").notNull(),
      // call_started, call_answered, call_ended, disposition_set, etc.
      callId: integer2("call_id").references(() => outboundCalls.id),
      twilioCallSid: text2("twilio_call_sid").notNull(),
      agentEmail: text2("agent_email").notNull(),
      eventData: jsonb("event_data"),
      // Store additional event-specific data
      timestamp: timestamp2("timestamp").defaultNow()
    });
    agentMetrics = pgTable2("agent_metrics", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      date: timestamp2("date").notNull(),
      // Call Volume
      totalCalls: integer2("total_calls").default(0),
      totalConnects: integer2("total_connects").default(0),
      totalAppointments: integer2("total_appointments").default(0),
      // Performance Percentages
      connectRate: decimal("connect_rate", { precision: 5, scale: 2 }).default("0.00"),
      // Percentage
      appointmentRate: decimal("appointment_rate", { precision: 5, scale: 2 }).default("0.00"),
      // Time Metrics
      totalTalkTime: integer2("total_talk_time").default(0),
      // Total talk time in seconds
      avgCallDuration: decimal("avg_call_duration", { precision: 8, scale: 2 }).default("0.00"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    appointmentReminders = pgTable2("appointment_reminders", {
      id: serial("id").primaryKey(),
      appointmentId: integer2("appointment_id").references(() => appointments.id).notNull(),
      // Reminder Configuration
      reminderType: text2("reminder_type").notNull(),
      // sms, email, call
      reminderTime: integer2("reminder_time").notNull(),
      // Minutes before appointment
      // Delivery Status
      status: text2("status").notNull().default("pending"),
      // pending, sent, delivered, failed
      sentAt: timestamp2("sent_at"),
      deliveredAt: timestamp2("delivered_at"),
      errorMessage: text2("error_message"),
      // Message Content
      messageContent: text2("message_content"),
      createdAt: timestamp2("created_at").defaultNow()
    });
    agentAvailability = pgTable2("agent_availability", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      // Day of week (0 = Sunday, 6 = Saturday)
      dayOfWeek: integer2("day_of_week").notNull(),
      // Time slots (in minutes from midnight)
      startTime: integer2("start_time").notNull(),
      // e.g., 540 = 9:00 AM
      endTime: integer2("end_time").notNull(),
      // e.g., 1020 = 5:00 PM
      // Availability status
      isAvailable: boolean2("is_available").default(true),
      timezone: text2("timezone").notNull().default("America/New_York"),
      // Booking settings
      bufferTime: integer2("buffer_time").default(15),
      // Minutes between appointments
      maxAdvanceDays: integer2("max_advance_days").default(30),
      // How far in advance bookings are allowed
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    callTracker = pgTable2("call_tracker", {
      id: serial("id").primaryKey(),
      // CORE IDENTIFIERS - Never null, always trackable
      sessionId: text2("session_id").notNull().unique(),
      // Our internal session ID
      agentEmail: text2("agent_email").notNull(),
      // Who made the call
      leadPhone: text2("lead_phone").notNull(),
      // Who was called
      leadName: text2("lead_name").notNull(),
      // Lead name for reference
      // CALL PROGRESS - Simple 4-state system
      callProgress: text2("call_progress").notNull().default("not_initiated"),
      // Values: not_initiated -> initiated -> connected -> in_progress -> complete
      // EXTERNAL SYSTEM IDS - Can be null if systems fail
      taalkCallId: text2("taalk_call_id"),
      // Taalk API call ID
      twilioCallSid: text2("twilio_call_sid"),
      // Twilio call SID
      zoomRoomId: text2("zoom_room_id"),
      // Zoom room for verification
      // TIMESTAMPS - Exact progression tracking
      initiatedAt: timestamp2("initiated_at"),
      // When call was started
      connectedAt: timestamp2("connected_at"),
      // When call was answered
      inProgressAt: timestamp2("in_progress_at"),
      // When call became active
      completedAt: timestamp2("completed_at"),
      // When call ended
      // RESULTS - What happened
      callOutcome: text2("call_outcome"),
      // answered, no_answer, busy, failed, voicemail
      verificationResult: text2("verification_result"),
      // passed, failed, incomplete
      appointmentBooked: boolean2("appointment_booked").default(false),
      // ERROR HANDLING - Fail-safe tracking
      lastError: text2("last_error"),
      // Any error messages
      retryCount: integer2("retry_count").default(0),
      // How many retries
      systemFlags: jsonb("system_flags"),
      // Any additional metadata
      // AUDIT TRAIL - Never changes
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    warConnects = pgTable2("war_connects", {
      id: serial("id").primaryKey(),
      connectId: text2("connect_id").notNull().unique(),
      // Unique identifier for the connect
      agentEmail: text2("agent_email").notNull(),
      leadName: text2("lead_name").notNull(),
      leadPhone: text2("lead_phone").notNull(),
      connectDate: timestamp2("connect_date").notNull(),
      connectTime: text2("connect_time").notNull(),
      duration: integer2("duration").notNull(),
      // Duration in seconds
      leadSource: text2("lead_source"),
      // Where the lead came from
      market: text2("market").notNull(),
      state: text2("state").notNull(),
      // Connect Type Classification (AOI appointments, press sales, etc.)
      connectType: text2("connect_type").notNull(),
      // 'aoi_appointment', 'press_sale', 'instant_presentation', 'callback_scheduled', 'other'
      // Daily Production Status (captured immediately with connect)
      productionStatus: text2("production_status").default("pending"),
      // 'pending', 'confirmed', 'cancelled', 'no_show', 'completed'
      immediateOutcome: text2("immediate_outcome"),
      // What was agreed to right away (appointment set, sale closed, callback scheduled)
      // Final Disposition tracking (for Wednesday reporting)
      disposition: text2("disposition"),
      // appointment, sale, cant_afford, medically_uninsurable, not_interested, pending
      appointmentSet: boolean2("appointment_set").default(false),
      appointmentDate: timestamp2("appointment_date"),
      saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }),
      // Enhanced tracking fields
      followUpRequired: boolean2("follow_up_required").default(false),
      nextContactDate: timestamp2("next_contact_date"),
      priorityLevel: text2("priority_level").default("normal"),
      // 'urgent', 'high', 'normal', 'low'
      tags: jsonb("tags").default(sql2`'[]'::jsonb`),
      // Flexible tagging for categorization
      notes: text2("notes"),
      reportedAt: timestamp2("reported_at"),
      // Connect Review System (for gamified card deck)
      reviewStatus: text2("review_status"),
      // 'pending', 'interested', 'not_interested', 'sale'
      reviewedAt: timestamp2("reviewed_at"),
      nextReviewDate: timestamp2("next_review_date"),
      // For interested connects to appear tomorrow
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    warSubmissions = pgTable2("war_submissions", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      weekStart: timestamp2("week_start").notNull(),
      weekEnd: timestamp2("week_end").notNull(),
      totalConnects: integer2("total_connects").notNull(),
      reportedConnects: integer2("reported_connects").notNull(),
      submittedAt: timestamp2("submitted_at").defaultNow(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    verificationSessions = pgTable2("verification_sessions", {
      id: serial("id").primaryKey(),
      sessionId: text2("session_id").notNull().unique(),
      firstName: text2("first_name").notNull(),
      lastName: text2("last_name").notNull(),
      spouseName: text2("spouse_name"),
      phone: text2("phone").notNull(),
      agentPhone: text2("agent_phone"),
      // Agent's phone number for Taalk integration
      agentFirstName: text2("agent_first_name"),
      // Agent's first name for Taalk script
      agentLastName: text2("agent_last_name"),
      // Agent's last name for Taalk script
      associateId: integer2("associate_id"),
      // Associate ID to lookup MGA/RGA from producers table
      agentMgaTeam: text2("agent_mga_team"),
      // Agent's MGA team for RBAC (auto-populated from producers lookup)
      agentRgaTeam: text2("agent_rga_team"),
      // Agent's RGA team for RBAC (auto-populated from producers lookup)
      city: text2("city").notNull(),
      state: text2("state").notNull(),
      premium: text2("premium").notNull(),
      achDrawDate: text2("ach_draw_date"),
      // Full date for ACH draw (e.g., "September 8th")
      achDrawDateShort: text2("ach_draw_date_short"),
      // Short format (e.g., "8th")
      sessionType: text2("session_type").notNull().default("live"),
      // "demo" or "live" - demo sessions are hidden from admin view
      verificationMethod: text2("verification_method"),
      zoomRoomId: text2("zoom_room_id"),
      zoomPassword: text2("zoom_password"),
      language: text2("language").default("en"),
      screenshotPath: text2("screenshot_path"),
      status: text2("status").notNull().default("pending"),
      // SMS verification fields
      smsVerificationSent: boolean2("sms_verification_sent").default(false),
      smsVerificationCode: text2("sms_verification_code"),
      clientApprovalStatus: text2("client_approval_status").default("pending"),
      // pending, approved, denied
      clientApprovalTime: timestamp2("client_approval_time"),
      // Client SMS tracking
      clientSmsSid: text2("client_sms_sid"),
      clientSmsStatus: text2("client_sms_status"),
      clientSmsSentAt: text2("client_sms_sent_at"),
      clientSmsError: text2("client_sms_error"),
      // Agent SMS tracking
      agentSmsSid: text2("agent_sms_sid"),
      agentSmsStatus: text2("agent_sms_status"),
      agentSmsSentAt: text2("agent_sms_sent_at"),
      agentSmsError: text2("agent_sms_error"),
      // Location and IP tracking
      clientIpAddress: text2("client_ip_address"),
      clientCountry: text2("client_country"),
      clientRegion: text2("client_region"),
      clientCity: text2("client_city"),
      clientLatitude: text2("client_latitude"),
      clientLongitude: text2("client_longitude"),
      clientTimezone: text2("client_timezone"),
      clientIsp: text2("client_isp"),
      clientUserAgent: text2("client_user_agent"),
      // Client VPN detection
      clientIsVpn: boolean2("client_is_vpn").default(false),
      clientIsProxy: boolean2("client_is_proxy").default(false),
      clientIsHosting: boolean2("client_is_hosting").default(false),
      clientVpnDetectionReason: text2("client_vpn_detection_reason"),
      // Agent IP tracking 
      agentIpAddress: text2("agent_ip_address"),
      agentCountry: text2("agent_country"),
      agentRegion: text2("agent_region"),
      agentCity: text2("agent_city"),
      agentLatitude: text2("agent_latitude"),
      agentLongitude: text2("agent_longitude"),
      agentTimezone: text2("agent_timezone"),
      agentIsp: text2("agent_isp"),
      agentUserAgent: text2("agent_user_agent"),
      // Agent VPN detection
      agentIsVpn: boolean2("agent_is_vpn").default(false),
      agentIsProxy: boolean2("agent_is_proxy").default(false),
      agentIsHosting: boolean2("agent_is_hosting").default(false),
      agentVpnDetectionReason: text2("agent_vpn_detection_reason"),
      callCompleted: boolean2("call_completed").default(false),
      verificationResult: text2("verification_result"),
      // JSON string for call results
      // Taalk call tracking
      taalkCallId: text2("taalk_call_id"),
      taalkCallStatus: text2("taalk_call_status"),
      // initiated, ringing, answered, completed, failed
      taalkCallInitiatedAt: text2("taalk_call_initiated_at"),
      taalkCallCompletedAt: text2("taalk_call_completed_at"),
      taalkCallDuration: integer2("taalk_call_duration"),
      // Duration in seconds
      taalkCallData: text2("taalk_call_data"),
      // JSON string with Taalk response data
      taalkCallUrl: text2("taalk_call_url"),
      // Object storage URL for downloaded recording
      // IP Analysis fields
      ipAnalysis: jsonb("ip_analysis"),
      // JSONB storing full IP analysis result
      ipFlagStatus: text2("ip_flag_status"),
      // Quick status: valid, flagged, suspicious, critical, pending
      ipFlagReason: text2("ip_flag_reason"),
      // Human-readable explanation of flag status
      ipAnalysisSummary: text2("ip_analysis_summary"),
      // Summary text displayed in hover card
      // Real-time call tracking fields
      callStatus: text2("call_status"),
      // General call status (initiated, ringing, ongoing, completed, failed, etc.)
      initiatedAt: timestamp2("initiated_at"),
      // When call was started
      callCompletedAt: timestamp2("call_completed_at"),
      // When call ended
      duration: integer2("duration"),
      // Call duration in seconds
      answered: boolean2("answered").default(false),
      // Whether call was answered
      lastPolledAt: timestamp2("last_polled_at"),
      // For tracking polling intervals
      // Transmit precheck - only transmitted sessions show in AO Precheck Management
      transmitStatus: text2("transmit_status").default("pending_transmit"),
      // pending_transmit | transmitted | scheduled_delete
      precheckType: text2("precheck_type").default("live"),
      // live | training | incomplete
      transmittedAt: timestamp2("transmitted_at"),
      // When agent clicked Transmit
      scheduledDeleteAt: timestamp2("scheduled_delete_at"),
      // Training/Incomplete: delete in 24h; Recover clears this
      createdAt: timestamp2("created_at").defaultNow(),
      completedAt: timestamp2("completed_at")
    });
    walkthroughVideos = pgTable2("walkthrough_videos", {
      id: serial("id").primaryKey(),
      title: text2("title").notNull(),
      description: text2("description"),
      videoUrl: text2("video_url").notNull(),
      // URL to video file or streaming link
      thumbnailUrl: text2("thumbnail_url"),
      // Video thumbnail image
      category: text2("category").notNull(),
      // "call_connector_pro", "ao_precheck", "general"
      orderIndex: integer2("order_index").notNull().default(0),
      // Display order within category
      duration: integer2("duration"),
      // Video duration in seconds
      isRequired: boolean2("is_required").default(true),
      // Must be watched to complete walkthrough
      isActive: boolean2("is_active").default(true),
      // Can be disabled by admins
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    walkthroughProgress = pgTable2("walkthrough_progress", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull(),
      // User who is taking the walkthrough
      videoId: integer2("video_id").references(() => walkthroughVideos.id).notNull(),
      // Progress tracking
      hasStarted: boolean2("has_started").default(false),
      hasCompleted: boolean2("has_completed").default(false),
      watchTimeSeconds: integer2("watch_time_seconds").default(0),
      // How much they've watched
      lastWatchedAt: timestamp2("last_watched_at"),
      completedAt: timestamp2("completed_at"),
      // Engagement metrics
      pauseCount: integer2("pause_count").default(0),
      replayCount: integer2("replay_count").default(0),
      skipAttempts: integer2("skip_attempts").default(0),
      // Track if they try to skip
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    walkthroughCompletion = pgTable2("walkthrough_completion", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull().unique(),
      // One record per user
      // Completion status by category
      callConnectorProCompleted: boolean2("call_connector_pro_completed").default(false),
      aoPreCheckCompleted: boolean2("ao_precheck_completed").default(false),
      generalWalkthroughCompleted: boolean2("general_walkthrough_completed").default(false),
      // Overall completion
      isFullyCompleted: boolean2("is_fully_completed").default(false),
      completedAt: timestamp2("completed_at"),
      // System access tracking
      systemAccessGranted: boolean2("system_access_granted").default(false),
      firstAccessAt: timestamp2("first_access_at"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    appointments = pgTable2("appointments", {
      id: serial("id").primaryKey(),
      // Appointment Basic Info
      title: text2("title").notNull(),
      description: text2("description"),
      appointmentType: text2("appointment_type").notNull().default("consultation"),
      // consultation, follow-up, presentation, closing
      // Scheduling Details
      startTime: timestamp2("start_time").notNull(),
      endTime: timestamp2("end_time").notNull(),
      duration: integer2("duration").notNull().default(60),
      // Duration in minutes
      timezone: text2("timezone").notNull().default("America/New_York"),
      // Participant Information
      agentId: text2("agent_id").notNull(),
      agentEmail: text2("agent_email").notNull(),
      agentName: text2("agent_name").notNull(),
      // Lead/Client Information
      leadId: text2("lead_id"),
      leadName: text2("lead_name").notNull(),
      leadPhone: text2("lead_phone").notNull(),
      leadEmail: text2("lead_email"),
      leadCity: text2("lead_city"),
      leadState: text2("lead_state"),
      // Video Conference Settings
      meetingPlatform: text2("meeting_platform").notNull().default("zoom"),
      // zoom, whereby, twilio, teams
      meetingLink: text2("meeting_link"),
      // Generic meeting link for any platform
      meetingData: jsonb("meeting_data"),
      // JSON object containing platform-specific meeting details
      // Zoom Meeting Settings
      zoomMeetingId: text2("zoom_meeting_id"),
      zoomPassword: text2("zoom_password"),
      zoomJoinUrl: text2("zoom_join_url"),
      // Whereby Meeting Settings
      wherebyRoomUrl: text2("whereby_room_url"),
      wherebyHostRoomUrl: text2("whereby_host_room_url"),
      wherebyMeetingId: text2("whereby_meeting_id"),
      // Twilio Video Settings
      twilioRoomName: text2("twilio_room_name"),
      // Appointment Status and Management
      status: text2("status").notNull().default("scheduled"),
      // scheduled, confirmed, rescheduled, cancelled, completed, no-show
      confirmationStatus: text2("confirmation_status").default("pending"),
      // pending, confirmed, declined
      remindersSent: integer2("reminders_sent").default(0),
      // Communication
      notes: text2("notes"),
      internalNotes: text2("internal_notes"),
      // Agent-only notes
      // Google Calendar Integration
      googleCalendarEventId: text2("google_calendar_event_id"),
      // Google Calendar event ID for sync
      googleCalendarSyncStatus: text2("google_calendar_sync_status").default("pending"),
      // pending, synced, failed
      googleCalendarSyncedAt: timestamp2("google_calendar_synced_at"),
      googleCalendarHtmlLink: text2("google_calendar_html_link"),
      // Direct link to Google Calendar event
      googleCalendarSyncError: text2("google_calendar_sync_error"),
      // Error message if sync fails
      // Timestamps
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow(),
      cancelledAt: timestamp2("cancelled_at"),
      completedAt: timestamp2("completed_at")
    });
    userExperience = pgTable2("user_experience", {
      id: serial("id").primaryKey(),
      email: text2("email").notNull().unique(),
      totalExperience: integer2("total_experience").notNull().default(0),
      level: integer2("level").notNull().default(1),
      experienceToNextLevel: integer2("experience_to_next_level").notNull().default(100),
      connectsReviewed: integer2("connects_reviewed").notNull().default(0),
      salesMade: integer2("sales_made").notNull().default(0),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    warMetrics = pgTable2("war_metrics", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      agentName: text2("agent_name").notNull(),
      teamName: text2("team_name").notNull().default("Default Team"),
      reportDate: timestamp2("report_date").notNull(),
      // The specific day this metrics entry is for
      marketType: text2("market_type").notNull(),
      // "plus", "veteran", "globe", "willkit"
      // Daily metrics: D-R-B-A-P-S-ALP
      dials: integer2("dials").notNull().default(0),
      // D - Calls made
      reached: integer2("reached").notNull().default(0),
      // R - Connected calls
      booked: integer2("booked").notNull().default(0),
      // B - Appointments booked
      appointments: integer2("appointments").notNull().default(0),
      // A - Appointments kept
      presentations: integer2("presentations").notNull().default(0),
      // P - Presentations given
      sales: integer2("sales").notNull().default(0),
      // S - Sales closed
      alp: decimal("alp", { precision: 10, scale: 2 }).notNull().default("0.00"),
      // ALP - Annualized Life Premium
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    warTeams = pgTable2("war_teams", {
      id: serial("id").primaryKey(),
      teamName: text2("team_name").notNull().unique(),
      teamLeader: text2("team_leader").notNull(),
      description: text2("description"),
      createdAt: timestamp2("created_at").defaultNow()
    });
    warTeamMembers = pgTable2("war_team_members", {
      id: serial("id").primaryKey(),
      teamName: text2("team_name").notNull(),
      agentEmail: text2("agent_email").notNull(),
      agentName: text2("agent_name").notNull(),
      role: text2("role").notNull().default("agent"),
      // "agent", "team_leader", "supervisor"
      joinedAt: timestamp2("joined_at").defaultNow()
    });
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true,
      agentName: true
    });
    insertAgentProfileSchema = createInsertSchema(agentProfiles).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    agentProfileSchema = insertAgentProfileSchema;
    masterlead = pgTable2("masterlead", {
      id: serial("id").primaryKey(),
      firstName: text2("first_name"),
      lastName: text2("last_name"),
      phone: text2("phone"),
      email: text2("email"),
      address: text2("address"),
      city: text2("city"),
      state: text2("state"),
      zip: text2("zip"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow(),
      lastContacted: timestamp2("last_contacted"),
      dnc: boolean2("dnc").default(false),
      status: text2("status").default("pending"),
      dispositionNotes: text2("disposition_notes"),
      isLiveCall: boolean2("is_live_call").default(false),
      liveCallPriority: integer2("live_call_priority").default(1),
      assignedAgentEmail: text2("assigned_agent_email"),
      taalkSponsorOrg: text2("taalk_sponsor_org"),
      taalkMarket: text2("taalk_market"),
      taalkLeadSource: text2("taalk_lead_source"),
      taalkState: text2("taalk_state"),
      taalkReffered: text2("taalk_reffered"),
      taalkRelationship: text2("taalk_relationship"),
      taalkSecretkey: text2("taalk_secretkey"),
      taalkGroupCode: text2("taalk_group_code"),
      taalkLeadId: text2("taalk_lead_id"),
      taalkEmail: text2("taalk_email"),
      taalkCity: text2("taalk_city"),
      taalkGroupname: text2("taalk_groupname"),
      taalkBeneficiary: text2("taalk_beneficiary"),
      taalkAddress: text2("taalk_address"),
      cnEmail: text2("cn_email"),
      cnresolution: text2("cnresolution").default("pending"),
      appointmentDate: timestamp2("appointment_date"),
      // APPTTIME - appointment date/time
      saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }),
      // ALP - sale amount
      isHotLead: boolean2("is_hot_lead").default(false),
      priorityScore: integer2("priority_score").default(1),
      associateId: integer2("associate_id"),
      // Associate ID for lead assignment
      aoLeadBox: text2("ao_lead_box"),
      // Lead pool category for My Leads queue
      aoLeadBoxOwners: text2("ao_lead_box_owners"),
      // Owner email(s) for AO lead boxes (like cn_email but for lead boxes)
      dateOfBirth: text2("date_of_birth")
      // Date of birth (text field for display/capture)
    });
    masterleadrecruit = pgTable2("masterleadrecruit", {
      id: serial("id").primaryKey(),
      // Link to source candidate record
      candidateId: integer2("candidate_id").references(() => recruitCandidates.id, { onDelete: "cascade" }),
      // Basic candidate info (denormalized for performance)
      firstName: text2("first_name"),
      lastName: text2("last_name"),
      phone: text2("phone").notNull(),
      email: text2("email"),
      city: text2("city"),
      state: text2("state"),
      zip: text2("zip"),
      address: text2("address"),
      // Assignment and status tracking (same as masterlead)
      cnEmail: text2("cn_email"),
      // Assigned agent email (NULL = unassigned)
      cnresolution: text2("cnresolution").default("pending"),
      // Status: pending, called, booked, etc.
      assignedDate: timestamp2("assigned_date"),
      // When candidate was assigned to agent
      previousCnEmail: text2("previous_cn_email"),
      // Previous agent assignment (for rotation)
      lastAssignedDate: timestamp2("last_assigned_date"),
      // Last assignment timestamp
      currentlyCalling: boolean2("currently_calling").default(false),
      // Flag for active calls
      // Call tracking
      lastContacted: timestamp2("last_contacted"),
      dnc: boolean2("dnc").default(false),
      // Do Not Call flag
      // Market/context
      market: text2("market").default("aorecruit"),
      // Always 'aorecruit' for recruit candidates
      // Recruit hotlead (high-priority candidate, like masterlead is_hot_lead)
      isHotLead: boolean2("is_hot_lead").default(false),
      // Timestamps
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    veteranLeads = pgTable2("veteran_leads", {
      id: serial("id").primaryKey(),
      firstName: text2("first_name").notNull(),
      lastName: text2("last_name").notNull(),
      phone: text2("phone").notNull(),
      email: text2("email"),
      city: text2("city"),
      state: text2("state"),
      zip: text2("zip"),
      address: text2("address"),
      createdAt: timestamp2("created_at"),
      updatedAt: timestamp2("updated_at"),
      calledAt: timestamp2("called_at"),
      dnc: boolean2("dnc").default(false),
      tryCount: integer2("try_count").default(0),
      answered: boolean2("answered").default(false),
      hasSentSMS: boolean2("has_sent_sms").default(false),
      hasOpenLink: boolean2("has_open_link").default(false),
      hasRedirectCall: boolean2("has_redirect_call").default(false),
      duration: integer2("duration"),
      durationAfterTransfer: integer2("duration_after_transfer"),
      hasSummary: boolean2("has_summary").default(false),
      // Call disposition tracking
      callDisposition: text2("call_disposition"),
      // 'no_answer_vm', 'booked', 'call_back', 'not_interested', 'medically_uninsurable', 'already_been_sold', 'duplicate', 'do_not_call'
      dispositionNotes: text2("disposition_notes"),
      dispositionTimestamp: timestamp2("disposition_timestamp"),
      // Taalk integration fields
      taalkSponsorOrg: text2("taalk_sponsor_org"),
      taalkMarket: text2("taalk_market"),
      taalkLeadSource: text2("taalk_lead_source"),
      taalkState: text2("taalk_state"),
      taalkReferred: text2("taalk_referred"),
      taalkRelationship: text2("taalk_relationship"),
      taalkSecretKey: text2("taalk_secret_key"),
      taalkGroupCode: text2("taalk_group_code"),
      taalkLeadId: text2("taalk_lead_id"),
      taalkCity: text2("taalk_city"),
      taalkEmail: text2("taalk_email"),
      taalkZip: text2("taalk_zip"),
      taalkAddress: text2("taalk_address")
    });
    insertVeteranLeadSchema = createInsertSchema(veteranLeads).omit({
      id: true
    });
    incomingLeads = pgTable2("incoming_leads", {
      id: serial("id").primaryKey(),
      firstName: varchar2("first_name", { length: 255 }).notNull(),
      lastName: varchar2("last_name", { length: 255 }).notNull(),
      referrer: varchar2("referrer", { length: 255 }),
      phone: varchar2("phone", { length: 20 }).notNull(),
      email: varchar2("email", { length: 255 }),
      address1: varchar2("address_1", { length: 500 }),
      city: varchar2("city", { length: 255 }),
      state: varchar2("state", { length: 10 }),
      postalCode: varchar2("postal_code", { length: 20 }),
      language: varchar2("language", { length: 10 }).default("1"),
      cost: varchar2("cost", { length: 20 }),
      gender: varchar2("gender", { length: 20 }),
      querystring: text2("querystring"),
      status: varchar2("status", { length: 50 }).default("new").notNull(),
      assignedAgent: varchar2("assigned_agent", { length: 255 }),
      createdAt: timestamp2("created_at").defaultNow().notNull(),
      processedAt: timestamp2("processed_at")
    });
    insertIncomingLeadSchema = createInsertSchema(incomingLeads).omit({
      id: true,
      createdAt: true,
      processedAt: true
    });
    insertOutboundCallSchema = createInsertSchema(outboundCalls).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertCallCenterEventSchema = createInsertSchema(callCenterEvents).omit({
      id: true,
      timestamp: true
    });
    insertAgentMetricsSchema = createInsertSchema(agentMetrics).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertWarMetricsSchema = createInsertSchema(warMetrics).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertWarTeamSchema = createInsertSchema(warTeams).omit({
      id: true,
      createdAt: true
    });
    insertWarTeamMemberSchema = createInsertSchema(warTeamMembers).omit({
      id: true,
      joinedAt: true
    });
    insertCallTrackerSchema = createInsertSchema(callTracker).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertVerificationSessionSchema = createInsertSchema(verificationSessions).omit({
      id: true,
      sessionId: true,
      createdAt: true,
      completedAt: true,
      initiatedAt: true,
      // Auto-generated timestamp
      callCompletedAt: true,
      // Auto-generated timestamp
      lastPolledAt: true
      // Auto-generated timestamp
    }).extend({
      verificationMethod: z.enum(["zoom", "phone", "whatsapp", "facetime"])
    });
    clientInfoSchema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string(),
      city: z.string(),
      state: z.string(),
      country: z.string().optional().default("USA"),
      // Add country field for Canada support
      premium: z.string(),
      language: z.string().default("en"),
      verificationMethod: z.enum(["zoom", "phone", "whatsapp", "facetime"]),
      spouseName: z.string().optional(),
      agentPhone: z.string().optional(),
      agentFirstName: z.string().optional(),
      agentLastName: z.string().optional(),
      associateId: z.number().optional(),
      achDrawDate: z.string().optional(),
      achDrawDateShort: z.string().optional(),
      zoomRoomId: z.string().optional(),
      zoomPassword: z.string().optional()
    });
    methodSelectionSchema = z.object({
      sessionId: z.string(),
      verificationMethod: z.enum(["zoom", "phone", "whatsapp", "facetime"])
    });
    screenshotUploadSchema = z.object({
      sessionId: z.string(),
      screenshotPath: z.string()
    });
    smsVerificationSchema = z.object({
      sessionId: z.string(),
      phone: z.string()
    });
    clientApprovalSchema = z.object({
      sessionId: z.string(),
      verificationCode: z.string(),
      approved: z.boolean(),
      ipAddress: z.string().optional(),
      location: z.string().optional(),
      userAgent: z.string().optional(),
      timezone: z.string().optional()
    });
    insertWarConnectSchema = createInsertSchema(warConnects);
    insertAppointmentSchema = createInsertSchema(appointments).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      cancelledAt: true,
      completedAt: true
    });
    updateAppointmentSchema = insertAppointmentSchema.partial().extend({
      id: z.number()
    });
    appointmentQuerySchema = z.object({
      agentEmail: z.string().optional(),
      leadId: z.string().optional(),
      status: z.enum(["scheduled", "confirmed", "rescheduled", "cancelled", "completed", "no-show"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      appointmentType: z.enum(["consultation", "follow-up", "presentation", "closing"]).optional()
    });
    insertWarSubmissionSchema = createInsertSchema(warSubmissions);
    appointmentReviews = pgTable2("appointment_reviews", {
      id: serial("id").primaryKey(),
      appointmentId: integer2("appointment_id").references(() => appointments.id).notNull(),
      agentEmail: text2("agent_email").notNull(),
      // Appointment outcome
      outcome: text2("outcome").notNull(),
      // 'sale', 'interested', 'not_interested', 'no_show', 'reschedule'
      saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }),
      // Premium amount for sales
      notes: text2("notes"),
      // Follow-up information
      followUpDate: timestamp2("follow_up_date"),
      followUpNotes: text2("follow_up_notes"),
      // System tracking
      reviewedAt: timestamp2("reviewed_at").defaultNow(),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    insertAppointmentReviewSchema = createInsertSchema(appointmentReviews).omit({
      id: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true
    });
    insertWalkthroughVideoSchema = createInsertSchema(walkthroughVideos).omit({ id: true, createdAt: true, updatedAt: true });
    insertWalkthroughProgressSchema = createInsertSchema(walkthroughProgress).omit({ id: true, createdAt: true, updatedAt: true });
    insertWalkthroughCompletionSchema = createInsertSchema(walkthroughCompletion).omit({ id: true, createdAt: true, updatedAt: true });
    dailyAccountability = pgTable2("daily_accountability", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      accountabilityDate: timestamp2("accountability_date").notNull(),
      // The date they're reporting on (previous day)
      hasCompletedReport: boolean2("has_completed_report").default(false),
      totalAppointments: integer2("total_appointments").default(0),
      appointmentsReported: integer2("appointments_reported").default(0),
      totalSales: integer2("total_sales").default(0),
      totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0.00"),
      notes: text2("notes"),
      submittedAt: timestamp2("submitted_at"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    appointmentOutcomes = pgTable2("appointment_outcomes", {
      id: serial("id").primaryKey(),
      accountabilityId: integer2("accountability_id").references(() => dailyAccountability.id).notNull(),
      appointmentId: integer2("appointment_id").notNull(),
      appointmentTitle: text2("appointment_title").notNull(),
      leadName: text2("lead_name").notNull(),
      outcome: text2("outcome").notNull(),
      // 'pending', 'sale', 'refused', 'cannot_afford', 'thinker', 'medically_uninsurable', 'no_need', 'no_show', 'reschedule'
      saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).default("0.00"),
      notes: text2("notes"),
      agentEmail: text2("agent_email").notNull(),
      reportedAt: timestamp2("reported_at").defaultNow(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    agentAccessControl = pgTable2("agent_access_control", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull().unique(),
      lastAccountabilityDate: timestamp2("last_accountability_date"),
      isBlocked: boolean2("is_blocked").default(false),
      blockedReason: text2("blocked_reason"),
      nextRequiredAccountabilityDate: timestamp2("next_required_accountability_date"),
      consecutiveDaysCompleted: integer2("consecutive_days_completed").default(0),
      totalAccountabilityReports: integer2("total_accountability_reports").default(0),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    insertDailyAccountabilitySchema = createInsertSchema(dailyAccountability).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertAgentAccessControlSchema = createInsertSchema(agentAccessControl).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertAppointmentOutcomeSchema = createInsertSchema(appointmentOutcomes).omit({
      id: true,
      reportedAt: true,
      createdAt: true
    });
    insertCallDispositionInconsistencySchema = createInsertSchema(callDispositionInconsistencies).omit({
      id: true,
      createdAt: true
    });
    insertLeadCampaignSchema = createInsertSchema(leadCampaigns).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    outboundCallHistory = pgTable2("outbound_call_history", {
      id: serial("id").primaryKey(),
      leadPhone: varchar2("lead_phone", { length: 20 }).notNull(),
      leadName: varchar2("lead_name", { length: 255 }),
      leadState: varchar2("lead_state", { length: 10 }),
      agentEmail: varchar2("agent_email", { length: 255 }).notNull(),
      agentName: varchar2("agent_name", { length: 255 }),
      callSid: varchar2("call_sid", { length: 255 }),
      conferenceName: varchar2("conference_name", { length: 255 }),
      localPresenceNumber: varchar2("local_presence_number", { length: 20 }),
      callStatus: varchar2("call_status", { length: 50 }).default("initiated"),
      callDisposition: varchar2("call_disposition", { length: 100 }),
      callDuration: integer2("call_duration").default(0),
      callAttempts: integer2("call_attempts").default(1),
      lastContactedAt: timestamp2("last_contacted_at").defaultNow(),
      startTime: timestamp2("start_time").defaultNow(),
      answerTime: timestamp2("answer_time"),
      endTime: timestamp2("end_time"),
      createdAt: timestamp2("created_at").defaultNow(),
      notes: text2("notes")
    });
    inboundCallRouting = pgTable2("inbound_call_routing", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      callerPhone: varchar2("caller_phone", { length: 20 }).notNull(),
      incomingCallSid: varchar2("incoming_call_sid", { length: 255 }),
      routedToAgent: varchar2("routed_to_agent", { length: 255 }),
      routingReason: varchar2("routing_reason", { length: 100 }),
      // "callback", "new_caller", "manual_assignment"
      conferenceName: varchar2("conference_name", { length: 255 }),
      callStartTime: timestamp2("call_start_time").defaultNow(),
      callEndTime: timestamp2("call_end_time"),
      callDuration: integer2("call_duration"),
      callStatus: varchar2("call_status", { length: 50 }).default("active"),
      notes: text2("notes")
    });
    teams = pgTable2("teams", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      name: text2("name").notNull(),
      description: text2("description"),
      managerId: text2("manager_id"),
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    roles = pgTable2("roles", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      name: text2("name").notNull().unique(),
      description: text2("description"),
      permissions: jsonb("permissions").default(sql2`'[]'::jsonb`),
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    connectnowUsers = pgTable2("connectnow_users", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      email: text2("email").notNull().unique(),
      firstName: text2("first_name"),
      lastName: text2("last_name"),
      profileImageUrl: text2("profile_image_url"),
      supabaseUserId: text2("supabase_user_id").unique(),
      isAdmin: boolean2("is_admin").default(false),
      isActive: boolean2("is_active").default(true),
      teamId: text2("team_id"),
      roleId: text2("role_id"),
      creditsRemaining: integer2("credits_remaining").default(0),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    qualityManagerRoles = pgTable2("quality_manager_roles", {
      id: serial("id").primaryKey(),
      email: text2("email").notNull().unique(),
      isActive: boolean2("is_active").default(true),
      assignedBy: text2("assigned_by"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    mgaTeams = pgTable2("mga_teams", {
      id: serial("id").primaryKey(),
      name: text2("name").notNull().unique(),
      description: text2("description"),
      teamType: varchar2("team_type", { length: 10 }).default("MGA"),
      // "MGA" or "RGA"
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    qualityManagerAssignments = pgTable2("quality_manager_assignments", {
      id: serial("id").primaryKey(),
      qmEmail: text2("qm_email").notNull(),
      mgaTeamId: integer2("mga_team_id").references(() => mgaTeams.id).notNull(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    callUsageTracking = pgTable2("call_usage_tracking", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      userId: text2("user_id").notNull(),
      userEmail: text2("user_email").notNull(),
      callType: varchar2("call_type", { length: 20 }).notNull(),
      // "voice", "video", "conference"
      callId: varchar2("call_id", { length: 255 }).notNull(),
      // Twilio CallSid or Whereby meeting ID
      leadPhone: varchar2("lead_phone", { length: 20 }),
      leadName: varchar2("lead_name", { length: 255 }),
      startTime: timestamp2("start_time").notNull(),
      endTime: timestamp2("end_time"),
      durationSeconds: integer2("duration_seconds").default(0),
      durationMinutes: decimal("duration_minutes", { precision: 10, scale: 2 }).default("0.00"),
      creditsCharged: decimal("credits_charged", { precision: 10, scale: 4 }).default("0.0000"),
      billingRate: decimal("billing_rate", { precision: 10, scale: 4 }).default("0.0167"),
      // $1/hour = ~$0.0167/minute
      totalCost: decimal("total_cost", { precision: 10, scale: 4 }).default("0.0000"),
      billingStatus: varchar2("billing_status", { length: 20 }).default("pending"),
      // "pending", "charged", "failed"
      platform: varchar2("platform", { length: 50 }),
      // "twilio", "whereby", "aoi-meet"
      metadata: jsonb("metadata").default(sql2`'{}'::jsonb`),
      // Additional call details
      createdAt: timestamp2("created_at").defaultNow(),
      billedAt: timestamp2("billed_at")
    });
    videoMeetingTracking = pgTable2("video_meeting_tracking", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      userId: text2("user_id").notNull(),
      userEmail: text2("user_email").notNull(),
      meetingId: varchar2("meeting_id", { length: 255 }).notNull(),
      meetingType: varchar2("meeting_type", { length: 20 }).notNull(),
      // "whereby", "zoom", "aoi-meet"
      roomUrl: text2("room_url"),
      hostRoomUrl: text2("host_room_url"),
      leadName: varchar2("lead_name", { length: 255 }),
      leadPhone: varchar2("lead_phone", { length: 20 }),
      startTime: timestamp2("start_time").notNull(),
      endTime: timestamp2("end_time"),
      durationSeconds: integer2("duration_seconds").default(0),
      durationMinutes: decimal("duration_minutes", { precision: 10, scale: 2 }).default("0.00"),
      participantCount: integer2("participant_count").default(1),
      maxParticipants: integer2("max_participants").default(1),
      creditsCharged: decimal("credits_charged", { precision: 10, scale: 4 }).default("0.0000"),
      billingRate: decimal("billing_rate", { precision: 10, scale: 4 }).default("0.0167"),
      // $1/hour = ~$0.0167/minute
      totalCost: decimal("total_cost", { precision: 10, scale: 4 }).default("0.0000"),
      billingStatus: varchar2("billing_status", { length: 20 }).default("pending"),
      metadata: jsonb("metadata").default(sql2`'{}'::jsonb`),
      createdAt: timestamp2("created_at").defaultNow(),
      billedAt: timestamp2("billed_at")
    });
    userCredits = pgTable2("user_credits", {
      id: uuid("id").primaryKey().default(sql2`gen_random_uuid()`),
      email: text2("email").notNull().unique(),
      name: text2("name"),
      externalId: text2("external_id"),
      stripeId: text2("stripe_id"),
      stripeCreated: text2("stripe_created"),
      totalSpend: decimal("total_spend"),
      paymentCount: integer2("payment_count"),
      refunded: decimal("refunded"),
      creditsPurchased: integer2("credits_purchased").default(0),
      creditsUsed: integer2("credits_used").default(0),
      needsAdditionalCredits: integer2("needs_additional_credits"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow(),
      associateId: text2("associate_id"),
      manualAdjustments: integer2("manual_adjustments").default(0),
      creditsRemaining: integer2("credits_remaining").default(0),
      autoRefillEnabled: boolean2("auto_refill_enabled").default(false),
      refillAmount: integer2("refill_amount").default(0),
      threshold: integer2("threshold").default(0),
      zeroCreditsNotified: boolean2("zero_credits_notified").default(false),
      aoiConnectCreditsUsed: integer2("aoi_connect_credits_used").default(0),
      aoiPlusCreditsUsed: integer2("aoi_plus_credits_used").default(0),
      aoiPrecheckCreditsUsed: integer2("aoi_precheck_credits_used").default(0),
      aoiRecruitCreditsUsed: integer2("aoi_recruit_credits_used").default(0),
      aoiPlusOptedIn: boolean2("aoi_plus_opted_in").default(false),
      aoiRecruitOptedIn: boolean2("aoi_recruit_opted_in").default(false),
      aoiConnectOptedIn: boolean2("aoi_connect_opted_in").default(false)
    });
    incomingCalls = pgTable2("incoming_calls", {
      id: serial("id").primaryKey(),
      userId: text2("user_id").notNull(),
      callerNumber: text2("caller_number"),
      twilioCallSid: text2("twilio_call_sid"),
      assignedAgentEmail: text2("assigned_agent_email"),
      status: text2("status"),
      // 'ringing', 'answered', 'declined', 'completed', 'missed'
      callType: text2("call_type").default("inbound"),
      // 'VDP', 'inbound', 'support'
      leadName: text2("lead_name"),
      leadCity: text2("lead_city"),
      leadState: text2("lead_state"),
      duration: integer2("duration"),
      notes: text2("notes"),
      createdAt: timestamp2("created_at").defaultNow(),
      answeredAt: timestamp2("answered_at"),
      endedAt: timestamp2("ended_at")
    });
    userGameStats = pgTable2("user_game_stats", {
      id: serial("id").primaryKey(),
      userId: text2("user_id").notNull().unique(),
      level: integer2("level").default(1),
      xp: integer2("xp").default(0),
      totalCalls: integer2("total_calls").default(0),
      successfulCalls: integer2("successful_calls").default(0),
      streak: integer2("streak").default(0),
      achievements: jsonb("achievements").default(sql2`'[]'::jsonb`),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    leaderboard = pgTable2("leaderboard", {
      id: serial("id").primaryKey(),
      userId: text2("user_id").notNull(),
      period: text2("period"),
      // 'daily', 'weekly', 'monthly'
      metric: text2("metric"),
      // 'calls', 'sales', 'xp'
      value: integer2("value"),
      rank: integer2("rank"),
      createdAt: timestamp2("created_at").defaultNow()
    });
    teamsRelations = relations(teams, ({ one, many }) => ({
      manager: one(connectnowUsers, {
        fields: [teams.managerId],
        references: [connectnowUsers.id]
      }),
      members: many(connectnowUsers)
    }));
    rolesRelations = relations(roles, ({ many }) => ({
      users: many(connectnowUsers)
    }));
    connectnowUsersRelations = relations(connectnowUsers, ({ one, many }) => ({
      team: one(teams, {
        fields: [connectnowUsers.teamId],
        references: [teams.id]
      }),
      role: one(roles, {
        fields: [connectnowUsers.roleId],
        references: [roles.id]
      }),
      callLogs: many(callLogs),
      vdpCalls: many(vdpCalls),
      incomingCalls: many(incomingCalls),
      gameStats: one(userGameStats, {
        fields: [connectnowUsers.id],
        references: [userGameStats.userId]
      })
    }));
    callLogsRelations = relations(callLogs, ({ one }) => ({
      // No relations for now - keeping it simple
    }));
    vdpCallsRelations = relations(vdpCalls, ({ one }) => ({
      // No user relation - VDP calls don't have userId field
    }));
    incomingCallsRelations = relations(incomingCalls, ({ one }) => ({
      user: one(connectnowUsers, {
        fields: [incomingCalls.userId],
        references: [connectnowUsers.id]
      })
    }));
    userGameStatsRelations = relations(userGameStats, ({ one }) => ({
      user: one(connectnowUsers, {
        fields: [userGameStats.userId],
        references: [connectnowUsers.id]
      })
    }));
    insertTeamSchema = createInsertSchema(teams).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertRoleSchema = createInsertSchema(roles).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertConnectNowUserSchema = createInsertSchema(connectnowUsers).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertCallLogSchema = createInsertSchema(callLogs).omit({
      id: true,
      createdAt: true
    });
    insertVdpCallSchema = createInsertSchema(vdpCalls).omit({
      id: true,
      createdAt: true
    });
    adminRoles = pgTable2("admin_roles", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      name: text2("name").notNull().unique(),
      displayName: text2("display_name").notNull(),
      description: text2("description"),
      permissions: jsonb("permissions").default(sql2`'[]'::jsonb`),
      level: integer2("level").default(0),
      // 0=agent, 1=manager, 2=admin, 3=super_admin
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    userRoles = pgTable2("user_roles", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      userEmail: text2("user_email").notNull(),
      roleId: text2("role_id").notNull(),
      assignedBy: text2("assigned_by"),
      assignedAt: timestamp2("assigned_at").defaultNow(),
      isActive: boolean2("is_active").default(true)
    });
    adminLogs = pgTable2("admin_logs", {
      id: serial("id").primaryKey(),
      adminEmail: text2("admin_email").notNull(),
      action: text2("action").notNull(),
      targetUserId: text2("target_user_id"),
      targetUserEmail: text2("target_user_email"),
      details: jsonb("details"),
      ipAddress: text2("ip_address"),
      userAgent: text2("user_agent"),
      createdAt: timestamp2("created_at").defaultNow()
    });
    insertAdminRoleSchema = createInsertSchema(adminRoles).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertUserRoleSchema = createInsertSchema(userRoles).omit({
      id: true,
      assignedAt: true
    });
    insertAdminLogSchema = createInsertSchema(adminLogs).omit({
      id: true,
      createdAt: true
    });
    insertFeedbackReportSchema = createInsertSchema(feedbackReports).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertRecruitCandidateSchema = createInsertSchema(recruitCandidates).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    updateRecruitCandidateSchema = createInsertSchema(recruitCandidates).omit({
      id: true,
      createdAt: true,
      agentId: true,
      agentEmail: true
    }).partial();
    insertCallUsageTrackingSchema = createInsertSchema(callUsageTracking).omit({
      id: true,
      createdAt: true,
      billedAt: true
    });
    insertVideoMeetingTrackingSchema = createInsertSchema(videoMeetingTracking).omit({
      id: true,
      createdAt: true,
      billedAt: true
    });
    userSessions = pgTable2("user_sessions", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull(),
      sessionId: text2("session_id").notNull().unique(),
      // UUID for session tracking
      loginTime: timestamp2("login_time").notNull().defaultNow(),
      logoutTime: timestamp2("logout_time"),
      // Null until logout
      sessionDuration: integer2("session_duration"),
      // Duration in seconds
      ipAddress: text2("ip_address"),
      userAgent: text2("user_agent"),
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow()
    });
    pageActivityLogs = pgTable2("page_activity_logs", {
      id: serial("id").primaryKey(),
      sessionId: text2("session_id").notNull(),
      // Links to user_sessions
      userEmail: text2("user_email").notNull(),
      pagePath: text2("page_path").notNull(),
      // e.g., "/dashboard/aoi", "/call-connector-pro"
      pageTitle: text2("page_title"),
      // Human readable page name
      timeSpent: integer2("time_spent"),
      // Time spent on page in seconds
      visitedAt: timestamp2("visited_at").notNull().defaultNow(),
      leftAt: timestamp2("left_at")
      // When they left the page
    });
    featureUsageLogs = pgTable2("feature_usage_logs", {
      id: serial("id").primaryKey(),
      sessionId: text2("session_id").notNull(),
      userEmail: text2("user_email").notNull(),
      featureName: text2("feature_name").notNull(),
      // e.g., "vdp_call", "call_connector_pro", "billing_report"
      action: text2("action").notNull(),
      // e.g., "started", "completed", "clicked", "viewed"
      metadata: jsonb("metadata"),
      // Additional context data
      timestamp: timestamp2("timestamp").notNull().defaultNow()
    });
    dailyUserStats = pgTable2("daily_user_stats", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull(),
      date: text2("date").notNull(),
      // YYYY-MM-DD format
      totalSessionTime: integer2("total_session_time").default(0),
      // Total seconds online
      pageViews: integer2("page_views").default(0),
      // Number of page visits
      featuresUsed: jsonb("features_used").default(sql2`'[]'::jsonb`),
      // Array of features accessed
      callsMade: integer2("calls_made").default(0),
      // Number of calls made
      vdpConnects: integer2("vdp_connects").default(0),
      // VDP connects made
      lastActivity: timestamp2("last_activity"),
      createdAt: timestamp2("created_at").defaultNow()
    });
    insertUserSessionSchema = createInsertSchema(userSessions).omit({
      id: true,
      createdAt: true
    });
    insertPageActivityLogSchema = createInsertSchema(pageActivityLogs).omit({
      id: true
    });
    insertFeatureUsageLogSchema = createInsertSchema(featureUsageLogs).omit({
      id: true
    });
    insertDailyUserStatsSchema = createInsertSchema(dailyUserStats).omit({
      id: true,
      createdAt: true
    });
    insertRolePagePermissionSchema = createInsertSchema(rolePagePermissions).omit({
      createdAt: true,
      updatedAt: true
    });
    insertQualityManagerTeamAssignmentSchema = createInsertSchema(qualityManagerTeamAssignments).omit({
      id: true,
      createdAt: true
    });
    DEFAULT_PAGE_PERMISSIONS = {
      system_admin: [...PAGE_KEYS],
      // System admin gets access to all pages
      rga: ["billing-dashboard", "aoi-report", "appointments", "ao-recruit", "ao-precheck", "settings", "ao-intelligence", "ao-connect", "admin", "user-management", "teams-management"],
      // RGA gets broad access
      mga: ["billing-dashboard", "aoi-report", "appointments", "ao-recruit", "ao-precheck", "settings", "ao-intelligence", "ao-connect", "teams-management"],
      // MGA gets team management access
      agent: ["billing-dashboard", "aoi-report", "appointments", "ao-recruit", "ao-precheck", "settings", "ao-intelligence", "ao-connect"],
      // Agent access as requested
      quality_manager: ["settings", "ao-precheck-management"],
      // Quality manager limited access as requested
      ao_quality_manager: ["settings", "ao-precheck-management", "aoi-report", "ao-intelligence"]
      // AO Quality Manager with AO-focused access
    };
  }
});

// server/db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
function getQueryText(args) {
  const first = args[0];
  if (typeof first === "string") return first;
  if (first && typeof first.text === "string") return first.text;
  return "";
}
function isLowPriorityDbQuery(queryText) {
  const normalized = queryText.toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("leasedialer") || normalized.includes("agent_routing_profiles")) return false;
  return normalized.includes("twilio_call_logs") || normalized.includes("agent_dial_metrics") || normalized.includes("agent_daily_stats") || normalized.includes("webhook_sent_at") || normalized.includes("with plus_ml as");
}
async function runLowPriorityDbQuery(operation) {
  const queuedAt = Date.now();
  if (lowPriorityDbActive >= LOW_PRIORITY_DB_CONCURRENCY) {
    if (lowPriorityDbQueue.length >= LOW_PRIORITY_DB_MAX_QUEUE) {
      throw new Error(`Low priority DB queue is full (${LOW_PRIORITY_DB_MAX_QUEUE})`);
    }
    await new Promise((resolve) => {
      lowPriorityDbQueue.push(resolve);
    });
  }
  lowPriorityDbActive += 1;
  const waitedMs = Date.now() - queuedAt;
  if (waitedMs > LOW_PRIORITY_DB_WARN_MS && Date.now() - lowPriorityDbLastWarnAt > LOW_PRIORITY_DB_WARN_MS) {
    lowPriorityDbLastWarnAt = Date.now();
    console.error("[DB_LOW_PRIORITY] query waited for slot", {
      waitedMs,
      active: lowPriorityDbActive,
      queued: lowPriorityDbQueue.length,
      concurrency: LOW_PRIORITY_DB_CONCURRENCY
    });
  }
  try {
    return await operation();
  } finally {
    lowPriorityDbActive = Math.max(0, lowPriorityDbActive - 1);
    const next = lowPriorityDbQueue.shift();
    if (next) setImmediate(next);
  }
}
var pool, dispositionWritePool, leaseDialerPool, leaseDialerWorkerPool, nonLeadPool, LOW_PRIORITY_DB_CONCURRENCY, LOW_PRIORITY_DB_MAX_QUEUE, LOW_PRIORITY_DB_WARN_MS, lowPriorityDbActive, lowPriorityDbLastWarnAt, lowPriorityDbQueue, originalPoolQuery, nonLeadPoolQuery, db, dbConnected;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_hardcoded_config();
    init_perf_observability();
    if (!DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 8e3,
      query_timeout: 15e3,
      statement_timeout: 15e3,
      keepAlive: true,
      maxUses: 7500,
      allowExitOnIdle: false
    });
    dispositionWritePool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 1e4,
      query_timeout: 12e4,
      statement_timeout: 12e4,
      keepAlive: true,
      maxUses: 7500,
      allowExitOnIdle: false
    });
    leaseDialerPool = new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 8e3,
      query_timeout: 15e3,
      statement_timeout: 15e3,
      keepAlive: true,
      maxUses: 5e3,
      allowExitOnIdle: false
    });
    leaseDialerWorkerPool = new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 5e3,
      query_timeout: 3e4,
      statement_timeout: 3e4,
      keepAlive: true,
      maxUses: 5e3,
      allowExitOnIdle: false
    });
    nonLeadPool = new Pool({
      connectionString: DATABASE_URL,
      max: Math.max(2, Number(process.env.NON_LEAD_POOL_MAX || 8)),
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 8e3,
      query_timeout: 3e4,
      statement_timeout: 3e4,
      keepAlive: true,
      maxUses: 5e3,
      allowExitOnIdle: false
    });
    LOW_PRIORITY_DB_CONCURRENCY = Math.max(1, Number(process.env.LOW_PRIORITY_DB_CONCURRENCY || 8));
    LOW_PRIORITY_DB_MAX_QUEUE = Math.max(LOW_PRIORITY_DB_CONCURRENCY, Number(process.env.LOW_PRIORITY_DB_MAX_QUEUE || 2e3));
    LOW_PRIORITY_DB_WARN_MS = Math.max(1e3, Number(process.env.LOW_PRIORITY_DB_WARN_MS || 1e4));
    lowPriorityDbActive = 0;
    lowPriorityDbLastWarnAt = 0;
    lowPriorityDbQueue = [];
    originalPoolQuery = pool.query.bind(pool);
    nonLeadPoolQuery = nonLeadPool.query.bind(nonLeadPool);
    pool.query = async (...args) => {
      const start = Date.now();
      try {
        const queryText = getQueryText(args);
        const result = isLowPriorityDbQuery(queryText) ? await runLowPriorityDbQuery(() => nonLeadPoolQuery(...args)) : await originalPoolQuery(...args);
        perfStore.recordDependency("postgres", "pool.query", Date.now() - start, true);
        return result;
      } catch (error) {
        perfStore.recordDependency("postgres", "pool.query", Date.now() - start, false);
        throw error;
      }
    };
    db = drizzle({ client: pool, schema: schema_exports });
    dbConnected = false;
    pool.on("connect", () => {
      console.log("\u{1F517} Database pool connected");
      dbConnected = true;
    });
    pool.on("error", (err) => {
      console.warn("\u26A0\uFE0F Database connection failed - running without database");
      console.warn("Database error:", err.message);
      dbConnected = false;
    });
    pool.on("remove", () => {
      console.log("\u{1F50C} Database connection removed from pool");
    });
    nonLeadPool.on("connect", () => {
      console.log("\u{1F517} Non-lead DB pool connected");
    });
    nonLeadPool.on("error", (err) => {
      console.warn("\u26A0\uFE0F Non-lead DB connection failed");
      console.warn("Non-lead DB error:", err.message);
    });
    nonLeadPool.on("remove", () => {
      console.log("\u{1F50C} Non-lead DB connection removed from pool");
    });
  }
});

// server/local-hot-table-client.ts
function normalizeTable(table) {
  return String(table || "").trim().toLowerCase();
}
function normalizeColumn(column) {
  const clean = String(column || "").trim().replace(/^"+|"+$/g, "");
  if (!clean) return clean;
  if (clean.includes("_") || /[A-Z]/.test(clean)) return clean;
  return clean.toLowerCase();
}
function splitColumns(columns) {
  return String(columns || "*").split(",").map((c) => normalizeColumn(c.trim())).filter(Boolean);
}
function parseOrExpr(expr) {
  return String(expr || "").split(",").map((x) => x.trim()).filter(Boolean);
}
function parseInList(raw) {
  const trimmed = String(raw || "").trim().replace(/^\(/, "").replace(/\)$/, "");
  if (!trimmed) return [];
  return trimmed.split(",").map((x) => x.trim()).filter(Boolean);
}
function qcol(column) {
  return `"${String(column).replace(/"/g, '""')}"`;
}
async function ensureBaseTable(table) {
  const t = normalizeTable(table);
  if (baseReadyByTable.get(t)) return;
  if (!HOT_TABLES.has(t)) throw new Error(`Unsupported local hot table: ${t}`);
  if (t === "twilio_call_logs") {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS twilio_call_logs (
        id BIGSERIAL PRIMARY KEY,
        twilio_call_sid TEXT UNIQUE NOT NULL
      );
    `);
  } else if (t === "agent_dial_metrics") {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_dial_metrics (
        id BIGSERIAL PRIMARY KEY,
        agent_email TEXT,
        lead_phone TEXT,
        event_type TEXT
      );
    `);
  }
  const columns = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = $1`,
    [t]
  );
  const known = new Set(columns.rows.map((r) => String(r.column_name || "")));
  knownColumnsByTable.set(t, known);
  baseReadyByTable.set(t, true);
}
async function ensureColumns(table, columns) {
  const t = normalizeTable(table);
  await ensureBaseTable(t);
  const known = knownColumnsByTable.get(t) || /* @__PURE__ */ new Set();
  for (const col of columns.map((c) => normalizeColumn(c)).filter(Boolean)) {
    if (col === "*") continue;
    if (known.has(col)) continue;
    await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ${qcol(col)} TEXT`);
    known.add(col);
  }
  knownColumnsByTable.set(t, known);
}
var HOT_TABLES, knownColumnsByTable, baseReadyByTable, LocalHotTableBuilder, localHotTableClient;
var init_local_hot_table_client = __esm({
  "server/local-hot-table-client.ts"() {
    "use strict";
    init_db();
    HOT_TABLES = /* @__PURE__ */ new Set(["twilio_call_logs", "agent_dial_metrics"]);
    knownColumnsByTable = /* @__PURE__ */ new Map();
    baseReadyByTable = /* @__PURE__ */ new Map();
    LocalHotTableBuilder = class {
      constructor(tableName) {
        this.tableName = tableName;
      }
      mode = "select";
      selectColumns = "*";
      selectHead = false;
      selectCount = null;
      filters = [];
      orderBys = [];
      limitValue = null;
      offsetValue = null;
      singleType = null;
      updatePayload = null;
      insertPayload = [];
      upsertConflict = "id";
      upsertIgnoreDuplicates = false;
      referencedColumns = /* @__PURE__ */ new Set();
      addFilter(sql5, ...params) {
        this.filters.push({ sql: sql5, params });
        return this;
      }
      whereClause(startIndex = 1) {
        const values = [];
        let idx = startIndex;
        const parts = this.filters.map((f) => {
          const sql5 = f.sql.replace(/\?/g, () => `$${idx++}`);
          values.push(...f.params);
          return `(${sql5})`;
        });
        return {
          sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "",
          values
        };
      }
      select(columns = "*", options) {
        this.mode = this.mode === "update" || this.mode === "insert" || this.mode === "upsert" || this.mode === "delete" ? this.mode : "select";
        this.selectColumns = columns || "*";
        if (this.selectColumns !== "*") splitColumns(this.selectColumns).forEach((c) => this.referencedColumns.add(c));
        this.selectCount = options?.count || null;
        this.selectHead = !!options?.head;
        return this;
      }
      eq(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`${qcol(col)} IS NOT DISTINCT FROM ?`, value);
      }
      neq(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`NOT (${qcol(col)} IS NOT DISTINCT FROM ?)`, value);
      }
      gt(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`${qcol(col)} > ?`, value);
      }
      gte(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`${qcol(col)} >= ?`, value);
      }
      lt(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`${qcol(col)} < ?`, value);
      }
      lte(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`${qcol(col)} <= ?`, value);
      }
      ilike(column, pattern) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`COALESCE(${qcol(col)}::text, '') ILIKE COALESCE(?::text, '')`, pattern);
      }
      in(column, values) {
        if (!Array.isArray(values) || !values.length) return this.addFilter("1=0");
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        const placeholders = values.map(() => "?").join(", ");
        return this.addFilter(`${qcol(col)} IN (${placeholders})`, ...values);
      }
      is(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        if (value === null || String(value).toLowerCase() === "null") return this.addFilter(`${qcol(col)} IS NULL`);
        if (String(value).toLowerCase() === "true") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'true'`);
        if (String(value).toLowerCase() === "false") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'false'`);
        return this.addFilter(`${qcol(col)} IS NOT DISTINCT FROM ?`, value);
      }
      not(column, operator, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        const op = String(operator || "").toLowerCase();
        if (op === "is") {
          if (value === null || String(value).toLowerCase() === "null") return this.addFilter(`${qcol(col)} IS NOT NULL`);
          if (String(value).toLowerCase() === "true") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) <> 'true'`);
          if (String(value).toLowerCase() === "false") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) <> 'false'`);
        }
        if (op === "in") {
          const items = parseInList(String(value || ""));
          if (!items.length) return this;
          const placeholders = items.map(() => "?").join(", ");
          return this.addFilter(`COALESCE(${qcol(col)}::text, '') NOT IN (${placeholders})`, ...items);
        }
        return this.addFilter(`NOT (${qcol(col)} IS NOT DISTINCT FROM ?)`, value);
      }
      contains(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        const payload2 = typeof value === "string" ? value : JSON.stringify(value ?? {});
        return this.addFilter(`${qcol(col)}::jsonb @> ?::jsonb`, payload2);
      }
      or(expr) {
        const parts = parseOrExpr(expr);
        if (!parts.length) return this;
        const sqlParts = [];
        const vals = [];
        for (const part of parts) {
          const segs = part.split(".");
          const col = normalizeColumn(segs[0] || "");
          if (!col) continue;
          this.referencedColumns.add(col);
          const op = String(segs[1] || "eq").toLowerCase();
          const raw = segs.slice(2).join(".");
          const value = raw === "null" ? null : raw;
          if (op === "eq") {
            sqlParts.push(`${qcol(col)} IS NOT DISTINCT FROM ?`);
            vals.push(value);
          } else if (op === "neq") {
            sqlParts.push(`NOT (${qcol(col)} IS NOT DISTINCT FROM ?)`);
            vals.push(value);
          } else if (op === "ilike") {
            sqlParts.push(`COALESCE(${qcol(col)}::text, '') ILIKE COALESCE(?::text, '')`);
            vals.push(value);
          } else if (op === "is") {
            if (value === null) sqlParts.push(`${qcol(col)} IS NULL`);
            else if (String(value).toLowerCase() === "true") sqlParts.push(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'true'`);
            else if (String(value).toLowerCase() === "false") sqlParts.push(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'false'`);
          } else if (op === "in") {
            const items = parseInList(String(value || ""));
            if (!items.length) continue;
            const placeholders = items.map(() => "?").join(", ");
            sqlParts.push(`COALESCE(${qcol(col)}::text, '') IN (${placeholders})`);
            vals.push(...items);
          } else if (op === "gt") {
            sqlParts.push(`${qcol(col)} > ?`);
            vals.push(value);
          } else if (op === "gte") {
            sqlParts.push(`${qcol(col)} >= ?`);
            vals.push(value);
          } else if (op === "lt") {
            sqlParts.push(`${qcol(col)} < ?`);
            vals.push(value);
          } else if (op === "lte") {
            sqlParts.push(`${qcol(col)} <= ?`);
            vals.push(value);
          }
        }
        if (!sqlParts.length) return this;
        return this.addFilter(sqlParts.join(" OR "), ...vals);
      }
      order(column, options) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        this.orderBys.push({
          column: col,
          ascending: options?.ascending !== false,
          nullsFirst: options?.nullsFirst
        });
        return this;
      }
      limit(count) {
        this.limitValue = Math.max(0, Number(count || 0));
        return this;
      }
      range(from, to) {
        const start = Math.max(0, Number(from || 0));
        const end = Math.max(start, Number(to || start));
        this.offsetValue = start;
        this.limitValue = end - start + 1;
        return this;
      }
      single() {
        this.singleType = "single";
        return this.execute();
      }
      maybeSingle() {
        this.singleType = "maybeSingle";
        return this.execute();
      }
      update(payload2) {
        this.mode = "update";
        this.updatePayload = payload2 || {};
        Object.keys(this.updatePayload).forEach((k) => this.referencedColumns.add(normalizeColumn(k)));
        return this;
      }
      insert(payload2) {
        this.mode = "insert";
        this.insertPayload = Array.isArray(payload2) ? payload2 : [payload2];
        this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn(k))));
        return this;
      }
      upsert(payload2, options) {
        this.mode = "upsert";
        this.insertPayload = Array.isArray(payload2) ? payload2 : [payload2];
        this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn(k))));
        this.upsertConflict = normalizeColumn(options?.onConflict || "id");
        this.referencedColumns.add(this.upsertConflict);
        this.upsertIgnoreDuplicates = !!options?.ignoreDuplicates;
        return this;
      }
      delete() {
        this.mode = "delete";
        return this;
      }
      then(onfulfilled, onrejected) {
        return this.execute().then(onfulfilled, onrejected);
      }
      async executeSelect() {
        await ensureColumns(this.tableName, [...this.referencedColumns]);
        const cols = this.selectColumns === "*" ? "*" : splitColumns(this.selectColumns).map((c) => qcol(c)).join(", ");
        const where = this.whereClause(1);
        const order = this.orderBys.length ? ` ORDER BY ${this.orderBys.map((o) => `${qcol(o.column)} ${o.ascending ? "ASC" : "DESC"}${o.nullsFirst === void 0 ? "" : o.nullsFirst ? " NULLS FIRST" : " NULLS LAST"}`).join(", ")}` : "";
        const limit = this.limitValue != null ? ` LIMIT ${this.limitValue}` : "";
        const offset = this.offsetValue != null ? ` OFFSET ${this.offsetValue}` : "";
        let count = null;
        if (this.selectCount === "exact") {
          const c = await pool.query(
            `SELECT COUNT(*)::text AS count FROM ${this.tableName}${where.sql}`,
            where.values
          );
          count = Number(c.rows[0]?.count || 0);
        }
        if (this.selectHead) return { data: null, error: null, count };
        const result = await pool.query(
          `SELECT ${cols} FROM ${this.tableName}${where.sql}${order}${limit}${offset}`,
          where.values
        );
        if (this.singleType === "single") {
          if ((result.rowCount || 0) !== 1) return { data: null, error: { message: "Expected single row" }, count };
          return { data: result.rows[0], error: null, count };
        }
        if (this.singleType === "maybeSingle") return { data: result.rows[0] || null, error: null, count };
        return { data: result.rows, error: null, count };
      }
      buildInsertRows() {
        const rows = this.insertPayload.filter(Boolean);
        const columnSet = /* @__PURE__ */ new Set();
        for (const row of rows) Object.keys(row).forEach((k) => columnSet.add(normalizeColumn(k)));
        const columns = [...columnSet];
        const values = rows.map((row) => columns.map((c) => row[c]));
        return { columns, rows: values };
      }
      async executeUpdateLike() {
        await ensureColumns(this.tableName, [...this.referencedColumns]);
        if (!this.updatePayload) return { data: null, error: { message: "Missing update payload" }, count: null };
        const entries = Object.entries(this.updatePayload);
        if (!entries.length) return { data: null, error: null, count: 0 };
        const setSql = entries.map(([k], i) => `${qcol(normalizeColumn(k))} = $${i + 1}`).join(", ");
        const setVals = entries.map(([, v]) => v);
        const where = this.whereClause(setVals.length + 1);
        const returning = this.selectColumns && this.selectColumns !== "*" ? splitColumns(this.selectColumns).map((c) => qcol(c)).join(", ") : "*";
        const wantsData = this.selectColumns !== "*";
        const sql5 = `UPDATE ${this.tableName} SET ${setSql}${where.sql}${wantsData ? ` RETURNING ${returning}` : ""}`;
        const result = await pool.query(sql5, [...setVals, ...where.values]);
        return { data: wantsData ? result.rows : null, error: null, count: result.rowCount || 0 };
      }
      async executeInsertLike() {
        await ensureColumns(this.tableName, [...this.referencedColumns]);
        const { columns, rows } = this.buildInsertRows();
        if (!columns.length || !rows.length) return { data: null, error: null, count: 0 };
        const values = [];
        let idx = 1;
        const rowSql = rows.map((row) => {
          const ph = row.map(() => `$${idx++}`);
          values.push(...row);
          return `(${ph.join(", ")})`;
        }).join(", ");
        const quotedCols = columns.map((c) => qcol(c)).join(", ");
        let conflictSql = "";
        if (this.mode === "upsert") {
          if (this.upsertIgnoreDuplicates) {
            conflictSql = ` ON CONFLICT (${qcol(this.upsertConflict)}) DO NOTHING`;
          } else {
            const updates = columns.filter((c) => c !== this.upsertConflict).map((c) => `${qcol(c)} = EXCLUDED.${qcol(c)}`).join(", ");
            conflictSql = ` ON CONFLICT (${qcol(this.upsertConflict)}) DO UPDATE SET ${updates || `${qcol(this.upsertConflict)} = EXCLUDED.${qcol(this.upsertConflict)}`}`;
          }
        }
        const returning = this.selectColumns && this.selectColumns !== "*" ? splitColumns(this.selectColumns).map((c) => qcol(c)).join(", ") : "*";
        const wantsData = this.selectColumns !== "*";
        const sql5 = `INSERT INTO ${this.tableName} (${quotedCols}) VALUES ${rowSql}${conflictSql}${wantsData ? ` RETURNING ${returning}` : ""}`;
        const result = await pool.query(sql5, values);
        const data = wantsData ? this.singleType ? result.rows[0] || null : result.rows : null;
        return { data, error: null, count: result.rowCount || 0 };
      }
      async executeDelete() {
        await ensureColumns(this.tableName, [...this.referencedColumns]);
        const where = this.whereClause(1);
        const sql5 = `DELETE FROM ${this.tableName}${where.sql}`;
        const result = await pool.query(sql5, where.values);
        return { data: null, error: null, count: result.rowCount || 0 };
      }
      async execute() {
        try {
          if (this.mode === "select") return await this.executeSelect();
          if (this.mode === "update") return await this.executeUpdateLike();
          if (this.mode === "insert" || this.mode === "upsert") return await this.executeInsertLike();
          if (this.mode === "delete") return await this.executeDelete();
          return { data: null, error: null, count: 0 };
        } catch (error) {
          return { data: null, error: { message: error?.message || String(error) }, count: null };
        }
      }
    };
    localHotTableClient = {
      from(table) {
        const t = normalizeTable(table);
        if (!HOT_TABLES.has(t)) throw new Error(`localHotTableClient unsupported table: ${t}`);
        return new LocalHotTableBuilder(t);
      }
    };
  }
});

// server/supabase.ts
import { createClient } from "@supabase/supabase-js";
function fetchWithConnectBudget(input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input.url || "");
  const method = String(init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") || "GET");
  if (shouldBlockHotTableSupabaseWrite(url, method)) {
    const body = JSON.stringify({
      message: "HOT_TABLE_EOD_ONLY_BLOCKED",
      details: "Runtime writes to twilio_call_logs and agent_dial_metrics are disabled outside 11 PM EOD sync window.",
      method,
      url
    });
    return Promise.resolve(
      new Response(body, {
        status: 409,
        headers: { "Content-Type": "application/json" }
      })
    );
  }
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), SUPABASE_ADMIN_FETCH_MS);
  const timedFetch = wrapFetchWithPerf("supabase-admin-http", fetch);
  return timedFetch(input, { ...init, signal: ac.signal }).finally(() => clearTimeout(id));
}
function patchLocalTableRouting(client) {
  if (!client || typeof client.from !== "function") return;
  const originalFrom = client.from.bind(client);
  client.from = (table) => {
    const t = String(table || "").toLowerCase();
    if (t === "twilio_call_logs" || t === "agent_dial_metrics") {
      return localHotTableClient.from(t);
    }
    return originalFrom(table);
  };
}
var supabaseUrl, supabaseAnonKey, supabaseServiceKey, supabase, SUPABASE_ADMIN_FETCH_MS, supabaseAdminRaw, supabaseAdmin;
var init_supabase = __esm({
  "server/supabase.ts"() {
    "use strict";
    init_hardcoded_config();
    init_perf_observability();
    init_hot_table_write_gate();
    init_local_hot_table_client();
    supabaseUrl = SUPABASE_URL;
    supabaseAnonKey = SUPABASE_ANON_KEY;
    supabaseServiceKey = SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.warn("\u26A0\uFE0F Missing Supabase credentials - Supabase features will be disabled");
      console.warn("Edit server/hardcoded-config.ts (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY)");
      console.warn("URL:", !!supabaseUrl, "Anon Key:", !!supabaseAnonKey, "Service Key:", !!supabaseServiceKey);
    } else {
      console.log("\u2705 Supabase credentials configured properly");
      console.log("\u{1F527} URL:", supabaseUrl.substring(0, 30) + "...");
      console.log("\u{1F527} Key:", supabaseAnonKey.substring(0, 30) + "...");
    }
    supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      db: {
        schema: "public"
      },
      global: {
        fetch: wrapFetchWithPerf("supabase-anon-http", fetch),
        headers: {
          "Prefer": "count=exact"
        }
      }
    }) : null;
    SUPABASE_ADMIN_FETCH_MS = 12e3;
    supabaseAdminRaw = supabaseServiceKey && supabaseUrl ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: "public"
      },
      global: {
        fetch: fetchWithConnectBudget
      }
    }) : null;
    supabaseAdmin = supabaseServiceKey && supabaseUrl ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: "public"
      },
      global: {
        fetch: fetchWithConnectBudget
      }
    }) : null;
    patchLocalTableRouting(supabase);
    patchLocalTableRouting(supabaseAdmin);
    patchLocalTableRouting(supabaseAdminRaw);
    if (supabase) {
      console.log("\u2705 Supabase anon client created successfully");
    } else {
      console.log("\u274C Supabase anon client creation failed - missing credentials");
    }
    if (supabaseAdmin) {
      console.log("\u2705 Supabase admin client created successfully");
    } else {
      console.log("\u274C Supabase admin client creation failed - missing credentials");
    }
  }
});

// server/email-mapper.ts
async function mapEmailToRealEmail(email) {
  if (!email) return email;
  const normalizedEmail = email.toLowerCase().trim();
  const emailPrefix = normalizedEmail.split("@")[0];
  if (!/^\d+$/.test(emailPrefix) || parseInt(emailPrefix) <= 0) {
    return normalizedEmail;
  }
  const associateId = parseInt(emailPrefix);
  try {
    const { data: customer } = await supabaseAdmin.from("customers").select("company_email, personal_email").eq("associate_id", associateId).maybeSingle();
    if (customer?.company_email) {
      const realEmail = customer.company_email.toLowerCase().trim();
      if (realEmail && realEmail !== normalizedEmail) {
        return realEmail;
      }
    }
    if (customer?.personal_email) {
      const realEmail = customer.personal_email.toLowerCase().trim();
      if (realEmail && realEmail !== normalizedEmail) {
        return realEmail;
      }
    }
  } catch (error) {
    console.error(`\u274C Error looking up email for associate_id ${associateId}:`, error);
  }
  return normalizedEmail;
}
var init_email_mapper = __esm({
  "server/email-mapper.ts"() {
    "use strict";
    init_supabase();
  }
});

// server/agent-availability-tracker.ts
var AgentAvailabilityTracker, agentAvailabilityTracker;
var init_agent_availability_tracker = __esm({
  "server/agent-availability-tracker.ts"() {
    "use strict";
    init_supabase();
    AgentAvailabilityTracker = class _AgentAvailabilityTracker {
      static instance;
      cleanupInterval = null;
      static getInstance() {
        if (!_AgentAvailabilityTracker.instance) {
          _AgentAvailabilityTracker.instance = new _AgentAvailabilityTracker();
        }
        return _AgentAvailabilityTracker.instance;
      }
      /**
       * Update agent status and track time
       */
      async updateAgentStatus(update) {
        try {
          const trackingDate = update.trackingDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          const now = /* @__PURE__ */ new Date();
          let { data: existingRecord, error: fetchError } = await supabaseAdmin.from("agent_availability_tracking").select("*").eq("agent_id", update.agentId).eq("tracking_date", trackingDate).single();
          if (fetchError && fetchError.code !== "PGRST116") {
            console.error("\u274C Error fetching existing record:", fetchError);
            throw fetchError;
          }
          if (!existingRecord) {
            const { data: newRecord, error: createError } = await supabaseAdmin.from("agent_availability_tracking").insert({
              agent_id: update.agentId,
              agent_email: update.agentEmail,
              agent_name: update.agentName,
              tracking_date: trackingDate,
              current_status: update.newStatus,
              status_changed_at: now,
              last_activity: now,
              current_session_start: update.newStatus === "online" ? now : null
            }).select().single();
            if (createError) {
              console.error("\u274C Error creating new record:", createError);
              throw createError;
            }
            console.log(`\u2705 Created new tracking record for ${update.agentName}`);
            return;
          }
          const previousStatusTime = existingRecord.status_changed_at ? Math.floor((now.getTime() - new Date(existingRecord.status_changed_at).getTime()) / 1e3) : 0;
          let updates = {
            current_status: update.newStatus,
            previous_status: existingRecord.current_status,
            status_changed_at: now,
            last_activity: now
          };
          if (existingRecord.current_status === "online" && previousStatusTime > 0) {
            updates.total_available_time = (existingRecord.total_available_time || 0) + previousStatusTime;
            console.log(`\u{1F4CA} Accumulated ${previousStatusTime}s (${Math.round(previousStatusTime / 60)}min) online time for ${update.agentEmail}`);
          } else if (existingRecord.current_status === "calling" && previousStatusTime > 0) {
            updates.total_calling_time = (existingRecord.total_calling_time || 0) + previousStatusTime;
          } else if (existingRecord.current_status === "offline" && previousStatusTime > 0) {
            updates.total_offline_time = (existingRecord.total_offline_time || 0) + previousStatusTime;
          }
          if (update.newStatus === "online") {
            updates.current_session_start = now;
          } else {
            updates.current_session_start = null;
          }
          const { error: updateError } = await supabaseAdmin.from("agent_availability_tracking").update(updates).eq("id", existingRecord.id);
          if (updateError) {
            console.error("\u274C Error updating record:", updateError);
            throw updateError;
          }
          if (update.newStatus !== "offline") {
            console.log(`\u2705 Agent status updated: ${update.agentName} is now ${update.newStatus}`);
          }
        } catch (error) {
          console.error("\u274C Failed to update agent status:", error);
          throw error;
        }
      }
      /**
       * Get daily summary for an agent
       */
      async getAgentDailySummary(agentId, trackingDate) {
        try {
          const date = trackingDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          const { data, error } = await supabaseAdmin.from("agent_availability_tracking").select("*").eq("agent_id", agentId).eq("tracking_date", date).single();
          if (error) {
            if (error.code === "PGRST116") {
              return null;
            }
            console.error("\u274C Error getting agent daily summary:", error);
            return null;
          }
          return {
            agentId: data.agent_id,
            agentEmail: data.agent_email,
            agentName: data.agent_name,
            trackingDate: data.tracking_date,
            currentStatus: data.current_status,
            totalAvailableTime: data.total_available_time || 0,
            totalCallingTime: data.total_calling_time || 0,
            totalOfflineTime: data.total_offline_time || 0,
            formattedAvailableTime: this.formatTime(data.total_available_time || 0),
            formattedCallingTime: this.formatTime(data.total_calling_time || 0),
            formattedOfflineTime: this.formatTime(data.total_offline_time || 0)
          };
        } catch (error) {
          console.error("\u274C Failed to get agent daily summary:", error);
          return null;
        }
      }
      /**
       * Get all agents' daily summaries for a specific date
       */
      async getAllAgentsDailySummary(trackingDate) {
        try {
          const date = trackingDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          const { data, error } = await supabaseAdmin.from("agent_availability_tracking").select(`
          agent_id,
          agent_email,
          agent_name,
          tracking_date,
          current_status,
          total_available_time,
          total_calling_time,
          total_offline_time
        `).eq("tracking_date", date).order("total_available_time", { ascending: false });
          if (error) {
            console.error("\u274C Error getting all agents daily summary:", error);
            return [];
          }
          return data?.map((record) => ({
            agentId: record.agent_id,
            agentEmail: record.agent_email,
            agentName: record.agent_name,
            trackingDate: record.tracking_date,
            currentStatus: record.current_status,
            totalAvailableTime: record.total_available_time,
            totalCallingTime: record.total_calling_time,
            totalOfflineTime: record.total_offline_time,
            formattedAvailableTime: this.formatTime(record.total_available_time),
            formattedCallingTime: this.formatTime(record.total_calling_time),
            formattedOfflineTime: this.formatTime(record.total_offline_time)
          })) || [];
        } catch (error) {
          console.error("\u274C Failed to get all agents daily summary:", error);
          return [];
        }
      }
      /**
       * Get daily usage for a date range (for viewing daily breakdown over time)
       */
      async getDailyUsageForDateRange(startDate, endDate, agentEmail) {
        try {
          let query = supabaseAdmin.from("agent_availability_tracking").select(`
          agent_id,
          agent_email,
          agent_name,
          tracking_date,
          current_status,
          total_available_time,
          total_calling_time,
          total_offline_time
        `).gte("tracking_date", startDate).lte("tracking_date", endDate).order("tracking_date", { ascending: true }).order("total_available_time", { ascending: false });
          if (agentEmail) {
            query = query.eq("agent_email", agentEmail.toLowerCase());
          }
          const { data, error } = await query;
          if (error) {
            console.error("\u274C Error getting daily usage for date range:", error);
            return [];
          }
          return data?.map((record) => ({
            agentId: record.agent_id,
            agentEmail: record.agent_email,
            agentName: record.agent_name,
            trackingDate: record.tracking_date,
            date: record.tracking_date,
            // Alias for convenience
            currentStatus: record.current_status,
            totalAvailableTime: record.total_available_time || 0,
            totalCallingTime: record.total_calling_time || 0,
            totalOfflineTime: record.total_offline_time || 0,
            formattedAvailableTime: this.formatTime(record.total_available_time || 0),
            formattedCallingTime: this.formatTime(record.total_calling_time || 0),
            formattedOfflineTime: this.formatTime(record.total_offline_time || 0)
          })) || [];
        } catch (error) {
          console.error("\u274C Failed to get daily usage for date range:", error);
          return [];
        }
      }
      /**
       * Format seconds into HH:MM:SS format
       */
      formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor(seconds % 3600 / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
      /**
       * Start the tracker with cleanup scheduling
       */
      start() {
        console.log("\u{1F680} Starting Agent Availability Tracker...");
        this.scheduleCleanup();
        console.log("\u2705 Agent Availability Tracker started");
      }
      /**
       * Schedule cleanup of old records
       */
      scheduleCleanup() {
        const now = /* @__PURE__ */ new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(2, 0, 0, 0);
        const msUntilCleanup = tomorrow.getTime() - now.getTime();
        setTimeout(async () => {
          await this.cleanupOldRecords();
          this.scheduleCleanup();
        }, msUntilCleanup);
        console.log(`\u{1F9F9} Cleanup scheduled for ${tomorrow.toISOString()}`);
      }
      /**
       * Clean up old records (keep last 30 days)
       */
      async cleanupOldRecords() {
        try {
          console.log("\u{1F9F9} Cleaning up old availability records...");
          const { data, error } = await supabaseAdmin.rpc("cleanup_old_availability_records");
          if (error) {
            console.error("\u274C Error cleaning up old records:", error);
            return;
          }
          console.log(`\u2705 Cleaned up ${data || 0} old availability records`);
        } catch (error) {
          console.error("\u274C Failed to cleanup old records:", error);
        }
      }
      /**
       * Stop the tracker
       */
      stop() {
        if (this.cleanupInterval) {
          clearTimeout(this.cleanupInterval);
          this.cleanupInterval = null;
        }
        console.log("\u{1F6D1} Agent Availability Tracker stopped");
      }
    };
    agentAvailabilityTracker = AgentAvailabilityTracker.getInstance();
  }
});

// server/taalk-vdp-poller.ts
var taalk_vdp_poller_exports = {};
__export(taalk_vdp_poller_exports, {
  taalkVDPPoller: () => taalkVDPPoller
});
var TAALK_API_TOKEN, VDP_AGENTS_URL, TaalkVDPPoller, taalkVDPPoller;
var init_taalk_vdp_poller = __esm({
  "server/taalk-vdp-poller.ts"() {
    "use strict";
    init_agent_availability_tracker();
    init_supabase();
    init_email_mapper();
    TAALK_API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    VDP_AGENTS_URL = "https://lets.taalk.ai/api/vdp_agents";
    TaalkVDPPoller = class {
      agents = /* @__PURE__ */ new Map();
      pollInterval = null;
      lastPollTime = /* @__PURE__ */ new Date();
      agentIdToEmailMap = /* @__PURE__ */ new Map();
      // Cache agent ID -> email mappings
      lastWeeklyStatsSync = /* @__PURE__ */ new Date(0);
      // Track when we last synced weekly stats
      constructor() {
        console.log("\u2261\u0192\xF4\xED Taalk VDP Poller initialized");
        this.loadAgentMappings();
      }
      /**
       * Load agent ID to email mappings from database
       */
      async loadAgentMappings() {
        try {
          if (!supabaseAdmin) return;
          const { data: customers, error: customersError } = await supabaseAdmin.from("customers").select("associate_id, company_email, personal_email").not("associate_id", "is", null);
          if (!customersError && customers) {
            customers.forEach((record) => {
              const associateId = record.associate_id?.toString().toLowerCase();
              const email = (record.company_email || record.personal_email)?.toLowerCase();
              if (associateId && email) {
                this.agentIdToEmailMap.set(associateId, email);
              }
            });
          }
          const { data: producers2, error: producersError } = await supabaseAdmin.from("producerlist").select("associate_id, company_email").not("associate_id", "is", null).not("company_email", "is", null);
          if (!producersError && producers2) {
            producers2.forEach((record) => {
              const associateId = record.associate_id?.toString().toLowerCase();
              const email = record.company_email?.toLowerCase();
              if (associateId && email && !this.agentIdToEmailMap.has(associateId)) {
                this.agentIdToEmailMap.set(associateId, email);
              }
            });
          }
          console.log(`Loaded ${this.agentIdToEmailMap.size} agent ID -> email mappings from customers and producerlist`);
          if (this.agentIdToEmailMap.has("1253")) {
            console.log(`  1253 maps to: ${this.agentIdToEmailMap.get("1253")}`);
          } else {
            console.log(`  1253 NOT found in mapping (total mappings: ${this.agentIdToEmailMap.size})`);
          }
        } catch (error) {
          console.error("\u0393\xA5\xEE Error loading agent mappings:", error);
        }
      }
      /**
       * Resolve Taalk agent ID to email address
       */
      resolveAgentEmail(taalkAgentId) {
        const normalizedId = taalkAgentId.toString().toLowerCase();
        if (this.agentIdToEmailMap.has(normalizedId)) {
          return this.agentIdToEmailMap.get(normalizedId);
        }
        if (normalizedId.includes("@")) {
          return normalizedId;
        }
        return `${normalizedId}@aoglobelife.com`;
      }
      /**
       * Start polling Taalk API for active calls
       */
      start() {
        console.log("\u2261\u0192\xDC\xC7 Starting Taalk VDP Poller...");
        this.pollTaalkAPI();
        this.pollInterval = setInterval(() => {
          this.pollTaalkAPI();
        }, 1e4);
        console.log("\u0393\xA3\xE0 Taalk VDP Poller started - polling every 10 seconds");
      }
      /**
       * Stop polling
       */
      stop() {
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
        }
        console.log("\u2261\u0192\xA2\xE6 Taalk VDP Poller stopped");
      }
      /**
       * Poll Taalk VDP Agents API for real-time agent status
       */
      async trackStatusChange(agent, now, previousStatus) {
        try {
          if (previousStatus === agent.status) {
            return;
          }
          await agentAvailabilityTracker.updateAgentStatus({
            agentId: agent.email.split("@")[0],
            // Use associate ID
            agentEmail: agent.email,
            agentName: agent.name,
            newStatus: agent.status
          });
          if (supabaseAdmin && previousStatus !== "online" && agent.status === "online") {
            try {
              const { error } = await supabaseAdmin.from("agent_activity_log").insert({
                agent_email: agent.email.toLowerCase(),
                activity_type: "vdp_available_start",
                timestamp: now.toISOString(),
                activity_data: {
                  previous_status: previousStatus,
                  new_status: "online",
                  source: "taalk_vdp_poller"
                }
              });
              if (error) {
                console.error("\u26A0\uFE0F Failed to log vdp_available_start:", error);
              } else {
                console.log(`\u2705 Logged vdp_available_start for ${agent.email}`);
              }
            } catch (err) {
              console.error("\u26A0\uFE0F Failed to log vdp_available_start:", err);
            }
          } else if (supabaseAdmin && previousStatus === "online" && agent.status !== "online") {
            const onlineDuration = agent.onlineStartTime ? Math.round((now.getTime() - agent.onlineStartTime.getTime()) / 1e3) : null;
            try {
              const { error } = await supabaseAdmin.from("agent_activity_log").insert({
                agent_email: agent.email.toLowerCase(),
                activity_type: "vdp_available_end",
                timestamp: now.toISOString(),
                activity_data: {
                  previous_status: "online",
                  new_status: agent.status,
                  source: "taalk_vdp_poller",
                  online_duration_seconds: onlineDuration
                }
              });
              if (error) {
                console.error("\u26A0\uFE0F Failed to log vdp_available_end:", error);
              } else {
                console.log(`\u2705 Logged vdp_available_end for ${agent.email} (duration: ${onlineDuration}s)`);
              }
            } catch (err) {
              console.error("\u26A0\uFE0F Failed to log vdp_available_end:", err);
            }
          }
          agent.lastStatusChange = now;
          const summary = await agentAvailabilityTracker.getAgentDailySummary(agent.email.split("@")[0]);
          if (summary) {
            agent.availableTime = summary.totalAvailableTime;
            agent.dailyAvailableTime = summary.totalAvailableTime;
          }
        } catch (error) {
          console.error("\u274C Error tracking agent status change:", error);
        }
      }
      async pollTaalkAPI() {
        try {
          const response = await fetch(VDP_AGENTS_URL, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${TAALK_API_TOKEN}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
              "User-Agent": "TaalkDashboard/1.0"
            }
          });
          if (!response.ok) {
            console.error(`\u0393\xA5\xEE Taalk VDP Agents API failed: ${response.status} ${response.statusText}`);
            return;
          }
          const agentsData = await response.json();
          const agents = agentsData.payload || (Array.isArray(agentsData) ? agentsData : agentsData.agents || agentsData.data || []);
          console.log(`\u2261\u0192\xF4\xED Taalk VDP API: Found ${agents.length} agents`);
          await this.processVDPAgentsData(agents);
          this.syncVdpStatusToRecruitTable().catch((err) => {
            console.error("\u0393\xA5\xEE Error in syncVdpStatusToRecruitTable:", err);
          });
          this.lastPollTime = /* @__PURE__ */ new Date();
        } catch (error) {
          console.error("\u0393\xA5\xEE Taalk VDP poll error:", error);
        }
      }
      /**
       * Process VDP agents data from Taalk API
       */
      async processVDPAgentsData(agentsData) {
        const now = /* @__PURE__ */ new Date();
        console.log(`\u2261\u0192\xF4\xED Processing ${agentsData.length} agents from Taalk VDP API`);
        for (const agentData of agentsData) {
          const taalkAgentId = agentData.id || agentData.agent || agentData.email;
          if (!taalkAgentId) continue;
          const agentEmail = this.resolveAgentEmail(taalkAgentId);
          let agent = this.agents.get(agentEmail);
          if (!agent) {
            let agentName = agentData.name || `Agent ${taalkAgentId}`;
            if (supabaseAdmin) {
              try {
                const { data: profile } = await supabaseAdmin.from("agent_profiles").select("first_name, last_name").eq("email", agentEmail).maybeSingle();
                if (profile) {
                  agentName = `${profile.first_name} ${profile.last_name}`;
                }
              } catch (e) {
              }
            }
            agent = {
              email: agentEmail,
              // Use resolved email
              name: agentName,
              status: "offline",
              todayStats: {
                totalCalls: 0,
                inboundCalls: 0,
                outboundCalls: 0,
                totalCallTime: 0
              },
              lastActivity: now,
              onlineStartTime: void 0,
              dailyAvailableTime: 0,
              lastStatusChange: now
            };
            this.agents.set(agentEmail, agent);
          }
          agent.lastActivity = now;
          const previousStatus = agent.status;
          const rawStatus = {
            busy: agentData.busy,
            status: agentData.status,
            state: agentData.state,
            online: agentData.online,
            available: agentData.available
          };
          if (agentData.busy === true || agentData.status === "busy" || agentData.state === "busy" || agentData.online === true || agentData.status === "online" || agentData.state === "available" || agentData.available === true) {
            console.log(`\u{1F4CA} TAALK STATUS for ${agentEmail}:`, JSON.stringify(rawStatus));
          }
          if (agentData.busy === true || agentData.status === "busy" || agentData.state === "busy") {
            agent.status = "calling";
            if (agentData.currentCall || agentData.call) {
              const callData = agentData.currentCall || agentData.call;
              agent.currentCall = {
                callId: callData.id || callData.callId || "unknown",
                phoneNumber: callData.phone || callData.phoneNumber || "Unknown",
                direction: callData.direction || "outbound",
                duration: callData.duration || 0,
                startTime: callData.startTime ? new Date(callData.startTime) : now
              };
            } else {
              agent.currentCall = {
                callId: "active",
                phoneNumber: "Active Call",
                direction: "outbound",
                duration: 0,
                startTime: now
              };
            }
          } else if (agentData.online === true || agentData.status === "online" || agentData.state === "available" || agentData.available === true) {
            const wasOffline = previousStatus === "offline" || previousStatus === "calling";
            agent.status = "online";
            agent.currentCall = void 0;
            if (wasOffline || !agent.onlineStartTime) {
              agent.onlineStartTime = now;
              console.log(`\u{1F4CA} ${agent.email} is ONLINE/AVAILABLE at ${now.toISOString()}`);
            }
          } else {
            const wasOnline = previousStatus === "online";
            agent.status = "offline";
            agent.currentCall = void 0;
            if (wasOnline && agent.onlineStartTime) {
              const onlineDuration = Math.round((now.getTime() - agent.onlineStartTime.getTime()) / 1e3);
              agent.dailyAvailableTime += onlineDuration;
              console.log(`\u{1F4CA} ${agent.email} went OFFLINE after ${onlineDuration} seconds online`);
              agent.onlineStartTime = void 0;
            }
          }
          await this.trackStatusChange(agent, now, previousStatus);
        }
        await this.accumulateCurrentSessionTime(now);
        const online = Array.from(this.agents.values()).filter((a) => a.status === "online").length;
        const calling = Array.from(this.agents.values()).filter((a) => a.status === "calling").length;
        const offline = Array.from(this.agents.values()).filter((a) => a.status === "offline").length;
        const onlineAgentsList = Array.from(this.agents.values()).filter((a) => a.status === "online").map((a) => a.email).slice(0, 10);
        console.log(`\u{1F4CA} VDP Status: ${online} ONLINE/AVAILABLE, ${calling} ON A CALL, ${offline} offline (${this.agents.size} total)`);
        if (onlineAgentsList.length > 0) {
          console.log(`\u{1F4CA} ONLINE agents: ${onlineAgentsList.join(", ")}${online > 10 ? " ..." : ""}`);
        }
      }
      /**
       * Accumulate time for agents currently ONLINE/AVAILABLE or ON A CALL
       * This runs every poll (every 10 seconds) to track time
       * SIMPLE: Track time when status === 'online' (ONLINE/AVAILABLE) or 'calling' (ON A CALL)
       */
      async accumulateCurrentSessionTime(now) {
        try {
          const activeAgents = Array.from(this.agents.values()).filter(
            (a) => a.status === "online" || a.status === "calling"
          );
          const onlineAgents = activeAgents.filter((a) => a.status === "online");
          const callingAgents = activeAgents.filter((a) => a.status === "calling");
          if (activeAgents.length === 0) {
            return;
          }
          console.log(`\u{1F4CA} VDP Poller: ${onlineAgents.length} ONLINE/AVAILABLE, ${callingAgents.length} ON A CALL`);
          for (const agent of onlineAgents) {
            try {
              const agentId = agent.email.split("@")[0];
              const trackingDate = now.toISOString().split("T")[0];
              let { data: existingRecord, error: fetchError } = await supabaseAdmin.from("agent_availability_tracking").select("*").eq("agent_id", agentId).eq("tracking_date", trackingDate).single();
              if (fetchError && fetchError.code !== "PGRST116") {
                console.error(`\u274C Error fetching record for ${agent.email}:`, fetchError);
                continue;
              }
              if (!existingRecord) {
                const sessionStart = agent.onlineStartTime || now;
                const initialTime = Math.floor((now.getTime() - sessionStart.getTime()) / 1e3);
                const { data: newRecord, error: createError } = await supabaseAdmin.from("agent_availability_tracking").insert({
                  agent_id: agentId,
                  agent_email: agent.email,
                  agent_name: agent.name,
                  tracking_date: trackingDate,
                  current_status: "online",
                  status_changed_at: now,
                  last_activity: now,
                  current_session_start: sessionStart,
                  total_available_time: initialTime > 0 ? initialTime : 0
                }).select().single();
                if (createError) {
                  console.error(`\u274C Error creating record for ${agent.email}:`, createError);
                  console.error(`   Error details:`, JSON.stringify(createError, null, 2));
                } else {
                  console.log(`\u2705 Created tracking record for ${agent.email} with ${Math.round(initialTime / 60)} min initial time`);
                }
                continue;
              }
              const lastUpdate = existingRecord.status_changed_at ? new Date(existingRecord.status_changed_at) : existingRecord.current_session_start ? new Date(existingRecord.current_session_start) : now;
              const timeSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / 1e3);
              if (timeSinceUpdate > 0) {
                const newTotalTime = (existingRecord.total_available_time || 0) + timeSinceUpdate;
                const { data: updatedRecord, error: updateError } = await supabaseAdmin.from("agent_availability_tracking").update({
                  total_available_time: newTotalTime,
                  status_changed_at: now,
                  // Update timestamp for next poll
                  last_activity: now,
                  current_status: "online"
                }).eq("id", existingRecord.id).select().single();
                if (updateError) {
                  console.error(`\u274C Error accumulating time for ${agent.email}:`, updateError);
                  console.error(`   Error details:`, JSON.stringify(updateError, null, 2));
                } else {
                  if (timeSinceUpdate >= 60) {
                    console.log(`\u2705 VDP ONLINE: ${agent.email} accumulated ${Math.round(timeSinceUpdate / 60)}min (total: ${Math.round(newTotalTime / 60)}min today)`);
                  }
                  if (updatedRecord && updatedRecord.total_available_time !== newTotalTime) {
                    console.error(`\u26A0\uFE0F WARNING: Update didn't work! Expected ${newTotalTime}, got ${updatedRecord.total_available_time}`);
                  }
                }
              } else {
                await supabaseAdmin.from("agent_availability_tracking").update({
                  last_activity: now,
                  current_status: "online"
                }).eq("id", existingRecord.id);
              }
            } catch (agentError) {
              console.error(`\u274C Error processing agent ${agent.email}:`, agentError);
            }
          }
          for (const agent of callingAgents) {
            try {
              const agentId = agent.email.split("@")[0];
              const trackingDate = now.toISOString().split("T")[0];
              let { data: existingRecord, error: fetchError } = await supabaseAdmin.from("agent_availability_tracking").select("*").eq("agent_id", agentId).eq("tracking_date", trackingDate).single();
              if (fetchError && fetchError.code !== "PGRST116") {
                continue;
              }
              if (!existingRecord) {
                const callStart = agent.currentCall?.startTime || now;
                const initialTime = Math.floor((now.getTime() - callStart.getTime()) / 1e3);
                const { data: newRecord, error: createError } = await supabaseAdmin.from("agent_availability_tracking").insert({
                  agent_id: agentId,
                  agent_email: agent.email,
                  agent_name: agent.name,
                  tracking_date: trackingDate,
                  current_status: "calling",
                  status_changed_at: now,
                  last_activity: now,
                  total_calling_time: initialTime > 0 ? initialTime : 0
                }).select().single();
                if (createError) {
                  console.error(`\u274C Error creating calling record for ${agent.email}:`, createError);
                  console.error(`   Error details:`, JSON.stringify(createError, null, 2));
                } else {
                  console.log(`\u2705 Created calling record for ${agent.email} with ${Math.round(initialTime / 60)} min initial time`);
                }
                continue;
              }
              const lastUpdate = existingRecord.status_changed_at ? new Date(existingRecord.status_changed_at) : now;
              const timeSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / 1e3);
              if (timeSinceUpdate > 0) {
                const newTotalCallingTime = (existingRecord.total_calling_time || 0) + timeSinceUpdate;
                const { data: updatedRecord, error: updateError } = await supabaseAdmin.from("agent_availability_tracking").update({
                  total_calling_time: newTotalCallingTime,
                  status_changed_at: now,
                  last_activity: now,
                  current_status: "calling"
                }).eq("id", existingRecord.id).select().single();
                if (updateError) {
                  console.error(`\u274C Error accumulating calling time for ${agent.email}:`, updateError);
                  console.error(`   Error details:`, JSON.stringify(updateError, null, 2));
                } else if (timeSinceUpdate >= 60) {
                  console.log(`\u2705 VDP ON CALL: ${agent.email} accumulated ${Math.round(timeSinceUpdate / 60)}min (total: ${Math.round(newTotalCallingTime / 60)}min today)`);
                }
              } else {
                await supabaseAdmin.from("agent_availability_tracking").update({
                  last_activity: now,
                  current_status: "calling"
                }).eq("id", existingRecord.id);
              }
            } catch (agentError) {
              console.error(`\u274C Error processing calling agent ${agent.email}:`, agentError);
            }
          }
          const timeSinceLastSync = (now.getTime() - this.lastWeeklyStatsSync.getTime()) / 1e3;
          if (timeSinceLastSync >= 60) {
            await this.syncDailyTrackingToWeeklyStats(now).catch((err) => {
              console.error("\u274C Error syncing daily tracking to weekly stats:", err);
            });
            this.lastWeeklyStatsSync = now;
          }
        } catch (error) {
          console.error("\u274C Error in accumulateCurrentSessionTime:", error);
        }
      }
      /**
       * Sync accumulated time from agent_availability_tracking to weekly_usage_stats
       * This aggregates daily tracking data into weekly stats
       */
      async syncDailyTrackingToWeeklyStats(now) {
        try {
          if (!supabaseAdmin) {
            console.warn("\u26A0\uFE0F supabaseAdmin not available, skipping weekly stats sync");
            return;
          }
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          const weekStartStr = weekStart.toISOString().split("T")[0];
          const weekEndStr = weekEnd.toISOString().split("T")[0];
          console.log(`\u{1F4CA} Syncing daily tracking to weekly stats for week ${weekStartStr} to ${weekEndStr}`);
          const { data: dailyTracking, error: trackingError } = await supabaseAdmin.from("agent_availability_tracking").select("agent_email, agent_id, agent_name, tracking_date, total_available_time, total_calling_time").gte("tracking_date", weekStartStr).lte("tracking_date", weekEndStr);
          if (trackingError) {
            console.error("\u274C Error fetching daily tracking data:", trackingError);
            return;
          }
          if (!dailyTracking || dailyTracking.length === 0) {
            console.log("\u{1F4CA} No daily tracking data found for this week");
            return;
          }
          const weeklyDataByAgent = /* @__PURE__ */ new Map();
          for (const record of dailyTracking) {
            const email = record.agent_email?.toLowerCase();
            if (!email) continue;
            if (!weeklyDataByAgent.has(email)) {
              weeklyDataByAgent.set(email, {
                agent_email: email,
                agent_name: record.agent_name || null,
                total_available_minutes: 0,
                total_calling_minutes: 0
              });
            }
            const weeklyData = weeklyDataByAgent.get(email);
            weeklyData.total_available_minutes += Math.round((record.total_available_time || 0) / 60);
            weeklyData.total_calling_minutes += Math.round((record.total_calling_time || 0) / 60);
          }
          console.log(`\u{1F4CA} Found ${weeklyDataByAgent.size} agents with tracking data this week`);
          const weeklyDataByRealEmail = /* @__PURE__ */ new Map();
          for (const [email, data] of weeklyDataByAgent) {
            const realEmail = await mapEmailToRealEmail(email);
            if (realEmail !== email) {
              console.log(`\u{1F504} Mapping numeric email ${email} -> ${realEmail}`);
            }
            if (!weeklyDataByRealEmail.has(realEmail)) {
              weeklyDataByRealEmail.set(realEmail, {
                agent_email: realEmail,
                agent_name: data.agent_name,
                total_available_minutes: data.total_available_minutes,
                total_calling_minutes: data.total_calling_minutes,
                numericEmails: email !== realEmail ? [email] : []
              });
            } else {
              const existing = weeklyDataByRealEmail.get(realEmail);
              existing.total_available_minutes += data.total_available_minutes;
              existing.total_calling_minutes += data.total_calling_minutes;
              if (email !== realEmail) {
                existing.numericEmails.push(email);
              }
            }
          }
          for (const [realEmail, data] of weeklyDataByRealEmail) {
            try {
              const { data: existingRecord } = await supabaseAdmin.from("weekly_usage_stats").select("id, vdp_total_minutes, vdp_available_minutes, vdp_call_minutes").eq("agent_email", realEmail).eq("week_start_date", weekStartStr).maybeSingle();
              if (existingRecord) {
                const totalVdpMinutes = data.total_available_minutes + data.total_calling_minutes;
                const { error: updateError } = await supabaseAdmin.from("weekly_usage_stats").update({
                  vdp_available_minutes: Math.max(
                    existingRecord.vdp_available_minutes || 0,
                    data.total_available_minutes
                  ),
                  vdp_call_minutes: Math.max(
                    existingRecord.vdp_call_minutes || 0,
                    data.total_calling_minutes
                  ),
                  vdp_total_minutes: Math.max(
                    existingRecord.vdp_total_minutes || 0,
                    totalVdpMinutes
                  ),
                  updated_at: now.toISOString()
                }).eq("agent_email", realEmail).eq("week_start_date", weekStartStr);
                if (updateError) {
                  console.error(`\u274C Error updating weekly stats for ${realEmail}:`, updateError);
                } else if (totalVdpMinutes > 0) {
                  console.log(`\u2705 Updated weekly stats for ${realEmail}: ${data.total_available_minutes} min available, ${data.total_calling_minutes} min calling, ${totalVdpMinutes} min total VDP`);
                }
                if (data.numericEmails.length > 0) {
                  for (const numericEmail of data.numericEmails) {
                    await supabaseAdmin.from("weekly_usage_stats").delete().eq("agent_email", numericEmail).eq("week_start_date", weekStartStr);
                  }
                }
              } else {
                const totalVdpMinutes = data.total_available_minutes + data.total_calling_minutes;
                const { error: upsertError } = await supabaseAdmin.from("weekly_usage_stats").upsert({
                  agent_email: realEmail,
                  agent_name: data.agent_name,
                  week_start_date: weekStartStr,
                  week_end_date: weekEndStr,
                  vdp_available_minutes: data.total_available_minutes,
                  vdp_call_minutes: data.total_calling_minutes,
                  vdp_total_minutes: totalVdpMinutes,
                  updated_at: now.toISOString()
                }, {
                  onConflict: "agent_email,week_start_date"
                });
                if (upsertError) {
                  console.error(`\u274C Error upserting weekly stats for ${realEmail}:`, upsertError);
                } else if (totalVdpMinutes > 0) {
                  console.log(`\u2705 Created/updated weekly stats for ${realEmail}: ${data.total_available_minutes} min available, ${data.total_calling_minutes} min calling, ${totalVdpMinutes} min total VDP`);
                }
                if (data.numericEmails.length > 0) {
                  for (const numericEmail of data.numericEmails) {
                    await supabaseAdmin.from("weekly_usage_stats").delete().eq("agent_email", numericEmail).eq("week_start_date", weekStartStr);
                  }
                }
              }
            } catch (agentError) {
              console.error(`\u274C Error processing agent ${realEmail} in weekly stats sync:`, agentError);
            }
          }
          console.log(`\u2705 Completed weekly stats sync for ${weeklyDataByAgent.size} agents`);
        } catch (error) {
          console.error("\u274C Error in syncDailyTrackingToWeeklyStats:", error);
        }
      }
      /**
       * Process VDP webhook events from database (DEPRECATED - using API instead)
       */
      processWebhookEvents(events) {
        const agentMap = /* @__PURE__ */ new Map();
        const now = /* @__PURE__ */ new Date();
        const agentEvents = /* @__PURE__ */ new Map();
        for (const event of events) {
          const agentId = event.agent_id;
          if (!agentId) continue;
          const agentEmail = agentId.includes("@") ? agentId : `${agentId}@aoglobelife.com`;
          if (!agentEvents.has(agentEmail)) {
            agentEvents.set(agentEmail, []);
          }
          agentEvents.get(agentEmail).push(event);
        }
        console.log(`\u2261\u0192\xF4\xED Processing events for ${agentEvents.size} agents`);
        for (const [agentEmail, events2] of agentEvents.entries()) {
          let agent = this.agents.get(agentEmail);
          if (!agent) {
            agent = {
              email: agentEmail,
              name: agentEmail.split("@")[0],
              status: "offline",
              todayStats: {
                totalCalls: 0,
                inboundCalls: 0,
                outboundCalls: 0,
                totalCallTime: 0
              },
              lastActivity: new Date(events2[0].created_at)
            };
            this.agents.set(agentEmail, agent);
          }
          const latestEvent = events2[0];
          const eventTime = new Date(latestEvent.created_at);
          agent.lastActivity = eventTime;
          const hasRecentConnect = events2.some(
            (e) => e.event_type === "CONNECT" && now.getTime() - new Date(e.created_at).getTime() < 5 * 60 * 1e3
            // Last 5 mins
          );
          const minutesSinceActivity = (now.getTime() - eventTime.getTime()) / (1e3 * 60);
          if (hasRecentConnect && minutesSinceActivity < 15) {
            agent.status = "calling";
            const connectEvent = events2.find((e) => e.event_type === "CONNECT");
            if (connectEvent) {
              agent.currentCall = {
                callId: connectEvent.id?.toString() || "unknown",
                phoneNumber: connectEvent.phone_number || "Unknown",
                direction: "outbound",
                // VDP calls are typically outbound
                duration: Math.floor((now.getTime() - new Date(connectEvent.created_at).getTime()) / 1e3),
                startTime: new Date(connectEvent.created_at)
              };
            }
          } else if (minutesSinceActivity < 30) {
            agent.status = "online";
            agent.currentCall = void 0;
          } else {
            agent.status = "offline";
            agent.currentCall = void 0;
          }
          const today = /* @__PURE__ */ new Date();
          today.setHours(0, 0, 0, 0);
          const todayEvents = events2.filter((e) => {
            const eventDate = new Date(e.created_at);
            return eventDate >= today;
          });
          agent.todayStats.totalCalls = todayEvents.filter((e) => e.event_type === "CONNECT").length;
          agent.todayStats.outboundCalls = agent.todayStats.totalCalls;
          agent.todayStats.inboundCalls = 0;
        }
        const online = Array.from(this.agents.values()).filter((a) => a.status === "online").length;
        const calling = Array.from(this.agents.values()).filter((a) => a.status === "calling").length;
        if (this.agents.size > 0) {
          console.log(`\u2261\u0192\xF4\xED VDP Status: ${online} online, ${calling} calling, ${this.agents.size} total agents`);
        }
      }
      /**
       * Process calls data and update agent statuses (DEPRECATED - using webhooks instead)
       */
      processCallsData(calls) {
        const agentMap = /* @__PURE__ */ new Map();
        const now = /* @__PURE__ */ new Date();
        for (const agent of this.agents.values()) {
          agent.status = "offline";
          agent.currentCall = void 0;
        }
        for (const call of calls) {
          const agentEmail = `${call.agent}@aoglobelife.com`;
          let agent = this.agents.get(agentEmail) || agentMap.get(agentEmail);
          if (!agent) {
            agent = {
              email: agentEmail,
              name: call.agent,
              status: "offline",
              todayStats: {
                totalCalls: 0,
                inboundCalls: 0,
                outboundCalls: 0,
                totalCallTime: 0
              },
              lastActivity: new Date(call.startTime)
            };
            agentMap.set(agentEmail, agent);
          }
          const callTime = new Date(call.startTime);
          if (callTime > agent.lastActivity) {
            agent.lastActivity = callTime;
          }
          const isActive = ["initiated", "ringing", "in-progress"].includes(call.status);
          if (isActive) {
            agent.status = "calling";
            const startTime = new Date(call.startTime);
            const duration = (now.getTime() - startTime.getTime()) / 1e3;
            agent.currentCall = {
              callId: call._id,
              phoneNumber: call.phone,
              direction: call.direction || "outbound",
              duration: Math.floor(duration),
              startTime
            };
          } else {
            if (call.status === "completed") {
              const callDate = new Date(call.startTime);
              const isToday = callDate.toDateString() === now.toDateString();
              if (isToday) {
                agent.todayStats.totalCalls++;
                if (call.direction === "inbound") {
                  agent.todayStats.inboundCalls++;
                } else {
                  agent.todayStats.outboundCalls++;
                }
                if (call.duration) {
                  agent.todayStats.totalCallTime += call.duration;
                }
              }
            }
            const minutesSinceActivity = (now.getTime() - agent.lastActivity.getTime()) / (1e3 * 60);
            if (minutesSinceActivity < 5 && !agent.currentCall) {
              agent.status = "online";
            }
          }
        }
        for (const [email, agent] of agentMap.entries()) {
          this.agents.set(email, agent);
        }
        const online = Array.from(this.agents.values()).filter((a) => a.status === "online").length;
        const calling = Array.from(this.agents.values()).filter((a) => a.status === "calling").length;
        if (online > 0 || calling > 0) {
          console.log(`\u2261\u0192\xF4\xED VDP Status: ${online} online, ${calling} calling, ${this.agents.size} total agents`);
        }
      }
      /**
       * Sync VDP status to live_call_boardt_recruit table for recruit agents
       * Ensures agents who go online in recruiting VDP get an entry so managers can see they're online
       */
      async syncVdpStatusToRecruitTable() {
        if (!supabaseAdmin) return;
        try {
          const activeAgents = Array.from(this.agents.values()).filter(
            (a) => a.status === "online" || a.status === "calling"
          );
          if (activeAgents.length === 0) return;
          const { data: recruitCandidates3 } = await supabaseAdmin.from("recruit_candidates").select("agent_email").not("agent_email", "is", null).limit(1e4);
          const recruitAgentEmails = /* @__PURE__ */ new Set();
          if (recruitCandidates3) {
            recruitCandidates3.forEach((c) => {
              const email = c.agent_email?.toLowerCase();
              if (email) recruitAgentEmails.add(email);
            });
          }
          const { data: recruitVdpCalls } = await supabaseAdmin.from("vdp_calls").select("agent_email, market").ilike("market", "%aorecruit%").gte("time", new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString()).not("agent_email", "is", null);
          if (recruitVdpCalls) {
            recruitVdpCalls.forEach((call) => {
              const email = call.agent_email?.toLowerCase();
              if (email) recruitAgentEmails.add(email);
            });
          }
          for (const agent of activeAgents) {
            const email = agent.email.toLowerCase();
            let isRecruitAgent = recruitAgentEmails.has(email);
            if (!isRecruitAgent) continue;
            let agentName = agent.name || email.split("@")[0];
            const { data: hierarchy } = await supabaseAdmin.from("agent_hierarchy").select("agent_name").eq("agent_email", email).maybeSingle();
            if (hierarchy?.agent_name) {
              agentName = hierarchy.agent_name;
            }
            const dbStatus = agent.status === "calling" ? "calling" : "online";
            const { data: existing } = await supabaseAdmin.from("live_call_boardt_recruit").select("agent_email").eq("agent_email", email).maybeSingle();
            if (!existing) {
              const { error: insertError } = await supabaseAdmin.from("live_call_boardt_recruit").insert({
                agent_email: email,
                agent_name: agentName,
                status: dbStatus,
                today_dialed: 0,
                today_reached: 0,
                today_booked: 0,
                today_connects: 0,
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              });
              if (insertError) {
                console.error(`\u0393\xA5\xEE Failed to insert new recruit agent ${email}:`, insertError);
              } else {
                console.log(`\u0393\xA3\xE0 Inserted new recruit agent ${email} with status: ${dbStatus} (all stats initialized to 0)`);
              }
            } else {
              const { error: updateError } = await supabaseAdmin.from("live_call_boardt_recruit").update({
                status: dbStatus,
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              }).eq("agent_email", email);
              if (updateError) {
                console.error(`\u0393\xA5\xEE Failed to update status for ${email}:`, updateError);
              }
            }
            await supabaseAdmin.from("live_call_boardt_recruit").update({
              status: dbStatus,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("agent_email", email);
          }
          const activeEmails = new Set(activeAgents.map((a) => a.email.toLowerCase()));
          const offlineRecruitAgents = Array.from(recruitAgentEmails).filter(
            (email) => !activeEmails.has(email)
          );
          if (offlineRecruitAgents.length > 0) {
            const { error } = await supabaseAdmin.from("live_call_boardt_recruit").update({
              status: "offline",
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).in("agent_email", offlineRecruitAgents).or("status.eq.online,status.eq.calling");
            if (error) {
              console.error("\u0393\xA5\xEE Failed to update offline status for recruit agents:", error);
            }
          }
        } catch (error) {
          console.error("\u0393\xA5\xEE Error syncing VDP status to recruit table:", error);
        }
      }
      /**
       * Get all agents
       */
      getAgents() {
        return Array.from(this.agents.values()).sort((a, b) => {
          if (a.status === "calling" && b.status !== "calling") return -1;
          if (a.status !== "calling" && b.status === "calling") return 1;
          if (a.status === "online" && b.status === "offline") return -1;
          if (a.status === "offline" && b.status === "online") return 1;
          return b.lastActivity.getTime() - a.lastActivity.getTime();
        });
      }
      /**
       * Get dashboard stats
       */
      getStats() {
        const agents = Array.from(this.agents.values());
        const onlineAgents = agents.filter((a) => a.status === "online");
        const callingAgents = agents.filter((a) => a.status === "calling");
        const totalCalls = agents.reduce((sum, a) => sum + a.todayStats.totalCalls, 0);
        const inboundCalls = agents.reduce((sum, a) => sum + a.todayStats.inboundCalls, 0);
        const outboundCalls2 = agents.reduce((sum, a) => sum + a.todayStats.outboundCalls, 0);
        const totalCallTime = agents.reduce((sum, a) => sum + a.todayStats.totalCallTime, 0);
        const avgCallTime = totalCalls > 0 ? totalCallTime / totalCalls : 0;
        const avgMins = Math.floor(avgCallTime / 60);
        const avgSecs = Math.floor(avgCallTime % 60);
        return {
          totalAgents: agents.length,
          onlineAgents: onlineAgents.length + callingAgents.length,
          callingAgents: callingAgents.length,
          totalCalls,
          inboundCalls,
          outboundCalls: outboundCalls2,
          avgCallTime: `${avgMins}:${avgSecs.toString().padStart(2, "0")}`,
          avgUtilization: 0
          // TODO: Calculate based on available time
        };
      }
    };
    taalkVDPPoller = new TaalkVDPPoller();
  }
});

// server/ip-analysis-service.ts
var ip_analysis_service_exports = {};
__export(ip_analysis_service_exports, {
  analyzeIPAddresses: () => analyzeIPAddresses,
  calculateDistanceMiles: () => calculateDistanceMiles,
  getIPGeolocation: () => getIPGeolocation,
  getPublicIP: () => getPublicIP,
  getRealIP: () => getRealIP
});
function calculateDistanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function normalizeState(state) {
  if (!state) return null;
  const normalized = state.trim();
  const upper = normalized.toUpperCase();
  if (STATE_ABBREVIATIONS[upper]) {
    return STATE_ABBREVIATIONS[upper];
  }
  const fullName = Object.values(STATE_ABBREVIATIONS).find(
    (name) => name.toLowerCase() === normalized.toLowerCase()
  );
  return fullName || normalized;
}
function analyzeIPAddresses(agentData, clientData, declaredState, options) {
  const hasAgentGps = !!(agentData.latitude && agentData.longitude);
  const hasClientGps = !!(clientData.latitude && clientData.longitude);
  const agentDenied = options?.agentGeolocationDenied && !hasAgentGps || agentData.ip && !hasAgentGps;
  const clientDenied = options?.clientGeolocationDenied && !hasClientGps || clientData.ip && !hasClientGps;
  const geolocationNote = agentDenied || clientDenied ? agentDenied && clientDenied ? " (Note: Using IP-based location - device geolocation not available)" : agentDenied ? " (Note: Agent using IP-based location - device geolocation not available)" : " (Note: Client using IP-based location - device geolocation not available)" : "";
  if (!agentData.ip || !clientData.ip) {
    const missing = !agentData.ip && !clientData.ip ? "both agent and client IPs" : !agentData.ip ? "agent IP" : "client IP";
    return {
      isValid: true,
      // Don't flag as invalid, just pending
      flagStatus: "pending",
      confidence: 0,
      reason: `Cannot analyze - ${missing} not captured`,
      details: {
        sameIp: false,
        sameCity: false,
        sameRegion: false,
        sameCountry: false,
        distanceMiles: null,
        agentLocation: agentData.city ? `${agentData.city}, ${agentData.region}` : null,
        clientLocation: clientData.city ? `${clientData.city}, ${clientData.region}` : null,
        agentVpn: agentData.isVpn || false,
        clientVpn: clientData.isVpn || false
      }
    };
  }
  const agentIp = agentData.ip.trim().toLowerCase();
  const clientIp = clientData.ip.trim().toLowerCase();
  const sameIp = agentIp === clientIp;
  const GOOGLE_HQ_LAT = 37.4225;
  const GOOGLE_HQ_LON = -122.085;
  const GOOGLE_HQ_TOLERANCE = 0.01;
  const isGoogleHQ = (lat, lon) => {
    if (!lat || !lon) return false;
    const latNum = typeof lat === "string" ? parseFloat(lat) : lat;
    const lonNum = typeof lon === "string" ? parseFloat(lon) : lon;
    if (isNaN(latNum) || isNaN(lonNum)) return false;
    return Math.abs(latNum - GOOGLE_HQ_LAT) < GOOGLE_HQ_TOLERANCE && Math.abs(lonNum - GOOGLE_HQ_LON) < GOOGLE_HQ_TOLERANCE;
  };
  const agentAtGoogleHQ = isGoogleHQ(agentData.latitude, agentData.longitude);
  const clientAtGoogleHQ = isGoogleHQ(clientData.latitude, clientData.longitude);
  const sameCity = !!(agentData.city && clientData.city && agentData.city.toLowerCase() === clientData.city.toLowerCase());
  const sameRegion = !!(agentData.region && clientData.region && agentData.region.toLowerCase() === clientData.region.toLowerCase());
  const sameCountry = !!(agentData.country && clientData.country && agentData.country.toLowerCase() === clientData.country.toLowerCase());
  let distanceMiles = null;
  if (agentData.latitude && agentData.longitude && clientData.latitude && clientData.longitude) {
    const agentLat = parseFloat(agentData.latitude);
    const agentLon = parseFloat(agentData.longitude);
    const clientLat = parseFloat(clientData.latitude);
    const clientLon = parseFloat(clientData.longitude);
    if (!isNaN(agentLat) && !isNaN(agentLon) && !isNaN(clientLat) && !isNaN(clientLon)) {
      distanceMiles = Math.round(calculateDistanceMiles(agentLat, agentLon, clientLat, clientLon));
    }
  }
  const agentLocation = agentData.city ? `${agentData.city}, ${agentData.region || ""}, ${agentData.country || ""}`.replace(/,\s*,/g, ",").replace(/,\s*$/, "") : null;
  const clientLocation = clientData.city ? `${clientData.city}, ${clientData.region || ""}, ${clientData.country || ""}`.replace(/,\s*,/g, ",").replace(/,\s*$/, "") : null;
  const agentVpn = agentData.isVpn === true;
  const clientVpn = clientData.isVpn === true;
  let flagStatus;
  let isValid;
  let confidence;
  let reason;
  if (agentAtGoogleHQ || clientAtGoogleHQ) {
    flagStatus = "suspicious";
    isValid = false;
    confidence = 0.9;
    const who = agentAtGoogleHQ && clientAtGoogleHQ ? "Both agent and client" : agentAtGoogleHQ ? "Agent" : "Client";
    reason = `SUSPICIOUS: ${who} location shows Google Headquarters (Mountain View, CA). This is likely a spoofed/default location or Google Cloud IP.`;
    return {
      isValid,
      flagStatus,
      confidence,
      reason,
      details: {
        sameIp,
        sameCity,
        sameRegion,
        sameCountry,
        distanceMiles,
        agentLocation,
        clientLocation,
        agentVpn: agentVpn || false,
        clientVpn: clientVpn || false
      }
    };
  }
  const clientInNY = clientData.region?.toLowerCase().includes("new york") || clientData.city?.toLowerCase().includes("new york") || clientData.region === "New York" || clientData.region === "NY";
  const agentInNY = agentData.region?.toLowerCase().includes("new york") || agentData.city?.toLowerCase().includes("new york") || agentData.region === "New York" || agentData.region === "NY";
  let stateMismatch = false;
  let stateMismatchReason = "";
  if (declaredState && clientData.region) {
    const normalizedDeclared = normalizeState(declaredState);
    const normalizedIPState = normalizeState(clientData.region);
    if (normalizedDeclared && normalizedIPState) {
      stateMismatch = normalizedDeclared.toLowerCase() !== normalizedIPState.toLowerCase();
      if (stateMismatch) {
        stateMismatchReason = `Client IP location (${clientData.region}) does not match declared state (${declaredState})`;
      }
    }
  }
  const vpnWarnings = [];
  const shouldFlagAgentVpn = agentVpn && !hasAgentGps;
  const shouldFlagClientVpn = clientVpn && !hasClientGps;
  if (shouldFlagAgentVpn) {
    vpnWarnings.push(`Agent using VPN/Proxy (${agentData.vpnDetectionReason || "detected"})`);
  }
  if (shouldFlagClientVpn) {
    vpnWarnings.push(`Client using VPN/Proxy (${clientData.vpnDetectionReason || "detected"})`);
  }
  const vpnWarning = vpnWarnings.length > 0 ? ` \u26A0\uFE0F ${vpnWarnings.join(", ")}.` : "";
  if (clientInNY) {
    flagStatus = "flagged";
    isValid = false;
    confidence = 1;
    reason = `FLAGGED: Client IP is in New York (${clientData.city || clientData.region || "NY"}). Business cannot be accepted from New York.`;
  } else if (shouldFlagClientVpn || shouldFlagAgentVpn) {
    flagStatus = "flagged";
    isValid = false;
    confidence = 0.95;
    reason = `FLAGGED: ${vpnWarnings.join(" and ")} detected. VPN usage flags the session for review.${vpnWarning}`;
  } else if (stateMismatch) {
    flagStatus = "flagged";
    isValid = true;
    confidence = 0.9;
    reason = `INFO: ${stateMismatchReason}. This is informational only - IP location does not affect validation.`;
  } else if (sameIp) {
    flagStatus = "critical";
    isValid = false;
    confidence = 0.99;
    reason = `CRITICAL: Agent and client have SAME IP address (${agentIp}). This is highly suspicious - agent may be impersonating client.${vpnWarning}`;
  } else if (shouldFlagAgentVpn && shouldFlagClientVpn && sameCity) {
    flagStatus = "critical";
    isValid = false;
    confidence = 0.95;
    reason = `CRITICAL: Both agent and client using VPN/Proxy AND in SAME CITY (${agentData.city}). This is highly suspicious - may be coordinated fraud.${vpnWarning}`;
  } else if (sameCity) {
    flagStatus = "flagged";
    isValid = false;
    confidence = 0.85;
    reason = `FLAGGED: Agent and client in SAME CITY (${agentData.city}). Agents do Zoom presentations so should not be in same location as client.${vpnWarning}`;
  } else if (distanceMiles !== null && distanceMiles < 10) {
    flagStatus = "flagged";
    isValid = false;
    confidence = 0.85;
    reason = `FLAGGED: Agent and client are only ${distanceMiles} miles apart. Agents do Zoom presentations so should not be in close proximity.`;
  } else if (distanceMiles !== null && distanceMiles < 60) {
    flagStatus = "suspicious";
    isValid = false;
    confidence = 0.7;
    reason = `SUSPICIOUS: Agent and client are ${distanceMiles} miles apart. Closer than typical for Zoom presentations.${geolocationNote}`;
  } else if (sameRegion) {
    flagStatus = "valid";
    isValid = true;
    confidence = 0.9;
    const distanceStr = distanceMiles !== null ? ` (${distanceMiles} miles apart)` : "";
    const regionNote = ` Both in ${agentData.region} region.`;
    reason = `VALID: Agent and client in different locations${distanceStr}.${regionNote} This is expected for Zoom presentations.${geolocationNote}`;
  } else {
    flagStatus = "valid";
    isValid = true;
    confidence = 0.95;
    const distanceStr = distanceMiles !== null ? ` (${distanceMiles} miles apart)` : "";
    reason = `VALID: Agent and client in different locations${distanceStr}. This is expected for Zoom presentations.${geolocationNote}`;
  }
  return {
    isValid,
    flagStatus,
    confidence,
    reason,
    details: {
      sameIp,
      sameCity,
      sameRegion,
      sameCountry,
      distanceMiles,
      agentLocation,
      clientLocation,
      // GPS overrides IP-based VPN detection - only show VPN if GPS not available
      agentVpn: shouldFlagAgentVpn || false,
      clientVpn: shouldFlagClientVpn || false
    }
  };
}
function getRealIP(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const realIp = req.headers["x-real-ip"];
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  const trueClientIp = req.headers["true-client-ip"];
  if (forwardedFor) {
    const ips = typeof forwardedFor === "string" ? forwardedFor.split(",").map((ip) => ip.trim()) : forwardedFor;
    const clientIp = Array.isArray(ips) ? ips[0] : forwardedFor;
    if (clientIp && clientIp !== "::1" && clientIp !== "127.0.0.1") {
      return clientIp;
    }
  }
  if (cfConnectingIp && cfConnectingIp !== "::1" && cfConnectingIp !== "127.0.0.1") {
    return typeof cfConnectingIp === "string" ? cfConnectingIp : cfConnectingIp[0];
  }
  if (trueClientIp && trueClientIp !== "::1" && trueClientIp !== "127.0.0.1") {
    return typeof trueClientIp === "string" ? trueClientIp : trueClientIp[0];
  }
  if (realIp && realIp !== "::1" && realIp !== "127.0.0.1") {
    return typeof realIp === "string" ? realIp : realIp[0];
  }
  const reqIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
  if (reqIp === "::1" || reqIp === "::ffff:127.0.0.1") {
    return "127.0.0.1";
  }
  if (reqIp && reqIp.startsWith("::ffff:")) {
    return reqIp.substring(7);
  }
  return reqIp || "unknown";
}
function detectVpnFromIsp(isp) {
  if (!isp) {
    return { isVpn: false, reason: "No ISP data" };
  }
  const ispLower = isp.toLowerCase();
  const vpnKeywords = [
    "vpn",
    "proxy",
    "hosting",
    "datacenter",
    "data center",
    "server",
    "cloud",
    "aws",
    "azure",
    "gcp",
    "google cloud",
    "amazon",
    "digitalocean",
    "linode",
    "vultr",
    "ovh",
    "hetzner",
    "contabo",
    "leaseweb",
    "ramnode",
    "buyvm",
    "nordvpn",
    "expressvpn",
    "surfshark",
    "cyberghost",
    "private internet access",
    "ipvanish",
    "protonvpn",
    "tunnelbear",
    "windscribe",
    "mullvad",
    "hide.me",
    "tor",
    "tor network",
    "onion",
    "anonymous",
    "privacy",
    "anonymizer"
  ];
  for (const keyword of vpnKeywords) {
    if (ispLower.includes(keyword)) {
      return {
        isVpn: true,
        reason: `ISP name contains "${keyword}" indicator`
      };
    }
  }
  return { isVpn: false, reason: "No VPN indicators found in ISP name" };
}
async function getIPGeolocation(ip) {
  if (!ip || ip === "unknown" || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    console.log(`\u26A0\uFE0F Skipping geolocation for local/private IP: ${ip}`);
    return null;
  }
  const { IPINFO_API_KEY: IPINFO_API_KEY2 } = await Promise.resolve().then(() => (init_hardcoded_config(), hardcoded_config_exports));
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5e3);
    const ipinfoResponse = await fetch(
      `https://ipinfo.io/${ip}?token=${IPINFO_API_KEY2}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (ipinfoResponse.ok) {
      const ipinfoData = await ipinfoResponse.json();
      if (ipinfoData && !ipinfoData.error && ipinfoData.country) {
        let lat = null;
        let lon = null;
        if (ipinfoData.loc) {
          const [latStr, lonStr] = ipinfoData.loc.split(",");
          lat = parseFloat(latStr);
          lon = parseFloat(lonStr);
          if (isNaN(lat) || isNaN(lon)) {
            lat = null;
            lon = null;
          }
        }
        const ispVpnDetection = detectVpnFromIsp(ipinfoData.org || ipinfoData.asn?.name || null);
        const isVpn = ipinfoData.is_anonymous || ipinfoData.is_hosting || ispVpnDetection.isVpn;
        const isProxy = ipinfoData.is_anonymous || false;
        const isHosting = ipinfoData.is_hosting || false;
        let vpnReason = "";
        if (ipinfoData.is_anonymous) {
          vpnReason = "IP flagged as anonymous/proxy by ipinfo.io";
        } else if (ipinfoData.is_hosting) {
          vpnReason = "IP flagged as hosting/datacenter by ipinfo.io";
        } else if (ispVpnDetection.isVpn) {
          vpnReason = ispVpnDetection.reason;
        }
        console.log(`\u2705 ipinfo.io geolocation for ${ip}:`, {
          city: ipinfoData.city,
          region: ipinfoData.region,
          country: ipinfoData.country,
          isp: ipinfoData.org || ipinfoData.asn?.name,
          isVpn,
          isProxy,
          isHosting
        });
        return {
          country: ipinfoData.country || null,
          regionName: ipinfoData.region || null,
          city: ipinfoData.city || null,
          lat,
          lon,
          timezone: ipinfoData.timezone || null,
          isp: ipinfoData.org || ipinfoData.asn?.name || null,
          isVpn: isVpn || null,
          isProxy: isProxy || null,
          isHosting: isHosting || null,
          vpnDetectionReason: vpnReason || null
        };
      } else {
        console.warn(`\u26A0\uFE0F ipinfo.io returned error for ${ip}:`, ipinfoData?.error || "Invalid response");
        return null;
      }
    } else {
      console.warn(`\u26A0\uFE0F ipinfo.io lookup failed for ${ip}: HTTP ${ipinfoResponse.status}`);
      return null;
    }
  } catch (ipinfoError) {
    console.error(`\u274C ipinfo.io lookup error for ${ip}:`, ipinfoError);
    return null;
  }
}
async function getPublicIP() {
  try {
    const services = [
      "https://api.ipify.org?format=json",
      "https://api.ip.sb/ip",
      "https://icanhazip.com"
    ];
    for (const service of services) {
      try {
        const response = await fetch(service, {
          signal: AbortSignal.timeout(5e3)
          // 5 second timeout
        });
        if (response.ok) {
          const text3 = await response.text();
          if (text3.startsWith("{")) {
            const data = JSON.parse(text3);
            return data.ip;
          }
          return text3.trim();
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to get public IP:", error);
    return null;
  }
}
var STATE_ABBREVIATIONS;
var init_ip_analysis_service = __esm({
  "server/ip-analysis-service.ts"() {
    "use strict";
    STATE_ABBREVIATIONS = {
      "AL": "Alabama",
      "AK": "Alaska",
      "AZ": "Arizona",
      "AR": "Arkansas",
      "CA": "California",
      "CO": "Colorado",
      "CT": "Connecticut",
      "DE": "Delaware",
      "FL": "Florida",
      "GA": "Georgia",
      "HI": "Hawaii",
      "ID": "Idaho",
      "IL": "Illinois",
      "IN": "Indiana",
      "IA": "Iowa",
      "KS": "Kansas",
      "KY": "Kentucky",
      "LA": "Louisiana",
      "ME": "Maine",
      "MD": "Maryland",
      "MA": "Massachusetts",
      "MI": "Michigan",
      "MN": "Minnesota",
      "MS": "Mississippi",
      "MO": "Missouri",
      "MT": "Montana",
      "NE": "Nebraska",
      "NV": "Nevada",
      "NH": "New Hampshire",
      "NJ": "New Jersey",
      "NM": "New Mexico",
      "NY": "New York",
      "NC": "North Carolina",
      "ND": "North Dakota",
      "OH": "Ohio",
      "OK": "Oklahoma",
      "OR": "Oregon",
      "PA": "Pennsylvania",
      "RI": "Rhode Island",
      "SC": "South Carolina",
      "SD": "South Dakota",
      "TN": "Tennessee",
      "TX": "Texas",
      "UT": "Utah",
      "VT": "Vermont",
      "VA": "Virginia",
      "WA": "Washington",
      "WV": "West Virginia",
      "WI": "Wisconsin",
      "WY": "Wyoming"
    };
    console.log("\u2705 IP Analysis Service loaded");
  }
});

// server/agent-activity-tracker.ts
var agent_activity_tracker_exports = {};
__export(agent_activity_tracker_exports, {
  heartbeat: () => heartbeat,
  initializeAgentSession: () => initializeAgentSession,
  logAgentActivity: () => logAgentActivity,
  updateAgentStatus: () => updateAgentStatus
});
async function logAgentActivity(client, params) {
  const now = params.startedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const { error } = await client.from("agent_activity_log").insert({
    agent_email: params.agentEmail.toLowerCase(),
    activity_type: params.activityType,
    session_id: params.sessionId ?? null,
    page_path: params.pagePath ?? null,
    feature: params.feature ?? null,
    started_at: now,
    metadata: params.metadata ?? null
  });
  if (error) {
    console.error("logAgentActivity failed", error, params);
  } else {
    console.log(`\u2705 Activity logged: ${params.activityType} for ${params.agentEmail}`);
  }
}
async function initializeAgentSession(client, params) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { error } = await client.from("agent_sessions").upsert({
    agent_email: params.agentEmail.toLowerCase(),
    session_id: params.sessionId,
    current_status: "active",
    last_activity_at: now,
    last_heartbeat_at: now,
    total_active_seconds: 0,
    total_idle_seconds: 0,
    total_call_seconds: 0,
    total_presentation_seconds: 0,
    metadata: params.metadata ?? null,
    updated_at: now
  }, {
    onConflict: "session_id"
  });
  if (error) {
    console.error("initializeAgentSession failed", error, params);
  } else {
    console.log(`\u2705 Session initialized: ${params.agentEmail} (session: ${params.sessionId})`);
  }
}
async function updateAgentStatus(client, params) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { data: currentSession } = await client.from("agent_sessions").select("current_status, last_activity_at, total_active_seconds, total_idle_seconds, total_call_seconds, total_presentation_seconds").eq("session_id", params.sessionId).eq("agent_email", params.agentEmail.toLowerCase()).maybeSingle();
  if (currentSession) {
    const lastActivity = currentSession.last_activity_at ? new Date(currentSession.last_activity_at) : new Date(now);
    const durationSeconds = Math.floor((new Date(now).getTime() - lastActivity.getTime()) / 1e3);
    if (currentSession.current_status !== params.status && durationSeconds > 0) {
      await logAgentActivity(client, {
        agentEmail: params.agentEmail,
        activityType: currentSession.current_status,
        sessionId: params.sessionId,
        pagePath: params.pagePath,
        feature: params.feature,
        metadata: params.metadata,
        startedAt: currentSession.last_activity_at || now
      });
      const updates = {
        current_status: params.status,
        last_activity_at: now,
        last_heartbeat_at: now,
        current_page: params.pagePath ?? null,
        current_feature: params.feature ?? null,
        updated_at: now
      };
      if (currentSession.current_status === "active" || currentSession.current_status === "browsing") {
        updates.total_active_seconds = (currentSession.total_active_seconds || 0) + durationSeconds;
      } else if (currentSession.current_status === "idle" || currentSession.current_status === "away") {
        updates.total_idle_seconds = (currentSession.total_idle_seconds || 0) + durationSeconds;
      } else if (currentSession.current_status === "on_call") {
        updates.total_call_seconds = (currentSession.total_call_seconds || 0) + durationSeconds;
      } else if (currentSession.current_status === "on_presentation") {
        updates.total_presentation_seconds = (currentSession.total_presentation_seconds || 0) + durationSeconds;
      }
      const { error } = await client.from("agent_sessions").update(updates).eq("session_id", params.sessionId).eq("agent_email", params.agentEmail.toLowerCase());
      if (error) {
        console.error("updateAgentStatus failed", error, params);
      } else {
        console.log(`\u2705 Status updated: ${params.agentEmail} ${currentSession.current_status} -> ${params.status} (${durationSeconds}s)`);
      }
    } else {
      const { error } = await client.from("agent_sessions").update({
        last_activity_at: now,
        last_heartbeat_at: now,
        current_page: params.pagePath ?? null,
        current_feature: params.feature ?? null,
        updated_at: now
      }).eq("session_id", params.sessionId).eq("agent_email", params.agentEmail.toLowerCase());
      if (error) {
        console.error("updateAgentStatus heartbeat failed", error, params);
      }
    }
  } else {
    await initializeAgentSession(client, {
      agentEmail: params.agentEmail,
      sessionId: params.sessionId,
      metadata: params.metadata
    });
  }
}
async function heartbeat(client, params) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const status = params.isActive ? "active" : "idle";
  await updateAgentStatus(client, {
    agentEmail: params.agentEmail,
    sessionId: params.sessionId,
    status,
    pagePath: params.pagePath,
    feature: params.feature,
    metadata: params.metadata
  });
}
var init_agent_activity_tracker = __esm({
  "server/agent-activity-tracker.ts"() {
    "use strict";
  }
});

// server/email.ts
import Mailgun from "mailgun.js";
import formData from "form-data";
async function sendEmail(params) {
  try {
    console.log("\u{1F4E7} SENDING EMAIL to", params.to);
    const success = await sendWithMailgun(params);
    if (success) {
      console.log(`\u2705 Email sent successfully to ${params.to}`);
      return true;
    } else {
      console.log("\u{1F4E7} MAILGUN FAILED - SIMULATION MODE for email:");
      console.log(`  To: ${params.to}`);
      console.log(`  Subject: ${params.subject}`);
      console.log(`  Message: ${params.text || "HTML content provided"}`);
      console.log('\u2705 Email "sent" in simulation mode - billing system will continue working');
      return true;
    }
  } catch (error) {
    console.log("\u{1F4E7} EMAIL SYSTEM ERROR - SIMULATION MODE:");
    console.log(`  To: ${params.to}`);
    console.log(`  Subject: ${params.subject}`);
    console.log(`  Error: ${error}`);
    console.log('\u2705 Email "sent" in simulation mode - system continues working');
    return true;
  }
}
var MAILGUN_CONFIG, mailgun, mg, sendWithMailgun;
var init_email = __esm({
  "server/email.ts"() {
    "use strict";
    MAILGUN_CONFIG = {
      apiKey: process.env.MAILGUN_API_KEY || "aa22ca853877ae0e08f8cca8f345059e-653fadca-9577b24a",
      domain: process.env.MAILGUN_DOMAIN || "mg.connectnow.one",
      from: "AO Intelligence <noreply@mg.connectnow.one>"
    };
    mailgun = new Mailgun(formData);
    mg = mailgun.client({
      username: "api",
      key: MAILGUN_CONFIG.apiKey,
      url: "https://api.mailgun.net"
    });
    sendWithMailgun = async (params) => {
      try {
        console.log("\u{1F4E7} Sending email via Mailgun...");
        const emailData = {
          from: params.from || MAILGUN_CONFIG.from,
          to: params.to,
          subject: params.subject,
          text: params.text,
          html: params.html || `<p>${params.text}</p>`
        };
        const result = await mg.messages.create(MAILGUN_CONFIG.domain, emailData);
        console.log("\u2705 Email sent via Mailgun:", {
          to: params.to,
          subject: params.subject,
          messageId: result.id,
          status: result.message
        });
        return true;
      } catch (error) {
        console.error("\u274C Mailgun email error:", error);
        return false;
      }
    };
  }
});

// server/sms-service.ts
var sms_service_exports = {};
__export(sms_service_exports, {
  default: () => sms_service_default,
  smsService: () => smsService
});
import twilio from "twilio";
var accountSid, authToken, twilioPhoneNumber, SMSService, smsService, sms_service_default;
var init_sms_service = __esm({
  "server/sms-service.ts"() {
    "use strict";
    init_hardcoded_config();
    accountSid = TWILIO_ACCOUNT_SID;
    authToken = TWILIO_AUTH_TOKEN;
    twilioPhoneNumber = TWILIO_PHONE_NUMBER;
    SMSService = class {
      client = null;
      constructor() {
        if (accountSid && authToken) {
          this.client = twilio(accountSid, authToken);
        }
      }
      async sendVerificationSMS(phone, sessionId, clientName) {
        if (!this.client || !twilioPhoneNumber) {
          console.warn("Twilio not configured, skipping SMS send");
          return false;
        }
        const formattedPhone = this.formatToE164(phone);
        console.log(`Phone formatting: "${phone}" -> "${formattedPhone}"`);
        try {
          const message = `Hi ${clientName}, your agent is completing verification. Please contact them directly. AO Precheck`;
          const result = await this.client.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: formattedPhone
          });
          console.log("SMS sent successfully:", result.sid);
          console.log("SMS status:", result.status);
          console.log("SMS from:", result.from);
          console.log("SMS to:", result.to);
          return true;
        } catch (error) {
          console.error("Failed to send SMS:", error);
          if (error.code === 21266) {
            console.error("ERROR: Cannot send SMS to the same number that is sending. Use a different client phone number.");
          }
          if (error.code === 21608) {
            console.error("ERROR: Trial account can only send to verified numbers. Verify the phone number in Twilio Console.");
          }
          return false;
        }
      }
      // Format phone number to E.164 format (+1XXXXXXXXXX)
      formatToE164(phoneNumber) {
        const digits = phoneNumber.replace(/\D/g, "");
        if (digits.length === 10) {
          return `+1${digits}`;
        } else if (digits.length === 11 && digits.startsWith("1")) {
          return `+${digits}`;
        }
        if (phoneNumber.startsWith("+")) {
          return phoneNumber;
        }
        return `+1${digits}`;
      }
      // Send appointment invite via SMS
      async sendAppointmentInvite(phone, clientName, meetingLink, appointmentTime, agentName, agentEmail) {
        if (!this.client || !twilioPhoneNumber) {
          console.warn("Twilio not configured, skipping SMS send");
          return false;
        }
        const formattedPhone = this.formatToE164(phone);
        console.log(`Sending appointment invite to: "${phone}" -> "${formattedPhone}"`);
        try {
          const timeStr = appointmentTime.toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short"
          });
          let cleanAgentName = agentName && agentName.trim() && !agentName.includes("undefined") ? agentName.trim() : null;
          if (!cleanAgentName && agentEmail) {
            cleanAgentName = agentEmail.split("@")[0].replace(/[._-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
          }
          const message = `Hi ${clientName}, your virtual appointment${cleanAgentName ? ` with ${cleanAgentName}` : ""} is scheduled for ${timeStr}. Join here: ${meetingLink}`;
          const result = await this.client.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: formattedPhone
          });
          console.log("Appointment invite SMS sent successfully:", result.sid);
          return true;
        } catch (error) {
          console.error("Failed to send appointment invite SMS:", error);
          return false;
        }
      }
      // Generic SMS sending method
      async sendSMS(phone, message) {
        if (!this.client || !twilioPhoneNumber) {
          console.warn("Twilio not configured, skipping SMS send");
          return false;
        }
        const formattedPhone = this.formatToE164(phone);
        console.log(`Sending SMS to: "${phone}" -> "${formattedPhone}"`);
        try {
          const result = await this.client.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: formattedPhone
          });
          console.log("SMS sent successfully:", result.sid);
          return true;
        } catch (error) {
          console.error("Failed to send SMS:", error);
          return false;
        }
      }
      generateVerificationCode() {
        return Math.floor(1e5 + Math.random() * 9e5).toString();
      }
    };
    smsService = new SMSService();
    sms_service_default = smsService;
  }
});

// server/email-verification-service.ts
var email_verification_service_exports = {};
__export(email_verification_service_exports, {
  EmailVerificationService: () => EmailVerificationService,
  emailVerificationService: () => emailVerificationService
});
var emailVerificationCodes, EmailVerificationService, emailVerificationService;
var init_email_verification_service = __esm({
  "server/email-verification-service.ts"() {
    "use strict";
    init_email();
    init_supabase();
    emailVerificationCodes = /* @__PURE__ */ new Map();
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of emailVerificationCodes.entries()) {
        if (value.expires < now) {
          emailVerificationCodes.delete(key);
        }
      }
    }, 5 * 60 * 1e3);
    EmailVerificationService = class {
      /**
       * Generate a 6-digit verification code
       */
      generateVerificationCode() {
        return Math.floor(1e5 + Math.random() * 9e5).toString();
      }
      /**
       * Send verification email to new user
       * Sends to BOTH @aoglobelife.com email AND personal_email from customer profile
       * Optionally sends SMS if phone is available in customer profile
       */
      async sendVerificationEmail(email, firstName) {
        try {
          const normalizedEmail = email.toLowerCase().trim();
          const code = this.generateVerificationCode();
          const codeKey = `${normalizedEmail}_${Date.now()}`;
          emailVerificationCodes.set(codeKey, {
            code,
            email: normalizedEmail,
            expires: Date.now() + 15 * 60 * 1e3
            // 15 minutes
          });
          for (const [key, value] of emailVerificationCodes.entries()) {
            if (value.email === normalizedEmail && value.expires < Date.now()) {
              emailVerificationCodes.delete(key);
            }
          }
          let personalEmail = null;
          let phoneNumber = null;
          if (supabaseAdmin) {
            try {
              const { data: customer } = await supabaseAdmin.from("customers").select("personal_email, phone, company_email").or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`).maybeSingle();
              if (customer) {
                if (customer.personal_email && customer.personal_email.toLowerCase() !== normalizedEmail && customer.personal_email.trim() !== "") {
                  personalEmail = customer.personal_email.toLowerCase().trim();
                }
                if (customer.phone && customer.phone.trim() !== "" && customer.phone !== "+1-555-0000" && customer.phone.replace(/\D/g, "").length >= 10) {
                  phoneNumber = customer.phone;
                }
              }
            } catch (customerError) {
              console.warn("\u26A0\uFE0F Could not lookup customer profile for verification:", customerError);
            }
          }
          const displayName = firstName || email.split("@")[0];
          const emailHtml = this.generateVerificationEmailHTML(displayName, code);
          const emailText = `Welcome to AO Intelligence! Your verification code is: ${code}. This code expires in 15 minutes.`;
          let primaryEmailSent = false;
          try {
            primaryEmailSent = await sendEmail({
              to: normalizedEmail,
              subject: "\u{1F680} Welcome to AO Intelligence - Verify Your Email",
              html: emailHtml,
              text: emailText
            });
            if (primaryEmailSent) {
              console.log(`\u2705 Verification email sent to primary email: ${normalizedEmail}`);
            }
          } catch (primaryError) {
            console.error(`\u274C Failed to send verification email to primary email ${normalizedEmail}:`, primaryError);
          }
          let personalEmailSent = false;
          if (personalEmail && personalEmail !== normalizedEmail) {
            try {
              personalEmailSent = await sendEmail({
                to: personalEmail,
                subject: "\u{1F680} Welcome to AO Intelligence - Verify Your Email",
                html: emailHtml,
                text: emailText
              });
              if (personalEmailSent) {
                console.log(`\u2705 Verification email sent to personal email: ${personalEmail}`);
              }
            } catch (personalError) {
              console.error(`\u274C Failed to send verification email to personal email ${personalEmail}:`, personalError);
            }
          }
          let smsSent = false;
          if (phoneNumber) {
            try {
              const { smsService: smsService2 } = await Promise.resolve().then(() => (init_sms_service(), sms_service_exports));
              const smsMessage = `Your AO Intelligence verification code is: ${code}. This code expires in 15 minutes. Do not share this code.`;
              smsSent = await smsService2.sendSMS(phoneNumber, smsMessage);
              if (smsSent) {
                console.log(`\u2705 Verification code sent via SMS to: ${phoneNumber}`);
              } else {
                console.warn(`\u26A0\uFE0F Failed to send verification SMS to: ${phoneNumber}`);
              }
            } catch (smsError) {
              console.warn("\u26A0\uFE0F Error sending verification SMS (non-critical):", smsError);
            }
          }
          if (primaryEmailSent || personalEmailSent) {
            console.log(`\u2705 Verification sent successfully - Primary: ${primaryEmailSent}, Personal: ${personalEmailSent}, SMS: ${smsSent}`);
            return { success: true, code };
          } else {
            console.error(`\u274C Failed to send verification to any email address`);
            return { success: false, error: "Failed to send verification email" };
          }
        } catch (error) {
          console.error("\u274C Error sending verification email:", error);
          return { success: false, error: error.message || "Failed to send verification email" };
        }
      }
      /**
       * Verify email code
       */
      async verifyCode(email, code) {
        try {
          const normalizedEmail = email.toLowerCase().trim();
          let foundEntry = null;
          let foundKey = null;
          for (const [key, value] of emailVerificationCodes.entries()) {
            if (value.email === normalizedEmail && value.code === code && value.expires > Date.now()) {
              foundEntry = value;
              foundKey = key;
              break;
            }
          }
          if (!foundEntry) {
            return { success: false, error: "Invalid or expired verification code" };
          }
          if (foundKey) {
            emailVerificationCodes.delete(foundKey);
          }
          return { success: true };
        } catch (error) {
          console.error("\u274C Error verifying code:", error);
          return { success: false, error: error.message || "Verification failed" };
        }
      }
      /**
       * Generate beautiful verification email HTML
       */
      generateVerificationEmailHTML(displayName, code) {
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - AO Intelligence</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 600px; width: 100%; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                <span style="font-size: 40px;">\u{1F680}</span>
              </div>
              <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">Welcome to AO Intelligence!</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 18px;">Let's get you verified</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 18px; color: #2d3748; line-height: 1.6;">
                Hi ${displayName},
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #4a5568; line-height: 1.6;">
                Welcome to AO Intelligence! We're excited to have you on board. To complete your account setup and start connecting with clients, please verify your email address using the code below.
              </p>
              
              <!-- Verification Code Box -->
              <div style="background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%); border: 2px solid #667eea; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="margin: 0 0 15px 0; font-size: 14px; color: #667eea; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                <div style="background: white; border-radius: 8px; padding: 20px; display: inline-block; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);">
                  <span style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</span>
                </div>
                <p style="margin: 15px 0 0 0; font-size: 12px; color: #718096;">This code expires in 15 minutes</p>
              </div>
              
              <p style="margin: 30px 0 0 0; font-size: 16px; color: #4a5568; line-height: 1.6;">
                Enter this code in the verification screen to complete your account setup. Once verified, you'll have full access to all AO Intelligence features.
              </p>
              
              <!-- Info Box -->
              <div style="background: #f7fafc; border-left: 4px solid #667eea; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="margin: 0; font-size: 14px; color: #4a5568; line-height: 1.6;">
                  <strong style="color: #667eea;">\u{1F4A1} Tip:</strong> If you didn't request this verification code, you can safely ignore this email. Your account will remain secure.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #718096;">
                <strong style="color: #2d3748;">AO Intelligence</strong> | Empowering Agents, Connecting Clients
              </p>
              <p style="margin: 0; font-size: 12px; color: #a0aec0;">
                This is an automated email. Please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
      }
    };
    emailVerificationService = new EmailVerificationService();
  }
});

// server/entry-auth.ts
import http from "http";

// server/setup-app.ts
init_hardcoded_config();
import express2 from "express";
import path3 from "path";
import fs2 from "fs";
import session from "express-session";

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var isReplit = Boolean(process.env.REPL_ID || process.env.REPLIT);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    // Replit-only: local dev this overlay + external replit banner often cause noisy reloads / bad UX
    ...isReplit ? [runtimeErrorOverlay()] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets")
    },
    // Ensure proper module resolution across Node versions
    dedupe: ["lucide-react", "react", "react-dom"]
  },
  root: "client",
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    sourcemap: false,
    // faster deploys; enable only when debugging
    // Ensure all imports are properly resolved regardless of Node version
    commonjsOptions: {
      include: [/lucide-react/, /node_modules/],
      transformMixedEsModules: true
    },
    // Add build timestamp to filenames for cache busting
    rollupOptions: {
      output: {
        // Vite already adds hashes to filenames, but ensure they're always unique
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5e3,
    strictPort: true,
    allowedHosts: true,
    hmr: false,
    // Disable HMR to prevent WebSocket connection errors
    watch: {
      usePolling: false,
      // Avoid rebuild storms when Node touches logs, server TS, JWT cache, etc. (root is `client`, paths are relative to it)
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "../server/**",
        "../dist/**",
        "../attached_assets/**",
        "../*.log",
        "../hppro_jwt_cache.json",
        "../**/.cursor/**"
      ]
    },
    fs: {
      strict: true,
      deny: ["**/.*"]
    },
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true
      },
      "/socket.io": {
        target: "http://localhost:5001",
        ws: true
      }
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
var MAIN_TSX_CACHE_BUST = nanoid(8);
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const testFiles = [
    "test-webrtc-comprehensive-diagnostics.html",
    "test-webrtc-registration.html",
    "test-webrtc-call.html",
    "test-webrtc-speed.html"
  ];
  testFiles.forEach((testFile) => {
    app2.get(`/${testFile}`, async (req, res) => {
      try {
        const clientPublicPath = path2.resolve(import.meta.dirname, "..", "client", "public", testFile);
        const rootPath = path2.resolve(import.meta.dirname, "..", "..", testFile);
        let filePath = null;
        try {
          await fs.promises.access(clientPublicPath);
          filePath = clientPublicPath;
        } catch {
          try {
            await fs.promises.access(rootPath);
            filePath = rootPath;
          } catch {
          }
        }
        if (filePath) {
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.sendFile(filePath);
        } else {
          res.status(404).send(`Test file not found: ${testFile}`);
        }
      } catch (error) {
        console.error(`Error serving ${testFile}:`, error);
        res.status(500).send(`Error serving test file: ${error}`);
      }
    });
  });
  const resolvedDevPort = Number(process.env.PORT || 5e3);
  const hmrHost = String(process.env.VITE_HMR_HOST || "localhost").trim() || "localhost";
  const hmrPort = Number(process.env.VITE_HMR_PORT || resolvedDevPort || 5e3);
  const serverOptions = {
    middlewareMode: true,
    hmr: {
      server,
      host: hmrHost,
      protocol: "ws",
      clientPort: hmrPort,
      port: hmrPort
    },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${MAIN_TSX_CACHE_BUST}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
var serveStatic = (app2, subDir = "public") => {
  const distPath = path2.resolve("dist", subDir);
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the production build. Ensure you've run the build command.`
    );
  }
  console.log("\u{1F9F9} Clearing static file cache for fresh deployment...");
  console.log("\u{1F4C1} Serving static files from:", distPath);
  app2.use(
    express.static(distPath, {
      index: false,
      // Don't serve index.html directly — catch-all below handles it with data injection
      maxAge: 0,
      etag: false,
      lastModified: false,
      setHeaders: (res, filePath) => {
        const p = filePath.replace(/\\/g, "/");
        if (p.includes("/assets/") && (/\.(js|css)(\?|$)/.test(p) || /-[a-f0-9]{8,}\.(js|css)/.test(p))) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    })
  );
  app2.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/webhook/")) return next();
    const indexPath = path2.join(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      console.error("\u274C index.html not found at:", indexPath);
      return res.status(500).send("Application build not found. Please rebuild the application.");
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Content-Type", "text/html");
    const dataUrl = process.env.AOIRAIL_DATA_SERVICE_URL || process.env.DATA_SERVICE_URL || (process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL}` : "");
    if (dataUrl) {
      try {
        const html = fs.readFileSync(indexPath, "utf8");
        const inject = `<script>window.__AOIRAIL_DATA_SERVICE_URL__=${JSON.stringify(dataUrl)};</script>`;
        const out = html.includes("</head>") ? html.replace("</head>", `${inject}</head>`) : `${inject}${html}`;
        return res.status(200).send(out);
      } catch {
      }
    }
    res.sendFile(indexPath);
  });
  console.log("\u2705 SPA routing configured - all non-API routes will serve index.html");
};

// server/setup-app.ts
process.env.TZ = "America/Los_Angeles";
function createApp(options = {}) {
  const { serveSpa = true } = options;
  const app2 = express2();
  app2.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
  app2.get("/dashboard", (_req, res) => res.redirect(302, "/dashboard/connect"));
  const isShellApp = process.env.SHELL_APP === "1";
  if (serveSpa) {
    let sendIndex2 = function(_req, res) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Content-Type", "text/html");
      res.sendFile(indexPath);
    };
    var sendIndex = sendIndex2;
    const isProd = NODE_ENV === "production";
    const distPath = path3.resolve(process.cwd(), "dist", isShellApp ? "shell-public" : "public");
    const indexPath = path3.join(distPath, "index.html");
    if (isProd && fs2.existsSync(indexPath)) {
      app2.get("/", sendIndex2);
      app2.get(/^\/dashboard\/.*/, sendIndex2);
    }
  }
  app2.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    if (req.path.endsWith(".html") || req.path.endsWith(".js") || req.path.endsWith(".css") || req.path === "/") {
      res.header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.header("Pragma", "no-cache");
      res.header("Expires", "0");
      res.header("ETag", "");
      res.header("Last-Modified", "");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app2.use("/uploads", express2.static(path3.join(process.cwd(), "uploads")));
  const attachedAssetsPath = path3.join(process.cwd(), "attached_assets");
  if (fs2.existsSync(attachedAssetsPath)) {
    app2.use("/attached_assets", express2.static(attachedAssetsPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".mp4")) {
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader("Accept-Ranges", "bytes");
        }
      }
    }));
  }
  app2.use(express2.json({ limit: "50mb" }));
  app2.use(express2.urlencoded({ extended: false, limit: "50mb" }));
  app2.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1e3,
        sameSite: "lax"
      }
    })
  );
  app2.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJsonResponse;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (reqPath.startsWith("/api")) {
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        if (logLine.length > 80) logLine = logLine.slice(0, 79) + "\u2026";
        log(logLine);
      }
    });
    next();
  });
  return app2;
}
function addErrorHandler(app2) {
  app2.use((err, _req, res, _next) => {
    const e = err;
    res.status(e?.status ?? e?.statusCode ?? 500).json({ message: e?.message ?? "Internal Server Error" });
    if (NODE_ENV !== "production") throw err;
  });
}
async function setupSpa(app2, server) {
  const isProd = NODE_ENV === "production" || app2.get("env") === "production";
  const shellStatic = process.env.SHELL_APP === "1";
  if (isProd) serveStatic(app2, shellStatic ? "shell-public" : "public");
  else await setupVite(app2, server);
}

// server/auth-service.ts
init_supabase();
import jwt from "jsonwebtoken";

// server/storage.ts
init_schema();
init_db();
init_supabase();
import { nanoid as nanoid2 } from "nanoid";
import { eq, and, sql as sql3 } from "drizzle-orm";

// server/local-masterlead-client.ts
init_db();
var knownColumns = /* @__PURE__ */ new Set();
var baseReady = false;
async function ensureBaseTable2() {
  if (baseReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS masterlead (
      id BIGSERIAL PRIMARY KEY,
      taalk_lead_id TEXT,
      phone TEXT,
      first_name TEXT,
      last_name TEXT,
      cn_email TEXT,
      cnresolution TEXT,
      last_contacted TIMESTAMPTZ,
      webhook_sent_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  try {
    await pool.query(`
      DO $$
      DECLARE
        id_data_type TEXT;
        has_default BOOLEAN;
        current_seq TEXT;
        next_seed BIGINT;
      BEGIN
        SELECT data_type, (column_default IS NOT NULL), pg_get_serial_sequence('masterlead', 'id')
        INTO id_data_type, has_default, current_seq
        FROM information_schema.columns
        WHERE table_name = 'masterlead' AND column_name = 'id'
        LIMIT 1;

        IF id_data_type IN ('bigint', 'integer', 'smallint') THEN
          IF current_seq IS NULL THEN
            CREATE SEQUENCE IF NOT EXISTS masterlead_id_seq;
            ALTER SEQUENCE masterlead_id_seq OWNED BY masterlead.id;
            ALTER TABLE masterlead ALTER COLUMN id SET DEFAULT nextval('masterlead_id_seq');
            SELECT COALESCE(MAX(id), 0) + 1 INTO next_seed FROM masterlead;
            PERFORM setval('masterlead_id_seq', next_seed, false);
          ELSIF has_default IS FALSE THEN
            EXECUTE format('ALTER TABLE masterlead ALTER COLUMN id SET DEFAULT nextval(%L)', current_seq);
          END IF;
        END IF;
      END $$;
    `);
  } catch (error) {
    console.warn("\u26A0\uFE0F Unable to enforce masterlead.id default sequence:", error);
  }
  const columns = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'masterlead'`
  );
  for (const row of columns.rows) knownColumns.add(String(row.column_name || "").toLowerCase());
  baseReady = true;
}
async function ensureColumns2(columns) {
  await ensureBaseTable2();
  for (const col of columns.map((c) => normalizeColumn2(c)).filter(Boolean)) {
    if (knownColumns.has(col)) continue;
    await pool.query(`ALTER TABLE masterlead ADD COLUMN IF NOT EXISTS "${col}" TEXT`);
    knownColumns.add(col);
  }
}
function normalizeColumn2(column) {
  const clean = String(column || "").trim().replace(/^"+|"+$/g, "");
  if (!clean) return clean;
  if (clean.includes("_")) return clean;
  return clean.toLowerCase();
}
function splitColumns2(columns) {
  return String(columns || "*").split(",").map((c) => normalizeColumn2(c.trim())).filter(Boolean);
}
function parseOrExpr2(expr) {
  const source = String(expr || "");
  const parts = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") depth += 1;
    if (ch === ")" && depth > 0) depth -= 1;
    if (ch === "," && depth === 0) {
      const piece = current.trim();
      if (piece) parts.push(piece);
      current = "";
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (tail) parts.push(tail);
  return parts;
}
function parseInList2(raw) {
  const trimmed = String(raw || "").trim().replace(/^\(/, "").replace(/\)$/, "");
  if (!trimmed) return [];
  return trimmed.split(",").map((x) => x.trim()).filter(Boolean);
}
var LocalMasterleadBuilder = class {
  mode = "select";
  selectColumns = "*";
  selectHead = false;
  selectCount = null;
  filters = [];
  orderBys = [];
  limitValue = null;
  offsetValue = null;
  singleType = null;
  updatePayload = null;
  insertPayload = [];
  upsertConflict = "id";
  upsertIgnoreDuplicates = false;
  referencedColumns = /* @__PURE__ */ new Set();
  addFilter(sql5, ...params) {
    this.filters.push({ sql: sql5, params });
    return this;
  }
  whereClause(startIndex = 1) {
    const values = [];
    let idx = startIndex;
    const parts = this.filters.map((f) => {
      const sql5 = f.sql.replace(/\?/g, () => `$${idx++}`);
      values.push(...f.params);
      return `(${sql5})`;
    });
    return {
      sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "",
      values,
      nextIndex: idx
    };
  }
  select(columns = "*", options) {
    this.mode = this.mode === "update" || this.mode === "insert" || this.mode === "upsert" || this.mode === "delete" ? this.mode : "select";
    this.selectColumns = columns || "*";
    if (this.selectColumns !== "*") {
      splitColumns2(this.selectColumns).forEach((c) => this.referencedColumns.add(c));
    }
    this.selectCount = options?.count || null;
    this.selectHead = !!options?.head;
    return this;
  }
  eq(column, value) {
    const col = normalizeColumn2(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') = COALESCE(?::text, '')`, value);
  }
  neq(column, value) {
    const col = normalizeColumn2(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') <> COALESCE(?::text, '')`, value);
  }
  gte(column, value) {
    const col = normalizeColumn2(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') >= COALESCE(?::text, '')`, value);
  }
  gt(column, value) {
    const col = normalizeColumn2(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') > COALESCE(?::text, '')`, value);
  }
  lte(column, value) {
    const col = normalizeColumn2(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') <= COALESCE(?::text, '')`, value);
  }
  lt(column, value) {
    const col = normalizeColumn2(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') < COALESCE(?::text, '')`, value);
  }
  ilike(column, pattern) {
    const col = normalizeColumn2(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') ILIKE COALESCE(?::text, '')`, pattern);
  }
  in(column, values) {
    if (!Array.isArray(values) || !values.length) return this.addFilter("1=0");
    const col = normalizeColumn2(column);
    this.referencedColumns.add(col);
    const placeholders = values.map(() => "?").join(", ");
    return this.addFilter(`COALESCE("${col}"::text, '') IN (${placeholders})`, ...values.map((v) => String(v ?? "")));
  }
  is(column, value) {
    const col = normalizeColumn2(column);
    this.referencedColumns.add(col);
    if (value === null || String(value).toLowerCase() === "null") {
      return this.addFilter(`"${col}" IS NULL`);
    }
    if (String(value).toLowerCase() === "true") return this.addFilter(`LOWER(COALESCE("${col}"::text, '')) = 'true'`);
    if (String(value).toLowerCase() === "false") return this.addFilter(`LOWER(COALESCE("${col}"::text, '')) = 'false'`);
    return this.addFilter(`"${col}" IS NOT DISTINCT FROM ?`, value);
  }
  not(column, operator, value) {
    const col = normalizeColumn2(column);
    this.referencedColumns.add(col);
    const op = String(operator || "").toLowerCase();
    if (op === "is") {
      if (value === null || String(value).toLowerCase() === "null") return this.addFilter(`"${col}" IS NOT NULL`);
      if (String(value).toLowerCase() === "true") return this.addFilter(`"${col}" IS NOT TRUE`);
      if (String(value).toLowerCase() === "false") return this.addFilter(`"${col}" IS NOT FALSE`);
    }
    if (op === "in") {
      const items = parseInList2(String(value || ""));
      if (!items.length) return this;
      const placeholders = items.map(() => "?").join(", ");
      return this.addFilter(`COALESCE("${col}"::text, '') NOT IN (${placeholders})`, ...items);
    }
    return this.addFilter(`NOT (COALESCE("${col}"::text, '') = COALESCE(?::text, ''))`, value);
  }
  or(expr) {
    const parts = parseOrExpr2(expr);
    if (!parts.length) return this;
    const sqlParts = [];
    const vals = [];
    for (const part of parts) {
      const segs = part.split(".");
      const col = normalizeColumn2(segs[0] || "");
      this.referencedColumns.add(col);
      const op = String(segs[1] || "eq").toLowerCase();
      const raw = segs.slice(2).join(".");
      const value = raw === "null" ? null : raw;
      if (!col) continue;
      if (op === "eq") {
        sqlParts.push(`COALESCE("${col}"::text, '') = COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "ilike") {
        sqlParts.push(`COALESCE("${col}"::text, '') ILIKE COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "is") {
        if (value === null) sqlParts.push(`"${col}" IS NULL`);
        else if (String(value).toLowerCase() === "true") sqlParts.push(`"${col}" IS TRUE`);
        else if (String(value).toLowerCase() === "false") sqlParts.push(`"${col}" IS FALSE`);
      } else if (op === "neq") {
        sqlParts.push(`COALESCE("${col}"::text, '') <> COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "in") {
        const items = parseInList2(String(value || ""));
        if (!items.length) continue;
        const placeholders = items.map(() => "?").join(", ");
        sqlParts.push(`COALESCE("${col}"::text, '') IN (${placeholders})`);
        vals.push(...items);
      } else if (op === "gt") {
        sqlParts.push(`COALESCE("${col}"::text, '') > COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "gte") {
        sqlParts.push(`COALESCE("${col}"::text, '') >= COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "lt") {
        sqlParts.push(`COALESCE("${col}"::text, '') < COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "lte") {
        sqlParts.push(`COALESCE("${col}"::text, '') <= COALESCE(?::text, '')`);
        vals.push(value);
      }
    }
    if (!sqlParts.length) return this;
    return this.addFilter(sqlParts.join(" OR "), ...vals);
  }
  order(column, options) {
    const col = normalizeColumn2(column);
    this.referencedColumns.add(col);
    this.orderBys.push({ column: col, ascending: options?.ascending !== false });
    return this;
  }
  limit(count) {
    this.limitValue = Math.max(0, Number(count || 0));
    return this;
  }
  range(from, to) {
    const start = Math.max(0, Number(from || 0));
    const end = Math.max(start, Number(to || start));
    this.offsetValue = start;
    this.limitValue = end - start + 1;
    return this;
  }
  single() {
    this.singleType = "single";
    return this.execute();
  }
  maybeSingle() {
    this.singleType = "maybeSingle";
    return this.execute();
  }
  update(payload2) {
    this.mode = "update";
    this.updatePayload = payload2 || {};
    Object.keys(this.updatePayload).forEach((k) => this.referencedColumns.add(normalizeColumn2(k)));
    return this;
  }
  insert(payload2) {
    this.mode = "insert";
    this.insertPayload = Array.isArray(payload2) ? payload2 : [payload2];
    this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn2(k))));
    return this;
  }
  upsert(payload2, options) {
    this.mode = "upsert";
    this.insertPayload = Array.isArray(payload2) ? payload2 : [payload2];
    this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn2(k))));
    this.upsertConflict = normalizeColumn2(options?.onConflict || "id");
    this.referencedColumns.add(this.upsertConflict);
    this.upsertIgnoreDuplicates = !!options?.ignoreDuplicates;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
  async executeSelect() {
    await ensureColumns2([...this.referencedColumns]);
    const cols = this.selectColumns === "*" ? "*" : splitColumns2(this.selectColumns).map((c) => `"${c}"`).join(", ");
    const where = this.whereClause(1);
    const order = this.orderBys.length ? ` ORDER BY ${this.orderBys.map((o) => `"${o.column}" ${o.ascending ? "ASC" : "DESC"}`).join(", ")}` : "";
    const limit = this.limitValue != null ? ` LIMIT ${this.limitValue}` : "";
    const offset = this.offsetValue != null ? ` OFFSET ${this.offsetValue}` : "";
    let count = null;
    if (this.selectCount === "exact") {
      const c = await pool.query(
        `SELECT COUNT(*)::text AS count FROM masterlead${where.sql}`,
        where.values
      );
      count = Number(c.rows[0]?.count || 0);
    }
    if (this.selectHead) {
      return { data: null, error: null, count };
    }
    const result = await pool.query(
      `SELECT ${cols} FROM masterlead${where.sql}${order}${limit}${offset}`,
      where.values
    );
    if (this.singleType === "single") {
      if ((result.rowCount || 0) !== 1) {
        return { data: null, error: { message: "Expected single row" }, count };
      }
      return { data: result.rows[0], error: null, count };
    }
    if (this.singleType === "maybeSingle") {
      return { data: result.rows[0] || null, error: null, count };
    }
    return { data: result.rows, error: null, count };
  }
  buildInsertRows() {
    const rows = this.insertPayload.filter(Boolean);
    const columnSet = /* @__PURE__ */ new Set();
    for (const row of rows) {
      Object.keys(row).forEach((k) => columnSet.add(normalizeColumn2(k)));
    }
    const columns = [...columnSet];
    const values = rows.map((row) => columns.map((c) => row[c]));
    return { columns, rows: values };
  }
  async executeUpdateLike() {
    await ensureColumns2([...this.referencedColumns]);
    if (!this.updatePayload) return { data: null, error: { message: "Missing update payload" }, count: null };
    const entries = Object.entries(this.updatePayload);
    if (!entries.length) return { data: null, error: null, count: 0 };
    const setSql = entries.map(([k], i) => `"${normalizeColumn2(k)}" = $${i + 1}`).join(", ");
    const setVals = entries.map(([, v]) => v);
    const where = this.whereClause(setVals.length + 1);
    const returning = this.selectColumns && this.selectColumns !== "*" ? splitColumns2(this.selectColumns).map((c) => `"${c}"`).join(", ") : "*";
    const wantsData = this.selectColumns !== "*";
    const sql5 = `UPDATE masterlead SET ${setSql}${where.sql}${wantsData ? ` RETURNING ${returning}` : ""}`;
    const result = await pool.query(sql5, [...setVals, ...where.values]);
    return { data: wantsData ? result.rows : null, error: null, count: result.rowCount || 0 };
  }
  async executeInsertLike() {
    await ensureColumns2([...this.referencedColumns]);
    const { columns, rows } = this.buildInsertRows();
    if (!columns.length || !rows.length) return { data: null, error: null, count: 0 };
    const values = [];
    let idx = 1;
    const rowSql = rows.map((row) => {
      const ph = row.map(() => `$${idx++}`);
      values.push(...row);
      return `(${ph.join(", ")})`;
    }).join(", ");
    const quotedCols = columns.map((c) => `"${c}"`).join(", ");
    let conflictSql = "";
    if (this.mode === "upsert") {
      if (this.upsertIgnoreDuplicates) {
        conflictSql = ` ON CONFLICT ("${this.upsertConflict}") DO NOTHING`;
      } else {
        const updates = columns.filter((c) => c !== this.upsertConflict).map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
        conflictSql = ` ON CONFLICT ("${this.upsertConflict}") DO UPDATE SET ${updates || `"${this.upsertConflict}" = EXCLUDED."${this.upsertConflict}"`}`;
      }
    }
    const returning = this.selectColumns && this.selectColumns !== "*" ? splitColumns2(this.selectColumns).map((c) => `"${c}"`).join(", ") : "*";
    const wantsData = this.selectColumns !== "*";
    const sql5 = `INSERT INTO masterlead (${quotedCols}) VALUES ${rowSql}${conflictSql}${wantsData ? ` RETURNING ${returning}` : ""}`;
    const result = await pool.query(sql5, values);
    const data = wantsData ? this.singleType ? result.rows[0] || null : result.rows : null;
    return { data, error: null, count: result.rowCount || 0 };
  }
  async executeDelete() {
    await ensureColumns2([...this.referencedColumns]);
    const where = this.whereClause(1);
    const sql5 = `DELETE FROM masterlead${where.sql}`;
    const result = await pool.query(sql5, where.values);
    return { data: null, error: null, count: result.rowCount || 0 };
  }
  async execute() {
    try {
      if (this.mode === "select") return await this.executeSelect();
      if (this.mode === "update") return await this.executeUpdateLike();
      if (this.mode === "insert" || this.mode === "upsert") return await this.executeInsertLike();
      if (this.mode === "delete") return await this.executeDelete();
      return { data: null, error: null, count: 0 };
    } catch (error) {
      return { data: null, error: { message: error?.message || String(error) }, count: null };
    }
  }
};
var masterleadClient = {
  from(table) {
    if (String(table || "").toLowerCase() !== "masterlead") {
      throw new Error("masterleadClient only supports the masterlead table");
    }
    return new LocalMasterleadBuilder();
  }
};

// server/storage.ts
var DatabaseStorage = class {
  teamDirectoryCache = /* @__PURE__ */ new Map();
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async getAgentProfile() {
    const [profile] = await db.select().from(agentProfiles).limit(1);
    return profile || void 0;
  }
  async createOrUpdateAgentProfile(profile) {
    const existing = await this.getAgentProfile();
    if (existing) {
      const [updatedProfile] = await db.update(agentProfiles).set({
        ...profile,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(agentProfiles.id, existing.id)).returning();
      return updatedProfile;
    } else {
      const [newProfile] = await db.insert(agentProfiles).values(profile).returning();
      return newProfile;
    }
  }
  async createVerificationSession(session2) {
    const sessionId = `VER-${Date.now()}-${nanoid2(6)}`;
    let agentMgaTeam = session2.agentMgaTeam || null;
    let agentRgaTeam = session2.agentRgaTeam || null;
    let agentAssociateId = session2.associateId;
    let agentCompanyEmail = session2.companyEmail;
    console.log(`\u{1F50D} VERIFICATION SESSION CREATION: MGA=${agentMgaTeam}, RGA=${agentRgaTeam}, AssociateId=${agentAssociateId}, Email=${agentCompanyEmail}`);
    if (!agentMgaTeam && supabase) {
      try {
        const supabase2 = supabase;
        if (agentAssociateId) {
          const { data: hierarchyData, error: hierarchyError } = await supabase2.from("agent_hierarchy").select("agent_associate_id, agent_name, agent_email, mga_name, rga_name").eq("agent_associate_id", agentAssociateId).single();
          console.log(`\u{1F50D} SUPABASE HIERARCHY: error=${JSON.stringify(hierarchyError)}, hasData=${!!hierarchyData}}`);
          if (!hierarchyError && hierarchyData) {
            agentMgaTeam = hierarchyData.mga_name;
            agentRgaTeam = hierarchyData.rga_name;
            agentCompanyEmail = hierarchyData.agent_email;
            console.log(`\u{1F50D} Found agent in hierarchy by associate_id ${agentAssociateId}: ${hierarchyData.agent_name} (MGA: ${agentMgaTeam}, RGA: ${agentRgaTeam})`);
          }
        }
        if (!agentMgaTeam && agentCompanyEmail) {
          const { data: hierarchyByEmail, error: hierarchyEmailError } = await supabase2.from("agent_hierarchy").select("agent_associate_id, agent_name, agent_email, mga_name, rga_name").eq("agent_email", agentCompanyEmail.toLowerCase().trim()).single();
          console.log(`\u{1F50D} HIERARCHY BY EMAIL: error=${JSON.stringify(hierarchyEmailError)}, hasData=${!!hierarchyByEmail}}`);
          if (!hierarchyEmailError && hierarchyByEmail) {
            agentMgaTeam = hierarchyByEmail.mga_name;
            agentRgaTeam = hierarchyByEmail.rga_name;
            agentAssociateId = agentAssociateId || hierarchyByEmail.agent_associate_id;
            console.log(`\u{1F50D} Found agent by email "${agentCompanyEmail}": ${hierarchyByEmail.agent_name} (MGA: ${agentMgaTeam}, RGA: ${agentRgaTeam})`);
          }
        }
        if (!agentMgaTeam && session2.agentFirstName && session2.agentLastName) {
          const agentFullName = `${session2.agentFirstName} ${session2.agentLastName}`;
          const { data: hierarchyByName, error: hierarchyNameError } = await supabase2.from("agent_hierarchy").select("agent_associate_id, agent_name, agent_email, mga_name, rga_name").ilike("agent_name", agentFullName).limit(1);
          if (!hierarchyNameError && hierarchyByName && hierarchyByName.length > 0) {
            agentMgaTeam = hierarchyByName[0].mga_name;
            agentRgaTeam = hierarchyByName[0].rga_name;
            agentAssociateId = agentAssociateId || hierarchyByName[0].agent_associate_id;
            agentCompanyEmail = agentCompanyEmail || hierarchyByName[0].agent_email;
            console.log(`\u{1F50D} Found agent by name "${agentFullName}": ${hierarchyByName[0].agent_name} (MGA: ${agentMgaTeam}, RGA: ${agentRgaTeam})`);
          }
        }
        if (agentMgaTeam) {
          console.log(`\u2705 Using MGA team: ${agentMgaTeam}, RGA team: ${agentRgaTeam || "null"}`);
        } else {
          console.log(`\u26A0\uFE0F No MGA team found in agent_hierarchy for agent (AssociateId: ${agentAssociateId}, Email: ${agentCompanyEmail})`);
        }
      } catch (error) {
        console.error("\u274C Error looking up MGA team:", error);
      }
    } else if (agentMgaTeam) {
      console.log(`\u2705 Using MGA/RGA from provided session data: MGA=${agentMgaTeam}, RGA=${agentRgaTeam || "null"}`);
    }
    const isDemo = session2.is_demo === true || session2.is_demo === "true";
    const supabaseData = {
      session_id: sessionId,
      first_name: session2.firstName,
      last_name: session2.lastName,
      spouse_name: session2.spouseName,
      phone: session2.phone,
      agent_phone: session2.agentPhone,
      agent_first_name: session2.agentFirstName,
      agent_last_name: session2.agentLastName,
      associate_id: agentAssociateId,
      // Use looked up or provided associate_id
      company_email: agentCompanyEmail,
      // Use looked up or provided company_email
      agent_mga_team: agentMgaTeam,
      agent_rga_team: agentRgaTeam,
      city: session2.city,
      state: session2.state,
      premium: session2.premium,
      ach_draw_date: session2.achDrawDate,
      ach_draw_date_short: session2.achDrawDateShort,
      verification_method: session2.verificationMethod,
      zoom_room_id: session2.zoomRoomId,
      zoom_password: session2.zoomPassword,
      language: session2.language || "en",
      status: "pending",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      screenshot_url: "PENDING",
      // CRITICAL FLAG: Tells scheduler to analyze this session
      recording_url: "PENDING",
      // CRITICAL FLAG: Tells scheduler to analyze this session
      is_demo: isDemo || false
      // 🎭 DEMO MODE: Set is_demo flag
    };
    console.log("\u{1F527} SUPABASE: Creating verification session:", sessionId);
    console.log("\u{1F527} SUPABASE: Session data:", JSON.stringify(supabaseData, null, 2));
    try {
      if (supabase) {
        const supabase2 = supabaseAdmin;
        const { data: supabaseSession, error } = await supabase2.from("verification_sessions").insert([supabaseData]).select().single();
        console.log(`\u{1F50D} SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!supabaseSession}}`);
        if (error) {
          console.error("\u274C SUPABASE: Error creating verification session:", error);
          throw new Error(`Supabase error: ${error.message}`);
        }
        console.log("\u2705 SUPABASE: Verification session created successfully:", sessionId);
        const verificationSession = {
          id: supabaseSession.id,
          sessionId: supabaseSession.session_id,
          firstName: supabaseSession.first_name,
          lastName: supabaseSession.last_name,
          spouseName: supabaseSession.spouse_name,
          phone: supabaseSession.phone,
          agentPhone: supabaseSession.agent_phone,
          agentFirstName: supabaseSession.agent_first_name,
          agentLastName: supabaseSession.agent_last_name,
          city: supabaseSession.city,
          state: supabaseSession.state,
          premium: supabaseSession.premium,
          achDrawDate: supabaseSession.ach_draw_date,
          achDrawDateShort: supabaseSession.ach_draw_date_short,
          verificationMethod: supabaseSession.verification_method,
          zoomRoomId: supabaseSession.zoom_room_id,
          zoomPassword: supabaseSession.zoom_password,
          language: supabaseSession.language,
          status: supabaseSession.status,
          createdAt: new Date(supabaseSession.created_at),
          // Optional fields
          smsVerificationCode: supabaseSession.sms_verification_code,
          screenshotPath: supabaseSession.screenshot_path,
          clientApprovalTimestamp: supabaseSession.client_approval_timestamp ? new Date(supabaseSession.client_approval_timestamp) : null,
          completedAt: supabaseSession.completed_at ? new Date(supabaseSession.completed_at) : null,
          // Add missing Taalk fields that were causing the call status issues
          taalkCallId: supabaseSession.taalk_call_id,
          taalkCallStatus: supabaseSession.taalk_call_status,
          taalkCallInitiatedAt: supabaseSession.taalk_call_initiated_at,
          taalkCallCompletedAt: supabaseSession.taalk_call_completed_at,
          callCompleted: supabaseSession.call_completed || false,
          verificationResult: supabaseSession.verification_result,
          agentMgaTeam: supabaseSession.agent_mga_team,
          agentRgaTeam: supabaseSession.agent_rga_team,
          associateId: supabaseSession.associate_id,
          companyEmail: supabaseSession.company_email
        };
        return verificationSession;
      } else {
        console.error("\u274C SUPABASE: Client not available - falling back to local database");
        const dbData = {
          sessionId,
          firstName: session2.firstName,
          lastName: session2.lastName,
          spouseName: session2.spouseName,
          phone: session2.phone,
          agentPhone: session2.agentPhone,
          agentFirstName: session2.agentFirstName,
          agentLastName: session2.agentLastName,
          city: session2.city,
          state: session2.state,
          premium: session2.premium,
          achDrawDate: session2.achDrawDate,
          achDrawDateShort: session2.achDrawDateShort,
          verificationMethod: session2.verificationMethod,
          zoomRoomId: session2.zoomRoomId,
          zoomPassword: session2.zoomPassword,
          language: session2.language || "en",
          status: "pending"
        };
        const [verificationSession] = await db.insert(verificationSessions).values(dbData).returning();
        return verificationSession;
      }
    } catch (error) {
      console.error("\u274C Error creating verification session:", error);
      throw error;
    }
  }
  async getVerificationSession(sessionId) {
    console.log(`\u{1F50D} SUPABASE GET SESSION: Attempting to fetch ${sessionId}, client available: ${!!supabase}`);
    if (supabase) {
      try {
        console.log(`\u{1F50D} SUPABASE GET SESSION: Querying verification_sessions table`);
        const { data: supabaseSession, error } = await supabase.from("verification_sessions").select("*").eq("session_id", sessionId).single();
        console.log(`\u{1F50D} SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!supabaseSession}}`);
        if (error) {
          if (error.code !== "PGRST116") {
            console.error("\u274C SUPABASE: Error fetching session:", error);
          }
        } else if (supabaseSession) {
          const verificationSession = {
            id: supabaseSession.id,
            sessionId: supabaseSession.session_id,
            firstName: supabaseSession.first_name,
            lastName: supabaseSession.last_name,
            spouseName: supabaseSession.spouse_name,
            phone: supabaseSession.phone,
            agentPhone: supabaseSession.agent_phone,
            agentFirstName: supabaseSession.agent_first_name,
            agentLastName: supabaseSession.agent_last_name,
            city: supabaseSession.city,
            state: supabaseSession.state,
            premium: supabaseSession.premium,
            achDrawDate: supabaseSession.ach_draw_date,
            achDrawDateShort: supabaseSession.ach_draw_date_short,
            verificationMethod: supabaseSession.verification_method,
            zoomRoomId: supabaseSession.zoom_room_id,
            zoomPassword: supabaseSession.zoom_password,
            language: supabaseSession.language,
            status: supabaseSession.status,
            createdAt: new Date(supabaseSession.created_at),
            updatedAt: supabaseSession.updated_at ? new Date(supabaseSession.updated_at) : new Date(supabaseSession.created_at),
            // Optional fields
            smsVerificationCode: supabaseSession.sms_verification_code,
            screenshotPath: supabaseSession.screenshot_path,
            clientApprovalTimestamp: supabaseSession.client_approval_timestamp ? new Date(supabaseSession.client_approval_timestamp) : null,
            clientApprovalStatus: supabaseSession.client_approval_status,
            completedAt: supabaseSession.completed_at ? new Date(supabaseSession.completed_at) : null,
            // CRITICAL FIX: Add missing Taalk call fields that were causing the bug!
            taalkCallId: supabaseSession.taalk_call_id,
            taalkCallStatus: supabaseSession.taalk_call_status,
            taalkCallInitiatedAt: supabaseSession.taalk_call_initiated_at,
            taalkCallCompletedAt: supabaseSession.taalk_call_completed_at,
            callCompleted: supabaseSession.call_completed || false,
            verificationResult: supabaseSession.verification_result
          };
          return verificationSession;
        }
      } catch (error) {
        console.error("\u274C SUPABASE: Error getting verification session:", error);
      }
    } else {
      console.log("\u26A0\uFE0F SUPABASE: Client not available, using local database");
    }
    console.log("\u{1F50D} LOCAL: Checking local database for session:", sessionId);
    const [session2] = await db.select().from(verificationSessions).where(eq(verificationSessions.sessionId, sessionId));
    return session2 || void 0;
  }
  async getVerificationSessionByCode(verificationCode) {
    const [session2] = await db.select().from(verificationSessions).where(eq(verificationSessions.smsVerificationCode, verificationCode));
    return session2 || void 0;
  }
  async updateVerificationSession(sessionId, updates) {
    if (supabase) {
      try {
        console.log(`\u{1F504} SUPABASE: Updating verification session ${sessionId} with:`, updates);
        const supabaseUpdates = {};
        if (updates.smsVerificationSent !== void 0) supabaseUpdates.sms_verification_sent = updates.smsVerificationSent;
        if (updates.agentSmsStatus !== void 0) supabaseUpdates.agent_sms_status = updates.agentSmsStatus;
        if (updates.clientSmsStatus !== void 0) supabaseUpdates.client_sms_status = updates.clientSmsStatus;
        if (updates.clientApprovalStatus !== void 0) supabaseUpdates.client_approval_status = updates.clientApprovalStatus;
        if (updates.clientApprovalTime !== void 0) supabaseUpdates.client_approval_time = updates.clientApprovalTime.toISOString();
        if (updates.status !== void 0) supabaseUpdates.status = updates.status;
        if (updates.screenshotPath !== void 0) {
          supabaseUpdates.screenshot_path = updates.screenshotPath;
          supabaseUpdates.screenshot_url = updates.screenshotPath;
        }
        if (updates.taalkCallId !== void 0) supabaseUpdates.taalk_call_id = updates.taalkCallId;
        if (updates.taalkCallStatus !== void 0) supabaseUpdates.taalk_call_status = updates.taalkCallStatus;
        if (updates.taalkCallInitiatedAt !== void 0) supabaseUpdates.taalk_call_initiated_at = updates.taalkCallInitiatedAt;
        if (updates.taalkCallCompletedAt !== void 0) supabaseUpdates.taalk_call_completed_at = updates.taalkCallCompletedAt;
        if (updates.taalkCallDuration !== void 0) supabaseUpdates.taalk_call_duration = updates.taalkCallDuration;
        if (updates.taalkCallData !== void 0) supabaseUpdates.taalk_call_data = updates.taalkCallData;
        if (updates.taalkCallUrl !== void 0) supabaseUpdates.taalk_call_url = updates.taalkCallUrl;
        if (updates.recordingUrl !== void 0) supabaseUpdates.recording_url = updates.recordingUrl;
        if (updates.clientIpAddress !== void 0) supabaseUpdates.client_ip_address = updates.clientIpAddress;
        if (updates.clientUserAgent !== void 0) supabaseUpdates.client_user_agent = updates.clientUserAgent;
        if (updates.clientCountry !== void 0) supabaseUpdates.client_country = updates.clientCountry;
        if (updates.clientRegion !== void 0) supabaseUpdates.client_region = updates.clientRegion;
        if (updates.clientCity !== void 0) supabaseUpdates.client_city = updates.clientCity;
        if (updates.clientLatitude !== void 0) supabaseUpdates.client_latitude = updates.clientLatitude;
        if (updates.clientLongitude !== void 0) supabaseUpdates.client_longitude = updates.clientLongitude;
        if (updates.clientTimezone !== void 0) supabaseUpdates.client_timezone = updates.clientTimezone;
        if (updates.clientIsp !== void 0) supabaseUpdates.client_isp = updates.clientIsp;
        if (updates.clientIsVpn !== void 0) supabaseUpdates.client_is_vpn = updates.clientIsVpn;
        if (updates.clientIsProxy !== void 0) supabaseUpdates.client_is_proxy = updates.clientIsProxy;
        if (updates.clientIsHosting !== void 0) supabaseUpdates.client_is_hosting = updates.clientIsHosting;
        if (updates.clientVpnDetectionReason !== void 0) supabaseUpdates.client_vpn_detection_reason = updates.clientVpnDetectionReason;
        if (updates.agentIpAddress !== void 0) supabaseUpdates.agent_ip_address = updates.agentIpAddress;
        if (updates.agentUserAgent !== void 0) supabaseUpdates.agent_user_agent = updates.agentUserAgent;
        if (updates.agentCountry !== void 0) supabaseUpdates.agent_country = updates.agentCountry;
        if (updates.agentRegion !== void 0) supabaseUpdates.agent_region = updates.agentRegion;
        if (updates.agentCity !== void 0) supabaseUpdates.agent_city = updates.agentCity;
        if (updates.agentLatitude !== void 0) supabaseUpdates.agent_latitude = updates.agentLatitude;
        if (updates.agentLongitude !== void 0) supabaseUpdates.agent_longitude = updates.agentLongitude;
        if (updates.agentTimezone !== void 0) supabaseUpdates.agent_timezone = updates.agentTimezone;
        if (updates.agentIsp !== void 0) supabaseUpdates.agent_isp = updates.agentIsp;
        if (updates.agentIsVpn !== void 0) supabaseUpdates.agent_is_vpn = updates.agentIsVpn;
        if (updates.agentIsProxy !== void 0) supabaseUpdates.agent_is_proxy = updates.agentIsProxy;
        if (updates.agentIsHosting !== void 0) supabaseUpdates.agent_is_hosting = updates.agentIsHosting;
        if (updates.agentVpnDetectionReason !== void 0) supabaseUpdates.agent_vpn_detection_reason = updates.agentVpnDetectionReason;
        if (updates.ipAnalysis !== void 0) supabaseUpdates.ip_analysis = updates.ipAnalysis;
        if (updates.ipFlagStatus !== void 0) supabaseUpdates.ip_flag_status = updates.ipFlagStatus;
        if (updates.ipFlagReason !== void 0) supabaseUpdates.ip_flag_reason = updates.ipFlagReason;
        if (updates.ipAnalysisSummary !== void 0) supabaseUpdates.ip_analysis_summary = updates.ipAnalysisSummary;
        const { data, error } = await supabase.from("verification_sessions").update(supabaseUpdates).eq("session_id", sessionId).select().single();
        console.log(`\u{1F50D} SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!data}}`);
        if (error) {
          console.error("\u274C SUPABASE: Error updating verification session:", error);
        } else {
          console.log("\u2705 SUPABASE: Verification session updated successfully");
          return data;
        }
      } catch (error) {
        console.error("\u274C SUPABASE: Exception updating verification session:", error);
      }
    }
    try {
      console.log(`\u{1F504} LOCAL: Updating verification session ${sessionId} with:`, updates);
      const dbUpdates = {};
      if (updates.smsVerificationSent !== void 0) dbUpdates.smsVerificationSent = updates.smsVerificationSent;
      if (updates.agentSmsStatus !== void 0) dbUpdates.agentSmsStatus = updates.agentSmsStatus;
      if (updates.clientSmsStatus !== void 0) dbUpdates.clientSmsStatus = updates.clientSmsStatus;
      if (updates.clientApprovalStatus !== void 0) dbUpdates.clientApprovalStatus = updates.clientApprovalStatus;
      if (updates.clientApprovalTime !== void 0) dbUpdates.clientApprovalTime = updates.clientApprovalTime;
      if (updates.status !== void 0) dbUpdates.status = updates.status;
      if (updates.screenshotPath !== void 0) dbUpdates.screenshotPath = updates.screenshotPath;
      if (updates.taalkCallId !== void 0) dbUpdates.taalkCallId = updates.taalkCallId;
      if (updates.taalkCallStatus !== void 0) dbUpdates.taalkCallStatus = updates.taalkCallStatus;
      if (updates.taalkCallInitiatedAt !== void 0) dbUpdates.taalkCallInitiatedAt = updates.taalkCallInitiatedAt;
      if (updates.clientIpAddress !== void 0) dbUpdates.clientIpAddress = updates.clientIpAddress;
      if (updates.clientUserAgent !== void 0) dbUpdates.clientUserAgent = updates.clientUserAgent;
      if (updates.clientCountry !== void 0) dbUpdates.clientCountry = updates.clientCountry;
      if (updates.clientRegion !== void 0) dbUpdates.clientRegion = updates.clientRegion;
      if (updates.clientCity !== void 0) dbUpdates.clientCity = updates.clientCity;
      if (updates.clientLatitude !== void 0) dbUpdates.clientLatitude = updates.clientLatitude;
      if (updates.clientLongitude !== void 0) dbUpdates.clientLongitude = updates.clientLongitude;
      if (updates.clientTimezone !== void 0) dbUpdates.clientTimezone = updates.clientTimezone;
      if (updates.clientIsp !== void 0) dbUpdates.clientIsp = updates.clientIsp;
      if (updates.clientIsVpn !== void 0) dbUpdates.clientIsVpn = updates.clientIsVpn;
      if (updates.clientIsProxy !== void 0) dbUpdates.clientIsProxy = updates.clientIsProxy;
      if (updates.clientIsHosting !== void 0) dbUpdates.clientIsHosting = updates.clientIsHosting;
      if (updates.clientVpnDetectionReason !== void 0) dbUpdates.clientVpnDetectionReason = updates.clientVpnDetectionReason;
      if (updates.agentIpAddress !== void 0) dbUpdates.agentIpAddress = updates.agentIpAddress;
      if (updates.agentUserAgent !== void 0) dbUpdates.agentUserAgent = updates.agentUserAgent;
      if (updates.agentCountry !== void 0) dbUpdates.agentCountry = updates.agentCountry;
      if (updates.agentRegion !== void 0) dbUpdates.agentRegion = updates.agentRegion;
      if (updates.agentCity !== void 0) dbUpdates.agentCity = updates.agentCity;
      if (updates.agentLatitude !== void 0) dbUpdates.agentLatitude = updates.agentLatitude;
      if (updates.agentLongitude !== void 0) dbUpdates.agentLongitude = updates.agentLongitude;
      if (updates.agentTimezone !== void 0) dbUpdates.agentTimezone = updates.agentTimezone;
      if (updates.agentIsp !== void 0) dbUpdates.agentIsp = updates.agentIsp;
      if (updates.agentIsVpn !== void 0) dbUpdates.agentIsVpn = updates.agentIsVpn;
      if (updates.agentIsProxy !== void 0) dbUpdates.agentIsProxy = updates.agentIsProxy;
      if (updates.agentIsHosting !== void 0) dbUpdates.agentIsHosting = updates.agentIsHosting;
      if (updates.agentVpnDetectionReason !== void 0) dbUpdates.agentVpnDetectionReason = updates.agentVpnDetectionReason;
      if (updates.ipAnalysis !== void 0) dbUpdates.ipAnalysis = updates.ipAnalysis;
      if (updates.ipFlagStatus !== void 0) dbUpdates.ipFlagStatus = updates.ipFlagStatus;
      if (updates.ipFlagReason !== void 0) dbUpdates.ipFlagReason = updates.ipFlagReason;
      if (updates.ipAnalysisSummary !== void 0) dbUpdates.ipAnalysisSummary = updates.ipAnalysisSummary;
      console.log(`\u{1F504} LOCAL: Final dbUpdates keys: ${Object.keys(dbUpdates)}`);
      if (Object.keys(dbUpdates).length === 0) {
        console.log("\u26A0\uFE0F LOCAL: No valid updates provided, skipping database update");
        return await this.getVerificationSession(sessionId);
      }
      const [updatedSession] = await db.update(verificationSessions).set(dbUpdates).where(eq(verificationSessions.sessionId, sessionId)).returning();
      return updatedSession || void 0;
    } catch (error) {
      console.error("\u274C LOCAL: Error updating verification session:", error);
      throw error;
    }
  }
  async completeVerificationSession(sessionId) {
    const [completedSession] = await db.update(verificationSessions).set({
      status: "completed",
      completedAt: /* @__PURE__ */ new Date()
    }).where(eq(verificationSessions.sessionId, sessionId)).returning();
    return completedSession || void 0;
  }
  // Appointment methods
  async createAppointment(appointment) {
    const [newAppointment] = await db.insert(appointments).values(appointment).returning();
    return newAppointment;
  }
  async getAppointments(agentId) {
    const appointmentsList = await db.select().from(appointments).where(eq(appointments.agentId, agentId)).orderBy(appointments.date, appointments.time);
    return appointmentsList;
  }
  async getAppointmentsByDate(agentId, date) {
    const appointmentsList = await db.select().from(appointments).where(and(
      eq(appointments.agentId, agentId),
      eq(appointments.date, date)
    )).orderBy(appointments.time);
    return appointmentsList;
  }
  async updateAppointment(id, updates) {
    const [updatedAppointment] = await db.update(appointments).set({
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(appointments.id, id)).returning();
    return updatedAppointment || void 0;
  }
  async deleteAppointment(id) {
    const result = await db.delete(appointments).where(eq(appointments.id, id));
    return (result.rowCount || 0) > 0;
  }
  // Incoming leads operations (CSV webhook)
  async createIncomingLead(lead) {
    const [newLead] = await db.insert(incomingLeads).values(lead).returning();
    return newLead;
  }
  async getIncomingLeads(status) {
    if (status) {
      return await db.select().from(incomingLeads).where(eq(incomingLeads.status, status));
    }
    return await db.select().from(incomingLeads);
  }
  async updateIncomingLeadStatus(id, status, assignedAgent) {
    const updates = { status };
    if (assignedAgent) {
      updates.assignedAgent = assignedAgent;
    }
    if (status === "processed") {
      updates.processedAt = /* @__PURE__ */ new Date();
    }
    const [updatedLead] = await db.update(incomingLeads).set(updates).where(eq(incomingLeads.id, id)).returning();
    return updatedLead;
  }
  // Supabase-linked agent profile methods
  async getAgentProfileBySupabaseId(supabaseUserId) {
    const [profile] = await db.select().from(agentProfiles).where(eq(agentProfiles.supabaseUserId, supabaseUserId));
    return profile || null;
  }
  async createAgentProfileWithSupabaseId(profileData) {
    console.log("\u{1F525} SUPABASE: Creating agent profile with Supabase ID:", profileData.supabaseUserId);
    const existingProfile = await this.getAgentProfileBySupabaseId(profileData.supabaseUserId);
    if (existingProfile) {
      console.log("\u2705 SUPABASE: Profile already exists, updating instead");
      return await this.updateAgentProfileBySupabaseId(profileData.supabaseUserId, profileData) || existingProfile;
    }
    if (profileData.mgaTeam || profileData.rgaTeam) {
      await this.ensureMgaRgaInDirectory(profileData.mgaTeam, profileData.rgaTeam);
    }
    if (supabase) {
      try {
        const supabase2 = supabaseAdmin;
        console.log("\u{1F50D} SUPABASE: Creating in Supabase database");
        console.log("\u{1F50D} SUPABASE: Insert data:", {
          supabase_user_id: profileData.supabaseUserId,
          email: profileData.email,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone,
          zoom_id: profileData.zoomId,
          zoom_password: profileData.zoomPassword,
          mga_team: profileData.mgaTeam || "",
          rga_team: profileData.rgaTeam || ""
        });
        const normalizedEmail = profileData.email?.toLowerCase().trim() || "";
        const { data: supabaseProfile, error } = await supabase2.from("agent_profiles").insert({
          supabase_user_id: profileData.supabaseUserId,
          email: normalizedEmail,
          // Use normalized email
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone || "+1-555-0000",
          zoom_id: profileData.zoomId || "",
          zoom_password: profileData.zoomPassword || "1",
          mga_team: profileData.mgaTeam || "",
          rga_team: profileData.rgaTeam || "",
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).select().single();
        console.log(`\u{1F50D} SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!supabaseProfile}`);
        if (!error && supabaseProfile) {
          console.log("\u2705 SUPABASE: Profile created successfully in Supabase");
          return {
            id: supabaseProfile.id,
            email: supabaseProfile.email,
            firstName: supabaseProfile.first_name,
            lastName: supabaseProfile.last_name,
            phone: supabaseProfile.phone || "",
            zoomId: supabaseProfile.zoom_id,
            zoomPassword: supabaseProfile.zoom_password,
            supabaseUserId: supabaseProfile.supabase_user_id,
            mgaTeam: supabaseProfile.mga_team || "",
            rgaTeam: supabaseProfile.rga_team || "",
            createdAt: new Date(supabaseProfile.created_at || /* @__PURE__ */ new Date()),
            updatedAt: new Date(supabaseProfile.updated_at || /* @__PURE__ */ new Date())
          };
        } else {
          console.error("\u274C SUPABASE: Error creating profile in Supabase:", error);
          throw new Error(`Failed to create profile in Supabase: ${error?.message || "Unknown error"}`);
        }
      } catch (supabaseError) {
        console.error("\u274C SUPABASE: Error creating in Supabase:", supabaseError);
        throw new Error(`Failed to create profile in Supabase: ${supabaseError instanceof Error ? supabaseError.message : "Unknown error"}`);
      }
    }
    throw new Error("Supabase client not available - cannot create agent profile");
  }
  async getAgentProfileByEmail(email) {
    if (!email) {
      console.log("\u274C SUPABASE: No email provided to getAgentProfileByEmail");
      return null;
    }
    const normalizedEmail = email.trim().toLowerCase();
    console.log("\u{1F50D} SUPABASE: Getting agent profile for email:", email, "\u2192 normalized:", normalizedEmail);
    try {
      if (!supabaseAdmin) {
        console.log("\u26A0\uFE0F SUPABASE: Supabase admin client not available");
        return null;
      }
      const { data: supabaseProfile, error } = await supabaseAdmin.from("agent_profiles").select("*").ilike("email", normalizedEmail).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      console.log(`\u{1F50D} SUPABASE RESPONSE: error=${error?.message || "none"}, hasData=${!!supabaseProfile}, emailInDB=${supabaseProfile?.email || "N/A"}`);
      if (!error && supabaseProfile) {
        console.log("\u2705 SUPABASE: Found agent profile in Supabase:", {
          id: supabaseProfile.id,
          email: supabaseProfile.email,
          firstName: supabaseProfile.first_name,
          lastName: supabaseProfile.last_name
        });
        return {
          id: supabaseProfile.id,
          email: supabaseProfile.email,
          firstName: supabaseProfile.first_name,
          lastName: supabaseProfile.last_name,
          phone: supabaseProfile.phone || "",
          zoomId: supabaseProfile.zoom_id,
          zoomPassword: supabaseProfile.zoom_password,
          profilePicture: supabaseProfile.profile_picture || "",
          supabaseUserId: supabaseProfile.supabase_user_id,
          mgaTeam: supabaseProfile.mga_team || "",
          rgaTeam: supabaseProfile.rga_team || "",
          createdAt: new Date(supabaseProfile.created_at || /* @__PURE__ */ new Date()),
          updatedAt: new Date(supabaseProfile.updated_at || /* @__PURE__ */ new Date())
        };
      } else {
        console.log("\u274C SUPABASE: No profile found in Supabase for:", normalizedEmail, "error:", error);
      }
    } catch (supabaseError) {
      console.error("\u274C SUPABASE: Exception checking for agent profile:", supabaseError);
      console.error("Stack:", supabaseError instanceof Error ? supabaseError.stack : "No stack");
    }
    return null;
  }
  async countAgentProfilesForEmail(email) {
    if (!email?.trim() || !supabaseAdmin) return 0;
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const { count, error } = await supabaseAdmin.from("agent_profiles").select("id", { count: "exact", head: true }).ilike("email", normalizedEmail);
      if (error) {
        console.warn("\u26A0\uFE0F countAgentProfilesForEmail:", error.message);
        return 0;
      }
      return typeof count === "number" ? count : 0;
    } catch (e) {
      console.warn("\u26A0\uFE0F countAgentProfilesForEmail exception:", e);
      return 0;
    }
  }
  async updateAgentProfileByEmail(email, updates) {
    console.log("\u{1F504} SUPABASE: Updating agent profile by email:", email);
    if (updates.mgaTeam || updates.rgaTeam) {
      await this.ensureMgaRgaInDirectory(updates.mgaTeam, updates.rgaTeam);
    }
    try {
      if (supabase) {
        const supabase2 = supabaseAdmin;
        console.log("\u{1F50D} SUPABASE: Updating in Supabase database");
        const updateData = {
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (updates.firstName !== void 0) updateData.first_name = updates.firstName;
        if (updates.lastName !== void 0) updateData.last_name = updates.lastName;
        if (updates.phone !== void 0) updateData.phone = updates.phone;
        if (updates.zoomId !== void 0) updateData.zoom_id = updates.zoomId;
        if (updates.zoomPassword !== void 0) updateData.zoom_password = updates.zoomPassword;
        if (updates.mgaTeam !== void 0) updateData.mga_team = updates.mgaTeam;
        if (updates.rgaTeam !== void 0) updateData.rga_team = updates.rgaTeam;
        if (updates.profilePicture !== void 0) updateData.profile_picture = updates.profilePicture;
        console.log("\u{1F50D} SUPABASE: Update data:", updateData);
        const normalizedEmail = email.toLowerCase().trim();
        const { data: targetRows, error: pickErr } = await supabase2.from("agent_profiles").select("id").ilike("email", normalizedEmail).order("updated_at", { ascending: false }).limit(2);
        if (pickErr) {
          console.warn("\u26A0\uFE0F SUPABASE: Could not resolve profile row id:", pickErr);
        }
        const targetId = targetRows?.[0]?.id;
        if (!targetId) {
          console.log("\u{1F50D} SUPABASE: Profile not found by email, creating new one");
          return await this.createAgentProfileWithEmail({ email, ...updates });
        }
        if ((targetRows?.length ?? 0) > 1) {
          console.warn(
            `\u26A0\uFE0F SUPABASE: multiple agent_profiles rows match ${normalizedEmail} \u2014 updating newest only (id=${targetId})`
          );
        }
        const { data: supabaseProfile, error } = await supabase2.from("agent_profiles").update(updateData).eq("id", targetId).select().single();
        console.log(`\u{1F50D} SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!supabaseProfile}`);
        console.log("\u{1F50D} SUPABASE: Update result - data:", supabaseProfile, "error:", error);
        if (!error && supabaseProfile) {
          console.log("\u2705 SUPABASE: Updated successfully in Supabase");
          await this.syncAgentHierarchyFromProfile(supabaseProfile.email, {
            first_name: supabaseProfile.first_name,
            last_name: supabaseProfile.last_name,
            mga_team: supabaseProfile.mga_team,
            rga_team: supabaseProfile.rga_team
          });
          return {
            id: supabaseProfile.id,
            email: supabaseProfile.email,
            firstName: supabaseProfile.first_name,
            lastName: supabaseProfile.last_name,
            phone: supabaseProfile.phone || "",
            zoomId: supabaseProfile.zoom_id,
            zoomPassword: supabaseProfile.zoom_password,
            profilePicture: supabaseProfile.profile_picture || "",
            supabaseUserId: supabaseProfile.supabase_user_id,
            mgaTeam: supabaseProfile.mga_team || "",
            rgaTeam: supabaseProfile.rga_team || "",
            createdAt: new Date(supabaseProfile.created_at || /* @__PURE__ */ new Date()),
            updatedAt: new Date(supabaseProfile.updated_at || /* @__PURE__ */ new Date())
          };
        } else if (error?.code === "PGRST116") {
          console.log("\u{1F50D} SUPABASE: Profile not found, creating new one");
          return await this.createAgentProfileWithEmail({ email, ...updates });
        } else {
          console.warn("\u26A0\uFE0F SUPABASE: Error updating in Supabase:", error);
        }
      } else {
        console.warn("\u26A0\uFE0F SUPABASE: supabaseClient is null - cannot save to Supabase!");
      }
    } catch (supabaseError) {
      console.warn("\u26A0\uFE0F SUPABASE: Error updating Supabase:", supabaseError);
    }
    return null;
  }
  async createAgentProfileWithEmail(profileData) {
    console.log("\u{1F525} SUPABASE: Creating agent profile for email:", profileData.email);
    if (profileData.mgaTeam || profileData.rgaTeam) {
      await this.ensureMgaRgaInDirectory(profileData.mgaTeam, profileData.rgaTeam);
    }
    try {
      if (supabase) {
        const supabase2 = supabaseAdmin;
        console.log("\u{1F50D} SUPABASE: Creating in Supabase database");
        console.log("\u{1F50D} SUPABASE: Insert data:", {
          email: profileData.email,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone,
          zoom_id: profileData.zoomId,
          zoom_password: profileData.zoomPassword,
          supabase_user_id: profileData.email
        });
        const { data: supabaseProfile, error } = await supabase2.from("agent_profiles").insert({
          email: profileData.email,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone,
          zoom_id: profileData.zoomId,
          zoom_password: profileData.zoomPassword,
          supabase_user_id: profileData.email,
          // Use email as user ID since we don't have proper auth
          mga_team: profileData.mgaTeam || "",
          rga_team: profileData.rgaTeam || "",
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).select().single();
        console.log(`\u{1F50D} SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!supabaseProfile}`);
        console.log("\u{1F50D} SUPABASE: Insert result - data:", supabaseProfile, "error:", error);
        if (!error && supabaseProfile) {
          console.log("\u2705 SUPABASE: Created successfully in Supabase");
          await this.syncAgentHierarchyFromProfile(supabaseProfile.email, {
            first_name: supabaseProfile.first_name,
            last_name: supabaseProfile.last_name,
            mga_team: supabaseProfile.mga_team,
            rga_team: supabaseProfile.rga_team
          });
          return {
            id: supabaseProfile.id,
            email: supabaseProfile.email,
            firstName: supabaseProfile.first_name,
            lastName: supabaseProfile.last_name,
            phone: supabaseProfile.phone || "",
            zoomId: supabaseProfile.zoom_id,
            zoomPassword: supabaseProfile.zoom_password,
            profilePicture: supabaseProfile.profile_picture || "",
            supabaseUserId: supabaseProfile.supabase_user_id,
            mgaTeam: supabaseProfile.mga_team || "",
            rgaTeam: supabaseProfile.rga_team || "",
            createdAt: new Date(supabaseProfile.created_at || /* @__PURE__ */ new Date()),
            updatedAt: new Date(supabaseProfile.updated_at || /* @__PURE__ */ new Date())
          };
        } else {
          console.warn("\u26A0\uFE0F SUPABASE: Error creating in Supabase:", error);
          throw new Error(`Failed to create agent profile: ${error?.message}`);
        }
      } else {
        throw new Error("Supabase client not available");
      }
    } catch (supabaseError) {
      console.warn("\u26A0\uFE0F SUPABASE: Error creating in Supabase:", supabaseError);
      throw supabaseError;
    }
  }
  async getAllAgentProfiles() {
    const profiles = await db.select().from(agentProfiles);
    return profiles;
  }
  async syncAllProfilesToHierarchy() {
    if (!supabaseAdmin) {
      console.warn("\u26A0\uFE0F Supabase admin client unavailable - skipping agent hierarchy sync");
      return;
    }
    try {
      console.log("\u{1F504} Syncing agent_hierarchy with agent_profiles...");
      const { data: profiles, error } = await supabaseAdmin.from("agent_profiles").select("email, first_name, last_name, mga_team, rga_team").limit(5e3);
      if (error) {
        console.error("\u274C Failed to fetch agent profiles for hierarchy sync:", error);
        return;
      }
      if (!profiles || profiles.length === 0) {
        console.log("\u2139\uFE0F No agent profiles found to sync");
        return;
      }
      let syncedCount = 0;
      for (const profile of profiles) {
        if (!profile?.email) {
          continue;
        }
        await this.syncAgentHierarchyFromProfile(profile.email, {
          first_name: profile.first_name,
          last_name: profile.last_name,
          mga_team: profile.mga_team,
          rga_team: profile.rga_team
        });
        syncedCount += 1;
      }
      console.log(`\u2705 Agent hierarchy sync complete \u2014 processed ${syncedCount} profiles`);
    } catch (error) {
      console.error("\u274C Agent hierarchy sync failed:", error);
    }
  }
  async syncProducerListToHierarchy() {
    if (!supabaseAdmin) {
      console.warn("\u26A0\uFE0F Supabase admin client unavailable - skipping producerlist sync");
      return;
    }
    try {
      console.log("\u{1F504} Syncing agent_hierarchy with producerlist...");
      const { data: producers2, error: producersError } = await supabaseAdmin.from("producerlist").select("associate_id, agent_name, company_email, mga, rga, aoi_market, ao_market_2, designated_market").not("company_email", "is", null).not("company_email", "eq", "").limit(1e4);
      if (producersError) {
        console.error("\u274C Failed to fetch producerlist for hierarchy sync:", producersError);
        return;
      }
      if (!producers2 || producers2.length === 0) {
        console.log("\u2139\uFE0F No producers found to sync");
        return;
      }
      console.log(`\u{1F4CA} Found ${producers2.length} agents in producerlist`);
      const { data: directory, error: dirError } = await supabaseAdmin.from("mga_rga_directory").select("name, associate_id");
      const mgaLookup = /* @__PURE__ */ new Map();
      const rgaLookup = /* @__PURE__ */ new Map();
      if (directory) {
        directory.forEach((d) => {
          const nameUpper = d.name?.toUpperCase().trim();
          if (nameUpper && d.associate_id) {
            mgaLookup.set(nameUpper, d.associate_id);
            rgaLookup.set(nameUpper, d.associate_id);
          }
        });
      }
      console.log(`\u{1F4CB} Loaded ${mgaLookup.size} MGA/RGA entries from directory`);
      let syncedCount = 0;
      let errorCount = 0;
      for (const producer of producers2) {
        try {
          if (!producer.company_email || !producer.associate_id) {
            continue;
          }
          const mgaName = producer.mga && producer.mga !== "0" ? producer.mga.toUpperCase().trim() : null;
          const rgaName = producer.rga && producer.rga !== "0" ? producer.rga.toUpperCase().trim() : null;
          const mgaAssociateId = mgaName ? mgaLookup.get(mgaName) || null : null;
          const rgaAssociateId = rgaName ? rgaLookup.get(rgaName) || null : null;
          const payload2 = {
            agent_associate_id: producer.associate_id,
            agent_name: producer.agent_name || null,
            agent_email: producer.company_email.toLowerCase().trim(),
            mga_name: mgaName,
            mga_associate_id: mgaAssociateId,
            rga_name: rgaName,
            rga_associate_id: rgaAssociateId,
            aoi_market: producer.aoi_market || null,
            ao_market_2: producer.ao_market_2 || null,
            designated_market: producer.designated_market || null,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          const { error: upsertError } = await supabaseAdmin.from("agent_hierarchy").upsert(payload2, { onConflict: "agent_associate_id" });
          if (upsertError) {
            console.error(`\u274C Error syncing ${producer.agent_name}:`, upsertError);
            errorCount++;
          } else {
            syncedCount++;
            if (syncedCount % 100 === 0) {
              console.log(`   Synced ${syncedCount}/${producers2.length} agents...`);
            }
          }
        } catch (error) {
          console.error(`\u274C Failed to sync producer ${producer.agent_name}:`, error);
          errorCount++;
        }
      }
      console.log(`\u2705 Producerlist sync complete \u2014 synced ${syncedCount} agents, ${errorCount} errors`);
    } catch (error) {
      console.error("\u274C Producerlist hierarchy sync failed:", error);
    }
  }
  async syncAgentHierarchyFromProfile(email, profile) {
    if (!supabaseAdmin) {
      return;
    }
    const normalizedEmail = email?.toLowerCase()?.trim();
    if (!normalizedEmail) {
      return;
    }
    try {
      const { data: existingByEmail, error: existingError } = await supabaseAdmin.from("agent_hierarchy").select("id, agent_associate_id, agent_name, mga_name, rga_name, mga_associate_id, rga_associate_id").eq("agent_email", normalizedEmail).maybeSingle();
      if (existingError) {
        console.warn("\u26A0\uFE0F Unable to fetch existing agent hierarchy row:", existingError);
      }
      const identity = await this.resolveAgentIdentity(normalizedEmail, existingByEmail?.agent_associate_id, existingByEmail?.agent_name);
      const agentAssociateId = identity.associateId;
      if (!agentAssociateId) {
        console.warn(`\u26A0\uFE0F Skipping hierarchy sync \u2014 missing associate ID for ${normalizedEmail}`);
        return;
      }
      const agentName = identity.agentName || this.combineName(profile.first_name, profile.last_name) || normalizedEmail.split("@")[0];
      const mgaName = this.normalizeTeamName(profile.mga_team);
      const rgaName = this.normalizeTeamName(profile.rga_team);
      const [mgaAssociateId, rgaAssociateId] = await Promise.all([
        this.lookupTeamAssociateId(mgaName),
        this.lookupTeamAssociateId(rgaName)
      ]);
      const payload2 = {
        agent_associate_id: agentAssociateId,
        agent_name: agentName,
        agent_email: normalizedEmail,
        mga_name: mgaName,
        mga_associate_id: mgaAssociateId,
        rga_name: rgaName,
        rga_associate_id: rgaAssociateId,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (existingByEmail) {
        await supabaseAdmin.from("agent_hierarchy").update(payload2).eq("id", existingByEmail.id);
      } else {
        payload2.created_at = (/* @__PURE__ */ new Date()).toISOString();
        await supabaseAdmin.from("agent_hierarchy").upsert(payload2, { onConflict: "agent_associate_id" });
      }
    } catch (error) {
      console.error(`\u274C Failed to sync agent hierarchy for ${normalizedEmail}:`, error);
    }
  }
  async resolveAgentIdentity(email, existingAssociateId, existingName) {
    if (!supabaseAdmin) {
      return { associateId: existingAssociateId ?? null, agentName: existingName ?? null };
    }
    let associateId = existingAssociateId ?? null;
    let agentName = existingName ?? null;
    const trySetName = (newName) => {
      if (!agentName && newName && newName.trim().length > 0) {
        agentName = newName.trim();
      }
    };
    if (!associateId || !agentName) {
      const { data: customer } = await supabaseAdmin.from("customers").select("associate_id, first_name, last_name").or(`company_email.eq.${email},personal_email.eq.${email}`).maybeSingle();
      if (customer) {
        if (!associateId && customer.associate_id) {
          associateId = Number(customer.associate_id) || null;
        }
        trySetName(this.combineName(customer.first_name, customer.last_name));
      }
    }
    if (!associateId || !agentName) {
      const { data: credits } = await supabaseAdmin.from("user_credits").select("associate_id, name").eq("email", email).maybeSingle();
      if (credits) {
        if (!associateId && credits.associate_id) {
          associateId = Number(credits.associate_id) || null;
        }
        trySetName(credits.name);
      }
    }
    if (!associateId || !agentName) {
      const { data: producer } = await supabaseAdmin.from("producerlist").select("associate_id, agent_name").eq("company_email", email).maybeSingle();
      if (producer) {
        if (!associateId && producer.associate_id) {
          associateId = Number(producer.associate_id) || null;
        }
        trySetName(producer.agent_name);
      }
    }
    return { associateId: associateId ?? null, agentName: agentName ?? null };
  }
  combineName(first, last) {
    const parts = [first, last].filter((part) => part && part.trim().length > 0);
    if (parts.length === 0) {
      return null;
    }
    return parts.map((part) => part.trim()).join(" ");
  }
  normalizeTeamName(team) {
    if (!team) {
      return null;
    }
    const trimmed = team.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed;
  }
  async lookupTeamAssociateId(teamName) {
    if (!teamName || !supabaseAdmin) {
      return null;
    }
    const cacheKey = teamName.toLowerCase();
    if (this.teamDirectoryCache.has(cacheKey)) {
      return this.teamDirectoryCache.get(cacheKey) ?? null;
    }
    const { data, error } = await supabaseAdmin.from("mga_rga_directory").select("associate_id").ilike("name", teamName).maybeSingle();
    if (error) {
      console.warn(`\u26A0\uFE0F Failed to resolve associate ID for team ${teamName}:`, error);
      this.teamDirectoryCache.set(cacheKey, null);
      return null;
    }
    const associateId = data?.associate_id ? Number(data.associate_id) : null;
    this.teamDirectoryCache.set(cacheKey, associateId ?? null);
    return associateId ?? null;
  }
  /**
   * 🔥 CRITICAL: Ensures MGA/RGA exists in mga_rga_directory by syncing from producerlist
   * This is called when Producer Setup saves MGA/RGA team names
   */
  async ensureMgaRgaInDirectory(mgaTeam, rgaTeam) {
    if (!supabaseAdmin) {
      console.warn("\u26A0\uFE0F Supabase admin unavailable - cannot sync MGA/RGA to directory");
      return;
    }
    const teamsToSync = [];
    if (mgaTeam) teamsToSync.push({ name: mgaTeam.trim().toUpperCase(), role: "MGA" });
    if (rgaTeam) teamsToSync.push({ name: rgaTeam.trim().toUpperCase(), role: "RGA" });
    if (teamsToSync.length === 0) {
      return;
    }
    console.log(`\u{1F504} Syncing ${teamsToSync.length} MGA/RGA teams to directory...`);
    for (const team of teamsToSync) {
      try {
        const { data: existing, error: checkError } = await supabaseAdmin.from("mga_rga_directory").select("associate_id, name, role").ilike("name", team.name).maybeSingle();
        if (checkError) {
          console.warn(`\u26A0\uFE0F Error checking ${team.role} ${team.name} in directory:`, checkError);
          continue;
        }
        if (existing) {
          console.log(`\u2705 ${team.role} ${team.name} already exists in directory (associate_id: ${existing.associate_id})`);
          this.teamDirectoryCache.set(team.name.toLowerCase(), existing.associate_id);
          continue;
        }
        console.log(`\u{1F50D} ${team.role} ${team.name} not in directory, looking up in producerlist...`);
        const { data: producer, error: producerError } = await supabaseAdmin.from("producerlist").select("associate_id, agent_name, company_email, mga, rga").ilike("agent_name", team.name).limit(1).maybeSingle();
        if (producerError) {
          console.warn(`\u26A0\uFE0F Error looking up ${team.role} ${team.name} in producerlist:`, producerError);
          continue;
        }
        if (!producer) {
          console.warn(`\u26A0\uFE0F ${team.role} ${team.name} not found in producerlist - cannot sync to directory`);
          continue;
        }
        const isMga = producer.mga?.toUpperCase().trim() === team.name;
        const isRga = producer.rga?.toUpperCase().trim() === team.name;
        let role = team.role;
        if (isMga && isRga) {
          role = "BOTH";
        } else if (isMga) {
          role = "MGA";
        } else if (isRga) {
          role = "RGA";
        }
        const { data: inserted, error: insertError } = await supabaseAdmin.from("mga_rga_directory").insert({
          associate_id: producer.associate_id,
          name: team.name,
          email: producer.company_email || null,
          role
        }).select().single();
        if (insertError) {
          if (insertError.code === "23505") {
            console.log(`\u{1F504} ${team.role} ${team.name} already exists (duplicate key), updating...`);
            const { error: updateError } = await supabaseAdmin.from("mga_rga_directory").update({
              name: team.name,
              email: producer.company_email || null,
              role,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("associate_id", producer.associate_id);
            if (updateError) {
              console.error(`\u274C Failed to update ${team.role} ${team.name} in directory:`, updateError);
            } else {
              console.log(`\u2705 Updated ${team.role} ${team.name} in directory (associate_id: ${producer.associate_id})`);
              this.teamDirectoryCache.set(team.name.toLowerCase(), producer.associate_id);
            }
          } else {
            console.error(`\u274C Failed to insert ${team.role} ${team.name} into directory:`, insertError);
          }
        } else if (inserted) {
          console.log(`\u2705 Added ${team.role} ${team.name} to directory (associate_id: ${inserted.associate_id})`);
          this.teamDirectoryCache.set(team.name.toLowerCase(), inserted.associate_id);
        }
      } catch (error) {
        console.error(`\u274C Error syncing ${team.role} ${team.name} to directory:`, error);
      }
    }
  }
  // RGA Management
  async getDistinctRGATeams() {
    const results = await db.selectDistinct({ rga: agentProfiles.rgaTeam }).from(agentProfiles).where(sql3`${agentProfiles.rgaTeam} IS NOT NULL`);
    return results.map((r) => r.rga).filter(Boolean);
  }
  async getMGAsByRGA(rgaTeam) {
    const results = await db.selectDistinct({ mga: agentProfiles.mgaTeam }).from(agentProfiles).where(eq(agentProfiles.rgaTeam, rgaTeam)).where(sql3`${agentProfiles.mgaTeam} IS NOT NULL`);
    return results.map((r) => r.mga).filter(Boolean);
  }
  async assignMGAToRGA(mgaTeam, rgaTeam) {
    await db.update(agentProfiles).set({ rgaTeam }).where(eq(agentProfiles.mgaTeam, mgaTeam));
  }
  async updateAgentProfileBySupabaseId(supabaseUserId, updates) {
    console.log("\u{1F504} SUPABASE STORAGE: Updating agent profile for user:", supabaseUserId);
    console.log("\u{1F504} SUPABASE STORAGE: Updates to apply:", updates);
    console.log("\u{1F525} CRITICAL: MGA Team in updates:", updates.mgaTeam, "RGA Team:", updates.rgaTeam);
    if (updates.mgaTeam || updates.rgaTeam) {
      await this.ensureMgaRgaInDirectory(updates.mgaTeam, updates.rgaTeam);
    }
    if (supabase) {
      try {
        const supabase2 = supabaseAdmin;
        const updateData = {
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (updates.firstName !== void 0) updateData.first_name = updates.firstName;
        if (updates.lastName !== void 0) updateData.last_name = updates.lastName;
        if (updates.phone !== void 0) updateData.phone = updates.phone;
        if (updates.zoomId !== void 0) updateData.zoom_id = updates.zoomId;
        if (updates.zoomPassword !== void 0) updateData.zoom_password = updates.zoomPassword;
        if (updates.mgaTeam !== void 0) {
          updateData.mga_team = updates.mgaTeam;
          console.log(`\u2705 SAVING MGA_TEAM TO SUPABASE: ${updates.mgaTeam}`);
        }
        if (updates.rgaTeam !== void 0) {
          updateData.rga_team = updates.rgaTeam;
          console.log(`\u2705 SAVING RGA_TEAM TO SUPABASE: ${updates.rgaTeam}`);
        }
        console.log("\u{1F50D} SUPABASE: Update data being saved:", updateData);
        const { data: supabaseProfile, error } = await supabase2.from("agent_profiles").update(updateData).eq("supabase_user_id", supabaseUserId).select().single();
        if (error) {
          console.error("\u274C SUPABASE: Error updating agent profile:", error);
        } else if (supabaseProfile) {
          console.log("\u2705 SUPABASE: Profile updated successfully in Supabase:", {
            email: supabaseProfile.email,
            mga_team: supabaseProfile.mga_team,
            rga_team: supabaseProfile.rga_team
          });
          if (updates.mgaTeam || updates.rgaTeam) {
            await this.syncAgentHierarchyFromProfile(supabaseProfile.email, {
              first_name: supabaseProfile.first_name,
              last_name: supabaseProfile.last_name,
              mga_team: supabaseProfile.mga_team,
              rga_team: supabaseProfile.rga_team
            });
          }
          return {
            id: supabaseProfile.id,
            email: supabaseProfile.email,
            firstName: supabaseProfile.first_name,
            lastName: supabaseProfile.last_name,
            phone: supabaseProfile.phone || "",
            zoomId: supabaseProfile.zoom_id,
            zoomPassword: supabaseProfile.zoom_password,
            supabaseUserId: supabaseProfile.supabase_user_id,
            mgaTeam: supabaseProfile.mga_team || "",
            rgaTeam: supabaseProfile.rga_team || "",
            createdAt: new Date(supabaseProfile.created_at || /* @__PURE__ */ new Date()),
            updatedAt: new Date(supabaseProfile.updated_at || /* @__PURE__ */ new Date())
          };
        }
      } catch (supabaseError) {
        console.error("\u274C SUPABASE: Error updating Supabase:", supabaseError);
      }
    }
    const [updatedProfile] = await db.update(agentProfiles).set({
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(agentProfiles.supabaseUserId, supabaseUserId)).returning();
    if (updatedProfile) {
      console.log("\u2705 LOCAL DB: Profile updated successfully for:", updatedProfile.email);
    } else {
      console.log("\u274C LOCAL DB: No profile found to update for user:", supabaseUserId);
    }
    return updatedProfile || null;
  }
  // Outbound call tracking for intelligent inbound routing
  async trackOutboundCall(callData) {
    const [trackedCall] = await db.insert(outboundCallHistory).values({
      leadPhone: callData.leadPhone,
      leadName: callData.leadName || null,
      leadState: callData.leadState || null,
      agentEmail: callData.agentEmail,
      agentName: callData.agentName || null,
      callSid: callData.callSid || null,
      conferenceName: callData.conferenceName || null,
      localPresenceNumber: callData.localPresenceNumber || null,
      callStatus: callData.callStatus || "initiated",
      callDisposition: callData.callDisposition || null,
      callDuration: callData.callDuration || 0,
      callAttempts: callData.callAttempts || 1,
      notes: callData.notes || null,
      lastContactedAt: /* @__PURE__ */ new Date(),
      startTime: /* @__PURE__ */ new Date(),
      answerTime: null,
      endTime: null,
      createdAt: /* @__PURE__ */ new Date()
    }).returning();
    return trackedCall;
  }
  async createOutboundCall(callData) {
    const [call] = await db.insert(outboundCallHistory).values({
      leadPhone: callData.leadPhone,
      agentEmail: callData.agentEmail,
      callSid: callData.callSid,
      callStatus: callData.callStatus,
      callDisposition: callData.callDisposition || null,
      callDuration: callData.callDuration || 0,
      startTime: callData.startTime || /* @__PURE__ */ new Date(),
      endTime: callData.endTime || null,
      createdAt: /* @__PURE__ */ new Date()
    }).returning();
    return call;
  }
  async updateOutboundCallStatus(updateData) {
    const updates = {
      lastContactedAt: /* @__PURE__ */ new Date()
    };
    if (updateData.callStatus) updates.callStatus = updateData.callStatus;
    if (updateData.callDisposition) updates.callDisposition = updateData.callDisposition;
    if (updateData.callDuration !== void 0) updates.callDuration = updateData.callDuration;
    if (updateData.answerTime) updates.answerTime = updateData.answerTime;
    if (updateData.endTime) updates.endTime = updateData.endTime;
    const [updatedCall] = await db.update(outboundCallHistory).set(updates).where(and(
      eq(outboundCallHistory.leadPhone, updateData.leadPhone),
      eq(outboundCallHistory.agentEmail, updateData.agentEmail)
    )).returning();
    return updatedCall || void 0;
  }
  async getLastCallToNumber(phoneNumber) {
    const [lastCall] = await db.select().from(outboundCallHistory).where(eq(outboundCallHistory.leadPhone, phoneNumber)).orderBy(outboundCallHistory.lastContactedAt).limit(1);
    return lastCall || void 0;
  }
  async getAgentForCallbacks(phoneNumber) {
    const lastCall = await this.getLastCallToNumber(phoneNumber);
    return lastCall?.agentEmail || void 0;
  }
  // Inbound call routing management
  async createInboundCallRoute(routeData) {
    const [newRoute] = await db.insert(inboundCallRouting).values({
      callerPhone: routeData.callerPhone,
      incomingCallSid: routeData.incomingCallSid || null,
      routedToAgent: routeData.routedToAgent || null,
      routingReason: routeData.routingReason || "new_caller",
      conferenceName: routeData.conferenceName || null,
      callStatus: routeData.callStatus || "active",
      notes: routeData.notes || null,
      callStartTime: /* @__PURE__ */ new Date()
    }).returning();
    return newRoute;
  }
  async getActiveInboundCalls(agentEmail) {
    if (agentEmail) {
      return await db.select().from(inboundCallRouting).where(and(
        eq(inboundCallRouting.callStatus, "active"),
        eq(inboundCallRouting.routedToAgent, agentEmail)
      ));
    } else {
      return await db.select().from(inboundCallRouting).where(eq(inboundCallRouting.callStatus, "active"));
    }
  }
  async updateInboundCallStatus(callSid, status, endTime) {
    const updates = { callStatus: status };
    if (endTime) {
      updates.callEndTime = endTime;
    }
    const [updatedRoute] = await db.update(inboundCallRouting).set(updates).where(eq(inboundCallRouting.incomingCallSid, callSid)).returning();
    return updatedRoute || void 0;
  }
  async getCallbackStats() {
    const activeCalls = await this.getActiveInboundCalls();
    const totalActiveCalls = activeCalls.length;
    const callbackCalls = activeCalls.filter((call) => call.routingReason === "callback").length;
    const newCallerCalls = activeCalls.filter((call) => call.routingReason === "new_caller").length;
    const callbackPercentage = totalActiveCalls > 0 ? Math.round(callbackCalls / totalActiveCalls * 100) : 0;
    const agentSpecificCallbacks = {};
    activeCalls.filter((call) => call.routingReason === "callback" && call.routedToAgent).forEach((call) => {
      const agent = call.routedToAgent;
      agentSpecificCallbacks[agent] = (agentSpecificCallbacks[agent] || 0) + 1;
    });
    return {
      totalActiveCalls,
      callbackCalls,
      newCallerCalls,
      callbackPercentage,
      agentSpecificCallbacks
    };
  }
  // Recruit Candidates operations - SUPABASE DIRECT QUERIES
  async createRecruitCandidate(candidate) {
    const supabaseCandidate = {
      first_name: candidate.firstName,
      last_name: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      city: candidate.city,
      state: candidate.state,
      zip_code: candidate.zipCode,
      status: candidate.status,
      position: candidate.position,
      experience: candidate.experience,
      rating: candidate.rating,
      notes: candidate.notes,
      appointment_date: candidate.appointmentDate,
      appointment_notes: candidate.appointmentNotes,
      current_stage_id: candidate.currentStageId ?? 1,
      agent_id: candidate.agentId,
      agent_email: candidate.agentEmail,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data, error } = await supabaseAdmin.from("recruit_candidates").insert(supabaseCandidate).select().single();
    if (error) throw error;
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      state: data.state,
      zipCode: data.zip_code,
      status: data.status,
      position: data.position,
      experience: data.experience,
      rating: data.rating,
      notes: data.notes,
      appointmentDate: data.appointment_date,
      appointmentNotes: data.appointment_notes,
      currentStageId: data.current_stage_id ?? 1,
      stageEnteredAt: data.stage_entered_at,
      agentId: data.agent_id,
      agentEmail: data.agent_email,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
  async getRecruitCandidates(agentEmail) {
    const normalizedAgentEmail = String(agentEmail || "").trim().toLowerCase();
    if (!normalizedAgentEmail) return [];
    let associateId = null;
    const { data: producerData } = await supabaseAdmin.from("producerlist").select("Associate ID").ilike("Company Email", normalizedAgentEmail).single();
    associateId = producerData?.["Associate ID"];
    let query = supabaseAdmin.from("recruit_candidates").select("*");
    if (associateId) {
      query = query.or(`agent_email.ilike.${normalizedAgentEmail},agent_id.eq.${associateId}`);
    } else {
      query = query.ilike("agent_email", normalizedAgentEmail);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      console.error("\u274C Error fetching recruit candidates from Supabase:", error);
      throw error;
    }
    return (data || []).map((candidate) => ({
      id: candidate.id,
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      email: candidate.email,
      phone: candidate.phone,
      city: candidate.city,
      state: candidate.state,
      zipCode: candidate.zip_code,
      status: candidate.status,
      currentStageId: candidate.current_stage_id ?? 1,
      position: candidate.position,
      experience: candidate.experience,
      rating: candidate.rating,
      notes: candidate.notes,
      aiSummary: candidate.ai_summary,
      appointmentDate: candidate.appointment_date,
      appointmentNotes: candidate.appointment_notes,
      agentId: candidate.agent_id,
      agentEmail: candidate.agent_email,
      createdAt: new Date(candidate.created_at),
      updatedAt: new Date(candidate.updated_at)
    }));
  }
  async getRecruitCandidateById(id) {
    const { data, error } = await supabaseAdmin.from("recruit_candidates").select("*").eq("id", id).single();
    if (error) {
      if (error.code === "PGRST116") return void 0;
      throw error;
    }
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      state: data.state,
      zipCode: data.zip_code,
      status: data.status,
      currentStageId: data.current_stage_id ?? 1,
      position: data.position,
      experience: data.experience,
      rating: data.rating,
      notes: data.notes,
      aiSummary: data.ai_summary,
      appointmentDate: data.appointment_date,
      appointmentNotes: data.appointment_notes,
      stageEnteredAt: data.stage_entered_at,
      agentId: data.agent_id,
      agentEmail: data.agent_email,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
  async updateRecruitCandidate(id, updates) {
    const supabaseUpdates = {
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (updates.firstName !== void 0) supabaseUpdates.first_name = updates.firstName;
    if (updates.lastName !== void 0) supabaseUpdates.last_name = updates.lastName;
    if (updates.email !== void 0) supabaseUpdates.email = updates.email;
    if (updates.phone !== void 0) supabaseUpdates.phone = updates.phone;
    if (updates.city !== void 0) supabaseUpdates.city = updates.city;
    if (updates.state !== void 0) supabaseUpdates.state = updates.state;
    if (updates.zipCode !== void 0) supabaseUpdates.zip_code = updates.zipCode;
    if (updates.status !== void 0) supabaseUpdates.status = updates.status;
    if (updates.position !== void 0) supabaseUpdates.position = updates.position;
    if (updates.experience !== void 0) supabaseUpdates.experience = updates.experience;
    if (updates.rating !== void 0) supabaseUpdates.rating = updates.rating;
    if (updates.notes !== void 0) supabaseUpdates.notes = updates.notes;
    if (updates.appointmentDate !== void 0) supabaseUpdates.appointment_date = updates.appointmentDate;
    if (updates.appointmentNotes !== void 0) supabaseUpdates.appointment_notes = updates.appointmentNotes;
    if (updates.currentStageId !== void 0) supabaseUpdates.current_stage_id = updates.currentStageId;
    if (updates.stageEnteredAt !== void 0) supabaseUpdates.stage_entered_at = updates.stageEnteredAt;
    const { data, error } = await supabaseAdmin.from("recruit_candidates").update(supabaseUpdates).eq("id", id).select().single();
    if (error) {
      if (error.code === "PGRST116") return void 0;
      throw error;
    }
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      state: data.state,
      zipCode: data.zip_code,
      status: data.status,
      position: data.position,
      experience: data.experience,
      rating: data.rating,
      notes: data.notes,
      appointmentDate: data.appointment_date,
      appointmentNotes: data.appointment_notes,
      currentStageId: data.current_stage_id ?? 1,
      stageEnteredAt: data.stage_entered_at,
      agentId: data.agent_id,
      agentEmail: data.agent_email,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
  async deleteRecruitCandidate(id) {
    const { error } = await supabaseAdmin.from("recruit_candidates").delete().eq("id", id);
    if (error) {
      console.error("\u274C Error deleting recruit candidate from Supabase:", error);
      return false;
    }
    return true;
  }
  // Music preferences - simple implementation returning default for now
  async getMusicPreferences(agentEmail) {
    return { musicType: "silence" };
  }
  async getDistinctMGATeams() {
    const profiles = await db.select({ mgaTeam: agentProfiles.mgaTeam }).from(agentProfiles).where(sql3`mga_team IS NOT NULL AND mga_team != ''`);
    const uniqueTeams = [...new Set(profiles.map((p) => p.mgaTeam).filter(Boolean))];
    return uniqueTeams;
  }
  // AOI Follow-up Management - Two-stage accountability implementation
  async createFollowup(followupData) {
    try {
      console.log("\u{1F4DD} Creating AOI follow-up:", followupData);
      const [newFollowup] = await db.insert(aoiFollowups).values({
        vdpCallId: followupData.vdp_call_id || 0,
        // Default if not provided
        taalk_leadid: followupData.taalk_leadid || followupData.leadid || `temp_${Date.now()}`,
        agentEmail: followupData.agent_email,
        followupType: followupData.initial_resolution === "appointment_set" ? "appointment" : "callback",
        initialResolution: followupData.initial_resolution,
        initialResolutionAt: /* @__PURE__ */ new Date(),
        initialNotes: followupData.notes || "",
        dueDate: new Date(followupData.due_date),
        status: "pending"
      }).returning();
      console.log("\u2705 AOI follow-up created:", newFollowup);
      return newFollowup;
    } catch (error) {
      console.error("\u274C Error creating AOI follow-up:", error);
      throw error;
    }
  }
  async getOverdueFollowups() {
    try {
      console.log("\u{1F50D} Getting overdue AOI follow-ups...");
      const today = /* @__PURE__ */ new Date();
      const overdueFollowups = await db.select().from(aoiFollowups).where(sql3`due_date < ${today} AND status = 'pending'`).orderBy(aoiFollowups.dueDate);
      console.log(`\u{1F4CB} Found ${overdueFollowups.length} overdue follow-ups`);
      return overdueFollowups.map((followup) => ({
        ...followup,
        customer_name: "Unknown Customer",
        phone_number: "Unknown Phone",
        agent_email: followup.agentEmail,
        initial_resolution: followup.initialResolution,
        due_date: followup.dueDate,
        created_at: followup.createdAt
      }));
    } catch (error) {
      console.error("\u274C Error getting overdue follow-ups:", error);
      return [];
    }
  }
  // Get ALL calls from both VDP calls and masterlead tables
  async getAllVDPCallsNeedingResolution() {
    try {
      console.log("\u{1F50D} Getting calls needing resolution from VDP calls and masterlead...");
      const supabase2 = supabase;
      if (!supabase2) {
        console.error("\u274C Supabase client not available");
        return [];
      }
      const { count: vdpTotalCount, error: vdpCountError } = await supabase2.from("vdp_calls").select("*", { count: "exact", head: true });
      console.log(`\u{1F4CA} Total VDP calls in database: ${vdpTotalCount || 0}`);
      if (vdpCountError) console.log("\u274C VDP count error:", vdpCountError);
      const { count: masterleadTotalCount, error: masterleadCountError } = await masterleadClient.from("masterlead").select("*", { count: "exact", head: true });
      console.log(`\u{1F4CA} Total masterlead records in database: ${masterleadTotalCount || 0}`);
      if (masterleadCountError) console.log("\u274C Masterlead count error:", masterleadCountError);
      const { data: vdpCalls2, error: vdpError } = await supabase2.from("vdp_calls").select("*").or("duration.gte.240,duration.is.null").order("id", { ascending: false }).limit(200);
      if (vdpError) {
        console.error("\u274C Supabase error getting VDP calls:", vdpError);
      } else {
        console.log(`\u{1F50D} Retrieved ${vdpCalls2?.length || 0} VDP calls`);
      }
      const { data: masterleadCalls, error: masterleadError } = await masterleadClient.from("masterlead").select("*").or("cnresolution.ilike.%booked%,cnresolution.ilike.%appointment%,cnresolution.ilike.%call back%,cnresolution.ilike.%callback%").order("created_at", { ascending: false }).limit(2e3);
      if (masterleadError) {
        console.error("\u274C Masterlead query error getting masterlead calls:", masterleadError);
      } else {
        console.log(`\u{1F50D} Retrieved ${masterleadCalls?.length || 0} masterlead calls`);
      }
      const allCalls = [];
      if (vdpCalls2) {
        vdpCalls2.forEach((call, index) => {
          let callDate = null;
          if (call.time && !isNaN(Date.parse(call.time))) {
            callDate = call.time;
          } else if (call.Date && !isNaN(Date.parse(call.Date))) {
            callDate = call.Date;
          } else {
            callDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1e3).toISOString();
          }
          allCalls.push({
            ...call,
            source: "vdp_calls",
            customer_name: `${call.firstname || ""} ${call.lastname || ""}`.trim() || "Unknown",
            phone: call.Phone || "Unknown",
            agent_email: call.agent || call.cn_email || call.email || call.agent_email || "Unknown Agent",
            market: call.market || "Unknown Market",
            taalk_leadid: call.leadid,
            cnresolution: "No resolution tracking",
            // VDP calls don't track resolutions
            created_at: callDate
          });
        });
      }
      if (masterleadCalls) {
        masterleadCalls.forEach((call, index) => {
          let callDate = call.called_at || call.created_at || call.updated_at || call.last_contacted;
          if (!callDate || isNaN(Date.parse(callDate))) {
            callDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1e3).toISOString();
          }
          allCalls.push({
            ...call,
            source: "masterlead",
            customer_name: `${call.first_name || ""} ${call.last_name || ""}`.trim() || "Unknown",
            phone: call.phone || "Unknown",
            agent_email: call.assigned_agent_email || call.cn_email || call.agent_email || "Unknown Agent",
            market: call.taalk_market || "Unknown Market",
            taalk_leadid: call.taalk_lead_id,
            created_at: callDate
          });
        });
      }
      console.log(`\u{1F50D} Found ${vdpCalls2?.length || 0} VDP calls + ${masterleadCalls?.length || 0} masterlead calls = ${allCalls.length} total calls needing resolution`);
      return allCalls;
    } catch (error) {
      console.error("\u274C Error getting calls needing resolution:", error);
      return [];
    }
  }
  async getPendingFollowups(agentEmail) {
    try {
      console.log(`\u{1F4C5} Getting pending follow-ups for agent: ${agentEmail}`);
      const pendingFollowups = await db.select().from(aoiFollowups).where(sql3`agent_email = ${agentEmail} AND status = 'pending'`).orderBy(aoiFollowups.dueDate);
      console.log(`\u{1F4CB} Found ${pendingFollowups.length} pending follow-ups for ${agentEmail}`);
      return pendingFollowups;
    } catch (error) {
      console.error("\u274C Error getting pending follow-ups:", error);
      return [];
    }
  }
  async completeFollowup(followupId, outcome, notes) {
    try {
      console.log(`\u2705 Completing follow-up ${followupId} with outcome: ${outcome}`);
      const [completedFollowup] = await db.update(aoiFollowups).set({
        status: "completed",
        finalOutcome: outcome,
        finalNotes: notes || "",
        completedAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(aoiFollowups.id, followupId)).returning();
      console.log("\u2705 Follow-up completed:", completedFollowup);
      return completedFollowup;
    } catch (error) {
      console.error("\u274C Error completing follow-up:", error);
      throw error;
    }
  }
  // Current Lead Management - in-memory storage keyed by userEmail
  currentLeads = /* @__PURE__ */ new Map();
  async getCurrentLead(userEmail) {
    return this.currentLeads.get(userEmail) || null;
  }
  async setCurrentLead(userEmail, currentLead) {
    this.currentLeads.set(userEmail, currentLead);
    console.log(`\u{1F4CB} Set current lead for ${userEmail}: ${currentLead.source} - ${currentLead.name} (${currentLead.phone})`);
  }
  async clearCurrentLead(userEmail) {
    this.currentLeads.delete(userEmail);
    console.log(`\u{1F5D1}\uFE0F Cleared current lead for ${userEmail}`);
  }
  // Quality Manager Team Assignment methods
  async getQMTeamAssignments(qmEmail) {
    try {
      const assignments = await db.select({ mgaTeam: qualityManagerTeamAssignments.mgaTeam }).from(qualityManagerTeamAssignments).where(eq(qualityManagerTeamAssignments.qmEmail, qmEmail));
      return assignments.map((a) => a.mgaTeam);
    } catch (error) {
      console.error("\u274C Error getting QM team assignments:", error);
      return [];
    }
  }
  async assignQMToTeam(qmEmail, mgaTeam) {
    try {
      await db.insert(qualityManagerTeamAssignments).values({ qmEmail, mgaTeam }).onConflictDoNothing();
      console.log(`\u2705 Assigned QM ${qmEmail} to team ${mgaTeam}`);
    } catch (error) {
      console.error("\u274C Error assigning QM to team:", error);
      throw error;
    }
  }
  async removeQMFromTeam(qmEmail, mgaTeam) {
    try {
      await db.delete(qualityManagerTeamAssignments).where(
        and(
          eq(qualityManagerTeamAssignments.qmEmail, qmEmail),
          eq(qualityManagerTeamAssignments.mgaTeam, mgaTeam)
        )
      );
      console.log(`\u2705 Removed QM ${qmEmail} from team ${mgaTeam}`);
    } catch (error) {
      console.error("\u274C Error removing QM from team:", error);
      throw error;
    }
  }
  async replaceQMTeamAssignments(qmEmail, mgaTeams2) {
    try {
      await db.delete(qualityManagerTeamAssignments).where(eq(qualityManagerTeamAssignments.qmEmail, qmEmail));
      if (mgaTeams2.length > 0) {
        const newAssignments = mgaTeams2.map((mgaTeam) => ({ qmEmail, mgaTeam }));
        await db.insert(qualityManagerTeamAssignments).values(newAssignments);
      }
      console.log(`\u2705 Replaced QM ${qmEmail} team assignments with: ${mgaTeams2.join(", ")}`);
    } catch (error) {
      console.error("\u274C Error replacing QM team assignments:", error);
      throw error;
    }
  }
  async getAllQMTeamAssignments() {
    try {
      return await db.select().from(qualityManagerTeamAssignments);
    } catch (error) {
      console.error("\u274C Error getting all QM team assignments:", error);
      return [];
    }
  }
  // Enhanced Team Management - MGA/RGA Teams
  async getAllTeams() {
    try {
      const teams2 = await db.select({
        id: mgaTeams.id,
        name: mgaTeams.name,
        description: mgaTeams.description,
        teamType: mgaTeams.teamType,
        isActive: mgaTeams.isActive
      }).from(mgaTeams).where(eq(mgaTeams.isActive, true));
      return teams2;
    } catch (error) {
      console.error("\u274C Error getting all teams:", error);
      return [];
    }
  }
  async getTeamsByType(teamType) {
    try {
      const teams2 = await db.select({
        id: mgaTeams.id,
        name: mgaTeams.name,
        description: mgaTeams.description,
        teamType: mgaTeams.teamType,
        isActive: mgaTeams.isActive
      }).from(mgaTeams).where(and(
        eq(mgaTeams.isActive, true),
        eq(mgaTeams.teamType, teamType)
      ));
      return teams2;
    } catch (error) {
      console.error(`\u274C Error getting ${teamType} teams:`, error);
      return [];
    }
  }
  async getQualityManagersByTeam(teamId) {
    try {
      const team = await db.select({ name: mgaTeams.name }).from(mgaTeams).where(eq(mgaTeams.id, teamId)).limit(1);
      if (team.length === 0) {
        return [];
      }
      const assignments = await db.select({ qmEmail: qualityManagerTeamAssignments.qmEmail }).from(qualityManagerTeamAssignments).where(eq(qualityManagerTeamAssignments.mgaTeam, team[0].name));
      return assignments.map((a) => a.qmEmail);
    } catch (error) {
      console.error("\u274C Error getting quality managers by team:", error);
      return [];
    }
  }
  async assignQMToTeamById(qmEmail, teamId) {
    try {
      const team = await db.select({ name: mgaTeams.name }).from(mgaTeams).where(eq(mgaTeams.id, teamId)).limit(1);
      if (team.length === 0) {
        throw new Error(`Team with ID ${teamId} not found`);
      }
      await this.assignQMToTeam(qmEmail, team[0].name);
      console.log(`\u2705 Assigned QM ${qmEmail} to team ID ${teamId} (${team[0].name})`);
    } catch (error) {
      console.error("\u274C Error assigning QM to team by ID:", error);
      throw error;
    }
  }
  async removeQMFromTeamById(qmEmail, teamId) {
    try {
      const team = await db.select({ name: mgaTeams.name }).from(mgaTeams).where(eq(mgaTeams.id, teamId)).limit(1);
      if (team.length === 0) {
        throw new Error(`Team with ID ${teamId} not found`);
      }
      await this.removeQMFromTeam(qmEmail, team[0].name);
      console.log(`\u2705 Removed QM ${qmEmail} from team ID ${teamId} (${team[0].name})`);
    } catch (error) {
      console.error("\u274C Error removing QM from team by ID:", error);
      throw error;
    }
  }
};
var storage = new DatabaseStorage();

// server/auth-service.ts
import { z as z2 } from "zod";

// server/usage-tracker.ts
init_db();
init_supabase();
init_email_mapper();
import { sql as sql4 } from "drizzle-orm";
var UsageTracker = class {
  /**
   * Track a login event
   */
  static async trackLogin(agentEmail, sessionId, ipAddress) {
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from("agent_activity_log").insert({
          agent_email: agentEmail.toLowerCase(),
          activity_type: "login",
          session_id: sessionId,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (supabaseAdmin) {
        const weekStart = /* @__PURE__ */ new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const realEmail = await mapEmailToRealEmail(agentEmail);
        const weekStartStr = weekStart.toISOString().split("T")[0];
        if (realEmail !== agentEmail.toLowerCase().trim()) {
          await supabaseAdmin.from("weekly_usage_stats").delete().eq("agent_email", agentEmail.toLowerCase().trim()).eq("week_start_date", weekStartStr);
        }
        let incrementError = null;
        try {
          const rpcResult = await supabaseAdmin.rpc("increment_login_stats", {
            p_agent_email: realEmail,
            p_week_start_date: weekStartStr
          });
          incrementError = rpcResult?.error || null;
          if (incrementError?.code === "PGRST202") {
            incrementError = null;
          }
        } catch (rpcError) {
          console.warn("\u26A0\uFE0F RPC increment_login_stats not available, using fallback:", rpcError);
          const { data: logins } = await supabaseAdmin.from("agent_activity_log").select("timestamp").eq("agent_email", realEmail).eq("activity_type", "login").gte("timestamp", weekStart.toISOString());
          const uniqueDays = new Set(logins?.map((l) => new Date(l.timestamp).toDateString()) || []).size;
          const { data: currentStats } = await supabaseAdmin.from("weekly_usage_stats").select("total_logins").eq("agent_email", realEmail).eq("week_start_date", weekStartStr).maybeSingle();
          const { error: upsertError } = await supabaseAdmin.from("weekly_usage_stats").upsert({
            agent_email: realEmail,
            week_start_date: weekStartStr,
            week_end_date: weekEnd.toISOString().split("T")[0],
            total_logins: (currentStats?.total_logins || 0) + 1,
            unique_login_days: uniqueDays,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }, {
            onConflict: "agent_email,week_start_date"
          });
          incrementError = upsertError || null;
        }
        if (incrementError) {
          console.error("\u274C Error incrementing login stats:", incrementError);
        }
      }
      console.log(`\u2705 Tracked login for ${agentEmail}`);
    } catch (error) {
      console.error("\u274C Error tracking login:", error);
    }
  }
  /**
   * Track heartbeat (for calculating online time)
   */
  static async trackHeartbeat(agentEmail, sessionId) {
    try {
      console.log(`\u{1F493} Tracking heartbeat for ${agentEmail}, session: ${sessionId}`);
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from("agent_activity_log").insert({
          agent_email: agentEmail.toLowerCase(),
          activity_type: "heartbeat",
          session_id: sessionId,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
          // Supabase uses timestamp column
        }).select("id").single();
        if (error) {
          console.error("\u274C Supabase heartbeat insert failed:", error);
          console.error("\u274C Error details:", JSON.stringify(error, null, 2));
          throw error;
        }
        console.log(`\u2705 Heartbeat inserted into Supabase agent_activity_log:`, data?.id || "no id returned");
      } else {
        console.error("\u274C supabaseAdmin not available!");
        throw new Error("Supabase admin client not configured");
      }
      if (supabaseAdmin) {
        const weekStart = /* @__PURE__ */ new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const { data: statsData, error: statsError } = await supabaseAdmin.from("weekly_usage_stats").upsert({
          agent_email: agentEmail.toLowerCase(),
          week_start_date: weekStart.toISOString().split("T")[0],
          week_end_date: weekEnd.toISOString().split("T")[0],
          last_activity_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, {
          onConflict: "agent_email,week_start_date"
        }).select("id").single();
        if (statsError) {
          console.error("\u274C Error upserting weekly stats:", statsError);
        } else {
          console.log(`\u2705 Weekly stats updated in Supabase:`, statsData?.id || "no id returned");
        }
      }
      console.log(`\u{1F493} Heartbeat logged successfully for ${agentEmail}`);
    } catch (error) {
      console.error("\u274C Error tracking heartbeat:", error);
      console.error("\u274C Error details:", error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error("\u274C Stack trace:", error.stack);
      }
      throw error;
    }
  }
  /**
   * Track VDP connect received
   */
  static async trackVDPConnect(agentEmail, callDuration) {
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from("agent_activity_log").insert({
          agent_email: agentEmail.toLowerCase(),
          activity_type: "vdp_connect",
          session_id: `vdp-${Date.now()}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          activity_data: callDuration ? { duration_minutes: Math.round(callDuration) } : null
        });
      }
      if (supabaseAdmin) {
        const weekStart = /* @__PURE__ */ new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const realEmail = await mapEmailToRealEmail(agentEmail);
        const weekStartStr = weekStart.toISOString().split("T")[0];
        if (realEmail !== agentEmail.toLowerCase().trim()) {
          await supabaseAdmin.from("weekly_usage_stats").delete().eq("agent_email", agentEmail.toLowerCase().trim()).eq("week_start_date", weekStartStr);
        }
        await supabaseAdmin.from("weekly_usage_stats").upsert({
          agent_email: realEmail,
          week_start_date: weekStartStr,
          week_end_date: weekEnd.toISOString().split("T")[0],
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, {
          onConflict: "agent_email,week_start_date"
        });
        let incrementError = null;
        try {
          const rpcResult = await supabaseAdmin.rpc("increment_vdp_stats", {
            p_agent_email: realEmail,
            p_week_start_date: weekStartStr,
            p_vdp_connects: 1,
            p_vdp_minutes: Math.round(callDuration || 0)
          });
          incrementError = rpcResult?.error || null;
        } catch (rpcError) {
          console.warn("\u26A0\uFE0F RPC increment_vdp_stats not available, using fallback:", rpcError);
          const { data: current } = await supabaseAdmin.from("weekly_usage_stats").select("vdp_connects_received, vdp_total_minutes").eq("agent_email", realEmail).eq("week_start_date", weekStartStr).maybeSingle();
          const { error: updateError, data: updateData } = await supabaseAdmin.from("weekly_usage_stats").update({
            vdp_connects_received: (current?.vdp_connects_received || 0) + 1,
            vdp_total_minutes: (current?.vdp_total_minutes || 0) + Math.round(callDuration || 0),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("agent_email", realEmail).eq("week_start_date", weekStartStr).select();
          if (updateError) {
            console.error("\u274C Fallback update failed:", updateError);
            incrementError = updateError || null;
          }
          if (!updateData || updateData.length === 0) {
            console.warn("\u26A0\uFE0F Update returned no data - record may not exist");
          } else {
            console.log(`\u2705 Fallback update succeeded: VDP connects = ${updateData[0]?.vdp_connects_received}`);
          }
          incrementError = null;
        }
        if (incrementError) {
          console.error("\u274C Error incrementing VDP stats:", incrementError);
        }
      }
      console.log(`\u2705 Tracked VDP connect for ${agentEmail} (${callDuration || 0} min)`);
    } catch (error) {
      console.error("\u274C Error tracking VDP connect:", error);
    }
  }
  /**
   * Track outbound dial made
   */
  static async trackDialMade(agentEmail, callDuration) {
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from("agent_activity_log").insert({
          agent_email: agentEmail.toLowerCase(),
          activity_type: "dial_made",
          session_id: `dial-${Date.now()}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          activity_data: callDuration ? { duration_minutes: Math.round(callDuration) } : null
        });
      }
      if (supabaseAdmin) {
        const weekStart = /* @__PURE__ */ new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const realEmail = await mapEmailToRealEmail(agentEmail);
        const weekStartStr = weekStart.toISOString().split("T")[0];
        if (realEmail !== agentEmail.toLowerCase().trim()) {
          await supabaseAdmin.from("weekly_usage_stats").delete().eq("agent_email", agentEmail.toLowerCase().trim()).eq("week_start_date", weekStartStr);
        }
        await supabaseAdmin.from("weekly_usage_stats").upsert({
          agent_email: realEmail,
          week_start_date: weekStartStr,
          week_end_date: weekEnd.toISOString().split("T")[0],
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, {
          onConflict: "agent_email,week_start_date"
        });
        let incrementError = null;
        try {
          const rpcResult = await supabaseAdmin.rpc("increment_dial_stats", {
            p_agent_email: realEmail,
            p_week_start_date: weekStartStr,
            p_dials: 1,
            p_call_minutes: Math.round(callDuration || 0)
          });
          incrementError = rpcResult?.error || null;
        } catch (rpcError) {
          console.warn("\u26A0\uFE0F RPC increment_dial_stats not available, using fallback:", rpcError);
          const { data: current } = await supabaseAdmin.from("weekly_usage_stats").select("total_dials_made, total_call_minutes").eq("agent_email", realEmail).eq("week_start_date", weekStartStr).maybeSingle();
          const { error: updateError, data: updateData } = await supabaseAdmin.from("weekly_usage_stats").update({
            total_dials_made: (current?.total_dials_made || 0) + 1,
            total_call_minutes: (current?.total_call_minutes || 0) + Math.round(callDuration || 0),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("agent_email", realEmail).eq("week_start_date", weekStartStr).select();
          if (updateError) {
            console.error("\u274C Fallback update failed:", updateError);
            incrementError = updateError || null;
          }
          if (!updateData || updateData.length === 0) {
            console.warn("\u26A0\uFE0F Update returned no data - record may not exist");
          } else {
            console.log(`\u2705 Fallback update succeeded: Dials = ${updateData[0]?.total_dials_made}`);
          }
          incrementError = null;
        }
        if (incrementError) {
          console.error("\u274C Error incrementing dial stats:", incrementError);
        }
      }
      console.log(`\u2705 Tracked dial for ${agentEmail} (${callDuration || 0} min)`);
    } catch (error) {
      console.error("\u274C Error tracking dial:", error);
    }
  }
  /**
   * Track appointment scheduled
   */
  static async trackAppointment(agentEmail) {
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from("agent_activity_log").insert({
          agent_email: agentEmail.toLowerCase(),
          activity_type: "appointment_scheduled",
          session_id: `appt-${Date.now()}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (supabaseAdmin) {
        const weekStart = /* @__PURE__ */ new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const realEmail = await mapEmailToRealEmail(agentEmail);
        const weekStartStr = weekStart.toISOString().split("T")[0];
        if (realEmail !== agentEmail.toLowerCase().trim()) {
          await supabaseAdmin.from("weekly_usage_stats").delete().eq("agent_email", agentEmail.toLowerCase().trim()).eq("week_start_date", weekStartStr);
        }
        await supabaseAdmin.from("weekly_usage_stats").upsert({
          agent_email: realEmail,
          week_start_date: weekStartStr,
          week_end_date: weekEnd.toISOString().split("T")[0],
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, {
          onConflict: "agent_email,week_start_date"
        });
        let incrementError = null;
        try {
          const rpcResult = await supabaseAdmin.rpc("increment_appointment_stats", {
            p_agent_email: realEmail,
            p_week_start_date: weekStartStr
          });
          incrementError = rpcResult?.error || null;
        } catch (rpcError) {
          console.warn("\u26A0\uFE0F RPC increment_appointment_stats not available, using fallback:", rpcError);
          const { data: current } = await supabaseAdmin.from("weekly_usage_stats").select("appointments_scheduled").eq("agent_email", realEmail).eq("week_start_date", weekStartStr).maybeSingle();
          const { error: updateError, data: updateData } = await supabaseAdmin.from("weekly_usage_stats").update({
            appointments_scheduled: (current?.appointments_scheduled || 0) + 1,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("agent_email", realEmail).eq("week_start_date", weekStartStr).select();
          if (updateError) {
            console.error("\u274C Fallback update failed:", updateError);
            incrementError = updateError || null;
          }
          if (!updateData || updateData.length === 0) {
            console.warn("\u26A0\uFE0F Update returned no data - record may not exist");
          } else {
            console.log(`\u2705 Fallback update succeeded: Appointments = ${updateData[0]?.appointments_scheduled}`);
          }
          incrementError = null;
        }
        if (incrementError) {
          console.error("\u274C Error incrementing appointment stats:", incrementError);
        }
      }
      console.log(`\u2705 Tracked appointment for ${agentEmail}`);
    } catch (error) {
      console.error("\u274C Error tracking appointment:", error);
    }
  }
  /**
   * Track sale made
   */
  static async trackSale(agentEmail, alpAmount) {
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from("agent_activity_log").insert({
          agent_email: agentEmail.toLowerCase(),
          activity_type: "sale_made",
          session_id: `sale-${Date.now()}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          activity_data: { alp_amount: alpAmount }
        });
      }
      if (supabaseAdmin) {
        const weekStart = /* @__PURE__ */ new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const realEmail = await mapEmailToRealEmail(agentEmail);
        const weekStartStr = weekStart.toISOString().split("T")[0];
        await supabaseAdmin.from("weekly_usage_stats").upsert({
          agent_email: realEmail,
          week_start_date: weekStartStr,
          week_end_date: weekEnd.toISOString().split("T")[0],
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, {
          onConflict: "agent_email,week_start_date"
        });
        if (realEmail !== agentEmail.toLowerCase().trim()) {
          await supabaseAdmin.from("weekly_usage_stats").delete().eq("agent_email", agentEmail.toLowerCase().trim()).eq("week_start_date", weekStartStr);
        }
        let incrementError = null;
        try {
          const rpcResult = await supabaseAdmin.rpc("increment_sale_stats", {
            p_agent_email: realEmail,
            p_week_start_date: weekStartStr,
            p_alp_amount: alpAmount
          });
          incrementError = rpcResult?.error || null;
        } catch (rpcError) {
          console.warn("\u26A0\uFE0F RPC increment_sale_stats not available, using fallback:", rpcError);
          const { data: current } = await supabaseAdmin.from("weekly_usage_stats").select("sales_made, total_alp").eq("agent_email", realEmail).eq("week_start_date", weekStartStr).maybeSingle();
          const { error: updateError, data: updateData } = await supabaseAdmin.from("weekly_usage_stats").update({
            sales_made: (current?.sales_made || 0) + 1,
            total_alp: (current?.total_alp || 0) + alpAmount,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("agent_email", realEmail).eq("week_start_date", weekStartStr).select();
          if (updateError) {
            console.error("\u274C Fallback update failed:", updateError);
            incrementError = updateError || null;
          }
          if (!updateData || updateData.length === 0) {
            console.warn("\u26A0\uFE0F Update returned no data - record may not exist");
          } else {
            console.log(`\u2705 Fallback update succeeded: Sales = ${updateData[0]?.sales_made}, ALP = $${updateData[0]?.total_alp}`);
          }
          incrementError = null;
        }
        if (incrementError) {
          console.error("\u274C Error incrementing sale stats:", incrementError);
        }
      }
      console.log(`\u2705 Tracked sale for ${agentEmail} ($${alpAmount} ALP)`);
    } catch (error) {
      console.error("\u274C Error tracking sale:", error);
    }
  }
  /**
   * Calculate online time for current week
   * Based on heartbeat logs (heartbeat every 60 seconds when active)
   */
  static async calculateOnlineTime(agentEmail) {
    try {
      const result = await db.execute(sql4`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)) as week_start
        ),
        heartbeats AS (
          SELECT timestamp
          FROM agent_activity_log
          WHERE agent_email = ${agentEmail}
            AND activity_type IN ('heartbeat', 'login', 'page_view')
            AND timestamp >= (SELECT week_start FROM current_week)
          ORDER BY timestamp
        ),
        time_gaps AS (
          SELECT 
            timestamp,
            LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp,
            EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp)))/60 as gap_minutes
          FROM heartbeats
        )
        SELECT 
          SUM(CASE 
            WHEN gap_minutes IS NULL THEN 1
            WHEN gap_minutes <= 2 THEN gap_minutes
            ELSE 1
          END) as total_minutes
        FROM time_gaps
      `);
      const totalMinutes = result.rows[0]?.total_minutes || 0;
      await db.execute(sql4`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE as week_start
        )
        UPDATE weekly_usage_stats
        SET 
          total_online_minutes = ${Math.round(totalMinutes)},
          updated_at = NOW()
        WHERE agent_email = ${agentEmail}
          AND week_start_date = (SELECT week_start FROM current_week)
      `);
      return Math.round(totalMinutes);
    } catch (error) {
      console.error("\u274C Error calculating online time:", error);
      return 0;
    }
  }
  /**
   * Get weekly stats for an agent
   */
  static async getWeeklyStats(agentEmail) {
    try {
      const result = await db.execute(sql4`
        SELECT *
        FROM weekly_usage_stats
        WHERE agent_email = ${agentEmail}
          AND week_start_date = (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE
      `);
      return result.rows[0] || null;
    } catch (error) {
      console.error("\u274C Error getting weekly stats:", error);
      return null;
    }
  }
  /**
   * Track VDP available start (when VDP toggle turns ON)
   */
  static async trackVDPAvailableStart(agentEmail, sessionId) {
    try {
      await db.execute(sql4`
        INSERT INTO agent_activity_log (agent_email, activity_type, session_id, timestamp)
        VALUES (${agentEmail}, 'vdp_available_start', ${sessionId}, NOW())
      `);
      console.log(`\u2705 Tracked VDP available start for ${agentEmail}`);
    } catch (error) {
      console.error("\u274C Error tracking VDP available start:", error);
    }
  }
  /**
   * Track VDP available end (when VDP toggle turns OFF)
   * Calculates duration from last start event and updates weekly stats
   */
  static async trackVDPAvailableEnd(agentEmail, sessionId) {
    try {
      const startResult = await db.execute(sql4`
        SELECT id, timestamp
        FROM agent_activity_log
        WHERE agent_email = ${agentEmail}
          AND activity_type = 'vdp_available_start'
          AND session_id = ${sessionId}
          AND timestamp >= NOW() - INTERVAL '24 hours'
        ORDER BY timestamp DESC
        LIMIT 1
      `);
      const startEvent = startResult.rows[0];
      let durationMinutes = 0;
      if (startEvent) {
        const durationResult = await db.execute(sql4`
          SELECT EXTRACT(EPOCH FROM (NOW() - ${startEvent.timestamp}::timestamptz)) / 60 as duration_minutes
        `);
        durationMinutes = Math.round(durationResult.rows[0]?.duration_minutes || 0);
      }
      await db.execute(sql4`
        INSERT INTO agent_activity_log (agent_email, activity_type, session_id, timestamp, activity_data)
        VALUES (${agentEmail}, 'vdp_available_end', ${sessionId}, NOW(), ${JSON.stringify({ duration_minutes: durationMinutes })}::jsonb)
      `);
      if (durationMinutes > 0) {
        await db.execute(sql4`
          WITH current_week AS (
            SELECT 
              (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE as week_start,
              ((CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)) + INTERVAL '6 days')::DATE as week_end
          )
          INSERT INTO weekly_usage_stats (
            agent_email,
            week_start_date,
            week_end_date,
            vdp_available_minutes,
            updated_at
          )
          SELECT 
            ${agentEmail},
            week_start,
            week_end,
            ${durationMinutes},
            NOW()
          FROM current_week
          ON CONFLICT (agent_email, week_start_date) 
          DO UPDATE SET 
            vdp_available_minutes = weekly_usage_stats.vdp_available_minutes + ${durationMinutes},
            updated_at = NOW()
        `);
      }
      console.log(`\u2705 Tracked VDP available end for ${agentEmail} (${durationMinutes} min)`);
    } catch (error) {
      console.error("\u274C Error tracking VDP available end:", error);
    }
  }
  /**
   * Track Call Connector Pro call start
   */
  static async trackCCProCallStart(agentEmail, sessionId, callId) {
    try {
      await db.execute(sql4`
        INSERT INTO agent_activity_log (agent_email, activity_type, session_id, timestamp, activity_data)
        VALUES (
          ${agentEmail}, 
          'ccpro_call_start', 
          ${sessionId}, 
          NOW(),
          ${callId ? JSON.stringify({ call_id: callId }) : null}::jsonb
        )
      `);
      console.log(`\u2705 Tracked CCPro call start for ${agentEmail}${callId ? ` (callId: ${callId})` : ""}`);
    } catch (error) {
      console.error("\u274C Error tracking CCPro call start:", error);
    }
  }
  /**
   * Track Call Connector Pro call end
   * Calculates duration from last start event and updates weekly stats
   */
  static async trackCCProCallEnd(agentEmail, sessionId, callId, duration) {
    try {
      let durationMinutes = 0;
      if (duration !== void 0 && duration > 0) {
        durationMinutes = Math.round(duration / 60);
      } else {
        let query = sql4`
          SELECT id, timestamp, activity_data
          FROM agent_activity_log
          WHERE agent_email = ${agentEmail}
            AND activity_type = 'ccpro_call_start'
            AND timestamp >= NOW() - INTERVAL '24 hours'
        `;
        if (callId) {
          query = sql4`
            SELECT id, timestamp, activity_data
            FROM agent_activity_log
            WHERE agent_email = ${agentEmail}
              AND activity_type = 'ccpro_call_start'
              AND activity_data->>'call_id' = ${callId}
              AND timestamp >= NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC
            LIMIT 1
          `;
        } else {
          query = sql4`
            SELECT id, timestamp, activity_data
            FROM agent_activity_log
            WHERE agent_email = ${agentEmail}
              AND activity_type = 'ccpro_call_start'
              AND session_id = ${sessionId}
              AND timestamp >= NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC
            LIMIT 1
          `;
        }
        const startResult = await db.execute(query);
        const startEvent = startResult.rows[0];
        if (startEvent) {
          const durationResult = await db.execute(sql4`
            SELECT EXTRACT(EPOCH FROM (NOW() - ${startEvent.timestamp}::timestamptz)) / 60 as duration_minutes
          `);
          durationMinutes = Math.round(durationResult.rows[0]?.duration_minutes || 0);
        }
      }
      await db.execute(sql4`
        INSERT INTO agent_activity_log (agent_email, activity_type, session_id, timestamp, activity_data)
        VALUES (
          ${agentEmail}, 
          'ccpro_call_end', 
          ${sessionId}, 
          NOW(),
          ${JSON.stringify({
        call_id: callId || null,
        duration_minutes: durationMinutes
      })}::jsonb
        )
      `);
      if (durationMinutes > 0 && supabaseAdmin) {
        const weekStart = /* @__PURE__ */ new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        await supabaseAdmin.from("weekly_usage_stats").upsert({
          agent_email: agentEmail.toLowerCase(),
          week_start_date: weekStart.toISOString().split("T")[0],
          week_end_date: weekEnd.toISOString().split("T")[0],
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, {
          onConflict: "agent_email,week_start_date"
        });
        let incrementError = null;
        try {
          const rpcResult = await supabaseAdmin.rpc("increment_ccpro_stats", {
            p_agent_email: agentEmail.toLowerCase(),
            p_week_start_date: weekStart.toISOString().split("T")[0],
            p_ccpro_minutes: durationMinutes,
            p_dials: 1
          });
          incrementError = rpcResult?.error || null;
        } catch (rpcError) {
          console.warn("\u26A0\uFE0F RPC increment_ccpro_stats not available, using fallback:", rpcError);
          const { data: current } = await supabaseAdmin.from("weekly_usage_stats").select("ccpro_call_minutes, total_dials_made, total_call_minutes").eq("agent_email", agentEmail.toLowerCase()).eq("week_start_date", weekStart.toISOString().split("T")[0]).single();
          const { error: updateError } = await supabaseAdmin.from("weekly_usage_stats").update({
            ccpro_call_minutes: (current?.ccpro_call_minutes || 0) + durationMinutes,
            total_dials_made: (current?.total_dials_made || 0) + 1,
            total_call_minutes: (current?.total_call_minutes || 0) + durationMinutes,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("agent_email", agentEmail.toLowerCase()).eq("week_start_date", weekStart.toISOString().split("T")[0]);
          incrementError = updateError || null;
        }
        if (incrementError) {
          console.error("\u274C Error incrementing CCPro stats:", incrementError);
        }
      }
      console.log(`\u2705 Tracked CCPro call end for ${agentEmail} (${durationMinutes} min)${callId ? ` (callId: ${callId})` : ""}`);
    } catch (error) {
      console.error("\u274C Error tracking CCPro call end:", error);
    }
  }
  /**
   * Calculate VDP available time for current week from activity logs
   */
  static async calculateVDPAvailableTime(agentEmail) {
    try {
      const result = await db.execute(sql4`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)) as week_start
        ),
        vdp_events AS (
          SELECT 
            activity_type,
            timestamp,
            LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp
          FROM agent_activity_log
          WHERE agent_email = ${agentEmail}
            AND activity_type IN ('vdp_available_start', 'vdp_available_end')
            AND timestamp >= (SELECT week_start FROM current_week)
          ORDER BY timestamp
        ),
        paired_events AS (
          SELECT 
            timestamp,
            prev_timestamp,
            activity_type,
            CASE 
              WHEN activity_type = 'vdp_available_end' AND prev_timestamp IS NOT NULL THEN
                EXTRACT(EPOCH FROM (timestamp - prev_timestamp)) / 60
              ELSE 0
            END as duration_minutes
          FROM vdp_events
        )
        SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
        FROM paired_events
        WHERE duration_minutes > 0
      `);
      const totalMinutes = Math.round(result.rows[0]?.total_minutes || 0);
      await db.execute(sql4`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE as week_start
        )
        UPDATE weekly_usage_stats
        SET 
          vdp_available_minutes = ${totalMinutes},
          updated_at = NOW()
        WHERE agent_email = ${agentEmail}
          AND week_start_date = (SELECT week_start FROM current_week)
      `);
      return totalMinutes;
    } catch (error) {
      console.error("\u274C Error calculating VDP available time:", error);
      return 0;
    }
  }
  /**
   * Calculate Call Connector Pro call time for current week from activity logs
   */
  static async calculateCCProCallTime(agentEmail) {
    try {
      const result = await db.execute(sql4`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)) as week_start
        ),
        call_events AS (
          SELECT 
            activity_type,
            timestamp,
            activity_data->>'call_id' as call_id,
            LAG(timestamp) OVER (PARTITION BY activity_data->>'call_id' ORDER BY timestamp) as prev_timestamp,
            LAG(activity_type) OVER (PARTITION BY activity_data->>'call_id' ORDER BY timestamp) as prev_type
          FROM agent_activity_log
          WHERE agent_email = ${agentEmail}
            AND activity_type IN ('ccpro_call_start', 'ccpro_call_end')
            AND timestamp >= (SELECT week_start FROM current_week)
          ORDER BY timestamp
        ),
        paired_calls AS (
          SELECT 
            timestamp,
            prev_timestamp,
            activity_type,
            CASE 
              WHEN activity_type = 'ccpro_call_end' 
                   AND prev_type = 'ccpro_call_start' 
                   AND prev_timestamp IS NOT NULL THEN
                EXTRACT(EPOCH FROM (timestamp - prev_timestamp)) / 60
              ELSE 0
            END as duration_minutes
          FROM call_events
        )
        SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
        FROM paired_calls
        WHERE duration_minutes > 0
      `);
      const totalMinutes = Math.round(result.rows[0]?.total_minutes || 0);
      await db.execute(sql4`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE as week_start
        )
        UPDATE weekly_usage_stats
        SET 
          ccpro_call_minutes = ${totalMinutes},
          updated_at = NOW()
        WHERE agent_email = ${agentEmail}
          AND week_start_date = (SELECT week_start FROM current_week)
      `);
      return totalMinutes;
    } catch (error) {
      console.error("\u274C Error calculating CCPro call time:", error);
      return 0;
    }
  }
  /**
   * Get all agents' weekly stats (for admin view)
   * Calculates online time on-the-fly from heartbeat logs
   */
  static async getAllWeeklyStats() {
    try {
      console.log("\u{1F4CA} UsageTracker: Starting getAllWeeklyStats from Supabase...");
      if (!supabaseAdmin) {
        console.error("\u274C supabaseAdmin not available!");
        return [];
      }
      const weekStart = /* @__PURE__ */ new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      console.log("\u{1F4CB} Fetching ALL agents from agent_profiles...");
      const { data: allAgentProfiles, error: profilesError } = await supabaseAdmin.from("agent_profiles").select("email, firstName, lastName, mgaAssociateId, rgaAssociateId").not("email", "is", null).limit(1e4);
      const profileMap = /* @__PURE__ */ new Map();
      if (profilesError) {
        console.error("\u274C Error fetching agent_profiles:", profilesError);
        console.warn("\u26A0\uFE0F Continuing without agent_profiles - will use data from weekly_usage_stats only");
      } else {
        const allAgents = allAgentProfiles || [];
        console.log(`\u{1F4CB} Found ${allAgents.length} total agents in agent_profiles`);
        allAgents.forEach((p) => {
          if (p.email) {
            profileMap.set(String(p.email).toLowerCase().trim(), p);
          }
        });
      }
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split("T")[0];
      console.log(`\u{1F4C5} Querying weekly_usage_stats for week: ${weekStartStr} to ${weekEndStr}`);
      let weeklyStats = [];
      let statsError = null;
      const { data: exactWeekStats, error: exactError } = await supabaseAdmin.from("weekly_usage_stats").select("*").eq("week_start_date", weekStartStr);
      if (!exactError && exactWeekStats) {
        weeklyStats = exactWeekStats;
        console.log(`\u{1F4CA} Found ${weeklyStats.length} records with exact week match: ${weekStartStr}`);
      } else {
        const { data: rangeStats, error: rangeError } = await supabaseAdmin.from("weekly_usage_stats").select("*").gte("week_start_date", weekStartStr).lte("week_start_date", weekEndStr);
        if (!rangeError && rangeStats) {
          weeklyStats = rangeStats;
          console.log(`\u{1F4CA} Found ${weeklyStats.length} records with range query: ${weekStartStr} to ${weekEndStr}`);
        } else {
          statsError = rangeError || exactError;
        }
      }
      if (statsError) {
        console.error("\u274C Error fetching weekly_usage_stats from Supabase:", statsError);
        console.error("\u274C Error details:", JSON.stringify(statsError, null, 2));
      }
      const rows = weeklyStats || [];
      console.log(`\u{1F4CA} UsageTracker: Found ${rows.length} records in weekly_usage_stats for week ${weekStartStr}`);
      if (rows.length === 0) {
        console.warn(`\u26A0\uFE0F NO RECORDS FOUND for week ${weekStartStr}! Checking most recent week...`);
        const { data: recentStats } = await supabaseAdmin.from("weekly_usage_stats").select("*").order("week_start_date", { ascending: false }).limit(1e3);
        if (recentStats && recentStats.length > 0) {
          const recentWeek = recentStats[0].week_start_date;
          console.log(`\u{1F4CA} Most recent week in database: ${recentWeek} with ${recentStats.length} records`);
          console.log(`\u{1F4CA} Current week being queried: ${weekStartStr}`);
          if (recentWeek !== weekStartStr) {
            console.warn(`\u26A0\uFE0F Week mismatch! Using most recent week ${recentWeek} instead`);
            rows.push(...recentStats.filter((r) => r.week_start_date === recentWeek));
            console.log(`\u{1F4CA} Now have ${rows.length} rows from week ${recentWeek}`);
          }
        }
      }
      if (rows.length > 0) {
        console.log(`\u{1F4CA} First 10 agent emails from database:`, rows.slice(0, 10).map((r) => r.agent_email));
        console.log("\u{1F4CA} Sample weekly_usage_stats records:");
        rows.slice(0, 5).forEach((row) => {
          console.log(`  - ${row.agent_email}: vdp_total=${row.vdp_total_minutes}, vdp_available=${row.vdp_available_minutes}, logins=${row.total_logins}`);
        });
      } else {
        console.error("\u274C CRITICAL: Still no rows after fallback!");
      }
      const { data: heartbeats, error: heartbeatError } = await supabaseAdmin.from("agent_activity_log").select("agent_email, timestamp").eq("activity_type", "heartbeat").gte("timestamp", weekStart.toISOString());
      const onlineTimeByAgent = {};
      if (!heartbeatError && heartbeats && heartbeats.length > 0) {
        const heartbeatsByAgent = {};
        heartbeats.forEach((hb) => {
          const email = hb.agent_email.toLowerCase();
          if (!heartbeatsByAgent[email]) {
            heartbeatsByAgent[email] = [];
          }
          heartbeatsByAgent[email].push(new Date(hb.timestamp));
        });
        Object.keys(heartbeatsByAgent).forEach((email) => {
          const times = heartbeatsByAgent[email].sort((a, b) => a.getTime() - b.getTime());
          let totalMinutes = 0;
          for (let i = 1; i < times.length; i++) {
            const gapMinutes = (times[i].getTime() - times[i - 1].getTime()) / (1e3 * 60);
            if (gapMinutes <= 2) {
              totalMinutes += gapMinutes;
            } else {
              totalMinutes += 1;
            }
          }
          if (times.length > 0) totalMinutes += 1;
          onlineTimeByAgent[email] = Math.round(totalMinutes);
        });
        console.log(`\u{1F4CA} Calculated online time from ${heartbeats.length} Supabase heartbeats for ${Object.keys(onlineTimeByAgent).length} agents`);
      }
      const vdpConnectsByAgent = {};
      try {
        console.log("\u{1F4CA} Querying vdp_calls table for CONNECT events from week:", weekStart.toISOString());
        const { data: vdpCalls2, error: vdpCallsError } = await supabaseAdmin.from("vdp_calls").select("company_email, event, duration, time").eq("event", "CONNECT").gte("time", weekStart.toISOString());
        if (vdpCallsError) {
          console.error("\u274C Error querying vdp_calls table:", vdpCallsError);
          console.error("\u274C VDP query error details:", JSON.stringify(vdpCallsError, null, 2));
        } else {
          console.log(`\u{1F4CA} vdp_calls query result: ${vdpCalls2?.length || 0} CONNECT events found`);
          if (vdpCalls2 && vdpCalls2.length > 0) {
            console.log("\u{1F4CA} Sample VDP call:", JSON.stringify(vdpCalls2[0], null, 2));
            vdpCalls2.forEach((call) => {
              const email = call.company_email?.toLowerCase();
              if (!email) {
                console.warn("\u26A0\uFE0F VDP call missing company_email:", { event: call.event, time: call.time });
                return;
              }
              if (!vdpConnectsByAgent[email]) {
                vdpConnectsByAgent[email] = { count: 0, minutes: 0 };
              }
              vdpConnectsByAgent[email].count += 1;
              if (call.duration) {
                const durationMinutes = Math.round(parseFloat(String(call.duration)) / 60);
                vdpConnectsByAgent[email].minutes += durationMinutes;
              } else {
                vdpConnectsByAgent[email].minutes += 1;
              }
            });
            console.log(`\u{1F4CA} VDP connects aggregated for ${Object.keys(vdpConnectsByAgent).length} agents`);
            const topAgents = Object.entries(vdpConnectsByAgent).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
            topAgents.forEach(([email, data]) => {
              console.log(`  \u{1F4CA} ${email}: ${data.count} connects, ${data.minutes} minutes`);
            });
          } else {
            console.warn("\u26A0\uFE0F No VDP CONNECT events found in vdp_calls table for this week");
          }
        }
      } catch (vdpError) {
        console.error("\u274C Exception querying vdp_calls table:", vdpError);
        console.error("\u274C Exception stack:", vdpError instanceof Error ? vdpError.stack : "No stack");
      }
      const vdpAvailableTimeByAgent = {};
      const vdpCallTimeByAgent = {};
      try {
        console.log("\u{1F4CA} Querying agent_availability_tracking for VDP available time AND call time...");
        const weekStartStr2 = weekStart.toISOString().split("T")[0];
        const weekEndStr2 = weekEnd.toISOString().split("T")[0];
        console.log(`\u{1F4CA} Querying agent_availability_tracking from ${weekStartStr2} to ${weekEndStr2} for VDP time`);
        const { data: availabilityData, error: availabilityError } = await supabaseAdmin.from("agent_availability_tracking").select("agent_email, agent_id, total_available_time, total_calling_time, tracking_date, current_status").gte("tracking_date", weekStartStr2).lte("tracking_date", weekEndStr2);
        if (availabilityError) {
          console.error("\u274C Error querying agent_availability_tracking:", availabilityError);
          console.error("\u274C Availability query error details:", JSON.stringify(availabilityError, null, 2));
        } else if (availabilityData && availabilityData.length > 0) {
          console.log(`\u{1F4CA} Found ${availabilityData.length} availability records from agent_availability_tracking`);
          console.log("\u{1F4CA} Sample availability record:", JSON.stringify(availabilityData[0], null, 2));
          availabilityData.forEach((record) => {
            const email = record.agent_email?.toLowerCase();
            if (!email) {
              console.warn("\u26A0\uFE0F Availability record missing agent_email:", { agent_id: record.agent_id, tracking_date: record.tracking_date });
              return;
            }
            if (!vdpAvailableTimeByAgent[email]) {
              vdpAvailableTimeByAgent[email] = 0;
            }
            const availableMinutes = Math.round((record.total_available_time || 0) / 60);
            vdpAvailableTimeByAgent[email] += availableMinutes;
            if (!vdpCallTimeByAgent[email]) {
              vdpCallTimeByAgent[email] = 0;
            }
            const callMinutes = Math.round((record.total_calling_time || 0) / 60);
            vdpCallTimeByAgent[email] += callMinutes;
          });
          console.log(`\u{1F4CA} VDP available time aggregated for ${Object.keys(vdpAvailableTimeByAgent).length} agents (waiting for calls)`);
          console.log(`\u{1F4CA} VDP call time aggregated for ${Object.keys(vdpCallTimeByAgent).length} agents (actively on calls)`);
          const topAvailableAgents = Object.entries(vdpAvailableTimeByAgent).sort((a, b) => b[1] - a[1]).slice(0, 5);
          topAvailableAgents.forEach(([email, minutes]) => {
            const callMinutes = vdpCallTimeByAgent[email] || 0;
            console.log(`  \u{1F4CA} ${email}: ${minutes} min available (waiting), ${callMinutes} min on calls`);
          });
        } else {
          console.warn("\u26A0\uFE0F No availability data found in agent_availability_tracking for this week");
        }
        try {
          const { taalkVDPPoller: taalkVDPPoller2 } = await Promise.resolve().then(() => (init_taalk_vdp_poller(), taalk_vdp_poller_exports));
          const vdpAgents = taalkVDPPoller2.getAgents();
          console.log(`\u{1F4CA} Taalk VDP poller has ${vdpAgents.length} agents tracked`);
          const currentlyOnline = [];
          const currentlyCalling = [];
          vdpAgents.forEach((agent) => {
            const email = agent.email.toLowerCase();
            if (agent.status === "online") {
              currentlyOnline.push(email);
              if (agent.onlineStartTime) {
                const currentMinutes = Math.round(((/* @__PURE__ */ new Date()).getTime() - agent.onlineStartTime.getTime()) / (1e3 * 60));
                if (!vdpAvailableTimeByAgent[email]) {
                  vdpAvailableTimeByAgent[email] = 0;
                }
                vdpAvailableTimeByAgent[email] += currentMinutes;
                console.log(`\u{1F4CA} ${email} currently ONLINE (waiting), adding ${currentMinutes} minutes from current session`);
              } else {
                console.warn(`\u26A0\uFE0F ${email} is online but has no onlineStartTime`);
              }
            } else if (agent.status === "calling") {
              currentlyCalling.push(email);
              if (agent.currentCall?.startTime) {
                const currentMinutes = Math.round(((/* @__PURE__ */ new Date()).getTime() - agent.currentCall.startTime.getTime()) / (1e3 * 60));
                if (!vdpCallTimeByAgent[email]) {
                  vdpCallTimeByAgent[email] = 0;
                }
                vdpCallTimeByAgent[email] += currentMinutes;
                console.log(`\u{1F4CA} ${email} currently ON CALL, adding ${currentMinutes} minutes from current call`);
              }
            }
          });
          if (currentlyOnline.length > 0) {
            console.log(`\u{1F4CA} Currently ONLINE (waiting) agents: ${currentlyOnline.join(", ")}`);
          }
          if (currentlyCalling.length > 0) {
            console.log(`\u{1F4CA} Currently ON CALL agents: ${currentlyCalling.join(", ")}`);
          }
          if (currentlyOnline.length === 0 && currentlyCalling.length === 0) {
            console.log("\u{1F4CA} No agents currently online or on calls according to Taalk VDP poller");
          }
        } catch (pollerError) {
          console.error("\u274C Could not get current VDP status from poller:", pollerError);
          console.error("\u274C Poller error stack:", pollerError instanceof Error ? pollerError.stack : "No stack");
        }
      } catch (vdpError) {
        console.error("\u274C Exception getting VDP available time:", vdpError);
      }
      const isAssociateIdEmail = (email) => {
        const emailStr = String(email).toLowerCase().trim();
        const beforeAt = emailStr.split("@")[0];
        return /^\d+$/.test(beforeAt);
      };
      const lookupEmailFromAssociateId = async (associateIdEmail) => {
        const beforeAt = associateIdEmail.split("@")[0];
        const associateId = parseInt(beforeAt);
        if (isNaN(associateId)) {
          return { email: null, name: null };
        }
        try {
          const { data: customer } = await supabaseAdmin.from("customers").select("company_email, personal_email, first_name, last_name").eq("associate_id", associateId).maybeSingle();
          if (customer?.company_email) {
            return {
              email: customer.company_email.toLowerCase().trim(),
              name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || null
            };
          }
          if (customer?.personal_email) {
            return {
              email: customer.personal_email.toLowerCase().trim(),
              name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || null
            };
          }
          const { data: producer } = await supabaseAdmin.from("producerlist").select("company_email, first_name, last_name").eq("associate_id", associateId).maybeSingle();
          if (producer?.company_email) {
            return {
              email: producer.company_email.toLowerCase().trim(),
              name: `${producer.first_name || ""} ${producer.last_name || ""}`.trim() || null
            };
          }
        } catch (error) {
          console.error(`\u274C Error looking up associate_id ${associateId}:`, error);
        }
        return { email: null, name: null };
      };
      const emailLookupMap = /* @__PURE__ */ new Map();
      const associateIdEmails = rows.map((r) => r.agent_email).filter((email) => email && isAssociateIdEmail(email));
      if (associateIdEmails.length > 0) {
        console.log(`\u{1F4CA} Found ${associateIdEmails.length} associate ID emails, looking up real emails...`);
        for (const associateIdEmail of associateIdEmails) {
          const lookup = await lookupEmailFromAssociateId(associateIdEmail);
          if (lookup.email) {
            emailLookupMap.set(associateIdEmail.toLowerCase().trim(), lookup);
            console.log(`\u{1F4CA} Mapped ${associateIdEmail} -> ${lookup.email}${lookup.name ? ` (${lookup.name})` : ""}`);
          } else {
            console.warn(`\u26A0\uFE0F Could not find real email for associate ID: ${associateIdEmail}`);
          }
        }
      }
      const weeklyStatsMap = /* @__PURE__ */ new Map();
      rows.forEach((row) => {
        if (row.agent_email) {
          let email = String(row.agent_email).toLowerCase().trim();
          const originalEmail = email;
          if (isAssociateIdEmail(email)) {
            const lookup = emailLookupMap.get(email);
            if (lookup?.email) {
              email = lookup.email;
              if (lookup.name && !row.agent_name) {
                row.agent_name = lookup.name;
              }
              console.log(`\u{1F4CA} Resolved ${originalEmail} -> ${email}${lookup.name ? ` (${lookup.name})` : ""}`);
            }
          }
          weeklyStatsMap.set(email, row);
          if (row.vdp_total_minutes && row.vdp_total_minutes > 0 || row.vdp_available_minutes && row.vdp_available_minutes > 0) {
            console.log(`\u{1F4CA} Mapped ${email}: vdp_total=${row.vdp_total_minutes}, vdp_available=${row.vdp_available_minutes}, vdp_call=${row.vdp_call_minutes}`);
          }
        }
      });
      console.log(`\u{1F4CA} Built weeklyStatsMap with ${weeklyStatsMap.size} agents from database`);
      const agentsWithVdpData = Array.from(weeklyStatsMap.entries()).filter(
        ([_, row]) => row.vdp_total_minutes && row.vdp_total_minutes > 0 || row.vdp_available_minutes && row.vdp_available_minutes > 0
      );
      console.log(`\u{1F4CA} Agents with VDP data in map: ${agentsWithVdpData.length}`);
      if (agentsWithVdpData.length > 0) {
        console.log(`\u{1F4CA} Sample agents with VDP data:`, agentsWithVdpData.slice(0, 5).map(([email, row]) => `${email} (vdp_total=${row.vdp_total_minutes})`));
      }
      const allAgentEmails = /* @__PURE__ */ new Set();
      if (rows.length > 0) {
        rows.forEach((row) => {
          if (row.agent_email) {
            let email = String(row.agent_email).toLowerCase().trim();
            if (isAssociateIdEmail(email)) {
              const lookup = emailLookupMap.get(email);
              if (lookup?.email) {
                email = lookup.email;
              }
            }
            allAgentEmails.add(email);
          }
        });
        console.log(`\u{1F4CA} Added ${rows.length} agents from weekly_usage_stats (with email resolution)`);
      } else {
        console.warn("\u26A0\uFE0F No rows from weekly_usage_stats - will only show agents from agent_profiles");
      }
      if (!profilesError && allAgentProfiles && allAgentProfiles.length > 0) {
        allAgentProfiles.forEach((agent) => {
          if (agent.email) {
            allAgentEmails.add(String(agent.email).toLowerCase().trim());
          }
        });
        console.log(`\u{1F4CA} Total unique agents after adding agent_profiles: ${allAgentEmails.size}`);
      } else {
        if (profilesError) {
          console.warn("\u26A0\uFE0F agent_profiles query failed, but continuing with weekly_usage_stats data");
        } else {
          console.warn("\u26A0\uFE0F No agents from agent_profiles, but continuing with weekly_usage_stats data");
        }
      }
      Object.keys(vdpAvailableTimeByAgent).forEach((email) => {
        allAgentEmails.add(String(email).toLowerCase().trim());
      });
      Object.keys(vdpCallTimeByAgent).forEach((email) => {
        allAgentEmails.add(String(email).toLowerCase().trim());
      });
      Object.keys(vdpConnectsByAgent).forEach((email) => {
        allAgentEmails.add(String(email).toLowerCase().trim());
      });
      console.log(`\u{1F4CA} Final total unique agents: ${allAgentEmails.size}`);
      console.log(`\u{1F4CA} First 20 agent emails in final set:`, Array.from(allAgentEmails).slice(0, 20));
      if (allAgentEmails.size === 0 && rows.length > 0) {
        console.warn("\u26A0\uFE0F allAgentEmails is empty but we have rows - adding all rows to agent emails set");
        rows.forEach((row) => {
          if (row.agent_email) {
            allAgentEmails.add(String(row.agent_email).toLowerCase().trim());
          }
        });
        console.log(`\u{1F4CA} After adding rows, allAgentEmails size: ${allAgentEmails.size}`);
      }
      const resolveRowEmail = (row) => {
        let displayEmail = row.agent_email;
        let displayName = row.agent_name;
        if (isAssociateIdEmail(row.agent_email)) {
          const lookup = emailLookupMap.get(String(row.agent_email).toLowerCase().trim());
          if (lookup?.email) {
            displayEmail = lookup.email;
            if (lookup.name) {
              displayName = lookup.name;
            }
          }
        }
        return { displayEmail, displayName };
      };
      if (rows.length > 0 && allAgentEmails.size === 0) {
        console.error("\u274C CRITICAL: Have rows but allAgentEmails is still empty - returning rows directly!");
        return rows.map((row) => {
          const { displayEmail, displayName } = resolveRowEmail(row);
          return {
            agent_email: displayEmail,
            agent_name: displayName || displayEmail,
            week_start_date: row.week_start_date,
            week_end_date: row.week_end_date,
            total_logins: Number(row.total_logins) || 0,
            unique_login_days: Number(row.unique_login_days) || 0,
            total_online_minutes: Number(row.total_online_minutes) || 0,
            vdp_connects_received: Number(row.vdp_connects_received) || 0,
            vdp_available_minutes: Number(row.vdp_available_minutes) || 0,
            vdp_call_minutes: Number(row.vdp_call_minutes) || 0,
            vdp_total_minutes: Number(row.vdp_total_minutes) || 0,
            total_dials_made: Number(row.total_dials_made) || 0,
            total_call_minutes: (Number(row.total_call_minutes) || 0) + (Number(row.ccpro_call_minutes) || 0),
            appointments_scheduled: Number(row.appointments_scheduled) || 0,
            sales_made: Number(row.sales_made) || 0,
            total_alp: Number(row.total_alp || 0),
            last_activity_at: row.last_activity_at || null,
            firstName: null,
            lastName: null,
            mgaAssociateId: null,
            rgaAssociateId: null
          };
        });
      }
      if (rows.length > 0 && allAgentEmails.size === 0) {
        console.log("\u{1F4CA} SIMPLIFIED: Returning rows directly from database (no mapping needed)");
        return rows.map((row) => {
          const { displayEmail, displayName } = resolveRowEmail(row);
          return {
            agent_email: displayEmail,
            agent_name: displayName || displayEmail,
            week_start_date: row.week_start_date,
            week_end_date: row.week_end_date,
            total_logins: Number(row.total_logins) || 0,
            unique_login_days: Number(row.unique_login_days) || 0,
            total_online_minutes: Number(row.total_online_minutes) || 0,
            vdp_connects_received: Number(row.vdp_connects_received) || 0,
            vdp_available_minutes: Number(row.vdp_available_minutes) || 0,
            vdp_call_minutes: Number(row.vdp_call_minutes) || 0,
            vdp_total_minutes: Number(row.vdp_total_minutes) || 0,
            total_dials_made: Number(row.total_dials_made) || 0,
            total_call_minutes: (Number(row.total_call_minutes) || 0) + (Number(row.ccpro_call_minutes) || 0),
            appointments_scheduled: Number(row.appointments_scheduled) || 0,
            sales_made: Number(row.sales_made) || 0,
            total_alp: Number(row.total_alp || 0),
            last_activity_at: row.last_activity_at || null,
            firstName: null,
            lastName: null,
            mgaAssociateId: null,
            rgaAssociateId: null
          };
        });
      }
      const result = Array.from(allAgentEmails).map((email) => {
        const normalizedEmail = String(email).toLowerCase().trim();
        const weeklyStat = weeklyStatsMap.get(normalizedEmail);
        const profile = profileMap.get(normalizedEmail);
        if (!weeklyStat && rows.some((r) => String(r.agent_email || "").toLowerCase().trim() === normalizedEmail)) {
          console.warn(`\u26A0\uFE0F Agent ${normalizedEmail} found in rows but not in map!`);
          const matchingRow = rows.find((r) => String(r.agent_email || "").toLowerCase().trim() === normalizedEmail);
          if (matchingRow) {
            console.warn(`\u26A0\uFE0F Found matching row:`, {
              original_email: matchingRow.agent_email,
              normalized: String(matchingRow.agent_email || "").toLowerCase().trim(),
              vdp_total: matchingRow.vdp_total_minutes
            });
          }
        }
        const getValue = (dbValue, calculatedValue) => {
          if (dbValue !== null && dbValue !== void 0) {
            const numValue = Number(dbValue);
            return isNaN(numValue) ? 0 : numValue;
          }
          return calculatedValue ?? 0;
        };
        const vdpAvailable = weeklyStat?.vdp_available_minutes != null ? Number(weeklyStat.vdp_available_minutes) || 0 : vdpAvailableTimeByAgent[email] || 0;
        const vdpCall = weeklyStat?.vdp_call_minutes != null ? Number(weeklyStat.vdp_call_minutes) || 0 : vdpCallTimeByAgent[email] || 0;
        const vdpTotal = weeklyStat?.vdp_total_minutes != null ? Number(weeklyStat.vdp_total_minutes) || 0 : vdpAvailable + vdpCall;
        if (weeklyStat && (weeklyStat.vdp_total_minutes > 0 || weeklyStat.vdp_available_minutes > 0 || weeklyStat.vdp_call_minutes > 0)) {
          console.log(`\u{1F4CA} VDP TIME MAPPING ${email}:`, {
            from_db: {
              vdp_total: weeklyStat.vdp_total_minutes,
              vdp_available: weeklyStat.vdp_available_minutes,
              vdp_call: weeklyStat.vdp_call_minutes
            },
            result: {
              vdp_total: vdpTotal,
              vdp_available: vdpAvailable,
              vdp_call: vdpCall
            },
            weeklyStat_exists: !!weeklyStat,
            email_in_map: weeklyStatsMap.has(email)
          });
        }
        let displayEmail = email;
        let displayName = weeklyStat?.agent_name;
        if (isAssociateIdEmail(email)) {
          const lookup = emailLookupMap.get(email);
          if (lookup?.email) {
            displayEmail = lookup.email;
            if (lookup.name) {
              displayName = lookup.name;
            }
          }
        }
        return {
          agent_email: displayEmail,
          agent_name: displayName || (profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : displayEmail),
          week_start_date: weeklyStat?.week_start_date || weekStartStr,
          week_end_date: weeklyStat?.week_end_date || weekEndStr,
          total_logins: getValue(weeklyStat?.total_logins, 0),
          unique_login_days: getValue(weeklyStat?.unique_login_days, 0),
          // Use database online time first, only calculate from heartbeats if database value is missing
          total_online_minutes: getValue(weeklyStat?.total_online_minutes, onlineTimeByAgent[email]),
          // Use database VDP connects first, supplement with calculated if missing
          vdp_connects_received: getValue(weeklyStat?.vdp_connects_received, vdpConnectsByAgent[email]?.count),
          vdp_available_minutes: vdpAvailable,
          // Time waiting for calls (available/online)
          vdp_call_minutes: vdpCall,
          // Time actively on calls
          vdp_total_minutes: vdpTotal,
          // Total VDP time (available + on calls)
          total_dials_made: getValue(weeklyStat?.total_dials_made, 0),
          total_call_minutes: getValue(weeklyStat?.total_call_minutes, 0) + getValue(weeklyStat?.ccpro_call_minutes, 0),
          appointments_scheduled: getValue(weeklyStat?.appointments_scheduled, 0),
          sales_made: getValue(weeklyStat?.sales_made, 0),
          total_alp: getValue(weeklyStat?.total_alp, 0),
          last_activity_at: weeklyStat?.last_activity_at || null,
          firstName: profile?.firstName || null,
          lastName: profile?.lastName || null,
          mgaAssociateId: profile?.mgaAssociateId || null,
          rgaAssociateId: profile?.rgaAssociateId || null
        };
      });
      console.log(`\u{1F4CA} UsageTracker: Returning ${result.length} total agents in result`);
      if (result.length === 0) {
        console.error("\u274C CRITICAL: Result array is EMPTY! This should not happen.");
        console.error("\u274C Debug info:");
        console.error(`  - Rows from weekly_usage_stats: ${rows.length}`);
        console.error(`  - All agent emails set size: ${allAgentEmails.size}`);
        console.error(`  - Weekly stats map size: ${weeklyStatsMap.size}`);
        console.error(`  - Profile map size: ${profileMap.size}`);
        console.error(`  - Week being queried: ${weekStartStr} to ${weekEndStr}`);
        if (rows.length > 0) {
          console.error("\u274C We have rows but result is empty - mapping logic is broken! Returning rows directly.");
          const directResult = rows.map((row) => {
            const { displayEmail, displayName } = resolveRowEmail(row);
            return {
              agent_email: displayEmail,
              agent_name: displayName || displayEmail,
              week_start_date: row.week_start_date,
              week_end_date: row.week_end_date,
              total_logins: Number(row.total_logins) || 0,
              unique_login_days: Number(row.unique_login_days) || 0,
              total_online_minutes: Number(row.total_online_minutes) || 0,
              vdp_connects_received: Number(row.vdp_connects_received) || 0,
              vdp_available_minutes: Number(row.vdp_available_minutes) || 0,
              vdp_call_minutes: Number(row.vdp_call_minutes) || 0,
              vdp_total_minutes: Number(row.vdp_total_minutes) || 0,
              total_dials_made: Number(row.total_dials_made) || 0,
              total_call_minutes: (Number(row.total_call_minutes) || 0) + (Number(row.ccpro_call_minutes) || 0),
              appointments_scheduled: Number(row.appointments_scheduled) || 0,
              sales_made: Number(row.sales_made) || 0,
              total_alp: Number(row.total_alp) || 0,
              last_activity_at: row.last_activity_at || null,
              firstName: null,
              lastName: null,
              mgaAssociateId: null,
              rgaAssociateId: null
            };
          });
          console.log(`\u2705 Returning ${directResult.length} agents directly from database rows`);
          return directResult;
        }
        console.error("\u274C No data available at all - returning empty array");
        return [];
      } else {
        console.log("\u{1F4CA} UsageTracker: Sample rows (first 5):");
        result.slice(0, 5).forEach((row, idx) => {
          console.log(`  ${idx + 1}. ${row.agent_email}: logins=${row.total_logins}, vdp_total=${row.vdp_total_minutes}, vdp_available=${row.vdp_available_minutes}`);
        });
        const agentsWithData = result.filter(
          (r) => r.total_logins > 0 || r.vdp_total_minutes > 0 || r.total_dials_made > 0 || r.appointments_scheduled > 0
        );
        console.log(`\u{1F4CA} Agents with actual data: ${agentsWithData.length} out of ${result.length}`);
      }
      return result;
    } catch (error) {
      console.error("\u274C Error getting all weekly stats:", error);
      console.error("\u274C Error details:", error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error("\u274C Stack trace:", error.stack);
      }
      try {
        console.log("\u{1F4CA} UsageTracker: Attempting fallback simple query...");
        const fallback = await db.execute(sql4`SELECT * FROM weekly_usage_stats LIMIT 10`);
        console.log("\u{1F4CA} UsageTracker: Fallback query result:", {
          hasResult: !!fallback,
          type: typeof fallback,
          isArray: Array.isArray(fallback),
          keys: fallback ? Object.keys(fallback) : []
        });
        if (Array.isArray(fallback)) {
          return fallback;
        } else if (fallback?.rows) {
          return fallback.rows;
        }
      } catch (fallbackError) {
        console.error("\u274C Fallback query also failed:", fallbackError);
      }
      return [];
    }
  }
};
var usageTracker = UsageTracker;

// server/auth-service.ts
var loginSchema = z2.object({
  email: z2.string().email().transform((email) => email.toLowerCase().trim()),
  // Do not enforce minimum length at API validation; let Supabase validate credentials.
  password: z2.string().min(1)
});
var signupSchema = z2.object({
  email: z2.string().email().transform((email) => email.toLowerCase().trim()),
  password: z2.string().min(6),
  firstName: z2.string().min(1),
  lastName: z2.string().min(1),
  phone: z2.string().optional().default("+1-555-0000"),
  zoomId: z2.string().optional(),
  zoomPassword: z2.string().optional().default("1"),
  primaryMarket: z2.string().optional(),
  secondaryMarket: z2.string().optional(),
  /** Connect / Recruit / PreCheck — sections the agent is applying for at signup */
  aoiModules: z2.array(z2.string()).optional(),
  states: z2.union([z2.array(z2.string()), z2.string()]).optional(),
  // Licensed states
  market: z2.union([z2.string(), z2.array(z2.string())]).optional(),
  // Market(s) - can be string or array
  aoiRecruitOptIn: z2.boolean().optional()
});
function customerFlagsFromAoiModules(modules) {
  const m = modules ?? [];
  return {
    AOICONNECT: m.includes("connect") ? "ACTIVE" : "INACTIVE",
    RECRUITACTIVE: m.includes("recruit") ? "ACTIVE" : "INACTIVE",
    PLUSACTIVE: m.includes("precheck") ? "ACTIVE" : "INACTIVE"
  };
}
function normalizeMarketArray(value, fallback) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const merged = raw.length ? raw : fallback ? [fallback] : [];
  return [...new Set(merged.map((m) => String(m).trim()).filter(Boolean))];
}
function normalizeStateArray(value) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(
    raw.map((s) => String(s).trim().toUpperCase().replace(/^"+|"+$/g, "")).filter((s) => /^[A-Z]{2}$/.test(s))
  )];
}
function deriveSupabasePasswordFromAssociateId(associateId) {
  const raw = String(associateId || "").trim();
  if (!raw) return raw;
  if (raw.length >= 6) return raw;
  return raw.padEnd(6, "0");
}
function deriveLegacyAssociatePassword(associateId) {
  const raw = String(associateId || "").trim();
  if (!raw) return raw;
  if (raw.length >= 6) return raw;
  const repeated = raw.repeat(Math.ceil(6 / raw.length));
  return repeated.slice(0, 6);
}
function getAssociatePasswordCandidates(associateId) {
  const raw = String(associateId || "").trim();
  const candidates = [
    raw,
    deriveSupabasePasswordFromAssociateId(raw),
    deriveLegacyAssociatePassword(raw)
  ].filter(Boolean);
  return [...new Set(candidates)];
}
function withTimeout(promise, timeoutMs, timeoutValue) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(timeoutValue), timeoutMs))
  ]);
}
async function lookupAssociateIdByEmail(email) {
  if (!supabaseAdmin || !email?.includes("@")) return null;
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const LOOKUP_TIMEOUT_MS = 1200;
    const byEqResult = await withTimeout(
      supabaseAdmin.from("customers").select("associate_id").or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`).maybeSingle(),
      LOOKUP_TIMEOUT_MS,
      { data: null, error: { message: "lookup_timeout_eq" } }
    );
    const byEq = byEqResult?.data;
    if (byEq?.associate_id != null) return String(byEq.associate_id).trim();
    const byIlikeResult = await withTimeout(
      supabaseAdmin.from("customers").select("associate_id").or(`company_email.ilike.${normalizedEmail},personal_email.ilike.${normalizedEmail}`).maybeSingle(),
      LOOKUP_TIMEOUT_MS,
      { data: null, error: { message: "lookup_timeout_ilike" } }
    );
    const byIlike = byIlikeResult?.data;
    if (byIlike?.associate_id != null) return String(byIlike.associate_id).trim();
    const producerResult = await withTimeout(
      supabaseAdmin.from("producerlist").select("associate_id").ilike("company_email", normalizedEmail).maybeSingle(),
      LOOKUP_TIMEOUT_MS,
      { data: null, error: { message: "lookup_timeout_producerlist" } }
    );
    const producer = producerResult?.data;
    if (producer?.associate_id != null) return String(producer.associate_id).trim();
  } catch (e) {
    console.warn("\u26A0\uFE0F lookupAssociateIdByEmail failed:", e);
  }
  return null;
}
async function findAuthUserIdByEmail(email) {
  if (!supabaseAdmin) return null;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  const perPage = 200;
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users2 = data?.users || [];
    const match = users2.find((u) => String(u?.email || "").trim().toLowerCase() === normalizedEmail);
    if (match?.id) return String(match.id);
    if (users2.length < perPage) break;
    page += 1;
  }
  return null;
}
var smsResetCodes = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of smsResetCodes.entries()) {
    if (value.expires < now) {
      smsResetCodes.delete(key);
    }
  }
}, 5 * 60 * 1e3);
var AuthService = class {
  // Login endpoint - SUPABASE AUTHENTICATION
  static async login(req, res) {
    try {
      const LOGIN_AUTH_TIMEOUT_MS = 1e4;
      const credentials = loginSchema.parse(req.body);
      let passwordForAuth = credentials.password;
      let associatePasswordCandidates = [];
      if (/^\d+$/.test(credentials.password)) {
        const associateId = await lookupAssociateIdByEmail(credentials.email);
        if (associateId && credentials.password === associateId) {
          associatePasswordCandidates = getAssociatePasswordCandidates(associateId);
          passwordForAuth = associatePasswordCandidates[0] || credentials.password;
          if (passwordForAuth !== credentials.password) {
            console.log(`\u{1F510} Login password normalized from associate_id for ${credentials.email}`);
          }
        }
      }
      console.log(`\u{1F510} Supabase login attempt for: ${credentials.email}`);
      console.log(`\u{1F527} Supabase client available: ${!!supabase}`);
      console.log(`\u{1F527} Using credentials - Email: ${credentials.email}, Password length: ${credentials.password.length}`);
      if (!supabase) {
        console.log("\u274C Supabase client is null - configuration error");
        return res.status(500).json({
          error: "Authentication service not available - Supabase not configured"
        });
      }
      console.log("\u{1F504} Calling supabase.auth.signInWithPassword...");
      const passwordsToTry = associatePasswordCandidates.length > 0 ? associatePasswordCandidates : [passwordForAuth];
      let data = null;
      let error = null;
      for (const candidatePassword of passwordsToTry) {
        const attempt = await withTimeout(
          supabase.auth.signInWithPassword({
            email: credentials.email,
            password: candidatePassword
          }),
          LOGIN_AUTH_TIMEOUT_MS,
          {
            data: { user: null, session: null },
            error: {
              message: `Login timed out after ${LOGIN_AUTH_TIMEOUT_MS}ms`,
              status: 503,
              code: "auth_timeout"
            }
          }
        );
        data = attempt.data;
        error = attempt.error;
        if (!error && data?.user) {
          break;
        }
      }
      console.log(`\u{1F504} Supabase response - Error: ${error?.message || "none"}, User: ${data?.user?.email || "none"}`);
      if (error) {
        console.log(`\u274C Supabase auth error for ${credentials.email}:`, error.message);
        console.log(`\u274C Full error details:`, JSON.stringify(error, null, 2));
        let errorMessage = "Invalid email or password";
        if (error.message?.includes("Invalid login credentials")) {
          errorMessage = "Invalid email or password. Please check your credentials.";
        } else if (error.message?.includes("Email not confirmed")) {
          errorMessage = "Email not confirmed. Please verify your email first.";
        } else if (error.message?.includes("User not found")) {
          errorMessage = "User not found. Please contact support if you believe this is an error.";
        }
        return res.status(401).json({
          error: errorMessage,
          details: error.message,
          code: error.status || error.code
        });
      }
      if (!data.user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      console.log(`\u2705 Supabase login successful for ${credentials.email}`);
      const allowedTestEmails = ["test@aoprecheck.com", "chrislafond@aoglobelife.com", "cnsysop@aoglobelife.com"];
      const isTrustedDomain = data.user.email?.endsWith("@aoglobelife.com") || allowedTestEmails.includes(data.user.email || "");
      if (!data.user.email_confirmed_at && !isTrustedDomain) {
        console.log(`\u26A0\uFE0F Email not verified for ${credentials.email}`);
        return res.status(403).json({
          error: "Email not verified. Please check your email for the verification code and verify your account before logging in.",
          requiresVerification: true
        });
      }
      if (!data.user.email_confirmed_at && isTrustedDomain) {
        console.log(`\u2705 Auto-verifying manually created user: ${credentials.email}`);
      }
      if (!data.user.email?.endsWith("@aoglobelife.com") && !allowedTestEmails.includes(data.user.email || "")) {
        console.log(`\u274C Access denied for email: ${data.user.email}`);
        return res.status(403).json({
          error: "Access denied. Only @aoglobelife.com accounts are allowed."
        });
      }
      let agentProfile;
      try {
        agentProfile = await storage.getAgentProfileByEmail(data.user.email || "");
      } catch (dbError) {
        console.warn("\u26A0\uFE0F Database operation failed, creating mock profile:", dbError);
        agentProfile = {
          id: 1,
          firstName: data.user.email?.split("@")[0] || "User",
          lastName: "Agent",
          phone: "+1-555-0000",
          email: data.user.email || "",
          zoomId: "",
          zoomPassword: "1",
          supabaseUserId: data.user.id,
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        };
      }
      if (!agentProfile) {
        const allowedTestEmails2 = ["test@aoprecheck.com", "chrislafond@aoglobelife.com", "cnsysop@aoglobelife.com"];
        if (data.user.email?.endsWith("@aoglobelife.com") || allowedTestEmails2.includes(data.user.email || "")) {
          const emailPrefix = data.user.email.split("@")[0];
          const nameParts = emailPrefix.split(/[._-]/);
          const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : "Agent";
          const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : "User";
          try {
            agentProfile = await storage.createAgentProfileWithSupabaseId({
              supabaseUserId: data.user.id,
              firstName,
              lastName,
              phone: "+1-555-0000",
              // Default phone, can be updated later
              email: data.user.email,
              zoomId: "",
              zoomPassword: "1"
            });
            console.log(`\u2705 Auto-created agent profile for ${data.user.email}`);
          } catch (dbError) {
            console.warn("\u26A0\uFE0F Failed to create agent profile in database, using mock profile:", dbError);
            agentProfile = {
              id: 1,
              firstName,
              lastName,
              phone: "+1-555-0000",
              email: data.user.email,
              zoomId: "",
              zoomPassword: "1",
              supabaseUserId: data.user.id,
              createdAt: /* @__PURE__ */ new Date(),
              updatedAt: /* @__PURE__ */ new Date()
            };
          }
        } else {
          console.log(`\u274C Access denied for email: ${data.user.email}`);
          return res.status(403).json({
            error: "Access denied. Only @aoglobelife.com accounts are allowed."
          });
        }
      }
      req.session.user = {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at
      };
      req.session.profile = agentProfile;
      console.log(`\u2705 Login successful for ${data.user.email}, session created`);
      const sessionId = req.session.id || `session-${Date.now()}`;
      const { getRealIP: getRealIP2 } = await Promise.resolve().then(() => (init_ip_analysis_service(), ip_analysis_service_exports));
      const ipAddress = getRealIP2(req);
      const userAgent = req.headers["user-agent"] || "unknown";
      usageTracker.trackLogin(data.user.email || "", sessionId, ipAddress).catch((err) => {
        console.error("\u26A0\uFE0F Failed to track login:", err);
      });
      try {
        const agentEmail = data.user.email || "";
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1e3).toISOString();
        const concurrentQuery = supabaseAdmin.from("agent_sessions").select("session_id, last_heartbeat_at, metadata, current_status").eq("agent_email", agentEmail.toLowerCase()).gte("last_heartbeat_at", fiveMinutesAgo).in("current_status", ["active", "idle", "on_call", "on_presentation", "browsing"]).limit(25);
        const CONCURRENT_CHECK_MS = 1500;
        const { data: existingSessions, error: sessionCheckError } = await Promise.race([
          concurrentQuery,
          new Promise(
            (resolve) => setTimeout(
              () => resolve({ data: null, error: { message: "concurrent_check_timeout" } }),
              CONCURRENT_CHECK_MS
            )
          )
        ]).then((r) => r);
        if (sessionCheckError?.message === "concurrent_check_timeout") {
          console.warn(
            `\u26A0\uFE0F Concurrent login check timed out after ${CONCURRENT_CHECK_MS}ms for ${agentEmail} \u2014 allowing login (fail-open)`
          );
        }
        if (!sessionCheckError && existingSessions && existingSessions.length > 0) {
          const differentIPSessions = existingSessions.filter((session2) => {
            const sessionIP = session2.metadata?.ip_address;
            if (!sessionIP || sessionIP === "unknown" || !ipAddress || ipAddress === "unknown") {
              return false;
            }
            return sessionIP !== ipAddress;
          });
          if (differentIPSessions.length > 0) {
            console.warn(`\u{1F6A8} CONCURRENT LOGIN BLOCKED for ${agentEmail}:`);
            console.warn(`   - New login attempt from IP: ${ipAddress}`);
            console.warn(`   - Existing active sessions from different IPs: ${differentIPSessions.length}`);
            differentIPSessions.forEach((session2) => {
              console.warn(`     * Session ${session2.session_id} from IP: ${session2.metadata?.ip_address}, Status: ${session2.current_status}`);
            });
            await supabaseAdmin.from("agent_activity_log").insert({
              agent_email: agentEmail.toLowerCase(),
              activity_type: "login_blocked",
              session_id: sessionId,
              page_path: "/login",
              feature: "authentication",
              started_at: (/* @__PURE__ */ new Date()).toISOString(),
              metadata: {
                security_event: "concurrent_login_blocked",
                attempted_ip: ipAddress,
                existing_session_count: differentIPSessions.length,
                existing_session_ids: differentIPSessions.map((s) => s.session_id),
                existing_ips: differentIPSessions.map((s) => s.metadata?.ip_address).filter(Boolean),
                action_taken: "login_rejected"
              }
            }).catch((err) => {
              console.error("\u26A0\uFE0F Failed to log blocked login event:", err);
            });
            return res.status(403).json({
              error: "Multiple logins detected",
              message: `This account is already logged in from another location (IP: ${differentIPSessions[0]?.metadata?.ip_address}). Please log out from the other session first, or wait 5 minutes for the session to expire.`,
              details: {
                existing_sessions: differentIPSessions.length,
                existing_ips: differentIPSessions.map((s) => s.metadata?.ip_address).filter(Boolean)
              }
            });
          }
        }
      } catch (concurrentCheckError) {
        console.error("\u26A0\uFE0F Error checking for concurrent logins:", concurrentCheckError);
        console.warn("\u26A0\uFE0F SECURITY WARNING: Allowing login without session check due to error. This could allow concurrent logins.");
      }
      const accessToken = data.session?.access_token;
      const emailForBg = data.user.email || "";
      const supabaseIdForBg = data.user.id;
      if (supabaseAdmin) {
        void (async () => {
          try {
            const { initializeAgentSession: initializeAgentSession2 } = await Promise.resolve().then(() => (init_agent_activity_tracker(), agent_activity_tracker_exports));
            await initializeAgentSession2(supabaseAdmin, {
              agentEmail: emailForBg,
              sessionId,
              metadata: {
                login_method: "password",
                supabase_user_id: supabaseIdForBg,
                ip_address: ipAddress,
                user_agent: userAgent,
                login_timestamp: (/* @__PURE__ */ new Date()).toISOString()
              }
            });
          } catch (activityError) {
            console.warn("\u26A0\uFE0F Failed to initialize agent session (non-critical):", activityError);
          }
          if (accessToken) {
            try {
              const decoded = jwt.decode(accessToken);
              const iat = decoded?.iat;
              const agentEmail = emailForBg.toLowerCase();
              if (typeof iat === "number" && agentEmail) {
                await supabaseAdmin.from("active_logins").upsert(
                  { user_email: agentEmail, valid_jwt_iat: iat, updated_at: (/* @__PURE__ */ new Date()).toISOString() },
                  { onConflict: "user_email" }
                );
              }
            } catch (activeLoginsErr) {
              console.warn("\u26A0\uFE0F Failed to store active login (non-critical):", activeLoginsErr);
            }
          }
        })();
      }
      if (accessToken) {
        const isProduction = process.env.NODE_ENV === "production";
        const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
        const ua = req.headers["user-agent"] || "";
        const isElectron = ua.includes("AOI-Desktop") || ua.includes("Electron");
        const sameSiteValue = isElectron || isProduction ? "none" : "lax";
        res.cookie("sb-access-token", accessToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: sameSiteValue,
          maxAge: 24 * 60 * 60 * 1e3,
          ...cookieDomain ? { domain: cookieDomain } : {}
        });
      }
      res.json({
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          created_at: data.user.created_at
        },
        profile: agentProfile,
        sessionId
        // Include sessionId for frontend heartbeat
      });
    } catch (error) {
      console.error("Login error:", error);
      console.error("Login error stack:", error instanceof Error ? error.stack : "No stack trace");
      if (error instanceof z2.ZodError) {
        return res.status(400).json({
          error: "Invalid input",
          details: error.errors
        });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }
  // Signup endpoint (admin only - creates new agent accounts)
  static async signup(req, res) {
    try {
      const userData = signupSchema.parse(req.body);
      if (!supabaseAdmin) {
        return res.status(500).json({
          error: "Admin authentication not configured"
        });
      }
      const normalizedEmail = userData.email.toLowerCase().trim();
      console.log(`\u{1F50D} Checking if email exists in customers table: ${normalizedEmail}`);
      try {
        const { data: customer2, error: customerLookupError } = await supabaseAdmin.from("customers").select("company_email, personal_email").or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`).maybeSingle();
        if (customerLookupError) {
          console.error("\u274C Error looking up customer:", customerLookupError);
        } else if (!customer2) {
          console.log(`\u274C Email ${normalizedEmail} not found in customers table - signup blocked`);
          return res.status(404).json({
            error: "Email not found",
            message: "Your email address was not found in our system. Please contact aointel@aoglobelife.com for signup assistance.",
            requiresAssistance: true,
            assistanceEmail: "aointel@aoglobelife.com"
          });
        } else {
          console.log(`\u2705 Email ${normalizedEmail} found in customers table - signup allowed`);
        }
      } catch (lookupError) {
        console.error("\u274C Error during customer lookup:", lookupError);
      }
      console.log(`\u{1F510} Creating Supabase user: ${userData.email}`);
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: false,
        // Require email verification before login
        user_metadata: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          primary_market: userData.primaryMarket ?? "",
          secondary_market: userData.secondaryMarket ?? "",
          aoi_modules: userData.aoiModules ?? []
        }
      });
      if (error) {
        console.error("\u274C Supabase error:", JSON.stringify(error, null, 2));
        return res.status(400).json({
          error: "Failed to create user account",
          details: error.message
        });
      }
      if (!data.user) {
        return res.status(400).json({ error: "Failed to create user account" });
      }
      console.log(`\u2705 User account created: ${userData.email}`);
      try {
        const { emailVerificationService: emailVerificationService2 } = await Promise.resolve().then(() => (init_email_verification_service(), email_verification_service_exports));
        const verificationResult = await emailVerificationService2.sendVerificationEmail(
          userData.email,
          userData.firstName
        );
        if (verificationResult.success) {
          console.log(`\u2705 Verification email sent to ${userData.email}`);
        } else {
          console.error(`\u274C Failed to send verification email: ${verificationResult.error}`);
        }
      } catch (emailError) {
        console.error("\u274C Error sending verification email:", emailError);
      }
      const profileData = {
        supabase_user_id: data.user.id,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone || "+1-555-0000",
        email: userData.email,
        zoom_id: userData.zoomId || "",
        zoom_password: userData.zoomPassword || "1",
        primary_market: userData.primaryMarket || "",
        secondary_market: userData.secondaryMarket || "",
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { data: profile, error: profileError } = await supabaseAdmin.from("agent_profiles").insert(profileData).select().single();
      if (profileError) {
        console.error("\u274C Failed to create agent profile:", profileError);
      }
      console.log(`\u{1F4DD} Creating customer record for ${userData.email}...`);
      const marketField = normalizeMarketArray(userData.market, userData.primaryMarket);
      const statesField = normalizeStateArray(userData.states);
      let mgaTeam = null;
      let rgaTeam = null;
      try {
        const { data: hierarchyData } = await supabaseAdmin.from("agent_hierarchy").select("mga_name, rga_name, agent_associate_id").eq("agent_email", userData.email).maybeSingle();
        if (hierarchyData) {
          mgaTeam = hierarchyData.mga_name;
          rgaTeam = hierarchyData.rga_name;
          console.log(`\u2705 Found MGA/RGA team from hierarchy for ${userData.email}: MGA=${mgaTeam}, RGA=${rgaTeam}`);
        } else {
          console.log(`\u26A0\uFE0F No agent_hierarchy entry found for ${userData.email} - MGA team will be NULL`);
        }
      } catch (error2) {
        console.error("\u274C Error looking up MGA/RGA team:", error2);
      }
      const moduleFlags = customerFlagsFromAoiModules(userData.aoiModules);
      const customerData = {
        company_email: userData.email,
        personal_email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone || "+1-555-0000",
        agent_name: `${userData.firstName} ${userData.lastName}`,
        VDPACTIVE: "INACTIVE",
        PLUSACTIVE: moduleFlags.PLUSACTIVE,
        RECRUITACTIVE: moduleFlags.RECRUITACTIVE,
        AOICONNECT: moduleFlags.AOICONNECT,
        CCPRO: false,
        primary_market: userData.primaryMarket || "",
        secondary_market: userData.secondaryMarket || "",
        market: marketField,
        // Array of markets
        states: statesField,
        // Array of licensed states
        mga_team: mgaTeam,
        // MGA team from agent_hierarchy
        rga_team: rgaTeam,
        // RGA team from agent_hierarchy
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      console.log(`\u{1F4CA} Customer data for ${userData.email}:`, {
        market: customerData.market,
        states: customerData.states,
        primary_market: customerData.primary_market,
        mga_team: customerData.mga_team,
        rga_team: customerData.rga_team
      });
      const { data: customer, error: customerError } = await supabaseAdmin.from("customers").insert(customerData).select().single();
      if (customerError) {
        console.error("\u274C Failed to create customer record:", customerError);
      } else {
        console.log(`\u2705 Customer record created for ${userData.email}`);
      }
      console.log(`\u{1F4B3} Creating initial credit record for ${userData.email}...`);
      const creditData = {
        email: userData.email,
        credits_remaining: 0,
        // Start with 0 credits
        credits_used: 0,
        last_updated: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { error: creditError } = await supabaseAdmin.from("user_credits").insert(creditData);
      if (creditError) {
        console.error("\u274C Failed to create credit record:", creditError);
      } else {
        console.log(`\u2705 Credit record created for ${userData.email}`);
      }
      res.json({
        success: true,
        message: "Agent account created successfully",
        user: {
          id: data.user.id,
          email: data.user.email
        },
        profile: profile || profileData,
        customer: customer || customerData
      });
    } catch (error) {
      console.error("Signup error:", error);
      if (error instanceof z2.ZodError) {
        return res.status(400).json({
          error: "Invalid input",
          details: error.errors
        });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  }
  // Logout endpoint
  static async logout(req, res) {
    try {
      const sessionUser = req.session.user;
      const sessionId = req.session.id || "unknown";
      if (sessionUser?.email) {
        try {
          const { updateAgentStatus: updateAgentStatus2 } = await Promise.resolve().then(() => (init_agent_activity_tracker(), agent_activity_tracker_exports));
          await updateAgentStatus2(supabaseAdmin, {
            agentEmail: sessionUser.email,
            sessionId,
            status: "away",
            metadata: {
              logout_method: "manual"
            }
          });
        } catch (activityError) {
          console.warn("\u26A0\uFE0F Failed to update agent status on logout (non-critical):", activityError);
        }
      }
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ error: "Failed to logout" });
        }
        res.clearCookie("connect.sid");
        res.json({ success: true, message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  // Get current user profile
  static async getProfile(req, res) {
    try {
      const sessionUser = req.session.user;
      const sessionProfile = req.session.profile;
      if (!sessionUser) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ") && supabase) {
          const accessToken = authHeader.substring(7);
          try {
            const { data: { user }, error } = await supabase.auth.getUser(accessToken);
            if (error || !user) {
              return res.status(401).json({ error: "Invalid or expired token" });
            }
            if (!user.email?.endsWith("@aoglobelife.com") && user.email !== "test@aoprecheck.com") {
              return res.status(403).json({
                error: "Access denied. Only @aoglobelife.com accounts are allowed."
              });
            }
            let agentProfile = await storage.getAgentProfileByEmail(user.email || "");
            if (!agentProfile) {
              if (user.email?.endsWith("@aoglobelife.com")) {
                const emailPrefix = user.email.split("@")[0];
                const nameParts = emailPrefix.split(/[._-]/);
                const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : "Agent";
                const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : "User";
                agentProfile = await storage.createAgentProfileWithSupabaseId({
                  supabaseUserId: user.id,
                  firstName,
                  lastName,
                  phone: "+1-555-0000",
                  email: user.email,
                  zoomId: "",
                  zoomPassword: "1"
                });
                console.log(`\u2705 Auto-created agent profile for ${user.email}`);
              } else {
                return res.status(403).json({
                  error: "Access denied. Only @aoglobelife.com accounts are allowed."
                });
              }
            }
            const authUser = {
              id: user.id,
              email: user.email,
              created_at: user.created_at
            };
            let profileWithAssociateId2 = { ...agentProfile };
            if (supabaseAdmin && user.email && !agentProfile.associate_id) {
              try {
                const email = user.email.toLowerCase().trim();
                const { data: customer } = await supabaseAdmin.from("customers").select("associate_id").or(`company_email.ilike.${email},personal_email.ilike.${email}`).limit(1).maybeSingle();
                if (customer?.associate_id != null) {
                  profileWithAssociateId2.associate_id = customer.associate_id;
                }
              } catch (error2) {
              }
            }
            req.session.user = authUser;
            req.session.profile = profileWithAssociateId2;
            return res.json({
              user: authUser,
              profile: profileWithAssociateId2
            });
          } catch (error) {
            console.error("Token verification error:", error);
            return res.status(401).json({ error: "Invalid token" });
          }
        }
        return res.status(401).json({ error: "No active session" });
      }
      let finalProfile = sessionProfile;
      if (!finalProfile && sessionUser?.id) {
        try {
          finalProfile = await storage.getAgentProfileByEmail(sessionUser.email || "");
          if (finalProfile) {
            req.session.profile = finalProfile;
          }
        } catch (error) {
          console.log("Could not fetch profile:", error);
        }
      }
      let profileWithAssociateId = finalProfile;
      if (finalProfile && !finalProfile.associate_id && supabaseAdmin && sessionUser?.email) {
        try {
          const email = sessionUser.email.toLowerCase().trim();
          const { data: customer } = await supabaseAdmin.from("customers").select("associate_id").or(`company_email.ilike.${email},personal_email.ilike.${email}`).limit(1).maybeSingle();
          if (customer?.associate_id != null) {
            profileWithAssociateId = { ...finalProfile, associate_id: customer.associate_id };
            req.session.profile = profileWithAssociateId;
          }
        } catch (error) {
        }
      }
      res.json({
        user: sessionUser,
        profile: profileWithAssociateId
      });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  // Update agent profile
  static async updateProfile(req, res) {
    try {
      const sessionUser = req.session.user;
      if (!sessionUser) {
        return res.status(401).json({ error: "No active session" });
      }
      const updateData = req.body;
      const updatedProfile = await storage.updateAgentProfileBySupabaseId(sessionUser.id, updateData);
      if (!updatedProfile) {
        return res.status(404).json({ error: "Agent profile not found" });
      }
      req.session.profile = updatedProfile;
      res.json({
        success: true,
        profile: updatedProfile
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  // Forgot password - send SMS code (EMAIL + PHONE - NO PRODUCERLIST)
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      if (!supabaseAdmin) {
        return res.status(500).json({ error: "Admin authentication not configured" });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const { data: customer } = await supabaseAdmin.from("customers").select("associate_id, phone, agent_name, first_name").or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`).maybeSingle();
      const associateId = customer?.associate_id != null ? String(customer.associate_id) : await lookupAssociateIdByEmail(normalizedEmail);
      if (!associateId) {
        return res.json({ success: true, message: "If your account exists, your passcode has been sent." });
      }
      const passcode = deriveSupabasePasswordFromAssociateId(associateId);
      let passcodeSet = false;
      try {
        const authUserId = await findAuthUserIdByEmail(normalizedEmail);
        if (authUserId) {
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: passcode });
          if (updateErr) {
            throw updateErr;
          }
          passcodeSet = true;
          console.log(`\u2705 forgotPassword: Updated existing auth password for ${normalizedEmail}`);
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: passcode,
            email_confirm: true
          });
          if (createErr) {
            throw createErr;
          }
          if (created?.user?.id) {
            passcodeSet = true;
            console.log(`\u2705 forgotPassword: Created missing auth user with passcode for ${normalizedEmail}`);
          }
        }
      } catch (resetErr) {
        console.error("\u274C forgotPassword: Failed to set Supabase passcode:", resetErr);
        return res.status(500).json({
          success: false,
          error: "Unable to set passcode right now. Please try again in a moment."
        });
      }
      if (!passcodeSet) {
        console.error(`\u274C forgotPassword: passcodeSet=false for ${normalizedEmail}`);
        return res.status(500).json({
          success: false,
          error: "Unable to set passcode right now. Please try again in a moment."
        });
      }
      return res.json({
        success: true,
        message: "Your passcode is shown below.",
        associateId: passcode
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  static async resetPasswordWithSMS(req, res) {
    try {
      const { email, phone, code, newPassword } = req.body;
      if (!email || !phone || !code || !newPassword) {
        return res.status(400).json({
          error: "Email, phone number, verification code, and new password are required"
        });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters long"
        });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const cleanPhone = phone.replace(/D/g, "");
      const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : cleanPhone.startsWith("+") ? cleanPhone : `+1${cleanPhone}`;
      console.log(`\u{1F504} Verifying SMS code for password reset: ${normalizedEmail}, phone: ${formattedPhone}`);
      let foundEntry = null;
      let foundKey = null;
      for (const [key, value] of smsResetCodes.entries()) {
        const storedEmail = value.email?.toLowerCase().trim();
        const storedPhoneClean = value.phone.replace(/D/g, "");
        const requestPhoneClean = formattedPhone.replace(/D/g, "");
        if (storedEmail === normalizedEmail && storedPhoneClean === requestPhoneClean && value.code === code && value.expires > Date.now()) {
          foundEntry = value;
          foundKey = key;
          break;
        }
      }
      if (!foundEntry) {
        return res.status(400).json({
          error: "Invalid or expired verification code"
        });
      }
      if (!supabaseAdmin) {
        return res.status(500).json({
          error: "Admin authentication not configured"
        });
      }
      console.log(`\u{1F504} Updating password via Supabase admin for: ${normalizedEmail}`);
      const userId = foundEntry.userId;
      if (!userId) {
        console.error(`\u274C No user ID stored in reset code for: ${normalizedEmail}`);
        return res.status(500).json({
          error: "Invalid reset code. Please request a new code."
        });
      }
      console.log(`\u2705 Using stored user ID: ${userId} for password reset`);
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          password: newPassword,
          email_confirm: true
          // Ensure email is confirmed so user can login
        }
      );
      if (updateError) {
        console.error("\u274C Password update error:", updateError);
        console.error("\u274C Update error details:", JSON.stringify(updateError, null, 2));
        return res.status(400).json({
          error: "Failed to update password",
          details: updateError.message
        });
      }
      if (!updateData || !updateData.user) {
        console.error("\u274C Password update returned no user data");
        return res.status(500).json({
          error: "Password update failed - no user data returned"
        });
      }
      console.log(`\u2705 Password updated successfully via SMS reset for: ${normalizedEmail}`);
      console.log(`\u2705 Updated user ID: ${updateData.user.id}, Email: ${updateData.user.email}`);
      if (foundKey) {
        smsResetCodes.delete(foundKey);
      }
      res.json({
        success: true,
        message: "Password updated successfully"
      });
    } catch (error) {
      console.error("SMS password reset error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  // Reset password with token
  static async resetPasswordWithToken(req, res) {
    try {
      const { accessToken, refreshToken, newPassword } = req.body;
      if (!accessToken || !refreshToken || !newPassword) {
        return res.status(400).json({
          error: "Access token, refresh token, and new password are required"
        });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters long"
        });
      }
      if (!supabase) {
        return res.status(500).json({
          error: "Authentication service not available"
        });
      }
      console.log("\u{1F504} Setting session with tokens for password reset...");
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (sessionError || !sessionData.user) {
        console.error("Session error:", sessionError);
        return res.status(400).json({
          error: "Invalid or expired reset link",
          details: sessionError?.message
        });
      }
      console.log(`\u{1F504} Updating password for user: ${sessionData.user.email}`);
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateError) {
        console.error("Password update error:", updateError);
        return res.status(400).json({
          error: "Failed to update password",
          details: updateError.message
        });
      }
      console.log(`\u2705 Password updated successfully for: ${sessionData.user.email}`);
      res.json({
        success: true,
        message: "Password updated successfully"
      });
    } catch (error) {
      console.error("Reset password with token error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  // Password reset
  static async resetPassword(req, res) {
    try {
      const sessionUser = req.session.user;
      if (!sessionUser) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { email, newPassword } = req.body;
      if (!email || !newPassword) {
        return res.status(400).json({ error: "Email and new password are required" });
      }
      if (!supabaseAdmin) {
        return res.status(500).json({
          error: "Admin authentication not configured"
        });
      }
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        email,
        // This should be the user ID, but we'll find it first
        { password: newPassword }
      );
      if (error) {
        console.log("Trying to find user by email:", email);
        const { data: users2, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError || !users2) {
          return res.status(400).json({
            error: "Failed to find user",
            details: listError?.message
          });
        }
        const user = users2.users.find((u) => u.email === email);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { password: newPassword }
        );
        if (resetError) {
          return res.status(400).json({
            error: "Failed to reset password",
            details: resetError.message
          });
        }
        console.log(`\u2705 Password reset successful for ${email}`);
        return res.json({
          success: true,
          message: `Password reset successful for ${email}`
        });
      }
      console.log(`\u2705 Password reset successful for ${email}`);
      res.json({
        success: true,
        message: `Password reset successful for ${email}`
      });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

// server/register-auth-routes.ts
init_supabase();

// server/routes-agent-provision.ts
init_supabase();
init_hardcoded_config();
import { Router } from "express";
import twilio2 from "twilio";

// server/subscription-service.ts
init_supabase();
init_hardcoded_config();
import Stripe from "stripe";

// server/aoi-score-service.ts
init_supabase();
import { subDays } from "date-fns";

// server/subscription-service.ts
var SUBSCRIPTION_CACHE_TTL_MS = 5 * 60 * 1e3;
var planPriceCache = {
  starter: HARDCODED_CONFIG.STRIPE_PRICE_STARTER,
  professional: HARDCODED_CONFIG.STRIPE_PRICE_PROFESSIONAL,
  elite: HARDCODED_CONFIG.STRIPE_PRICE_ELITE
};
var CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS = 5500;
var CC_PRO_ASSOCIATE_DISCOUNT_CURRENCY = "usd";

// server/routes-agent-provision.ts
var router = Router();
var phoneVerificationCodes = /* @__PURE__ */ new Map();
async function findAuthUserIdByEmail2(email) {
  if (!supabaseAdmin) return null;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  const perPage = 200;
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users2 = data?.users || [];
    const match = users2.find((u) => String(u?.email || "").trim().toLowerCase() === normalizedEmail);
    if (match?.id) return String(match.id);
    if (users2.length < perPage) break;
    page += 1;
  }
  return null;
}
async function ensureCustomerRow(params) {
  if (!supabaseAdmin) return;
  const normalizedEmail = params.email.toLowerCase().trim();
  const firstName = (params.firstName || "").trim();
  const lastName = (params.lastName || "").trim();
  const moduleFlags = customerFlagsFromAoiModules(params.aoiModules);
  const normalizedStates = Array.isArray(params.states) ? [...new Set(params.states.map((s) => String(s || "").trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s)))] : [];
  const normalizedProducts = Array.isArray(params.products) ? [...new Set(params.products.map((p) => String(p || "").trim()).filter(Boolean))] : [];
  const row = {
    company_email: normalizedEmail,
    personal_email: normalizedEmail,
    first_name: firstName,
    last_name: lastName,
    agent_name: `${firstName} ${lastName}`.trim() || normalizedEmail.split("@")[0],
    associate_id: Number(params.associateId),
    phone: params.phone || "+1-555-0000",
    primary_market: params.primaryMarket || "",
    secondary_market: params.secondaryMarket || "",
    market: params.primaryMarket ? [params.primaryMarket] : [],
    states: normalizedStates,
    products: normalizedProducts,
    VDPACTIVE: "INACTIVE",
    PLUSACTIVE: moduleFlags.PLUSACTIVE,
    RECRUITACTIVE: moduleFlags.RECRUITACTIVE,
    AOICONNECT: moduleFlags.AOICONNECT,
    CCPRO: false
  };
  const { data: existing } = await supabaseAdmin.from("customers").select("id").or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`).limit(1).maybeSingle();
  if (existing?.id) {
    const { error: updateErr } = await supabaseAdmin.from("customers").update(row).eq("id", existing.id);
    if (updateErr && updateErr.message?.toLowerCase().includes("products")) {
      const fallback = { ...row };
      delete fallback.products;
      await supabaseAdmin.from("customers").update(fallback).eq("id", existing.id);
      return;
    }
    if (updateErr) throw updateErr;
    return;
  }
  const { error: insertErr } = await supabaseAdmin.from("customers").insert(row);
  if (insertErr && insertErr.message?.toLowerCase().includes("products")) {
    const fallback = { ...row };
    delete fallback.products;
    await supabaseAdmin.from("customers").insert(fallback);
    return;
  }
  if (insertErr) throw insertErr;
}
async function dedupeCustomersByEmailAndAssociate(params) {
  if (!supabaseAdmin) return;
  const normalizedEmail = params.email.toLowerCase().trim();
  const assocNum = Number(params.associateId);
  const { data: candidates, error: candidateErr } = await supabaseAdmin.from("customers").select("id, company_email, personal_email, created_at").or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail},associate_id.eq.${assocNum}`).order("created_at", { ascending: true });
  if (candidateErr || !candidates || candidates.length === 0) return;
  const emailExact = candidates.find(
    (c) => [c.company_email, c.personal_email].filter(Boolean).map((v) => v.toLowerCase().trim()).includes(normalizedEmail)
  );
  const canonical = emailExact || candidates[0];
  if (!canonical?.id) return;
  const patch = { ...params.patch };
  const { error: patchErr } = await supabaseAdmin.from("customers").update(patch).eq("id", canonical.id);
  if (patchErr && patchErr.message?.toLowerCase().includes("products")) {
    const fallbackPatch = { ...patch };
    delete fallbackPatch.products;
    await supabaseAdmin.from("customers").update(fallbackPatch).eq("id", canonical.id);
  } else if (patchErr) {
    throw patchErr;
  }
  const duplicateIds = candidates.map((c) => c.id).filter((id) => id && id !== canonical.id);
  if (duplicateIds.length > 0) {
    await supabaseAdmin.from("customers").delete().in("id", duplicateIds);
  }
}
router.post("/provision-agent", async (req, res) => {
  try {
    const { associateId, email, primaryMarket, secondaryMarket, aoiModules } = req.body;
    if (!associateId && !email) {
      return res.status(400).json({ success: false, error: "associateId or email is required" });
    }
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: "Admin not configured" });
    }
    let agentEmail = null;
    let agentPhone = null;
    let agentAssociateId = null;
    let agentFirstName = null;
    let agentLastName = null;
    if (associateId) {
      const { data: customer } = await supabaseAdmin.from("customers").select("company_email, personal_email, associate_id, first_name, last_name, agent_name").eq("associate_id", associateId).maybeSingle();
      if (!customer) {
        const { data: producer } = await supabaseAdmin.from("producerlist").select("company_email, personal_email, associate_id, agent_name").eq("associate_id", associateId).maybeSingle();
        if (!producer) {
          if (!email) {
            return res.status(404).json({ success: false, error: "Associate ID not found. Please also provide your work email.", allowManual: true, requireEmail: true });
          }
          agentEmail = String(email).toLowerCase().trim();
          agentAssociateId = String(associateId);
        } else {
          agentEmail = producer.company_email || producer.personal_email;
          agentAssociateId = String(producer.associate_id);
          const nameParts = (producer.agent_name || "").split(" ");
          agentFirstName = nameParts[0] || null;
          agentLastName = nameParts.slice(1).join(" ") || null;
        }
      } else {
        agentEmail = customer.company_email || customer.personal_email;
        agentAssociateId = String(customer.associate_id);
        agentFirstName = customer.first_name || (customer.agent_name || "").split(" ")[0] || null;
        agentLastName = customer.last_name || (customer.agent_name || "").split(" ").slice(1).join(" ") || null;
        agentPhone = customer.phone || null;
      }
    } else {
      const { data: customer } = await supabaseAdmin.from("customers").select("company_email, personal_email, associate_id, first_name, last_name, agent_name").or(`company_email.eq.${email.toLowerCase()},personal_email.eq.${email.toLowerCase()}`).maybeSingle();
      if (!customer || !customer.associate_id) {
        return res.status(404).json({ success: false, error: "Email not found or no associate ID on record", allowManual: true });
      }
      agentEmail = customer.company_email || customer.personal_email;
      agentAssociateId = String(customer.associate_id);
      agentFirstName = customer.first_name || null;
      agentLastName = customer.last_name || null;
      agentPhone = customer.phone || null;
    }
    if (!agentEmail || !agentAssociateId) {
      return res.status(400).json({ success: false, error: "Could not resolve agent email or associate ID" });
    }
    const normalizedEmail = agentEmail.toLowerCase().trim();
    const password = String(agentAssociateId);
    const rawPm = typeof primaryMarket === "string" ? primaryMarket.trim() : "";
    const rawSm = typeof secondaryMarket === "string" ? secondaryMarket.trim() : "";
    const rawMods = Array.isArray(aoiModules) ? aoiModules.filter((x) => typeof x === "string") : [];
    try {
      await ensureCustomerRow({
        email: normalizedEmail,
        associateId: agentAssociateId,
        firstName: agentFirstName,
        lastName: agentLastName,
        phone: agentPhone,
        primaryMarket: rawPm,
        secondaryMarket: rawSm,
        aoiModules: rawMods
      });
    } catch (e) {
      console.warn("\u26A0\uFE0F provision-agent: ensureCustomerRow failed (non-critical):", e);
    }
    const custPatch = {};
    if (rawPm) {
      custPatch.primary_market = rawPm;
    }
    if (rawSm) {
      custPatch.secondary_market = rawSm;
    }
    if (rawMods.length > 0) {
      Object.assign(custPatch, customerFlagsFromAoiModules(rawMods));
    }
    if (Object.keys(custPatch).length > 0) {
      try {
        await supabaseAdmin.from("customers").update(custPatch).or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);
        console.log(`\u2705 provision-agent: Updated customers row with market/modules for ${normalizedEmail}`);
      } catch (upErr) {
        console.warn("\u26A0\uFE0F provision-agent: customers update failed (non-critical):", upErr);
      }
    }
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      // auto-verified — no email needed
      user_metadata: {
        first_name: agentFirstName,
        last_name: agentLastName,
        associate_id: agentAssociateId,
        provisioned_by: "auto-provision",
        ...rawPm ? { primary_market: rawPm } : {},
        ...rawSm ? { secondary_market: rawSm } : {},
        ...rawMods.length > 0 ? { aoi_modules: rawMods } : {}
      }
    });
    if (createError) {
      const alreadyExists = createError.message?.toLowerCase().includes("already been registered") || createError.message?.toLowerCase().includes("already exists") || createError.message?.toLowerCase().includes("user already registered");
      if (alreadyExists) {
        console.log(`provision-agent: ${normalizedEmail} already exists \u2014 resetting password`);
        try {
          const { data: custRow } = await supabaseAdmin.from("customers").select("user_id").or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`).not("user_id", "is", null).maybeSingle();
          let uid = custRow?.user_id;
          if (!uid) {
            const { data: found } = await supabaseAdmin.auth.admin.listUsers({ email: normalizedEmail });
            uid = found?.users?.find((u) => (u.email || "").toLowerCase().trim() === normalizedEmail)?.id;
            if (uid) await supabaseAdmin.from("customers").update({ user_id: uid }).or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);
          }
          if (uid) {
            await supabaseAdmin.auth.admin.updateUserById(uid, { password: String(agentAssociateId) });
            console.log(`provision-agent: password reset for ${normalizedEmail}`);
          }
        } catch (e) {
          console.warn(`provision-agent: password reset failed (non-critical):`, e);
        }
        return res.json({ success: true, email: normalizedEmail, alreadyExists: true, associateId: agentAssociateId });
      }
      console.error("\u274C provision-agent: createUser error:", createError);
      return res.status(400).json({ success: false, error: createError.message });
    }
    console.log(`\u2705 provision-agent: Created new login for ${normalizedEmail} (associate_id: ${agentAssociateId})`);
    const newSupabaseUserId = createData?.user?.id;
    if (newSupabaseUserId) {
      try {
        await supabaseAdmin.from("customers").update({ user_id: newSupabaseUserId }).or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);
        console.log(`\u2705 provision-agent: Linked user_id to customers row`);
      } catch (linkErr) {
        console.warn("\u26A0\uFE0F provision-agent: Failed to link user_id (non-critical):", linkErr);
      }
    }
    try {
      const { data: existingProfile } = await supabaseAdmin.from("agent_profiles").select("id").ilike("email", normalizedEmail).maybeSingle();
      if (!existingProfile) {
        await supabaseAdmin.from("agent_profiles").insert({
          supabase_user_id: newSupabaseUserId || null,
          email: normalizedEmail,
          first_name: agentFirstName || "",
          last_name: agentLastName || "",
          phone: agentPhone || "",
          zoom_id: "",
          zoom_password: "1",
          primary_market: rawPm,
          secondary_market: rawSm,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        console.log(`\u2705 provision-agent: Created agent_profiles row for ${normalizedEmail}`);
      } else if (newSupabaseUserId) {
        await supabaseAdmin.from("agent_profiles").update({ supabase_user_id: newSupabaseUserId }).ilike("email", normalizedEmail);
        console.log(`\u2705 provision-agent: Updated supabase_user_id on existing agent_profiles`);
      }
    } catch (profileErr) {
      console.warn("\u26A0\uFE0F provision-agent: Failed to create agent_profiles (non-critical):", profileErr);
    }
    return res.json({
      success: true,
      email: normalizedEmail,
      alreadyExists: false,
      message: "Account created. Use your Associate ID as your password.",
      associateId: agentAssociateId
    });
  } catch (err) {
    console.error("\u274C provision-agent error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
});
router.post("/provision-agent/manual", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: "Admin not configured" });
    }
    const {
      email,
      emailConfirm,
      associateId,
      associateIdConfirm,
      firstName,
      lastName,
      phone,
      primaryMarket,
      secondaryMarket,
      aoiModules,
      products,
      states
    } = req.body || {};
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const normalizedEmailConfirm = String(emailConfirm || "").toLowerCase().trim();
    const normalizedAssociate = String(associateId || "").trim();
    const normalizedAssociateConfirm = String(associateIdConfirm || "").trim();
    const normalizedPrimaryMarket = String(primaryMarket || "").trim();
    const normalizedSecondaryMarket = String(secondaryMarket || "").trim();
    const normalizedModules = Array.isArray(aoiModules) ? aoiModules.filter((m) => typeof m === "string" && m.trim().length > 0) : [];
    const normalizedProducts = Array.isArray(products) ? [...new Set(products.map((p) => String(p || "").trim()).filter(Boolean))] : [];
    const normalizedStates = Array.isArray(states) ? [...new Set(states.map((s) => String(s || "").trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s)))] : [];
    if (!normalizedEmail.endsWith("@aoglobelife.com")) {
      return res.status(400).json({ success: false, error: "Email must be an @aoglobelife.com address" });
    }
    if (normalizedEmail !== normalizedEmailConfirm) {
      return res.status(400).json({ success: false, error: "Email entries do not match" });
    }
    if (normalizedAssociate !== normalizedAssociateConfirm) {
      return res.status(400).json({ success: false, error: "Associate ID entries do not match" });
    }
    if (!/^23\d+$/.test(normalizedAssociate)) {
      return res.status(400).json({ success: false, error: "Associate ID must be numeric and start with 23" });
    }
    if (!normalizedPrimaryMarket) {
      return res.status(400).json({ success: false, error: "Primary market is required" });
    }
    if (normalizedStates.length === 0) {
      return res.status(400).json({ success: false, error: "Select at least one state" });
    }
    const safeFirstName = String(firstName || "").trim() || normalizedEmail.split("@")[0];
    const safeLastName = String(lastName || "").trim();
    await ensureCustomerRow({
      email: normalizedEmail,
      associateId: normalizedAssociate,
      firstName: safeFirstName,
      lastName: safeLastName,
      phone: String(phone || "").trim() || null,
      primaryMarket: normalizedPrimaryMarket,
      secondaryMarket: normalizedSecondaryMarket,
      aoiModules: normalizedModules,
      states: normalizedStates,
      products: normalizedProducts
    });
    await dedupeCustomersByEmailAndAssociate({
      email: normalizedEmail,
      associateId: normalizedAssociate,
      patch: {
        company_email: normalizedEmail,
        personal_email: normalizedEmail,
        first_name: safeFirstName,
        last_name: safeLastName,
        agent_name: `${safeFirstName} ${safeLastName}`.trim(),
        associate_id: Number(normalizedAssociate),
        primary_market: normalizedPrimaryMarket,
        secondary_market: normalizedSecondaryMarket,
        market: [normalizedPrimaryMarket],
        states: normalizedStates,
        products: normalizedProducts
      }
    });
    let userId = null;
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: normalizedAssociate,
      email_confirm: true,
      user_metadata: {
        first_name: safeFirstName,
        last_name: safeLastName,
        associate_id: normalizedAssociate,
        primary_market: normalizedPrimaryMarket,
        secondary_market: normalizedSecondaryMarket,
        aoi_modules: normalizedModules
      }
    });
    if (createError) {
      const alreadyExists = createError.message?.toLowerCase().includes("already been registered") || createError.message?.toLowerCase().includes("already exists") || createError.message?.toLowerCase().includes("user already registered");
      if (!alreadyExists) {
        return res.status(400).json({ success: false, error: createError.message });
      }
      const existingId = await findAuthUserIdByEmail2(normalizedEmail);
      if (existingId) {
        userId = existingId;
        await supabaseAdmin.auth.admin.updateUserById(existingId, {
          password: normalizedAssociate,
          user_metadata: {
            first_name: safeFirstName,
            last_name: safeLastName,
            associate_id: normalizedAssociate,
            primary_market: normalizedPrimaryMarket,
            secondary_market: normalizedSecondaryMarket,
            aoi_modules: normalizedModules
          }
        });
      }
    } else {
      userId = createData?.user?.id || null;
    }
    if (userId) {
      await supabaseAdmin.from("customers").update({ user_id: userId }).or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);
    }
    const { data: profile } = await supabaseAdmin.from("agent_profiles").select("id").eq("email", normalizedEmail).maybeSingle();
    if (!profile?.id) {
      await supabaseAdmin.from("agent_profiles").insert({
        supabase_user_id: userId,
        email: normalizedEmail,
        first_name: safeFirstName,
        last_name: safeLastName,
        phone: String(phone || "").trim() || "",
        zoom_id: "",
        zoom_password: "1",
        primary_market: normalizedPrimaryMarket,
        secondary_market: normalizedSecondaryMarket,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return res.json({
      success: true,
      email: normalizedEmail,
      associateId: normalizedAssociate,
      manual: true,
      message: "Manual account submission saved and provisioned."
    });
  } catch (err) {
    console.error("\u274C manual provision-agent error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
});
router.post("/generate-ccpro-coupons", async (req, res) => {
  try {
    const { adminKey, upgradeLegacyCoupons } = req.body;
    if (adminKey !== "aoi-admin-2024") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: "Supabase not configured" });
    }
    const Stripe2 = (await import("stripe")).default;
    const { HARDCODED_CONFIG: HARDCODED_CONFIG2 } = await Promise.resolve().then(() => (init_hardcoded_config(), hardcoded_config_exports));
    if (!HARDCODED_CONFIG2.STRIPE_SECRET_KEY) {
      return res.status(500).json({ success: false, error: "Stripe not configured" });
    }
    const stripe = new Stripe2(HARDCODED_CONFIG2.STRIPE_SECRET_KEY, { apiVersion: "2024-09-30.acacia" });
    let allIds = [];
    let page = 0;
    while (true) {
      const { data, error } = await supabaseAdmin.from("customers").select("associate_id").not("associate_id", "is", null).range(page * 1e3, (page + 1) * 1e3 - 1);
      if (error || !data || data.length === 0) break;
      allIds = allIds.concat(data.map((r) => String(r.associate_id).trim()).filter(Boolean));
      if (data.length < 1e3) break;
      page++;
    }
    page = 0;
    while (true) {
      const { data, error } = await supabaseAdmin.from("producerlist").select("associate_id").not("associate_id", "is", null).range(page * 1e3, (page + 1) * 1e3 - 1);
      if (error || !data || data.length === 0) break;
      allIds = allIds.concat(data.map((r) => String(r.associate_id).trim()).filter(Boolean));
      if (data.length < 1e3) break;
      page++;
    }
    const unique = [...new Set(allIds)];
    console.log(`[generate-ccpro-coupons] Found ${unique.length} unique associate IDs`);
    let created = 0;
    let skipped = 0;
    let errors = 0;
    for (const id of unique) {
      try {
        let mustCreate = false;
        try {
          const existing = await stripe.coupons.retrieve(id);
          if (!existing || existing.deleted) {
            mustCreate = true;
          } else {
            const isUsd55 = existing.amount_off === CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS && (existing.currency || "usd").toLowerCase() === CC_PRO_ASSOCIATE_DISCOUNT_CURRENCY;
            if (isUsd55) {
              skipped++;
              continue;
            }
            if (upgradeLegacyCoupons === true && existing.percent_off === 90 && (existing.times_redeemed ?? 0) === 0) {
              await stripe.coupons.del(id);
              mustCreate = true;
            } else {
              skipped++;
              console.log(
                `[generate-ccpro-coupons] Skip ${id}: existing coupon is not $${CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS / 100} off (use upgradeLegacyCoupons with unredeemed 90% coupons, or delete in Stripe)`
              );
              continue;
            }
          }
        } catch {
          mustCreate = true;
        }
        if (!mustCreate) {
          continue;
        }
        await stripe.coupons.create({
          id,
          amount_off: CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS,
          currency: CC_PRO_ASSOCIATE_DISCOUNT_CURRENCY,
          duration: "once",
          max_redemptions: 1,
          name: `CCPro $55 off first month (Associate ${id})`,
          metadata: { associate_id: id, purpose: "ccpro_first_month" }
        });
        created++;
      } catch (e) {
        console.error(`[generate-ccpro-coupons] Failed for ID ${id}:`, e.message);
        errors++;
      }
    }
    console.log(`[generate-ccpro-coupons] Done: created=${created} skipped=${skipped} errors=${errors}`);
    return res.json({ success: true, total: unique.length, created, skipped, errors });
  } catch (err) {
    console.error("\u274C generate-ccpro-coupons error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
});
router.post("/save-phone", async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ success: false, error: "email and phone are required" });
    }
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: "Admin not configured" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const digits = phone.replace(/\D/g, "");
    let normalizedPhone;
    if (digits.length === 10) {
      normalizedPhone = `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      normalizedPhone = `+${digits}`;
    } else {
      normalizedPhone = digits.length > 0 ? `+${digits}` : phone;
    }
    const { data: customer, error: lookupError } = await supabaseAdmin.from("customers").select("id, company_email, personal_email").or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`).maybeSingle();
    if (lookupError) {
      console.error("\u274C save-phone lookup error:", lookupError);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    if (!customer) {
      return res.status(404).json({ success: false, error: "Email not found" });
    }
    const { error: updateError } = await supabaseAdmin.from("customers").update({ phone: normalizedPhone }).eq("id", customer.id);
    if (updateError) {
      console.error("\u274C save-phone update error:", updateError);
      return res.status(500).json({ success: false, error: "Failed to save phone" });
    }
    console.log(`\u2705 save-phone: Saved ${normalizedPhone} for ${normalizedEmail}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("\u274C save-phone error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
});
router.post("/send-passcode-sms", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "email is required" });
    }
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: "Admin not configured" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const { data: customer, error: lookupError } = await supabaseAdmin.from("customers").select("phone, associate_id").or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`).maybeSingle();
    if (lookupError) {
      console.error("\u274C send-passcode-sms lookup error:", lookupError);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    if (!customer || !customer.associate_id) {
      return res.status(404).json({ success: false, error: "Email not found or no associate ID on record" });
    }
    const associateId = String(customer.associate_id).trim();
    const passcode = associateId.length >= 6 ? associateId : associateId.padEnd(6, "0");
    let passcodeSet = false;
    try {
      const authUserId = await findAuthUserIdByEmail2(normalizedEmail);
      if (authUserId) {
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: passcode });
        if (updateErr) {
          throw updateErr;
        }
        passcodeSet = true;
      } else {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: passcode,
          email_confirm: true
        });
        if (createErr) {
          throw createErr;
        }
        passcodeSet = Boolean(created?.user?.id);
      }
    } catch (setErr) {
      console.error("\u274C send-passcode-sms: failed to set Supabase passcode:", setErr?.message || setErr);
      return res.status(500).json({ success: false, error: "Unable to set passcode right now" });
    }
    if (!passcodeSet) {
      return res.status(500).json({ success: false, error: "Unable to set passcode right now" });
    }
    console.log(`\u2705 send-passcode-sms: returning on-screen passcode for ${normalizedEmail}`);
    return res.json({
      success: true,
      sent: false,
      showOnScreen: true,
      associateId: passcode
    });
  } catch (err) {
    console.error("\u274C send-passcode-sms error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
});
router.post("/send-phone-code", async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ success: false, error: "email and phone are required" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const digits = phone.replace(/\D/g, "");
    let normalizedPhone;
    if (digits.length === 10) {
      normalizedPhone = `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      normalizedPhone = `+${digits}`;
    } else {
      normalizedPhone = digits.length > 0 ? `+${digits}` : phone;
    }
    const code = Math.floor(1e5 + Math.random() * 9e5).toString();
    phoneVerificationCodes.set(normalizedEmail, {
      code,
      expires: Date.now() + 10 * 60 * 1e3,
      phone: normalizedPhone
    });
    const client = twilio2(HARDCODED_CONFIG.TWILIO_ACCOUNT_SID, HARDCODED_CONFIG.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `Your AO Intelligence verification code is: ${code}. Expires in 10 minutes.`,
      from: HARDCODED_CONFIG.TWILIO_PHONE_NUMBER,
      to: normalizedPhone
    });
    console.log(`\u2705 send-phone-code: Sent code to ${normalizedPhone} for ${normalizedEmail}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("\u274C send-phone-code error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
});
router.post("/verify-phone-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, error: "email and code are required" });
    }
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: "Admin not configured" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const stored = phoneVerificationCodes.get(normalizedEmail);
    if (!stored) {
      return res.json({ success: false, error: "No verification code found. Please request a new one." });
    }
    if (Date.now() > stored.expires) {
      phoneVerificationCodes.delete(normalizedEmail);
      return res.json({ success: false, error: "Code has expired. Please request a new one." });
    }
    if (stored.code !== code.trim()) {
      return res.json({ success: false, error: "Invalid or expired code" });
    }
    const normalizedPhone = stored.phone;
    const { data: customer, error: lookupError } = await supabaseAdmin.from("customers").select("id, company_email, personal_email").or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`).maybeSingle();
    if (lookupError) {
      console.error("\u274C verify-phone-code lookup error:", lookupError);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    if (!customer) {
      return res.status(404).json({ success: false, error: "Email not found" });
    }
    const { error: updateError } = await supabaseAdmin.from("customers").update({ phone: normalizedPhone }).eq("id", customer.id);
    if (updateError) {
      console.error("\u274C verify-phone-code update error:", updateError);
      return res.status(500).json({ success: false, error: "Failed to save phone" });
    }
    phoneVerificationCodes.delete(normalizedEmail);
    console.log(`\u2705 verify-phone-code: Verified and saved ${normalizedPhone} for ${normalizedEmail}`);
    return res.json({ success: true, verified: true });
  } catch (err) {
    console.error("\u274C verify-phone-code error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
});
var routes_agent_provision_default = router;

// server/register-auth-routes.ts
init_hardcoded_config();
import crypto from "crypto";
function registerAuthRoutes(app2) {
  app2.get("/api/auth/iframe-assoc-login", async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ success: false, error: "Supabase admin unavailable" });
      }
      const assocIdRaw = typeof req.query.assocId === "string" && req.query.assocId || typeof req.query.associateId === "string" && req.query.associateId || typeof req.query.asscID === "string" && req.query.asscID || "";
      const assocId = String(assocIdRaw).trim();
      if (!assocId) {
        return res.status(400).json({ success: false, error: "assocId is required" });
      }
      const providedKey = typeof req.query.key === "string" && req.query.key || typeof req.headers["x-iframe-key"] === "string" && req.headers["x-iframe-key"] || "";
      const expectedKey = String(process.env.PRECHECK_IFRAME_KEY || HARDCODED_CONFIG.SESSION_SECRET || "");
      const validKey = providedKey && expectedKey && Buffer.byteLength(providedKey) === Buffer.byteLength(expectedKey) && crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey));
      if (!validKey) {
        return res.status(403).json({ success: false, error: "invalid iframe key" });
      }
      const { data: customer, error: customerErr } = await supabaseAdmin.from("customers").select("associate_id,company_email,personal_email").eq("associate_id", assocId).limit(1).maybeSingle();
      if (customerErr) {
        return res.status(500).json({ success: false, error: customerErr.message });
      }
      if (!customer) {
        return res.status(404).json({ success: false, error: "associate_id not found" });
      }
      const email = String(customer.company_email || customer.personal_email || "").toLowerCase().trim();
      if (!email.includes("@")) {
        return res.status(404).json({ success: false, error: "No email found for associate_id" });
      }
      const { data: profile } = await supabaseAdmin.from("agent_profiles").select("*").eq("email", email).maybeSingle();
      const sessionUser = {
        id: String(profile?.id || email),
        email
      };
      if (req.session) {
        req.session.user = sessionUser;
        req.session.profile = profile ?? null;
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
      if (req.session && typeof req.session.save === "function") {
        return req.session.save((err) => {
          if (err) return res.status(500).json({ success: false, error: "failed to persist session" });
          return finish();
        });
      }
      return finish();
    } catch (error) {
      return res.status(500).json({ success: false, error: error?.message || String(error) });
    }
  });
  app2.post("/api/auth/login", async (req, res, next) => {
    try {
      const email = req.body?.email || "unknown";
      console.log(`\u{1F510} LOGIN ATTEMPT: ${email}`);
      await AuthService.login(req, res);
      console.log(`\u2705 LOGIN SUCCESS: ${email}`);
    } catch (error) {
      const email = req.body?.email || "unknown";
      console.error(`\u274C CRITICAL: Login route error for ${email}:`, error);
      console.error(`   Error stack:`, error instanceof Error ? error.stack : "No stack");
      if (!res.headersSent) {
        res.status(500).json({
          error: "Login failed",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
  app2.post("/api/auth/signup", (_req, res) => {
    res.status(403).json({
      error: "This signup path is disabled. Use Get your account (/join) with your work email.",
      redirectTo: "/join"
    });
  });
  app2.get("/api/auth/session", async (req, res) => {
    try {
      const requestId = String(req.headers["x-request-id"] || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const referer = String(req.headers.referer || "");
      const traceSession = referer.includes("/dashboard/verification-start") || referer.includes("/precheck") || Boolean(req.headers["x-desktop-app"]);
      const session2 = req.session;
      const user = session2?.user;
      if (traceSession) {
        const hasCookie = typeof req.headers.cookie === "string" && req.headers.cookie.length > 0;
        const hasAuth = typeof req.headers.authorization === "string" && req.headers.authorization.length > 0;
        console.log(
          `[auth-session-trace] -> ${requestId} cookie=${hasCookie} auth=${hasAuth} desktop=${req.headers["x-desktop-app"] ? "1" : "0"} referer=${referer || "-"}`
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
            created_at: user.created_at
          },
          profile: session2?.profile ?? null
        });
      }
      const jwtUser = req?.user;
      const jwtEmail = typeof jwtUser?.email === "string" ? jwtUser.email.trim().toLowerCase() : "";
      if (jwtEmail.includes("@")) {
        let profile = null;
        if (supabaseAdmin) {
          try {
            const { data } = await supabaseAdmin.from("agent_profiles").select("*").eq("email", jwtEmail).maybeSingle();
            profile = data ?? null;
          } catch (profileError) {
            console.warn("\u26A0\uFE0F Session JWT recovery profile lookup failed:", profileError);
          }
        }
        const recoveredUser = {
          id: String(jwtUser?.id || profile?.id || jwtEmail),
          email: jwtEmail,
          created_at: jwtUser?.created_at
        };
        if (req.session) {
          req.session.user = recoveredUser;
          req.session.profile = profile;
        }
        return res.json({
          user: recoveredUser,
          profile,
          recoveredFromJwt: true
        });
      }
      if (traceSession) {
        console.warn(`[auth-session-trace] <- ${requestId} source=none user=null`);
      }
      return res.json({ user: null, profile: null });
    } catch (error) {
      console.error("\u274C Session endpoint error:", error);
      res.json({ user: null, profile: null });
    }
  });
  app2.post("/api/auth/logout", AuthService.logout);
  app2.get("/api/auth/profile", AuthService.getProfile);
  app2.put("/api/auth/profile", AuthService.updateProfile);
  app2.post("/api/auth/forgot-password", AuthService.forgotPassword);
  app2.post("/api/auth/reset-password-with-sms", AuthService.resetPasswordWithSMS);
  app2.post("/api/auth/reset-password-with-token", AuthService.resetPasswordWithToken);
  app2.post("/api/auth/reset-password", AuthService.resetPassword);
  app2.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Email and verification code are required" });
      }
      const { emailVerificationService: emailVerificationService2 } = await Promise.resolve().then(() => (init_email_verification_service(), email_verification_service_exports));
      const result = await emailVerificationService2.verifyCode(email, code);
      if (!result.success) {
        return res.status(400).json({ error: result.error || "Invalid verification code" });
      }
      if (!supabaseAdmin) {
        return res.status(500).json({ error: "Admin authentication not configured" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      let user = null;
      let page = 1;
      const pageSize = 1e3;
      let hasMore = true;
      while (hasMore && !user) {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: pageSize
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
        email_confirm: true
      });
      if (updateError) {
        console.error("\u274C Error confirming email:", updateError);
        return res.status(500).json({ error: "Failed to verify email" });
      }
      console.log(`\u2705 Email verified for ${normalizedEmail}`);
      res.json({ success: true, message: "Email verified successfully" });
    } catch (error) {
      console.error("\u274C Email verification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/auth/resend-verification-email", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      let firstName;
      if (supabaseAdmin) {
        const { data: profile } = await supabaseAdmin.from("agent_profiles").select("first_name").eq("email", email.toLowerCase().trim()).maybeSingle();
        firstName = profile?.first_name;
      }
      const { emailVerificationService: emailVerificationService2 } = await Promise.resolve().then(() => (init_email_verification_service(), email_verification_service_exports));
      const result = await emailVerificationService2.sendVerificationEmail(email, firstName);
      if (!result.success) {
        return res.status(500).json({ error: result.error || "Failed to send verification email" });
      }
      res.json({
        success: true,
        message: "Verification email sent to both your @aoglobelife.com email and personal email on file"
      });
    } catch (error) {
      console.error("\u274C Resend verification email error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/auth/test-verification-email", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      const { emailVerificationService: emailVerificationService2 } = await Promise.resolve().then(() => (init_email_verification_service(), email_verification_service_exports));
      const result = await emailVerificationService2.sendVerificationEmail(email);
      if (!result.success) {
        return res.status(500).json({ error: result.error || "Failed to send verification email" });
      }
      res.json({
        success: true,
        message: `Test verification email sent to ${email}`,
        code: result.code
      });
    } catch (error) {
      console.error("\u274C Test verification email error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/auth/profile-completion-status", async (req, res) => {
    try {
      const userEmail = req.query.email || req.headers["x-user-email"];
      if (!userEmail) {
        return res.status(400).json({ error: "Email is required" });
      }
      if (!supabaseAdmin) {
        return res.status(500).json({ error: "Database not configured" });
      }
      const normalizedEmail = userEmail.toLowerCase().trim();
      const { data: profile, error: profileError } = await supabaseAdmin.from("agent_profiles").select("first_name, last_name, phone, email, mga_team, rga_team, zoom_id, profile_picture").eq("email", normalizedEmail).maybeSingle();
      if (profileError) {
        console.error("\u274C Error fetching profile:", profileError);
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
            "profile_picture"
          ],
          message: "Agent profile not found"
        });
      }
      const requiredFields = {
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        zoom_id: profile.zoom_id
      };
      const missingFields = [];
      for (const [field, value] of Object.entries(requiredFields)) {
        if (!value || typeof value === "string" && value.trim() === "") {
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
          profilePicture: profile.profile_picture || ""
        }
      });
    } catch (error) {
      console.error("\u274C Profile completion check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.use("/api/auth", routes_agent_provision_default);
}

// server/jwt-auth-middleware.ts
init_supabase();
import { createHash } from "crypto";
var COOKIE_NAME = "sb-access-token";
var CACHE_TTL_MS = 9e4;
var GET_USER_TIMEOUT_MS = 6e3;
var MAX_CACHE_ENTRIES = 2500;
var sessionCache = /* @__PURE__ */ new Map();
var inflightAuth = /* @__PURE__ */ new Map();
var lastJwtMiddlewareErrorLogMs = 0;
var JWT_ERR_LOG_INTERVAL_MS = 6e4;
function tokenCacheKey(token) {
  return createHash("sha256").update(token).digest("hex");
}
function trimSessionCache() {
  while (sessionCache.size > MAX_CACHE_ENTRIES) {
    const first = sessionCache.keys().next().value;
    if (first) sessionCache.delete(first);
    else break;
  }
}
function cloneForSession(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}
function applyCachedSession(session2, entry) {
  session2.user = { ...entry.user };
  session2.profile = cloneForSession(entry.profile);
}
async function resolveAuthToCacheEntry(token) {
  if (!supabaseAdmin) return null;
  const userResult = await Promise.race([
    supabaseAdmin.auth.getUser(token),
    new Promise(
      (resolve) => setTimeout(
        () => resolve({ data: { user: null }, error: { message: "jwt_lookup_timeout" } }),
        GET_USER_TIMEOUT_MS
      )
    )
  ]);
  const {
    data: { user },
    error
  } = userResult;
  if (error || !user) {
    return null;
  }
  if (!user.email?.endsWith("@aoglobelife.com") && user.email !== "test@aoprecheck.com" && user.email !== "chrislafond@aoglobelife.com" && user.email !== "cnsysop@aoglobelife.com") {
    return null;
  }
  let agentProfile = await storage.getAgentProfileByEmail(user.email || "");
  if (!agentProfile && user.email) {
    const emailPrefix = user.email.split("@")[0];
    const nameParts = emailPrefix.split(/[._-]/);
    const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : "Agent";
    const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : "User";
    try {
      agentProfile = await storage.createAgentProfileWithSupabaseId({
        supabaseUserId: user.id,
        firstName,
        lastName,
        phone: "+1-555-0000",
        email: user.email,
        zoomId: "",
        zoomPassword: "1"
      });
    } catch {
      agentProfile = {
        id: 0,
        firstName,
        lastName,
        phone: "+1-555-0000",
        email: user.email,
        zoomId: "",
        zoomPassword: "1",
        supabaseUserId: user.id,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      };
    }
  }
  const sessionUser = {
    id: user.id,
    email: user.email,
    created_at: user.created_at
  };
  let profileWithAssociateId = { ...agentProfile };
  if (supabaseAdmin && user.email && !agentProfile.associate_id) {
    try {
      const email = user.email.toLowerCase().trim();
      const { data: customer } = await supabaseAdmin.from("customers").select("associate_id").or(`company_email.ilike.${email},personal_email.ilike.${email}`).limit(1).maybeSingle();
      if (customer?.associate_id != null) {
        profileWithAssociateId.associate_id = customer.associate_id;
      }
    } catch {
    }
  }
  return {
    user: sessionUser,
    profile: profileWithAssociateId,
    exp: Date.now() + CACHE_TTL_MS
  };
}
async function jwtAuthMiddleware(req, res, next) {
  const session2 = req.session;
  if (session2?.user) {
    return next();
  }
  let token;
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (match) token = decodeURIComponent(match[1].trim());
  }
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }
  if (!token) {
    return next();
  }
  if (!supabaseAdmin) {
    return next();
  }
  const key = tokenCacheKey(token);
  const now = Date.now();
  const hit = sessionCache.get(key);
  if (hit && hit.exp > now) {
    applyCachedSession(session2, hit);
    return next();
  }
  let pending = inflightAuth.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const entry = await resolveAuthToCacheEntry(token);
        if (entry) {
          trimSessionCache();
          sessionCache.set(key, entry);
        }
        return entry;
      } catch (err) {
        const t = Date.now();
        if (t - lastJwtMiddlewareErrorLogMs >= JWT_ERR_LOG_INTERVAL_MS) {
          lastJwtMiddlewareErrorLogMs = t;
          console.error("jwtAuthMiddleware resolve error:", err);
        }
        return null;
      } finally {
        inflightAuth.delete(key);
      }
    })();
    inflightAuth.set(key, pending);
  }
  try {
    const entry = await pending;
    if (entry && entry.exp > Date.now()) {
      applyCachedSession(session2, entry);
    }
  } catch {
  }
  next();
}

// server/entry-auth.ts
process.env.TZ = "America/Los_Angeles";
var app = createApp({ serveSpa: true });
app.use((req, res, next) => {
  if (req.path.startsWith("/api") && !req.path.startsWith("/api/auth")) {
    return res.status(404).json({ error: "Not found", path: req.path });
  }
  next();
});
app.use(jwtAuthMiddleware);
registerAuthRoutes(app);
addErrorHandler(app);
async function main() {
  const port = parseInt(process.env.PORT || "5000", 10);
  const server = http.createServer(app);
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") process.exit(1);
    throw e;
  });
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
  await setupSpa(app, server);
  server.listen(port, "0.0.0.0", () => console.log("auth service", port));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
