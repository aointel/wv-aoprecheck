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
var db_exports = {};
__export(db_exports, {
  db: () => db,
  dispositionWritePool: () => dispositionWritePool,
  leaseDialerPool: () => leaseDialerPool,
  leaseDialerWorkerPool: () => leaseDialerWorkerPool,
  nonLeadPool: () => nonLeadPool,
  pool: () => pool,
  safeDb: () => safeDb
});
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
var pool, dispositionWritePool, leaseDialerPool, leaseDialerWorkerPool, nonLeadPool, LOW_PRIORITY_DB_CONCURRENCY, LOW_PRIORITY_DB_MAX_QUEUE, LOW_PRIORITY_DB_WARN_MS, lowPriorityDbActive, lowPriorityDbLastWarnAt, lowPriorityDbQueue, originalPoolQuery, nonLeadPoolQuery, db, dbConnected, safeDb;
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
    safeDb = {
      query: async (sql5, params) => {
        if (!dbConnected) {
          console.warn("\u26A0\uFE0F Database not connected - skipping query");
          return { rows: [] };
        }
        return pool.query(sql5, params);
      }
    };
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
        const payload = typeof value === "string" ? value : JSON.stringify(value ?? {});
        return this.addFilter(`${qcol(col)}::jsonb @> ?::jsonb`, payload);
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
      limit(count2) {
        this.limitValue = Math.max(0, Number(count2 || 0));
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
      update(payload) {
        this.mode = "update";
        this.updatePayload = payload || {};
        Object.keys(this.updatePayload).forEach((k) => this.referencedColumns.add(normalizeColumn(k)));
        return this;
      }
      insert(payload) {
        this.mode = "insert";
        this.insertPayload = Array.isArray(payload) ? payload : [payload];
        this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn(k))));
        return this;
      }
      upsert(payload, options) {
        this.mode = "upsert";
        this.insertPayload = Array.isArray(payload) ? payload : [payload];
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
        let count2 = null;
        if (this.selectCount === "exact") {
          const c = await pool.query(
            `SELECT COUNT(*)::text AS count FROM ${this.tableName}${where.sql}`,
            where.values
          );
          count2 = Number(c.rows[0]?.count || 0);
        }
        if (this.selectHead) return { data: null, error: null, count: count2 };
        const result = await pool.query(
          `SELECT ${cols} FROM ${this.tableName}${where.sql}${order}${limit}${offset}`,
          where.values
        );
        if (this.singleType === "single") {
          if ((result.rowCount || 0) !== 1) return { data: null, error: { message: "Expected single row" }, count: count2 };
          return { data: result.rows[0], error: null, count: count2 };
        }
        if (this.singleType === "maybeSingle") return { data: result.rows[0] || null, error: null, count: count2 };
        return { data: result.rows, error: null, count: count2 };
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
var supabase_exports = {};
__export(supabase_exports, {
  supabase: () => supabase,
  supabaseAdmin: () => supabaseAdmin,
  supabaseAdminRaw: () => supabaseAdminRaw
});
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

// server/public-live-card-service.ts
var public_live_card_service_exports = {};
__export(public_live_card_service_exports, {
  buildSnapshotForScope: () => buildSnapshotForScope,
  ensurePublicLiveCardTables: () => ensurePublicLiveCardTables,
  getManagerScope: () => getManagerScope,
  getOrCreatePermanentHierarchyLink: () => getOrCreatePermanentHierarchyLink,
  getSnapshotByToken: () => getSnapshotByToken,
  normalizeDateRange: () => normalizeDateRange,
  rebuildAllLiveSnapshots: () => rebuildAllLiveSnapshots,
  rebuildSnapshotForManager: () => rebuildSnapshotForManager,
  seedChrisLiveLink: () => seedChrisLiveLink
});
import crypto from "crypto";
function scoreAgent(a) {
  return a.dials * 1 + a.reach * 10 + a.booked * 40 + a.connects * 25 + a.instant * 80;
}
function stableScopeKey(managerEmail) {
  return `hier_${managerEmail.toLowerCase().trim().replace(/[^a-z0-9]/g, "_")}`;
}
function randomToken() {
  return crypto.randomBytes(24).toString("base64url");
}
function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}
function getPstTodayDateString(now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}
function getPstDayUtcRange(dateYmd) {
  const now = /* @__PURE__ */ new Date();
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset"
  }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value || "GMT-8";
  const m = tzName.match(/GMT([+-]\d{1,2})/);
  const hours = Number(m?.[1] || -8);
  const sign = hours >= 0 ? "+" : "-";
  const hh = String(Math.abs(hours)).padStart(2, "0");
  const offset = `${sign}${hh}:00`;
  const today = getPstTodayDateString();
  if (dateYmd === today) {
    const start2 = /* @__PURE__ */ new Date(`${dateYmd}T05:00:00${offset}`);
    const end2 = /* @__PURE__ */ new Date(`${dateYmd}T23:59:59${offset}`);
    return { startIso: start2.toISOString(), endIso: end2.toISOString() };
  }
  const start = /* @__PURE__ */ new Date(`${dateYmd}T00:00:00${offset}`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
function addDaysYmd(dateYmd, days) {
  const d = /* @__PURE__ */ new Date(`${dateYmd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function normalizeDateRange(startDate, endDate) {
  const valid = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  const today = getPstTodayDateString();
  const start = valid(startDate) ? String(startDate) : today;
  const end = valid(endDate) ? String(endDate) : start;
  const normalizedStart = start <= end ? start : end;
  const normalizedEnd = start <= end ? end : start;
  const { startIso } = getPstDayUtcRange(normalizedStart);
  let endIso;
  if (normalizedEnd === today) {
    const todayRange = getPstDayUtcRange(normalizedEnd);
    endIso = todayRange.endIso;
  } else {
    const nextDayRange = getPstDayUtcRange(addDaysYmd(normalizedEnd, 1));
    endIso = nextDayRange.startIso;
  }
  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    startIso,
    endIso,
    isTodayRange: normalizedStart === today && normalizedEnd === today
  };
}
function slugify(input) {
  return String(input || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}
async function uniqueVanitySlug(base) {
  const cleaned = slugify(base) || "hierarchy";
  let candidate = cleaned;
  let suffix = 1;
  for (; ; ) {
    const { rows } = await pool.query(
      `SELECT 1 FROM public_hierarchy_links WHERE vanity_slug = $1 LIMIT 1`,
      [candidate]
    );
    if (rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${cleaned}-${suffix}`;
  }
}
async function ensurePublicLiveCardTables() {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public_hierarchy_links (
      token TEXT PRIMARY KEY,
      scope_key TEXT NOT NULL UNIQUE,
      vanity_slug TEXT UNIQUE,
      manager_email TEXT NOT NULL,
      manager_name TEXT,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE public_hierarchy_links ADD COLUMN IF NOT EXISTS vanity_slug TEXT;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_public_hierarchy_links_manager_email ON public_hierarchy_links(manager_email);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_public_hierarchy_links_enabled ON public_hierarchy_links(enabled);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_public_hierarchy_links_vanity_slug ON public_hierarchy_links(vanity_slug) WHERE vanity_slug IS NOT NULL;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hierarchy_live_snapshots (
      scope_key TEXT PRIMARY KEY,
      manager_email TEXT NOT NULL,
      manager_name TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      totals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      top5_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      bottom5_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      full_rank_json JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_hierarchy_live_snapshots_updated_at ON hierarchy_live_snapshots(updated_at DESC);`);
  tablesReady = true;
}
async function getManagerScope(managerEmail) {
  const normalizedManager = managerEmail.toLowerCase().trim();
  const { data: customer } = await supabaseAdmin.from("customers").select("company_email, first_name, last_name, associate_id, mga").eq("company_email", normalizedManager).maybeSingle();
  const managerName = `${String(customer?.first_name || "").trim()} ${String(customer?.last_name || "").trim()}`.trim() || normalizedManager;
  const associateId = Number(customer?.associate_id || 0);
  const hierarchyNameByEmail = {};
  const emails = /* @__PURE__ */ new Set();
  if (associateId > 0) {
    const { data: mgaRows } = await supabaseAdmin.from("agent_hierarchy").select("agent_email,agent_name").eq("mga_associate_id", associateId);
    for (const row of mgaRows || []) {
      const email = String(row.agent_email || "").toLowerCase().trim();
      const name = String(row.agent_name || "").trim();
      if (!email) continue;
      emails.add(email);
      if (name) hierarchyNameByEmail[email] = name;
    }
  }
  if (emails.size === 0) {
    const targetMga = String(customer?.mga || "").trim();
    if (targetMga) {
      const { data: byMga } = await supabaseAdmin.from("agent_hierarchy").select("agent_email,agent_name").eq("mga_name", targetMga);
      for (const row of byMga || []) {
        const email = String(row.agent_email || "").toLowerCase().trim();
        const name = String(row.agent_name || "").trim();
        if (!email) continue;
        emails.add(email);
        if (name) hierarchyNameByEmail[email] = name;
      }
    }
  }
  emails.add(normalizedManager);
  return {
    scopeKey: stableScopeKey(normalizedManager),
    managerEmail: normalizedManager,
    managerName,
    agentEmails: [...emails],
    hierarchyNameByEmail
  };
}
async function getIdentity(agentEmails) {
  const out = /* @__PURE__ */ new Map();
  if (agentEmails.length === 0) return out;
  const { data: customersCompany } = await supabaseAdmin.from("customers").select("company_email,personal_email,first_name,last_name").in("company_email", agentEmails);
  const { data: customersPersonal } = await supabaseAdmin.from("customers").select("company_email,personal_email,first_name,last_name").in("personal_email", agentEmails);
  const allCustomers = [...customersCompany || [], ...customersPersonal || []];
  const { data: profiles } = await supabaseAdmin.from("agent_profiles").select("email,profile_picture").in("email", agentEmails);
  const photoByEmail = /* @__PURE__ */ new Map();
  for (const p of profiles || []) {
    const email = String(p.email || "").toLowerCase().trim();
    const pic = String(p.profile_picture || "").trim();
    if (email && pic) photoByEmail.set(email, pic);
  }
  for (const email of agentEmails) {
    const cust = allCustomers.find(
      (c) => String(c.company_email || "").toLowerCase().trim() === email || String(c.personal_email || "").toLowerCase().trim() === email
    );
    const first = String(cust?.first_name || "").trim();
    const last = String(cust?.last_name || "").trim();
    const full = `${first} ${last}`.trim() || email;
    out.set(email, { name: full, photo: photoByEmail.get(email) });
  }
  return out;
}
async function buildSnapshotForScope(scope, dateRange) {
  const identity = await getIdentity(scope.agentEmails);
  const agents = [];
  {
    const byAgent = /* @__PURE__ */ new Map();
    for (const email of scope.agentEmails) {
      byAgent.set(email, {
        dialPhones: /* @__PURE__ */ new Map(),
        reachedPhones: /* @__PURE__ */ new Set(),
        bookedPhones: /* @__PURE__ */ new Set(),
        instantPhones: /* @__PURE__ */ new Set(),
        connects: 0,
        missedCalls: 0
      });
    }
    const pageSize = 1e3;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin.from("twilio_call_logs").select("owner_email,to_number,call_status,call_duration,call_started_at").eq("call_direction", "outbound").gte("call_started_at", dateRange.startIso).lt("call_started_at", dateRange.endIso).in("owner_email", scope.agentEmails).range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      for (const row of rows) {
        const email = String(row.owner_email || "").toLowerCase().trim();
        const agg = byAgent.get(email);
        if (!agg) continue;
        const phone = normalizePhone(row.to_number);
        const status = String(row.call_status || "").toLowerCase();
        const duration = Number(row.call_duration || 0);
        const callTs = new Date(String(row.call_started_at || "")).getTime();
        if (phone.length !== 10) continue;
        const previousTs = agg.dialPhones.get(phone);
        if (!previousTs || callTs - previousTs >= 5 * 60 * 1e3) {
          agg.dialPhones.set(phone, callTs);
        }
        if (duration >= 55 && (status === "answered" || status === "completed")) {
          agg.reachedPhones.add(phone);
        }
        if (duration >= 600 && (status === "answered" || status === "completed")) {
          agg.instantPhones.add(phone);
        }
      }
      if (rows.length < pageSize) break;
    }
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin.from("billing_transactions").select("agent_email,transaction_type,created_at").eq("transaction_type", "missed_call").gte("created_at", dateRange.startIso).lt("created_at", dateRange.endIso).range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      for (const row of rows) {
        const email = String(row.agent_email || "").toLowerCase().trim();
        const agg = byAgent.get(email);
        if (agg) agg.missedCalls += 1;
      }
      if (rows.length < pageSize) break;
    }
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin.from("agent_dial_metrics").select("agent_email,event_type,lead_phone").in("event_type", ["booked"]).gte("event_timestamp", dateRange.startIso).lt("event_timestamp", dateRange.endIso).in("agent_email", scope.agentEmails).range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      for (const row of rows) {
        const email = String(row.agent_email || "").toLowerCase().trim();
        const agg = byAgent.get(email);
        if (!agg) continue;
        const phone = normalizePhone(row.lead_phone);
        if (phone.length === 10) agg.bookedPhones.add(phone);
      }
      if (rows.length < pageSize) break;
    }
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin.from("billing_transactions").select("agent_email,transaction_date").eq("transaction_type", "connect").gte("transaction_date", dateRange.startIso).lt("transaction_date", dateRange.endIso).in("agent_email", scope.agentEmails).not("agent_email", "is", null).neq("agent_email", "").range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      for (const row of rows) {
        const email = String(row.agent_email || "").toLowerCase().trim();
        const agg = byAgent.get(email);
        if (agg) agg.connects += 1;
      }
      if (rows.length < pageSize) break;
    }
    for (const email of scope.agentEmails) {
      const id = identity.get(email);
      const agg = byAgent.get(email);
      const dials = agg?.dialPhones.size || 0;
      const reach = agg?.reachedPhones.size || 0;
      const booked = agg?.bookedPhones.size || 0;
      const instant = agg?.instantPhones.size || 0;
      const connects = agg?.connects || 0;
      const missedCalls = agg?.missedCalls || 0;
      agents.push({
        rank: 0,
        name: id?.name || scope.hierarchyNameByEmail[email] || email,
        email,
        score: scoreAgent({ dials, reach, booked, instant, connects }),
        dials,
        reach,
        booked,
        instant,
        connects,
        missedCalls,
        aoiUsage: 0,
        photoUrl: id?.photo,
        isLive: false
      });
    }
  }
  const hasAnyDisplayedStat = (a) => a.dials > 0 || a.reach > 0 || a.booked > 0 || a.instant > 0 || a.connects > 0 || a.missedCalls > 0 || a.aoiUsage > 0;
  const active = agents.filter(hasAnyDisplayedStat);
  active.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.booked !== a.booked) return b.booked - a.booked;
    if (b.reach !== a.reach) return b.reach - a.reach;
    return b.dials - a.dials;
  });
  active.forEach((a, idx) => {
    a.rank = idx + 1;
  });
  const top5 = active.slice(0, 5);
  const topSet = new Set(top5.map((a) => a.email));
  const bottom5 = active.filter((a) => !topSet.has(a.email)).slice(-5).reverse();
  const totals = {
    activeAgents: active.length,
    totalAgents: scope.agentEmails.length,
    dials: active.reduce((s, a) => s + a.dials, 0),
    reach: active.reduce((s, a) => s + a.reach, 0),
    booked: active.reduce((s, a) => s + a.booked, 0),
    instant: active.reduce((s, a) => s + a.instant, 0),
    connects: active.reduce((s, a) => s + a.connects, 0),
    missedCalls: active.reduce((s, a) => s + a.missedCalls, 0),
    aoiUsage: Math.round(active.reduce((s, a) => s + a.aoiUsage, 0) / Math.max(1, active.length))
  };
  return { totals, top5, bottom5, fullRank: active };
}
async function getOrCreatePermanentHierarchyLink(managerEmail) {
  await ensurePublicLiveCardTables();
  const scope = await getManagerScope(managerEmail);
  const existing = await pool.query(
    `SELECT token, scope_key, vanity_slug, manager_email, manager_name
     FROM public_hierarchy_links
     WHERE scope_key = $1
     LIMIT 1`,
    [scope.scopeKey]
  );
  const defaultSlug = await uniqueVanitySlug(scope.managerName.split(/\s+/).slice(-1)[0] || scope.managerName || scope.managerEmail);
  if (existing.rows.length > 0) {
    const vanitySlug2 = String(existing.rows[0].vanity_slug || "").trim() || defaultSlug;
    if (!String(existing.rows[0].vanity_slug || "").trim()) {
      await pool.query(
        `UPDATE public_hierarchy_links SET vanity_slug = $2, updated_at = NOW() WHERE scope_key = $1`,
        [scope.scopeKey, vanitySlug2]
      );
    }
    return {
      token: String(existing.rows[0].token),
      scopeKey: String(existing.rows[0].scope_key),
      vanitySlug: vanitySlug2,
      managerEmail: String(existing.rows[0].manager_email),
      managerName: String(existing.rows[0].manager_name || scope.managerName)
    };
  }
  const token = randomToken();
  const vanitySlug = defaultSlug;
  await pool.query(
    `INSERT INTO public_hierarchy_links (token, scope_key, vanity_slug, manager_email, manager_name, enabled)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    [token, scope.scopeKey, vanitySlug, scope.managerEmail, scope.managerName]
  );
  return { token, scopeKey: scope.scopeKey, vanitySlug, managerEmail: scope.managerEmail, managerName: scope.managerName };
}
async function rebuildSnapshotForManager(managerEmail) {
  await ensurePublicLiveCardTables();
  const scope = await getManagerScope(managerEmail);
  const snapshot = await buildSnapshotForScope(scope, normalizeDateRange());
  await pool.query(
    `INSERT INTO hierarchy_live_snapshots
      (scope_key, manager_email, manager_name, updated_at, totals_json, top5_json, bottom5_json, full_rank_json)
     VALUES ($1, $2, $3, NOW(), $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb)
     ON CONFLICT (scope_key) DO UPDATE SET
      manager_email = EXCLUDED.manager_email,
      manager_name = EXCLUDED.manager_name,
      updated_at = NOW(),
      totals_json = EXCLUDED.totals_json,
      top5_json = EXCLUDED.top5_json,
      bottom5_json = EXCLUDED.bottom5_json,
      full_rank_json = EXCLUDED.full_rank_json`,
    [
      scope.scopeKey,
      scope.managerEmail,
      scope.managerName,
      JSON.stringify(snapshot.totals),
      JSON.stringify(snapshot.top5),
      JSON.stringify(snapshot.bottom5),
      JSON.stringify(snapshot.fullRank)
    ]
  );
}
async function rebuildAllLiveSnapshots() {
  await ensurePublicLiveCardTables();
  const { rows } = await pool.query(
    `SELECT manager_email
     FROM public_hierarchy_links
     WHERE enabled = TRUE`
  );
  let updated = 0;
  for (const row of rows) {
    const email = String(row.manager_email || "").toLowerCase().trim();
    if (!email) continue;
    await rebuildSnapshotForManager(email);
    updated += 1;
  }
  return updated;
}
async function getSnapshotByToken(tokenOrSlug, options) {
  await ensurePublicLiveCardTables();
  const trimmed = String(tokenOrSlug || "").trim();
  if (!trimmed) return null;
  const { rows: linkRows } = await pool.query(
    `SELECT token, scope_key, vanity_slug, manager_email, manager_name, enabled
     FROM public_hierarchy_links
     WHERE token = $1 OR vanity_slug = $1
     LIMIT 1`,
    [trimmed]
  );
  if (linkRows.length === 0) return null;
  const link = linkRows[0];
  if (!Boolean(link.enabled)) return null;
  const dateRange = normalizeDateRange(options?.startDate, options?.endDate);
  if (!dateRange.isTodayRange) {
    const scope = await getManagerScope(String(link.manager_email));
    const computed = await buildSnapshotForScope(scope, dateRange);
    return {
      token: String(link.token),
      vanitySlug: String(link.vanity_slug || ""),
      scopeKey: scope.scopeKey,
      managerEmail: scope.managerEmail,
      managerName: scope.managerName,
      updatedAt: dateRange.endIso,
      dateRange: { startDate: dateRange.startDate, endDate: dateRange.endDate, isRealtime: false },
      totals: computed.totals,
      top5: computed.top5,
      bottom5: computed.bottom5,
      fullRank: computed.fullRank
    };
  }
  const { rows: snapshotRows } = await pool.query(
    `SELECT scope_key, manager_email, manager_name, updated_at, totals_json, top5_json, bottom5_json, full_rank_json
     FROM hierarchy_live_snapshots
     WHERE scope_key = $1
     LIMIT 1`,
    [String(link.scope_key)]
  );
  if (snapshotRows.length === 0) {
    await rebuildSnapshotForManager(String(link.manager_email));
    return getSnapshotByToken(trimmed, options);
  }
  const snapshot = snapshotRows[0];
  return {
    token: String(link.token),
    vanitySlug: String(link.vanity_slug || ""),
    scopeKey: String(snapshot.scope_key),
    managerEmail: String(snapshot.manager_email),
    managerName: String(snapshot.manager_name || link.manager_name || ""),
    updatedAt: new Date(snapshot.updated_at).toISOString(),
    dateRange: { startDate: dateRange.startDate, endDate: dateRange.endDate, isRealtime: true },
    totals: snapshot.totals_json || {},
    top5: snapshot.top5_json || [],
    bottom5: snapshot.bottom5_json || [],
    fullRank: snapshot.full_rank_json || []
  };
}
async function seedChrisLiveLink() {
  const link = await getOrCreatePermanentHierarchyLink("chrislafond@aoglobelife.com");
  await rebuildSnapshotForManager(link.managerEmail);
  return { token: link.token, urlPath: `/${link.vanitySlug || link.token}` };
}
var tablesReady;
var init_public_live_card_service = __esm({
  "server/public-live-card-service.ts"() {
    "use strict";
    init_db();
    init_supabase();
    tablesReady = false;
  }
});

// server/live-call-board-stats-scheduler.ts
var live_call_board_stats_scheduler_exports = {};
__export(live_call_board_stats_scheduler_exports, {
  liveCallBoardStatsScheduler: () => liveCallBoardStatsScheduler
});
import * as cron from "node-cron";
var LiveCallBoardStatsScheduler, liveCallBoardStatsScheduler;
var init_live_call_board_stats_scheduler = __esm({
  "server/live-call-board-stats-scheduler.ts"() {
    "use strict";
    init_supabase();
    init_public_live_card_service();
    LiveCallBoardStatsScheduler = class {
      cronJob = null;
      midnightResetJob = null;
      liveUpdateInterval = null;
      isRunning = false;
      lastRunTime = null;
      lastProcessedDate = null;
      // Track last PST date processed
      lastResetDate = null;
      // Track last PST date we reset stats
      recruitRpcFailed = false;
      // suppress repeated RPC errors once function is known-missing
      /**
       * Start the scheduler
       */
      start() {
        if (!supabaseAdmin) {
          console.warn("\u26A0\uFE0F Live Call Board Stats Scheduler disabled - Supabase admin client not configured");
          return;
        }
        if (this.cronJob) {
          console.log("\u26A0\uFE0F Live Call Board Stats Scheduler already running");
          return;
        }
        console.log("\u{1F504} Starting Live Call Board Stats Scheduler...");
        this.updateStats().catch((error) => {
          console.error("\u274C Initial live call board stats update failed:", error);
        });
        this.cronJob = cron.schedule("*/1 * * * *", async () => {
          if (!this.isRunning) {
            await this.updateStats();
          } else {
            console.log("\u23F3 Live call board stats update skipped - previous update still running");
          }
        });
        this.liveUpdateInterval = setInterval(async () => {
          if (!this.isRunning) {
            await this.updateStats();
          }
        }, 3e4);
        this.midnightResetJob = cron.schedule("* 7,8 * * *", async () => {
          const now = /* @__PURE__ */ new Date();
          const pstTime = now.toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          });
          const pstDate = now.toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
          const [pstHour, pstMinute] = pstTime.split(":").map(Number);
          if (pstHour === 0 && pstMinute === 0 && this.lastResetDate !== pstDate) {
            console.log("\u{1F504} Midnight PST reset: Resetting all outbound and recruit stats to 0...");
            console.log(`   Current PST time: ${pstTime}`);
            console.log(`   Current PST date: ${pstDate}`);
            this.lastResetDate = pstDate;
            await this.resetAllStats();
          }
        });
        console.log("\u2705 Live Call Board Stats Scheduler started");
        console.log("   \u{1F4CA} Update frequency: Every 30 seconds (setInterval) + Every 1 minute (cron)");
        console.log("   \u{1F4CA} DIALED: Counting from twilio_call_logs (calls with duration > 0)");
        console.log("   \u{1F4CA} REACHED: Counting from twilio_call_logs (calls with duration >= 50s)");
        console.log("   \u{1F4CA} INSTANT_PRESENTATION: Counting from agent_dial_metrics (event_type = instant_presentation)");
        console.log("   \u{1F4CA} BOOKED: Counting from agent_dial_metrics ONLY");
        console.log("   \u{1F504} Midnight PST reset scheduled - will reset stats at 12:00 AM PST (8:00 AM UTC)");
      }
      /**
       * Stop the scheduler
       */
      stop() {
        if (this.cronJob) {
          this.cronJob.stop();
          this.cronJob = null;
        }
        if (this.midnightResetJob) {
          this.midnightResetJob.stop();
          this.midnightResetJob = null;
        }
        if (this.liveUpdateInterval) {
          clearInterval(this.liveUpdateInterval);
          this.liveUpdateInterval = null;
        }
        console.log("\u{1F6D1} Live Call Board Stats Scheduler stopped");
      }
      /**
       * Reset all stats and recalculate from scratch (called at midnight PST)
       * This recalculates today's stats from agent_dial_metrics and twilio_call_logs
       */
      async resetAllStats() {
        try {
          if (!supabaseAdmin) {
            console.error("\u274C Cannot reset stats - Supabase admin client not configured");
            return;
          }
          const resetTime = (/* @__PURE__ */ new Date()).toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
            dateStyle: "full",
            timeStyle: "long"
          });
          console.log(`\u{1F504} Midnight PST reset: Recalculating all stats from scratch for new day...`);
          console.log(`   Reset time: ${resetTime} PST`);
          const { error: resetError } = await supabaseAdmin.from("live_call_boardt").update({
            today_dialed: 0,
            today_reached: 0,
            today_booked: 0,
            today_instant_presentation: 0,
            today_presentations: 0,
            today_sales: 0,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).neq("agent_email", "");
          if (resetError) {
            console.error("\u274C Failed to reset outbound stats at midnight:", resetError);
            return;
          }
          const { error: recruitResetError } = await supabaseAdmin.from("live_call_boardt_recruit").update({
            today_dialed: 0,
            today_reached: 0,
            today_booked: 0,
            today_connects: 0,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).neq("agent_email", "");
          if (recruitResetError) {
            console.error("\u274C Failed to reset recruit stats at midnight:", recruitResetError);
          }
          console.log("\u2705 All stats reset to 0 for new day");
          this.lastProcessedDate = null;
          console.log("\u{1F504} Recalculating stats from agent_dial_metrics and twilio_call_logs for new day...");
          await this.updateStats();
          console.log("\u2705 Midnight reset complete - stats recalculated for new day");
        } catch (error) {
          console.error("\u274C Error resetting stats at midnight:", error);
        }
      }
      /**
       * Manually trigger an update (can be called from API or other services)
       */
      async triggerUpdate() {
        if (this.isRunning) {
          console.log("\u23F3 Live call board stats update already in progress, skipping manual trigger");
          return;
        }
        await this.updateStats();
      }
      /**
       * Manually trigger a reset (for testing midnight reset)
       */
      async triggerReset() {
        console.log("\u{1F504} Manual reset triggered - resetting all outbound and recruit stats to 0...");
        await this.resetAllStats();
      }
      /**
       * Update live call board stats from agent_dial_metrics
       * CRITICAL: Now uses SQL function which has correct logic (call_status='completed' for reached)
       * and GREATEST protection to prevent resets
       */
      async updateStats() {
        if (this.isRunning) {
          return;
        }
        this.isRunning = true;
        const startTime = Date.now();
        try {
          console.log("\u{1F504} Updating live call board stats via SQL function...");
          console.log("\u{1F4CA} DIALED: Counting from twilio_call_logs (calls with duration >= 1s OR answered)");
          console.log("\u{1F4CA} REACHED: Counting from agent_dial_metrics (event_type = reach)");
          console.log("\u{1F4CA} INSTANT_PRESENTATION: Counting from agent_dial_metrics (event_type = instant_presentation)");
          console.log("\u{1F4CA} BOOKED: Counting from agent_dial_metrics (event_type = booked)");
          const { error: rpcError, data: rpcData } = await supabaseAdmin.rpc("update_live_call_boardt_stats_from_metrics");
          if (rpcError) {
            throw new Error(`SQL function failed: ${rpcError.message}`);
          }
          if (rpcData !== null) {
            console.log("\u2705 SQL function executed successfully");
          }
          if (!this.recruitRpcFailed) {
            console.log("\u{1F504} Updating recruit stats...");
            const { error: recruitRpcError } = await supabaseAdmin.rpc("update_live_call_boardt_recruit_stats_all");
            if (recruitRpcError) {
              console.error("\u274C Recruit stats update failed (will suppress further errors until restart):", recruitRpcError);
              this.recruitRpcFailed = true;
            } else {
              console.log("\u2705 Recruit stats updated");
              const { error: connectsRpcError } = await supabaseAdmin.rpc("update_live_call_boardt_recruit_connects");
              if (connectsRpcError) {
                console.error("\u274C Recruit connects update failed (will suppress further errors until restart):", connectsRpcError);
                this.recruitRpcFailed = true;
              } else {
                console.log("\u2705 Recruit connects updated");
              }
            }
          }
          const { data: sampleData, error: sampleError } = await supabaseAdmin.from("live_call_boardt").select("agent_email, today_dialed, today_reached, today_booked, updated_at").order("updated_at", { ascending: false }).limit(5);
          if (!sampleError && sampleData && sampleData.length > 0) {
            console.log(`\u2705 Verified: ${sampleData.length} sample records updated`);
            const latestUpdate = sampleData[0];
            console.log(`   Latest: ${latestUpdate.agent_email} - Dialed: ${latestUpdate.today_dialed}, Reached: ${latestUpdate.today_reached}, Booked: ${latestUpdate.today_booked}`);
          }
          const duration = Date.now() - startTime;
          this.lastRunTime = /* @__PURE__ */ new Date();
          await rebuildAllLiveSnapshots();
          console.log(`\u2705 Live call board stats updated via SQL function in ${duration}ms`);
          console.log(`   \u{1F4CA} DIALED/REACHED: From twilio_call_logs | INSTANT_PRESENTATION: From masterlead | BOOKED: From agent_dial_metrics`);
        } catch (error) {
          console.error("\u274C Error updating live call board stats:", error);
          this.lastRunTime = /* @__PURE__ */ new Date();
        } finally {
          this.isRunning = false;
        }
      }
      /**
       * Count distinct phone numbers for an agent by event type
       * @deprecated No longer used - SQL function handles all calculations
       */
      countDistinctPhones(metrics, eventType) {
        const phones = /* @__PURE__ */ new Set();
        for (const metric of metrics) {
          if (metric.event_type === eventType && metric.lead_phone) {
            phones.add(metric.lead_phone);
          }
        }
        return phones.size;
      }
      /**
       * Get today's EST date range (no longer used - SQL function handles timezone)
       * @deprecated Use SQL function get_today_est_range() instead
       */
      async getTodayPSTRange() {
        const now = /* @__PURE__ */ new Date();
        const pstYear = parseInt(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles", year: "numeric" }));
        const pstMonth = parseInt(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "2-digit" }));
        const pstDay = parseInt(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles", day: "2-digit" }));
        const todayDate = `${pstYear}-${String(pstMonth).padStart(2, "0")}-${String(pstDay).padStart(2, "0")}`;
        const pstMidnightString = `${pstYear}-${String(pstMonth).padStart(2, "0")}-${String(pstDay).padStart(2, "0")}T00:00:00`;
        let utcTodayStart = /* @__PURE__ */ new Date(`${pstMidnightString}-08:00`);
        const verifyPST = utcTodayStart.toLocaleString("en-US", {
          timeZone: "America/Los_Angeles",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        });
        const verifyDate = verifyPST.replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
        const expectedDate = `${pstYear}-${String(pstMonth).padStart(2, "0")}-${String(pstDay).padStart(2, "0")}`;
        if (verifyDate !== expectedDate) {
          utcTodayStart = /* @__PURE__ */ new Date(`${pstMidnightString}-07:00`);
        }
        const utcTodayEnd = new Date(utcTodayStart.getTime() + 24 * 60 * 60 * 1e3);
        return {
          todayStart: utcTodayStart.toISOString(),
          todayEnd: utcTodayEnd.toISOString(),
          todayDate
        };
      }
      /**
       * Get scheduler status
       */
      getStatus() {
        return {
          isRunning: this.isRunning,
          lastRunTime: this.lastRunTime,
          cronJobActive: this.cronJob !== null,
          midnightResetActive: this.midnightResetJob !== null
        };
      }
    };
    liveCallBoardStatsScheduler = new LiveCallBoardStatsScheduler();
  }
});

// server/vdp-credit-enforcer.ts
var vdp_credit_enforcer_exports = {};
__export(vdp_credit_enforcer_exports, {
  vdpCreditEnforcer: () => vdpCreditEnforcer
});
async function enforceVDPCredits() {
  console.log(`
\u{1F4B0} [${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Checking VDP credit limits...`);
  try {
    const { data: activeAgents, error: agentsError } = await supabaseAdmin.from("customers").select("company_email, VDPACTIVE, associate_id").eq("VDPACTIVE", "ACTIVE").not("company_email", "is", null);
    if (agentsError) {
      console.error("\u274C Error fetching active VDP agents:", agentsError);
      return;
    }
    if (!activeAgents || activeAgents.length === 0) {
      console.log("\u2705 No active VDP agents to check");
      return;
    }
    console.log(`\u{1F4CA} Checking ${activeAgents.length} active VDP agents...`);
    let disabledCount = 0;
    let checkedCount = 0;
    for (const agent of activeAgents) {
      if (!agent.company_email) continue;
      const { data: credits } = await supabaseAdmin.from("user_credits").select("credits_remaining").eq("email", agent.company_email.trim()).maybeSingle();
      const creditsRemaining = credits?.credits_remaining || 0;
      checkedCount++;
      if (creditsRemaining < 0) {
        console.log(`\u{1F6AB} Disabling VDP for ${agent.company_email} (${creditsRemaining} credits - NEGATIVE)`);
        await supabaseAdmin.from("customers").update({ VDPACTIVE: "INACTIVE" }).eq("company_email", agent.company_email);
        disabledCount++;
      }
    }
    console.log(`
\u{1F4CA} VDP Credit Enforcement Summary:`);
    console.log(`  \u2705 Checked: ${checkedCount} agents`);
    console.log(`  \u{1F6AB} Disabled: ${disabledCount} agents`);
    console.log(`  \u{1F4B0} Credit limit: ${CREDIT_LIMIT}`);
  } catch (error) {
    console.error("\u274C VDP credit enforcement error:", error);
  }
}
var CHECK_INTERVAL, CREDIT_LIMIT, enforcerInterval, vdpCreditEnforcer;
var init_vdp_credit_enforcer = __esm({
  "server/vdp-credit-enforcer.ts"() {
    "use strict";
    init_supabase();
    CHECK_INTERVAL = 10 * 60 * 1e3;
    CREDIT_LIMIT = 0;
    enforcerInterval = null;
    vdpCreditEnforcer = {
      start: () => {
        if (enforcerInterval) {
          console.log("\u26A0\uFE0F VDP credit enforcer already running");
          return;
        }
        console.log("\u23F1\uFE0F Starting VDP credit enforcer (checks every 10 minutes)...");
        enforceVDPCredits();
        enforcerInterval = setInterval(enforceVDPCredits, CHECK_INTERVAL);
      },
      stop: () => {
        if (enforcerInterval) {
          clearInterval(enforcerInterval);
          enforcerInterval = null;
          console.log("\u{1F6D1} VDP credit enforcer stopped");
        }
      }
    };
  }
});

// server/agent-availability-tracker.ts
var agent_availability_tracker_exports = {};
__export(agent_availability_tracker_exports, {
  agentAvailabilityTracker: () => agentAvailabilityTracker
});
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

// server/verification-daily-report.ts
var verification_daily_report_exports = {};
__export(verification_daily_report_exports, {
  startDailyReportScheduler: () => startDailyReportScheduler
});
import cron2 from "node-cron";
import formData from "form-data";
import Mailgun from "mailgun.js";
async function generateDailyReport(daysBack = 0) {
  console.log("\n[AO Precheck Report] Generating report...");
  try {
    const today = /* @__PURE__ */ new Date();
    let startDate;
    if (daysBack > 0) {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - daysBack);
      startDate.setHours(0, 0, 0, 0);
      console.log(`\u{1F4C5} Report mode: Last ${daysBack} days`);
    } else {
      const dayOfWeek = today.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(today);
      startDate.setDate(today.getDate() - daysFromMonday);
      startDate.setHours(0, 0, 0, 0);
      console.log(`\u{1F4C5} Report mode: Current week (Monday to today)`);
    }
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    console.log(`\u{1F4C5} Report range: ${startDate.toISOString()} to ${endOfDay.toISOString()}`);
    const { data: sessions, error } = await supabaseAdmin.from("verification_sessions").select("*, premium").gte("created_at", startDate.toISOString()).lte("created_at", endOfDay.toISOString()).or("session_type.is.null,session_type.neq.demo").order("created_at", { ascending: true });
    if (error) {
      console.error("\u274C Database error:", error);
      return;
    }
    console.log(`\u2705 Fetched ${sessions?.length || 0} sessions`);
    const seenPhones = /* @__PURE__ */ new Set();
    const uniqueSessions = sessions.filter((session) => {
      if (!session.phone) return false;
      const cleanPhone = session.phone.replace(/\D/g, "");
      if (!cleanPhone || seenPhones.has(cleanPhone)) {
        return false;
      }
      seenPhones.add(cleanPhone);
      return true;
    });
    console.log(`\u2705 After deduplication by phone: ${uniqueSessions.length} unique sessions`);
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dayStats = daysOfWeek.map((day) => ({
      day,
      completedPhone: 0,
      completedZoom: 0,
      total: 0
    }));
    const uniqueAgents = /* @__PURE__ */ new Set();
    uniqueSessions.forEach((session) => {
      const sessionDate = new Date(session.created_at);
      const sessionDay = sessionDate.getDay();
      const dayIndex = sessionDay === 0 ? 6 : sessionDay - 1;
      if (session.verification_method === "phone") {
        dayStats[dayIndex].completedPhone++;
      } else if (session.verification_method === "zoom") {
        dayStats[dayIndex].completedZoom++;
      }
      dayStats[dayIndex].total++;
      const agentId = session.agent_email || session.agent_first_name && session.agent_last_name ? `${session.agent_first_name} ${session.agent_last_name}`.trim().toLowerCase() : null;
      if (agentId) {
        uniqueAgents.add(agentId);
      }
    });
    const totalCompletedPhone = dayStats.reduce((sum2, day) => sum2 + day.completedPhone, 0);
    const totalCompletedZoom = dayStats.reduce((sum2, day) => sum2 + day.completedZoom, 0);
    const totalApplications = totalCompletedPhone + totalCompletedZoom;
    const totalUniqueAgents = uniqueAgents.size;
    console.log(`
\u{1F4CA} TOTALS:`);
    console.log(`   Completed Phone: ${totalCompletedPhone}`);
    console.log(`   Completed Zoom: ${totalCompletedZoom}`);
    console.log(`   Total Sessions: ${totalApplications}`);
    console.log(`   Unique Agents: ${totalUniqueAgents}`);
    const html = generateEmailHTML(dayStats, {
      totalCompletedPhone,
      totalCompletedZoom,
      totalApplications,
      totalUniqueAgents,
      reportDate: today.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    });
    if (process.argv[1]?.includes("verification-daily-report")) {
      const fs4 = await import("fs");
      const path4 = await import("path");
      const outputPath = path4.join(process.cwd(), "test-verification-report.html");
      fs4.writeFileSync(outputPath, html);
      console.log(`\u{1F4C4} Report HTML saved to: ${outputPath}`);
    }
    await sendEmail(html);
    console.log("\u2705 Daily report sent successfully\n");
  } catch (error) {
    console.error("\u274C Error generating daily report:", error);
  }
}
function generateEmailHTML(dayStats, totals) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f7fa;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: 600;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .content {
      padding: 30px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      padding: 20px;
      border-radius: 10px;
      color: white;
      text-align: center;
    }
    .stat-card.phone {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    .stat-card.zoom {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }
    .stat-card.agents {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }
    .stat-card h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      text-transform: uppercase;
      opacity: 0.9;
      font-weight: 500;
    }
    .stat-card .number {
      font-size: 36px;
      font-weight: 700;
      margin: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th {
      background: #667eea;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:hover {
      background-color: #f7fafc;
    }
    .total-row {
      background: #edf2f7;
      font-weight: 600;
    }
    .phone-col {
      color: #3182ce;
      font-weight: 600;
    }
    .zoom-col {
      color: #38a169;
      font-weight: 600;
    }
    .total-col {
      color: #805ad5;
      font-weight: 600;
    }
    .footer {
      background: #f7fafc;
      padding: 20px;
      text-align: center;
      color: #718096;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AO Precheck Report</h1>
      <p>${totals.reportDate}</p>
    </div>
    
    <div class="content">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Sessions</h3>
          <div class="number">${totals.totalApplications}</div>
        </div>
        <div class="stat-card phone">
          <h3>Completed Phone</h3>
          <div class="number">${totals.totalCompletedPhone}</div>
        </div>
        <div class="stat-card zoom">
          <h3>Completed Zoom</h3>
          <div class="number">${totals.totalCompletedZoom}</div>
        </div>
        <div class="stat-card agents">
          <h3>Unique Agents</h3>
          <div class="number">${totals.totalUniqueAgents}</div>
        </div>
      </div>
      
      <h2 style="color: #2d3748; margin-bottom: 15px;">Weekly Breakdown (Monday - Sunday)</h2>
      
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Completed Phone</th>
            <th>Completed Zoom</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${dayStats.map((day) => `
            <tr>
              <td><strong>${day.day}</strong></td>
              <td class="phone-col">${day.completedPhone}</td>
              <td class="zoom-col">${day.completedZoom}</td>
              <td class="total-col">${day.total}</td>
            </tr>
          `).join("")}
          <tr class="total-row">
            <td><strong>WEEKLY TOTALS</strong></td>
            <td class="phone-col">${totals.totalCompletedPhone}</td>
            <td class="zoom-col">${totals.totalCompletedZoom}</td>
            <td class="total-col">${totals.totalApplications}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <p>This report excludes duplicate clients and demo sessions.</p>
      <p>Generated automatically by AO Intelligence \u2022 ${(/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PST</p>
    </div>
  </div>
</body>
</html>
  `;
}
async function sendEmail(html) {
  const mailgun2 = new Mailgun(formData);
  const mg2 = mailgun2.client({ username: "api", key: MAILGUN_API_KEY, url: "https://api.mailgun.net" });
  try {
    const result = await mg2.messages.create(MAILGUN_DOMAIN, {
      from: "AO Intelligence Reports <noreply@mg.connectnow.one>",
      to: ["michaelmandella@aoglobelife.com"],
      subject: `AO Precheck Report - ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US")}`,
      html
    });
    console.log("\u2705 Email sent via Mailgun:", result);
  } catch (error) {
    console.error("\u274C Mailgun error:", error);
  }
}
function startDailyReportScheduler() {
  console.log("[AO Precheck] Starting report scheduler...");
  console.log("[AO Precheck] Report will be sent daily at 9:00 AM PST (17:00 UTC)");
  cron2.schedule("0 17 * * *", () => {
    console.log("\n[AO Precheck] Scheduled task triggered");
    generateDailyReport();
  }, {
    timezone: "America/Los_Angeles"
  });
  console.log("[AO Precheck] Scheduler started successfully\n");
}
var MAILGUN_API_KEY, MAILGUN_DOMAIN;
var init_verification_daily_report = __esm({
  "server/verification-daily-report.ts"() {
    "use strict";
    init_supabase();
    MAILGUN_API_KEY = "aa22ca853877ae0e08f8cca8f345059e-653fadca-9577b24a";
    MAILGUN_DOMAIN = "mg.connectnow.one";
    if (process.argv[1]?.includes("verification-daily-report")) {
      console.log("\u{1F9EA} Running in test mode - generating report immediately...");
      const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
      const daysBack = daysArg ? parseInt(daysArg.split("=")[1]) : 0;
      if (daysBack > 0) {
        console.log(`\u{1F4C5} Generating report for last ${daysBack} days`);
      } else {
        console.log(`\u{1F4C5} Generating report for current week`);
      }
      generateDailyReport(daysBack).then(() => {
        console.log("\u2705 Test report complete");
        process.exit(0);
      }).catch((error) => {
        console.error("\u274C Test report failed:", error);
        process.exit(1);
      });
    }
  }
});

// server/ao-intel-active-users-report.ts
var ao_intel_active_users_report_exports = {};
__export(ao_intel_active_users_report_exports, {
  sendAOIntelActiveUsersReport: () => sendAOIntelActiveUsersReport
});
import Mailgun2 from "mailgun.js";
import formData2 from "form-data";
import { createClient as createClient2 } from "@supabase/supabase-js";
async function buildReport() {
  let allCustomers = [];
  const pageSize = 1e3;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin2.from("customers").select("company_email, personal_email, first_name, last_name, market, states, CCPRO, AOICONNECT").range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allCustomers = allCustomers.concat(data);
    if (data.length < pageSize) break;
  }
  const { data: liveStatus } = await supabaseAdmin2.from("agent_live_call_status").select("agent_email, status, last_heartbeat_at");
  const liveMap = new Map((liveStatus || []).map((r) => [r.agent_email?.toLowerCase(), r]));
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const thirtyDaysAgo = /* @__PURE__ */ new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const { rows: statsRows } = await pool.query(`
    SELECT
      agent_email,
      SUM(dials) FILTER (WHERE stat_date::date = $1::date)::int AS dials_today,
      SUM(reached) FILTER (WHERE stat_date::date = $1::date)::int AS reached_today,
      SUM(booked) FILTER (WHERE stat_date::date = $1::date)::int AS booked_today,
      SUM(dials) FILTER (WHERE stat_date::date >= $2::date)::int AS dials_30d,
      MAX(stat_date) AS last_active_date
    FROM agent_daily_stats
    WHERE stat_date::date >= $2::date
    GROUP BY agent_email
  `, [today, thirtyDaysAgoStr]);
  const statsMap = new Map(statsRows.map((r) => [r.agent_email?.toLowerCase(), r]));
  const rows = [];
  const seen = /* @__PURE__ */ new Set();
  for (const c of allCustomers) {
    const email = String(c.company_email || c.personal_email || "").toLowerCase().trim();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const live = liveMap.get(email);
    const stats = statsMap.get(email);
    const ccpro = c.CCPRO === true || c.CCPRO === "true";
    const aoiconnect = String(c.AOICONNECT || "").toUpperCase();
    const dials30d = Number(stats?.dials_30d || 0);
    const lastHeartbeat = live?.last_heartbeat_at || null;
    if (!ccpro && dials30d === 0) continue;
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || email.split("@")[0];
    const market = Array.isArray(c.market) ? c.market.join(", ") : String(c.market || "");
    const states = Array.isArray(c.states) ? c.states.join(", ") : String(c.states || "");
    rows.push({
      email,
      name,
      market,
      states,
      ccpro,
      aoiconnect,
      last_heartbeat: lastHeartbeat,
      dials_today: Number(stats?.dials_today || 0),
      dials_30d,
      reached_today: Number(stats?.reached_today || 0),
      booked_today: Number(stats?.booked_today || 0),
      last_login: lastHeartbeat
    });
  }
  rows.sort((a, b) => {
    if (a.ccpro && !b.ccpro) return -1;
    if (!a.ccpro && b.ccpro) return 1;
    return b.dials_30d - a.dials_30d;
  });
  return rows;
}
function buildCSV(rows) {
  const headers = ["Name", "Email", "Market", "States", "CCPro Active", "AOI Connect", "Dials Today", "Reached Today", "Booked Today", "Dials (30d)", "Last Heartbeat"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      `"${r.name}"`,
      r.email,
      `"${r.market}"`,
      `"${r.states}"`,
      r.ccpro ? "Yes" : "No",
      r.aoiconnect,
      r.dials_today,
      r.reached_today,
      r.booked_today,
      r.dials_30d,
      r.last_heartbeat ? new Date(r.last_heartbeat).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) : ""
    ].join(","));
  }
  return lines.join("\n");
}
function buildHTML(rows, reportDate) {
  const ccproCount = rows.filter((r) => r.ccpro).length;
  const totalDials = rows.reduce((s, r) => s + r.dials_today, 0);
  const totalReached = rows.reduce((s, r) => s + r.reached_today, 0);
  const totalBooked = rows.reduce((s, r) => s + r.booked_today, 0);
  const tableRows = rows.map((r) => `
    <tr style="background:${r.ccpro ? "#f0fff4" : "#fff"}">
      <td>${r.name}</td>
      <td>${r.email}</td>
      <td>${r.market}</td>
      <td style="font-size:11px">${r.states}</td>
      <td style="text-align:center;color:${r.ccpro ? "green" : "#999"};font-weight:bold">${r.ccpro ? "\u2713" : "\u2014"}</td>
      <td style="text-align:center">${r.aoiconnect}</td>
      <td style="text-align:center">${r.dials_today}</td>
      <td style="text-align:center">${r.reached_today}</td>
      <td style="text-align:center">${r.booked_today}</td>
      <td style="text-align:center">${r.dials_30d}</td>
      <td style="font-size:11px;color:#666">${r.last_heartbeat ? new Date(r.last_heartbeat).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "\u2014"}</td>
    </tr>`).join("");
  return `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; }
  h2 { color: #1a1a2e; }
  .summary { background: #1a1a2e; color: white; padding: 12px 20px; border-radius: 6px; display: inline-flex; gap: 30px; margin-bottom: 20px; }
  .stat { text-align: center; }
  .stat .val { font-size: 22px; font-weight: bold; }
  .stat .lbl { font-size: 11px; opacity: 0.8; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th { background: #1a1a2e; color: white; padding: 7px 10px; text-align: left; }
  td { padding: 5px 10px; border-bottom: 1px solid #eee; }
  tr:hover td { background: #f9f9f9; }
</style></head>
<body>
<h2>AO Intel \u2014 Active Users Report</h2>
<p style="color:#666">${reportDate} &nbsp;|&nbsp; Pacific Time</p>
<div class="summary">
  <div class="stat"><div class="val">${rows.length}</div><div class="lbl">Total Users</div></div>
  <div class="stat"><div class="val">${ccproCount}</div><div class="lbl">CCPro Active</div></div>
  <div class="stat"><div class="val">${totalDials.toLocaleString()}</div><div class="lbl">Dials Today</div></div>
  <div class="stat"><div class="val">${totalReached.toLocaleString()}</div><div class="lbl">Reached Today</div></div>
  <div class="stat"><div class="val">${totalBooked}</div><div class="lbl">Booked Today</div></div>
</div>
<table>
  <thead><tr>
    <th>Name</th><th>Email</th><th>Market</th><th>States</th>
    <th>CCPro</th><th>AOI Connect</th><th>Dials Today</th><th>Reached</th><th>Booked</th><th>Dials 30d</th><th>Last Seen</th>
  </tr></thead>
  <tbody>${tableRows}</tbody>
</table>
</body></html>`;
}
async function sendAOIntelActiveUsersReport() {
  console.log("[AOIntel] Building active users report...");
  const rows = await buildReport();
  const reportDate = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const csv = buildCSV(rows);
  const html = buildHTML(rows, reportDate);
  const mg2 = new Mailgun2(formData2);
  const client = mg2.client({ username: "api", key: MAILGUN_API_KEY2, url: "https://api.mailgun.net" });
  await client.messages.create(MAILGUN_DOMAIN2, {
    from: `AO Intel <noreply@${MAILGUN_DOMAIN2}>`,
    to: REPORT_TO,
    subject: `AO Intel - Active Users \u2014 ${reportDate}`,
    html,
    attachment: [{ filename: `ao-intel-active-users-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`, data: Buffer.from(csv), contentType: "text/csv" }]
  });
  console.log(`[AOIntel] Report sent to ${REPORT_TO.join(", ")} \u2014 ${rows.length} agents, ${rows.filter((r) => r.ccpro).length} CCPro`);
}
var MAILGUN_API_KEY2, MAILGUN_DOMAIN2, REPORT_TO, supabaseAdmin2;
var init_ao_intel_active_users_report = __esm({
  "server/ao-intel-active-users-report.ts"() {
    "use strict";
    init_db();
    init_hardcoded_config();
    MAILGUN_API_KEY2 = "aa22ca853877ae0e08f8cca8f345059e-653fadca-9577b24a";
    MAILGUN_DOMAIN2 = "mg.connectnow.one";
    REPORT_TO = [
      "michaelmandella@aoglobelife.com",
      "CameronSims@aoglobelife.com",
      "richiealtig@aoglobelife.com",
      "mmandella@ailpdx.com"
    ];
    supabaseAdmin2 = createClient2(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
});

// server/recruit-vdp-poller.ts
var recruit_vdp_poller_exports = {};
__export(recruit_vdp_poller_exports, {
  recruitVDPPoller: () => recruitVDPPoller
});
var RecruitVDPPoller, recruitVDPPoller;
var init_recruit_vdp_poller = __esm({
  "server/recruit-vdp-poller.ts"() {
    "use strict";
    init_supabase();
    RecruitVDPPoller = class {
      isRunning = false;
      pollInterval = 1e4;
      // 10 seconds
      processedIds = /* @__PURE__ */ new Set();
      processedInteractionKeys = /* @__PURE__ */ new Set();
      lastPollTime = null;
      start() {
        if (this.isRunning) {
          console.log("\u26A0\uFE0F Recruit VDP poller already running");
          return;
        }
        this.isRunning = true;
        console.log("\u{1F3AF} Starting Recruit VDP poller - checking vdp_calls_BLASTPICK table every 10 seconds");
        this.poll();
      }
      stop() {
        this.isRunning = false;
        console.log("\u{1F6D1} Recruit VDP poller stopped");
      }
      async poll() {
        if (!this.isRunning) return;
        try {
          await this.checkForNewRecruitCalls();
        } catch (error) {
          console.error("\u274C Recruit VDP poller error:", error);
        }
        setTimeout(() => this.poll(), this.pollInterval);
      }
      async checkForNewRecruitCalls() {
        try {
          console.log(`\u{1F50D} Polling recruit interactions (BLAST + Taalk no-transfer rules)...`);
          const { data: blastRows, error: blastError } = await supabaseAdmin.from("vdp_calls_BLASTPICK").select("*").ilike("market", "%aorecruit%").order("time", { ascending: false }).limit(300);
          if (blastError) {
            console.error("\u274C Error querying vdp_calls_BLASTPICK:", blastError);
            return;
          }
          const blastRecords = blastRows || [];
          const transferLikeEvents = /* @__PURE__ */ new Set(["PICK_UP", "PICKED", "TRANSFER", "CONNECT"]);
          const pickupEvents = blastRecords.filter((r) => transferLikeEvents.has(String(r.event || "").toUpperCase()));
          const pickupTimesByPhone = /* @__PURE__ */ new Map();
          for (const pickup of pickupEvents) {
            const phone = this.normalizePhone(pickup.phone);
            const pickupTime = this.parseTimestamp(pickup.time);
            if (!phone || !pickupTime) continue;
            const list = pickupTimesByPhone.get(phone) || [];
            list.push(pickupTime);
            pickupTimesByPhone.set(phone, list);
          }
          const candidateQueue = [];
          const sessions = /* @__PURE__ */ new Map();
          for (const row of blastRecords) {
            const eventName = String(row.event || "").toUpperCase();
            const phone = this.normalizePhone(row.phone);
            const sessionKey = String(row.sessionid || row.leadid || `${phone}:${row.agent || "unknown"}`).trim();
            if (!sessionKey) continue;
            const bucket = sessions.get(sessionKey) || { hasPickup: false };
            if (transferLikeEvents.has(eventName)) {
              bucket.hasPickup = true;
            }
            if (eventName === "BLASTER" && !bucket.latestBlaster) {
              bucket.latestBlaster = row;
            }
            sessions.set(sessionKey, bucket);
          }
          for (const [sessionKey, bucket] of sessions.entries()) {
            if (!bucket.hasPickup && bucket.latestBlaster) {
              candidateQueue.push({
                ...bucket.latestBlaster,
                interactionKey: `blast-no-pickup:${sessionKey}`,
                sourceType: "blast_no_pickup",
                eligibilityReason: "BLASTER sequence had no PICK_UP (never transferred)"
              });
            }
          }
          const { data: vdpRows, error: vdpError } = await supabaseAdmin.from("vdp_calls").select("id,event,phone,firstName,lastName,leadid,market,agent,duration,time,mga,rga").ilike("market", "%aorecruit%").in("event", ["END", "end"]).gte("duration", 60).order("time", { ascending: false }).limit(200);
          if (vdpError) {
            console.warn("\u26A0\uFE0F Failed to query vdp_calls for recruit no-transfer detection:", vdpError.message);
          } else {
            for (const row of vdpRows || []) {
              const phone = this.normalizePhone(row.phone || "");
              const endedAt = this.parseTimestamp(row.time || "");
              if (!phone || !endedAt) continue;
              if (this.hasMatchingPickupWithinWindow(phone, endedAt, pickupTimesByPhone, 10 * 60 * 1e3)) {
                continue;
              }
              const interactionKey = `taalk-no-transfer:${row.id || `${phone}:${row.time || ""}`}`;
              candidateQueue.push({
                id: Number(row.id || 0),
                market: row.market || "aorecruit",
                agent: String(row.agent || ""),
                firstName: String(row.firstName || "Unknown"),
                lastName: String(row.lastName || ""),
                phone: row.phone || "",
                event: String(row.event || "END"),
                time: row.time || (/* @__PURE__ */ new Date()).toISOString(),
                sessionid: String(row.leadid || row.id || `${phone}-${Date.now()}`),
                leadid: row.leadid || null,
                duration: row.duration || null,
                mga: row.mga || null,
                rga: row.rga || null,
                interactionKey,
                sourceType: "taalk_no_transfer",
                eligibilityReason: "Taalk END >=60s with no PICK_UP transfer match"
              });
            }
          }
          if (candidateQueue.length === 0) {
            console.log(`\u2139\uFE0F No eligible recruit no-transfer interactions found this cycle`);
            this.lastPollTime = /* @__PURE__ */ new Date();
            return;
          }
          console.log(`\u{1F4DE} Found ${candidateQueue.length} eligible recruit interactions this cycle`);
          console.log(`\u{1F4CA} Already processed IDs: ${this.processedIds.size}, keys: ${this.processedInteractionKeys.size}`);
          let newRecordsProcessed = 0;
          for (const record of candidateQueue) {
            if (this.processedInteractionKeys.has(record.interactionKey)) {
              continue;
            }
            if (record.id > 0 && this.processedIds.has(record.id)) {
              continue;
            }
            console.log(`
\u{1F195} ${record.sourceType} [${record.interactionKey}] ${record.firstName} ${record.lastName} (${record.phone}) - Agent: ${record.agent}`);
            console.log(`   \u21B3 Eligibility: ${record.eligibilityReason}`);
            this.processedInteractionKeys.add(record.interactionKey);
            if (record.id > 0) {
              this.processedIds.add(record.id);
            }
            newRecordsProcessed++;
            if (this.processedIds.size > 1e3) {
              const idsArray = Array.from(this.processedIds);
              this.processedIds = new Set(idsArray.slice(-500));
            }
            if (this.processedInteractionKeys.size > 4e3) {
              const keysArray = Array.from(this.processedInteractionKeys);
              this.processedInteractionKeys = new Set(keysArray.slice(-2e3));
            }
            try {
              await this.createRecruitConnection(record, record.eligibilityReason);
            } catch (error) {
              console.error(`\u274C Error processing interaction ${record.interactionKey}:`, error);
            }
          }
          if (newRecordsProcessed === 0) {
            console.log(`\u2705 No new recruit interactions to process (all already processed)`);
          } else {
            console.log(`
\u2705 Processed ${newRecordsProcessed} new recruit interactions`);
          }
          this.lastPollTime = /* @__PURE__ */ new Date();
        } catch (error) {
          console.error("\u274C Error checking for recruit calls:", error);
        }
      }
      async getAgentEmailFromAssociateId(associateId) {
        try {
          console.log(`\u{1F50D} Looking up email for associate ID: ${associateId}`);
          if (associateId === "2233111") {
            console.log(`\u2705 HARDCODED: Associate ID 2233111 = taylorermis@aoglobelife.com`);
            return "taylorermis@aoglobelife.com";
          }
          const associateIdInt = parseInt(associateId);
          if (isNaN(associateIdInt)) {
            console.log(`\u26A0\uFE0F Invalid associate ID (not a number): ${associateId}`);
            return null;
          }
          console.log(`\u{1F50D} Parsed associate ID as integer: ${associateIdInt}`);
          const { data: producer, error: producerError } = await supabaseAdmin.from("producerlist").select("company_email, associate_id").eq("associate_id", associateIdInt).maybeSingle();
          console.log(`\u{1F50D} producerlist query result for associate_id ${associateIdInt}:`, {
            found: !!producer,
            email: producer?.company_email,
            error: producerError?.code
          });
          if (producer?.company_email) {
            console.log(`\u2705 Found email in producerlist: ${producer.company_email} for associate_id ${producer.associate_id}`);
            return producer.company_email;
          }
          if (producerError && producerError.code !== "PGRST116") {
            console.log(`\u26A0\uFE0F producerlist lookup error (code: ${producerError.code}):`, producerError.message);
          }
          const { data: hierarchyRow } = await supabaseAdmin.from("agent_hierarchy").select("agent_email, agent_name, agent_associate_id").eq("agent_associate_id", associateIdInt).limit(1).maybeSingle();
          if (!hierarchyRow?.agent_email) {
            const { data: hierarchyByStr } = await supabaseAdmin.from("agent_hierarchy").select("agent_email").eq("agent_associate_id", associateId).limit(1).maybeSingle();
            if (hierarchyByStr?.agent_email) {
              console.log(`\u2705 Found email in agent_hierarchy: ${hierarchyByStr.agent_email} for agent_associate_id ${associateId}`);
              return hierarchyByStr.agent_email;
            }
          } else {
            console.log(`\u2705 Found email in agent_hierarchy: ${hierarchyRow.agent_email} for agent_associate_id ${associateId}`);
            return hierarchyRow.agent_email;
          }
          const { data: agentProfile } = await supabaseAdmin.from("agent_profiles").select("email, agent_id").eq("agent_id", associateId).maybeSingle();
          if (agentProfile?.email) {
            console.log(`\u2705 Found email in agent_profiles: ${agentProfile.email} for agent_id ${associateId}`);
            return agentProfile.email;
          }
          const { data: customer } = await supabaseAdmin.from("customers").select("company_email, personal_email, associate_id").eq("associate_id", associateIdInt).maybeSingle();
          if (customer?.company_email) {
            console.log(`\u2705 Found email in customers: ${customer.company_email} for associate_id ${associateIdInt}`);
            return customer.company_email;
          }
          if (customer?.personal_email) {
            console.log(`\u2705 Found email in customers: ${customer.personal_email} for associate_id ${associateIdInt}`);
            return customer.personal_email;
          }
          console.log(`\u26A0\uFE0F Could not find email for associate ID ${associateId} (${associateIdInt}) in producerlist, agent_profiles, or customers`);
          return null;
        } catch (error) {
          console.error(`\u274C Error looking up email for associate ID ${associateId}:`, error);
          return null;
        }
      }
      normalizePhone(phone) {
        return String(phone || "").replace(/\D/g, "").slice(-10);
      }
      parseTimestamp(value) {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return date;
      }
      hasMatchingPickupWithinWindow(normalizedPhone, callTime, pickupTimesByPhone, windowMs) {
        const pickupTimes = pickupTimesByPhone.get(normalizedPhone) || [];
        for (const pickupTime of pickupTimes) {
          const delta = Math.abs(callTime.getTime() - pickupTime.getTime());
          if (delta <= windowMs) return true;
        }
        return false;
      }
      async createRecruitConnection(record, eligibilityReason = "Recruit interaction") {
        try {
          const agentEmail = await this.getAgentEmailFromAssociateId(record.agent);
          const candidateName = `${record.firstName} ${record.lastName}` || "Unknown Candidate";
          const candidatePhone = record.phone;
          if (!agentEmail) {
          }
          const finalAgentEmail = agentEmail || `unknown-agent-${record.agent}@aoglobelife.com`;
          console.log(`\u2705 Agent email: ${finalAgentEmail} for associate ID ${record.agent} ${!agentEmail ? "(FALLBACK)" : ""}`);
          console.log(`\u{1F3AF} Processing recruit call: ${candidateName} (${candidatePhone}) \u2192 ${finalAgentEmail} (agent ID: ${record.agent})`);
          const { data: candidate, error: candidateError } = await supabaseAdmin.from("recruit_candidates").select("*").eq("phone", candidatePhone).order("created_at", { ascending: false }).limit(1).single();
          if (candidateError && candidateError.code !== "PGRST116") {
            console.error("\u274C Error looking up candidate:", candidateError);
          }
          if (!candidate) {
            console.log(`\u26A0\uFE0F No matching candidate found in recruit_candidates for phone: ${candidatePhone}`);
            console.log("\u{1F4CB} Will create connection without candidate_id");
          } else {
            console.log(`\u2705 Found matching candidate: ${candidate.first_name} ${candidate.last_name} (ID: ${candidate.id})`);
            if (candidate.ai_summary) {
              console.log(`\u{1F916} Candidate has AI summary: ${candidate.ai_summary.substring(0, 100)}...`);
            }
          }
          if (candidate) {
            console.log(`\u2705 Found existing candidate: ${candidate.first_name} ${candidate.last_name} (ID: ${candidate.id})`);
            console.log(`\u{1F4F1} Agent ${agentEmail} can view this candidate in their AO Recruit dashboard`);
            if (!candidate.ai_summary && record.sessionid) {
              console.log(`\u{1F916} Candidate missing AI summary, fetching from Taalk API for session: ${record.sessionid}`);
              try {
                const taalkApiKey2 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
                const summaryUrl = `https://api.taalk.ai/api/calls/${record.sessionid}/summary?db=michaelmandella`;
                const summaryResponse = await fetch(summaryUrl, {
                  headers: { "Authorization": `Bearer ${taalkApiKey2}` }
                });
                if (summaryResponse.ok) {
                  const summaryJson = await summaryResponse.json();
                  const fetchedSummary = summaryJson.payload?.summary || summaryJson.summary;
                  if (fetchedSummary && fetchedSummary !== null && fetchedSummary !== void 0) {
                    let aiSummaryData = null;
                    if (Array.isArray(fetchedSummary)) {
                      if (fetchedSummary.length > 0) {
                        aiSummaryData = JSON.stringify(fetchedSummary);
                      }
                    } else if (typeof fetchedSummary === "string") {
                      if (fetchedSummary.trim().length > 0) {
                        aiSummaryData = fetchedSummary;
                      }
                    } else if (typeof fetchedSummary === "object") {
                      const keys = Object.keys(fetchedSummary);
                      if (keys.length > 0) {
                        aiSummaryData = JSON.stringify(fetchedSummary);
                      }
                    }
                    if (aiSummaryData && aiSummaryData !== "[]" && aiSummaryData.trim().length > 0) {
                      console.log(`\u2705 AI Summary fetched from Taalk API (${aiSummaryData.length} chars)`);
                      const { error: updateError } = await supabaseAdmin.from("recruit_candidates").update({
                        ai_summary: aiSummaryData,
                        updated_at: (/* @__PURE__ */ new Date()).toISOString()
                      }).eq("id", candidate.id);
                      if (updateError) {
                        console.error(`\u274C Failed to update candidate with AI summary:`, updateError);
                      } else {
                        console.log(`\u2705 \u2705 \u2705 AI SUMMARY SAVED to existing candidate ${candidate.id}!`);
                      }
                    } else {
                      console.log(`\u26A0\uFE0F AI Summary is empty or invalid - not storing for candidate ${candidate.id}`);
                    }
                  } else {
                    console.log(`\u26A0\uFE0F Taalk API returned empty/null summary for session ${record.sessionid} - summary may not be ready yet`);
                  }
                } else {
                  console.log(`\u26A0\uFE0F Taalk API returned ${summaryResponse.status} for session ${record.sessionid} - summary may not be ready yet`);
                }
              } catch (error) {
                console.error(`\u274C Error fetching AI summary from Taalk API:`, error);
              }
            } else if (candidate.ai_summary) {
              console.log(`\u{1F916} AI Summary already available: ${candidate.ai_summary.substring(0, 100)}...`);
            }
          } else {
            console.log(`\u{1F195} Creating new candidate: ${candidateName} (${candidatePhone})`);
            let aiSummaryData = null;
            if (record.sessionid) {
              console.log(`\u{1F916} Fetching AI summary from Taalk API for session: ${record.sessionid}`);
              try {
                const taalkApiKey2 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
                const summaryUrl = `https://api.taalk.ai/api/calls/${record.sessionid}/summary?db=michaelmandella`;
                const summaryResponse = await fetch(summaryUrl, {
                  headers: { "Authorization": `Bearer ${taalkApiKey2}` }
                });
                if (summaryResponse.ok) {
                  const summaryJson = await summaryResponse.json();
                  const fetchedSummary = summaryJson.payload?.summary || summaryJson.summary;
                  if (fetchedSummary && fetchedSummary !== null && fetchedSummary !== void 0) {
                    if (Array.isArray(fetchedSummary)) {
                      if (fetchedSummary.length > 0) {
                        aiSummaryData = JSON.stringify(fetchedSummary);
                      }
                    } else if (typeof fetchedSummary === "string") {
                      if (fetchedSummary.trim().length > 0) {
                        aiSummaryData = fetchedSummary;
                      }
                    } else if (typeof fetchedSummary === "object") {
                      const keys = Object.keys(fetchedSummary);
                      if (keys.length > 0) {
                        aiSummaryData = JSON.stringify(fetchedSummary);
                      }
                    }
                    if (aiSummaryData && aiSummaryData !== "[]" && aiSummaryData.trim().length > 0) {
                      console.log(`\u2705 AI Summary fetched from Taalk API (${aiSummaryData.length} chars)`);
                    } else {
                      console.log(`\u26A0\uFE0F AI Summary is empty or invalid - not storing for new candidate`);
                    }
                  } else {
                    console.log(`\u26A0\uFE0F Taalk API returned empty/null summary for session ${record.sessionid} - summary may not be ready yet`);
                  }
                } else {
                  console.log(`\u26A0\uFE0F Taalk API returned ${summaryResponse.status} for session ${record.sessionid}`);
                }
              } catch (error) {
                console.error(`\u274C Error fetching AI summary from Taalk API:`, error);
              }
            } else {
              console.log(`\u26A0\uFE0F No sessionid available to fetch AI summary`);
            }
            const newCandidateData = {
              first_name: record.firstName || "Unknown",
              last_name: record.lastName || "Candidate",
              phone: candidatePhone,
              email: "",
              // VDP doesn't provide email
              status: "contacted",
              agent_id: record.agent,
              agent_email: finalAgentEmail,
              // Use fallback if needed
              ai_summary: aiSummaryData,
              // Include AI summary if fetched
              notes: `Auto-created from recruit interaction (${eligibilityReason}). Agent: ${finalAgentEmail} (ID: ${record.agent}), Market: ${record.market || "Unknown"}, Session: ${record.sessionid}`,
              created_at: record.time || (/* @__PURE__ */ new Date()).toISOString(),
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            };
            const { data: newCandidate, error: createError } = await supabaseAdmin.from("recruit_candidates").insert(newCandidateData).select().single();
            if (createError) {
              console.error("\u274C Failed to create candidate:", createError);
              throw createError;
            } else {
              console.log(`\u2705 \u2705 \u2705 CANDIDATE CREATED SUCCESSFULLY! ID: ${newCandidate.id}`);
              if (aiSummaryData) {
                console.log(`\u{1F916} AI Summary included in candidate creation (${aiSummaryData.length} chars)`);
              }
              console.log(`\u{1F4F1} Agent ${finalAgentEmail} can now see "${candidateName}" in their AO Recruit dashboard`);
              console.log(`\u{1F517} Phone: ${candidatePhone}, Status: ${newCandidate.status}, Created: ${newCandidate.created_at}`);
            }
          }
        } catch (error) {
          console.error("\u274C Error creating recruit connection:", error);
          console.error("\u274C Full error details:", JSON.stringify(error, null, 2));
        }
      }
    };
    recruitVDPPoller = new RecruitVDPPoller();
  }
});

// server/recruit-ai-summary-updater.ts
var recruit_ai_summary_updater_exports = {};
__export(recruit_ai_summary_updater_exports, {
  recruitAISummaryUpdater: () => recruitAISummaryUpdater
});
var taalkApiKey, RecruitAISummaryUpdater, recruitAISummaryUpdater;
var init_recruit_ai_summary_updater = __esm({
  "server/recruit-ai-summary-updater.ts"() {
    "use strict";
    init_supabase();
    taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    RecruitAISummaryUpdater = class {
      isRunning = false;
      updateInterval = 3 * 60 * 1e3;
      // 3 minutes (increased frequency to catch summaries faster)
      intervalId = null;
      lastUpdateTime = null;
      processedCandidates = /* @__PURE__ */ new Set();
      // Track candidates we've tried recently
      /**
       * Check if an AI summary is valid
       */
      isValidAISummary(summary) {
        if (!summary) return false;
        const str = String(summary).trim();
        if (str === "" || str === "[]" || str === "null" || str === "undefined") return false;
        if (str.length < 10) return false;
        return true;
      }
      /**
       * Fetch AI summary from Taalk API
       */
      async fetchAISummaryFromTaalk(sessionId) {
        if (!sessionId) return null;
        try {
          const summaryUrl = `https://api.taalk.ai/api/calls/${sessionId}/summary?db=michaelmandella`;
          const summaryResponse = await fetch(summaryUrl, {
            headers: { "Authorization": `Bearer ${taalkApiKey}` }
          });
          if (!summaryResponse.ok) {
            if (summaryResponse.status === 404) {
              return null;
            }
            return null;
          }
          const summaryJson = await summaryResponse.json();
          const fetchedSummary = summaryJson.payload?.summary || summaryJson.summary;
          if (!fetchedSummary || fetchedSummary === null || fetchedSummary === void 0) {
            return null;
          }
          let aiSummaryData = null;
          if (Array.isArray(fetchedSummary)) {
            if (fetchedSummary.length > 0) {
              aiSummaryData = JSON.stringify(fetchedSummary);
            }
          } else if (typeof fetchedSummary === "string") {
            if (fetchedSummary.trim().length > 0) {
              aiSummaryData = fetchedSummary;
            }
          } else if (typeof fetchedSummary === "object") {
            const keys = Object.keys(fetchedSummary);
            if (keys.length > 0) {
              aiSummaryData = JSON.stringify(fetchedSummary);
            }
          }
          if (aiSummaryData && aiSummaryData !== "[]" && aiSummaryData.trim().length > 0) {
            return aiSummaryData;
          }
          return null;
        } catch (error) {
          console.error(`\u274C Error fetching AI summary from Taalk API for session ${sessionId}:`, error);
          return null;
        }
      }
      /**
       * Update a single candidate's AI summary
       */
      async updateCandidateAISummary(candidateId, phone) {
        try {
          const searchStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
          const searchEnd = /* @__PURE__ */ new Date();
          const normalizedPhone = phone.replace(/[\s\-+()]/g, "");
          const last10Digits = normalizedPhone.slice(-10);
          let { data: vdpCalls2, error: vdpError } = await supabaseAdmin.from("vdp_calls_BLASTPICK").select("sessionid, leadid, phone, time").eq("phone", phone).ilike("market", "%aorecruit%").gte("time", searchStart.toISOString()).lte("time", searchEnd.toISOString()).order("time", { ascending: false }).limit(5);
          if ((!vdpCalls2 || vdpCalls2.length === 0) && last10Digits.length === 10) {
            const { data: normalizedCalls } = await supabaseAdmin.from("vdp_calls_BLASTPICK").select("sessionid, leadid, phone, time").ilike("phone", `%${last10Digits}%`).ilike("market", "%aorecruit%").gte("time", searchStart.toISOString()).lte("time", searchEnd.toISOString()).order("time", { ascending: false }).limit(5);
            if (normalizedCalls && normalizedCalls.length > 0) {
              vdpCalls2 = normalizedCalls;
            }
          }
          let { data: vdpCallsWebhook, error: vdpWebhookError } = await supabaseAdmin.from("vdp_calls").select("leadid, phone, time").eq("phone", phone).ilike("market", "%aorecruit%").gte("time", searchStart.toISOString()).lte("time", searchEnd.toISOString()).order("time", { ascending: false }).limit(5);
          if ((!vdpCallsWebhook || vdpCallsWebhook.length === 0) && last10Digits.length === 10) {
            const { data: normalizedWebhookCalls } = await supabaseAdmin.from("vdp_calls").select("leadid, phone, time").ilike("phone", `%${last10Digits}%`).ilike("market", "%aorecruit%").gte("time", searchStart.toISOString()).lte("time", searchEnd.toISOString()).order("time", { ascending: false }).limit(5);
            if (normalizedWebhookCalls && normalizedWebhookCalls.length > 0) {
              vdpCallsWebhook = normalizedWebhookCalls;
            }
          }
          if (vdpError || vdpWebhookError) {
            return false;
          }
          const callIds = [];
          if (vdpCalls2) {
            vdpCalls2.forEach((call) => {
              if (call.sessionid && !callIds.includes(call.sessionid)) callIds.push(call.sessionid);
              if (call.leadid && !callIds.includes(call.leadid)) callIds.push(call.leadid);
            });
          }
          if (vdpCallsWebhook) {
            vdpCallsWebhook.forEach((call) => {
              if (call.leadid && !callIds.includes(call.leadid)) callIds.push(call.leadid);
            });
          }
          if (callIds.length === 0) {
            return false;
          }
          for (const callId of callIds) {
            const aiSummary = await this.fetchAISummaryFromTaalk(callId);
            if (aiSummary) {
              const { error: updateError } = await supabaseAdmin.from("recruit_candidates").update({
                ai_summary: aiSummary,
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              }).eq("id", candidateId);
              if (!updateError) {
                console.log(`\u2705 AI Summary updated for candidate ${candidateId} (${phone})`);
                return true;
              }
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          return false;
        } catch (error) {
          console.error(`\u274C Error updating AI summary for candidate ${candidateId}:`, error);
          return false;
        }
      }
      /**
       * Check and update missing AI summaries
       */
      async checkAndUpdateSummaries() {
        if (this.isRunning) {
          console.log("\u23ED\uFE0F AI Summary updater already running, skipping...");
          return;
        }
        this.isRunning = true;
        this.lastUpdateTime = /* @__PURE__ */ new Date();
        try {
          console.log("\u{1F50D} Checking for recruit candidates with missing AI summaries...");
          const searchStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
          const { data: candidates, error } = await supabaseAdmin.from("recruit_candidates").select("id, first_name, last_name, phone, ai_summary, created_at").gte("created_at", searchStart.toISOString()).order("created_at", { ascending: false }).limit(500);
          if (error) {
            console.error("\u274C Error fetching candidates:", error);
            return;
          }
          if (!candidates || candidates.length === 0) {
            console.log("\u2705 No recent candidates to check");
            return;
          }
          const candidatesNeedingSummaries = candidates.filter((c) => {
            if (this.processedCandidates.has(c.id)) {
              return false;
            }
            return !this.isValidAISummary(c.ai_summary);
          });
          if (candidatesNeedingSummaries.length === 0) {
            console.log("\u2705 All recent candidates have valid AI summaries");
            return;
          }
          console.log(`\u{1F4CA} Found ${candidatesNeedingSummaries.length} candidates needing AI summaries`);
          let updated = 0;
          let notFound = 0;
          for (const candidate of candidatesNeedingSummaries) {
            console.log(`  \u{1F50D} Processing candidate ${candidate.id}: ${candidate.first_name} ${candidate.last_name} (${candidate.phone})`);
            const success = await this.updateCandidateAISummary(candidate.id, candidate.phone);
            if (success) {
              updated++;
              console.log(`  \u2705 Successfully updated candidate ${candidate.id}`);
            } else {
              notFound++;
              console.log(`  \u26A0\uFE0F Could not find AI summary for candidate ${candidate.id}`);
            }
            this.processedCandidates.add(candidate.id);
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
          console.log(`\u2705 Updated ${updated} of ${candidatesNeedingSummaries.length} candidates with AI summaries`);
          if (notFound > 0) {
            console.log(`\u26A0\uFE0F Could not find AI summaries for ${notFound} candidates (may not be available yet)`);
          }
          if (this.processedCandidates.size > 1e3) {
            this.processedCandidates.clear();
            console.log("  \u{1F9F9} Cleared processed candidates cache (size limit reached)");
          }
        } catch (error) {
          console.error("\u274C Error in AI summary updater:", error);
        } finally {
          this.isRunning = false;
        }
      }
      /**
       * Start the updater
       */
      start() {
        if (this.intervalId) {
          console.log("\u26A0\uFE0F AI Summary updater already started");
          return;
        }
        console.log("\u{1F680} Starting Recruit AI Summary Updater (runs every 5 minutes)");
        this.checkAndUpdateSummaries();
        this.intervalId = setInterval(() => {
          this.checkAndUpdateSummaries();
        }, this.updateInterval);
      }
      /**
       * Stop the updater
       */
      stop() {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
          console.log("\u{1F6D1} Stopped Recruit AI Summary Updater");
        }
      }
      /**
       * Get status
       */
      getStatus() {
        return {
          isRunning: this.isRunning,
          lastUpdateTime: this.lastUpdateTime,
          updateInterval: this.updateInterval
        };
      }
    };
    recruitAISummaryUpdater = new RecruitAISummaryUpdater();
  }
});

// server/local-masterlead-client.ts
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
var knownColumns, baseReady, LocalMasterleadBuilder, masterleadClient2;
var init_local_masterlead_client = __esm({
  "server/local-masterlead-client.ts"() {
    "use strict";
    init_db();
    knownColumns = /* @__PURE__ */ new Set();
    baseReady = false;
    LocalMasterleadBuilder = class {
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
      limit(count2) {
        this.limitValue = Math.max(0, Number(count2 || 0));
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
      update(payload) {
        this.mode = "update";
        this.updatePayload = payload || {};
        Object.keys(this.updatePayload).forEach((k) => this.referencedColumns.add(normalizeColumn2(k)));
        return this;
      }
      insert(payload) {
        this.mode = "insert";
        this.insertPayload = Array.isArray(payload) ? payload : [payload];
        this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn2(k))));
        return this;
      }
      upsert(payload, options) {
        this.mode = "upsert";
        this.insertPayload = Array.isArray(payload) ? payload : [payload];
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
        let count2 = null;
        if (this.selectCount === "exact") {
          const c = await pool.query(
            `SELECT COUNT(*)::text AS count FROM masterlead${where.sql}`,
            where.values
          );
          count2 = Number(c.rows[0]?.count || 0);
        }
        if (this.selectHead) {
          return { data: null, error: null, count: count2 };
        }
        const result = await pool.query(
          `SELECT ${cols} FROM masterlead${where.sql}${order}${limit}${offset}`,
          where.values
        );
        if (this.singleType === "single") {
          if ((result.rowCount || 0) !== 1) {
            return { data: null, error: { message: "Expected single row" }, count: count2 };
          }
          return { data: result.rows[0], error: null, count: count2 };
        }
        if (this.singleType === "maybeSingle") {
          return { data: result.rows[0] || null, error: null, count: count2 };
        }
        return { data: result.rows, error: null, count: count2 };
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
    masterleadClient2 = {
      from(table) {
        if (String(table || "").toLowerCase() !== "masterlead") {
          throw new Error("masterleadClient only supports the masterlead table");
        }
        return new LocalMasterleadBuilder();
      }
    };
  }
});

// server/aointel-vdp-poller.ts
var aointel_vdp_poller_exports = {};
__export(aointel_vdp_poller_exports, {
  aoIntelVDPPoller: () => aoIntelVDPPoller,
  setAOIntelLeadDisplayTrigger: () => setAOIntelLeadDisplayTrigger
});
function setAOIntelLeadDisplayTrigger(triggerFn) {
  triggerAOIntelLeadDisplay = triggerFn;
  console.log("\u2705 AOIntel lead display trigger function set");
}
var triggerAOIntelLeadDisplay, AOIntelVDPPoller, aoIntelVDPPoller;
var init_aointel_vdp_poller = __esm({
  "server/aointel-vdp-poller.ts"() {
    "use strict";
    init_supabase();
    init_local_masterlead_client();
    triggerAOIntelLeadDisplay = null;
    AOIntelVDPPoller = class {
      isRunning = false;
      pollInterval = 2e3;
      // 2 seconds - faster for real-time lead delivery (backup to webhook)
      processedIds = /* @__PURE__ */ new Set();
      lastPollTime = null;
      start() {
        if (this.isRunning) {
          console.log("\u26A0\uFE0F AOIntel VDP poller already running");
          return;
        }
        this.isRunning = true;
        console.log("\u{1F3AF} Starting AOIntel VDP poller - checking vdp_calls table every 5 seconds for PICK_UP events");
        this.poll();
      }
      stop() {
        this.isRunning = false;
        console.log("\u{1F6D1} AOIntel VDP poller stopped");
      }
      async poll() {
        if (!this.isRunning) return;
        try {
          await this.checkForAOIntelPickups();
        } catch (error) {
          console.error("\u274C AOIntel VDP poller error:", error);
        }
        setTimeout(() => this.poll(), this.pollInterval);
      }
      /**
       * Check if market qualifies as AOIntel (Veteran or Globe Market)
       */
      isAOIntelMarket(market) {
        if (!market) return false;
        const normalizedMarket = market.toLowerCase();
        return normalizedMarket.includes("veteran") || normalizedMarket.includes("globe market");
      }
      async checkForAOIntelPickups() {
        if (!supabaseAdmin) {
          console.log("\u26A0\uFE0F AOIntel poller: No Supabase connection");
          return;
        }
        try {
          const thirtySecondsAgo = new Date(Date.now() - 3e4).toISOString();
          const { data: records, error } = await supabaseAdmin.from("vdp_calls").select("*").eq("event", "PICK_UP").gte("time", thirtySecondsAgo).order("time", { ascending: false }).limit(50);
          if (error) {
            console.error("\u274C Error querying vdp_calls for PICK_UP events:", error);
            return;
          }
          if (!records || records.length === 0) {
            this.lastPollTime = /* @__PURE__ */ new Date();
            return;
          }
          const aoiRecords = records.filter((r) => this.isAOIntelMarket(r.market));
          if (aoiRecords.length === 0) {
            this.lastPollTime = /* @__PURE__ */ new Date();
            return;
          }
          console.log(`\u{1F4DE} AOIntel PICK_UP: Found ${aoiRecords.length} AOIntel call(s)`);
          let newRecordsProcessed = 0;
          for (const record of aoiRecords) {
            if (this.processedIds.has(record.id)) {
              continue;
            }
            console.log(`
\u{1F6A8} NEW AOINTEL PICK_UP #${record.id}: ${record.firstName} ${record.lastName} (${record.phone}) - Agent: ${record.company_email || record.agent}`);
            this.processedIds.add(record.id);
            newRecordsProcessed++;
            if (this.processedIds.size > 1e3) {
              const idsArray = Array.from(this.processedIds);
              this.processedIds = new Set(idsArray.slice(-500));
            }
            await this.createAOIntelLead(record);
          }
          if (newRecordsProcessed > 0) {
            console.log(`
\u2705 Processed ${newRecordsProcessed} new AOIntel PICK_UP event(s)`);
          }
          this.lastPollTime = /* @__PURE__ */ new Date();
        } catch (error) {
          console.error("\u274C Error checking for AOIntel PICK_UP events:", error);
        }
      }
      /**
       * Get agent email from associate ID
       */
      async getAgentEmailFromAssociateId(associateId) {
        if (!supabaseAdmin || !associateId) return null;
        try {
          const associateIdInt = parseInt(associateId);
          if (isNaN(associateIdInt)) return null;
          const { data: userCredit } = await supabaseAdmin.from("user_credits").select("email").eq("associate_id", associateIdInt).maybeSingle();
          if (userCredit?.email) {
            return userCredit.email.toLowerCase();
          }
          const { data: producer } = await supabaseAdmin.from("producerlist").select("company_email").eq("associate_id", associateIdInt).maybeSingle();
          if (producer?.company_email) {
            return producer.company_email.toLowerCase();
          }
          const { data: customer } = await supabaseAdmin.from("customers").select("company_email").eq("associate_id", associateIdInt).maybeSingle();
          if (customer?.company_email) {
            return customer.company_email.toLowerCase();
          }
          return null;
        } catch (error) {
          console.error("\u274C Error looking up agent email:", error);
          return null;
        }
      }
      /**
       * Create AOIntel lead in masterlead table and trigger frontend display
       */
      async createAOIntelLead(record) {
        if (!supabaseAdmin) return;
        try {
          let agentEmail = record.company_email?.toLowerCase();
          if (!agentEmail && record.agent) {
            agentEmail = await this.getAgentEmailFromAssociateId(record.agent) || void 0;
          }
          if (!agentEmail) {
            console.error(`\u274C Cannot create AOIntel lead - no agent email found for ${record.agent}`);
            return;
          }
          const now = /* @__PURE__ */ new Date();
          const leadName = `${record.firstName || ""} ${record.lastName || ""}`.trim() || "AOIntel Lead";
          const { data: existingLead } = await masterleadClient2.from("masterlead").select("id, cnresolution").eq("taalk_lead_id", record.leadid).maybeSingle();
          let leadData = null;
          if (existingLead) {
            console.log(`\u2139\uFE0F AOIntel lead ${record.leadid} already exists with resolution: ${existingLead.cnresolution}`);
            const resolution = String(existingLead.cnresolution || "").toLowerCase();
            if (resolution !== "pending" && resolution !== "aointel") {
              console.log(`\u{1F504} Resetting existing lead ${record.leadid} to pending for new AOIntel call`);
              const { data: updatedLead, error: updateError } = await masterleadClient2.from("masterlead").update({
                cnresolution: "pending",
                aointel: true,
                cn_email: agentEmail,
                updated_at: now.toISOString()
              }).eq("id", existingLead.id).select().single();
              if (updateError) {
                console.error(`\u274C Failed to update existing AOIntel lead:`, updateError);
                return;
              }
              leadData = updatedLead;
            } else {
              const { data: fullLead } = await masterleadClient2.from("masterlead").select("*").eq("id", existingLead.id).single();
              leadData = fullLead;
            }
          } else {
            const masterleadPayload = {
              taalk_lead_id: String(record.leadid),
              first_name: record.firstName || null,
              last_name: record.lastName || null,
              phone: record.phone || null,
              taalk_market: record.market || "AOIntel",
              cn_email: agentEmail,
              cnresolution: "pending",
              // Pending requires agent resolution
              aointel: true,
              // Critical: marks as AOIntel lead
              taalk_lead_source: "ao_intel_inbound",
              updated_at: now.toISOString()
            };
            const { error: insertError, data: newLead } = await masterleadClient2.from("masterlead").insert(masterleadPayload).select().single();
            if (insertError) {
              console.error(`\u274C Failed to create AOIntel lead:`, insertError);
              return;
            }
            leadData = newLead;
            console.log(`\u2705 Created AOIntel lead ${record.leadid} for agent ${agentEmail}`);
          }
          const { error: statusError } = await supabaseAdmin.from("agent_live_call_status").upsert({
            agent_email: agentEmail,
            status: "in_call",
            // Signal that agent has incoming AOIntel call
            last_heartbeat_at: now.toISOString(),
            updated_at: now.toISOString()
          }, {
            onConflict: "agent_email"
          });
          if (statusError) {
            console.error(`\u274C Failed to update agent status:`, statusError);
          } else {
            console.log(`\u2705 Agent ${agentEmail} marked as 'in_call' - outbound dialer should pause`);
          }
          const { error: boardError } = await supabaseAdmin.from("live_call_boardt").upsert({
            agent_email: agentEmail,
            status: "calling",
            current_call: {
              phoneNumber: record.phone,
              clientName: leadName,
              direction: "inbound",
              callStatus: "ringing",
              callType: "AOIntel",
              leadId: record.leadid,
              startedAt: now.toISOString()
            },
            last_activity: now.toISOString(),
            updated_at: now.toISOString()
          }, {
            onConflict: "agent_email"
          });
          if (boardError) {
            console.error(`\u274C Failed to update live_call_boardt:`, boardError);
          } else {
            console.log(`\u2705 Live call board updated for AOIntel call: ${leadName}`);
          }
          console.log(`\u{1F6A8} AOIntel lead ${record.leadid} is now PENDING in queue for ${agentEmail}`);
          console.log(`   -> Agent must resolve this lead before it leaves the queue`);
          if (leadData && triggerAOIntelLeadDisplay) {
            try {
              await triggerAOIntelLeadDisplay(leadData, agentEmail);
              console.log(`\u2705 Triggered instant display for AOIntel lead ${record.leadid}`);
            } catch (triggerError) {
              console.error(`\u274C Error triggering AOIntel lead display (non-blocking):`, triggerError);
            }
          } else if (!triggerAOIntelLeadDisplay) {
            console.warn(`\u26A0\uFE0F triggerAOIntelLeadDisplay not set - lead created but not displayed instantly`);
          }
        } catch (error) {
          console.error("\u274C Error creating AOIntel lead:", error);
        }
      }
    };
    aoIntelVDPPoller = new AOIntelVDPPoller();
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
        const totalCalls = agents.reduce((sum2, a) => sum2 + a.todayStats.totalCalls, 0);
        const inboundCalls = agents.reduce((sum2, a) => sum2 + a.todayStats.inboundCalls, 0);
        const outboundCalls2 = agents.reduce((sum2, a) => sum2 + a.todayStats.outboundCalls, 0);
        const totalCallTime = agents.reduce((sum2, a) => sum2 + a.todayStats.totalCallTime, 0);
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

// server/vdp-agent-tracker.ts
var vdp_agent_tracker_exports = {};
__export(vdp_agent_tracker_exports, {
  vdpAgentTracker: () => vdpAgentTracker
});
var VDPAgentTracker, vdpAgentTracker;
var init_vdp_agent_tracker = __esm({
  "server/vdp-agent-tracker.ts"() {
    "use strict";
    init_supabase();
    VDPAgentTracker = class {
      agents = /* @__PURE__ */ new Map();
      checkInterval = null;
      statsInterval = null;
      HEARTBEAT_TIMEOUT = 6e4;
      // 60 seconds
      constructor() {
        console.log("\u{1F3AF} VDP Agent Tracker initialized");
      }
      /**
       * Start monitoring VDP agents
       */
      start() {
        console.log("\u{1F680} Starting VDP Agent Tracker...");
        this.checkInterval = setInterval(() => {
          this.checkStaleAgents();
        }, 1e4);
        this.statsInterval = setInterval(() => {
          this.refreshAgentStats();
        }, 15e3);
        console.log("\u2705 VDP Agent Tracker started - real-time dial/reached/booked enabled");
      }
      /**
       * Stop monitoring
       */
      stop() {
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
        if (this.statsInterval) {
          clearInterval(this.statsInterval);
          this.statsInterval = null;
        }
        console.log("\u{1F6D1} VDP Agent Tracker stopped");
      }
      /**
       * Update agent heartbeat from VDP
       */
      updateHeartbeat(email, name) {
        const now = /* @__PURE__ */ new Date();
        const agent = this.agents.get(email);
        if (agent) {
          const timeSinceLastHeartbeat = (now.getTime() - agent.lastHeartbeat.getTime()) / 1e3;
          if (agent.status === "offline") {
            agent.status = "idle";
            agent.sessionStart = now;
            console.log(`\u{1F464} ${email} came ONLINE`);
          } else if (agent.status === "idle") {
            agent.availableTime += timeSinceLastHeartbeat;
            agent.todayStats.totalAvailableTime += timeSinceLastHeartbeat;
          }
          agent.lastHeartbeat = now;
        } else {
          console.log(`\u2705 NEW agent connected: ${email}`);
          this.agents.set(email, {
            email,
            name,
            status: "idle",
            lastHeartbeat: now,
            sessionStart: now,
            availableTime: 0,
            callTime: 0,
            todayStats: {
              dialed: 0,
              reached: 0,
              booked: 0,
              inboundCalls: 0,
              outboundCalls: 0,
              totalCallTime: 0,
              totalAvailableTime: 0,
              utilization: 0
            }
          });
          this.fetchAgentStats(email);
        }
      }
      /**
       * Mark agent as dialing
       */
      startDialing(email, phoneNumber) {
        const agent = this.agents.get(email);
        if (!agent) {
          console.warn(`\u26A0\uFE0F Cannot start dialing for unknown agent: ${email}`);
          return;
        }
        agent.status = "dialing";
        console.log(`\u{1F4DE} ${email} started DIALING ${phoneNumber}`);
      }
      /**
       * Mark agent as on a live call
       */
      startCall(email, callId, direction, phoneNumber) {
        const agent = this.agents.get(email);
        if (!agent) {
          console.warn(`\u26A0\uFE0F Cannot start call for unknown agent: ${email}`);
          return;
        }
        agent.status = "live";
        agent.currentCall = {
          callId,
          direction,
          phoneNumber,
          startTime: /* @__PURE__ */ new Date(),
          duration: 0
        };
        if (direction === "inbound") {
          agent.todayStats.inboundCalls++;
        } else {
          agent.todayStats.outboundCalls++;
        }
        console.log(`\u{1F4DE} ${email} on LIVE ${direction} call with ${phoneNumber}`);
      }
      /**
       * Mark agent as in presentation (HPPRO)
       */
      startPresentation(email, sessionId, clientName) {
        const agent = this.agents.get(email);
        if (!agent) {
          console.warn(`\u26A0\uFE0F Cannot start presentation for unknown agent: ${email}`);
          return;
        }
        agent.status = "presentation";
        agent.currentPresentation = {
          sessionId,
          clientName,
          startTime: /* @__PURE__ */ new Date(),
          duration: 0
        };
        console.log(`\u{1F3AC} ${email} entered HPPRO presentation with ${clientName}`);
      }
      /**
       * End agent's current call
       */
      endCall(email) {
        const agent = this.agents.get(email);
        if (!agent || !agent.currentCall) {
          return;
        }
        const callDuration = ((/* @__PURE__ */ new Date()).getTime() - agent.currentCall.startTime.getTime()) / 1e3;
        agent.callTime += callDuration;
        agent.todayStats.totalCallTime += callDuration;
        console.log(`\u{1F4DE} ${email} ended call (${Math.round(callDuration)}s)`);
        agent.currentCall = void 0;
        agent.status = "idle";
        this.updateUtilization(agent);
        this.fetchAgentStats(email);
      }
      /**
       * End agent's presentation
       */
      endPresentation(email) {
        const agent = this.agents.get(email);
        if (!agent || !agent.currentPresentation) {
          return;
        }
        const presentationDuration = ((/* @__PURE__ */ new Date()).getTime() - agent.currentPresentation.startTime.getTime()) / 1e3;
        console.log(`\u{1F3AC} ${email} ended presentation (${Math.round(presentationDuration)}s)`);
        agent.currentPresentation = void 0;
        agent.status = "idle";
        this.fetchAgentStats(email);
      }
      /**
       * Fetch today's dial/reached/booked stats from agent_dial_metrics table (independent of masterlead)
       * CRITICAL: Uses agent_dial_metrics table so stats persist even when leads are cleaned/reassigned
       */
      async fetchAgentStats(email) {
        try {
          const todayStart = /* @__PURE__ */ new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = /* @__PURE__ */ new Date();
          todayEnd.setHours(23, 59, 59, 999);
          const { count: dialed } = await supabaseAdmin.from("agent_dial_metrics").select("*", { count: "exact", head: true }).eq("agent_email", email.toLowerCase()).eq("event_type", "dial").gte("event_timestamp", todayStart.toISOString()).lt("event_timestamp", todayEnd.toISOString());
          const { count: reached } = await supabaseAdmin.from("agent_dial_metrics").select("*", { count: "exact", head: true }).eq("agent_email", email.toLowerCase()).eq("event_type", "reach").gte("event_timestamp", todayStart.toISOString()).lt("event_timestamp", todayEnd.toISOString());
          const { count: booked } = await supabaseAdmin.from("agent_dial_metrics").select("*", { count: "exact", head: true }).eq("agent_email", email.toLowerCase()).eq("event_type", "booked").gte("event_timestamp", todayStart.toISOString()).lt("event_timestamp", todayEnd.toISOString());
          const agent = this.agents.get(email);
          if (agent) {
            agent.todayStats.dialed = dialed || 0;
            agent.todayStats.reached = reached || 0;
            agent.todayStats.booked = booked || 0;
          }
        } catch (error) {
          console.error(`\u274C Error fetching stats for ${email}:`, error);
        }
      }
      /**
       * Refresh stats for all online agents
       */
      async refreshAgentStats() {
        const onlineAgents = Array.from(this.agents.values()).filter((a) => a.status !== "offline");
        for (const agent of onlineAgents) {
          await this.fetchAgentStats(agent.email);
        }
      }
      /**
       * Update call duration for active calls and presentations
       */
      updateActiveCallDurations() {
        const now = /* @__PURE__ */ new Date();
        for (const agent of this.agents.values()) {
          if (agent.currentCall) {
            agent.currentCall.duration = (now.getTime() - agent.currentCall.startTime.getTime()) / 1e3;
          }
          if (agent.currentPresentation) {
            agent.currentPresentation.duration = (now.getTime() - agent.currentPresentation.startTime.getTime()) / 1e3;
          }
        }
      }
      /**
       * Calculate utilization percentage
       */
      updateUtilization(agent) {
        const totalTime = agent.todayStats.totalAvailableTime + agent.todayStats.totalCallTime;
        if (totalTime > 0) {
          agent.todayStats.utilization = Math.round(agent.todayStats.totalCallTime / totalTime * 100);
        }
      }
      /**
       * Check for agents that haven't sent heartbeat (offline)
       */
      checkStaleAgents() {
        const now = /* @__PURE__ */ new Date();
        this.updateActiveCallDurations();
        for (const [email, agent] of this.agents.entries()) {
          const timeSinceHeartbeat = now.getTime() - agent.lastHeartbeat.getTime();
          if (timeSinceHeartbeat > this.HEARTBEAT_TIMEOUT && agent.status !== "offline") {
            console.log(`\u274C ${email} went OFFLINE (no heartbeat for ${Math.round(timeSinceHeartbeat / 1e3)}s)`);
            agent.status = "offline";
            if (agent.currentCall) {
              this.endCall(email);
            }
            if (agent.currentPresentation) {
              this.endPresentation(email);
            }
          }
        }
      }
      /**
       * Get all agents for the live call board
       */
      getAgents() {
        return Array.from(this.agents.values()).sort((a, b) => {
          const statusPriority = { "live": 1, "presentation": 2, "dialing": 3, "idle": 4, "offline": 5 };
          const aPriority = statusPriority[a.status] || 6;
          const bPriority = statusPriority[b.status] || 6;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return b.lastHeartbeat.getTime() - a.lastHeartbeat.getTime();
        });
      }
      /**
       * Get agent by email
       */
      getAgentByEmail(email) {
        return this.agents.get(email);
      }
      /**
       * Get stats for dashboard
       */
      getStats() {
        const agents = Array.from(this.agents.values());
        const onlineAgents = agents.filter((a) => a.status !== "offline");
        const activeAgents = agents.filter((a) => ["live", "dialing", "presentation"].includes(a.status));
        const idleAgents = agents.filter((a) => a.status === "idle");
        const totalDialed = agents.reduce((sum2, a) => sum2 + a.todayStats.dialed, 0);
        const totalReached = agents.reduce((sum2, a) => sum2 + a.todayStats.reached, 0);
        const totalBooked = agents.reduce((sum2, a) => sum2 + a.todayStats.booked, 0);
        const totalInbound = agents.reduce((sum2, a) => sum2 + a.todayStats.inboundCalls, 0);
        const totalOutbound = agents.reduce((sum2, a) => sum2 + a.todayStats.outboundCalls, 0);
        const totalCallTime = agents.reduce((sum2, a) => sum2 + a.todayStats.totalCallTime, 0);
        const avgUtilization = onlineAgents.length > 0 ? Math.round(onlineAgents.reduce((sum2, a) => sum2 + a.todayStats.utilization, 0) / onlineAgents.length) : 0;
        return {
          totalAgents: agents.length,
          onlineAgents: onlineAgents.length,
          activeAgents: activeAgents.length,
          idleAgents: idleAgents.length,
          totalDialed,
          totalReached,
          totalBooked,
          inboundCalls: totalInbound,
          outboundCalls: totalOutbound,
          avgCallTime: this.formatDuration(totalDialed > 0 ? totalCallTime / totalDialed : 0),
          avgUtilization
        };
      }
      /**
       * Format seconds to MM:SS
       */
      formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
      }
    };
    vdpAgentTracker = new VDPAgentTracker();
  }
});

// server/recording-scheduler.ts
var recording_scheduler_exports = {};
async function downloadNewRecordings() {
  console.log(`
\u{1F504} [${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Checking for new recordings...`);
  try {
    const { data: pendingSessions, error: pendingError } = await supabaseAdmin.from("verification_sessions").select("id, session_id, taalk_call_id, taalk_call_url, recording_url, status").not("taalk_call_id", "is", null).eq("recording_url", "PENDING").order("created_at", { ascending: false }).limit(200);
    const { data: recentSessions, error: recentError } = await supabaseAdmin.from("verification_sessions").select("id, session_id, taalk_call_id, taalk_call_url, recording_url, status").not("taalk_call_id", "is", null).or("recording_url.is.null,recording_url.eq.").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString()).limit(100);
    if (pendingError) {
      console.error("\u274C Database query error (pending):", pendingError);
    }
    if (recentError) {
      console.error("\u274C Database query error (recent):", recentError);
    }
    const sessions = [
      ...pendingSessions || [],
      ...(recentSessions || []).filter((s) => !pendingSessions?.some((p) => p.id === s.id))
    ];
    if (!sessions || sessions.length === 0) {
      console.log("\u2705 No new recordings to download");
      return;
    }
    const pendingCount = pendingSessions?.length || 0;
    const recentCount = recentSessions?.length || 0;
    console.log(`\u{1F4E5} Found ${sessions.length} sessions to process (${pendingCount} PENDING, ${recentCount} recent)`);
    let successCount = 0;
    let failCount = 0;
    for (const session of sessions) {
      try {
        const callId = session.taalk_call_id;
        if (session.taalk_call_url && session.taalk_call_url.startsWith("recordings/")) {
          console.log(`  \u2713 Already in storage: ${session.taalk_call_url}, generating fresh URL...`);
          const { data: signedData, error: signedError } = await supabaseAdmin.storage.from("verify_agent_screenshot").createSignedUrl(session.taalk_call_url, 63072e3);
          if (!signedError && signedData?.signedUrl) {
            await supabaseAdmin.from("verification_sessions").update({ recording_url: signedData.signedUrl }).eq("id", session.id);
            console.log(`  \u2705 Generated fresh 2-year Supabase URL`);
            successCount++;
            await new Promise((resolve) => setTimeout(resolve, 100));
            continue;
          } else {
            console.log(`  \u26A0\uFE0F Failed to generate signed URL, will try to re-download`);
          }
        }
        const taalkRecordingUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        let response = await fetch(taalkRecordingUrl, {
          headers: {
            "Authorization": `Bearer ${TAALK_API_KEY}`,
            "Accept": "audio/mpeg, audio/mp3, audio/*, */*"
          }
        });
        if (!response.ok && response.status === 401) {
          const basicAuth = Buffer.from("michaelmandella@aoglobelife.com:Aoletsgrow24!").toString("base64");
          response = await fetch(taalkRecordingUrl, {
            headers: {
              "Authorization": `Basic ${basicAuth}`,
              "Accept": "audio/mpeg"
            }
          });
        }
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const fileName = `recordings/${callId}.mp3`;
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage.from("verify_agent_screenshot").upload(fileName, buffer, {
            contentType: "audio/mpeg",
            upsert: true
          });
          if (uploadError) {
            console.error(`  \u274C Upload failed for ${session.session_id}:`, uploadError.message);
            failCount++;
            continue;
          }
          const { data: signedData, error: signedError } = await supabaseAdmin.storage.from("verify_agent_screenshot").createSignedUrl(fileName, 63072e3);
          const signedUrl = signedData?.signedUrl || null;
          await supabaseAdmin.from("verification_sessions").update({
            taalk_call_url: fileName,
            // Store Supabase storage path
            recording_url: signedUrl,
            // Store 2-year signed URL
            taalk_call_status: "completed",
            taalk_call_completed_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", session.id);
          console.log(`  \u2705 Downloaded ${session.session_id} (${Math.round(buffer.length / 1024)}KB)`);
          successCount++;
        } else {
          console.error(`  \u274C Failed to download recording: ${response.status} ${response.statusText} (Call ID: ${callId})`);
          failCount++;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`  \u274C Error processing ${session.session_id}:`, error.message);
        failCount++;
      }
    }
    if (successCount > 0 || failCount > 0) {
      console.log(`\u{1F4CA} Summary: \u2705 ${successCount} downloaded, \u274C ${failCount} failed`);
    }
  } catch (error) {
    console.error("\u274C Fatal error:", error);
  }
}
var TAALK_API_KEY;
var init_recording_scheduler = __esm({
  "server/recording-scheduler.ts"() {
    "use strict";
    init_supabase();
    TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    console.log("\u{1F3B5} Recording Scheduler Started");
    console.log("\u23F0 Checking for new recordings every 5 minutes");
    downloadNewRecordings();
    setInterval(() => {
      downloadNewRecordings();
    }, 5 * 60 * 1e3);
    process.on("SIGINT", () => {
      console.log("\n\u{1F6D1} Recording scheduler stopped");
      process.exit(0);
    });
  }
});

// server/recording-url-scheduler.ts
var recording_url_scheduler_exports = {};
async function populateRecordingUrls() {
  console.log(`
\u{1F511} [${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Populating missing recording URLs...`);
  try {
    const { data: sessions, error } = await supabaseAdmin.from("verification_sessions").select("id, taalk_call_url, recording_url, first_name, last_name").like("taalk_call_url", "recordings/%").or("recording_url.is.null,recording_url.eq.").limit(200);
    if (error) {
      console.error("\u274C Database error:", error);
      return;
    }
    if (!sessions || sessions.length === 0) {
      console.log("\u2705 All recording URLs are up to date");
      return;
    }
    console.log(`\u{1F4E5} Found ${sessions.length} sessions needing recording URLs`);
    let successCount = 0;
    for (const session of sessions) {
      try {
        const { data: signedData, error: signedError } = await supabaseAdmin.storage.from("verify_agent_screenshot").createSignedUrl(session.taalk_call_url, 63072e3);
        if (signedError || !signedData?.signedUrl) {
          console.error(`  \u274C Failed to generate URL for session ${session.id}`);
          continue;
        }
        await supabaseAdmin.from("verification_sessions").update({ recording_url: signedData.signedUrl }).eq("id", session.id);
        successCount++;
      } catch (error2) {
        console.error(`  \u274C Error processing session ${session.id}:`, error2.message);
      }
    }
    console.log(`\u2705 Updated ${successCount} recording URLs`);
  } catch (error) {
    console.error("\u274C Fatal error:", error);
  }
}
var init_recording_url_scheduler = __esm({
  "server/recording-url-scheduler.ts"() {
    "use strict";
    init_supabase();
    console.log("\u{1F511} Recording URL Scheduler Started");
    populateRecordingUrls();
    setInterval(populateRecordingUrls, 6e5);
  }
});

// server/aoi-score-service.ts
import { subDays } from "date-fns";
function postgrestQuotedFilterValue(value) {
  return `"${value.replace(/"/g, '""')}"`;
}
async function getAssociateIdByEmail(agentEmail) {
  if (!agentEmail?.trim()) return null;
  if (!supabaseAdmin) return null;
  const normalized = agentEmail.trim().toLowerCase();
  const q = postgrestQuotedFilterValue(normalized);
  const { data, error } = await supabaseAdmin.from("customers").select("associate_id").or(`company_email.ilike.${q},personal_email.ilike.${q}`).not("associate_id", "is", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    console.error("\u274C AOI Score: Failed to lookup associate_id:", error);
    return null;
  }
  return data?.associate_id ?? null;
}
async function getAOIScoreByAssociateId(associateId) {
  if (!associateId || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.from("aoi_score_tracker").select(
    "associate_id, agent_email, dial_to_connect_rate, appointment_book_rate, presentation_rate, closing_rate, follow_up_consistency, lead_quality_score, aoi_score, performance_tier, sample_size, date_range_start, date_range_end, calculated_at, updated_at"
  ).eq("associate_id", associateId).maybeSingle();
  if (error) {
    if (error.code === "42P01") {
      console.warn("\u26A0\uFE0F AOI Score: aoi_score_tracker table does not exist. Run database/create-aoi-score-tracker.sql");
      return null;
    }
    console.error("\u274C AOI Score: Failed to fetch:", error);
    return null;
  }
  if (!data) return null;
  return {
    associateId: data.associate_id,
    agentEmail: data.agent_email ?? null,
    dialToConnectRate: Number(data.dial_to_connect_rate ?? 0),
    appointmentBookRate: Number(data.appointment_book_rate ?? 0),
    presentationRate: Number(data.presentation_rate ?? 0),
    closingRate: Number(data.closing_rate ?? 0),
    followUpConsistency: Number(data.follow_up_consistency ?? 0),
    leadQualityScore: Number(data.lead_quality_score ?? 0),
    aoiScore: Number(data.aoi_score ?? 0),
    performanceTier: data.performance_tier ?? "needs_improvement",
    sampleSize: Number(data.sample_size ?? 0),
    dateRangeStart: data.date_range_start ?? null,
    dateRangeEnd: data.date_range_end ?? null,
    calculatedAt: data.calculated_at ?? (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: data.updated_at ?? (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function getAOIScoreByEmail(agentEmail) {
  const associateId = await getAssociateIdByEmail(agentEmail);
  if (!associateId) return null;
  return getAOIScoreByAssociateId(associateId);
}
async function calculateAndUpsertAOIScore(associateId, agentEmail) {
  if (!supabaseAdmin) return null;
  const rangeEnd = /* @__PURE__ */ new Date();
  const rangeStart = subDays(rangeEnd, 30);
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();
  const normalizedEmail = agentEmail.trim().toLowerCase();
  const { data: dialData } = await supabaseAdmin.from("twilio_call_logs").select("to_number, call_duration, call_status").eq("owner_email", normalizedEmail).eq("call_direction", "outbound").gte("call_started_at", startIso).lt("call_started_at", endIso).not("to_number", "is", null).neq("to_number", "");
  const filteredDialData = (dialData || []).filter((row) => {
    const duration = row.call_duration;
    const status = (row.call_status || "").toLowerCase();
    const durationOrStatus = duration && duration >= 1 || ["answered", "completed"].includes(status);
    const notExcluded = !["failed", "busy", "no-answer", "canceled"].includes(status);
    return durationOrStatus && notExcluded;
  });
  const dialedPhones = /* @__PURE__ */ new Set();
  filteredDialData.forEach((r) => {
    if (r.to_number) {
      const phone = String(r.to_number).trim().replace(/\D/g, "").slice(-10);
      if (phone && phone.length >= 10) {
        dialedPhones.add(phone);
      }
    }
  });
  const dialed = dialedPhones.size;
  const { data: reachData } = await supabaseAdmin.from("agent_dial_metrics").select("lead_phone").eq("agent_email", normalizedEmail).eq("event_type", "reach").gte("event_timestamp", startIso).lt("event_timestamp", endIso).not("lead_phone", "is", null);
  const reachedPhones = /* @__PURE__ */ new Set();
  (reachData || []).forEach((r) => {
    if (r.lead_phone) reachedPhones.add(String(r.lead_phone).trim());
  });
  const reached = reachedPhones.size;
  const { data: bookedData } = await supabaseAdmin.from("agent_dial_metrics").select("lead_phone").eq("agent_email", normalizedEmail).in("event_type", ["booked", "instant_presentation"]).gte("event_timestamp", startIso).lt("event_timestamp", endIso).not("lead_phone", "is", null);
  const bookedPhones = /* @__PURE__ */ new Set();
  (bookedData || []).forEach((r) => {
    if (r.lead_phone) bookedPhones.add(String(r.lead_phone).trim());
  });
  const booked = bookedPhones.size;
  const dialToConnectRate = dialed > 0 ? Math.min(100, reached / dialed * 100) : 0;
  const appointmentBookRate = reached > 0 ? Math.min(100, booked / reached * 100) : 0;
  const presentationRate = 0;
  const closingRate = 0;
  const followUpConsistency = 0;
  const leadQualityScore = 0;
  const sampleSize = dialed + reached + booked;
  const { data: upserted, error } = await supabaseAdmin.rpc("upsert_aoi_score", {
    p_associate_id: associateId,
    p_agent_email: agentEmail,
    p_dial_to_connect_rate: dialToConnectRate,
    p_appointment_book_rate: appointmentBookRate,
    p_presentation_rate: presentationRate,
    p_closing_rate: closingRate,
    p_follow_up_consistency: followUpConsistency,
    p_lead_quality_score: leadQualityScore,
    p_sample_size: sampleSize,
    p_date_range_start: startIso,
    p_date_range_end: endIso
  });
  if (error) {
    if (error.code === "42883") {
      const { error: insErr } = await supabaseAdmin.from("aoi_score_tracker").upsert(
        {
          associate_id: associateId,
          agent_email: agentEmail,
          dial_to_connect_rate: dialToConnectRate,
          appointment_book_rate: appointmentBookRate,
          presentation_rate: presentationRate,
          closing_rate: closingRate,
          follow_up_consistency: followUpConsistency,
          lead_quality_score: leadQualityScore,
          sample_size: sampleSize,
          date_range_start: startIso,
          date_range_end: endIso,
          calculated_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        { onConflict: "associate_id" }
      );
      if (insErr) {
        console.error("\u274C AOI Score: Upsert failed:", insErr);
        return null;
      }
      return getAOIScoreByAssociateId(associateId);
    }
    console.error("\u274C AOI Score: RPC upsert_aoi_score failed:", error);
    return null;
  }
  if (upserted) {
    return {
      associateId: upserted.associate_id,
      agentEmail: upserted.agent_email ?? null,
      dialToConnectRate: Number(upserted.dial_to_connect_rate ?? 0),
      appointmentBookRate: Number(upserted.appointment_book_rate ?? 0),
      presentationRate: Number(upserted.presentation_rate ?? 0),
      closingRate: Number(upserted.closing_rate ?? 0),
      followUpConsistency: Number(upserted.follow_up_consistency ?? 0),
      leadQualityScore: Number(upserted.lead_quality_score ?? 0),
      aoiScore: Number(upserted.aoi_score ?? 0),
      performanceTier: upserted.performance_tier ?? "needs_improvement",
      sampleSize: Number(upserted.sample_size ?? 0),
      dateRangeStart: upserted.date_range_start ?? null,
      dateRangeEnd: upserted.date_range_end ?? null,
      calculatedAt: upserted.calculated_at ?? (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: upserted.updated_at ?? (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  return getAOIScoreByAssociateId(associateId);
}
var init_aoi_score_service = __esm({
  "server/aoi-score-service.ts"() {
    "use strict";
    init_supabase();
  }
});

// server/connectnow-service.ts
import { eq, desc, and, count, avg, gte, lt } from "drizzle-orm";
var ConnectNowService, connectnowService;
var init_connectnow_service = __esm({
  "server/connectnow-service.ts"() {
    "use strict";
    init_db();
    init_supabase();
    init_local_masterlead_client();
    init_hardcoded_config();
    init_schema();
    ConnectNowService = class _ConnectNowService {
      creditsQueryPausedUntil = 0;
      creditsWarned = false;
      static CREDITS_QUERY_COOLDOWN_MS = 15e3;
      buildEmptyCredits(email) {
        return {
          credits_remaining: 0,
          credits_used: 0,
          credits_purchased: 0,
          associate_id: 0,
          aoi_connect_credits_used: 0,
          aoi_plus_credits_used: 0,
          aoi_precheck_credits_used: 0,
          aoi_recruit_credits_used: 0,
          name: "No Data",
          email
        };
      }
      isCreditsInfraError(err) {
        const raw = String(err?.message || err || "").toLowerCase();
        const code = String(err?.code || "").toUpperCase();
        return code === "42P01" || raw.includes('relation "user_credits" does not exist') || raw.includes("timeout exceeded when trying to connect") || raw.includes("query read timeout") || raw.includes("query timeout");
      }
      pauseCreditsLookup(reason) {
        this.creditsQueryPausedUntil = Date.now() + _ConnectNowService.CREDITS_QUERY_COOLDOWN_MS;
        if (!this.creditsWarned) {
          this.creditsWarned = true;
          console.warn(
            "\u26A0\uFE0F Credits lookup temporarily paused (cooldown):",
            reason instanceof Error ? reason.message : String(reason)
          );
        }
      }
      // Call Management
      async createCallLog(callData) {
        const [callLog] = await db.insert(callLogs).values(callData).returning();
        return callLog;
      }
      // User Management
      async createUser(userData) {
        const [user] = await db.insert(connectnowUsers).values(userData).returning();
        await db.insert(userCredits).values({
          email: userData.email,
          creditsRemaining: 100
          // Starting credits
        }).onConflictDoNothing();
        await db.insert(userGameStats).values({
          userId: user.id
        }).onConflictDoNothing();
        return user;
      }
      async getUserByEmail(email) {
        const [user] = await db.select().from(connectnowUsers).where(eq(connectnowUsers.email, email));
        return user;
      }
      async getUserBySupabaseId(supabaseUserId) {
        const [user] = await db.select().from(connectnowUsers).where(eq(connectnowUsers.supabaseUserId, supabaseUserId));
        return user;
      }
      async updateUser(userId, updates) {
        const [user] = await db.update(connectnowUsers).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(connectnowUsers.id, userId)).returning();
        return user;
      }
      // Team Management
      async createTeam(teamData) {
        const [team] = await db.insert(teams).values(teamData).returning();
        return team;
      }
      async getTeams() {
        return await db.select().from(teams).where(eq(teams.isActive, true));
      }
      async getTeamById(teamId) {
        const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
        return team;
      }
      async getTeamMembers(teamId) {
        return await db.select().from(connectnowUsers).where(and(
          eq(connectnowUsers.teamId, teamId),
          eq(connectnowUsers.isActive, true)
        ));
      }
      // Role Management
      async createRole(roleData) {
        const [role] = await db.insert(roles).values(roleData).returning();
        return role;
      }
      async getRoles() {
        return await db.select().from(roles).where(eq(roles.isActive, true));
      }
      // Call Management
      async logCall(callData) {
        const [call] = await db.insert(callLogs).values({
          agentEmail: callData.userId,
          twilioCallSid: `ccp-${Date.now()}`,
          toNumber: callData.phoneNumber || "",
          fromNumber: "+19142289324",
          callStatus: callData.status,
          callDuration: callData.duration || 0,
          callStartedAt: /* @__PURE__ */ new Date(),
          isReached: false,
          isBooked: false
        }).returning();
        await this.updateUserGameStats(callData.userId, {
          totalCalls: 1,
          successfulCalls: callData.status === "completed" ? 1 : 0
        });
        return call;
      }
      async getUserCalls(userId, limit = 10) {
        return await db.select().from(callLogs).where(eq(callLogs.userId, userId)).orderBy(desc(callLogs.createdAt)).limit(limit);
      }
      async logVdpCall(callData) {
        const [call] = await db.insert(vdpCalls).values(callData).returning();
        return call;
      }
      // Dashboard Statistics
      async getDashboardStats(userId) {
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        const [todayCallsResult] = await db.select({ count: count() }).from(callLogs).where(eq(callLogs.createdAt, today));
        const [activeAgentsResult] = await db.select({ count: count() }).from(connectnowUsers).where(eq(connectnowUsers.isActive, true));
        const [successRateResult] = await db.select({
          total: count(),
          successful: count(callLogs.status)
        }).from(callLogs).where(eq(callLogs.status, "completed"));
        const successRate = successRateResult.total > 0 ? Math.round(successRateResult.successful / successRateResult.total * 100) : 0;
        const [avgTimeResult] = await db.select({ avgDuration: avg(callLogs.duration) }).from(callLogs).where(eq(callLogs.status, "completed"));
        const avgCallTime = avgTimeResult.avgDuration ? `${Math.floor(Number(avgTimeResult.avgDuration) / 60)}:${(Number(avgTimeResult.avgDuration) % 60).toString().padStart(2, "0")}` : "0:00";
        return {
          todayCalls: todayCallsResult.count,
          activeAgents: activeAgentsResult.count,
          successRate,
          avgCallTime,
          callsChange: 0,
          // Calculate based on yesterday's data
          teamCalls: 0,
          teamSuccessRate: 0,
          teamMembers: 0
        };
      }
      async getRecentCalls(dateRange = "today", userId, limit = 10) {
        try {
          const { createClient: createClient4 } = await import("@supabase/supabase-js");
          const supabaseUrl2 = HARDCODED_CONFIG.SUPABASE_URL;
          const supabaseKey = HARDCODED_CONFIG.SUPABASE_ANON_KEY;
          console.log("\u{1F50D} Checking Supabase connection for call history...");
          if (supabaseUrl2 && supabaseKey) {
            const supabase2 = createClient4(supabaseUrl2, supabaseKey);
            let query = supabase2.from("vdp_calls").select("*").order("created_at", { ascending: false }).limit(limit);
            if (userId) {
              query = query.eq("agent_email", userId);
            }
            const { data: supabaseCalls, error } = await query;
            console.log("\u{1F4DE} Supabase VDP calls query result:", { count: supabaseCalls?.length || 0, error: error?.message });
            if (supabaseCalls && supabaseCalls.length > 0) {
              console.log("\u{1F4CB} First VDP call record columns:", Object.keys(supabaseCalls[0]));
              console.log("\u{1F4CB} Sample raw_webhook_data:", supabaseCalls[0].raw_webhook_data);
            }
            let aoiIntelCalls = [];
            if (supabaseAdmin) {
              try {
                const now2 = /* @__PURE__ */ new Date();
                let startDate2;
                switch (dateRange) {
                  case "yesterday":
                    startDate2 = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate() - 1);
                    break;
                  case "week":
                    startDate2 = new Date(now2.getTime() - 7 * 24 * 60 * 60 * 1e3);
                    break;
                  case "month":
                    startDate2 = new Date(now2.getFullYear(), now2.getMonth(), 1);
                    break;
                  case "all":
                    startDate2 = /* @__PURE__ */ new Date(0);
                    break;
                  default:
                    startDate2 = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate());
                }
                let aoiQuery = masterleadClient2.from("masterlead").select("*").eq("cnresolution", "AOIntel").gte("created_at", startDate2.toISOString()).order("created_at", { ascending: false }).limit(limit);
                if (userId) {
                  aoiQuery = aoiQuery.eq("cn_email", userId);
                }
                const { data: aoiCalls, error: aoiError } = await aoiQuery;
                if (!aoiError && aoiCalls) {
                  console.log(`\u{1F4DE} Found ${aoiCalls.length} AOIntel calls from masterlead`);
                  aoiIntelCalls = aoiCalls.map((call) => ({
                    id: `aoi-${call.id}`,
                    agent_email: call.cn_email,
                    first_name: call.first_name,
                    last_name: call.last_name,
                    phone: call.phone,
                    phone_number: call.phone,
                    caller_phone: call.phone,
                    market: call.taalk_market || "AOIntel",
                    state: call.state || call.taalk_state,
                    created_at: call.created_at,
                    call_status: "completed",
                    call_duration: 0,
                    raw_webhook_data: {
                      first_name: call.first_name,
                      last_name: call.last_name,
                      phone: call.phone,
                      clientphone: call.phone,
                      clientmarket: call.taalk_market,
                      clientstate: call.state || call.taalk_state,
                      company_email: call.cn_email,
                      LeadId: call.taalk_lead_id || call.id,
                      lead_id: call.taalk_lead_id || call.id,
                      event: "AOIntel",
                      call_status: "completed"
                    }
                  }));
                }
              } catch (aoiError) {
                console.warn("\u26A0\uFE0F Error fetching AOIntel calls:", aoiError);
              }
            }
            if (!error && supabaseCalls) {
              console.log("\u2705 Using Supabase VDP calls for call history");
              const allCalls = [...supabaseCalls, ...aoiIntelCalls];
              allCalls.sort((a, b) => {
                const dateA = new Date(a.created_at).getTime();
                const dateB = new Date(b.created_at).getTime();
                return dateB - dateA;
              });
              return allCalls.slice(0, limit).map((call) => {
                let webhookData = {};
                try {
                  if (call.raw_webhook_data && typeof call.raw_webhook_data === "object") {
                    webhookData = call.raw_webhook_data;
                  } else if (call.raw_webhook_data && typeof call.raw_webhook_data === "string") {
                    webhookData = JSON.parse(call.raw_webhook_data);
                  }
                } catch (error2) {
                  console.log("Error parsing raw_webhook_data:", error2);
                }
                const getName = () => {
                  if (webhookData.first_name && webhookData.last_name) {
                    return `${webhookData.first_name} ${webhookData.last_name}`.trim();
                  }
                  if (webhookData.caller_name || webhookData.name) {
                    return webhookData.caller_name || webhookData.name;
                  }
                  if (call.first_name && call.last_name) {
                    return `${call.first_name} ${call.last_name}`.trim();
                  }
                  if (call.notes) {
                    return call.notes;
                  }
                  return "Unknown Contact";
                };
                const getPhoneNumber = () => {
                  return webhookData.clientphone || webhookData.phone || webhookData.phone_number || webhookData.caller_number || call.phone || call.phone_number || call.caller_phone || "N/A";
                };
                const getLeadId = () => {
                  return webhookData.LeadId || webhookData.lead_id || webhookData.campaign_id || webhookData.id || call.lead_id || call.session_id || "N/A";
                };
                const getMarket = () => {
                  return webhookData.clientmarket || webhookData.market || webhookData.campaign_type || webhookData.lead_type || call.market || "General";
                };
                const getState = () => {
                  return webhookData.clientstate || webhookData.state || webhookData.location || webhookData.region || call.state || "N/A";
                };
                const getStatus = () => {
                  if (webhookData.event === "PICK_UP") return "answered";
                  if (webhookData.event === "HANG_UP") return "completed";
                  return webhookData.call_status || webhookData.status || webhookData.disposition || call.call_status || "completed";
                };
                const getDuration = () => {
                  return webhookData.duration || webhookData.call_duration || call.call_duration || 0;
                };
                const getClientEmail = () => {
                  return webhookData.clientemail || webhookData.email || webhookData.client_email || "";
                };
                const getClientCity = () => {
                  return webhookData.clientcity || webhookData.city || webhookData.client_city || "";
                };
                const getClientAddress = () => {
                  return webhookData.clientaddress || webhookData.address || webhookData.client_address || "";
                };
                const getSecretKey = () => {
                  return webhookData.clientsecretkey || webhookData.secret_key || webhookData.secretkey || "";
                };
                const getAssociateId = () => {
                  return webhookData.associate_id || webhookData.agent_id || call.campaign_id || "";
                };
                return {
                  id: call.id,
                  userId: call.agent_email || call.user_email || webhookData.company_email || "unknown",
                  sessionId: getLeadId(),
                  callType: "inbound",
                  duration: getDuration(),
                  status: getStatus(),
                  phoneNumber: getPhoneNumber(),
                  notes: getName(),
                  market: getMarket(),
                  state: getState(),
                  createdAt: new Date(call.created_at),
                  // Additional fields for detailed view
                  clientEmail: getClientEmail(),
                  clientCity: getClientCity(),
                  clientAddress: getClientAddress(),
                  secretKey: getSecretKey(),
                  associateId: getAssociateId(),
                  rawWebhookData: webhookData
                  // Include raw data for maximum flexibility
                };
              });
            }
          }
        } catch (error) {
          console.log("\u26A0\uFE0F Supabase not available, falling back to PostgreSQL:", error);
        }
        const now = /* @__PURE__ */ new Date();
        let startDate;
        switch (dateRange) {
          case "yesterday":
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            break;
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
            break;
          case "month":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case "all":
            if (userId) {
              return await db.select().from(callLogs).where(eq(callLogs.userId, userId)).orderBy(desc(callLogs.createdAt)).limit(limit);
            } else {
              return await db.select().from(callLogs).orderBy(desc(callLogs.createdAt)).limit(limit);
            }
          default:
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        const endDate = dateRange === "yesterday" ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(now.getTime() + 24 * 60 * 60 * 1e3);
        let baseQuery = db.select().from(callLogs).where(and(
          gte(callLogs.createdAt, startDate),
          lt(callLogs.createdAt, endDate)
        )).orderBy(desc(callLogs.createdAt)).limit(limit);
        if (userId) {
          baseQuery = db.select().from(callLogs).where(and(
            gte(callLogs.createdAt, startDate),
            lt(callLogs.createdAt, endDate),
            eq(callLogs.userId, userId)
          )).orderBy(desc(callLogs.createdAt)).limit(limit);
        }
        return await baseQuery;
      }
      async getUserStats(userId) {
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return {
          callsToday: 0,
          callsWeek: 0,
          streak: 0
        };
      }
      // Experience Management Methods
      async awardUserExperience(userEmail, experience) {
        try {
          const { data: userData } = await supabaseAdmin.from("user-credits").select("*").eq("email", userEmail).single();
          if (userData) {
            const { data: updatedUser, error } = await supabaseAdmin.from("user-credits").update({
              total_experience: (userData.total_experience || 0) + experience,
              level: Math.floor(((userData.total_experience || 0) + experience) / 100) + 1,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("email", userEmail).select().single();
            if (error) throw error;
            return updatedUser;
          } else {
            const [user] = await db.select().from(connectnowUsers).where(eq(connectnowUsers.email, userEmail));
            if (!user) {
              throw new Error("User not found");
            }
            const [gameStats] = await db.select().from(userGameStats).where(eq(userGameStats.userId, user.id));
            const newXp = (gameStats?.xp || 0) + experience;
            const newLevel = Math.floor(newXp / 100) + 1;
            await db.update(userGameStats).set({
              xp: newXp,
              level: newLevel,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq(userGameStats.userId, user.id));
            return {
              total_experience: newXp,
              level: newLevel,
              experience_to_next_level: 100 - newXp % 100
            };
          }
        } catch (error) {
          console.error("Error awarding experience:", error);
          throw error;
        }
      }
      async getUserExperience(userEmail) {
        try {
          const { data: userData } = await supabaseAdmin.from("user-credits").select("*").eq("email", userEmail).single();
          if (userData) {
            return {
              total_experience: userData.total_experience || 0,
              level: userData.level || 1,
              experience_to_next_level: 100 - (userData.total_experience || 0) % 100,
              connects_reviewed: userData.connects_reviewed || 0,
              sales_made: userData.sales_made || 0
            };
          } else {
            const [user] = await db.select().from(connectnowUsers).where(eq(connectnowUsers.email, userEmail));
            if (!user) {
              return null;
            }
            const [gameStats] = await db.select().from(userGameStats).where(eq(userGameStats.userId, user.id));
            const xp = gameStats?.xp || 0;
            const level = Math.floor(xp / 100) + 1;
            return {
              total_experience: xp,
              level,
              experience_to_next_level: 100 - xp % 100,
              connects_reviewed: gameStats?.totalCalls || 0,
              sales_made: gameStats?.successfulCalls || 0
            };
          }
        } catch (error) {
          console.error("Error getting user experience:", error);
          return null;
        }
      }
      // Gamification
      async updateUserGameStats(userId, updates) {
        const [currentStats] = await db.select().from(userGameStats).where(eq(userGameStats.userId, userId));
        if (!currentStats) {
          await db.insert(userGameStats).values({
            userId,
            totalCalls: updates.totalCalls || 0,
            successfulCalls: updates.successfulCalls || 0,
            xp: updates.xp || 0
          });
          return;
        }
        const newTotalCalls = (currentStats.totalCalls || 0) + (updates.totalCalls || 0);
        const newSuccessfulCalls = (currentStats.successfulCalls || 0) + (updates.successfulCalls || 0);
        const newXp = (currentStats.xp || 0) + (updates.xp || 0);
        const newLevel = Math.floor(newXp / 1e3) + 1;
        await db.update(userGameStats).set({
          totalCalls: newTotalCalls,
          successfulCalls: newSuccessfulCalls,
          xp: newXp,
          level: newLevel,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(userGameStats.userId, userId));
      }
      async getUserGameStats(userId) {
        const [stats] = await db.select().from(userGameStats).where(eq(userGameStats.userId, userId));
        if (!stats) return void 0;
        const allUsers = await db.select().from(userGameStats).orderBy(desc(userGameStats.xp));
        const leaderboardPosition = allUsers.findIndex((user) => user.userId === userId) + 1;
        return {
          ...stats,
          leaderboardPosition
        };
      }
      // Credits Management - RESTORED SUPABASE CREDIT SYSTEM
      /** Short TTL: HeaderToolbar + many routes call this; avoids Supabase stampede under load */
      creditsByEmailCache = /* @__PURE__ */ new Map();
      static CREDITS_CACHE_MS = 1e4;
      bustCreditsCache(email) {
        this.creditsByEmailCache.delete(email.toLowerCase().trim());
      }
      async getUserCredits(email) {
        const key = email.toLowerCase().trim();
        const hit = this.creditsByEmailCache.get(key);
        if (hit && Date.now() < hit.exp) return hit.data;
        if (Date.now() < this.creditsQueryPausedUntil) {
          const empty = this.buildEmptyCredits(email);
          this.creditsByEmailCache.set(key, { exp: Date.now() + _ConnectNowService.CREDITS_CACHE_MS, data: empty });
          return empty;
        }
        this.creditsWarned = false;
        try {
          if (supabaseAdmin) {
            const { data, error } = await supabaseAdmin.from("user_credits").select("*").eq("email", email.toLowerCase()).single();
            if (!error && data) {
              const row = {
                credits_remaining: data.credits_remaining || 0,
                credits_used: data.credits_used || 0,
                credits_purchased: data.credits_purchased || 0,
                associate_id: data.associate_id || 0,
                aoi_connect_credits_used: data.aoi_connect_credits_used || 0,
                aoi_plus_credits_used: data.aoi_plus_credits_used || 0,
                aoi_precheck_credits_used: data.aoi_precheck_credits_used || 0,
                aoi_recruit_credits_used: data.aoi_recruit_credits_used || 0,
                name: data.name || "Agent",
                email
              };
              this.creditsByEmailCache.set(key, { exp: Date.now() + _ConnectNowService.CREDITS_CACHE_MS, data: row });
              return row;
            }
            if (error && this.isCreditsInfraError(error)) {
              this.pauseCreditsLookup(error);
              const empty2 = this.buildEmptyCredits(email);
              this.creditsByEmailCache.set(key, { exp: Date.now() + _ConnectNowService.CREDITS_CACHE_MS, data: empty2 });
              return empty2;
            }
          }
          const [user] = await db.select().from(userCredits).where(eq(userCredits.email, email.toLowerCase()));
          if (user) {
            this.creditsByEmailCache.set(key, { exp: Date.now() + _ConnectNowService.CREDITS_CACHE_MS, data: user });
            return user;
          }
          const empty = this.buildEmptyCredits(email);
          this.creditsByEmailCache.set(key, { exp: Date.now() + _ConnectNowService.CREDITS_CACHE_MS, data: empty });
          return empty;
        } catch (error) {
          if (this.isCreditsInfraError(error)) {
            this.pauseCreditsLookup(error);
            const empty = this.buildEmptyCredits(email);
            this.creditsByEmailCache.set(key, { exp: Date.now() + _ConnectNowService.CREDITS_CACHE_MS, data: empty });
            return empty;
          }
          console.error("\u274C Exception in disabled credits service:", error);
          return this.buildEmptyCredits(email);
        }
      }
      async awardUserCredits(email, creditsToAdd) {
        this.bustCreditsCache(email);
        console.log(`\u{1F389} Awarding ${creditsToAdd} credit(s) to ${email} for reviewing connects`);
        if (supabaseAdmin) {
          try {
            const { data: currentData, error: getCurrentError } = await supabaseAdmin.from("user_credits").select("*").eq("email", email.toLowerCase()).single();
            if (getCurrentError && getCurrentError.code === "PGRST116") {
              const { data: data2, error: error2 } = await supabaseAdmin.from("user_credits").insert({
                email: email.toLowerCase(),
                credits_remaining: creditsToAdd,
                credits_purchased: creditsToAdd,
                credits_used: 0,
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              }).select().single();
              if (error2) {
                console.error("Error creating credit record in Supabase:", error2);
                throw error2;
              }
              console.log(`\u2705 Created new credit record with ${creditsToAdd} credits for ${email}`);
              return data2;
            }
            if (getCurrentError) {
              console.error("Error getting current credits from Supabase:", getCurrentError);
              throw getCurrentError;
            }
            const newCreditsRemaining2 = (currentData.credits_remaining || 0) + creditsToAdd;
            const newCreditsPurchased2 = (currentData.credits_purchased || 0) + creditsToAdd;
            const { data, error } = await supabaseAdmin.from("user_credits").update({
              credits_remaining: newCreditsRemaining2,
              credits_purchased: newCreditsPurchased2,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("email", email.toLowerCase()).select().single();
            if (error) {
              console.error("Error updating credits in Supabase:", error);
              throw error;
            }
            console.log(`\u2705 Awarded ${creditsToAdd} credits to ${email}, new balance: ${newCreditsRemaining2}`);
            return data;
          } catch (error) {
            console.error("Supabase credit award failed, falling back to local database:", error);
          }
        }
        console.log("Using local database for credit award");
        const [currentCredits] = await db.select().from(userCredits).where(eq(userCredits.email, email));
        if (!currentCredits) {
          const [newRecord] = await db.insert(userCredits).values({
            email,
            creditsRemaining: creditsToAdd,
            creditsPurchased: creditsToAdd,
            creditsUsed: 0,
            createdAt: /* @__PURE__ */ new Date(),
            updatedAt: /* @__PURE__ */ new Date()
          }).returning();
          console.log(`\u2705 Created local credit record with ${creditsToAdd} credits for ${email}`);
          return {
            credits_remaining: newRecord.creditsRemaining,
            credits_purchased: newRecord.creditsPurchased,
            credits_used: newRecord.creditsUsed
          };
        }
        const newCreditsRemaining = (currentCredits.creditsRemaining || 0) + creditsToAdd;
        const newCreditsPurchased = (currentCredits.creditsPurchased || 0) + creditsToAdd;
        const [updatedRecord] = await db.update(userCredits).set({
          creditsRemaining: newCreditsRemaining,
          creditsPurchased: newCreditsPurchased,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(userCredits.email, email)).returning();
        console.log(`\u2705 Awarded ${creditsToAdd} credits to ${email}, new balance: ${newCreditsRemaining}`);
        return {
          credits_remaining: updatedRecord.creditsRemaining,
          credits_purchased: updatedRecord.creditsPurchased,
          credits_used: updatedRecord.creditsUsed
        };
      }
      async addUserCredits(email, creditsToAdd) {
        this.bustCreditsCache(email);
        console.log(`\u{1F504} Adding ${creditsToAdd} credits to ${email}`);
        if (supabaseAdmin) {
          try {
            const { data: existingRecord, error: fetchError } = await supabaseAdmin.from("user_credits").select("*").eq("email", email).single();
            if (fetchError && fetchError.code !== "PGRST116") {
              throw fetchError;
            }
            if (existingRecord) {
              const { data: updatedRecord, error: updateError } = await supabaseAdmin.from("user_credits").update({
                credits_purchased: (existingRecord.credits_purchased || 0) + creditsToAdd,
                credits_remaining: (existingRecord.credits_remaining || 0) + creditsToAdd,
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              }).eq("email", email).select().single();
              if (updateError) throw updateError;
              console.log(`\u2705 Updated Supabase credits for ${email}:`, updatedRecord);
              return updatedRecord;
            } else {
              const { data: newRecord, error: insertError } = await supabaseAdmin.from("user_credits").insert({
                email,
                credits_purchased: creditsToAdd,
                credits_remaining: creditsToAdd,
                credits_used: 0,
                created_at: (/* @__PURE__ */ new Date()).toISOString(),
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              }).select().single();
              if (insertError) throw insertError;
              console.log(`\u2705 Created new Supabase credits for ${email}:`, newRecord);
              return newRecord;
            }
          } catch (supabaseError) {
            console.error("Supabase credit add error:", supabaseError);
            console.log("Falling back to local database");
          }
        }
        const [existingCredits] = await db.select().from(userCredits).where(eq(userCredits.email, email));
        if (existingCredits) {
          const [updatedCredits] = await db.update(userCredits).set({
            creditsPurchased: (existingCredits.creditsPurchased || 0) + creditsToAdd,
            creditsRemaining: (existingCredits.creditsRemaining || 0) + creditsToAdd,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(userCredits.email, email)).returning();
          console.log(`\u2705 Updated local credits for ${email}:`, updatedCredits);
          return updatedCredits;
        } else {
          const [newCredits] = await db.insert(userCredits).values({
            email,
            creditsPurchased: creditsToAdd,
            creditsRemaining: creditsToAdd,
            creditsUsed: 0
          }).returning();
          console.log(`\u2705 Created new local credits for ${email}:`, newCredits);
          return newCredits;
        }
      }
      async updateUserCredits(email, change) {
        const [credits] = await db.select().from(userCredits).where(eq(userCredits.email, email));
        if (!credits) {
          await db.insert(userCredits).values({
            email,
            creditsRemaining: Math.max(0, change),
            creditsUsed: change < 0 ? Math.abs(change) : 0
          });
          return;
        }
        const newCreditsRemaining = Math.max(0, (credits.creditsRemaining || 0) + change);
        const newCreditsUsed = change < 0 ? (credits.creditsUsed || 0) + Math.abs(change) : credits.creditsUsed || 0;
        await db.update(userCredits).set({
          creditsRemaining: newCreditsRemaining,
          creditsUsed: newCreditsUsed,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(userCredits.email, email));
      }
      // Dialer Service
      async getDialerStats(userId) {
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        const [callsTodayResult] = await db.select({ count: count() }).from(callLogs).where(and(
          eq(callLogs.userId, userId),
          eq(callLogs.createdAt, today)
        ));
        const [connectRateResult] = await db.select({
          total: count(),
          connected: count(callLogs.status)
        }).from(callLogs).where(and(
          eq(callLogs.userId, userId),
          eq(callLogs.status, "completed")
        ));
        const connectRate = connectRateResult.total > 0 ? Math.round(connectRateResult.connected / connectRateResult.total * 100) : 0;
        const recentCalls = await this.getUserCalls(userId, 5);
        return {
          callsToday: callsTodayResult.count,
          connectRate,
          recentCalls: recentCalls.map((call) => ({
            number: call.phoneNumber,
            status: call.status,
            duration: call.duration
          })),
          leadsRemaining: 50
          // Mock data for now
        };
      }
      // API call logging method
      async logOutboundCall(callData) {
        const [call] = await db.insert(callLogs).values(callData).returning();
        await this.updateUserGameStats(callData.userId, {
          totalCalls: 1,
          successfulCalls: callData.status === "completed" ? 1 : 0
        });
        return call;
      }
    };
    connectnowService = new ConnectNowService();
  }
});

// server/production-rank-service.ts
import { sql as sql3 } from "drizzle-orm";
import { subDays as subDays2 } from "date-fns";
function getRankOrder(rank) {
  return RANK_ORDER[rank] ?? 0;
}
function normProduction(raw) {
  return Math.min(100, raw / 80 * 100);
}
function normPlusLeads(raw) {
  return Math.min(100, raw * 5);
}
function normCallScore(raw) {
  return Math.min(100, raw);
}
function normAoiUsage(raw) {
  return Math.min(100, raw / 300 * 100);
}
function compositeScore(inputs) {
  const p = normProduction(inputs.production);
  const pl = normPlusLeads(inputs.plusLeads);
  const c = normCallScore(inputs.callScore);
  const a = normAoiUsage(inputs.aoiUsage);
  return p * WEIGHTS.production + pl * WEIGHTS.plusLeads + c * WEIGHTS.callScore + a * WEIGHTS.aoiUsage;
}
function scoreToRank(score) {
  if (score >= 75) return "platinum";
  if (score >= 50) return "gold";
  if (score >= 25) return "silver";
  return "bronze";
}
async function fetchProduction(agentEmail) {
  if (!supabaseAdmin) return 0;
  const start = subDays2(/* @__PURE__ */ new Date(), 30).toISOString();
  const end = (/* @__PURE__ */ new Date()).toISOString();
  const { data, error } = await supabaseAdmin.from("war_connects").select("id, sale_amount").eq("agent_email", agentEmail.toLowerCase()).gte("connect_date", start).lt("connect_date", end);
  if (error) return 0;
  const count2 = data?.length ?? 0;
  const totalRevenue = (data ?? []).reduce((sum2, r) => sum2 + Number(r.sale_amount ?? 0), 0);
  return Math.max(count2 * 50, totalRevenue / 50);
}
async function fetchPlusLeads(agentEmail) {
  try {
    const start = subDays2(/* @__PURE__ */ new Date(), 30);
    const startStr = start.toISOString().slice(0, 10);
    const email = agentEmail.replace(/'/g, "''");
    const result = await db.execute(sql3.raw(
      `SELECT COALESCE(SUM(plus_leads_collected), 0)::float as total FROM daily_accountability WHERE agent_email = '${email}' AND accountability_date >= '${startStr}'`
    ));
    const row = result?.rows?.[0];
    return Number(row?.total ?? 0);
  } catch {
    return 0;
  }
}
async function fetchCallScore(agentEmail) {
  let score = await getAOIScoreByEmail(agentEmail);
  if (!score) {
    const associateId = await getAssociateIdByEmail(agentEmail);
    if (associateId) score = await calculateAndUpsertAOIScore(associateId, agentEmail);
  }
  return score?.aoiScore ?? 0;
}
async function fetchAoiUsage(agentEmail) {
  const credits = await connectnowService.getUserCredits(agentEmail);
  const used = credits?.credits_used ?? 0;
  const connectUsed = credits?.aoi_connect_credits_used ?? 0;
  return Number(used) + Number(connectUsed);
}
async function getRankForEmail(agentEmail) {
  if (!agentEmail?.trim()) return null;
  const email = agentEmail.trim().toLowerCase();
  const [production, plusLeads, callScore, aoiUsage] = await Promise.all([
    fetchProduction(email),
    fetchPlusLeads(email),
    fetchCallScore(email),
    fetchAoiUsage(email)
  ]);
  const inputs = { production, plusLeads, callScore, aoiUsage };
  const score = compositeScore(inputs);
  const rank = scoreToRank(score);
  const currentIndex = PRODUCTION_RANK_TIERS.findIndex((t) => t.id === rank);
  let nextTier;
  if (currentIndex >= 0 && currentIndex < PRODUCTION_RANK_TIERS.length - 1) {
    const next = PRODUCTION_RANK_TIERS[currentIndex + 1];
    const nextThreshold = currentIndex === 0 ? 25 : currentIndex === 1 ? 50 : 75;
    const prevThreshold = currentIndex === 0 ? 0 : currentIndex === 1 ? 25 : 50;
    const progressPct = Math.round((score - prevThreshold) / (nextThreshold - prevThreshold) * 100);
    nextTier = { name: next.name, requirements: next.requirements, progressPct: Math.min(100, Math.max(0, progressPct)) };
  }
  return {
    rank,
    inputs,
    nextTier,
    tiers: PRODUCTION_RANK_TIERS
  };
}
async function getRankTierForEmail(agentEmail) {
  const result = await getRankForEmail(agentEmail);
  return result?.rank ?? "bronze";
}
var RANK_ORDER, PRODUCTION_RANK_TIERS, WEIGHTS;
var init_production_rank_service = __esm({
  "server/production-rank-service.ts"() {
    "use strict";
    init_supabase();
    init_db();
    init_aoi_score_service();
    init_connectnow_service();
    RANK_ORDER = {
      platinum: 4,
      gold: 3,
      silver: 2,
      bronze: 1
    };
    PRODUCTION_RANK_TIERS = [
      {
        id: "bronze",
        name: "Bronze",
        requirements: "Get started: any activity in Production, Plus Leads, Call Score, or AOI Usage.",
        advantages: ["Access to AO Queue and tools", "Baseline priority for leads and connects"]
      },
      {
        id: "silver",
        name: "Silver",
        requirements: "Reach ~25% of the combined score (Production, Plus Leads, Call Score, AOI Usage).",
        advantages: ["Higher priority on AOI Connects", "Higher priority on AO Queue leads and refreshes"]
      },
      {
        id: "gold",
        name: "Gold",
        requirements: "Reach ~50% of the combined score across all four metrics.",
        advantages: ["Even higher priority on AOI Connects", "Even higher priority on AO Queue leads and refreshes", "Preferred in lead assignment"]
      },
      {
        id: "platinum",
        name: "Platinum",
        requirements: "Reach ~75%+ of the combined score across all four metrics.",
        advantages: ["Highest priority on AOI Connects", "Highest priority on AO Queue leads and refreshes", "First in line for new Hot Leads", "Peak performance tier"]
      }
    ];
    WEIGHTS = { production: 0.4, plusLeads: 0.2, callScore: 0.25, aoiUsage: 0.15 };
  }
});

// server/hotlead-sync-service.ts
var TOTAL_ASSIGNED_LEAD_CAP, HotleadSyncService, hotleadSyncService;
var init_hotlead_sync_service = __esm({
  "server/hotlead-sync-service.ts"() {
    "use strict";
    init_supabase();
    init_production_rank_service();
    TOTAL_ASSIGNED_LEAD_CAP = 300;
    HotleadSyncService = class {
      taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
      taalkBaseUrl = "https://api.taalk.ai/api";
      dbParam = "michaelmandella";
      syncInProgress = false;
      async fetchCallSummary(callId) {
        if (!callId) return null;
        try {
          const url = `${this.taalkBaseUrl}/calls/${callId}/summary?db=${this.dbParam}`;
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.taalkApiKey}`,
              "Content-Type": "application/json"
            }
          });
          if (!response.ok) return null;
          const json = await response.json().catch(() => null);
          const raw = json?.payload?.summary ?? json?.summary ?? null;
          if (raw == null) return null;
          if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
          if (Array.isArray(raw) && raw.length > 0) return JSON.stringify(raw);
          if (typeof raw === "object" && Object.keys(raw).length > 0) return JSON.stringify(raw);
          return null;
        } catch {
          return null;
        }
      }
      // REMOVED: All test/mock data creation functions eliminated per project requirements
      // Database sync - work with existing hotleads instead of API
      async fetchHotleadsFromTaalk(limit = 200, offset = 0, dateRange = "all") {
        console.log(`\u{1F525} Working with existing hotlead database (no API sync needed)`);
        return { success: true, data: [], error: "Using database hotleads instead of API" };
        try {
          console.log(`\u{1F525} Fetching ALL Taalk API calls (limit: ${limit}, offset: ${offset}, range: ${dateRange})`);
          const apiUrl = new URL(`${this.taalkBaseUrl}/calls`);
          apiUrl.searchParams.append("db", this.dbParam);
          apiUrl.searchParams.append("limit", limit.toString());
          apiUrl.searchParams.append("offset", offset.toString());
          apiUrl.searchParams.append("tz", "America/New_York");
          if (dateRange !== "all") {
            apiUrl.searchParams.append("date_range", dateRange);
          }
          console.log(`\u{1F310} Making API request to: ${apiUrl.toString()}`);
          const response = await fetch(apiUrl.toString(), {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${this.taalkApiKey}`,
              "Content-Type": "application/json"
            }
          });
          console.log(`\u{1F4E1} Response status: ${response.status}`);
          console.log(`\u{1F4E1} Response headers:`, Object.fromEntries(response.headers.entries()));
          const responseText = await response.text();
          console.log(`\u{1F4E1} Response preview: ${responseText.substring(0, 200)}...`);
          if (!response.ok) {
            console.error(`\u274C Taalk API error ${response.status}: ${responseText}`);
            return {
              success: false,
              error: `API returned ${response.status}: ${responseText}`
            };
          }
          let apiData;
          try {
            apiData = JSON.parse(responseText);
          } catch (parseError) {
            console.error("\u274C Response is not valid JSON:", parseError);
            return {
              success: false,
              error: `Response is not JSON: ${responseText.substring(0, 100)}...`
            };
          }
          console.log(`\u{1F4DE} API response structure:`, Object.keys(apiData));
          console.log(`\u{1F4DE} Taalk API response: ${apiData.payload?.length || 0} calls received`);
          const hotleads = this.filterHotleadCalls(apiData.payload || []);
          console.log(`\u{1F525} Identified ${hotleads.length} hotleads from ${apiData.payload?.length || 0} calls`);
          return {
            success: true,
            data: hotleads,
            pagination: {
              page: Math.floor(offset / limit) + 1,
              totalPages: Math.ceil((apiData.total || hotleads.length) / limit),
              totalRecords: apiData.total || hotleads.length
            }
          };
        } catch (error) {
          console.error("\u274C Network error:", error);
          return {
            success: false,
            error: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`
          };
        }
      }
      // Filter Taalk calls to identify hotleads based on strict criteria
      filterHotleadCalls(calls) {
        const hotleads = [];
        console.log(`\u{1F50D} Filtering ${calls.length} calls for hotlead criteria...`);
        for (const call of calls) {
          const duration = call.duration || call.durationSeconds || 0;
          const hasTransfer = call.transferred || call.transferStatus || call.transfer_status;
          const humanAnswered = duration > 30;
          const transferLost = hasTransfer && duration < 120;
          const transferCompleted = hasTransfer && call.transferStatus === "completed";
          const humanNoTransfer = humanAnswered && !hasTransfer;
          const isHotlead = humanAnswered && (transferLost || humanNoTransfer || hasTransfer && !transferCompleted);
          if (isHotlead) {
            console.log(`\u{1F525} Hotlead found: ${call.contact?.firstName || call.name} - Duration: ${duration}s, Transfer: ${!!hasTransfer}`);
            if (call.status === "completed" && call.transferStatus === "completed") {
              console.log(`\u23ED\uFE0F Skipping completed transfer: ${call.contact?.firstName || call.name}`);
              continue;
            }
            let hotLeadReason = "";
            if (transferLost) {
              hotLeadReason = "Transfer Lost Quickly";
            } else if (humanAnswered && !hasTransfer) {
              hotLeadReason = "Human Answered - No Transfer";
            } else if (hasTransfer) {
              hotLeadReason = "Transfer Completed";
            }
            console.log(`\u{1F50D} Full call data for ${call.name}:`, JSON.stringify(call, null, 2));
            console.log(`\u{1F50D} DEBUG PARAMS:`, call.params);
            console.log(`\u{1F50D} DEBUG STATE EXTRACTION:`, {
              "call.state": call.state,
              "call.contact?.state": call.contact?.state,
              "call.lead?.state": call.lead?.state,
              "call.params?.Taalk_State": call.params?.Taalk_State,
              "call.params?.Taalk_City": call.params?.Taalk_City,
              "call.params?.Taalk_Market": call.params?.Taalk_Market
            });
            const conversationSummary = call.messages ? call.messages.map((m) => `${m.role}: ${m.content}`).join(" | ") : "";
            const leadEmail = call.email || call.contact?.email || call.lead?.email || call.params?.Taalk_Email || call.params?.email || null;
            const leadCity = call.city || call.contact?.city || call.lead?.city || call.params?.Taalk_City || null;
            const leadState = call.state || call.contact?.state || call.lead?.state || call.params?.Taalk_State || null;
            const hotlead = {
              id: call._id || call.id || call.phone?.replace(/\D/g, "") || `taalk_${call.phone || Date.now()}`,
              firstName: call.contact?.firstName || call.firstName || call.params?.firstName || call.name?.split(" ")[0] || call.name || "Unknown",
              lastName: call.contact?.lastName || call.lastName || call.params?.lastName || call.name?.split(" ").slice(1).join(" ") || "Unknown",
              phone: call.phone || call.contact?.phone || call.phoneNumber || "",
              email: call.contact?.email || call.email || null,
              city: call.contact?.city || call.city || null,
              state: call.contact?.state || call.state || null,
              zip: call.contact?.zip || call.zipCode || null,
              callDate: new Date(call.createdAt || call.startTime || Date.now()).toISOString(),
              callTime: new Date(call.createdAt || call.startTime || Date.now()).toTimeString().split(" ")[0],
              durationSeconds: duration,
              hotLeadReason,
              priorityScore: transferLost ? 8 : humanAnswered ? 6 : 4,
              transferred: !!hasTransfer,
              transferDurationMs: call.transferDuration || null,
              transferStatus: call.transferStatus || call.transfer_status || null,
              taalkCallId: call._id || call.id,
              // Enhanced mapping from actual API response structure with ALL available data
              taalkMarket: call.campaign?.name || call.campaignName || call.market || call.params?.Taalk_Market || "Hot Lead",
              taalkLeadSource: call.source || call.leadSource || call.params?.Taalk_Lead_Source || "Taalk Campaign",
              taalkGroupCode: call.groupCode || call.group_code || call.companyId || call.params?.Taalk_GroupCode || null,
              taalkLeadId: call.leadId || call.lead_id || call._id,
              persona: call.persona || call.triggerName || null,
              recordingUrl: call.recordingUrl || call.recording_url || null,
              // Contact/Lead specific data with enhanced extraction
              taalkState: leadState,
              taalkCity: leadCity,
              taalkEmail: leadEmail,
              taalkAddress: call.contact?.address || call.address || call.lead?.address || null,
              // Insurance/Lead specific fields from API with conversation context
              taalkBeneficiary: call.beneficiary || call.contact?.beneficiary || call.lead?.beneficiary || null,
              taalkRelationship: call.relationship || call.contact?.relationship || call.lead?.relationship || null,
              taalkReffered: call.referredBy || call.referred_by || call.contact?.referredBy || null,
              taalkSponsorOrg: call.sponsorOrg || call.sponsor_org || call.contact?.sponsorOrg || call.companyId || null,
              taalkGroupname: call.campaign?.name || call.groupName || call.group_name || call.campaignName || "Hot Lead",
              // Rich performance and conversation data
              conversationData: conversationSummary ? conversationSummary.substring(0, 500) : null,
              callPerformance: `Duration: ${duration}s, Transfer: ${call.transferType || 0}, AI Error: ${call.AIError || 0}`,
              systemPrompt: call.system ? call.system.substring(0, 200) + "..." : null
              // Store additional fields in taalk_lead_source for now since schema is restricted
              // Will be enhanced once additional columns are available
            };
            hotleads.push(hotlead);
          }
        }
        return hotleads;
      }
      // Insert or update hotlead in Supabase - ENABLED for continuous lead flow
      async upsertHotlead(hotlead) {
        console.log(`\u{1F525} Processing hotlead: ${hotlead.firstName} ${hotlead.lastName} (${hotlead.phone})`);
        try {
          const hotleadData = {
            first_name: hotlead.firstName || "Unknown",
            last_name: hotlead.lastName || "Unknown",
            phone: hotlead.phone,
            email: hotlead.email,
            type: null,
            status: "new",
            notes: `${hotlead.hotLeadReason || "Human Answered"} - Duration: ${hotlead.durationSeconds}s - ${hotlead.taalkMarket || "Hot Lead"}`,
            taalk_market: hotlead.taalkMarket || "Globe Market",
            taalk_state: hotlead.taalkState,
            taalk_city: hotlead.taalkCity,
            taalk_email: hotlead.taalkEmail,
            taalk_address: hotlead.taalkAddress,
            taalk_beneficiary: hotlead.taalkBeneficiary,
            taalk_relationship: hotlead.taalkRelationship,
            taalk_reffered: hotlead.taalkReffered,
            taalk_sponsor_org: hotlead.taalkSponsorOrg,
            taalk_group_code: hotlead.taalkGroupCode,
            taalk_groupname: hotlead.taalkGroupname,
            taalk_lead_id: hotlead.taalkLeadId,
            taalk_lead_source: hotlead.taalkLeadSource || "Taalk AI Call",
            cnresolution: "pending",
            priority_score: hotlead.priorityScore || 10
          };
          if (!supabase) {
            console.error("\u274C Supabase client not available");
            return false;
          }
          const { data: existing } = await supabase.from("hotleads").select("id").eq("taalk_call_id", hotlead.taalkCallId).single();
          if (existing) {
            return true;
          }
          const { error: insertError } = await supabase.from("hotleads").insert([hotleadData]);
          if (insertError) {
            console.error("\u274C Supabase error inserting hotlead:", insertError);
            return false;
          }
          console.log(`\u2705 Inserted hotlead: ${hotlead.firstName} ${hotlead.lastName} (${hotlead.phone})`);
          return true;
        } catch (error) {
          console.error("\u274C Error in upsertHotlead:", error);
          return false;
        }
      }
      // Database management - redistribute existing hotleads
      async syncHotleads(dateRange = "all") {
        console.log(`\u{1F525} Managing existing hotlead database assignments`);
        this.syncInProgress = true;
        console.log("\u{1F4CA} Managing existing hotlead assignments in database");
        try {
          await this.assignHotleads();
          console.log("\u2705 Hotlead assignment management completed");
          return { success: true, newCount: 0, updateCount: 0 };
        } catch (error) {
          console.error("\u274C Error in hotlead assignment management:", error);
          return {
            success: false,
            newCount: 0,
            updateCount: 0,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        } finally {
          this.syncInProgress = false;
        }
        try {
          let totalNew = 0;
          let totalUpdated = 0;
          let offset = 0;
          const limit = 200;
          let hasMore = true;
          let totalProcessed = 0;
          while (hasMore && totalProcessed < 5e3) {
            const result = await this.fetchHotleadsFromTaalk(limit, offset, dateRange);
            if (!result.success) {
              throw new Error(result.error || "Failed to fetch hotleads");
            }
            const hotleads = result.data || [];
            if (hotleads.length === 0) {
              hasMore = false;
              break;
            }
            for (const hotlead of hotleads) {
              if (!supabase) {
                console.warn("\u26A0\uFE0F Supabase client not available - skipping hotlead processing");
                continue;
              }
              try {
                const insertData = {
                  first_name: hotlead.firstName || "Unknown",
                  last_name: hotlead.lastName || "Unknown",
                  phone: hotlead.phone,
                  email: hotlead.email || hotlead.taalkEmail || null,
                  type: null,
                  // Will be determined by business logic later
                  status: "NEW",
                  cnresolution: "pending",
                  // CORRECTED: Use cnresolution instead of hot_lead_reason
                  notes: `${hotlead.hotLeadReason || "Human Answered"} - Duration: ${hotlead.durationSeconds}s - ${hotlead.taalkMarket || "Hot Lead"}`,
                  // All taalk_ prefixed fields from API data
                  taalk_market: hotlead.taalkMarket || null,
                  taalk_state: hotlead.taalkState || hotlead.state || null,
                  taalk_city: hotlead.taalkCity || hotlead.city || null,
                  taalk_email: hotlead.taalkEmail || hotlead.email || null,
                  taalk_address: hotlead.taalkAddress || null,
                  taalk_beneficiary: hotlead.taalkBeneficiary || null,
                  taalk_relationship: hotlead.taalkRelationship || null,
                  taalk_reffered: hotlead.taalkReffered || null,
                  taalk_sponsor_org: hotlead.taalkSponsorOrg || null,
                  taalk_group_code: hotlead.taalkGroupCode || null,
                  taalk_groupname: hotlead.taalkGroupname || null,
                  taalk_lead_id: hotlead.taalkLeadId || hotlead.taalkCallId || null,
                  taalk_lead_source: hotlead.taalkLeadSource || null,
                  priority_score: hotlead.priorityScore || 10
                };
                const { data: existing } = await supabase.from("hotleads").select("id").eq("taalk_lead_id", hotlead.taalkLeadId || hotlead.taalkCallId).maybeSingle();
                if (existing) {
                  console.log(`\u23ED\uFE0F Hotlead already exists: ${hotlead.firstName} ${hotlead.lastName} (${hotlead.phone})`);
                  continue;
                }
                const { error: insertError } = await supabase.from("hotleads").insert([insertData]);
                if (insertError) {
                  console.error(`\u274C Failed to insert ${hotlead.firstName}:`, insertError);
                } else {
                  console.log(`\u2705 Inserted hotlead: ${hotlead.firstName} ${hotlead.lastName} (${hotlead.phone})`);
                  totalNew++;
                }
              } catch (hotleadError) {
                console.error(`\u274C Error processing hotlead ${hotlead.firstName}:`, hotleadError);
              }
            }
            if (result.pagination && result.pagination.page < result.pagination.totalPages) {
              offset += limit;
            } else {
              hasMore = false;
            }
            await new Promise((resolve) => setTimeout(resolve, 1e3));
          }
          console.log(`\u{1F389} Hotlead sync completed: ${totalNew} new, ${totalUpdated} updated`);
          return { success: true, newCount: totalNew, updateCount: totalUpdated };
        } catch (error) {
          console.error("\u274C Error during hotlead sync:", error);
          return {
            success: false,
            newCount: 0,
            updateCount: 0,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        } finally {
          this.syncInProgress = false;
        }
      }
      // Auto-assign hotleads to agents based on availability and territory
      async assignHotleads() {
        try {
          console.log("\u{1F3AF} Starting hotlead assignment process...");
          if (!supabase) {
            console.warn("\u26A0\uFE0F Supabase client not available - skipping hotlead assignment");
            return;
          }
          const { data: unassignedHotleads, error: hotleadsError } = await supabase.from("masterlead").select("*").eq("is_hot_lead", true).or("TaalkResolve.is.null,TaalkResolve.eq.false").or('cn_email.is.null,cn_email.eq.""').or("last_contacted.is.null,cnresolution.eq.pending").order("last_contacted", { ascending: true, nullsFirst: true }).order("priority_score", { ascending: false }).limit(50);
          if (hotleadsError || !unassignedHotleads?.length) {
            console.log("No unassigned hotleads found for assignment");
            return;
          }
          console.log(`\u{1F525} Found ${unassignedHotleads.length} unassigned hotleads to assign`);
          const { data: allAvailableAgents, error: agentsError } = await supabase.from("agent_profiles").select("email, first_name, last_name, license_states, authorized_markets, max_hotleads, current_hotlead_count").eq("is_active", true).not("email", "is", null);
          if (agentsError || !allAvailableAgents?.length) {
            console.log("No available agents found for hotlead assignment");
            return;
          }
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1e3);
          const availableAgents = [];
          for (const agent of allAvailableAgents) {
            const { data: recentCalls } = await supabase.from("agent_dial_metrics").select("call_duration, event_timestamp").eq("agent_email", agent.email).eq("event_type", "dial").gte("event_timestamp", fiveMinutesAgo.toISOString()).gte("call_duration", 55).limit(1);
            if (recentCalls && recentCalls.length > 0) {
              availableAgents.push(agent);
            }
          }
          if (availableAgents.length === 0) {
            console.log(`\u26A0\uFE0F No agents with 55+ second calls in last 5 minutes (found ${allAvailableAgents.length} available agents, but none completed 55s calls)`);
            return;
          }
          console.log(`\u{1F465} Found ${availableAgents.length} agents with 55+ second calls (out of ${allAvailableAgents.length} total available agents)`);
          const agentRanks = /* @__PURE__ */ new Map();
          await Promise.all(availableAgents.map(async (agent) => {
            const rank = await getRankTierForEmail(agent.email);
            agentRanks.set(agent.email, rank);
          }));
          availableAgents.sort((a, b) => {
            const orderA = getRankOrder(agentRanks.get(a.email) ?? "bronze");
            const orderB = getRankOrder(agentRanks.get(b.email) ?? "bronze");
            if (orderB !== orderA) return orderB - orderA;
            return (a.current_hotlead_count ?? 0) - (b.current_hotlead_count ?? 0);
          });
          let assignmentCount = 0;
          for (const hotlead of unassignedHotleads) {
            let assignedAgent = null;
            for (const agent of availableAgents) {
              if (agent.current_hotlead_count >= agent.max_hotleads) continue;
              const { count: totalAssigned } = await supabase.from("masterlead").select("*", { count: "exact", head: true }).eq("cn_email", agent.email).eq("dnc", false).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)");
              if ((totalAssigned || 0) >= TOTAL_ASSIGNED_LEAD_CAP) {
                console.log(`   \u23ED\uFE0F Skipping ${agent.email} - already has ${totalAssigned} assigned leads (>= ${TOTAL_ASSIGNED_LEAD_CAP})`);
                continue;
              }
              const licenseStates = agent.license_states || [];
              if (!licenseStates.includes(hotlead.taalk_state)) continue;
              const authorizedMarkets = agent.authorized_markets || [];
              if (!authorizedMarkets.includes(hotlead.taalk_market)) continue;
              assignedAgent = agent;
              break;
            }
            if (!assignedAgent) continue;
            if (!supabase) continue;
            const { error: updateError } = await supabase.from("masterlead").update({
              cn_email: assignedAgent.email,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", hotlead.id);
            if (!updateError) {
              assignmentCount++;
              console.log(`\u{1F525} Assigned hotlead ${hotlead.first_name} ${hotlead.last_name} (${hotlead.taalk_state}/${hotlead.taalk_market}) to ${assignedAgent.email}`);
            }
          }
          console.log(`\u{1F3AF} Completed hotlead assignment: ${assignmentCount} existing hotleads assigned`);
        } catch (error) {
          console.error("\u274C Error in hotlead assignment:", error);
        }
      }
      // Poll Taalk API for AO Recruit market transfer-lost hotleads and upsert to masterlead
      async syncAoRecruitHotleads() {
        console.log("\u{1F3AF} Polling Taalk for AO Recruit transfer-failed calls with AI summaries...");
        try {
          const apiUrl = new URL(`${this.taalkBaseUrl}/calls`);
          apiUrl.searchParams.append("db", this.dbParam);
          apiUrl.searchParams.append("limit", "200");
          apiUrl.searchParams.append("tz", "America/New_York");
          apiUrl.searchParams.append("date_range", "today");
          const response = await fetch(apiUrl.toString(), {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${this.taalkApiKey}`,
              "Content-Type": "application/json"
            }
          });
          if (!response.ok) {
            const errText = await response.text();
            console.error(`\u274C Taalk API error ${response.status}: ${errText}`);
            return { success: false, newCount: 0, error: `API ${response.status}: ${errText}` };
          }
          let apiData;
          try {
            apiData = await response.json();
          } catch (e) {
            return { success: false, newCount: 0, error: "Response is not valid JSON" };
          }
          const allCalls = apiData.payload || apiData.data || apiData.calls || [];
          console.log(`\u{1F4DE} Taalk returned ${allCalls.length} total calls for today`);
          const recruitCalls = allCalls.filter((call) => {
            const campaignName = (call.campaign?.name || call.campaignName || "").toLowerCase();
            const market = (call.params?.Taalk_Market || "").toLowerCase();
            return campaignName.includes("recruit") || campaignName.includes("rms") || market.includes("recruit") || market.includes("rms");
          });
          console.log(`\u{1F3AF} Found ${recruitCalls.length} AO Recruit/RMS calls`);
          const candidateCalls = recruitCalls.filter((call) => {
            const hasTransfer = call.transferred === true || String(call.transferred || "").toLowerCase() === "yes" || !!(call.transferStatus || call.transfer_status);
            if (!hasTransfer) return false;
            const transferStatus = String(call.transferStatus || call.transfer_status || "").toLowerCase();
            const transferConnected = transferStatus === "picked" || transferStatus === "completed";
            return !transferConnected;
          });
          console.log(`\u{1F525} ${candidateCalls.length} AO Recruit transfer-failed call(s) identified before summary check`);
          if (!supabase) {
            console.error("\u274C Supabase client not available");
            return { success: false, newCount: 0, error: "Supabase client not available" };
          }
          let newCount = 0;
          let missingSummaryCount = 0;
          for (const call of candidateCalls) {
            const taalkLeadId = call.leadId || call.lead_id || call._id;
            if (!taalkLeadId) {
              console.warn("\u26A0\uFE0F Skipping call with no lead ID:", call);
              continue;
            }
            const callId = String(call._id || call.id || taalkLeadId || "").trim();
            const aiSummary = await this.fetchCallSummary(callId);
            if (!aiSummary) {
              missingSummaryCount++;
              continue;
            }
            const firstName = call.contact?.firstName || call.firstName || call.params?.firstName || call.name?.split(" ")[0] || "Unknown";
            const lastName = call.contact?.lastName || call.lastName || call.params?.lastName || call.name?.split(" ").slice(1).join(" ") || "Unknown";
            const phone = call.phone || call.contact?.phone || call.phoneNumber || "";
            const state = call.state || call.contact?.state || call.lead?.state || call.params?.Taalk_State || null;
            const market = call.campaign?.name || call.campaignName || call.params?.Taalk_Market || "aorecruit";
            const upsertData = {
              first_name: firstName,
              last_name: lastName,
              phone,
              email: call.contact?.email || call.email || call.params?.Taalk_Email || null,
              city: call.contact?.city || call.city || call.params?.Taalk_City || null,
              state,
              zip: call.contact?.zip || call.zipCode || null,
              market: "aorecruit",
              cnresolution: "pending",
              dnc: false,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            };
            const cleanPhone = String(phone || "").replace(/\D/g, "");
            const phoneMatch = cleanPhone ? cleanPhone.slice(-10) : "";
            let upsertError = null;
            const { data: existingRecruitLead, error: existingError } = await supabase.from("masterleadrecruit").select("id, phone").eq("phone", phone).limit(1).maybeSingle();
            if (!existingError && existingRecruitLead?.id) {
              const { error } = await supabase.from("masterleadrecruit").update(upsertData).eq("id", existingRecruitLead.id);
              upsertError = error;
            } else if (phoneMatch) {
              const { data: fuzzyMatch, error: fuzzyError } = await supabase.from("masterleadrecruit").select("id, phone").ilike("phone", `%${phoneMatch}%`).limit(1).maybeSingle();
              if (!fuzzyError && fuzzyMatch?.id) {
                const { error } = await supabase.from("masterleadrecruit").update(upsertData).eq("id", fuzzyMatch.id);
                upsertError = error;
              } else {
                const { error } = await supabase.from("masterleadrecruit").insert([upsertData]);
                upsertError = error;
              }
            } else {
              const { error } = await supabase.from("masterleadrecruit").insert([upsertData]);
              upsertError = error;
            }
            if (upsertError) {
              console.error(`\u274C Upsert failed for ${firstName} ${lastName}:`, upsertError);
            } else {
              newCount++;
              console.log(`\u2705 Upserted AO Recruit hotlead: ${firstName} ${lastName} (${phone})`);
            }
          }
          console.log(
            `\u{1F3AF} AO Recruit sync complete: ${newCount} lead(s) upserted, ${missingSummaryCount} skipped (no AI summary)`
          );
          return { success: true, newCount };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          console.error("\u274C syncAoRecruitHotleads error:", msg);
          return { success: false, newCount: 0, error: msg };
        }
      }
      // Get sync status
      getSyncStatus() {
        return { inProgress: this.syncInProgress };
      }
    };
    hotleadSyncService = new HotleadSyncService();
  }
});

// server/hotlead-scheduler.ts
var hotlead_scheduler_exports = {};
__export(hotlead_scheduler_exports, {
  hotleadScheduler: () => hotleadScheduler
});
import * as cron3 from "node-cron";
function canSendZapierWebhooksFromThisRuntime() {
  if (String(process.env.ALLOW_NON_PROD_ZAPIER_WEBHOOKS || "").toLowerCase() === "true") {
    return true;
  }
  const envMarker = `${process.env.RAILWAY_ENVIRONMENT || ""} ${process.env.RAILWAY_ENVIRONMENT_NAME || ""} ${process.env.NODE_ENV || ""}`.toLowerCase();
  const hostMarker = `${process.env.RAILWAY_PUBLIC_DOMAIN || ""} ${process.env.RAILWAY_STATIC_URL || ""} ${process.env.RAILWAY_SERVICE_NAME || ""}`.toLowerCase();
  const hasProdEnv = envMarker.includes("production") || envMarker.includes("prod");
  const hasProdHost = hostMarker.includes("aoirail-production") || hostMarker.includes("production-baa2");
  const hasNonProdHost = hostMarker.includes("staging") || hostMarker.includes("beta") || hostMarker.includes("preview");
  return (hasProdEnv || hasProdHost) && !hasNonProdHost;
}
var JOB_WEBHOOKS_ENABLED, HotleadScheduler, hotleadScheduler;
var init_hotlead_scheduler = __esm({
  "server/hotlead-scheduler.ts"() {
    "use strict";
    init_hotlead_sync_service();
    JOB_WEBHOOKS_ENABLED = String(process.env.ENABLE_ZAPIER_JOB_WEBHOOKS || "").toLowerCase() === "true";
    HotleadScheduler = class {
      syncTask = null;
      assignmentTask = null;
      // Start hotlead sync to monitor 50+ second calls and create new hotleads
      startScheduler() {
        console.log("\u{1F525} Starting hotlead scheduler - continuous lead replenishment enabled");
        this.syncTask = cron3.schedule("0,30 * * * *", async () => {
          console.log("\u{1F504} Running scheduled hotlead assignment management...");
          try {
            const result = await hotleadSyncService.syncHotleads("today");
            if (result.success) {
              console.log(`\u2705 Hotlead assignment management completed`);
            } else {
              console.error("\u274C Hotlead assignment management failed:", result.error);
            }
          } catch (error) {
            console.error("\u274C Error in scheduled hotlead management:", error);
          }
        });
        if (JOB_WEBHOOKS_ENABLED && process.env.HOTLEAD_ZAPIER_WEBHOOK_ENABLED === "true" && canSendZapierWebhooksFromThisRuntime()) {
          this.assignmentTask = cron3.schedule("*/5 * * * *", async () => {
            await this.checkHotleadCallsForWebhook();
          });
        } else {
          console.log("\u23ED\uFE0F Hotlead Zapier webhook sender disabled (job/env/runtime guard)");
        }
        cron3.schedule("0 * * * *", async () => {
          try {
            const result = await hotleadSyncService.syncAoRecruitHotleads();
            if (result.newCount > 0) {
              console.log(`\u{1F3AF} AO Recruit hotleads: ${result.newCount} new leads found`);
            }
          } catch (e) {
            console.error("\u274C AO Recruit hotlead sync failed:", e.message);
          }
        });
        setInterval(async () => {
          try {
            await this.quickHotleadCheck();
          } catch (error) {
            console.error("\u274C Hotlead check failed:", error);
          }
        }, 3e5);
        console.log("\u2705 Hotlead scheduler started - database assignment every 30 minutes, AO Recruit sync hourly");
      }
      async testApiConnection() {
        try {
          const result = await hotleadSyncService.fetchHotleadsFromTaalk(5, 0);
          return result.success;
        } catch {
          return false;
        }
      }
      // Quick check for newly assigned hotleads (reduced logging)
      async quickHotleadCheck() {
        try {
          const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
          if (!supabase2) {
            return;
          }
        } catch (error) {
          console.error("\u274C Error in hotlead check:", error);
        }
      }
      // All sync functions disabled - no real API connection exists
      stopScheduler() {
        console.log("\u{1F6D1} No scheduler to stop - completely disabled");
      }
      getStatus() {
        return { syncRunning: false, assignmentRunning: false };
      }
      async forcSync() {
        return await hotleadSyncService.syncHotleads("today");
      }
      // Monitor calls to hotleads and trigger webhook for 50+ second calls
      async checkHotleadCallsForWebhook() {
        try {
          const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
          if (!supabase2) return;
          const { data: recentCalls } = await supabase2.from("twilio_call_logs").select("*").gte("created_at", new Date(Date.now() - 5 * 60 * 1e3).toISOString()).eq("call_status", "completed").gte("call_duration", 60);
          if (!recentCalls || recentCalls.length === 0) return;
          for (const call of recentCalls) {
            if (!call.to_number) continue;
            const cleanToNumber = call.to_number.replace(/\D/g, "");
            const { data: hotleads } = await supabase2.from("masterlead").select("*").ilike("phone", `%${cleanToNumber.slice(-10)}%`).limit(1);
            if (hotleads && hotleads.length > 0) {
              const hotlead = hotleads[0];
              try {
                const { data: existingWebhook } = await supabase2.from("hotlead_webhooks").select("id").eq("call_sid", call.twilio_call_sid).limit(1);
                if (existingWebhook && existingWebhook.length > 0) {
                  continue;
                }
              } catch (webhookCheckError) {
                console.log("\u26A0\uFE0F Could not check webhook history (table may not exist), proceeding...");
              }
              await this.sendHotleadWebhook(call, hotlead);
            }
          }
        } catch (error) {
          console.error("\u274C Error checking hotlead calls for webhook:", error);
        }
      }
      async sendHotleadWebhook(call, hotlead) {
        try {
          if (!JOB_WEBHOOKS_ENABLED) {
            console.log("\u23ED\uFE0F Hotlead job webhook disabled (ENABLE_ZAPIER_JOB_WEBHOOKS!=true)");
            return;
          }
          if (!canSendZapierWebhooksFromThisRuntime()) {
            console.log("\u23ED\uFE0F Hotlead webhook skipped (non-production runtime)");
            return;
          }
          const agentEmail = call.owner_email || call.agent_identity || "system@aoglobelife.com";
          let associateId = null;
          if (agentEmail && agentEmail !== "system@aoglobelife.com" && agentEmail !== "unknown@aoglobelife.com") {
            try {
              const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
              if (supabase2) {
                const { data: customer } = await supabase2.from("customers").select("associate_id").eq("company_email", agentEmail.toLowerCase().trim()).single();
                if (customer && customer.associate_id) {
                  associateId = customer.associate_id.toString();
                }
              }
            } catch (lookupError) {
              console.error(`\u26A0\uFE0F Could not lookup associate_id for ${agentEmail} - WEBHOOK WILL NOT BE SENT`);
            }
          }
          if (!associateId) {
            console.error(`\u274C Cannot send webhook: No associate_id found for agent ${agentEmail} - LEAD WILL NOT BE SENT`);
            return;
          }
          const leadId = hotlead.taalk_lead_id || hotlead.taalkLeadId || hotlead.id;
          if (!leadId) {
            console.error("\u274C Cannot send webhook: No lead_id found for hotlead", hotlead);
            return;
          }
          const webhookPayload = {
            lead_id: leadId.toString(),
            // Must be Taalk lead ID, not database ID
            associate_id: associateId
          };
          console.log(`\u{1F4E4} Auto-sending hotlead webhook for 60+ second call: ${call.twilio_call_sid} (${call.call_duration}s) - Agent: ${agentEmail} \u2192 ${hotlead.first_name} ${hotlead.last_name}`);
          const webhookResponse = await fetch("https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(webhookPayload)
          });
          if (webhookResponse.ok) {
            console.log("\u2705 Hotlead webhook sent successfully for 60+ second call");
            const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
            if (supabase2) {
              try {
                await supabase2.from("hotlead_webhooks").insert([{
                  call_sid: call.twilio_call_sid,
                  hotlead_id: hotlead.id,
                  agent_email: agentEmail,
                  webhook_payload: webhookPayload,
                  webhook_status: "sent",
                  sent_at: (/* @__PURE__ */ new Date()).toISOString()
                }]);
              } catch (webhookLogError) {
                console.log("\u26A0\uFE0F Could not log webhook (table may not exist):", webhookLogError.message);
              }
            }
          } else {
            console.error("\u274C Hotlead webhook failed:", webhookResponse.status);
          }
        } catch (error) {
          console.error("\u274C Error sending hotlead webhook:", error);
        }
      }
      async processHotleadAssignments() {
      }
    };
    hotleadScheduler = new HotleadScheduler();
  }
});

// server/email.ts
import Mailgun3 from "mailgun.js";
import formData3 from "form-data";
async function sendEmail2(params) {
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
    mailgun = new Mailgun3(formData3);
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

// server/daily-billing-recap-service.ts
var daily_billing_recap_service_exports = {};
__export(daily_billing_recap_service_exports, {
  DailyBillingRecapService: () => DailyBillingRecapService
});
var DailyBillingRecapService;
var init_daily_billing_recap_service = __esm({
  "server/daily-billing-recap-service.ts"() {
    "use strict";
    init_supabase();
    init_email();
    DailyBillingRecapService = class {
      /**
       * Get billing data for a specific agent and date
       */
      static async getAgentBillingData(agentId, date) {
        if (!supabase) {
          console.error("\u274C Supabase not available");
          return null;
        }
        try {
          console.log(`\u{1F50D} Getting billing data for agent ${agentId} on ${date}`);
          const { data: agentInfo, error: agentError } = await supabase.from("customers").select("associate_id, first_name, last_name, company_email").eq("associate_id", agentId).single();
          if (agentError || !agentInfo) {
            console.error(`\u274C Agent ${agentId} not found:`, agentError);
            return null;
          }
          const agentName = `${agentInfo.first_name} ${agentInfo.last_name}`;
          const agentEmail = agentInfo.company_email;
          const estDate = /* @__PURE__ */ new Date(`${date}T00:00:00-05:00`);
          const estEndDate = /* @__PURE__ */ new Date(`${date}T23:59:59-05:00`);
          const startOfDay = estDate.toISOString();
          const endOfDay = estEndDate.toISOString();
          const { data: vdpCalls2, error: callsError } = await supabase.from("vdp_calls").select("*").eq("agent", agentId).gte("time", startOfDay).lte("time", endOfDay).order("time", { ascending: true });
          if (callsError) {
            console.error(`\u274C Error fetching VDP calls:`, callsError);
            return null;
          }
          const { data: missedCalls, error: missedError } = await supabase.from("vdp_calls_missed").select("*").eq("agent", agentId).gte("time", startOfDay).lte("time", endOfDay).order("time", { ascending: true });
          if (missedError) {
            console.error(`\u274C Error fetching missed calls:`, missedError);
          }
          const connects = (vdpCalls2 || []).map((call) => ({
            id: call.leadid || call.id.toString(),
            clientName: call.firstName && call.lastName ? `${call.firstName} ${call.lastName}`.trim() : `Client ${call.phone}`,
            clientPhone: call.phone || "N/A",
            callTime: call.time ? call.time.split("T")[1]?.split("+")[0] || "00:00:00" : "00:00:00",
            duration: call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, "0")}` : "0:00",
            market: call.market || "Veteran",
            billingAmount: "8.00"
          }));
          const missedCallsFormatted = (missedCalls || []).map((call) => ({
            id: `missed_${call.id}`,
            clientName: call.firstName && call.lastName ? `${call.firstName} ${call.lastName}`.trim() : call.firstname && call.lastname ? `${call.firstname} ${call.lastname}`.trim() : `Client ${call.phone}`,
            clientPhone: call.phone || "N/A",
            callTime: call.time ? call.time.split("T")[1]?.split("+")[0] || "00:00:00" : "00:00:00",
            market: call.market || "Veteran",
            billingAmount: "4.00"
          }));
          const totalConnects = connects.length;
          const totalMissedCalls = missedCallsFormatted.length;
          const connectsBilling = totalConnects * 8;
          const missedCallsBilling = totalMissedCalls * 4;
          const totalBilling = connectsBilling + missedCallsBilling;
          console.log(`\u2705 Agent ${agentId} billing data: ${totalConnects} connects ($${connectsBilling}), ${totalMissedCalls} missed ($${missedCallsBilling}), total $${totalBilling}`);
          return {
            agentId,
            agentName,
            agentEmail,
            date,
            totalConnects,
            totalMissedCalls,
            connectsBilling,
            missedCallsBilling,
            totalBilling,
            connects,
            missedCalls: missedCallsFormatted
          };
        } catch (error) {
          console.error(`\u274C Error getting agent billing data:`, error);
          return null;
        }
      }
      /**
       * Send daily recap email to a specific agent
       */
      static async sendAgentDailyRecap(agentId, date) {
        try {
          const billingData = await this.getAgentBillingData(agentId, date);
          if (!billingData) {
            console.error(`\u274C No billing data found for agent ${agentId} on ${date}`);
            return false;
          }
          if (billingData.totalConnects === 0 && billingData.totalMissedCalls === 0) {
            console.log(`\u{1F4ED} No activity for agent ${agentId} on ${date} - skipping email`);
            return true;
          }
          console.log(`\u{1F4E7} Sending daily recap to ${billingData.agentEmail}`);
          const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: #1a365d; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">AO Intelligence</h1>
            <h2 style="margin: 10px 0 0 0; font-weight: normal;">Daily Billing Recap</h2>
          </div>

          <div style="padding: 30px; background: #f7fafc;">
            <h3 style="color: #1a365d; margin: 0 0 20px 0;">\u{1F4CA} ${billingData.agentName} - ${billingData.date}</h3>

            <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h4 style="color: #2e7d32; margin: 0 0 15px 0;">\u{1F4B0} Daily Summary</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 5px 0; font-weight: bold;">Total Connects:</td><td style="padding: 5px 0;">${billingData.totalConnects}</td></tr>
                <tr><td style="padding: 5px 0; font-weight: bold;">Missed Calls:</td><td style="padding: 5px 0; color: #d32f2f;">${billingData.totalMissedCalls}</td></tr>
                <tr><td style="padding: 5px 0; font-weight: bold;">Total Billed:</td><td style="padding: 5px 0; color: #2e7d32; font-weight: bold;">$${billingData.totalBilling.toFixed(2)}</td></tr>
              </table>
            </div>

            ${billingData.totalConnects > 0 ? `
            <h4 style="color: #1a365d;">\u2705 Successful Connects</h4>
            ${billingData.connects.map((call) => `
              <p style="margin: 5px 0;">\u2022 ${call.clientName} (${call.clientPhone}) - ${call.callTime} - $${call.billingAmount}</p>
            `).join("")}
            ` : ""}

            ${billingData.totalMissedCalls > 0 ? `
            <h4 style="color: #1a365d;">\u{1F4F5} Missed Calls</h4>
            ${billingData.missedCalls.map((call) => `
              <p style="margin: 5px 0;">\u2022 ${call.clientName} (${call.clientPhone}) - ${call.callTime} - $${call.billingAmount}</p>
            `).join("")}
            ` : ""}
          </div>

          <div style="background: #718096; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">AO Intelligence | Daily Billing Recap</p>
          </div>
        </div>
      `;
          const emailSent = await sendEmail2({
            to: billingData.agentEmail,
            subject: `\u{1F4CA} Daily Billing Recap - ${billingData.date} ($${billingData.totalBilling.toFixed(2)})`,
            html: emailHtml,
            text: `Daily billing recap for ${billingData.date}: ${billingData.totalConnects} connects, ${billingData.totalMissedCalls} missed calls, $${billingData.totalBilling.toFixed(2)} total billed.`
          });
          if (emailSent) {
            console.log(`\u2705 Daily recap sent to ${billingData.agentEmail}`);
            if (supabase) {
              await supabase.from("email_notifications").insert({
                recipient: billingData.agentEmail,
                subject: `Daily Billing Recap - ${date}`,
                type: "daily_billing_recap",
                status: "sent",
                sent_at: (/* @__PURE__ */ new Date()).toISOString(),
                metadata: {
                  agentId: billingData.agentId,
                  date,
                  totalBilling: billingData.totalBilling,
                  totalConnects: billingData.totalConnects,
                  totalMissedCalls: billingData.totalMissedCalls
                }
              });
            }
            return true;
          } else {
            console.error(`\u274C Failed to send daily recap to ${billingData.agentEmail}`);
            return false;
          }
        } catch (error) {
          console.error(`\u274C Error sending daily recap:`, error);
          return false;
        }
      }
      /**
       * Send daily recaps to all active agents for a specific date
       */
      static async sendAllAgentDailyRecaps(date) {
        if (!supabase) {
          console.error("\u274C Supabase not available");
          return { sent: 0, errors: 1, details: ["Supabase not available"] };
        }
        try {
          console.log(`\u{1F504} Sending daily recaps for ${date} to all active agents`);
          const startOfDay = `${date}T00:00:00+00:00`;
          const endOfDay = `${date}T23:59:59+00:00`;
          const { data: vdpAgents, error: vdpError } = await supabase.from("vdp_calls").select("agent").gte("time", startOfDay).lte("time", endOfDay);
          const { data: missedAgents, error: missedError } = await supabase.from("vdp_calls_missed").select("agent").gte("time", startOfDay).lte("time", endOfDay);
          if (vdpError || missedError) {
            console.error("\u274C Error fetching agent activity:", { vdpError, missedError });
            return { sent: 0, errors: 1, details: ["Error fetching agent activity"] };
          }
          const allAgentIds = /* @__PURE__ */ new Set([
            ...(vdpAgents || []).map((a) => a.agent),
            ...(missedAgents || []).map((a) => a.agent)
          ]);
          const activeAgents = Array.from(allAgentIds).filter((id) => id && id !== "");
          console.log(`\u{1F4CA} Found ${activeAgents.length} agents with activity on ${date}`);
          let sent = 0;
          let errors = 0;
          const details = [];
          for (const agentId of activeAgents) {
            try {
              const success = await this.sendAgentDailyRecap(agentId, date);
              if (success) {
                sent++;
                details.push(`\u2705 Sent to agent ${agentId}`);
              } else {
                errors++;
                details.push(`\u274C Failed to send to agent ${agentId}`);
              }
            } catch (error) {
              errors++;
              details.push(`\u274C Error sending to agent ${agentId}: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 1e3));
          }
          console.log(`\u2705 Daily recap batch complete: ${sent} sent, ${errors} errors`);
          return { sent, errors, details };
        } catch (error) {
          console.error(`\u274C Error sending daily recaps:`, error);
          return {
            sent: 0,
            errors: 1,
            details: [`Error: ${error instanceof Error ? error.message : "Unknown error"}`]
          };
        }
      }
      /**
       * Schedule automatic daily recap sending (for previous day)
       */
      static setupDailyRecapScheduler() {
        console.log("\u{1F4C5} Setting up daily billing recap scheduler...");
        const sendDailyRecaps = async () => {
          const yesterday = /* @__PURE__ */ new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dateStr = yesterday.toISOString().split("T")[0];
          console.log(`\u{1F504} Automated daily recap sending for ${dateStr}`);
          const result = await this.sendAllAgentDailyRecaps(dateStr);
          console.log(`\u{1F4CA} Automated recap results: ${result.sent} sent, ${result.errors} errors`);
        };
        const now = /* @__PURE__ */ new Date();
        const tomorrow7AM = /* @__PURE__ */ new Date();
        tomorrow7AM.setDate(now.getDate() + 1);
        tomorrow7AM.setHours(7, 0, 0, 0);
        const msUntil7AM = tomorrow7AM.getTime() - now.getTime();
        setTimeout(() => {
          sendDailyRecaps();
          setInterval(sendDailyRecaps, 24 * 60 * 60 * 1e3);
        }, msUntil7AM);
        console.log(`\u23F0 Daily recap scheduler set up - next run in ${Math.round(msUntil7AM / 1e3 / 60)} minutes`);
      }
    };
  }
});

// server/appointment-sms.ts
import twilio2 from "twilio";
function getStateTimezone(state) {
  return STATE_TIMEZONE[state?.toUpperCase()] ?? "";
}
function getTimezoneForState(state) {
  return getStateTimezone(state);
}
function formatAppointmentTime(utcTime, ianaTimezone) {
  const date = typeof utcTime === "string" ? new Date(utcTime) : utcTime;
  const abbrev = TZ_ABBREV[ianaTimezone] ?? ianaTimezone;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ianaTimezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("month")} ${get("day")} at ${get("hour")}:${get("minute")} ${get("dayPeriod")} ${abbrev}`;
}
function formatToE164(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+1${digits}`;
}
function getTwilioClient() {
  if (_twilioClient) return _twilioClient;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    _twilioClient = twilio2(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return _twilioClient;
}
async function sendSMS(to, body) {
  const client = getTwilioClient();
  if (!client || !TWILIO_PHONE_NUMBER) {
    console.warn("\u26A0\uFE0F appointment-sms: Twilio not configured, skipping SMS");
    return false;
  }
  try {
    const result = await client.messages.create({ body, from: TWILIO_PHONE_NUMBER, to: formatToE164(to) });
    console.log("\u{1F4F1} appointment-sms: sent", result.sid);
    return true;
  } catch (err) {
    console.error("\u274C appointment-sms: send failed", err?.message);
    return false;
  }
}
function normalizeZoomPassword(password) {
  const raw = String(password || "").trim();
  if (!raw || raw === "1") return "";
  return raw;
}
async function sendAppointmentReminder(appt, hoursUntil) {
  const explicitLeadTimezone = String(appt.leadTimezone || "").trim();
  const stateTz = getTimezoneForState(appt.leadState ?? "");
  const tz = explicitLeadTimezone || stateTz;
  const timeStr = tz ? formatAppointmentTime(appt.startTime, tz) : [
    formatAppointmentTime(appt.startTime, "America/New_York"),
    formatAppointmentTime(appt.startTime, "America/Chicago"),
    formatAppointmentTime(appt.startTime, "America/Los_Angeles")
  ].join(" | ");
  const zoomPassword = normalizeZoomPassword(appt.zoomPassword);
  const joinPart = appt.zoomLink ? ` Join: ${appt.zoomLink}.${zoomPassword ? ` Passcode: ${zoomPassword}.` : ""}` : "";
  const body = `Reminder: Hi ${appt.leadName}, your appointment with ${appt.agentName} is in ~${hoursUntil} hour${hoursUntil !== 1 ? "s" : ""} \u2014 ${timeStr}.${joinPart} Reply STOP to opt out.`;
  console.log(`\u{1F514} Sending appointment reminder SMS to ${appt.leadPhone} (${hoursUntil}h)`);
  return sendSMS(appt.leadPhone, body);
}
var STATE_TIMEZONE, TZ_ABBREV, _twilioClient;
var init_appointment_sms = __esm({
  "server/appointment-sms.ts"() {
    "use strict";
    init_hardcoded_config();
    STATE_TIMEZONE = {
      TX: "America/Chicago",
      CA: "America/Los_Angeles",
      FL: "America/New_York",
      NY: "America/New_York",
      IL: "America/Chicago",
      OH: "America/New_York",
      GA: "America/New_York",
      NC: "America/New_York",
      MI: "America/New_York",
      PA: "America/New_York",
      AZ: "America/Denver",
      WA: "America/Los_Angeles",
      OR: "America/Los_Angeles",
      CO: "America/Denver",
      MN: "America/Chicago",
      WI: "America/Chicago",
      MO: "America/Chicago",
      TN: "America/Chicago",
      AL: "America/Chicago",
      LA: "America/Chicago",
      MS: "America/Chicago",
      AR: "America/Chicago",
      IA: "America/Chicago",
      KS: "America/Chicago",
      NE: "America/Chicago",
      OK: "America/Chicago",
      SD: "America/Chicago",
      ND: "America/Chicago",
      NM: "America/Denver",
      UT: "America/Denver",
      MT: "America/Denver",
      ID: "America/Denver",
      WY: "America/Denver",
      NV: "America/Los_Angeles",
      AK: "America/Anchorage",
      HI: "America/Los_Angeles"
      // Default for any other state: Eastern
    };
    TZ_ABBREV = {
      "America/New_York": "ET",
      "America/Chicago": "CT",
      "America/Denver": "MT",
      "America/Los_Angeles": "PT",
      "America/Anchorage": "AKT"
    };
    _twilioClient = null;
  }
});

// server/appointment-reminder-scheduler.ts
var appointment_reminder_scheduler_exports = {};
__export(appointment_reminder_scheduler_exports, {
  appointmentReminderScheduler: () => appointmentReminderScheduler
});
async function runReminders() {
  if (!supabaseAdmin) return;
  try {
    const now = /* @__PURE__ */ new Date();
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1e3);
    const baseSelect = "id, lead_name, lead_phone, lead_state, agent_name, agent_phone, start_time, zoom_join_url, zoom_password, reminders_sent, confirmation_status, outcome";
    const withMeetingLinkSelect = `${baseSelect}, meeting_link`;
    const runSelect = async (selectClause) => supabaseAdmin.from("appointments").select(selectClause).in("status", ["scheduled", "confirmed"]).eq("confirmation_status", "sent").or("outcome.eq.pending,outcome.is.null").lte("start_time", in25h.toISOString()).gt("start_time", now.toISOString());
    let { data: candidates, error } = await runSelect(withMeetingLinkSelect);
    const missingMeetingLinkColumn = !!error && /meeting_link/i.test(String(error.message || "")) && /(does not exist|schema cache)/i.test(String(error.message || ""));
    if (missingMeetingLinkColumn) {
      const fallback = await runSelect(baseSelect);
      candidates = fallback.data;
      error = fallback.error;
    }
    if (error) {
      console.error("[appt-reminder] query error:", error.message);
      return;
    }
    if (!candidates || candidates.length === 0) return;
    for (const appt of candidates) {
      const startTime = new Date(appt.start_time);
      const msUntil = startTime.getTime() - now.getTime();
      const hoursUntil = msUntil / (1e3 * 60 * 60);
      const minutesUntil = msUntil / (1e3 * 60);
      const remindersSent = appt.reminders_sent ?? 0;
      const zoomLink = appt.zoom_join_url ?? appt.meeting_link ?? null;
      if (remindersSent === 0 && hoursUntil >= 23 && hoursUntil <= 25) {
        const clientSent = await sendAppointmentReminder(
          { leadName: appt.lead_name, leadPhone: appt.lead_phone, leadState: appt.lead_state, agentName: appt.agent_name, startTime: appt.start_time, zoomLink, zoomPassword: appt.zoom_password },
          24
        );
        if (clientSent) {
          await supabaseAdmin.from("appointments").update({ reminders_sent: 1, updated_at: now.toISOString() }).eq("id", appt.id);
          console.log(`[appt-reminder] \u2705 stage-1 (24h) sent for appt ${appt.id}`);
        }
        continue;
      }
      if (remindersSent === 1 && minutesUntil >= 50 && minutesUntil <= 70) {
        const clientSent = await sendAppointmentReminder(
          { leadName: appt.lead_name, leadPhone: appt.lead_phone, leadState: appt.lead_state, agentName: appt.agent_name, startTime: appt.start_time, zoomLink, zoomPassword: appt.zoom_password },
          1
        );
        if (clientSent) {
          await supabaseAdmin.from("appointments").update({ reminders_sent: 2, updated_at: now.toISOString() }).eq("id", appt.id);
          console.log(`[appt-reminder] \u2705 stage-2 (1h) sent for appt ${appt.id}`);
        }
        continue;
      }
      if (remindersSent === 2 && minutesUntil >= 10 && minutesUntil <= 20) {
        const clientSent = await sendAppointmentReminder(
          { leadName: appt.lead_name, leadPhone: appt.lead_phone, leadState: appt.lead_state, agentName: appt.agent_name, startTime: appt.start_time, zoomLink, zoomPassword: appt.zoom_password },
          0.25
          // will display as "~0 hours" — override label below
        );
        if (clientSent) {
          await supabaseAdmin.from("appointments").update({ reminders_sent: 3, updated_at: now.toISOString() }).eq("id", appt.id);
          console.log(`[appt-reminder] \u2705 stage-3 (15min) sent for appt ${appt.id}`);
        }
        continue;
      }
    }
  } catch (err) {
    console.error("[appt-reminder] unexpected error:", err?.message);
  }
}
var INTERVAL_MS, _timer, appointmentReminderScheduler;
var init_appointment_reminder_scheduler = __esm({
  "server/appointment-reminder-scheduler.ts"() {
    "use strict";
    init_supabase();
    init_appointment_sms();
    INTERVAL_MS = 5 * 60 * 1e3;
    _timer = null;
    appointmentReminderScheduler = {
      start() {
        if (_timer) return;
        console.log("[appt-reminder] starting (5-min interval, 3-stage)");
        void runReminders();
        _timer = setInterval(() => {
          void runReminders();
        }, INTERVAL_MS);
      },
      stop() {
        if (_timer) {
          clearInterval(_timer);
          _timer = null;
        }
      }
    };
  }
});

// server/billing-transaction-sync.ts
var billing_transaction_sync_exports = {};
__export(billing_transaction_sync_exports, {
  BillingTransactionSync: () => BillingTransactionSync,
  billingTransactionSync: () => billingTransactionSync
});
var FIVE_MINUTES_MS, INITIAL_LOOKBACK_MINUTES, CONTINUOUS_LOOKBACK_MINUTES, MAX_INITIAL_PROCESSING, EXISTING_BILLING_PAGE, BillingTransactionSync, billingTransactionSync;
var init_billing_transaction_sync = __esm({
  "server/billing-transaction-sync.ts"() {
    "use strict";
    init_supabase();
    FIVE_MINUTES_MS = 5 * 60 * 1e3;
    INITIAL_LOOKBACK_MINUTES = 90 * 24 * 60;
    CONTINUOUS_LOOKBACK_MINUTES = 24 * 60;
    MAX_INITIAL_PROCESSING = 1e4;
    EXISTING_BILLING_PAGE = 1e3;
    BillingTransactionSync = class {
      timer = null;
      // Made public for verification
      isRunning = false;
      hasCompletedInitialSync = false;
      agentCacheByEmail = /* @__PURE__ */ new Map();
      agentCacheByAssociate = /* @__PURE__ */ new Map();
      /** Full set of vdp_calls.id already present in billing_transactions (paginated — not capped at 1000). */
      async fetchAllBilledVdpConnectSourceIds() {
        if (!supabaseAdmin) return /* @__PURE__ */ new Set();
        const set = /* @__PURE__ */ new Set();
        let offset = 0;
        while (true) {
          const { data, error } = await supabaseAdmin.from("billing_transactions").select("source_id").eq("source_table", "vdp_calls").not("source_id", "is", null).order("id", { ascending: true }).range(offset, offset + EXISTING_BILLING_PAGE - 1);
          if (error) {
            console.error("\u274C Failed to page billed connect source_ids:", error.message);
            break;
          }
          if (!data?.length) break;
          for (const row of data) {
            if (typeof row.source_id === "number") set.add(row.source_id);
          }
          if (data.length < EXISTING_BILLING_PAGE) break;
          offset += EXISTING_BILLING_PAGE;
        }
        return set;
      }
      async fetchAllBilledPrecheckSourceIds() {
        if (!supabaseAdmin) return /* @__PURE__ */ new Set();
        const set = /* @__PURE__ */ new Set();
        let offset = 0;
        while (true) {
          const { data, error } = await supabaseAdmin.from("billing_transactions").select("source_id").eq("source_table", "verification_sessions").not("source_id", "is", null).order("id", { ascending: true }).range(offset, offset + EXISTING_BILLING_PAGE - 1);
          if (error) {
            console.error("\u274C Failed to page billed precheck source_ids:", error.message);
            break;
          }
          if (!data?.length) break;
          for (const row of data) {
            if (typeof row.source_id === "number") set.add(row.source_id);
          }
          if (data.length < EXISTING_BILLING_PAGE) break;
          offset += EXISTING_BILLING_PAGE;
        }
        return set;
      }
      async fetchAllBilledRecruitTransactionIds() {
        if (!supabaseAdmin) return /* @__PURE__ */ new Set();
        const set = /* @__PURE__ */ new Set();
        let offset = 0;
        while (true) {
          const { data, error } = await supabaseAdmin.from("billing_transactions").select("transaction_id").eq("transaction_type", "recruit").like("transaction_id", "recruit-%").order("id", { ascending: true }).range(offset, offset + EXISTING_BILLING_PAGE - 1);
          if (error) {
            console.error("\u274C Failed to page billed recruit transaction_ids:", error.message);
            break;
          }
          if (!data?.length) break;
          for (const row of data) {
            if (typeof row.transaction_id === "string") set.add(row.transaction_id);
          }
          if (data.length < EXISTING_BILLING_PAGE) break;
          offset += EXISTING_BILLING_PAGE;
        }
        return set;
      }
      start() {
        if (!supabaseAdmin) {
          console.error("[AOIrail] billing-transaction-sync DISABLED: supabaseAdmin not configured");
          return;
        }
        if (this.timer) {
          console.error("[AOIrail] billing-transaction-sync already running (duplicate start ignored)");
          return;
        }
        console.error(
          `[AOIrail] billing-transaction-sync STARTING (initial backfill up to ${INITIAL_LOOKBACK_MINUTES / 60 / 24} days; then every 5 min)`
        );
        this.runCycle(INITIAL_LOOKBACK_MINUTES).finally(() => {
          this.hasCompletedInitialSync = true;
          console.log(`\u2705 Initial billing transaction sync completed - synced last ${INITIAL_LOOKBACK_MINUTES / 60 / 24} days`);
        }).catch((error) => {
          console.error("\u274C Initial billing transaction sync failed:", error);
        });
        this.timer = setInterval(() => {
          if (!this.isRunning) {
            const lookback = this.hasCompletedInitialSync ? CONTINUOUS_LOOKBACK_MINUTES : INITIAL_LOOKBACK_MINUTES;
            console.log(`\u{1F504} Running billing transaction sync cycle (lookback: ${lookback} minutes)`);
            this.runCycle(lookback).catch((error) => {
              console.error("\u274C Billing transaction sync cycle failed:", error);
            });
          } else {
            console.log("\u23F3 Billing transaction sync cycle skipped - previous cycle still running");
          }
        }, FIVE_MINUTES_MS);
        console.error(
          `[AOIrail] billing-transaction-sync timer ACTIVE \u2014 interval ${FIVE_MINUTES_MS / 1e3 / 60} minutes`
        );
      }
      stop() {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
          console.log("\u23F8\uFE0F Billing transaction sync stopped");
        }
      }
      async runCycle(lookbackMinutes) {
        if (!supabaseAdmin) {
          return;
        }
        if (this.isRunning) {
          console.log("\u23F3 Previous billing transaction sync still running \u2013 skipping this cycle");
          return;
        }
        this.isRunning = true;
        const startedAt = Date.now();
        try {
          const isInitialSync = !this.hasCompletedInitialSync;
          const [connectResult, precheckResult, recruitResult] = await Promise.allSettled([
            this.syncConnectTransactions(lookbackMinutes, isInitialSync),
            // DISABLED: Precheck billing notifications and transactions
            Promise.resolve(0),
            // this.syncPrecheckTransactions(lookbackMinutes, isInitialSync),
            this.syncRecruitTransactions(lookbackMinutes, isInitialSync)
          ]);
          const insertedConnect = connectResult.status === "fulfilled" ? connectResult.value : 0;
          const insertedPrecheck = precheckResult.status === "fulfilled" ? precheckResult.value : 0;
          const insertedRecruit = recruitResult.status === "fulfilled" ? recruitResult.value : 0;
          const totalInserted = insertedConnect + insertedPrecheck + insertedRecruit;
          const durationSec = ((Date.now() - startedAt) / 1e3).toFixed(1);
          if (totalInserted > 0) {
            console.log(
              `\u{1F4B3} Billing transaction sync added ${totalInserted} records (connect: ${insertedConnect}, precheck: ${insertedPrecheck}, recruit: ${insertedRecruit}) in ${durationSec}s`
            );
          } else {
            console.log(`\u2705 Billing transaction sync complete \u2013 no new records found (in ${durationSec}s)`);
          }
        } catch (error) {
          console.error("\u274C Billing transaction sync encountered an error:", error);
        } finally {
          this.isRunning = false;
        }
      }
      async syncConnectTransactions(lookbackMinutes, isInitialSync = false) {
        if (!supabaseAdmin) return 0;
        const since = isInitialSync ? null : new Date(Date.now() - lookbackMinutes * 6e4).toISOString();
        let totalInserted = 0;
        let offset = 0;
        const batchSize = 500;
        let hasMore = true;
        let processedCount = 0;
        const existingSourceIds = await this.fetchAllBilledVdpConnectSourceIds();
        console.log(`  \u{1F50D} Loaded ${existingSourceIds.size} billed vdp_calls source_ids to exclude (paged; not capped at 1000)`);
        while (hasMore && (isInitialSync ? processedCount < MAX_INITIAL_PROCESSING : true)) {
          let query = supabaseAdmin.from("vdp_calls").select(
            "id, agent, company_email, firstName, lastName, phone, time, updated_at, market, event, sessionID"
          ).or("event.eq.END,event.eq.end").not("market", "ilike", "%aorecruit%").order("updated_at", { ascending: false }).range(offset, offset + batchSize - 1);
          if (!isInitialSync && since) {
            query = query.gte("updated_at", since);
          }
          const { data: calls, error } = await query;
          if (error) {
            console.error("\u274C Failed to fetch vdp_calls for billing sync:", error);
            break;
          }
          if (!calls || calls.length === 0) {
            hasMore = false;
            break;
          }
          const callsToProcess = calls.filter(
            (call) => typeof call.id === "number" && !existingSourceIds.has(call.id)
          );
          if (callsToProcess.length === 0) {
            if (calls.length < batchSize) {
              hasMore = false;
            } else {
              offset += batchSize;
            }
            continue;
          }
          let inserted = 0;
          for (const call of callsToProcess) {
            if (typeof call.id !== "number") continue;
            const leadName = this.combineName(call.firstName, call.lastName);
            const transactionDate = call.time || call.updated_at || (/* @__PURE__ */ new Date()).toISOString();
            const agentInfo = await this.resolveAgentInfo(
              call.company_email,
              call.agent,
              leadName
            );
            const payload = {
              transaction_id: `connect-${call.id}`,
              transaction_type: "connect",
              agent_email: agentInfo.email,
              agent_associate_id: agentInfo.associateId,
              agent_name: agentInfo.name,
              transaction_date: transactionDate,
              amount_usd: 8,
              credits_charged: 8,
              lead_name: leadName,
              lead_phone: call.phone || null,
              source_table: "vdp_calls",
              source_id: call.id,
              description: "AO Connect charge",
              metadata: {
                market: call.market ?? null,
                sessionID: call.sessionID ?? null,
                // Store sessionID (Taalk call ID) in metadata
                taalk_call_id: call.sessionID ?? null
                // Also store as taalk_call_id for easy lookup
              }
            };
            const { error: insertError } = await supabaseAdmin.from("billing_transactions").insert(payload);
            if (insertError) {
              if (insertError.code === "23505") {
                continue;
              }
              console.error("\u274C Failed to insert connect billing transaction:", insertError);
              continue;
            }
            try {
              await this.createBillingNotification(
                agentInfo.email,
                "connect",
                payload.amount_usd,
                payload.credits_charged,
                payload.lead_name,
                payload.transaction_id
              );
            } catch (notifError) {
              console.warn("\u26A0\uFE0F Failed to create billing notification (non-critical):", notifError);
            }
            inserted += 1;
            totalInserted += 1;
          }
          if (calls.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
          processedCount += calls.length;
          if (inserted > 0) {
            console.log(`  \u{1F4E6} Processed batch: ${inserted} new connect transactions (offset: ${offset - batchSize}, total processed: ${processedCount})`);
          }
        }
        if (isInitialSync && processedCount >= MAX_INITIAL_PROCESSING) {
          console.log(`  \u26A0\uFE0F Initial sync hit max processing limit (${MAX_INITIAL_PROCESSING}). Remaining records will be processed in next cycle.`);
        }
        return totalInserted;
      }
      async syncPrecheckTransactions(lookbackMinutes, isInitialSync = false) {
        if (!supabaseAdmin) return 0;
        const since = isInitialSync ? null : new Date(Date.now() - lookbackMinutes * 6e4).toISOString();
        let totalInserted = 0;
        let offset = 0;
        const batchSize = 500;
        let hasMore = true;
        let processedCount = 0;
        const existingSourceIds = await this.fetchAllBilledPrecheckSourceIds();
        console.log(`  \u{1F50D} Loaded ${existingSourceIds.size} billed verification_sessions source_ids to exclude (paged)`);
        while (hasMore && (isInitialSync ? processedCount < MAX_INITIAL_PROCESSING : true)) {
          let query = supabaseAdmin.from("verification_sessions").select(
            "id, first_name, last_name, phone, associate_id, agent_email, company_email, agent_first_name, agent_last_name, status, completed_at, updated_at, created_at"
          ).eq("status", "completed").order("created_at", { ascending: false }).range(offset, offset + batchSize - 1);
          if (!isInitialSync && since) {
            query = query.gte("created_at", since);
          }
          const { data: sessions, error } = await query;
          if (error) {
            console.error("\u274C Failed to fetch verification sessions for billing sync:", error);
            break;
          }
          if (!sessions || sessions.length === 0) {
            hasMore = false;
            break;
          }
          const sessionsToProcess = sessions.filter(
            (session) => typeof session.id === "number" && !existingSourceIds.has(session.id)
          );
          if (sessionsToProcess.length === 0) {
            if (sessions.length < batchSize) {
              hasMore = false;
            } else {
              offset += batchSize;
            }
            continue;
          }
          let inserted = 0;
          for (const session of sessionsToProcess) {
            if (typeof session.id !== "number") continue;
            const leadName = this.combineName(session.first_name, session.last_name);
            const agentName = this.combineName(session.agent_first_name, session.agent_last_name);
            const transactionDate = session.completed_at || session.updated_at || session.created_at || (/* @__PURE__ */ new Date()).toISOString();
            const agentInfo = await this.resolveAgentInfo(
              session.agent_email || session.company_email,
              session.associate_id,
              agentName
            );
            const payload = {
              transaction_id: `precheck-${session.id}`,
              transaction_type: "precheck",
              agent_email: agentInfo.email,
              agent_associate_id: agentInfo.associateId,
              agent_name: agentInfo.name,
              transaction_date: transactionDate,
              amount_usd: 3,
              credits_charged: 3,
              lead_name: leadName,
              lead_phone: session.phone || null,
              source_table: "verification_sessions",
              source_id: session.id,
              description: "AO PreCheck verification charge",
              metadata: {
                status: session.status,
                completedAt: session.completed_at
              }
            };
            inserted += 1;
            totalInserted += 1;
          }
          processedCount += sessions.length;
          if (sessions.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
          if (inserted > 0) {
            console.log(`  \u{1F4E6} Processed batch: ${inserted} new precheck transactions (offset: ${offset - batchSize}, total processed: ${processedCount})`);
          }
        }
        if (isInitialSync && processedCount >= MAX_INITIAL_PROCESSING) {
          console.log(`  \u26A0\uFE0F Initial sync hit max processing limit (${MAX_INITIAL_PROCESSING}). Remaining records will be processed in next cycle.`);
        }
        return totalInserted;
      }
      async syncRecruitTransactions(lookbackMinutes, isInitialSync = false) {
        if (!supabaseAdmin) return 0;
        const since = isInitialSync ? null : new Date(Date.now() - lookbackMinutes * 6e4).toISOString();
        let totalInserted = 0;
        let offset = 0;
        const batchSize = 500;
        let hasMore = true;
        let processedCount = 0;
        const existingTransactionIds = await this.fetchAllBilledRecruitTransactionIds();
        console.log(`  \u{1F50D} Loaded ${existingTransactionIds.size} billed recruit transaction_ids to exclude (paged)`);
        while (hasMore && (isInitialSync ? processedCount < MAX_INITIAL_PROCESSING : true)) {
          let query = supabaseAdmin.from("recruit_candidates").select(
            "id, first_name, last_name, phone, agent_email, agent_id, status, created_at, updated_at"
          ).order("created_at", { ascending: false }).range(offset, offset + batchSize - 1);
          if (!isInitialSync && since) {
            query = query.gte("created_at", since);
          }
          const { data: candidates, error } = await query;
          if (error) {
            console.error("\u274C Failed to fetch recruit candidates for billing sync:", error);
            break;
          }
          if (!candidates || candidates.length === 0) {
            hasMore = false;
            break;
          }
          const candidatesToProcess = candidates.filter((candidate) => {
            if (!candidate.id) return false;
            const transactionId = `recruit-${candidate.id}`;
            return !existingTransactionIds.has(transactionId);
          });
          if (candidatesToProcess.length === 0) {
            if (candidates.length < batchSize) {
              hasMore = false;
            } else {
              offset += batchSize;
            }
            continue;
          }
          let inserted = 0;
          for (const candidate of candidatesToProcess) {
            if (!candidate.id) continue;
            const transactionId = `recruit-${candidate.id}`;
            const leadName = this.combineName(candidate.first_name, candidate.last_name);
            const transactionDate = candidate.created_at || candidate.updated_at || (/* @__PURE__ */ new Date()).toISOString();
            const agentInfo = await this.resolveAgentInfo(
              candidate.agent_email,
              candidate.agent_id,
              null
            );
            const payload = {
              transaction_id: transactionId,
              transaction_type: "recruit",
              agent_email: agentInfo.email,
              agent_associate_id: agentInfo.associateId,
              agent_name: agentInfo.name,
              transaction_date: transactionDate,
              amount_usd: 5,
              credits_charged: 5,
              lead_name: leadName,
              lead_phone: candidate.phone || null,
              source_table: "recruit_candidates",
              source_id: String(candidate.id),
              description: "AO Recruit candidate charge",
              metadata: {
                recruit_candidate_id: candidate.id,
                status: candidate.status
              }
            };
            const { error: insertError } = await supabaseAdmin.from("billing_transactions").insert(payload);
            if (insertError) {
              if (insertError.code === "23505") {
                continue;
              }
              console.error("\u274C Failed to insert recruit billing transaction:", insertError);
              continue;
            }
            try {
              await this.createBillingNotification(
                agentInfo.email,
                "recruit",
                payload.amount_usd,
                payload.credits_charged,
                payload.lead_name,
                payload.transaction_id
              );
            } catch (notifError) {
              console.warn("\u26A0\uFE0F Failed to create billing notification (non-critical):", notifError);
            }
            inserted += 1;
            totalInserted += 1;
          }
          processedCount += candidates.length;
          if (candidates.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
          if (inserted > 0) {
            console.log(`  \u{1F4E6} Processed batch: ${inserted} new recruit transactions (offset: ${offset - batchSize}, total processed: ${processedCount})`);
          }
        }
        if (isInitialSync && processedCount >= MAX_INITIAL_PROCESSING) {
          console.log(`  \u26A0\uFE0F Initial sync hit max processing limit (${MAX_INITIAL_PROCESSING}). Remaining records will be processed in next cycle.`);
        }
        return totalInserted;
      }
      async resolveAgentInfo(email, associateId, fallbackName) {
        const normalizedEmail = email?.toLowerCase().trim() || null;
        const associateKey = associateId !== null && associateId !== void 0 ? String(associateId).trim() : null;
        if (normalizedEmail && this.agentCacheByEmail.has(normalizedEmail)) {
          return this.agentCacheByEmail.get(normalizedEmail);
        }
        if (associateKey && this.agentCacheByAssociate.has(associateKey)) {
          return this.agentCacheByAssociate.get(associateKey);
        }
        let resolvedEmail = normalizedEmail;
        let resolvedAssociate = null;
        let resolvedName = fallbackName && fallbackName.trim().length > 0 ? fallbackName.trim() : null;
        if (associateKey && /^\d+$/.test(associateKey)) {
          resolvedAssociate = Number(associateKey);
        }
        if (supabaseAdmin) {
          try {
            if (resolvedEmail) {
              const { data: customerByEmail } = await supabaseAdmin.from("customers").select("associate_id, first_name, last_name, company_email, personal_email").or(`company_email.eq.${resolvedEmail},personal_email.eq.${resolvedEmail}`).maybeSingle();
              if (customerByEmail) {
                resolvedAssociate = customerByEmail.associate_id ?? resolvedAssociate;
                const enrichedEmail = (customerByEmail.company_email || customerByEmail.personal_email)?.toLowerCase();
                if (enrichedEmail) {
                  resolvedEmail = enrichedEmail;
                }
                if (!resolvedName) {
                  const name = this.combineName(
                    customerByEmail.first_name,
                    customerByEmail.last_name
                  );
                  if (name) {
                    resolvedName = name;
                  }
                }
              }
            }
            if (associateKey) {
              const { data: customersById } = await supabaseAdmin.from("customers").select("associate_id, first_name, last_name, company_email, personal_email").eq("associate_id", associateKey).order("company_email", { ascending: false, nullsFirst: false }).limit(1);
              const customerById = customersById && customersById.length > 0 ? customersById[0] : null;
              if (customerById) {
                resolvedAssociate = customerById.associate_id ?? resolvedAssociate;
                const enrichedEmail = (customerById.company_email || customerById.personal_email)?.toLowerCase();
                if (!resolvedEmail && enrichedEmail) {
                  resolvedEmail = enrichedEmail;
                }
                if (!resolvedName) {
                  const name = this.combineName(
                    customerById.first_name,
                    customerById.last_name
                  );
                  if (name) {
                    resolvedName = name;
                  }
                }
              }
            }
            if (associateKey) {
              const { data: hierarchy } = await supabaseAdmin.from("agent_hierarchy").select("agent_email, agent_name, agent_associate_id").eq("agent_associate_id", associateKey).maybeSingle();
              if (hierarchy) {
                const hEmail = hierarchy.agent_email?.toLowerCase();
                if (!resolvedEmail && hEmail) {
                  resolvedEmail = hEmail;
                }
                if (!resolvedName && hierarchy.agent_name) {
                  resolvedName = hierarchy.agent_name;
                }
                if (!resolvedAssociate && hierarchy.agent_associate_id) {
                  resolvedAssociate = Number(hierarchy.agent_associate_id);
                }
              }
            }
          } catch (lookupError) {
            console.warn("\u26A0\uFE0F Agent resolution lookup failed:", lookupError);
          }
        }
        if (!resolvedEmail) {
          if (associateKey) {
            resolvedEmail = `associate-${associateKey}@pending-lookup.aogi`;
          } else {
            resolvedEmail = "unknown@pending-lookup.aogi";
          }
        }
        if (!resolvedAssociate && associateKey && /^\d+$/.test(associateKey)) {
          resolvedAssociate = Number(associateKey);
        }
        if (!resolvedName) {
          resolvedName = resolvedEmail.split("@")[0];
        }
        const info = {
          email: resolvedEmail,
          associateId: resolvedAssociate,
          name: resolvedName
        };
        this.agentCacheByEmail.set(info.email, info);
        if (associateKey) {
          this.agentCacheByAssociate.set(associateKey, info);
        }
        return info;
      }
      combineName(first, last) {
        const parts = [first, last].filter(Boolean).map((value) => value.trim());
        if (parts.length === 0) return null;
        return parts.join(" ");
      }
      /**
       * Create a billing notification for an agent
       */
      async createBillingNotification(agentEmail, transactionType, amountUsd, creditsCharged, leadName, transactionId) {
        if (!supabaseAdmin) return;
        const serviceNames = {
          connect: "AO Connect",
          precheck: "AO PreCheck",
          recruit: "AO Recruit"
        };
        const serviceName = serviceNames[transactionType] || transactionType;
        const leadDisplay = leadName ? ` for ${leadName}` : "";
        const { error } = await supabaseAdmin.from("agent_notifications").insert({
          agent_email: agentEmail.toLowerCase(),
          notification_type: "billing_transaction",
          title: `${serviceName} Charge`,
          message: `You were charged $${amountUsd.toFixed(2)} (${creditsCharged} credits)${leadDisplay}`,
          read: false,
          metadata: {
            transaction_type: transactionType,
            transaction_id: transactionId,
            amount_usd: amountUsd,
            credits_charged: creditsCharged,
            lead_name: leadName
          }
        });
        if (error) {
          console.error("\u274C Failed to create billing notification:", error);
          throw error;
        }
      }
    };
    billingTransactionSync = new BillingTransactionSync();
  }
});

// server/verification-screenshot-validator.ts
import OpenAI from "openai";
var openAIClient, VerificationScreenshotValidator, verificationScreenshotValidator;
var init_verification_screenshot_validator = __esm({
  "server/verification-screenshot-validator.ts"() {
    "use strict";
    init_hardcoded_config();
    openAIClient = new OpenAI({
      apiKey: OPENAI_API_KEY
    });
    VerificationScreenshotValidator = class {
      /**
       * Validate a verification screenshot using AI vision with retry logic for rate limits
       */
      async validateScreenshot(screenshotBase64, verificationMethod) {
        const MAX_RETRIES = 3;
        const INITIAL_RETRY_DELAY = 2e3;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            if (attempt > 0) {
              const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
              console.log(`\u23F3 Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
            console.log(`\u{1F916} Validating ${verificationMethod} verification screenshot with AI...`);
            const prompt = this.buildPrompt(verificationMethod);
            const base64Data = screenshotBase64.includes("base64,") ? screenshotBase64.split("base64,")[1] : screenshotBase64;
            const response = await openAIClient.chat.completions.create({
              model: "gpt-4o-mini",
              // Using mini for cost-effectiveness, can upgrade to gpt-4o if needed
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: prompt
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:image/png;base64,${base64Data}`,
                        detail: "high"
                        // Use high detail for better accuracy
                      }
                    }
                  ]
                }
              ],
              max_tokens: 500,
              temperature: 0.1
              // Low temperature for consistent validation
            });
            const aiResponse = response.choices[0]?.message?.content || "{}";
            console.log("\u{1F916} AI Raw Response:", aiResponse);
            const analysis = this.parseAIResponse(aiResponse, verificationMethod);
            const issues = [...analysis.issues];
            const hasVideoInterface = analysis.detectedElements.hasVideoCallInterface || analysis.detectedElements.hasZoomUI || analysis.detectedElements.hasFaceTimeUI || analysis.detectedElements.hasWhatsAppUI || analysis.detectedElements.hasOtherVideoCallUI;
            const hasTwoParticipants = analysis.detectedElements.hasMultiplePeople || analysis.detectedElements.peopleCount >= 2;
            if (hasTwoParticipants && (hasVideoInterface || analysis.validationType === "video_call" || analysis.validationType === "zoom_meeting")) {
              if (analysis.isValid) {
                if (analysis.confidence < 0.6) {
                  analysis.confidence = 0.7;
                }
              } else {
                analysis.isValid = true;
                analysis.issues = [];
                analysis.reason = "Valid screenshot showing 2+ people in a video call (Zoom, FaceTime, etc.)";
                analysis.confidence = Math.max(analysis.confidence, 0.7);
              }
            } else {
              if (!hasTwoParticipants) {
                issues.push(
                  "Screenshot must display at least two participants (agent and client) on the call."
                );
              }
              if (!hasTwoParticipants && !hasVideoInterface) {
                issues.push(
                  "Screenshot must show a video call interface (Zoom, FaceTime, WhatsApp, Google Meet, etc.) or clearly show 2+ people in a video call context."
                );
              }
              if (issues.length > 0) {
                analysis.isValid = false;
                analysis.issues = issues;
                analysis.reason = issues.join(" ");
                analysis.confidence = Math.min(analysis.confidence, 0.4);
              }
            }
            console.log(`\u2705 Validation complete: ${analysis.isValid ? "VALID" : "INVALID"} (${analysis.confidence})`);
            console.log(`   Type: ${analysis.validationType}`);
            console.log(`   Reason: ${analysis.reason}`);
            return analysis;
          } catch (error) {
            const isApiKeyError = error.status === 401 || error.statusCode === 401 || error.message?.includes("401") || error.message?.toLowerCase().includes("incorrect api key") || error.message?.toLowerCase().includes("invalid api key") || error.message?.toLowerCase().includes("authentication");
            if (isApiKeyError) {
              console.error(`\u274C\u274C\u274C OPENAI API KEY ERROR:`, error.message);
              console.error(`   Status: ${error.status || error.statusCode}`);
              console.error(`   API Key (first 20 chars): ${OPENAI_API_KEY?.substring(0, 20)}...`);
              console.error(`   API Key (last 10 chars): ...${OPENAI_API_KEY?.substring(OPENAI_API_KEY.length - 10)}`);
              console.error(`   Full error:`, error);
              return {
                isValid: false,
                confidence: 0,
                validationType: "unclear",
                detectedElements: {
                  hasMultiplePeople: false,
                  hasVideoCallInterface: false,
                  hasZoomUI: false,
                  hasFaceTimeUI: false,
                  hasWhatsAppUI: false,
                  hasOtherVideoCallUI: false,
                  peopleCount: 0
                },
                reason: `OpenAI API key is invalid or expired. Please update the API key in hardcoded-config.ts. Error: ${error.message || "401 Unauthorized"}`,
                issues: [`Unable to validate screenshot due to API key error: ${error.message || "401 Unauthorized"}`]
              };
            }
            const isRateLimit = error.status === 429 || error.message?.includes("429") || error.message?.toLowerCase().includes("rate limit") || error.message?.toLowerCase().includes("quota") || error.message?.toLowerCase().includes("exceeded");
            if (isRateLimit && attempt < MAX_RETRIES) {
              continue;
            }
            if (isRateLimit) {
              console.error(`\u274C Rate limit error after ${MAX_RETRIES + 1} attempts:`, error.message);
              return {
                isValid: false,
                confidence: 0,
                validationType: "unclear",
                detectedElements: {
                  hasMultiplePeople: false,
                  hasVideoCallInterface: false,
                  hasZoomUI: false,
                  hasFaceTimeUI: false,
                  hasWhatsAppUI: false,
                  hasOtherVideoCallUI: false,
                  peopleCount: 0
                },
                reason: `Rate limit exceeded. Please try again later. If this persists, check your OpenAI API quota.`,
                issues: ["Rate limit error - analysis will be retried automatically"]
              };
            }
            console.error("\u274C AI validation error:", error.message);
            return {
              isValid: false,
              confidence: 0,
              validationType: "unclear",
              detectedElements: {
                hasMultiplePeople: false,
                hasVideoCallInterface: false,
                hasZoomUI: false,
                hasFaceTimeUI: false,
                hasWhatsAppUI: false,
                hasOtherVideoCallUI: false,
                peopleCount: 0
              },
              reason: `AI validation failed: ${error.message}`,
              issues: ["Unable to validate screenshot due to technical error"]
            };
          }
        }
        return {
          isValid: false,
          confidence: 0,
          validationType: "unclear",
          detectedElements: {
            hasMultiplePeople: false,
            hasVideoCallInterface: false,
            hasZoomUI: false,
            hasFaceTimeUI: false,
            hasWhatsAppUI: false,
            hasOtherVideoCallUI: false,
            peopleCount: 0
          },
          reason: "Unexpected error during validation",
          issues: ["Technical error"]
        };
      }
      /**
       * Build the validation prompt based on verification method
       */
      buildPrompt(verificationMethod) {
        const basePrompt = `You are analyzing a verification screenshot submitted by an insurance agent.

Your task is to determine if this screenshot is VALID or INVALID based on these requirements:`;
        const zoomPrompt = `

**REQUIREMENTS FOR ZOOM VERIFICATION:**
- Must show AT LEAST 2 people visible in the video (the agent AND the client)
- Should show a video call interface (Zoom, FaceTime, or similar video call app)
- As long as it shows 2 people and looks like a video call (Zoom, FaceTime, etc.), it's valid
- **IMPORTANT:** It's normal for one person to appear larger than the other (speaker view, gallery view, etc.)
- **IMPORTANT:** You don't need to identify which person is the agent vs client - just count that there are 2+ people
- **IMPORTANT:** Size differences are normal - one person may be in a large main view while the other is in a smaller thumbnail
- Valid examples: Zoom gallery view, Zoom meeting with multiple people (one large, one small), FaceTime with 2 people, any video call showing 2+ participants

**INVALID submissions include:**
- Random screenshots or photos (not a video call)
- Screenshots showing only 1 person
- Screenshots that are clearly not from a video call context

**ACCEPTABLE:**
- Slightly blurry participants are OK - as long as you can identify that there are 2+ people, it's valid
- Minor blurriness or image quality issues are acceptable - only reject if you truly cannot identify if there are 2 people`;
        const phonePrompt = `

**REQUIREMENTS FOR PHONE/VIDEO CALL VERIFICATION:**
- Must show AT LEAST 2 people visible (the agent AND the client)
- Should show a video call interface (FaceTime, WhatsApp Video, Zoom, Google Meet, etc.)
- As long as it shows 2 people and looks like a video call, it's valid
- **IMPORTANT:** It's normal for one person to appear larger than the other (speaker view, main participant view, etc.)
- **IMPORTANT:** You don't need to identify which person is the agent vs client - just count that there are 2+ people
- **IMPORTANT:** Size differences are normal - one person may be in a large main view while the other is in a smaller thumbnail or corner
- Valid examples: FaceTime call screen with 2 people (one large, one small), WhatsApp video call with 2 people, Zoom mobile call, any video call showing 2+ participants

**INVALID submissions include:**
- Random screenshots or photos (not a video call)
- Regular phone calls (voice only, no video, no people visible)
- Screenshots showing only 1 person
- Screenshots that are clearly not from a video call context
- Blurry or unclear images where you cannot identify if there are 2 people`;
        const requirements = verificationMethod === "zoom" ? zoomPrompt : phonePrompt;
        return `${basePrompt}${requirements}

**YOUR RESPONSE MUST BE VALID JSON with this exact structure:**
{
  "isValid": true or false,
  "confidence": 0.0 to 1.0,
  "validationType": "zoom_meeting" | "video_call" | "invalid" | "unclear",
  "detectedElements": {
    "hasMultiplePeople": true/false,
    "hasVideoCallInterface": true/false,
    "hasZoomUI": true/false,
    "hasFaceTimeUI": true/false,
    "hasWhatsAppUI": true/false,
    "hasOtherVideoCallUI": true/false,
    "peopleCount": number (0 if unclear)
  },
  "reason": "Clear explanation of why this is valid or invalid",
  "issues": ["Array of specific issues if invalid, empty array if valid"]
}

**IMPORTANT:** 
- Be lenient in validation - if it shows 2 people and looks like a video call (Zoom, FaceTime, etc.), mark as valid
- Primary requirement: 2+ people visible in what appears to be a video call context
- **CRITICAL:** Size differences between people are NORMAL and EXPECTED - one person may be large (main view) and the other small (thumbnail/corner)
- **CRITICAL:** You only need to COUNT people, not identify who is who - if you see 2+ faces/people, that's valid
- **CRITICAL:** Don't get confused by size differences - a small person in the corner still counts as a person
- **CRITICAL:** Slightly blurry participants are ACCEPTABLE - as long as you can identify that there are 2+ people, mark as valid
- **CRITICAL:** Minor blurriness or image quality issues should NOT cause rejection - only reject if you truly cannot identify if there are 2 people
- If the screenshot shows 2 people and appears to be from a video call app, mark as valid even if UI elements aren't perfectly clear
- If you're unsure (very blurry, completely unclear), set confidence < 0.7 and explain in reason
- Only mark as invalid if it's obviously wrong (random photo, only 1 person, clearly not a video call, completely unidentifiable) with confidence > 0.8`;
      }
      /**
       * Parse the AI response into structured data
       */
      parseAIResponse(aiResponse, verificationMethod) {
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("No JSON found in AI response");
          }
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            isValid: parsed.isValid === true,
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
            validationType: parsed.validationType || "unclear",
            detectedElements: {
              hasMultiplePeople: parsed.detectedElements?.hasMultiplePeople === true,
              hasVideoCallInterface: parsed.detectedElements?.hasVideoCallInterface === true,
              hasZoomUI: parsed.detectedElements?.hasZoomUI === true,
              hasFaceTimeUI: parsed.detectedElements?.hasFaceTimeUI === true,
              hasWhatsAppUI: parsed.detectedElements?.hasWhatsAppUI === true,
              hasOtherVideoCallUI: parsed.detectedElements?.hasOtherVideoCallUI === true,
              peopleCount: typeof parsed.detectedElements?.peopleCount === "number" ? parsed.detectedElements.peopleCount : 0
            },
            reason: parsed.reason || "No reason provided",
            issues: Array.isArray(parsed.issues) ? parsed.issues : []
          };
        } catch (error) {
          console.error("\u274C Failed to parse AI response:", error.message);
          console.log("Raw AI response:", aiResponse);
          return {
            isValid: false,
            confidence: 0,
            validationType: "unclear",
            detectedElements: {
              hasMultiplePeople: false,
              hasVideoCallInterface: false,
              hasZoomUI: false,
              hasFaceTimeUI: false,
              hasWhatsAppUI: false,
              hasOtherVideoCallUI: false,
              peopleCount: 0
            },
            reason: "Failed to parse AI validation response",
            issues: ["Technical error during validation"]
          };
        }
      }
      /**
       * Batch validate multiple screenshots
       */
      async validateMultipleScreenshots(screenshots, verificationMethod) {
        console.log(`\u{1F4F8} Validating ${screenshots.length} screenshots...`);
        const analyses = [];
        for (let i = 0; i < screenshots.length; i++) {
          console.log(`
\u{1F4F8} Validating screenshot ${i + 1}/${screenshots.length}${screenshots[i].filename ? ": " + screenshots[i].filename : ""}...`);
          const analysis = await this.validateScreenshot(screenshots[i].data, verificationMethod);
          analyses.push(analysis);
          if (i < screenshots.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2e3));
          }
        }
        const validCount = analyses.filter((a) => a.isValid).length;
        const invalidCount = analyses.filter((a) => !a.isValid).length;
        const overallValid = analyses.some((a) => a.isValid && a.confidence >= 0.7);
        console.log(`
\u2705 Batch validation complete: ${validCount} valid, ${invalidCount} invalid`);
        return {
          overallValid,
          validCount,
          invalidCount,
          analyses
        };
      }
    };
    verificationScreenshotValidator = new VerificationScreenshotValidator();
  }
});

// server/verification-audio-analyzer.ts
import { File } from "node:buffer";
import OpenAI2 from "openai";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";
var openAIClient2, VerificationAudioAnalyzer, verificationAudioAnalyzer;
var init_verification_audio_analyzer = __esm({
  "server/verification-audio-analyzer.ts"() {
    "use strict";
    init_hardcoded_config();
    if (typeof globalThis.File === "undefined") {
      globalThis.File = File;
    }
    openAIClient2 = new OpenAI2({
      apiKey: OPENAI_API_KEY
    });
    VerificationAudioAnalyzer = class {
      /**
       * Download audio file from URL
       */
      async downloadAudio(url) {
        return new Promise((resolve, reject) => {
          const client = url.startsWith("https") ? https : http;
          client.get(url, (res) => {
            if (res.statusCode !== 200) {
              reject(new Error(`Failed to download audio: ${res.statusCode}`));
              return;
            }
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve(Buffer.concat(chunks)));
            res.on("error", reject);
          }).on("error", reject);
        });
      }
      /**
       * Transcribe audio using OpenAI Whisper API
       */
      async transcribeAudio(audioData, filename = "audio.mp3") {
        try {
          console.log("\u{1F3A4} Transcribing audio with Whisper API...");
          const tempFilePath = path.join(os.tmpdir(), `temp-${Date.now()}-${filename}`);
          fs.writeFileSync(tempFilePath, audioData);
          try {
            const transcription = await openAIClient2.audio.transcriptions.create({
              file: fs.createReadStream(tempFilePath),
              model: "whisper-1",
              response_format: "verbose_json"
            });
            console.log("\u2705 Audio transcribed successfully");
            fs.unlinkSync(tempFilePath);
            return transcription.text;
          } catch (transcriptionError) {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
            throw transcriptionError;
          }
        } catch (error) {
          console.error("\u274C Transcription error:", error.message);
          throw new Error(`Failed to transcribe audio: ${error.message}`);
        }
      }
      /**
       * Analyze verification call transcript using GPT
       */
      async analyzeTranscript(transcript, verificationMethod) {
        try {
          console.log("\u{1F916} Analyzing transcript with GPT...");
          const prompt = `You are analyzing a transcript from an insurance verification call. The agent is verifying a policy with a client.

**IMPORTANT:** This call may be in ENGLISH or SPANISH. Analyze it in whichever language it's in, but respond in English JSON.

**ANALYSIS REQUIREMENTS:**

1. **Validation** - Determine if this is a legitimate verification call:
   - Must include agent introducing themselves (in English or Spanish)
   - Must include client confirmation/participation
   - Must discuss policy details (coverage, premium, beneficiary, etc.)
   - Should NOT be: wrong number, hang-up, voicemail, test call, random conversation

2. **Summary** - Create a brief 2-3 sentence summary of what happened on the call (in English, even if call was in Spanish)

3. **Key Moments** - Identify 3-5 key moments in the conversation with approximate timestamps

4. **Sentiment** - Overall sentiment: Positive, Neutral, or Negative

5. **Issues** - List any problems: incomplete verification, client confusion, technical issues, language barriers, etc.

**TRANSCRIPT (may be English or Spanish):**
${transcript}

**RESPONSE FORMAT (MUST BE VALID JSON IN ENGLISH):**
{
  "summary": "Brief 2-3 sentence summary in English",
  "validation": {
    "isValid": true/false,
    "confidence": 0.0 to 1.0,
    "reason": "Explanation of validation decision in English",
    "detectedIssues": ["array of issues if any, in English"]
  },
  "keyMoments": [
    {"timestamp": "0:15", "description": "Agent introduces themselves (in Spanish/English)"},
    {"timestamp": "1:30", "description": "Client confirms policy details"}
  ],
  "sentiment": "Positive" | "Neutral" | "Negative"
}`;
          const response = await openAIClient2.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are an expert at analyzing insurance verification calls. Always respond with valid JSON."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 1e3,
            temperature: 0.1
          });
          const aiResponse = response.choices[0]?.message?.content || "{}";
          console.log("\u{1F916} AI Analysis Response:", aiResponse);
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("No JSON found in AI response");
          }
          const analysis = JSON.parse(jsonMatch[0]);
          console.log("\u2705 Transcript analyzed successfully");
          return {
            summary: analysis.summary || "No summary available",
            validation: {
              isValid: analysis.validation?.isValid || false,
              confidence: analysis.validation?.confidence || 0,
              reason: analysis.validation?.reason || "Unable to validate",
              detectedIssues: analysis.validation?.detectedIssues || []
            },
            keyMoments: analysis.keyMoments || [],
            sentiment: analysis.sentiment || "Neutral",
            duration: void 0
          };
        } catch (error) {
          console.error("\u274C Analysis error:", error.message);
          throw new Error(`Failed to analyze transcript: ${error.message}`);
        }
      }
      /**
       * Full analysis: download, transcribe, and analyze audio
       */
      async analyzeAudioFromUrl(audioUrl, verificationMethod = "phone") {
        try {
          console.log(`\u{1F399}\uFE0F  Starting audio analysis for ${verificationMethod} verification`);
          console.log(`\u{1F4E5} Audio URL: ${audioUrl.substring(0, 100)}...`);
          console.log("\u{1F4E5} Downloading audio...");
          const audioBuffer = await this.downloadAudio(audioUrl);
          console.log(`\u2705 Downloaded: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
          const transcript = await this.transcribeAudio(audioBuffer, "recording.mp3");
          const analysis = await this.analyzeTranscript(transcript, verificationMethod);
          const fullAnalysis = {
            transcript,
            ...analysis,
            confidence: analysis.validation?.confidence ?? 0,
            isLegitimate: analysis.validation?.isValid ?? false,
            analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          console.log("\u2705 Audio analysis complete!");
          console.log(`   Valid: ${fullAnalysis.validation.isValid ? "YES" : "NO"} (${(fullAnalysis.validation.confidence * 100).toFixed(0)}%)`);
          console.log(`   Sentiment: ${fullAnalysis.sentiment}`);
          return fullAnalysis;
        } catch (error) {
          console.error("\u274C Audio analysis failed:", error.message);
          throw error;
        }
      }
      /**
       * Analyze audio from local file buffer
       */
      async analyzeAudioFromBuffer(audioBuffer, verificationMethod = "phone") {
        try {
          console.log(`\u{1F399}\uFE0F  Starting audio analysis for ${verificationMethod} verification`);
          const transcript = await this.transcribeAudio(audioBuffer, "recording.mp3");
          const analysis = await this.analyzeTranscript(transcript, verificationMethod);
          const fullAnalysis = {
            transcript,
            ...analysis,
            confidence: analysis.validation?.confidence ?? 0,
            isLegitimate: analysis.validation?.isValid ?? false,
            analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          console.log("\u2705 Audio analysis complete!");
          return fullAnalysis;
        } catch (error) {
          console.error("\u274C Audio analysis failed:", error.message);
          throw error;
        }
      }
    };
    verificationAudioAnalyzer = new VerificationAudioAnalyzer();
  }
});

// server/verification-analysis-scheduler.ts
var verification_analysis_scheduler_exports = {};
__export(verification_analysis_scheduler_exports, {
  VerificationAnalysisScheduler: () => VerificationAnalysisScheduler,
  verificationAnalysisScheduler: () => verificationAnalysisScheduler
});
import cron4 from "node-cron";
import fetch2 from "node-fetch";
var VerificationAnalysisScheduler, verificationAnalysisScheduler;
var init_verification_analysis_scheduler = __esm({
  "server/verification-analysis-scheduler.ts"() {
    "use strict";
    init_verification_screenshot_validator();
    init_verification_audio_analyzer();
    init_supabase();
    init_hardcoded_config();
    VerificationAnalysisScheduler = class _VerificationAnalysisScheduler {
      static instance;
      cronJob = null;
      isRunning = false;
      constructor() {
      }
      static getInstance() {
        if (!_VerificationAnalysisScheduler.instance) {
          _VerificationAnalysisScheduler.instance = new _VerificationAnalysisScheduler();
        }
        return _VerificationAnalysisScheduler.instance;
      }
      /**
       * Start the verification analysis scheduler
       * Runs every hour to analyze unprocessed verification sessions (AI summaries for AO Precheck)
       */
      start() {
        if (this.isRunning) {
          console.log("\u{1F504} Verification analysis scheduler already running");
          return;
        }
        this.cronJob = cron4.schedule(
          "0 * * * *",
          // Every hour at minute 0
          async () => {
            console.log("\u23F0 Hourly AI analysis scheduler triggered");
            await this.runAnalysisProcess();
          },
          {
            timezone: "America/New_York"
          }
        );
        this.isRunning = true;
        console.log("\u2705 Verification analysis scheduler started - analyzing AI summaries every hour");
        setTimeout(() => {
          console.log("\u{1F680} Running initial AI analysis on startup...");
          this.runAnalysisProcess();
        }, 1e4);
      }
      /**
       * Stop the scheduler
       */
      stop() {
        if (this.cronJob) {
          this.cronJob.stop();
          this.cronJob = null;
        }
        this.isRunning = false;
        console.log("\u23F8\uFE0F Verification analysis scheduler stopped");
      }
      /**
       * Run the analysis process
       */
      async runAnalysisProcess() {
        console.log("\n\u{1F916} Starting automatic verification analysis...");
        try {
          await this.analyzeScreenshots();
          await this.analyzeAudio();
          console.log("\u2705 Automatic verification analysis complete\n");
        } catch (error) {
          console.error("\u274C Error in verification analysis process:", error);
        }
      }
      /**
       * Analyze unprocessed screenshots
       * Made public so it can be called immediately after screenshot upload
       */
      async analyzeScreenshots() {
        if (!supabaseAdmin) {
          console.error("\u274C Supabase admin client not configured for screenshot analysis");
          return;
        }
        try {
          const BATCH_SIZE = 25;
          let processed = 0;
          const MAX_ITERATIONS = 100;
          let iterations = 0;
          while (iterations < MAX_ITERATIONS) {
            iterations++;
            const { data: allSessions, error } = await supabaseAdmin.from("verification_sessions").select("*").or("screenshot_url.not.is.null,screenshot_path.not.is.null").order("created_at", { ascending: false }).limit(BATCH_SIZE * 5);
            if (error) {
              console.error("\u274C Error fetching sessions for screenshot analysis:", error);
              return;
            }
            if (!allSessions || allSessions.length === 0) {
              if (processed === 0) {
                console.log("\u{1F4F8} No sessions needing screenshot analysis");
              } else {
                console.log(`\u{1F4F8} Screenshot analysis complete. Processed ${processed} session(s).`);
              }
              break;
            }
            const sessions = allSessions.filter((session) => {
              const hasScreenshot = session.screenshot_url && session.screenshot_url !== "PENDING" && session.screenshot_url.trim() !== "" || session.screenshot_path && session.screenshot_path !== "PENDING" && session.screenshot_path.trim() !== "";
              const needsAnalysis = session.screenshot_analysis_complete === null || session.screenshot_analysis_complete === false;
              const retryCount = session.screenshot_analysis_retry_count ?? 0;
              const canRetry = retryCount < 1;
              return hasScreenshot && needsAnalysis && canRetry;
            });
            if (sessions.length === 0) {
              if (processed === 0) {
                console.log("\u{1F4F8} No sessions needing screenshot analysis");
              } else {
                console.log(`\u{1F4F8} Screenshot analysis complete. Processed ${processed} session(s).`);
              }
              break;
            }
            console.log(`\u{1F4F8} Processing ${sessions.length} session(s) for screenshot analysis`);
            for (const session of sessions) {
              if (session.screenshot_analysis_complete === true) {
                console.log(`  \u23ED\uFE0F  Skipping session ${session.id} - already analyzed`);
                continue;
              }
              const retryCount = session.screenshot_analysis_retry_count || 0;
              if (retryCount >= 1) {
                console.log(`  \u23ED\uFE0F  Skipping session ${session.id} - already retried once (retry_count: ${retryCount})`);
                continue;
              }
              processed += 1;
              try {
                console.log(`  Processing screenshot for session ${session.id} - ${session.agent_email || session.company_email}`);
                const screenshotDataUrl = await this.fetchScreenshotDataUrl(session);
                if (!screenshotDataUrl) {
                  console.warn(`  \u26A0\uFE0F No screenshot available for session ${session.id}`);
                  await supabaseAdmin.from("verification_sessions").update({
                    screenshot_validation: {
                      issues: ["Missing required screenshot"],
                      reason: "NO SCREENSHOT PROVIDED - Screenshot is required for all verifications",
                      isValid: false,
                      confidence: 1,
                      validationType: "invalid",
                      detectedElements: {
                        hasZoomUI: false,
                        isInPerson: false,
                        peopleCount: 0,
                        imageQuality: "unusable",
                        hasFaceTimeUI: false,
                        hasWhatsAppUI: false,
                        hasMultiplePeople: false,
                        hasOtherVideoCallUI: false,
                        hasVideoCallInterface: false
                      }
                    },
                    screenshot_analysis_complete: true,
                    screenshot_analysis_confidence: 0
                  }).eq("id", session.id);
                  continue;
                }
                console.log(`  \u{1F916} Analyzing screenshot with AI...`);
                const validation = await verificationScreenshotValidator.validateScreenshot(
                  screenshotDataUrl,
                  session.verification_method || "zoom"
                );
                if (!validation) {
                  console.error(`  \u274C Screenshot validation returned null/undefined for session ${session.id}`);
                  continue;
                }
                console.log(`  \u{1F4BE} Saving analysis results to database...`);
                const { error: updateError, data: updatedRows } = await supabaseAdmin.from("verification_sessions").update({
                  screenshot_validation: validation,
                  screenshot_analysis_complete: true,
                  screenshot_analysis_confidence: validation?.confidence ?? 0,
                  verification_result: validation.isValid ? "COMPLETED" : "FAILED",
                  screenshot_analysis_retry_count: 0
                  // Reset retry count on success
                }).eq("id", session.id).select("id, screenshot_analysis_complete");
                if (updateError) {
                  console.error(`  \u274C CRITICAL: Failed to save screenshot analysis to database for session ${session.id}:`, updateError);
                  console.error(`     This session will be re-analyzed on next run!`);
                  throw updateError;
                }
                if (!updatedRows || updatedRows.length === 0) {
                  console.error(`  \u274C CRITICAL: No rows updated for session ${session.id} - session may not exist`);
                  console.error(`     This session will be re-analyzed on next run!`);
                } else {
                  console.log(`  \u2705 Screenshot analyzed and MARKED COMPLETE: ${validation.isValid ? "VALID" : "INVALID"} (${(validation.confidence * 100).toFixed(0)}% confidence)`);
                }
                await new Promise((resolve) => setTimeout(resolve, 2e3));
              } catch (error2) {
                console.error(`  \u274C Failed to analyze screenshot for session ${session.id}:`, error2);
                console.error(`     Error details:`, error2.message);
                if (error2.stack) {
                  console.error(`     Stack:`, error2.stack.split("\n").slice(0, 3).join("\n"));
                }
                const currentRetryCount = session.screenshot_analysis_retry_count || 0;
                const newRetryCount = currentRetryCount + 1;
                await supabaseAdmin.from("verification_sessions").update({
                  screenshot_analysis_retry_count: newRetryCount
                }).eq("id", session.id);
                if (newRetryCount >= 1) {
                  console.log(`  \u26A0\uFE0F  Session ${session.id} marked as failed after ${newRetryCount} retry attempt(s). Will not retry again.`);
                }
              }
            }
            if (iterations >= MAX_ITERATIONS) {
              console.warn(`\u26A0\uFE0F  Reached maximum iterations (${MAX_ITERATIONS}) for screenshot analysis. Stopping to prevent infinite loop.`);
              break;
            }
          }
        } catch (error) {
          console.error("\u274C Error in screenshot analysis:", error);
        }
      }
      /**
       * Analyze unprocessed audio recordings
       */
      async analyzeAudio() {
        if (!supabaseAdmin) {
          console.error("\u274C Supabase admin client not configured for audio analysis");
          return;
        }
        try {
          const BATCH_SIZE = 10;
          let processed = 0;
          const MAX_ITERATIONS = 100;
          let iterations = 0;
          const processedSessionIds = /* @__PURE__ */ new Set();
          while (iterations < MAX_ITERATIONS) {
            iterations++;
            const { data: sessions, error } = await supabaseAdmin.from("verification_sessions").select("*").or("and(recording_url.not.is.null,recording_url.neq.PENDING),and(call_transcript.not.is.null,call_transcript.neq.PENDING)").or("call_analysis_complete.is.null,call_analysis_complete.eq.false").or("audio_analysis_retry_count.is.null,audio_analysis_retry_count.lt.1").order("created_at", { ascending: false }).limit(BATCH_SIZE);
            if (error) {
              console.error("\u274C Error fetching sessions for audio analysis:", error);
              return;
            }
            if (!sessions || sessions.length === 0) {
              if (processed === 0) {
                console.log("\u{1F3B5} No sessions needing audio analysis");
              } else {
                console.log(`\u{1F3B5} Audio analysis complete. Processed ${processed} session(s).`);
              }
              break;
            }
            const newSessions = sessions.filter((s) => !processedSessionIds.has(s.id) && (s.call_analysis_complete !== true || s.audio_analysis === null));
            if (newSessions.length === 0) {
              console.log(`\u{1F3B5} All remaining sessions already processed. Stopping.`);
              break;
            }
            console.log(`\u{1F3B5} Processing ${sessions.length} session(s) for audio analysis`);
            for (const session of sessions) {
              if (processedSessionIds.has(session.id)) {
                console.log(`  \u23ED\uFE0F  Skipping session ${session.id} - already processed in this run`);
                continue;
              }
              if (session.call_analysis_complete === true && session.audio_analysis !== null) {
                console.log(`  \u23ED\uFE0F  Skipping session ${session.id} - already analyzed`);
                continue;
              }
              const retryCount = session.audio_analysis_retry_count || 0;
              if (retryCount >= 1) {
                console.log(`  \u23ED\uFE0F  Skipping session ${session.id} - already retried once (retry_count: ${retryCount})`);
                continue;
              }
              processedSessionIds.add(session.id);
              processed += 1;
              try {
                console.log(`  Processing audio for session ${session.id} - ${session.agent_email || session.company_email}`);
                let analysis;
                const hasValidTranscript = session.call_transcript && session.call_transcript.trim() !== "" && session.call_transcript.trim() !== "[]" && session.call_transcript.trim().toUpperCase() !== "PENDING";
                const hasRecordingUrl = session.recording_url && session.recording_url !== "PENDING";
                if (hasValidTranscript && !hasRecordingUrl) {
                  console.log(`  \u{1F4DD} Session has transcript but no recording_url - analyzing transcript directly...`);
                  const transcriptAnalysis = await verificationAudioAnalyzer.analyzeTranscript(
                    session.call_transcript,
                    session.verification_method || "phone"
                  );
                  analysis = {
                    transcript: session.call_transcript,
                    ...transcriptAnalysis,
                    confidence: transcriptAnalysis.validation?.confidence ?? 0,
                    isLegitimate: transcriptAnalysis.validation?.isValid ?? false,
                    analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
                  };
                } else if (hasRecordingUrl) {
                  analysis = await verificationAudioAnalyzer.analyzeAudioFromUrl(
                    session.recording_url,
                    session.verification_method || "phone"
                  );
                } else {
                  console.log(`  \u26A0\uFE0F  Session has neither valid recording_url nor call_transcript - skipping`);
                  continue;
                }
                const confidence = analysis.validation?.confidence ?? analysis.confidence ?? 0;
                const updateData = {
                  audio_analysis: analysis,
                  call_analysis_complete: true,
                  verification_result: analysis.isLegitimate ? "COMPLETED" : "FAILED",
                  audio_analysis_retry_count: 0,
                  // Reset retry count on success
                  // CRITICAL: Extract summary fields for frontend - these are what the UI looks for
                  call_transcript: analysis.transcript || session.call_transcript || null,
                  taalk_ai_summary: analysis.summary || null,
                  ai_quick_recap: analysis.summary || null,
                  // Use summary as quick recap
                  ai_result: analysis.validation?.reason || null,
                  ai_result_passed: analysis.validation?.isValid ?? null
                };
                const { error: updateError, data: updatedRows } = await supabaseAdmin.from("verification_sessions").update(updateData).eq("id", session.id).select("id, call_analysis_complete");
                if (updateError) {
                  console.error(`  \u274C CRITICAL: Failed to save audio analysis to database for session ${session.id}:`, updateError);
                  console.error(`     This session will be re-analyzed on next run!`);
                  processedSessionIds.delete(session.id);
                  throw updateError;
                }
                if (!updatedRows || updatedRows.length === 0) {
                  console.error(`  \u274C CRITICAL: No rows updated for session ${session.id} - session may not exist`);
                  console.error(`     This session will be re-analyzed on next run!`);
                  processedSessionIds.delete(session.id);
                } else {
                  console.log(`  \u2705 Audio analyzed and MARKED COMPLETE: ${analysis.isLegitimate ? "LEGITIMATE" : "SUSPICIOUS"} (${analysis.confidence} confidence)`);
                }
                await new Promise((resolve) => setTimeout(resolve, 3e3));
              } catch (error2) {
                console.error(`  \u274C Failed to analyze audio for session ${session.id}:`, error2.message);
                const currentRetryCount = session.audio_analysis_retry_count || 0;
                const newRetryCount = currentRetryCount + 1;
                await supabaseAdmin.from("verification_sessions").update({
                  audio_analysis_retry_count: newRetryCount
                }).eq("id", session.id);
                if (newRetryCount >= 1) {
                  console.log(`  \u26A0\uFE0F  Session ${session.id} marked as failed after ${newRetryCount} retry attempt(s). Will not retry again.`);
                }
                processedSessionIds.delete(session.id);
              }
            }
            if (iterations >= MAX_ITERATIONS) {
              console.warn(`\u26A0\uFE0F  Reached maximum iterations (${MAX_ITERATIONS}) for audio analysis. Stopping to prevent infinite loop.`);
              break;
            }
          }
        } catch (error) {
          console.error("\u274C Error in audio analysis:", error);
        }
      }
      /**
       * Re-run AO precheck screenshot analysis for sessions from a given date.
       * @param sinceDate ISO date string (e.g. '2026-02-07')
       * @param options delayMs between API calls (default 3000), batchSize (default 10)
       */
      async runScreenshotAnalysisFromDate(sinceDate, options = {}) {
        if (!supabaseAdmin) {
          console.error("\u274C Supabase admin client not configured");
          return { processed: 0, failed: 0 };
        }
        const delayMs = options.delayMs ?? 3e3;
        const BATCH_SIZE = options.batchSize ?? 10;
        const since = new Date(sinceDate);
        since.setHours(0, 0, 0, 0);
        const sinceStr = since.toISOString();
        let processed = 0;
        let failed = 0;
        const MAX_ITERATIONS = 200;
        const processedSessionIds = /* @__PURE__ */ new Set();
        const pageSize = BATCH_SIZE * 3;
        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
          const offset = iter * pageSize;
          const { data: allSessions, error } = await supabaseAdmin.from("verification_sessions").select("*").gte("created_at", sinceStr).or("screenshot_url.not.is.null,screenshot_path.not.is.null").order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
          if (error || !allSessions?.length) {
            if (processed === 0 && iter === 0) console.log("\u{1F4F8} No sessions needing screenshot analysis from", sinceDate);
            break;
          }
          const sessions = allSessions.filter((session) => {
            const hasScreenshot = session.screenshot_url && session.screenshot_url !== "PENDING" && session.screenshot_url.trim() !== "" || session.screenshot_path && session.screenshot_path !== "PENDING" && session.screenshot_path.trim() !== "";
            const needsAnalysis = session.screenshot_analysis_complete === null || session.screenshot_analysis_complete === false;
            return hasScreenshot && needsAnalysis && !processedSessionIds.has(session.id);
          });
          if (sessions.length === 0) break;
          console.log(`\u{1F4F8} [from ${sinceDate}] Processing ${sessions.length} screenshot(s) (delay ${delayMs}ms)...`);
          for (const session of sessions) {
            processedSessionIds.add(session.id);
            try {
              console.log(`  Session ${session.id} - ${session.agent_email || session.company_email}`);
              const screenshotDataUrl = await this.fetchScreenshotDataUrl(session);
              if (!screenshotDataUrl) {
                await supabaseAdmin.from("verification_sessions").update({
                  screenshot_validation: { issues: ["Missing required screenshot"], isValid: false, confidence: 1 },
                  screenshot_analysis_complete: true,
                  screenshot_analysis_confidence: 0
                }).eq("id", session.id);
                processed++;
                continue;
              }
              const validation = await verificationScreenshotValidator.validateScreenshot(
                screenshotDataUrl,
                session.verification_method || "zoom"
              );
              if (!validation) throw new Error("Validation returned null");
              const { error: updateError } = await supabaseAdmin.from("verification_sessions").update({
                screenshot_validation: validation,
                screenshot_analysis_complete: true,
                screenshot_analysis_confidence: validation?.confidence ?? 0,
                screenshot_analysis_retry_count: 0,
                verification_result: validation.isValid ? "COMPLETED" : "FAILED"
              }).eq("id", session.id);
              if (updateError) throw updateError;
              processed++;
              console.log(`  \u2705 ${session.id} - ${validation.isValid ? "VALID" : "INVALID"}`);
            } catch (e) {
              failed++;
              console.error(`  \u274C ${session.id}:`, e?.message || e);
              const retryCount = (session.screenshot_analysis_retry_count ?? 0) + 1;
              await supabaseAdmin.from("verification_sessions").update({ screenshot_analysis_retry_count: retryCount }).eq("id", session.id);
            }
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
        console.log(`\u2705 AO precheck screenshot analysis from ${sinceDate} complete. Processed: ${processed}, Failed: ${failed}`);
        return { processed, failed };
      }
      /**
       * Re-run AO precheck audio analysis for sessions from a given date (e.g. after API was exceeded).
       * Uses longer delay between calls to avoid rate limits.
       * @param sinceDate ISO date string (e.g. '2026-02-07'); only sessions with created_at >= this are processed
       * @param options delayMs between API calls (default 6000), batchSize (default 5)
       */
      async runAudioAnalysisFromDate(sinceDate, options = {}) {
        if (!supabaseAdmin) {
          console.error("\u274C Supabase admin client not configured");
          return { processed: 0, failed: 0 };
        }
        const delayMs = options.delayMs ?? 6e3;
        const BATCH_SIZE = options.batchSize ?? 5;
        const since = new Date(sinceDate);
        since.setHours(0, 0, 0, 0);
        const sinceStr = since.toISOString();
        let processed = 0;
        let failed = 0;
        const MAX_ITERATIONS = 200;
        const processedSessionIds = /* @__PURE__ */ new Set();
        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
          const offset = iter * BATCH_SIZE;
          const { data: sessions, error } = await supabaseAdmin.from("verification_sessions").select("*").gte("created_at", sinceStr).or("and(recording_url.not.is.null,recording_url.neq.PENDING),and(call_transcript.not.is.null,call_transcript.neq.PENDING)").or("call_analysis_complete.is.null,call_analysis_complete.eq.false").or("audio_analysis_retry_count.is.null,audio_analysis_retry_count.lt.1").order("created_at", { ascending: false }).range(offset, offset + BATCH_SIZE - 1);
          if (error || !sessions?.length) {
            if (processed === 0 && iter === 0) console.log("\u{1F3B5} No sessions needing audio analysis from", sinceDate);
            break;
          }
          const toProcess = sessions.filter(
            (s) => !processedSessionIds.has(s.id) && (s.call_analysis_complete !== true || s.audio_analysis == null) && (s.audio_analysis_retry_count ?? 0) < 1
          );
          if (toProcess.length === 0) break;
          console.log(`\u{1F3B5} [from ${sinceDate}] Processing ${toProcess.length} session(s) (delay ${delayMs}ms between calls)...`);
          for (const session of toProcess) {
            processedSessionIds.add(session.id);
            try {
              console.log(`  Session ${session.id} - ${session.agent_email || session.company_email}`);
              let analysis;
              const hasValidTranscript = session.call_transcript?.trim() && session.call_transcript.trim() !== "[]" && session.call_transcript.trim().toUpperCase() !== "PENDING";
              const hasRecordingUrl = session.recording_url && session.recording_url !== "PENDING";
              if (hasValidTranscript && !hasRecordingUrl) {
                analysis = {
                  transcript: session.call_transcript,
                  ...await verificationAudioAnalyzer.analyzeTranscript(session.call_transcript, session.verification_method || "phone"),
                  analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
                };
                analysis.confidence = analysis.validation?.confidence ?? 0;
                analysis.isLegitimate = analysis.validation?.isValid ?? false;
              } else if (hasRecordingUrl) {
                analysis = await verificationAudioAnalyzer.analyzeAudioFromUrl(session.recording_url, session.verification_method || "phone");
              } else {
                continue;
              }
              const { error: updateError } = await supabaseAdmin.from("verification_sessions").update({
                audio_analysis: analysis,
                call_analysis_complete: true,
                verification_result: analysis.isLegitimate ? "COMPLETED" : "FAILED",
                audio_analysis_retry_count: 0,
                call_transcript: analysis.transcript || session.call_transcript || null,
                taalk_ai_summary: analysis.summary || null,
                ai_quick_recap: analysis.summary || null,
                ai_result: analysis.validation?.reason || null,
                ai_result_passed: analysis.validation?.isValid ?? null
              }).eq("id", session.id);
              if (updateError) throw updateError;
              processed++;
              console.log(`  \u2705 ${session.id} - ${analysis.isLegitimate ? "LEGITIMATE" : "SUSPICIOUS"}`);
            } catch (e) {
              failed++;
              console.error(`  \u274C ${session.id}:`, e?.message || e);
              const retryCount = (session.audio_analysis_retry_count ?? 0) + 1;
              await supabaseAdmin.from("verification_sessions").update({ audio_analysis_retry_count: retryCount }).eq("id", session.id);
            }
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
        console.log(`\u2705 AO precheck audio analysis from ${sinceDate} complete. Processed: ${processed}, Failed: ${failed}`);
        return { processed, failed };
      }
      /**
       * Get scheduler status
       */
      getStatus() {
        return { isRunning: this.isRunning };
      }
      resolveStorageReference(value) {
        if (!value) return null;
        const trimmed = value.trim();
        if (!trimmed || trimmed === "PENDING") return null;
        try {
          const url = new URL(trimmed);
          const segments = url.pathname.split("/").filter(Boolean);
          const objectIndex = segments.indexOf("object");
          if (objectIndex !== -1 && objectIndex + 1 < segments.length) {
            let idx = objectIndex + 1;
            if (["sign", "public", "render"].includes(segments[idx])) {
              idx += 1;
            }
            if (idx >= segments.length) return null;
            const bucket2 = segments[idx];
            const object2 = segments.slice(idx + 1).join("/");
            return bucket2 && object2 ? { bucket: bucket2, object: object2 } : null;
          }
        } catch {
        }
        const cleaned = trimmed.replace(/^\/+/, "");
        const parts = cleaned.split("/");
        if (parts.length < 2) return null;
        const bucket = parts.shift();
        const object = parts.join("/");
        return bucket && object ? { bucket, object } : null;
      }
      async fetchScreenshotDataUrl(session) {
        if (!supabaseAdmin) return null;
        const sources = [session.screenshot_path, session.screenshot_url];
        for (const source of sources) {
          if (!source || source === "PENDING") continue;
          let urlToFetch = source;
          const ref = this.resolveStorageReference(source);
          if (ref) {
            try {
              const { data, error } = await supabaseAdmin.storage.from(ref.bucket).createSignedUrl(ref.object, 300);
              if (!error && data?.signedUrl) {
                urlToFetch = data.signedUrl;
              } else if (!urlToFetch.startsWith("http")) {
                const baseUrl = SUPABASE_URL || process.env.SUPABASE_URL;
                if (baseUrl) {
                  urlToFetch = `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/${ref.bucket}/${ref.object}`;
                }
              }
            } catch (error) {
              console.warn(`  \u26A0\uFE0F Failed to generate signed URL for ${session.session_id}:`, error);
            }
          }
          try {
            const response = await fetch2(urlToFetch);
            if (!response.ok) {
              throw new Error(`Screenshot download failed (${response.status})`);
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            const dataUri = `data:image/png;base64,${buffer.toString("base64")}`;
            return dataUri;
          } catch (error) {
            console.warn(`  \u26A0\uFE0F Unable to download screenshot from ${urlToFetch}:`, error instanceof Error ? error.message : error);
          }
        }
        return null;
      }
    };
    verificationAnalysisScheduler = VerificationAnalysisScheduler.getInstance();
  }
});

// server/taalk-campaign-sync-scheduler.ts
var taalk_campaign_sync_scheduler_exports = {};
__export(taalk_campaign_sync_scheduler_exports, {
  taalkCampaignSyncScheduler: () => taalkCampaignSyncScheduler
});
import cron5 from "node-cron";
import fetch3 from "node-fetch";
var TAALK_API_KEY2, TaalkCampaignSyncScheduler, taalkCampaignSyncScheduler;
var init_taalk_campaign_sync_scheduler = __esm({
  "server/taalk-campaign-sync-scheduler.ts"() {
    "use strict";
    init_supabase();
    TAALK_API_KEY2 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    TaalkCampaignSyncScheduler = class _TaalkCampaignSyncScheduler {
      static instance;
      cronJob = null;
      isRunning = false;
      constructor() {
      }
      static getInstance() {
        if (!_TaalkCampaignSyncScheduler.instance) {
          _TaalkCampaignSyncScheduler.instance = new _TaalkCampaignSyncScheduler();
        }
        return _TaalkCampaignSyncScheduler.instance;
      }
      start() {
        if (this.isRunning) {
          console.log("\u{1F504} Taalk campaign sync scheduler already running");
          return;
        }
        this.cronJob = cron5.schedule("0 3 * * *", async () => {
          await this.syncCampaigns();
        }, {
          scheduled: true,
          timezone: "America/New_York"
        });
        this.isRunning = true;
        console.log("\u2705 Taalk campaign sync scheduler started - syncing daily at 3 AM ET");
        setTimeout(() => {
          this.syncCampaigns();
        }, 3e4);
      }
      stop() {
        if (this.cronJob) {
          this.cronJob.stop();
          this.cronJob = null;
        }
        this.isRunning = false;
        console.log("\u{1F6D1} Taalk campaign sync scheduler stopped");
      }
      async syncCampaigns() {
        console.log("\u{1F4E1} Syncing Taalk campaigns from API to Supabase...");
        try {
          if (!supabaseAdmin) {
            console.error("\u274C Supabase client not initialized");
            return;
          }
          let allCampaigns = [];
          let page = 1;
          let totalPages = 1;
          do {
            const response = await fetch3(`https://api.taalk.ai/api/campaign2s?db=michaelmandella&page=${page}&limit=100`, {
              headers: {
                "Authorization": `Bearer ${TAALK_API_KEY2}`,
                "Content-Type": "application/json"
              }
            });
            if (!response.ok) {
              console.error(`\u274C Taalk API error on page ${page}: ${response.status}`);
              break;
            }
            const response_data = await response.json();
            const campaigns = response_data.payload || [];
            const total = response_data.total || 0;
            allCampaigns = allCampaigns.concat(campaigns);
            const itemsPerPage = campaigns.length || 20;
            totalPages = Math.ceil(total / itemsPerPage);
            page++;
            if (page <= totalPages) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          } while (page <= totalPages && page <= 15);
          if (allCampaigns.length === 0) {
            console.log("\u26A0\uFE0F  No campaigns fetched from Taalk");
            return;
          }
          console.log(`\u2705 Fetched ${allCampaigns.length} campaigns from Taalk API`);
          let synced = 0;
          let errors = 0;
          for (const campaign of allCampaigns) {
            try {
              const campaignId = campaign._id || campaign.id;
              if (!campaignId) {
                errors++;
                continue;
              }
              const campaignData = {
                id: campaignId,
                name: campaign.name || "Unnamed Campaign",
                description: campaign.desc || null,
                status: "active",
                // Taalk doesn't have explicit status
                persona_id: campaign.persona || null,
                script_id: campaign.script || null,
                campaign_type: campaign.type === 0 ? "inbound" : campaign.type === 1 ? "outbound" : "unknown",
                total_agents: 0,
                active_agents: 0,
                total_calls: campaign.contactCount || 0,
                taalk_data: campaign,
                last_synced_at: (/* @__PURE__ */ new Date()).toISOString()
              };
              const { error } = await supabaseAdmin.from("taalk_campaigns").upsert(campaignData, {
                onConflict: "id"
              });
              if (error) {
                console.error(`\u274C Error syncing ${campaign.name}:`, error.message);
                errors++;
              } else {
                synced++;
              }
            } catch (err) {
              console.error("\u274C Error processing campaign:", err.message);
              errors++;
            }
          }
          console.log(`\u{1F4CA} Campaign sync: ${synced} synced, ${errors} errors`);
        } catch (error) {
          console.error("\u274C Campaign sync error:", error.message);
        }
      }
    };
    taalkCampaignSyncScheduler = TaalkCampaignSyncScheduler.getInstance();
  }
});

// server/inbound-calls-twilio-sync.ts
var inbound_calls_twilio_sync_exports = {};
__export(inbound_calls_twilio_sync_exports, {
  startInboundCallsTwilioSync: () => startInboundCallsTwilioSync,
  stopInboundCallsTwilioSync: () => stopInboundCallsTwilioSync
});
import twilio3 from "twilio";
function normalize10(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}
async function resolveAssociateId(agentEmail) {
  if (!supabaseAdmin || !agentEmail || !agentEmail.includes("@")) return null;
  const email = agentEmail.trim().toLowerCase();
  const { data: custCompany } = await supabaseAdmin.from("customers").select("associate_id").eq("company_email", email).maybeSingle();
  if (custCompany?.associate_id != null) return Number(custCompany.associate_id);
  const { data: custPersonal } = await supabaseAdmin.from("customers").select("associate_id").eq("personal_email", email).maybeSingle();
  if (custPersonal?.associate_id != null) return Number(custPersonal.associate_id);
  const { data: producerlist } = await supabaseAdmin.from("producerlist").select("associate_id").eq("company_email", email).maybeSingle();
  if (producerlist?.associate_id != null) return Number(producerlist.associate_id);
  const { data: profileEmail } = await supabaseAdmin.from("agent_profiles").select("agent_associate_id").eq("email", email).maybeSingle();
  if (profileEmail?.agent_associate_id != null) return Number(profileEmail.agent_associate_id);
  const { data: profileAgent } = await supabaseAdmin.from("agent_profiles").select("agent_associate_id").eq("agent_email", email).maybeSingle();
  if (profileAgent?.agent_associate_id != null) return Number(profileAgent.agent_associate_id);
  return null;
}
async function getLeadByPhone(callerPhone) {
  if (!supabaseAdmin) return null;
  const p10 = normalize10(callerPhone);
  if (p10.length < 10) return null;
  const { data } = await masterleadClient.from("masterlead").select("id, taalk_lead_id").or(`phone.eq.${p10},phone.eq.+1${p10},phone_number.eq.${p10},phone_number.eq.+1${p10}`).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return { lead_id: String(data.id), taalk_lead_id: data.taalk_lead_id ?? null };
}
async function syncInboundCallsFromTwilio() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return { count: 0, errors: 0 };
  if (!supabaseAdmin) return { count: 0, errors: 0 };
  try {
    const client = twilio3(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const after = new Date(Date.now() - WINDOW_MINUTES * 60 * 1e3);
    const startTimeAfter = after.toISOString().slice(0, 19) + "Z";
    const calls = [];
    for (const inboundNumber of INBOUND_NUMBERS) {
      let endTimeBefore = null;
      while (true) {
        const opts = {
          to: inboundNumber,
          startTimeAfter,
          limit: LIMIT_PER_BATCH
        };
        if (endTimeBefore) opts.endTimeBefore = endTimeBefore;
        const batch = await client.calls.list(opts);
        calls.push(...batch);
        if (batch.length < LIMIT_PER_BATCH) break;
        const oldest = batch[batch.length - 1];
        const oldestStart = oldest.startTime ? new Date(oldest.startTime) : null;
        if (!oldestStart) break;
        endTimeBefore = oldestStart.toISOString().slice(0, 19) + "Z";
      }
    }
    let errors = 0;
    for (const c of calls) {
      const callStatus = (c.status || "").toLowerCase() || "unknown";
      const callStartedAt = c.startTime ? new Date(c.startTime).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
      const callEndedAt = c.endTime ? new Date(c.endTime).toISOString() : null;
      const callDuration = c.duration ?? 0;
      const { data: existing } = await supabaseAdmin.from("twilio_call_logs").select("owner_email, call_source, associate_id, lead_id, taalk_lead_id").eq("twilio_call_sid", c.sid).maybeSingle();
      const isAgentAccepted = existing?.owner_email || existing?.call_source === "taskrouter_inbound" || existing?.call_source === "incomingcall_609";
      if (isAgentAccepted) {
        const updatePayload = {
          call_status: callStatus,
          call_duration: callDuration,
          call_ended_at: callEndedAt,
          call_started_at: callStartedAt
        };
        const ownerEmail = existing?.owner_email;
        const needsAssociateOrLead = ownerEmail && existing?.associate_id == null || existing?.lead_id == null;
        if (needsAssociateOrLead && ownerEmail && ownerEmail.includes("@")) {
          const [associateId, lead2] = await Promise.all([
            resolveAssociateId(ownerEmail),
            getLeadByPhone(c.from)
          ]);
          if (associateId != null) updatePayload.associate_id = associateId;
          if (lead2) {
            updatePayload.lead_id = lead2.lead_id;
            updatePayload.taalk_lead_id = lead2.taalk_lead_id;
          }
        }
        const { error: error2 } = await supabaseAdmin.from("twilio_call_logs").update(updatePayload).eq("twilio_call_sid", c.sid);
        if (error2) errors++;
        continue;
      }
      const lead = await getLeadByPhone(c.from);
      const row = {
        twilio_call_sid: c.sid,
        from_number: c.from || null,
        to_number: c.to || null,
        call_direction: "inbound",
        call_status: callStatus,
        call_duration: callDuration,
        call_started_at: callStartedAt,
        call_ended_at: callEndedAt,
        call_source: "twilio_api_sync",
        ...lead ? { lead_id: lead.lead_id, taalk_lead_id: lead.taalk_lead_id } : {}
      };
      const { error } = await supabaseAdmin.from("twilio_call_logs").upsert(row, { onConflict: "twilio_call_sid" });
      if (error) errors++;
      if (callStatus === "completed" && !existing?.owner_email) {
        try {
          const childCalls = await client.calls.list({ parentCallSid: c.sid, limit: 5 });
          const agentLeg = childCalls.find((leg) => {
            const to = String(leg.to || "").trim();
            const from = String(leg.from || "").trim();
            return to.toLowerCase().startsWith("client:") || from.toLowerCase().startsWith("client:");
          });
          if (agentLeg) {
            const raw = String(agentLeg.to || agentLeg.from || "").trim();
            const identity = raw.toLowerCase().startsWith("client:") ? raw.slice(7).trim() : raw;
            if (identity && identity.includes("@")) {
              const [associateId, lead2] = await Promise.all([
                resolveAssociateId(identity),
                getLeadByPhone(c.from)
              ]);
              const updatePayload = {
                owner_email: identity,
                ...agentLeg.duration != null ? { call_duration: parseInt(String(agentLeg.duration), 10) || callDuration } : {},
                ...associateId != null ? { associate_id: associateId } : {},
                ...lead2 ? { lead_id: lead2.lead_id, taalk_lead_id: lead2.taalk_lead_id } : {}
              };
              const { error: upErr } = await supabaseAdmin.from("twilio_call_logs").update(updatePayload).eq("twilio_call_sid", c.sid);
              if (!upErr) {
                if (errors === 0 && calls.length <= 20) console.log(`inbound-calls-twilio-sync: tied ${c.sid} \u2192 ${identity}${associateId != null ? ` associate_id=${associateId}` : ""}${lead2 ? ` lead_id=${lead2.lead_id}` : ""}`);
              } else errors++;
            }
          }
        } catch (_) {
        }
      }
    }
    if (calls.length > 0) {
      console.log(`inbound-calls-twilio-sync: synced ${calls.length} inbound calls to twilio_call_logs (${errors} errors)`);
    }
    await enrichUnenrichedInboundCalls().catch((e) => console.warn("inbound-calls-twilio-sync: taalk enrichment error", e?.message));
    await killZombieInboundCalls().catch((e) => console.warn("zombie-call-killer error:", e?.message));
    await unstickWrapWorkers().catch((e) => console.warn("unstick-wrap error:", e?.message));
    await fixStaleQueuedRows().catch((e) => console.warn("fix-stale-queued error:", e?.message));
    return { count: calls.length, errors };
  } catch (e) {
    console.warn("inbound-calls-twilio-sync error:", e?.message);
    return { count: 0, errors: 1 };
  }
}
async function unstickWrapWorkers() {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const wsBase = `https://taskrouter.twilio.com/v1/Workspaces/WS6a978202496f59f6cd478c1310f5c2eb`;
  let unstuck = 0;
  for (const actSid of [WRAP_ACTIVITY_SID, BUSY_ACTIVITY_SID]) {
    const maxMs = actSid === WRAP_ACTIVITY_SID ? WRAP_MAX_MS : BUSY_MAX_MS;
    const label = actSid === WRAP_ACTIVITY_SID ? "Wrap" : "BusyOnCall";
    try {
      const resp = await fetch(`${wsBase}/Workers?ActivitySid=${actSid}&PageSize=50`, {
        headers: { "Authorization": `Basic ${auth}` },
        signal: AbortSignal.timeout(1e4)
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const w of data.workers || []) {
        const statusChanged = w.date_status_changed ? new Date(w.date_status_changed).getTime() : 0;
        if (statusChanged && Date.now() - statusChanged > maxMs) {
          const upResp = await fetch(`${wsBase}/Workers/${w.sid}`, {
            method: "POST",
            headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: `ActivitySid=${AVAILABLE_INBOUND_SID}`,
            signal: AbortSignal.timeout(1e4)
          });
          if (upResp.ok) {
            console.log(`unstick-workers: \u2705 ${w.friendly_name} (${label} ${Math.round((Date.now() - statusChanged) / 6e4)}min) \u2192 AvailableInbound`);
            unstuck++;
          }
        }
      }
    } catch (_) {
    }
  }
  if (unstuck > 0) console.log(`unstick-workers: freed ${unstuck} workers`);
}
async function fixStaleQueuedRows() {
  if (!supabaseAdmin) return;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const since = new Date(Date.now() - 30 * 60 * 1e3).toISOString();
  const { data: rows } = await supabaseAdmin.from("twilio_call_logs").select("twilio_call_sid").eq("call_status", "queued").eq("call_direction", "inbound").gte("call_started_at", since).limit(50);
  if (!rows?.length) return;
  let fixed = 0;
  for (const r of rows) {
    try {
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${r.twilio_call_sid}.json`, {
        headers: { "Authorization": `Basic ${auth}` },
        signal: AbortSignal.timeout(5e3)
      });
      if (!resp.ok) continue;
      const call = await resp.json();
      if (call.status && call.status !== "queued") {
        await supabaseAdmin.from("twilio_call_logs").update({
          call_status: call.status,
          call_duration: call.duration != null ? parseInt(String(call.duration)) : 0,
          ...call.end_time ? { call_ended_at: new Date(call.end_time).toISOString() } : {},
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("twilio_call_sid", r.twilio_call_sid);
        fixed++;
      }
    } catch (_) {
    }
  }
  if (fixed > 0) console.log(`fix-stale-queued: updated ${fixed} rows from queued \u2192 real status`);
}
async function killZombieInboundCalls() {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  let killed = 0;
  for (const inboundNumber of INBOUND_NUMBERS) {
    try {
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?Status=in-progress&To=${encodeURIComponent(inboundNumber)}&PageSize=20`,
        { headers: { "Authorization": `Basic ${auth}` }, signal: AbortSignal.timeout(1e4) }
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const call of data.calls || []) {
        const startTime = new Date(call.start_time).getTime();
        const age = Date.now() - startTime;
        if (age > MAX_CALL_DURATION_MS) {
          const killResp = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call.sid}.json`,
            {
              method: "POST",
              headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
              body: "Status=completed",
              signal: AbortSignal.timeout(1e4)
            }
          );
          if (killResp.ok) {
            console.log(`zombie-call-killer: \u2705 killed ${call.sid} (${Math.round(age / 6e4)}min old, from ${call.from})`);
            killed++;
          }
        }
      }
    } catch (_) {
    }
  }
  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?Status=in-progress&PageSize=50`,
      { headers: { "Authorization": `Basic ${auth}` }, signal: AbortSignal.timeout(1e4) }
    );
    if (resp.ok) {
      const data = await resp.json();
      for (const call of data.calls || []) {
        const to = String(call.to || "").toLowerCase();
        const from = String(call.from || "").toLowerCase();
        const isClientCall = to.startsWith("client:") || from.startsWith("client:");
        if (!isClientCall) continue;
        const startTime = new Date(call.start_time).getTime();
        const age = Date.now() - startTime;
        if (age > MAX_CALL_DURATION_MS) {
          const killResp = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call.sid}.json`,
            {
              method: "POST",
              headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
              body: "Status=completed",
              signal: AbortSignal.timeout(1e4)
            }
          );
          if (killResp.ok) {
            console.log(`zombie-call-killer: \u2705 killed client leg ${call.sid} (${Math.round(age / 6e4)}min old, ${to || from})`);
            killed++;
          }
        }
      }
    }
  } catch (_) {
  }
  if (killed > 0) console.log(`zombie-call-killer: killed ${killed} zombie calls`);
}
async function enrichUnenrichedInboundCalls() {
  if (!supabaseAdmin) return;
  const TAALK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
  const TAALK_HEADERS = {
    "Authorization": `Bearer ${TAALK_KEY}`,
    "Origin": "https://lets.taalk.ai",
    "Referer": "https://lets.taalk.ai/",
    "Accept": "application/json"
  };
  const since = new Date(Date.now() - 30 * 60 * 1e3).toISOString();
  const { data: rows } = await supabaseAdmin.from("twilio_call_logs").select("twilio_call_sid, from_number, metadata").in("call_source", ["incomingcall_609", "taskrouter_inbound"]).gte("call_started_at", since).limit(50);
  if (!rows || rows.length === 0) return;
  let enriched = 0;
  for (const row of rows) {
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    if (meta.taalk_call_id) continue;
    const phone10 = normalize10(row.from_number);
    if (phone10.length < 10) continue;
    try {
      const contactResp = await fetch(`https://api.taalk.ai/api/contacts?db=michaelmandella&phone=${phone10}`, {
        headers: TAALK_HEADERS,
        signal: AbortSignal.timeout(1e4)
      });
      if (!contactResp.ok) continue;
      const contactData = await contactResp.json();
      const contact = contactData.payload?.[0] || (Array.isArray(contactData) ? contactData[0] : null);
      if (!contact) continue;
      const taalkCallId = contact.session || contact.sessionId || contact.Taalk_SessionId || contact._id;
      if (!taalkCallId) continue;
      let callDetails = null;
      try {
        const callResp = await fetch(`https://api.taalk.ai/api/calls/${taalkCallId}?db=michaelmandella`, {
          headers: TAALK_HEADERS,
          signal: AbortSignal.timeout(1e4)
        });
        if (callResp.ok) callDetails = await callResp.json();
      } catch (_) {
      }
      const callPayload = callDetails?.payload || callDetails;
      const taalkAgentId = callPayload?.agent || null;
      const taalkCampaignId = callPayload?.campaign || null;
      let personaName = null;
      let campaignName = null;
      if (taalkAgentId) {
        try {
          const agentResp = await fetch(`https://api.taalk.ai/api/agents/${taalkAgentId}?db=michaelmandella`, {
            headers: TAALK_HEADERS,
            signal: AbortSignal.timeout(5e3)
          });
          if (agentResp.ok) {
            const agentData = (await agentResp.json())?.payload || await agentResp.json();
            personaName = agentData?.name || null;
          }
        } catch (_) {
        }
      }
      if (taalkCampaignId) {
        try {
          const campResp = await fetch(`https://api.taalk.ai/api/campaign2s/${taalkCampaignId}?db=michaelmandella`, {
            headers: TAALK_HEADERS,
            signal: AbortSignal.timeout(5e3)
          });
          if (campResp.ok) {
            const campData = (await campResp.json())?.payload || await campResp.json();
            campaignName = campData?.name || null;
          }
        } catch (_) {
        }
      }
      const source = callPayload?.params?.Taalk_Lead_Source || null;
      const groupCode = callPayload?.params?.Taalk_GroupCode || null;
      const taalkRecUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;
      const { error: upErr } = await supabaseAdmin.from("twilio_call_logs").update({
        metadata: {
          ...meta,
          taalk_call_id: taalkCallId,
          taalk_contact_id: contact._id,
          taalk_agent_id: taalkAgentId,
          taalk_persona_name: personaName,
          taalk_campaign_id: taalkCampaignId,
          taalk_campaign_name: campaignName,
          taalk_source: source,
          taalk_group_code: groupCode,
          taalk_recording_url: taalkRecUrl,
          taalk_enriched_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      }).eq("twilio_call_sid", row.twilio_call_sid);
      if (!upErr) {
        enriched++;
        console.log(`inbound-taalk-enrich: \u2705 ${row.twilio_call_sid} \u2192 taalk_call_id=${taalkCallId} persona=${personaName} campaign=${campaignName} recording=${supabaseRecordingUrl ? "uploaded" : "skipped"}`);
      }
    } catch (_) {
    }
  }
  if (enriched > 0) console.log(`inbound-taalk-enrich: enriched ${enriched} rows`);
}
async function downloadCompletedCallRecordings() {
  if (!supabaseAdmin) return;
  const TAALK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
  const TAALK_HEADERS = {
    "Authorization": `Bearer ${TAALK_KEY}`,
    "Origin": "https://lets.taalk.ai",
    "Referer": "https://lets.taalk.ai/",
    "Accept": "application/json"
  };
  const since = new Date(Date.now() - 2 * 60 * 60 * 1e3).toISOString();
  const { data: rows } = await supabaseAdmin.from("twilio_call_logs").select("twilio_call_sid, metadata, recording_url, call_status").eq("call_direction", "inbound").gte("call_started_at", since).limit(50);
  if (!rows || rows.length === 0) return;
  const needsDownload = rows.filter((row) => {
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    if (!meta.taalk_call_id) return false;
    if (meta.taalk_supabase_recording_url) return false;
    if (!row.recording_url) return true;
    if (String(row.recording_url).includes("api.twilio.com")) return true;
    return false;
  });
  if (!rows || rows.length === 0) return;
  if (needsDownload.length === 0) return;
  let downloaded = 0;
  for (const row of needsDownload) {
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const taalkCallId = meta.taalk_call_id;
    const status = (row.call_status || "").toLowerCase();
    if (status === "in-progress" || status === "ringing" || status === "queued") continue;
    const taalkRecUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;
    try {
      const recResp = await fetch(taalkRecUrl, {
        headers: TAALK_HEADERS,
        signal: AbortSignal.timeout(3e4)
      });
      if (!recResp.ok) continue;
      const recBuffer = Buffer.from(await recResp.arrayBuffer());
      if (recBuffer.length < 5e4) {
        console.log(`recording-download: ${row.twilio_call_sid} taalk recording too small (${recBuffer.length} bytes) \u2014 call may not have bridged, skipping`);
        continue;
      }
      const { SUPABASE_URL: SUPABASE_URL2, SUPABASE_SERVICE_KEY: SUPABASE_SERVICE_KEY2, SUPABASE_ANON_KEY: SUPABASE_ANON_KEY2 } = await Promise.resolve().then(() => (init_hardcoded_config(), hardcoded_config_exports));
      const storagePath = `recordings/taalk-${taalkCallId}-${Date.now()}.mp3`;
      const uploadResp = await fetch(`${SUPABASE_URL2}/storage/v1/object/csv-reports/${storagePath}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY2}`,
          "apikey": SUPABASE_ANON_KEY2,
          "Content-Type": "audio/mpeg",
          "x-upsert": "true"
        },
        body: recBuffer
      });
      if (uploadResp.ok) {
        const supabaseRecordingUrl2 = `${SUPABASE_URL2}/storage/v1/object/public/csv-reports/${storagePath}`;
        await supabaseAdmin.from("twilio_call_logs").update({
          recording_url: supabaseRecordingUrl2,
          metadata: { ...meta, taalk_supabase_recording_url: supabaseRecordingUrl2 }
        }).eq("twilio_call_sid", row.twilio_call_sid);
        downloaded++;
        console.log(`recording-download: \u2705 ${row.twilio_call_sid} \u2192 ${(recBuffer.length / 1024).toFixed(0)}KB \u2192 ${supabaseRecordingUrl2}`);
      }
    } catch (err) {
      console.warn(`recording-download: failed for ${row.twilio_call_sid}:`, err?.message);
    }
  }
  if (downloaded > 0) console.log(`recording-download: downloaded ${downloaded} completed call recordings`);
}
function startInboundCallsTwilioSync() {
  if (intervalId) return;
  syncInboundCallsFromTwilio().then(() => {
    intervalId = setInterval(syncInboundCallsFromTwilio, INTERVAL_MS2);
  });
  downloadCompletedCallRecordings().then(() => {
    setInterval(downloadCompletedCallRecordings, INTERVAL_MS2);
  });
  console.log(`\u2705 Inbound calls Twilio sync started \u2014 fetching calls to ${INBOUND_NUMBERS.join(", ")} every 5 minutes (with Taalk enrichment + delayed recording download)`);
}
function stopInboundCallsTwilioSync() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
var INBOUND_NUMBERS, INTERVAL_MS2, WINDOW_MINUTES, LIMIT_PER_BATCH, intervalId, MAX_CALL_DURATION_MS, WRAP_MAX_MS, BUSY_MAX_MS, AVAILABLE_INBOUND_SID, WRAP_ACTIVITY_SID, BUSY_ACTIVITY_SID;
var init_inbound_calls_twilio_sync = __esm({
  "server/inbound-calls-twilio-sync.ts"() {
    "use strict";
    init_hardcoded_config();
    init_supabase();
    INBOUND_NUMBERS = ["+16096048379", "+16095473687"];
    INTERVAL_MS2 = 5 * 60 * 1e3;
    WINDOW_MINUTES = 10;
    LIMIT_PER_BATCH = 500;
    intervalId = null;
    MAX_CALL_DURATION_MS = 30 * 60 * 1e3;
    WRAP_MAX_MS = 2 * 60 * 1e3;
    BUSY_MAX_MS = 30 * 60 * 1e3;
    AVAILABLE_INBOUND_SID = "WAc2513cd4c7ec03511690c328ff2a49cd";
    WRAP_ACTIVITY_SID = "WA7cbb8457461d3e22fd83473d7186a3d5";
    BUSY_ACTIVITY_SID = "WA5306bcbb57fd389e964b4190ceaf71cc";
  }
});

// server/twilio-call-zapier-scheduler.ts
var twilio_call_zapier_scheduler_exports = {};
__export(twilio_call_zapier_scheduler_exports, {
  twilioCallZapierScheduler: () => twilioCallZapierScheduler
});
import * as cron6 from "node-cron";
import twilio4 from "twilio";
function normalizePhone3(p) {
  const d = String(p || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}
function agentEmailFromClient(from) {
  const m = String(from || "").match(/^client:(.+@aoglobelife\.com)$/i);
  return m ? m[1].toLowerCase() : null;
}
function isBadEmail(e) {
  return BAD_EMAILS.includes(e.toLowerCase());
}
async function runSync() {
  if (!JOB_WEBHOOKS_ENABLED2) {
    console.log("[ZapierSync] Job webhook sender disabled (ENABLE_ZAPIER_JOB_WEBHOOKS!=true)");
    return;
  }
  const sinceDate = lastRunAt;
  const nowDate = /* @__PURE__ */ new Date();
  lastRunAt = nowDate;
  const startTimeAfter = sinceDate.toISOString().slice(0, 19);
  console.log(`[ZapierSync] Checking Twilio calls since ${startTimeAfter}...`);
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("[ZapierSync] Missing Twilio credentials");
    return;
  }
  const client = twilio4(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  let allCalls = [];
  try {
    const page = await client.calls.list({ limit: 1e3, startTimeAfter });
    allCalls = page;
  } catch (err) {
    console.error("[ZapierSync] Twilio fetch error:", err.message);
    return;
  }
  const newCalls = allCalls.filter((c) => {
    const dur = parseInt(String(c.duration ?? "0"), 10);
    return c.direction === "outbound-dial" && dur > MIN_DURATION_SEC && !sentSids.has(c.sid);
  });
  if (newCalls.length === 0) {
    console.log("[ZapierSync] No new qualifying calls.");
    return;
  }
  console.log(`[ZapierSync] ${newCalls.length} new calls to process.`);
  if (!supabaseAdmin) {
    console.error("[ZapierSync] Supabase not initialized");
    return;
  }
  const toNumbers = [...new Set(newCalls.map((c) => normalizePhone3(String(c.to ?? ""))))].filter(
    (p) => p.length >= 10
  );
  const taalkLeadByPhone = /* @__PURE__ */ new Map();
  const cnEmailByPhone = /* @__PURE__ */ new Map();
  try {
    const { data } = await supabaseAdmin.rpc("get_masterlead_cn_email_by_phones", {
      phone_arr: toNumbers.slice(0, 500)
    });
    for (const row of data || []) {
      const norm = String(row?.norm_phone || "").replace(/\D/g, "").slice(-10);
      if (norm.length >= 10 && row.cn_email && !isBadEmail(row.cn_email))
        cnEmailByPhone.set(norm, row.cn_email.toLowerCase());
    }
  } catch {
  }
  const CHUNK = 30;
  for (let i = 0; i < toNumbers.length; i += CHUNK) {
    const chunk = toNumbers.slice(i, i + CHUNK);
    const variants = chunk.flatMap((p) => [p, "+1" + p, "1" + p]);
    const { data } = await supabaseAdmin.from("masterlead").select("phone, taalk_lead_id, cn_email").in("phone", variants).not("taalk_lead_id", "is", null).limit(300);
    for (const row of data || []) {
      const norm = normalizePhone3(row.phone);
      if (norm.length >= 10 && row.taalk_lead_id && !taalkLeadByPhone.has(norm)) {
        taalkLeadByPhone.set(norm, String(row.taalk_lead_id));
        if (row.cn_email && !cnEmailByPhone.has(norm) && !isBadEmail(row.cn_email))
          cnEmailByPhone.set(norm, row.cn_email.toLowerCase());
      }
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  const inboundByTime = /* @__PURE__ */ new Map();
  for (const c of allCalls) {
    if (c.direction !== "inbound") continue;
    const agentEmail = agentEmailFromClient(String(c.from ?? ""));
    const st = new Date(String(c.startTime ?? "")).getTime();
    if (isNaN(st)) continue;
    const key = Math.floor(st / 6e4).toString();
    if (!inboundByTime.has(key)) inboundByTime.set(key, []);
    inboundByTime.get(key).push({
      startMs: st,
      dur: parseInt(String(c.duration ?? "0"), 10),
      agentEmail
    });
  }
  const agentEmailBySid = /* @__PURE__ */ new Map();
  for (const c of newCalls) {
    const st = new Date(String(c.startTime ?? "")).getTime();
    if (isNaN(st)) continue;
    const dur = parseInt(String(c.duration ?? "0"), 10);
    const key = Math.floor(st / 6e4).toString();
    const candidates = [
      ...inboundByTime.get(key) ?? [],
      ...inboundByTime.get(String(parseInt(key) - 1)) ?? [],
      ...inboundByTime.get(String(parseInt(key) + 1)) ?? []
    ];
    const match = candidates.find(
      (ib) => Math.abs(ib.startMs - st) <= 5e3 && Math.abs(ib.dur - dur) <= 30 && ib.agentEmail
    );
    if (match?.agentEmail) agentEmailBySid.set(c.sid, match.agentEmail);
  }
  const admPhonesNeeded = toNumbers.filter(
    (p) => taalkLeadByPhone.has(p) && !cnEmailByPhone.has(p) && ![...agentEmailBySid.values()].length
  );
  const admAgentByPhone = /* @__PURE__ */ new Map();
  if (admPhonesNeeded.length > 0) {
    try {
      const { data: admRows } = await supabaseAdmin.rpc("get_agent_dial_metrics_by_phones", {
        phone_arr: admPhonesNeeded.slice(0, 500)
      });
      for (const row of admRows || []) {
        const norm = String(row?.norm_phone || "").replace(/\D/g, "").slice(-10);
        const email = String(row?.agent_email || "").toLowerCase();
        if (norm.length >= 10 && email.includes("@") && !isBadEmail(email) && !admAgentByPhone.has(norm))
          admAgentByPhone.set(norm, email);
      }
    } catch {
      const orClause = admPhonesNeeded.map((p) => `lead_phone.ilike.%${p}`).join(",");
      const { data } = await supabaseAdmin.from("agent_dial_metrics").select("lead_phone, agent_email, event_timestamp").or(orClause).order("event_timestamp", { ascending: false }).limit(admPhonesNeeded.length * 3);
      for (const row of data || []) {
        const norm = normalizePhone3(row.lead_phone);
        const email = String(row.agent_email || "").toLowerCase();
        if (norm.length >= 10 && email.includes("@") && !isBadEmail(email) && !admAgentByPhone.has(norm))
          admAgentByPhone.set(norm, email);
      }
    }
  }
  const allEmails = [
    .../* @__PURE__ */ new Set([
      ...cnEmailByPhone.values(),
      ...agentEmailBySid.values(),
      ...admAgentByPhone.values()
    ])
  ];
  const associateIdByEmail = /* @__PURE__ */ new Map();
  if (allEmails.length > 0) {
    const { data: custRows } = await supabaseAdmin.from("customers").select("company_email, associate_id").in("company_email", allEmails.slice(0, 300));
    for (const c of custRows || []) {
      if (c.company_email && c.associate_id != null)
        associateIdByEmail.set(c.company_email.toLowerCase(), c.associate_id);
    }
    const missing = allEmails.filter((e) => !associateIdByEmail.has(e));
    if (missing.length > 0) {
      const { data: plRows } = await supabaseAdmin.from("producerlist").select("company_email, associate_id").in("company_email", missing.slice(0, 300));
      for (const p of plRows || []) {
        if (p.company_email && p.associate_id != null && !associateIdByEmail.has(p.company_email.toLowerCase()))
          associateIdByEmail.set(p.company_email.toLowerCase(), p.associate_id);
      }
    }
  }
  let sent = 0;
  let skipped = 0;
  for (const c of newCalls) {
    const leadPhone = normalizePhone3(String(c.to ?? ""));
    const taalkLeadId = taalkLeadByPhone.get(leadPhone) ?? null;
    if (!taalkLeadId) {
      skipped++;
      sentSids.add(c.sid);
      continue;
    }
    const cnEmail = cnEmailByPhone.get(leadPhone) ?? agentEmailBySid.get(c.sid) ?? admAgentByPhone.get(leadPhone) ?? null;
    const associateId = cnEmail ? associateIdByEmail.get(cnEmail) ?? null : null;
    if (!associateId) {
      skipped++;
      sentSids.add(c.sid);
      continue;
    }
    try {
      const res = await fetch(ZAPIER_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: taalkLeadId, associate_id: associateId })
      });
      if (res.ok) {
        sent++;
        sentSids.add(c.sid);
        console.log(`[ZapierSync] \u2705 Sent lead_id=${taalkLeadId} associate_id=${associateId}`);
      } else {
        console.warn(`[ZapierSync] \u26A0\uFE0F Zapier ${res.status} for lead_id=${taalkLeadId}`);
      }
    } catch (err) {
      console.error(`[ZapierSync] \u274C Fetch error for lead_id=${taalkLeadId}:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (sentSids.size > 1e4) {
    const arr = [...sentSids];
    arr.slice(0, arr.length - 5e3).forEach((s) => sentSids.delete(s));
  }
  console.log(`[ZapierSync] Done. Sent: ${sent} | Skipped (no match): ${skipped}`);
}
var ZAPIER_WEBHOOK_URL, MIN_DURATION_SEC, LOOKBACK_MS, BAD_EMAILS, JOB_WEBHOOKS_ENABLED2, sentSids, lastRunAt, TwilioCallZapierScheduler, twilioCallZapierScheduler;
var init_twilio_call_zapier_scheduler = __esm({
  "server/twilio-call-zapier-scheduler.ts"() {
    "use strict";
    init_hardcoded_config();
    init_supabase();
    ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/2467580/urpd14m/";
    MIN_DURATION_SEC = 45;
    LOOKBACK_MS = 12 * 60 * 1e3;
    BAD_EMAILS = ["unknown@aoglobelife.com", "system@aoglobelife.com", "cnsysop@aoglobelife.com"];
    JOB_WEBHOOKS_ENABLED2 = String(process.env.ENABLE_ZAPIER_JOB_WEBHOOKS || "").toLowerCase() === "true";
    sentSids = /* @__PURE__ */ new Set();
    lastRunAt = new Date(Date.now() - LOOKBACK_MS);
    TwilioCallZapierScheduler = class {
      task = null;
      start() {
        if (this.task) return;
        if (!JOB_WEBHOOKS_ENABLED2) {
          console.log("[ZapierSync] Disabled: scheduled associate_id/taalk_lead_id webhooks are off");
          return;
        }
        console.log("[ZapierSync] Starting \u2014 runs every 5 minutes");
        runSync().catch((err) => console.error("[ZapierSync] Initial run error:", err));
        this.task = cron6.schedule("*/5 * * * *", () => {
          runSync().catch((err) => console.error("[ZapierSync] Scheduled run error:", err));
        });
      }
      stop() {
        this.task?.stop();
        this.task = null;
      }
    };
    twilioCallZapierScheduler = new TwilioCallZapierScheduler();
  }
});

// server/booked-leads-webhook-sender.ts
var booked_leads_webhook_sender_exports = {};
__export(booked_leads_webhook_sender_exports, {
  BookedLeadsWebhookSender: () => BookedLeadsWebhookSender,
  bookedLeadsWebhookSender: () => bookedLeadsWebhookSender
});
import fetch4 from "node-fetch";
var JOB_WEBHOOKS_ENABLED3, BookedLeadsWebhookSender, bookedLeadsWebhookSender;
var init_booked_leads_webhook_sender = __esm({
  "server/booked-leads-webhook-sender.ts"() {
    "use strict";
    init_supabase();
    init_local_masterlead_client();
    JOB_WEBHOOKS_ENABLED3 = String(process.env.ENABLE_ZAPIER_JOB_WEBHOOKS || "").toLowerCase() === "true";
    BookedLeadsWebhookSender = class _BookedLeadsWebhookSender {
      static instance;
      cronJob = null;
      isRunning = false;
      warnedAgents = /* @__PURE__ */ new Map();
      // Track when we last warned about an agent
      constructor() {
      }
      static getInstance() {
        if (!_BookedLeadsWebhookSender.instance) {
          _BookedLeadsWebhookSender.instance = new _BookedLeadsWebhookSender();
        }
        return _BookedLeadsWebhookSender.instance;
      }
      start() {
        if (!JOB_WEBHOOKS_ENABLED3) {
          console.log("\u23ED\uFE0F Booked/long-call job webhook sender disabled (ENABLE_ZAPIER_JOB_WEBHOOKS!=true)");
          return;
        }
        if (this.isRunning) {
          console.log("\u{1F504} Booked leads & call tracker webhook sender already running");
          return;
        }
        setInterval(async () => {
          await this.sendBookedLeads();
          await this.sendLongCalls();
        }, 6e4);
        this.isRunning = true;
        console.log("\u2705 Call Connector Pro webhook sender started - checking every 60 seconds");
        setTimeout(() => {
          this.sendBookedLeads();
          this.sendLongCalls();
        }, 1e4);
      }
      stop() {
        if (this.cronJob) {
          this.cronJob.stop();
          this.cronJob = null;
          this.isRunning = false;
          console.log("\u{1F6D1} Booked leads webhook sender stopped");
        }
      }
      // Public method to manually trigger webhook sending (all agents or one agent)
      async triggerSend() {
        console.log("\u{1F680} MANUAL TRIGGER: Sending booked leads and long calls...");
        await this.sendBookedLeads();
        await this.sendLongCalls();
      }
      /** Trigger send only for one agent's unsent booked leads (e.g. from UI). */
      async triggerSendForAgent(agentEmail) {
        const normalized = String(agentEmail || "").toLowerCase().trim();
        if (!normalized) return { sent: 0, failed: 0 };
        console.log(`\u{1F680} MANUAL TRIGGER (agent): Sending booked leads for ${normalized}`);
        return this.sendBookedLeads(normalized);
      }
      async sendBookedLeads(agentEmail) {
        let sent = 0;
        let failed = 0;
        try {
          if (!supabaseAdmin) {
            console.error("\u274C Supabase admin client not initialized");
            return { sent, failed };
          }
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString();
          let query = masterleadClient2.from("masterlead").select("id, taalk_lead_id, cn_email, previous_cn_email, first_name, last_name, phone, state, created_at, resolved_at").eq("cnresolution", "booked").is("webhook_sent_at", null).or(`resolved_at.gte.${thirtyDaysAgo},resolved_at.is.null`).limit(100);
          if (agentEmail) {
            query = query.eq("cn_email", agentEmail);
          }
          const { data: bookedLeads, error } = await query;
          if (error) {
            console.error("\u274C Error fetching booked leads:", error);
            return { sent, failed };
          }
          if (!bookedLeads || bookedLeads.length === 0) {
            return { sent, failed };
          }
          if (bookedLeads.length > 0 && process.env.NODE_ENV !== "production") {
            console.log(`\u{1F525} Found ${bookedLeads.length} booked leads to send to webhook`);
          }
          for (const lead of bookedLeads) {
            try {
              if (!lead.cn_email) {
                console.warn(`\u26A0\uFE0F Skipping lead ${lead.id} - no agent email (cn_email is null)`);
                failed++;
                continue;
              }
              const { data: agent } = await supabaseAdmin.from("customers").select("associate_id").eq("company_email", lead.cn_email.toLowerCase().trim()).limit(1).maybeSingle();
              if (!agent?.associate_id) {
                const lastWarned = this.warnedAgents.get(lead.cn_email) || 0;
                const oneHourAgo = Date.now() - 60 * 60 * 1e3;
                if (lastWarned < oneHourAgo) {
                  console.warn(`\u26A0\uFE0F No associate_id for ${lead.cn_email} - skipping lead ${lead.taalk_lead_id || lead.id}`);
                  this.warnedAgents.set(lead.cn_email, Date.now());
                }
                failed++;
                continue;
              }
              if (!lead.taalk_lead_id) {
                console.warn(`\u26A0\uFE0F No taalk_lead_id for lead ${lead.id} - skipping`);
                failed++;
                continue;
              }
              const normalizedPhone = String(lead.phone || "").replace(/\D/g, "").slice(-10);
              let callDuration = 0;
              const emailsToTry = [lead.cn_email, lead.previous_cn_email].map((e) => e?.toLowerCase?.()?.trim()).filter(Boolean);
              const uniqueEmails = [...new Set(emailsToTry)];
              if (normalizedPhone.length === 10) {
                for (const ownerEmail of uniqueEmails) {
                  const { data: recentCall } = await supabaseAdmin.from("twilio_call_logs").select("call_duration").eq("owner_email", ownerEmail).eq("call_direction", "outbound").or(`to_number.eq.${normalizedPhone},to_number.eq.+1${normalizedPhone}`).order("call_started_at", { ascending: false }).limit(1).maybeSingle();
                  const d = Number(recentCall?.call_duration || 0);
                  if (d > callDuration) callDuration = d;
                }
                for (const agentEm of uniqueEmails) {
                  if (callDuration >= 45) break;
                  const { data: metricsCall } = await supabaseAdmin.from("agent_dial_metrics").select("call_duration").eq("agent_email", agentEm).eq("event_type", "booked").eq("lead_phone", normalizedPhone).order("event_timestamp", { ascending: false }).limit(1).maybeSingle();
                  const d = Number(metricsCall?.call_duration || 0);
                  if (d > callDuration) callDuration = d;
                }
              }
              if (callDuration < 45) {
                console.warn(`\u26A0\uFE0F Sending booked lead ${lead.taalk_lead_id} with duration ${callDuration}s (below 45s threshold)`);
              }
              const payload = {
                lead_id: lead.taalk_lead_id.toString(),
                associate_id: agent.associate_id
              };
              if (process.env.NODE_ENV !== "production") {
                console.log(`\u{1F4E4} Sending booked lead: ${lead.first_name} ${lead.last_name} | lead_id=${lead.taalk_lead_id} | duration=${callDuration}s`);
              }
              const { data: claimedRows, error: claimError } = await masterleadClient2.from("masterlead").update({ webhook_sent_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", lead.id).is("webhook_sent_at", null).select("id");
              if (claimError) {
                console.error(`\u274C Failed to claim webhook send for lead ${lead.taalk_lead_id}: ${claimError.message}`);
                failed++;
                continue;
              }
              if (!claimedRows || claimedRows.length === 0) {
                continue;
              }
              const response = await fetch4("https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });
              if (response.ok) {
                sent++;
              } else {
                await masterleadClient2.from("masterlead").update({ webhook_sent_at: null }).eq("id", lead.id);
                console.error(`\u274C Webhook failed for lead ${lead.taalk_lead_id}: ${response.status}`);
                failed++;
              }
            } catch (err) {
              console.error(`\u274C Error sending webhook for lead ${lead.id}:`, err.message);
              failed++;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          if (sent > 0 || failed > 0) {
            if ((sent > 0 || failed > 0) && process.env.NODE_ENV !== "production") {
              console.log(`\u{1F4CA} Booked leads webhook: ${sent} sent, ${failed} failed`);
            }
          }
        } catch (error) {
          console.error("\u274C Booked leads webhook sender error:", error.message);
        }
      }
      async sendLongCalls() {
        try {
          if (!supabaseAdmin) return;
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
          const { data: longCalls, error } = await supabaseAdmin.from("call_connector_tracker").select("id, lead_id, agent_email, duration, created_at").gte("created_at", sevenDaysAgo).gte("duration", 60).is("webhook_sent_at", null).limit(50);
          if (error || !longCalls || longCalls.length === 0) {
            return;
          }
          console.log(`\u{1F4DE} Found ${longCalls.length} calls over 60 seconds to send to webhook`);
          let sent = 0;
          for (const call of longCalls) {
            try {
              const { data: lead } = await masterleadClient2.from("masterlead").select("taalk_lead_id, cn_email").eq("id", call.lead_id).single();
              if (!lead?.taalk_lead_id) continue;
              const { data: agent } = await supabaseAdmin.from("customers").select("associate_id").eq("company_email", (call.agent_email || lead.cn_email)?.toLowerCase().trim()).single();
              if (!agent?.associate_id) continue;
              const payload = {
                lead_id: lead.taalk_lead_id.toString(),
                associate_id: agent.associate_id
              };
              const response = await fetch4("https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });
              if (response.ok) {
                await supabaseAdmin.from("call_connector_tracker").update({ webhook_sent_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", call.id);
                console.log(`\u2705 Long call webhook sent: lead=${lead.taalk_lead_id} duration=${call.duration}s`);
                sent++;
              }
            } catch (err) {
              console.error(`\u274C Error sending long call webhook:`, err.message);
            }
          }
          if (sent > 0) {
            console.log(`\u{1F4CA} Long calls: ${sent} webhooks sent`);
          }
        } catch (error) {
          console.error("\u274C Long calls webhook error:", error.message);
        }
      }
    };
    bookedLeadsWebhookSender = BookedLeadsWebhookSender.getInstance();
  }
});

// server/outbound-dialer-lead-cache.ts
var OutboundDialerLeadCache, outboundDialerLeadCache;
var init_outbound_dialer_lead_cache = __esm({
  "server/outbound-dialer-lead-cache.ts"() {
    "use strict";
    init_supabase();
    init_local_masterlead_client();
    OutboundDialerLeadCache = class {
      cache = /* @__PURE__ */ new Map();
      inFlightLoads = /* @__PURE__ */ new Map();
      lastErrors = /* @__PURE__ */ new Map();
      ttlMs = 3 * 60 * 1e3;
      // 3 minutes - stale leads reassign faster
      async getAgentLeads(agentEmail, forceRefresh = false) {
        if (!agentEmail) return [];
        const normalizedEmail = agentEmail.trim().toLowerCase();
        const cached = this.cache.get(normalizedEmail);
        const now = Date.now();
        if (!forceRefresh && cached && now - cached.fetchedAt < this.ttlMs) {
          this.lastErrors.delete(normalizedEmail);
          return cached.leads;
        }
        return this.loadAgentLeads(normalizedEmail);
      }
      async searchAgentLeads(agentEmail, query, limit = 50) {
        if (!query || query.trim().length < 2) {
          return [];
        }
        return this.searchLeadsInDatabase(agentEmail, query.trim(), limit);
      }
      async searchLeadsInDatabase(agentEmail, query, limit) {
        if (!supabaseAdmin) {
          console.error("\u274C Supabase admin client not configured - cannot search leads");
          return [];
        }
        try {
          const normalizedEmail = agentEmail.trim().toLowerCase();
          const normalizedQuery = query.toLowerCase();
          const digitsOnlyQuery = normalizedQuery.replace(/\D/g, "");
          const selectCols = "id, first_name, last_name, phone, state, cnresolution, cn_email, taalk_lead_id, updated_at, is_hot_lead, taalk_market, associate_id, ao_lead_box, priority_score";
          let dbQuery = masterleadClient2.from("masterlead").select(selectCols);
          dbQuery = dbQuery.eq("cn_email", normalizedEmail).or("cnresolution.eq.pending,cnresolution.is.null");
          if (digitsOnlyQuery.length >= 3) {
            dbQuery = dbQuery.or(`phone.ilike.%${digitsOnlyQuery}%,taalk_lead_id.ilike.%${normalizedQuery}%`);
          } else {
            dbQuery = dbQuery.or(`first_name.ilike.%${normalizedQuery}%,last_name.ilike.%${normalizedQuery}%,state.ilike.%${normalizedQuery}%`);
          }
          const { data, error } = await dbQuery.order("updated_at", { ascending: false }).limit(limit);
          if (error) {
            console.error(`\u274C Failed to search leads in database for ${normalizedEmail}:`, error);
            return [];
          }
          const transformed = (data || []).map(this.transformLead);
          const normalizedQueryLower = normalizedQuery.toLowerCase();
          const digitsOnly = digitsOnlyQuery;
          const filtered = transformed.filter((lead) => {
            const nameLower = lead.name.toLowerCase();
            const nameMatch = nameLower.includes(normalizedQueryLower);
            const firstNameMatch = nameLower.split(" ")[0]?.includes(normalizedQueryLower) ?? false;
            const lastNameMatch = nameLower.split(" ").slice(1).join(" ").includes(normalizedQueryLower);
            const stateMatch = lead.state?.toLowerCase().includes(normalizedQueryLower) ?? false;
            const phoneMatch = digitsOnly ? (lead.phone || "").replace(/\D/g, "").includes(digitsOnly) : (lead.phone || "").toLowerCase().includes(normalizedQueryLower);
            const taalkMatch = lead.taalk_lead_id?.toLowerCase().includes(normalizedQueryLower) ?? false;
            return nameMatch || firstNameMatch || lastNameMatch || stateMatch || phoneMatch || taalkMatch;
          });
          return filtered.slice(0, limit);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("\u274C Unexpected error searching leads in database:", errorMessage);
          return [];
        }
      }
      async refreshAgentLeads(agentEmail) {
        return this.loadAgentLeads(agentEmail.trim().toLowerCase(), true);
      }
      async loadAgentLeads(agentEmail, force = false) {
        if (!supabaseAdmin) {
          console.error("\u274C Supabase admin client not configured - cannot load leads into cache");
          return [];
        }
        if (!force && this.inFlightLoads.has(agentEmail)) {
          return this.inFlightLoads.get(agentEmail);
        }
        const loadPromise = (async () => {
          try {
            console.log(`\u{1F9E0} Loading outbound dialer leads for ${agentEmail}${force ? " (forced)" : ""}`);
            const CACHE_LEAD_LIMIT = 2e5;
            const selectCols = "id, first_name, last_name, phone, state, cnresolution, cn_email, taalk_lead_id, updated_at, is_hot_lead, taalk_market, associate_id, ao_lead_box, priority_score";
            const baseQuery = masterleadClient2.from("masterlead").select(selectCols).eq("cn_email", agentEmail).or("cnresolution.eq.pending,cnresolution.is.null").order("updated_at", { ascending: false }).limit(CACHE_LEAD_LIMIT);
            let data = null;
            let error = null;
            const result = await baseQuery;
            error = result.error;
            data = result.data;
            if (error) {
              const errorMessage = error.message ?? JSON.stringify(error);
              console.error("\u274C Failed to fetch leads for cache:", errorMessage);
              this.lastErrors.set(agentEmail, errorMessage);
              return [];
            }
            const filtered = (data || []).filter((lead) => {
              const emailMatch = (lead.cn_email || "").toLowerCase() === agentEmail;
              const res = (lead.cnresolution || "").toLowerCase();
              const pendingMatch = res === "pending" || res === "";
              return emailMatch && pendingMatch;
            });
            const transformed = filtered.map((l) => this.transformLead(l));
            this.cache.set(agentEmail, { leads: transformed, fetchedAt: Date.now() });
            this.lastErrors.delete(agentEmail);
            return transformed;
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error("\u274C Unexpected error loading leads into cache:", errorMessage);
            this.lastErrors.set(agentEmail, errorMessage);
            return [];
          } finally {
            this.inFlightLoads.delete(agentEmail);
          }
        })();
        this.inFlightLoads.set(agentEmail, loadPromise);
        return loadPromise;
      }
      transformLead(lead) {
        const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown Lead";
        const aoBox = lead.ao_lead_box ?? null;
        return {
          id: lead.id,
          taalk_lead_id: lead.taalk_lead_id,
          name,
          phone: lead.phone,
          state: lead.state || null,
          cnresolution: lead.cnresolution || null,
          updated_at: lead.updated_at || null,
          cn_email: lead.cn_email || null,
          is_hot_lead: lead.is_hot_lead || null,
          isHotLead: lead.is_hot_lead || null,
          source_table: lead.source_table || null,
          taalk_market: lead.taalk_market || null,
          market: lead.market || null,
          associate_id: lead.associate_id ?? null,
          ao_lead_box: aoBox,
          aoLeadBox: aoBox,
          priority_score: lead.priority_score ?? null
        };
      }
      getLastError(agentEmail) {
        return this.lastErrors.get(agentEmail.trim().toLowerCase());
      }
      clearCache(agentEmail) {
        const normalizedEmail = agentEmail.trim().toLowerCase();
        this.cache.delete(normalizedEmail);
        this.inFlightLoads.delete(normalizedEmail);
        this.lastErrors.delete(normalizedEmail);
        console.log(`\u{1F5D1}\uFE0F Cleared cache for ${normalizedEmail}`);
      }
    };
    outboundDialerLeadCache = new OutboundDialerLeadCache();
  }
});

// server/ftc-queue-cleaner.ts
var ftc_queue_cleaner_exports = {};
__export(ftc_queue_cleaner_exports, {
  cleanFTCQueues: () => cleanFTCQueues,
  startFTCQueueCleaner: () => startFTCQueueCleaner,
  stopFTCQueueCleaner: () => stopFTCQueueCleaner
});
function isCallPermissible(leadState) {
  const timezone = stateTimezones[leadState];
  if (!timezone) return true;
  try {
    const now = /* @__PURE__ */ new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
    const currentMinute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    return currentTimeInMinutes >= 480 && currentTimeInMinutes <= 1260;
  } catch (error) {
    console.error(`\u274C FTC check error for ${leadState}:`, error);
    return true;
  }
}
async function cleanFTCQueues() {
  try {
    if (ftcColumnMissing) return;
    console.log("\u{1F550} FTC QUEUE CLEANER: Starting hourly cleanup...");
    const { error: probeError } = await masterleadClient2.from("masterlead").select("id, FTCRESTRICTED").limit(1).maybeSingle();
    if (probeError && probeError.code === "42703") {
      ftcColumnMissing = true;
      if (ftcCleanerInterval) {
        clearInterval(ftcCleanerInterval);
        ftcCleanerInterval = null;
      }
      console.log("\u26A0\uFE0F FTC queue cleaner disabled - FTCRESTRICTED column does not exist");
      return;
    }
    const { data: pendingLeads, error: fetchError } = await masterleadClient2.from("masterlead").select("id, first_name, last_name, state, taalk_state, cn_email, cnresolution").eq("cnresolution", "pending").not("cn_email", "is", null);
    if (fetchError) {
      console.error("\u274C Error fetching pending leads:", fetchError);
      return;
    }
    if (!pendingLeads || pendingLeads.length === 0) {
      console.log("\u2705 No pending leads to check");
      return;
    }
    console.log(`\u{1F4CA} Checking ${pendingLeads.length} pending leads for FTC compliance...`);
    const restrictIds = [];
    const unrestrictIds = [];
    for (const lead of pendingLeads) {
      const leadState = lead.state || lead.taalk_state;
      if (!leadState) continue;
      const isPermissible = isCallPermissible(leadState);
      const ftcRestricted = lead.FTCRESTRICTED;
      if (!isPermissible && ftcRestricted !== "YES") {
        restrictIds.push(BigInt(lead.id));
      } else if (isPermissible && ftcRestricted === "YES") {
        unrestrictIds.push(BigInt(lead.id));
      }
    }
    let restrictedCount = 0;
    let unrestrictedCount = 0;
    if (restrictIds.length > 0) {
      try {
        await pool.query(
          `UPDATE masterlead SET "FTCRESTRICTED"='YES', updated_at=NOW() WHERE id = ANY($1::bigint[])`,
          [restrictIds]
        );
        restrictedCount = restrictIds.length;
      } catch (e) {
        if (e?.code === "42703") {
          console.log("\u26A0\uFE0F FTCRESTRICTED column not found - skipping");
          return;
        }
        console.error("\u274C Bulk restrict failed:", e);
      }
    }
    if (unrestrictIds.length > 0) {
      try {
        await pool.query(
          `UPDATE masterlead SET "FTCRESTRICTED"='NO', updated_at=NOW() WHERE id = ANY($1::bigint[])`,
          [unrestrictIds]
        );
        unrestrictedCount = unrestrictIds.length;
      } catch (e) {
        if (e?.code === "42703") {
          console.log("\u26A0\uFE0F FTCRESTRICTED column not found - skipping");
          return;
        }
        console.error("\u274C Bulk unrestrict failed:", e);
      }
    }
    console.log(`\u{1F389} FTC QUEUE CLEANUP COMPLETE:`);
    console.log(`   \u{1F6AB} Restricted: ${restrictedCount} leads (outside calling hours)`);
    console.log(`   \u2705 Unrestricted: ${unrestrictedCount} leads (now callable)`);
    console.log(`   \u{1F4CC} NOTE: cnresolution field was NOT modified - only FTCRESTRICTED column updated`);
    if (restrictedCount > 0 || unrestrictedCount > 0) {
      console.log(`\u{1F504} Clearing lead cache for affected agents to resync with masterlead...`);
      const affectedEmails = /* @__PURE__ */ new Set();
      pendingLeads.forEach((lead) => {
        if (lead.cn_email) {
          affectedEmails.add(lead.cn_email.toLowerCase());
        }
      });
      affectedEmails.forEach((email) => {
        outboundDialerLeadCache.clearCache(email);
        console.log(`   \u{1F5D1}\uFE0F Cleared cache for ${email}`);
      });
      console.log(`\u2705 Cleared cache for ${affectedEmails.size} agents - cache will refresh on next request`);
    }
  } catch (error) {
    console.error("\u274C Error in FTC queue cleaner:", error);
  }
}
function startFTCQueueCleaner() {
  if (ftcCleanerInterval) {
    console.log("\u26A0\uFE0F FTC queue cleaner already running");
    return;
  }
  console.log("\u{1F680} Starting FTC queue cleaner (every 60 minutes)");
  const runCleanup = () => {
    if (ftcColumnMissing) return;
    cleanFTCQueues().catch(() => {
    });
  };
  runCleanup();
  ftcCleanerInterval = setInterval(runCleanup, 60 * 60 * 1e3);
}
function stopFTCQueueCleaner() {
  if (ftcCleanerInterval) {
    clearInterval(ftcCleanerInterval);
    ftcCleanerInterval = null;
    console.log("\u{1F6D1} FTC queue cleaner stopped");
  }
}
var stateTimezones, ftcCleanerInterval, ftcColumnMissing;
var init_ftc_queue_cleaner = __esm({
  "server/ftc-queue-cleaner.ts"() {
    "use strict";
    init_local_masterlead_client();
    init_db();
    init_outbound_dialer_lead_cache();
    stateTimezones = {
      // Eastern Time
      "FL": "America/New_York",
      "GA": "America/New_York",
      "SC": "America/New_York",
      "NC": "America/New_York",
      "VA": "America/New_York",
      "WV": "America/New_York",
      "MD": "America/New_York",
      "DE": "America/New_York",
      "PA": "America/New_York",
      "NJ": "America/New_York",
      "NY": "America/New_York",
      "CT": "America/New_York",
      "RI": "America/New_York",
      "MA": "America/New_York",
      "VT": "America/New_York",
      "NH": "America/New_York",
      "ME": "America/New_York",
      "OH": "America/New_York",
      "MI": "America/New_York",
      "IN": "America/New_York",
      "KY": "America/New_York",
      // Central Time
      "TX": "America/Chicago",
      "OK": "America/Chicago",
      "KS": "America/Chicago",
      "NE": "America/Chicago",
      "SD": "America/Chicago",
      "ND": "America/Chicago",
      "MN": "America/Chicago",
      "IA": "America/Chicago",
      "MO": "America/Chicago",
      "AR": "America/Chicago",
      "LA": "America/Chicago",
      "MS": "America/Chicago",
      "AL": "America/Chicago",
      "TN": "America/Chicago",
      "WI": "America/Chicago",
      "IL": "America/Chicago",
      // Mountain Time
      "MT": "America/Denver",
      "WY": "America/Denver",
      "CO": "America/Denver",
      "NM": "America/Denver",
      "UT": "America/Denver",
      "ID": "America/Denver",
      // Pacific Time
      "CA": "America/Los_Angeles",
      "WA": "America/Los_Angeles",
      "OR": "America/Los_Angeles",
      "NV": "America/Los_Angeles",
      // Alaska
      "AK": "America/Anchorage",
      // Hawaii
      "HI": "Pacific/Honolulu",
      // Arizona (no DST)
      "AZ": "America/Phoenix"
    };
    ftcCleanerInterval = null;
    ftcColumnMissing = false;
  }
});

// server/ip-analysis-service.ts
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

// server/verification-automation-scheduler.ts
var verification_automation_scheduler_exports = {};
__export(verification_automation_scheduler_exports, {
  VerificationAutomationScheduler: () => VerificationAutomationScheduler,
  verificationAutomationScheduler: () => verificationAutomationScheduler
});
import * as cron7 from "node-cron";
var VerificationAutomationScheduler, verificationAutomationScheduler;
var init_verification_automation_scheduler = __esm({
  "server/verification-automation-scheduler.ts"() {
    "use strict";
    init_supabase();
    init_ip_analysis_service();
    VerificationAutomationScheduler = class {
      cronJob = null;
      isRunning = false;
      /**
       * Start the automation scheduler
       */
      start() {
        if (this.isRunning) {
          console.log("\u26A0\uFE0F Verification Automation Scheduler already running");
          return;
        }
        console.log("\u{1F504} Starting Verification Automation Scheduler...");
        this.cronJob = cron7.schedule("*/15 * * * *", async () => {
          console.log("\u23F0 Running verification automation checks...");
          await this.runAutomationChecks();
        }, {
          scheduled: true,
          timezone: "America/Los_Angeles"
        });
        this.isRunning = true;
        console.log("\u2705 Verification Automation Scheduler started - will run every 15 minutes");
        setTimeout(() => {
          this.runAutomationChecks().catch((err) => {
            console.error("\u274C Initial automation check failed:", err);
          });
        }, 1e4);
      }
      /**
       * Stop the scheduler
       */
      stop() {
        if (this.cronJob) {
          this.cronJob.stop();
          this.cronJob = null;
        }
        this.isRunning = false;
        console.log("\u{1F6D1} Verification Automation Scheduler stopped");
      }
      /**
       * Run automation checks for all verification sessions
       */
      async runAutomationChecks() {
        try {
          console.log("\u{1F50D} Checking for sessions needing IP analysis...");
          const { data: sessionsNeedingAnalysis, error: analysisError } = await supabaseAdmin.from("verification_sessions").select("session_id, state, agent_ip_address, client_ip_address, agent_city, agent_region, agent_country, agent_latitude, agent_longitude, agent_isp, agent_timezone, agent_is_vpn, agent_is_proxy, agent_is_hosting, agent_vpn_detection_reason, client_city, client_region, client_country, client_latitude, client_longitude, client_isp, client_timezone, client_is_vpn, client_is_proxy, client_is_hosting, client_vpn_detection_reason, ip_flag_status").not("agent_ip_address", "is", null).not("client_ip_address", "is", null).or("ip_flag_status.is.null,ip_flag_status.eq.pending").limit(100);
          if (analysisError) {
            console.error("\u274C Error fetching sessions needing IP analysis:", analysisError);
          } else if (sessionsNeedingAnalysis && sessionsNeedingAnalysis.length > 0) {
            console.log(`\u{1F4CA} Found ${sessionsNeedingAnalysis.length} sessions needing IP analysis`);
            let analyzedCount = 0;
            for (const session of sessionsNeedingAnalysis) {
              try {
                let clientLocationData = null;
                if (session.client_ip_address && !session.client_city) {
                  try {
                    console.log(`  \u{1F50D} Fetching missing client geolocation for IP: ${session.client_ip_address}`);
                    clientLocationData = await getIPGeolocation(session.client_ip_address);
                    if (clientLocationData) {
                      await supabaseAdmin.from("verification_sessions").update({
                        client_city: clientLocationData.city || null,
                        client_region: clientLocationData.regionName || null,
                        client_country: clientLocationData.country || null,
                        // CRITICAL: Do NOT use IP coordinates for GPS fields - GPS must come from device navigator.geolocation only
                        // client_latitude and client_longitude should only be set by actual device GPS, not IP geolocation
                        client_timezone: clientLocationData.timezone || null,
                        client_isp: clientLocationData.isp || null,
                        // GPS overrides IP-based VPN detection - only save VPN if GPS not available
                        client_is_vpn: clientLocationData.isVpn && !session.client_latitude || false,
                        client_is_proxy: clientLocationData.isProxy || false,
                        client_is_hosting: clientLocationData.isHosting || false,
                        client_vpn_detection_reason: clientLocationData.isVpn && !session.client_latitude ? clientLocationData.vpnDetectionReason : null
                      }).eq("session_id", session.session_id);
                      console.log(`  \u2705 Client location data fetched and saved`);
                    }
                  } catch (geoError) {
                    console.warn(`  \u26A0\uFE0F Failed to fetch client geolocation:`, geoError);
                  }
                }
                let agentLocationData = null;
                if (session.agent_ip_address && !session.agent_city) {
                  try {
                    console.log(`  \u{1F50D} Fetching missing agent geolocation for IP: ${session.agent_ip_address}`);
                    agentLocationData = await getIPGeolocation(session.agent_ip_address);
                    if (agentLocationData) {
                      await supabaseAdmin.from("verification_sessions").update({
                        agent_city: agentLocationData.city || null,
                        agent_region: agentLocationData.regionName || null,
                        agent_country: agentLocationData.country || null,
                        // CRITICAL: Do NOT use IP coordinates for GPS fields - GPS must come from device navigator.geolocation only
                        // agent_latitude and agent_longitude should only be set by actual device GPS, not IP geolocation
                        agent_timezone: agentLocationData.timezone || null,
                        agent_isp: agentLocationData.isp || null,
                        // GPS overrides IP-based VPN detection - only save VPN if GPS not available
                        agent_is_vpn: agentLocationData.isVpn && !session.agent_latitude || false,
                        agent_is_proxy: agentLocationData.isProxy || false,
                        agent_is_hosting: agentLocationData.isHosting || false,
                        agent_vpn_detection_reason: agentLocationData.isVpn && !session.agent_latitude ? agentLocationData.vpnDetectionReason : null
                      }).eq("session_id", session.session_id);
                      console.log(`  \u2705 Agent location data fetched and saved`);
                    }
                  } catch (geoError) {
                    console.warn(`  \u26A0\uFE0F Failed to fetch agent geolocation:`, geoError);
                  }
                }
                const agentData = {
                  ip: session.agent_ip_address,
                  city: agentLocationData?.city || session.agent_city || null,
                  // IP-based only
                  region: agentLocationData?.regionName || session.agent_region || null,
                  // IP-based only
                  country: agentLocationData?.country || session.agent_country || null,
                  // IP-based only
                  latitude: agentLocationData?.lat?.toString() || null,
                  // IP-based coordinates ONLY - NOT GPS
                  longitude: agentLocationData?.lon?.toString() || null,
                  // IP-based coordinates ONLY - NOT GPS
                  isp: agentLocationData?.isp || session.agent_isp || null,
                  timezone: agentLocationData?.timezone || session.agent_timezone || null,
                  isVpn: agentLocationData?.isVpn || session.agent_is_vpn === true,
                  isProxy: agentLocationData?.isProxy || session.agent_is_proxy === true,
                  isHosting: agentLocationData?.isHosting || session.agent_is_hosting === true,
                  vpnDetectionReason: agentLocationData?.vpnDetectionReason || session.agent_vpn_detection_reason || null
                };
                const clientData = {
                  ip: session.client_ip_address,
                  city: clientLocationData?.city || session.client_city || null,
                  // IP-based only
                  region: clientLocationData?.regionName || session.client_region || null,
                  // IP-based only
                  country: clientLocationData?.country || session.client_country || null,
                  // IP-based only
                  latitude: clientLocationData?.lat?.toString() || null,
                  // IP-based coordinates ONLY - NOT GPS
                  longitude: clientLocationData?.lon?.toString() || null,
                  // IP-based coordinates ONLY - NOT GPS
                  isp: clientLocationData?.isp || session.client_isp || null,
                  timezone: clientLocationData?.timezone || session.client_timezone || null,
                  isVpn: clientLocationData?.isVpn || session.client_is_vpn === true,
                  isProxy: clientLocationData?.isProxy || session.client_is_proxy === true,
                  isHosting: clientLocationData?.isHosting || session.client_is_hosting === true,
                  vpnDetectionReason: clientLocationData?.vpnDetectionReason || session.client_vpn_detection_reason || null
                };
                const agentGeolocationDenied = session.agent_ip_address && !session.agent_latitude && !session.agent_longitude;
                const clientGeolocationDenied = session.client_ip_address && !session.client_latitude && !session.client_longitude;
                const ipAnalysis = analyzeIPAddresses(agentData, clientData, session.state || null, {
                  agentGeolocationDenied,
                  clientGeolocationDenied
                });
                const { error: updateError } = await supabaseAdmin.from("verification_sessions").update({
                  ip_analysis: ipAnalysis,
                  ip_flag_status: ipAnalysis.flagStatus,
                  ip_flag_reason: ipAnalysis.reason,
                  // Update VPN fields based on IP analysis result (GPS-aware)
                  // If GPS exists, VPN will be false in ipAnalysis.details
                  client_is_vpn: ipAnalysis.details.clientVpn || false,
                  agent_is_vpn: ipAnalysis.details.agentVpn || false
                  // Note: ip_analysis_summary column may not exist - using ip_flag_reason instead
                }).eq("session_id", session.session_id);
                if (updateError) {
                  console.error(`\u274C Failed to update IP analysis for session ${session.session_id}:`, updateError);
                } else {
                  analyzedCount++;
                  if (!ipAnalysis.isValid) {
                    console.log(`\u{1F6A9} IP FLAGGED for session ${session.session_id}: ${ipAnalysis.reason}`);
                  }
                }
              } catch (error) {
                console.error(`\u274C Error analyzing IPs for session ${session.session_id}:`, error);
              }
            }
            console.log(`\u2705 Analyzed IP data for ${analyzedCount} sessions`);
          } else {
            console.log("\u2705 No sessions need IP analysis (all have both IPs analyzed or missing IPs)");
          }
        } catch (error) {
          console.error("\u274C Error in verification automation checks:", error);
        }
      }
    };
    verificationAutomationScheduler = new VerificationAutomationScheduler();
  }
});

// server/presentation-lifecycle-manager.ts
var presentation_lifecycle_manager_exports = {};
__export(presentation_lifecycle_manager_exports, {
  PRESENTATION_PHASES: () => PRESENTATION_PHASES,
  presentationLifecycleManager: () => presentationLifecycleManager
});
var PRESENTATION_PHASES, PresentationLifecycleManager, presentationLifecycleManager;
var init_presentation_lifecycle_manager = __esm({
  "server/presentation-lifecycle-manager.ts"() {
    "use strict";
    init_supabase();
    PRESENTATION_PHASES = {
      "data_entry": {
        name: "Data Entry",
        isRealPresentation: false,
        // Agent just entering info, no client
        maxIdleMinutes: 30
      },
      "intro_screen": {
        name: "Intro/Welcome",
        isRealPresentation: true,
        // ** CLIENT IS PRESENT ** - This is the threshold
        maxIdleMinutes: 120
      },
      "needs_analysis": {
        name: "Needs Analysis",
        isRealPresentation: true,
        maxIdleMinutes: 120
      },
      "plan_generation": {
        name: "Plan Generation",
        isRealPresentation: true,
        maxIdleMinutes: 120
      },
      "plan_presentation": {
        name: "Plan Presentation",
        isRealPresentation: true,
        maxIdleMinutes: 120
      },
      "benefits_summary": {
        name: "Benefits Summary",
        isRealPresentation: true,
        maxIdleMinutes: 120
      },
      "eapp_enrollment": {
        name: "E-App/Enrollment",
        isRealPresentation: true,
        maxIdleMinutes: 120
      },
      "complete": {
        name: "Complete",
        isRealPresentation: true,
        maxIdleMinutes: 0
      }
    };
    PresentationLifecycleManager = class {
      checkInterval = null;
      /**
       * Start the lifecycle manager
       * Runs periodic checks for stale/timeout presentations
       */
      start() {
        console.log("\u{1F504} Presentation Lifecycle Manager starting...");
        this.checkInterval = setInterval(() => {
          this.checkStalePresentations();
        }, 5 * 60 * 1e3);
        this.checkStalePresentations();
      }
      stop() {
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
      }
      /**
       * Check for stale/abandoned presentations and auto-end them
       */
      async checkStalePresentations() {
        if (process.env.NODE_ENV !== "production") {
          console.log("\u{1F50D} Checking for stale presentations...");
        }
        try {
          const { data: sessions, error } = await supabaseAdmin.from("presentation_sessions").select("*").eq("status", "active").not("session_id", "is", null);
          if (error || !sessions || sessions.length === 0) {
            return;
          }
          const now = Date.now();
          let staleCount = 0;
          for (const session of sessions) {
            if (!session.session_id) {
              console.warn(`\u26A0\uFE0F Skipping presentation with null session_id (id: ${session.id || "unknown"})`);
              continue;
            }
            const updatedAt = new Date(session.updated_at || session.started_at).getTime();
            const idleMinutes = (now - updatedAt) / (60 * 1e3);
            const currentPhase = PRESENTATION_PHASES[session.current_phase || "data_entry"];
            const maxIdleMinutes = currentPhase?.maxIdleMinutes || 120;
            if (idleMinutes > maxIdleMinutes) {
              if (idleMinutes > 1440) {
                console.log(`\u23F0 Presentation ${session.session_id} is stale (${Math.floor(idleMinutes)} mins idle)`);
              }
              await this.endPresentationAsAbandoned(session.session_id, "timeout");
              staleCount++;
            }
            await this.checkDuplicateScreenshots(session.session_id);
          }
          if (staleCount > 0 && process.env.NODE_ENV !== "production") {
            console.log(`\u2705 Ended ${staleCount} stale presentations`);
          }
        } catch (error) {
          console.error("\u274C Error checking stale presentations:", error);
        }
      }
      /**
       * Check if presentation is stuck on the same screenshot
       */
      async checkDuplicateScreenshots(sessionId) {
        try {
          const { data: screenshots } = await supabaseAdmin.from("presentation_screenshots").select("file_path, created_at").eq("session_id", sessionId).order("sequence_number", { ascending: false }).limit(10);
          if (!screenshots || screenshots.length < 5) {
            return;
          }
          const oldestScreenshot = new Date(screenshots[screenshots.length - 1].created_at).getTime();
          const newestScreenshot = new Date(screenshots[0].created_at).getTime();
          const minutesDiff = (newestScreenshot - oldestScreenshot) / (60 * 1e3);
          if (minutesDiff > 30) {
            const { data: session } = await supabaseAdmin.from("presentation_sessions").select("current_phase, phase_updated_at").eq("session_id", sessionId).single();
            if (session) {
              const phaseUpdatedAt = new Date(session.phase_updated_at || 0).getTime();
              const phaseIdleMinutes = (Date.now() - phaseUpdatedAt) / (60 * 1e3);
              if (phaseIdleMinutes > 30) {
                console.log(`\u26A0\uFE0F Presentation ${sessionId} stuck on same phase for ${Math.floor(phaseIdleMinutes)} mins`);
                await this.endPresentationAsAbandoned(sessionId, "stuck");
              }
            }
          }
        } catch (error) {
          console.error(`\u274C Error checking duplicate screenshots for ${sessionId}:`, error);
        }
      }
      /**
       * End a presentation as abandoned/incomplete
       */
      async endPresentationAsAbandoned(sessionId, reason) {
        console.log(`\u274C Ending presentation ${sessionId} as abandoned (reason: ${reason})`);
        try {
          const endedAt = (/* @__PURE__ */ new Date()).toISOString();
          const { data: session } = await supabaseAdmin.from("presentation_sessions").select("started_at, current_phase").eq("session_id", sessionId).single();
          if (!session) return;
          const durationSeconds = Math.floor(
            (new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 1e3
          );
          await supabaseAdmin.from("presentation_sessions").update({
            status: "abandoned",
            ended_at: endedAt,
            duration_seconds: durationSeconds,
            presentation_outcome: reason === "timeout" ? "TIMEOUT" : "ABANDONED",
            updated_at: endedAt
          }).eq("session_id", sessionId);
          await supabaseAdmin.from("live_presentations").update({ is_active: false }).eq("session_id", sessionId);
          console.log(`\u2705 Presentation ${sessionId} marked as abandoned`);
        } catch (error) {
          console.error(`\u274C Error ending presentation ${sessionId}:`, error);
        }
      }
      /**
       * End any active presentations for an agent when they start a new one
       */
      async endPreviousPresentations(agentEmail, newSessionId) {
        console.log(`\u{1F504} Ending previous presentations for ${agentEmail}...`);
        try {
          const { data: sessions } = await supabaseAdmin.from("presentation_sessions").select("session_id").eq("agent_email", agentEmail).eq("status", "active").neq("session_id", newSessionId);
          if (sessions && sessions.length > 0) {
            console.log(`\u{1F4DB} Found ${sessions.length} active presentations to end`);
            for (const session of sessions) {
              await this.endPresentationAsAbandoned(session.session_id, "new_session");
            }
          }
        } catch (error) {
          console.error(`\u274C Error ending previous presentations for ${agentEmail}:`, error);
        }
      }
      /**
       * Update presentation phase and validate if it's a "real" presentation
       */
      async updatePhase(sessionId, newPhase) {
        console.log(`\u{1F4CD} Updating presentation ${sessionId} to phase: ${newPhase}`);
        try {
          const phase = PRESENTATION_PHASES[newPhase];
          if (!phase) {
            console.warn(`\u26A0\uFE0F Unknown phase: ${newPhase}`);
            return;
          }
          const updateData = {
            current_phase: newPhase,
            phase_updated_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          if (phase.isRealPresentation) {
            const { data: session } = await supabaseAdmin.from("presentation_sessions").select("client_confirmed_at").eq("session_id", sessionId).single();
            if (!session?.client_confirmed_at) {
              updateData.client_confirmed_at = (/* @__PURE__ */ new Date()).toISOString();
              console.log(`\u2705 Client confirmed present for presentation ${sessionId}`);
            }
          }
          await supabaseAdmin.from("presentation_sessions").update(updateData).eq("session_id", sessionId);
        } catch (error) {
          console.error(`\u274C Error updating phase for ${sessionId}:`, error);
        }
      }
      /**
       * Get presentation progress for display on Call Board
       */
      async getPresentationProgress(sessionId) {
        try {
          const { data: session } = await supabaseAdmin.from("presentation_sessions").select("*").eq("session_id", sessionId).single();
          if (!session) return null;
          const currentPhase = PRESENTATION_PHASES[session.current_phase || "data_entry"];
          const isRealPresentation = currentPhase?.isRealPresentation || false;
          const phaseOrder = Object.keys(PRESENTATION_PHASES);
          const currentIndex = phaseOrder.indexOf(session.current_phase || "data_entry");
          const progressPercent = Math.floor(currentIndex / (phaseOrder.length - 1) * 100);
          const phaseUpdatedAt = new Date(session.phase_updated_at || session.started_at).getTime();
          const timeInPhaseMinutes = Math.floor((Date.now() - phaseUpdatedAt) / (60 * 1e3));
          return {
            sessionId: session.session_id,
            agentEmail: session.agent_email,
            agentName: session.agent_name,
            currentPhase: currentPhase?.name || "Unknown",
            phaseKey: session.current_phase,
            isRealPresentation,
            progressPercent,
            timeInPhaseMinutes,
            startedAt: session.started_at,
            clientConfirmedAt: session.client_confirmed_at,
            status: session.status
          };
        } catch (error) {
          console.error(`\u274C Error getting progress for ${sessionId}:`, error);
          return null;
        }
      }
    };
    presentationLifecycleManager = new PresentationLifecycleManager();
  }
});

// server/ccpro-flag-sync-scheduler.ts
var ccpro_flag_sync_scheduler_exports = {};
__export(ccpro_flag_sync_scheduler_exports, {
  CCProFlagSyncScheduler: () => CCProFlagSyncScheduler,
  ccproFlagSyncScheduler: () => ccproFlagSyncScheduler
});
import * as cron8 from "node-cron";
var CCProFlagSyncScheduler, ccproFlagSyncScheduler;
var init_ccpro_flag_sync_scheduler = __esm({
  "server/ccpro-flag-sync-scheduler.ts"() {
    "use strict";
    init_supabase();
    CCProFlagSyncScheduler = class {
      cronJob = null;
      isRunning = false;
      start() {
        if (this.isRunning) {
          console.log("\u26A0\uFE0F CCPRO flag sync scheduler already running");
          return;
        }
        console.log("\u{1F504} Starting CCPRO flag sync scheduler...");
        this.cronJob = cron8.schedule("0 3 * * *", async () => {
          console.log("\u23F0 Daily CCPRO flag sync trigger - 3:00 AM EST");
          await this.syncCCProFlags();
        }, {
          scheduled: true,
          timezone: "America/New_York"
        });
        console.log("\u{1F504} Running initial CCPRO flag sync...");
        this.syncCCProFlags().catch((err) => {
          console.error("\u274C Initial CCPRO flag sync failed:", err);
        });
        this.isRunning = true;
        console.log("\u2705 CCPRO flag sync scheduler started - will sync daily at 3:00 AM EST");
      }
      stop() {
        if (this.cronJob) {
          this.cronJob.stop();
          this.cronJob = null;
        }
        this.isRunning = false;
        console.log("\u{1F6D1} CCPRO flag sync scheduler stopped");
      }
      /**
       * Sync CCPRO flags from Stripe subscriptions to agent_live_call_status
       * ONLY checks connectnow_subscriptions table (source of truth from Stripe)
       */
      async syncCCProFlags() {
        try {
          console.log("\u{1F504} Starting CCPRO flag sync from Stripe subscriptions...");
          if (!supabaseAdmin) {
            throw new Error("Supabase admin client not available");
          }
          const { data: ccproSubscriptions, error: subError } = await supabaseAdmin.from("connectnow_subscriptions").select("user_email, plan, status").or("status.eq.active,status.eq.trialing").in("plan", ["professional", "elite"]);
          if (subError) {
            throw subError;
          }
          const ccproEnabledEmails = new Set(
            (ccproSubscriptions || []).map((s) => s.user_email.toLowerCase().trim())
          );
          console.log(`\u{1F4CA} Found ${ccproEnabledEmails.size} agents with CCPRO subscriptions`);
          const { data: allAgents, error: agentsError } = await supabaseAdmin.from("agent_live_call_status").select("agent_email");
          if (agentsError) {
            throw agentsError;
          }
          if (!allAgents || allAgents.length === 0) {
            console.log("\u26A0\uFE0F No agents found in agent_live_call_status - skipping sync");
            return;
          }
          let updated = 0;
          let errors = 0;
          for (const agent of allAgents) {
            const agentEmail = agent.agent_email.toLowerCase().trim();
            const ccproEnabled = ccproEnabledEmails.has(agentEmail);
            const { error: updateError } = await supabaseAdmin.from("agent_live_call_status").update({ ccpro_enabled: ccproEnabled }).eq("agent_email", agentEmail);
            if (updateError) {
              console.error(`\u274C Failed to update ${agentEmail}:`, updateError);
              errors++;
            } else {
              updated++;
            }
          }
          console.log(`\u2705 CCPRO flag sync completed:`);
          console.log(`   - Updated: ${updated} agents`);
          console.log(`   - Errors: ${errors}`);
          console.log(`   - CCPRO Enabled: ${ccproEnabledEmails.size} agents`);
        } catch (error) {
          console.error("\u274C Error syncing CCPRO flags:", error);
          throw error;
        }
      }
      /**
       * Manual sync function - can be called via API endpoint
       */
      async manualSync() {
        try {
          await this.syncCCProFlags();
          const { data: ccproSubscriptions } = await supabaseAdmin?.from("connectnow_subscriptions").select("user_email").or("status.eq.active,status.eq.trialing").in("plan", ["professional", "elite"]) || { data: [] };
          const { data: allAgents } = await supabaseAdmin?.from("agent_live_call_status").select("agent_email") || { data: [] };
          return {
            success: true,
            updated: allAgents?.length || 0,
            errors: 0,
            ccproEnabled: ccproSubscriptions?.length || 0
          };
        } catch (error) {
          console.error("\u274C Manual CCPRO sync failed:", error);
          return {
            success: false,
            updated: 0,
            errors: 1,
            ccproEnabled: 0
          };
        }
      }
    };
    ccproFlagSyncScheduler = new CCProFlagSyncScheduler();
  }
});

// server/connectnow-billing-daily-scheduler.ts
var connectnow_billing_daily_scheduler_exports = {};
__export(connectnow_billing_daily_scheduler_exports, {
  ConnectNowBillingDailyScheduler: () => ConnectNowBillingDailyScheduler,
  connectNowBillingDailyScheduler: () => connectNowBillingDailyScheduler
});
import * as cron9 from "node-cron";
import { format } from "date-fns";
var ConnectNowBillingDailyScheduler, connectNowBillingDailyScheduler;
var init_connectnow_billing_daily_scheduler = __esm({
  "server/connectnow-billing-daily-scheduler.ts"() {
    "use strict";
    init_supabase();
    ConnectNowBillingDailyScheduler = class {
      cronJob = null;
      isRunning = false;
      /**
       * Start the daily billing data population scheduler
       */
      start() {
        if (this.isRunning) {
          console.log("\u26A0\uFE0F ConnectNow Billing Daily Scheduler already running");
          return;
        }
        console.log("\u{1F4B0} Starting ConnectNow Billing Daily Scheduler...");
        this.cronJob = cron9.schedule("0 0 * * *", async () => {
          console.log("\u23F0 Daily billing data population trigger - 12:00 AM PST");
          await this.populateBillingData();
        }, {
          scheduled: true,
          timezone: "America/Los_Angeles"
          // PST timezone
        });
        this.isRunning = true;
        console.log("\u2705 ConnectNow Billing Daily Scheduler started - will populate data daily at 12:00 AM PST");
      }
      /**
       * Stop the scheduler
       */
      stop() {
        if (this.cronJob) {
          this.cronJob.stop();
          this.cronJob = null;
        }
        this.isRunning = false;
        console.log("\u{1F6D1} ConnectNow Billing Daily Scheduler stopped");
      }
      /**
       * Populate billing data for yesterday (the day that just ended)
       * This runs at midnight, so we populate data for the day that just completed
       */
      async populateBillingData() {
        try {
          const now = /* @__PURE__ */ new Date();
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const dateStr = format(yesterday, "yyyy-MM-dd");
          console.log(`\u{1F4C5} Populating billing data for ${dateStr}...`);
          const dateStart = `${dateStr}T00:00:00`;
          const dateEnd = `${dateStr}T23:59:59`;
          const { count: precheckBilled, error: precheckError } = await supabaseAdmin.from("verification_sessions").select("*", { count: "exact", head: true }).not("taalk_call_url", "is", null).gte("created_at", dateStart).lte("created_at", dateEnd);
          if (precheckError) {
            console.error(`\u274C Error fetching Pre-Check billed for ${dateStr}:`, precheckError);
          }
          const { count: precheckSignUps, error: precheckSignUpsError } = await supabaseAdmin.from("verification_sessions").select("*", { count: "exact", head: true }).gte("created_at", dateStart).lte("created_at", dateEnd);
          if (precheckSignUpsError) {
            console.error(`\u274C Error fetching Pre-Check sign-ups for ${dateStr}:`, precheckSignUpsError);
          }
          const { data: ccpSubscriptions, error: ccpError } = await supabaseAdmin.from("connectnow_subscriptions").select("user_email, created_at").in("status", ["active", "trialing"]).in("plan", ["professional", "elite"]);
          let ccpActiveAccounts = 0;
          if (ccpSubscriptions) {
            const dateEndObj = new Date(dateEnd);
            const activeAccounts = /* @__PURE__ */ new Set();
            for (const sub of ccpSubscriptions) {
              const createdAt = sub.created_at ? new Date(sub.created_at) : /* @__PURE__ */ new Date();
              if (createdAt <= dateEndObj) {
                activeAccounts.add(sub.user_email);
              }
            }
            ccpActiveAccounts = activeAccounts.size;
          }
          if (ccpError) {
            console.error(`\u274C Error fetching Call Connector Pro subscriptions for ${dateStr}:`, ccpError);
          }
          const { data: ccpSignUpsData, error: ccpSignUpsError } = await supabaseAdmin.from("connectnow_subscriptions").select("trial_started_at, created_at, plan").in("plan", ["professional", "elite"]);
          let ccpSignUps = 0;
          if (ccpSignUpsData) {
            const dateStartObj = new Date(dateStart);
            const dateEndObj = new Date(dateEnd);
            for (const sub of ccpSignUpsData) {
              const signupDate = sub.trial_started_at ? new Date(sub.trial_started_at) : sub.created_at ? new Date(sub.created_at) : null;
              if (signupDate && signupDate >= dateStartObj && signupDate <= dateEndObj) {
                ccpSignUps++;
              }
            }
          }
          if (ccpSignUpsError) {
            console.error(`\u274C Error fetching Call Connector Pro sign-ups for ${dateStr}:`, ccpSignUpsError);
          }
          const billingData = {
            precheck_billed: precheckBilled || 0,
            precheck_sign_ups: precheckSignUps || 0,
            call_connector_pro_active_accounts: ccpActiveAccounts,
            call_connector_pro_sign_ups: ccpSignUps || 0
          };
          console.log(`\u{1F4CA} Billing data for ${dateStr}:`, billingData);
          const { error: updateError } = await supabaseAdmin.from("connectnow_daily_kpis").update({
            precheck_billed: billingData.precheck_billed,
            precheck_sign_ups: billingData.precheck_sign_ups,
            call_connector_pro_active_accounts: billingData.call_connector_pro_active_accounts,
            call_connector_pro_sign_ups: billingData.call_connector_pro_sign_ups
          }).eq("date", dateStr);
          if (updateError) {
            console.error(`\u274C Error updating billing data for ${dateStr}:`, updateError);
            throw updateError;
          }
          const { count: updatedCount } = await supabaseAdmin.from("connectnow_daily_kpis").select("*", { count: "exact", head: true }).eq("date", dateStr);
          console.log(`\u2705 Updated billing data for ${dateStr} (${updatedCount || 0} campaign rows)`);
          console.log(`\u2705 Daily billing data population complete for ${dateStr}`);
        } catch (error) {
          console.error("\u274C Error in daily billing data population:", error);
        }
      }
    };
    connectNowBillingDailyScheduler = new ConnectNowBillingDailyScheduler();
  }
});

// server/activity-card-report-service.ts
function pctChange(current, previous) {
  if (!previous) {
    if (!current) return { pct: 0, trend: "up" };
    return { pct: 100, trend: "up" };
  }
  const pct = (current - previous) / previous * 100;
  return { pct: Number(pct.toFixed(1)), trend: pct >= 0 ? "up" : "down" };
}
function performanceScore(agent) {
  return agent.dials * 1 + agent.reach * 10 + agent.booked * 40 + agent.connects * 25 + agent.instant * 80;
}
async function ensureReportTables() {
  if (tablesReady2) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_card_runs (
      id BIGSERIAL PRIMARY KEY,
      scope_key TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'started',
      generated_image_path TEXT,
      generated_image_url TEXT,
      payload_json JSONB,
      agent_ranks JSONB,
      error_message TEXT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_card_deliveries (
      id BIGSERIAL PRIMARY KEY,
      run_id BIGINT REFERENCES activity_card_runs(id) ON DELETE CASCADE,
      recipient_email TEXT,
      recipient_phone TEXT,
      recipient_role TEXT,
      channel TEXT NOT NULL,
      provider_sid TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      error_code TEXT,
      error_message TEXT,
      retry_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tablesReady2 = true;
}
function getPstDayRange(now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset"
  }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value || "GMT-8";
  const m = tzName.match(/GMT([+-]\d{1,2})/);
  const hours = Number(m?.[1] || -8);
  const sign = hours >= 0 ? "+" : "-";
  const hh = String(Math.abs(hours)).padStart(2, "0");
  const offset = `${sign}${hh}:00`;
  const start = /* @__PURE__ */ new Date(`${year}-${month}-${day}T05:00:00${offset}`);
  const end = /* @__PURE__ */ new Date(`${year}-${month}-${day}T23:59:59${offset}`);
  return { start, end };
}
function getLaDateYmd(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}
function getLaUtcForYmdTime(ymd, hour24, minute = 0) {
  const hh = String(hour24).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const approxUtc = /* @__PURE__ */ new Date(`${ymd}T${hh}:${mm}:00Z`);
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset"
  }).formatToParts(approxUtc).find((p) => p.type === "timeZoneName")?.value || "GMT-8";
  const match = tzName.match(/GMT([+-]\d{1,2})/);
  const hours = Number(match?.[1] || -8);
  const sign = hours >= 0 ? "+" : "-";
  const offH = String(Math.abs(hours)).padStart(2, "0");
  return /* @__PURE__ */ new Date(`${ymd}T${hh}:${mm}:00${sign}${offH}:00`);
}
function getDailyBusinessWindow(now = /* @__PURE__ */ new Date()) {
  const ymd = getLaDateYmd(now);
  const start = getLaUtcForYmdTime(ymd, 9, 0);
  const end = getLaUtcForYmdTime(ymd, 21, 0);
  return { start, end, ymd };
}
function previousBusinessDayYmd(fromYmd) {
  const d = /* @__PURE__ */ new Date(`${fromYmd}T12:00:00Z`);
  for (let i = 0; i < 7; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) return d.toISOString().slice(0, 10);
  }
  return (/* @__PURE__ */ new Date(`${fromYmd}T12:00:00Z`)).toISOString().slice(0, 10);
}
function getPstWeekRange(now = /* @__PURE__ */ new Date()) {
  const { start: dayStart } = getPstDayRange(now);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short"
  }).format(now);
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekday] ?? 0;
  const mondayDelta = day === 0 ? -6 : 1 - day;
  const start = new Date(dayStart);
  start.setDate(start.getDate() + mondayDelta);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}
async function getChrisScope() {
  const managerEmail = "chrislafond@aoglobelife.com";
  const { data: customer } = await supabaseAdmin.from("customers").select("company_email, first_name, last_name, mga, associate_id").eq("company_email", managerEmail).maybeSingle();
  const { data: profile } = await supabaseAdmin.from("agent_profiles").select("email, mga_team, rga_team").ilike("email", managerEmail).maybeSingle();
  const associateId = Number(customer?.associate_id || 0);
  const rows = /* @__PURE__ */ new Map();
  const hierarchyNameByEmail = {};
  if (associateId > 0) {
    const { data: mgaRows } = await supabaseAdmin.from("agent_hierarchy").select("agent_email,agent_name").eq("mga_associate_id", associateId);
    for (const r of mgaRows || []) {
      const e = String(r.agent_email || "").toLowerCase().trim();
      const n = String(r.agent_name || "").trim();
      if (e) rows.set(e, true);
      if (e && n) hierarchyNameByEmail[e] = n;
    }
  }
  if (rows.size === 0) {
    const targetMga = String(customer?.mga || profile?.mga_team || "").trim();
    if (targetMga) {
      const { data } = await supabaseAdmin.from("agent_hierarchy").select("agent_email,agent_name").eq("mga_name", targetMga);
      for (const r of data || []) {
        const e = String(r.agent_email || "").toLowerCase().trim();
        const n = String(r.agent_name || "").trim();
        if (e) rows.set(e, true);
        if (e && n) hierarchyNameByEmail[e] = n;
      }
    }
  }
  const agentEmails = [...rows.keys()];
  if (!agentEmails.includes(managerEmail)) agentEmails.unshift(managerEmail);
  return {
    scopeKey: "chris_lafond_hierarchy",
    managerName: `${String(customer?.first_name || "Chris").trim()} ${String(customer?.last_name || "Lafond").trim()}`.trim(),
    managerEmail,
    agentEmails,
    hierarchyNameByEmail
  };
}
async function getAgentIdentity(agentEmails) {
  const out = /* @__PURE__ */ new Map();
  const { data: companyCustomers } = await supabaseAdmin.from("customers").select("company_email, personal_email, first_name, last_name, phone").in("company_email", agentEmails);
  const { data: personalCustomers } = await supabaseAdmin.from("customers").select("company_email, personal_email, first_name, last_name, phone").in("personal_email", agentEmails);
  const customers = [...companyCustomers || [], ...personalCustomers || []];
  const { data: profiles } = await supabaseAdmin.from("agent_profiles").select("email, profile_picture").in("email", agentEmails);
  const photoByEmail = /* @__PURE__ */ new Map();
  for (const p of profiles || []) {
    const email = String(p.email || "").toLowerCase().trim();
    const pic = String(p.profile_picture || "").trim();
    if (email && pic) photoByEmail.set(email, pic);
  }
  for (const email of agentEmails) {
    const cust = (customers || []).find(
      (c) => String(c.company_email || "").toLowerCase().trim() === email || String(c.personal_email || "").toLowerCase().trim() === email
    );
    const firstName = String(cust?.first_name || "").trim();
    const lastName = String(cust?.last_name || "").trim();
    const fullName = `${firstName} ${lastName}`.trim() || email;
    out.set(email, {
      firstName: firstName || fullName.split(" ")[0] || "Agent",
      lastName: lastName || fullName.split(" ").slice(1).join(" "),
      photo: photoByEmail.get(email),
      fullName,
      phone: String(cust?.phone || "").trim() || void 0,
      companyEmail: String(cust?.company_email || "").trim() || email
    });
  }
  return out;
}
async function getConnectsByAgent(agentEmails, start, end) {
  const map = /* @__PURE__ */ new Map();
  if (agentEmails.length === 0) return map;
  const normalizedEmails = agentEmails.map((e) => e.toLowerCase().trim());
  for (let i = 0; i < normalizedEmails.length; i += 500) {
    const chunk = normalizedEmails.slice(i, i + 500);
    const { data: rows, error } = await supabaseAdmin.from("billing_transactions").select("agent_email").eq("transaction_type", "connect").gte("transaction_date", start.toISOString()).lt("transaction_date", end.toISOString()).in("agent_email", chunk).not("agent_email", "is", null).neq("agent_email", "");
    if (error) {
      console.error("\u274C Error fetching connects from billing_transactions:", error);
      continue;
    }
    for (const row of rows || []) {
      const email = String(row.agent_email || "").toLowerCase().trim();
      if (email && normalizedEmails.includes(email)) {
        map.set(email, (map.get(email) || 0) + 1);
      }
    }
  }
  return map;
}
async function getRawTotalsForDateRange(start, end) {
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  let totalConnects = 0;
  let totalMissedCalls = 0;
  const { count: connectCount } = await supabaseAdmin.from("billing_transactions").select("*", { count: "exact", head: true }).eq("transaction_type", "connect").gte("transaction_date", startIso).lt("transaction_date", endIso);
  totalConnects = connectCount ?? 0;
  const { count: missedCount } = await supabaseAdmin.from("billing_transactions").select("*", { count: "exact", head: true }).eq("transaction_type", "missed_call").gte("created_at", startIso).lt("created_at", endIso);
  totalMissedCalls = missedCount ?? 0;
  const pageSize = 1e3;
  const bookedSet = /* @__PURE__ */ new Set();
  for (let from = 0; from < RAW_TOTALS_ROW_CAP; from += pageSize) {
    const { data: rows, error } = await supabaseAdmin.from("agent_dial_metrics").select("agent_email,lead_phone").eq("event_type", "booked").gte("event_timestamp", startIso).lt("event_timestamp", endIso).range(from, from + pageSize - 1);
    if (error) break;
    for (const row of rows || []) {
      const phone = String(row.lead_phone || "").replace(/\D/g, "").slice(-10);
      if (phone.length === 10) bookedSet.add(phone);
    }
    if ((rows || []).length < pageSize) break;
  }
  const dialSeen = /* @__PURE__ */ new Map();
  const reachSeen = /* @__PURE__ */ new Set();
  const instantSeen = /* @__PURE__ */ new Set();
  let totalDials = 0;
  let totalReach = 0;
  let totalInstant = 0;
  for (let from = 0; from < RAW_TOTALS_ROW_CAP; from += pageSize) {
    const { data: rows, error } = await supabaseAdmin.from("twilio_call_logs").select("owner_email,to_number,call_started_at,call_duration,call_status").eq("call_direction", "outbound").gte("call_started_at", startIso).lt("call_started_at", endIso).order("call_started_at", { ascending: true }).range(from, from + pageSize - 1);
    if (error) break;
    for (const row of rows || []) {
      const email = String(row.owner_email || "").toLowerCase().trim();
      const phone = String(row.to_number || "").replace(/\D/g, "").slice(-10);
      if (!email || phone.length !== 10) continue;
      const status = String(row.call_status || "").toLowerCase();
      const duration = Number(row.call_duration || 0);
      const answeredOrCompleted = status === "answered" || status === "completed";
      const excluded = ["failed", "busy", "no-answer", "canceled"].includes(status) && !answeredOrCompleted;
      if (excluded) continue;
      const ts = new Date(String(row.call_started_at));
      const key = `${email}:${phone}`;
      if (duration >= 1 || answeredOrCompleted) {
        const lastTs = dialSeen.get(key);
        if (!lastTs || ts.getTime() - lastTs >= 5 * 60 * 1e3) {
          dialSeen.set(key, ts.getTime());
          totalDials++;
        }
      }
      if (duration >= 55 && answeredOrCompleted && !reachSeen.has(key)) {
        reachSeen.add(key);
        totalReach++;
      }
      if (duration >= 600 && answeredOrCompleted && !instantSeen.has(key)) {
        instantSeen.add(key);
        totalInstant++;
      }
    }
    if ((rows || []).length < pageSize) break;
  }
  return {
    dials: totalDials,
    reach: totalReach,
    booked: bookedSet.size,
    instant: totalInstant,
    connects: totalConnects,
    missedCalls: totalMissedCalls
  };
}
async function getMissedCallsByAgent(agentEmails, start, end) {
  const map = /* @__PURE__ */ new Map();
  if (agentEmails.length === 0) return map;
  const pageSize = 1e3;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin.from("billing_transactions").select("agent_email,transaction_type,created_at").eq("transaction_type", "missed_call").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at", { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const a = String(row.agent_email || "").toLowerCase().trim();
      const email = agentEmails.includes(a) ? a : "";
      if (!email) continue;
      map.set(email, (map.get(email) || 0) + 1);
    }
    if (rows.length < pageSize) break;
  }
  return map;
}
async function getBookedByAgent(agentEmails, start, end) {
  const byEmail = /* @__PURE__ */ new Map();
  if (agentEmails.length === 0) return /* @__PURE__ */ new Map();
  const pageSize = 1e3;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin.from("agent_dial_metrics").select("agent_email, lead_phone").eq("event_type", "booked").gte("event_timestamp", start.toISOString()).lt("event_timestamp", end.toISOString()).in("agent_email", agentEmails).order("event_timestamp", { ascending: true }).range(from, from + pageSize - 1);
    if (error) {
      console.error(`\u274C Error paginating booked data (offset ${from}):`, error);
      throw error;
    }
    const rows = data || [];
    for (const row of rows) {
      const email = String(row.agent_email || "").toLowerCase().trim();
      const phone = String(row.lead_phone || "").replace(/\D/g, "").slice(-10);
      if (!email || phone.length !== 10) continue;
      if (!byEmail.has(email)) byEmail.set(email, /* @__PURE__ */ new Set());
      byEmail.get(email).add(phone);
    }
    if (rows.length < pageSize) break;
  }
  const out = /* @__PURE__ */ new Map();
  for (const [email, phones] of byEmail.entries()) out.set(email, phones.size);
  return out;
}
async function getInstantByAgent(agentEmails, start, end) {
  const byEmail = /* @__PURE__ */ new Map();
  if (agentEmails.length === 0) return /* @__PURE__ */ new Map();
  const pageSize = 1e3;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin.from("twilio_call_logs").select("owner_email,to_number,call_duration,call_status").eq("call_direction", "outbound").gte("call_started_at", start.toISOString()).lt("call_started_at", end.toISOString()).gte("call_duration", 600).in("call_status", ["answered", "completed"]).in("owner_email", agentEmails).order("call_started_at", { ascending: true }).range(from, from + pageSize - 1);
    if (error) {
      console.error(`\u274C Error paginating instant data (offset ${from}):`, error);
      throw error;
    }
    const rows = data || [];
    for (const row of rows) {
      const email = String(row.owner_email || "").toLowerCase().trim();
      const phone = String(row.to_number || "").replace(/\D/g, "").slice(-10);
      if (!email || phone.length !== 10) continue;
      if (!byEmail.has(email)) byEmail.set(email, /* @__PURE__ */ new Set());
      byEmail.get(email).add(phone);
    }
    if (rows.length < pageSize) break;
  }
  const out = /* @__PURE__ */ new Map();
  for (const [email, phones] of byEmail.entries()) out.set(email, phones.size);
  return out;
}
async function getUsageMinutesByAgent(agentEmails, start, end) {
  const map = /* @__PURE__ */ new Map();
  const { data: rows } = await supabaseAdmin.from("agent_activity_log").select("agent_email, activity_type").in("agent_email", agentEmails).gte("timestamp", start.toISOString()).lt("timestamp", end.toISOString()).eq("activity_type", "heartbeat");
  for (const row of rows || []) {
    const email = String(row.agent_email || "").toLowerCase().trim();
    if (!email) continue;
    map.set(email, (map.get(email) || 0) + 1);
  }
  return map;
}
async function getDialsByAgent(agentEmails, start, end) {
  const map = /* @__PURE__ */ new Map();
  if (agentEmails.length === 0) return map;
  const normalizedEmails = agentEmails.map((e) => e.toLowerCase().trim());
  const dialSeen = /* @__PURE__ */ new Map();
  const pageSize = 1e3;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin.from("twilio_call_logs").select("owner_email, to_number, call_started_at, call_duration, call_status, call_direction").eq("call_direction", "outbound").gte("call_started_at", start.toISOString()).lt("call_started_at", end.toISOString()).in("owner_email", normalizedEmails).order("call_started_at", { ascending: true }).range(from, from + pageSize - 1);
    if (error) {
      console.error(`\u274C Error paginating dials data (offset ${from}):`, error);
      break;
    }
    const rows = data || [];
    for (const row of rows) {
      const email = String(row.owner_email || "").toLowerCase().trim();
      const phone = String(row.to_number || "").replace(/\D/g, "").slice(-10);
      if (!email || phone.length !== 10 || !normalizedEmails.includes(email)) continue;
      const status = String(row.call_status || "").toLowerCase();
      const duration = Number(row.call_duration || 0);
      const answeredOrCompleted = status === "answered" || status === "completed";
      const excluded = ["failed", "busy", "no-answer", "canceled"].includes(status) && !answeredOrCompleted;
      if (excluded) continue;
      const ts = new Date(String(row.call_started_at));
      const key = `${email}:${phone}`;
      const lastTs = dialSeen.get(key);
      if ((duration >= 1 || answeredOrCompleted) && (!lastTs || ts.getTime() - lastTs >= 5 * 60 * 1e3)) {
        dialSeen.set(key, ts.getTime());
        map.set(email, (map.get(email) || 0) + 1);
      }
    }
    if (rows.length < pageSize) break;
  }
  return map;
}
async function getReachByAgent(agentEmails, start, end) {
  const map = /* @__PURE__ */ new Map();
  if (agentEmails.length === 0) return map;
  const normalizedEmails = agentEmails.map((e) => e.toLowerCase().trim());
  const reachSeen = /* @__PURE__ */ new Set();
  const pageSize = 1e3;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin.from("twilio_call_logs").select("owner_email, to_number, call_started_at, call_duration, call_status, call_direction").eq("call_direction", "outbound").gte("call_started_at", start.toISOString()).lt("call_started_at", end.toISOString()).in("owner_email", normalizedEmails).order("call_started_at", { ascending: true }).range(from, from + pageSize - 1);
    if (error) {
      console.error(`\u274C Error paginating reach data (offset ${from}):`, error);
      break;
    }
    const rows = data || [];
    for (const row of rows) {
      const email = String(row.owner_email || "").toLowerCase().trim();
      const phone = String(row.to_number || "").replace(/\D/g, "").slice(-10);
      if (!email || phone.length !== 10 || !normalizedEmails.includes(email)) continue;
      const status = String(row.call_status || "").toLowerCase();
      const duration = Number(row.call_duration || 0);
      const answeredOrCompleted = status === "answered" || status === "completed";
      if (duration >= 55 && answeredOrCompleted) {
        const key = `${email}:${phone}`;
        if (!reachSeen.has(key)) {
          reachSeen.add(key);
          map.set(email, (map.get(email) || 0) + 1);
        }
      }
    }
    if (rows.length < pageSize) break;
  }
  return map;
}
async function getLiveCallBoardStatsByAgent(agentEmails) {
  const map = /* @__PURE__ */ new Map();
  if (agentEmails.length === 0) return map;
  const { data: rows } = await supabaseAdmin.from("live_call_boardt").select("agent_email,agent_name,status,today_dialed,today_reached,today_booked,today_instant_presentation,today_connects,updated_at").in("agent_email", agentEmails);
  for (const row of rows || []) {
    const email = String(row.agent_email || "").toLowerCase().trim();
    if (!email) continue;
    map.set(email, {
      dials: Number(row.today_dialed || 0),
      reach: Number(row.today_reached || 0),
      booked: Number(row.today_booked || 0),
      instant: Number(row.today_instant_presentation || 0),
      connects: Number(row.today_connects || 0),
      status: String(row.status || "").toLowerCase(),
      updatedAt: String(row.updated_at || ""),
      agentName: String(row.agent_name || "")
    });
  }
  return map;
}
async function buildWeightedPointIncrements(agentEmails, start, end, bucketMs = 5 * 60 * 1e3) {
  const bucketCount = Math.max(1, Math.floor((end.getTime() - start.getTime()) / bucketMs));
  const increments = new Array(bucketCount).fill(0);
  if (agentEmails.length === 0) return increments;
  const dialLastAt = /* @__PURE__ */ new Map();
  const reachedSeen = /* @__PURE__ */ new Set();
  const instantSeen = /* @__PURE__ */ new Set();
  const bookedSeen = /* @__PURE__ */ new Set();
  const bucketIndex = (ts) => Math.max(0, Math.min(bucketCount - 1, Math.floor((ts.getTime() - start.getTime()) / bucketMs)));
  const pageSize = 1e3;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin.from("twilio_call_logs").select("owner_email,to_number,call_status,call_duration,call_started_at").eq("call_direction", "outbound").gte("call_started_at", start.toISOString()).lt("call_started_at", end.toISOString()).in("owner_email", agentEmails).order("call_started_at", { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const email = String(row.owner_email || "").toLowerCase().trim();
      const phone = String(row.to_number || "").replace(/\D/g, "").slice(-10);
      if (!email || phone.length !== 10) continue;
      const status = String(row.call_status || "").toLowerCase();
      const duration = Number(row.call_duration || 0);
      const answeredOrCompleted = status === "answered" || status === "completed";
      const excluded = ["failed", "busy", "no-answer", "canceled"].includes(status) && !answeredOrCompleted;
      if (excluded) continue;
      const ts = new Date(String(row.call_started_at));
      const idx = bucketIndex(ts);
      const key = `${email}:${phone}`;
      if (duration >= 1 || answeredOrCompleted) {
        const lastTs = dialLastAt.get(key);
        if (!lastTs || ts.getTime() - lastTs >= 5 * 60 * 1e3) {
          dialLastAt.set(key, ts.getTime());
          increments[idx] += 1;
        }
      }
      if (duration >= 55 && answeredOrCompleted && !reachedSeen.has(key)) {
        reachedSeen.add(key);
        increments[idx] += 10;
      }
      if (duration >= 600 && answeredOrCompleted && !instantSeen.has(key)) {
        instantSeen.add(key);
        increments[idx] += 80;
      }
    }
    if (rows.length < pageSize) break;
  }
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin.from("agent_dial_metrics").select("agent_email,lead_phone,event_timestamp").eq("event_type", "booked").gte("event_timestamp", start.toISOString()).lt("event_timestamp", end.toISOString()).in("agent_email", agentEmails).order("event_timestamp", { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const email = String(row.agent_email || "").toLowerCase().trim();
      const phone = String(row.lead_phone || "").replace(/\D/g, "").slice(-10);
      if (!email || phone.length !== 10) continue;
      const key = `${email}:${phone}`;
      if (bookedSeen.has(key)) continue;
      bookedSeen.add(key);
      const ts = new Date(String(row.event_timestamp || start.toISOString()));
      const idx = bucketIndex(ts);
      increments[idx] += 40;
    }
    if (rows.length < pageSize) break;
  }
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin.from("vdp_calls").select("company_email,agent,updated_at").gte("updated_at", start.toISOString()).lt("updated_at", end.toISOString()).order("updated_at", { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const c = String(row.company_email || "").toLowerCase().trim();
      if (!agentEmails.includes(c)) continue;
      const ts = new Date(String(row.updated_at || start.toISOString()));
      const idx = bucketIndex(ts);
      increments[idx] += 25;
    }
    if (rows.length < pageSize) break;
  }
  return increments;
}
async function getPaceDeltaSeries(agentEmails, now = /* @__PURE__ */ new Date()) {
  const bucketMs = 5 * 60 * 1e3;
  const todayWindow = getDailyBusinessWindow(now);
  const bucketCount = Math.max(1, Math.floor((todayWindow.end.getTime() - todayWindow.start.getTime()) / bucketMs));
  const todayIncrements = await buildWeightedPointIncrements(agentEmails, todayWindow.start, todayWindow.end, bucketMs);
  const prevYmd = previousBusinessDayYmd(todayWindow.ymd);
  const prevStart = getLaUtcForYmdTime(prevYmd, 9, 0);
  const prevEnd = getLaUtcForYmdTime(prevYmd, 21, 0);
  const prevIncrements = await buildWeightedPointIncrements(agentEmails, prevStart, prevEnd, bucketMs);
  const baselineTotal = prevIncrements.reduce((s, v) => s + v, 0);
  const nowClamped = new Date(Math.min(Math.max(now.getTime(), todayWindow.start.getTime()), todayWindow.end.getTime()));
  const elapsedBuckets = Math.max(1, Math.min(bucketCount, Math.ceil((nowClamped.getTime() - todayWindow.start.getTime()) / bucketMs)));
  const expectedPerBucket = baselineTotal / bucketCount;
  const labels = [];
  const series = [];
  let cumulativeActual = 0;
  for (let i = 0; i < elapsedBuckets; i++) {
    const t = new Date(todayWindow.start.getTime() + i * bucketMs);
    const shouldLabel = i === 0 || i === elapsedBuckets - 1 || t.getMinutes() % 60 === 0;
    labels.push(shouldLabel ? t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "");
    cumulativeActual += todayIncrements[i] || 0;
    const expected2 = expectedPerBucket * (i + 1);
    const delta = cumulativeActual - expected2;
    series.push(Number(delta.toFixed(2)));
  }
  const expectedNow = expectedPerBucket * elapsedBuckets;
  const paceDeltaPct = expectedNow > 0 ? (cumulativeActual - expectedNow) / expectedNow * 100 : 0;
  return { labels, series, paceDeltaPct: Number(paceDeltaPct.toFixed(1)) };
}
async function getWeeklyAlp(agentEmails, now) {
  const thisWeek = getPstWeekRange(now);
  const prevWeekStart = new Date(thisWeek.start);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(thisWeek.start);
  const sumBetween = async (start, end) => {
    const { data } = await supabaseAdmin.from("billing_transactions").select("amount,agent_email,created_at").gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    let total = 0;
    for (const row of data || []) {
      const a = String(row.agent_email || "").toLowerCase().trim();
      if (!agentEmails.includes(a)) continue;
      total += Number(row.amount || 0);
    }
    return Math.round(total);
  };
  return {
    currentWeek: await sumBetween(thisWeek.start, thisWeek.end),
    previousWeek: await sumBetween(prevWeekStart, prevWeekEnd)
  };
}
async function createRunRecord(scopeKey) {
  await ensureReportTables();
  const result = await pool.query(
    `INSERT INTO activity_card_runs (scope_key, status) VALUES ($1, 'started') RETURNING id`,
    [scopeKey]
  );
  return Number(result.rows[0].id);
}
async function updateRunRecord(runId, updates) {
  await ensureReportTables();
  await pool.query(
    `UPDATE activity_card_runs
     SET status = COALESCE($2, status),
         generated_image_path = COALESCE($3, generated_image_path),
         generated_image_url = COALESCE($4, generated_image_url),
         payload_json = COALESCE($5::jsonb, payload_json),
         agent_ranks = COALESCE($6::jsonb, agent_ranks),
         error_message = COALESCE($7, error_message)
     WHERE id = $1`,
    [
      runId,
      updates.status || null,
      updates.generatedImagePath || null,
      updates.generatedImageUrl || null,
      updates.payload ? JSON.stringify(updates.payload) : null,
      updates.agentRanks ? JSON.stringify(updates.agentRanks) : null,
      updates.errorMessage || null
    ]
  );
}
async function createDeliveryRecord(runId, recipient, channel) {
  await ensureReportTables();
  const result = await pool.query(
    `INSERT INTO activity_card_deliveries
     (run_id, recipient_email, recipient_phone, recipient_role, channel, status)
     VALUES ($1, $2, $3, $4, $5, 'queued')
     RETURNING id`,
    [runId, recipient.email || null, recipient.phone || null, recipient.role, channel]
  );
  return Number(result.rows[0].id);
}
async function updateDeliveryRecord(deliveryId, updates) {
  await ensureReportTables();
  await pool.query(
    `UPDATE activity_card_deliveries
     SET status = COALESCE($2, status),
         provider_sid = COALESCE($3, provider_sid),
         error_code = COALESCE($4, error_code),
         error_message = COALESCE($5, error_message),
         updated_at = NOW()
     WHERE id = $1`,
    [deliveryId, updates.status || null, updates.providerSid || null, updates.errorCode || null, updates.errorMessage || null]
  );
}
async function resolveChrisRecipients() {
  const scope = await getChrisScope();
  const identity = await getAgentIdentity(scope.agentEmails);
  const recipients = [];
  for (const email of scope.agentEmails) {
    const id = identity.get(email);
    if (!id) continue;
    recipients.push({
      email: id.companyEmail || email,
      phone: id.phone,
      role: email === scope.managerEmail ? "manager" : "agent",
      agentEmail: email,
      fullName: id.fullName
    });
  }
  return { scope, recipients };
}
async function buildActivityCardPayload(scope) {
  const effectiveScope = scope || await getChrisScope();
  const now = /* @__PURE__ */ new Date();
  const { start, end } = getPstDayRange(now);
  let rawTotals = null;
  try {
    rawTotals = await Promise.race([
      getRawTotalsForDateRange(start, end),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Raw totals timeout")), RAW_TOTALS_TIMEOUT_MS))
    ]);
  } catch (_) {
    rawTotals = null;
  }
  const lcbMap = await getLiveCallBoardStatsByAgent(effectiveScope.agentEmails);
  const identity = await getAgentIdentity(effectiveScope.agentEmails);
  const usageMap = await getUsageMinutesByAgent(effectiveScope.agentEmails, start, end);
  const dialsMap = await getDialsByAgent(effectiveScope.agentEmails, start, end);
  const reachMap = await getReachByAgent(effectiveScope.agentEmails, start, end);
  const bookedMap = await getBookedByAgent(effectiveScope.agentEmails, start, end);
  const instantMap = await getInstantByAgent(effectiveScope.agentEmails, start, end);
  const connectsMap = await getConnectsByAgent(effectiveScope.agentEmails, start, end);
  const missedCallsMap = await getMissedCallsByAgent(effectiveScope.agentEmails, start, end);
  const { rows: prevRuns } = await pool.query(
    `SELECT payload_json, agent_ranks FROM activity_card_runs
     WHERE scope_key = $1 AND status = 'completed'
     ORDER BY run_at DESC LIMIT 1`,
    [effectiveScope.scopeKey]
  ).catch(() => ({ rows: [] }));
  const prevPayload = prevRuns[0]?.payload_json || null;
  const prevRanks = prevRuns[0]?.agent_ranks || {};
  const agentsRaw = effectiveScope.agentEmails.map((email) => {
    const stat = lcbMap.get(email);
    const id = identity.get(email);
    const dials = Number(dialsMap.get(email) ?? 0);
    const reach = Number(reachMap.get(email) ?? 0);
    const booked = Number(bookedMap.get(email) ?? 0);
    const instant = Number(instantMap.get(email) ?? 0);
    const connects = Number(connectsMap.get(email) ?? 0);
    const missedCalls = Number(missedCallsMap.get(email) ?? 0);
    const aoiUsage = Number(usageMap.get(email) || 0);
    const prevAgent = (prevPayload?.agents || []).find((a) => String(a?.name || "").toLowerCase() === String(id?.fullName || "").toLowerCase());
    const dialsDelta = pctChange(dials, Number(prevAgent?.dials || 0));
    const reachDelta = pctChange(reach, Number(prevAgent?.reach || 0));
    const bookedDelta = pctChange(booked, Number(prevAgent?.booked || 0));
    const instantDelta = pctChange(instant, Number(prevAgent?.instant || 0));
    const connectsDelta = pctChange(connects, Number(prevAgent?.connects || 0));
    const missedCallsDelta = pctChange(missedCalls, Number(prevAgent?.missedCalls || 0));
    const usageDelta = pctChange(aoiUsage, Number(prevAgent?.aoiUsage || 0));
    return {
      rank: 0,
      rankChange: 0,
      name: id?.fullName || stat?.agentName || effectiveScope.hierarchyNameByEmail?.[email] || email,
      photoUrl: id?.photo,
      isLive: stat ? stat.status !== "offline" : false,
      dials,
      dialsPct: Math.abs(dialsDelta.pct),
      dialsTrend: dialsDelta.trend,
      reach,
      reachPct: Math.abs(reachDelta.pct),
      reachTrend: reachDelta.trend,
      booked,
      bookedPct: Math.abs(bookedDelta.pct),
      bookedTrend: bookedDelta.trend,
      instant,
      instantPct: Math.abs(instantDelta.pct),
      instantTrend: instantDelta.trend,
      connects,
      connectsPct: Math.abs(connectsDelta.pct),
      connectsTrend: connectsDelta.trend,
      missedCalls,
      missedCallsPct: Math.abs(missedCallsDelta.pct),
      missedCallsTrend: missedCallsDelta.trend,
      aoiUsage,
      aoiUsagePct: Math.abs(usageDelta.pct),
      aoiUsageTrend: usageDelta.trend
    };
  });
  const agentsWithActivity = agentsRaw.filter(
    (a) => a.dials > 0 || a.reach > 0 || a.booked > 0 || a.instant > 0 || a.connects > 0 || a.missedCalls > 0
  );
  agentsWithActivity.sort((a, b) => {
    const scoreDiff = performanceScore(b) - performanceScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    if (b.booked !== a.booked) return b.booked - a.booked;
    if (b.reach !== a.reach) return b.reach - a.reach;
    return b.dials - a.dials;
  });
  const agentRanks = {};
  agentsWithActivity.forEach((a, i) => {
    const rank = i + 1;
    a.rank = rank;
    const key = a.name.toLowerCase();
    agentRanks[key] = rank;
    const previousRank = Number(prevRanks[key] || rank);
    a.rankChange = previousRank - rank;
  });
  const hierarchySum = {
    dials: agentsWithActivity.reduce((s, a) => s + a.dials, 0),
    reach: agentsWithActivity.reduce((s, a) => s + a.reach, 0),
    booked: agentsWithActivity.reduce((s, a) => s + a.booked, 0),
    instant: agentsWithActivity.reduce((s, a) => s + a.instant, 0),
    connects: agentsWithActivity.reduce((s, a) => s + a.connects, 0),
    missedCalls: agentsWithActivity.reduce((s, a) => s + a.missedCalls, 0)
  };
  const totalsNow = {
    activeAgents: agentsWithActivity.length,
    totalAgents: effectiveScope.agentEmails.length,
    dials: rawTotals?.dials ?? hierarchySum.dials,
    reach: rawTotals?.reach ?? hierarchySum.reach,
    booked: rawTotals?.booked ?? hierarchySum.booked,
    instant: rawTotals?.instant ?? hierarchySum.instant,
    connects: rawTotals?.connects ?? hierarchySum.connects,
    missedCalls: rawTotals?.missedCalls ?? hierarchySum.missedCalls,
    aoiUsage: Math.round(agentsWithActivity.reduce((s, a) => s + a.aoiUsage, 0) / Math.max(1, agentsWithActivity.length))
  };
  const prevTotals = prevPayload?.totals || {};
  const dialsPct = pctChange(totalsNow.dials, Number(prevTotals.dials || 0));
  const reachPct = pctChange(totalsNow.reach, Number(prevTotals.reach || 0));
  const bookedPct = pctChange(totalsNow.booked, Number(prevTotals.booked || 0));
  const instantPct = pctChange(totalsNow.instant, Number(prevTotals.instant || 0));
  const connectsPct = pctChange(totalsNow.connects, Number(prevTotals.connects || 0));
  const missedCallsPct = pctChange(totalsNow.missedCalls, Number(prevTotals.missedCalls || 0));
  const usagePct = pctChange(totalsNow.aoiUsage, Number(prevTotals.aoiUsage || 0));
  const pace = await getPaceDeltaSeries(effectiveScope.agentEmails, now);
  const deltaPct = pace.paceDeltaPct;
  const alp = await getWeeklyAlp(effectiveScope.agentEmails, now);
  const displayAgents = agentsWithActivity;
  const weeklyProductionEst = Math.max(
    Math.round(totalsNow.booked * 220),
    alp.currentWeek || 0
  );
  return {
    generatedAt: now.toISOString(),
    agencyName: "AO Intelligence",
    totals: {
      activeAgents: totalsNow.activeAgents,
      totalAgents: totalsNow.totalAgents,
      dials: totalsNow.dials,
      dialsPct: Math.abs(dialsPct.pct),
      dialsTrend: dialsPct.trend,
      reach: totalsNow.reach,
      reachPct: Math.abs(reachPct.pct),
      reachTrend: reachPct.trend,
      booked: totalsNow.booked,
      bookedPct: Math.abs(bookedPct.pct),
      bookedTrend: bookedPct.trend,
      instant: totalsNow.instant,
      instantPct: Math.abs(instantPct.pct),
      instantTrend: instantPct.trend,
      connects: totalsNow.connects,
      connectsPct: Math.abs(connectsPct.pct),
      connectsTrend: connectsPct.trend,
      missedCalls: totalsNow.missedCalls,
      missedCallsPct: Math.abs(missedCallsPct.pct),
      missedCallsTrend: missedCallsPct.trend,
      aoiUsage: totalsNow.aoiUsage,
      aoiUsagePct: Math.abs(usagePct.pct),
      aoiUsageTrend: usagePct.trend,
      deltaPct,
      weeklyProductionEst,
      previousWeeksALP: alp.previousWeek || 89e3
    },
    chart: { labels: pace.labels, series: pace.series },
    agents: displayAgents
  };
}
var tablesReady2, RAW_TOTALS_ROW_CAP, RAW_TOTALS_TIMEOUT_MS;
var init_activity_card_report_service = __esm({
  "server/activity-card-report-service.ts"() {
    "use strict";
    init_supabase();
    init_db();
    tablesReady2 = false;
    RAW_TOTALS_ROW_CAP = 6e4;
    RAW_TOTALS_TIMEOUT_MS = 8e3;
  }
});

// server/scripts/render-activity-card.ts
import * as fs2 from "fs";
import * as path2 from "path";
import OpenAI3 from "openai";
function generateHTML(payload) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AOI Activity Card</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    /* ============================================
       SECTION 1: BASE BACKGROUND & GLOBE EFFECTS
       ============================================ */
    html {
      width: 100%;
      min-height: 100vh;
      overflow-x: hidden;
      overflow-y: auto;
    }
    body {
      width: 100%;
      min-height: 100vh;
      /* Background image from template - will be set dynamically */
      background-image: url('__BACKGROUND_IMAGE_URL__');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      /* Fallback gradient if image fails to load */
      background-color: #0A0E27;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #FFFFFF;
      overflow-x: hidden;
      overflow-y: auto;
      position: relative;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 0;
      margin: 0;
    }
    
    /* Fallback gradient overlay - reduced opacity by 15% to show background more */
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(180deg, 
        #071126 0%, 
        #111f3d 36%, 
        #1a1e42 62%, 
        #101936 100%
      );
      pointer-events: none;
      z-index: -1;
      opacity: __GRADIENT_OPACITY__;
    }
    
    /* Subtle glow overlay - reduced opacity by 15% to show background more */
    body::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        radial-gradient(circle 560px at 18% 10%, rgba(37, 99, 235, 0.15) 0%, transparent 52%),
        radial-gradient(circle 520px at 80% 18%, rgba(34, 211, 238, 0.1) 0%, transparent 50%),
        radial-gradient(circle 680px at 72% 84%, rgba(139, 92, 246, 0.1) 0%, transparent 55%);
      pointer-events: none;
      z-index: 0;
      opacity: __GLOW_OPACITY__;
    }
    
    /* ============================================
       SECTION 2: MAIN CONTAINER
       ============================================ */
    .card-container {
      width: 100%;
      max-width: 1290px;
      min-height: 100vh;
      position: relative;
      padding: 40px 38px;
      z-index: 1;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
    }
    
    @media (max-width: 430px) {
      .card-container {
        padding: 20px 16px;
      }
    }
    
    /* ============================================
       SECTION 3: HEADER (Logo + Live Status)
       ============================================ */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 28px;
      padding-top: 8px;
      position: sticky;
      top: 0;
      background: #081424;
      z-index: 10;
      padding-bottom: 8px;
    }
    
    @media (max-width: 430px) {
      .header {
        margin-bottom: 16px;
        padding-top: 4px;
        padding-bottom: 4px;
      }
    }
    
    .logo-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .logo {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%);
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11.9px;
      font-weight: bold;
      color: #FFFFFF;
      box-shadow: 
        0 2px 12px rgba(20, 184, 166, 0.7),
        0 0 20px rgba(139, 92, 246, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }
    
    @media (max-width: 430px) {
      .logo {
        width: 32px;
        height: 32px;
        font-size: 18px;
        border-radius: 7px;
      }
    }
    
    .agency-name {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: #FFFFFF;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    }
    
    @media (max-width: 430px) {
      .agency-name {
        font-size: 12px;
      }
    }
    
    .time-live {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13.5px;
      color: #10B981;
      font-weight: 600;
      text-shadow: 0 1px 4px rgba(16, 185, 129, 0.4);
    }
    
    @media (max-width: 430px) {
      .time-live {
        font-size: 9px;
        gap: 4px;
      }
    }
    
    .live-dot-header {
      width: 7px;
      height: 7px;
      background: #10B981;
      border-radius: 50%;
      box-shadow: 
        0 0 8px rgba(16, 185, 129, 1),
        0 0 16px rgba(16, 185, 129, 0.8);
      animation: pulse 2s infinite;
    }
    
    @media (max-width: 430px) {
      .live-dot-header {
        width: 5px;
        height: 5px;
      }
    }
    
    /* ============================================
       SECTION 4: TITLE BLOCK
       ============================================ */
    .main-title {
      font-size: 31px;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 6px;
      letter-spacing: 1px;
      text-shadow: 0 3px 14px rgba(0, 0, 0, 0.72);
      line-height: 1.15;
    }
    
    @media (max-width: 430px) {
      .main-title {
        font-size: 32px;
        margin-bottom: 4px;
      }
    }
    
    .subtitle {
      font-size: 24px;
      color: #94A3B8;
      margin-bottom: 24px;
      font-weight: 600;
      letter-spacing: 0.4px;
      line-height: 1.4;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
    }
    
    @media (max-width: 430px) {
      .subtitle {
        font-size: 8px;
        margin-bottom: 16px;
      }
    }
    
    
    /* ============================================
       SECTION 6: KPI TILES (7 Metrics)
       ============================================ */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
      margin-bottom: 16px;
      position: sticky;
      top: 80px;
      background: #081424;
      z-index: 10;
      padding-top: 10px;
      padding-bottom: 10px;
    }
    
    @media (max-width: 430px) {
      .kpi-grid {
        top: 60px;
      }
    }
    
    @media (max-width: 430px) {
      .kpi-grid {
        gap: 6px;
        margin-bottom: 16px;
      }
    }
    
    .kpi-tile {
      background: rgba(30, 41, 59, 0.65);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 13px;
      padding: 16px 10px 14px;
      backdrop-filter: blur(18px);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 
        0 4px 14px rgba(0, 0, 0, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      position: relative;
      transition: all 0.25s ease;
    }
    
    @media (max-width: 430px) {
      .kpi-tile {
        padding: 12px 8px 10px;
        border-radius: 10px;
      }
    }
    
    /* Bottom accent glow line on each tile */
    .kpi-tile::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, 
        transparent 0%,
        rgba(20, 184, 166, 0.4) 20%,
        rgba(139, 92, 246, 0.4) 80%,
        transparent 100%
      );
      border-radius: 0 0 13px 13px;
    }
    
    .kpi-icon {
      width: 19.375px;
      height: 19.375px;
      margin-bottom: 11.25px;
      color: #7DD3FC;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.45));
    }
    
    @media (max-width: 430px) {
      .kpi-icon {
        width: 15px;
        height: 15px;
        margin-bottom: 7.5px;
      }
    }

    .kpi-icon svg {
      width: 16.25px;
      height: 16.25px;
      stroke: currentColor;
      stroke-width: 1.8;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    
    @media (max-width: 430px) {
      .kpi-icon svg {
        width: 12.5px;
        height: 12.5px;
      }
    }
    
    .kpi-label {
      font-size: 17.875px;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 7.5px;
      font-weight: 600;
    }
    
    @media (max-width: 430px) {
      .kpi-label {
        font-size: 6.875px;
        margin-bottom: 5px;
      }
    }
    
    .kpi-value {
      font-size: 41.775px;
      font-weight: 700;
      color: #FFFFFF;
      line-height: 1;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
      letter-spacing: -0.5px;
      margin-bottom: 2px;
    }
    
    @media (max-width: 430px) {
      .kpi-value {
        font-size: 12px;
      }
    }
    
    .kpi-value.dials {
      color: #14B8A6;
      text-shadow: 
        0 2px 12px rgba(20, 184, 166, 0.6),
        0 0 20px rgba(20, 184, 166, 0.3);
    }
    
    .kpi-value.reach {
      color: #14B8A6;
      text-shadow: 
        0 2px 12px rgba(20, 184, 166, 0.6),
        0 0 20px rgba(20, 184, 166, 0.3);
    }
    
    .kpi-value.booked {
      color: #8B5CF6;
      text-shadow: 
        0 2px 12px rgba(139, 92, 246, 0.6),
        0 0 20px rgba(139, 92, 246, 0.3);
    }
    
    .kpi-value.instant {
      color: #F59E0B;
      text-shadow: 
        0 2px 12px rgba(245, 158, 11, 0.6),
        0 0 20px rgba(245, 158, 11, 0.3);
    }
    
    .kpi-value.connects {
      color: #3B82F6;
      text-shadow: 
        0 2px 12px rgba(59, 130, 246, 0.6),
        0 0 20px rgba(59, 130, 246, 0.3);
    }

    .kpi-value.missed {
      color: #EF4444;
      text-shadow:
        0 2px 12px rgba(239, 68, 68, 0.65),
        0 0 20px rgba(239, 68, 68, 0.35);
    }
    
    .kpi-value.aoi {
      color: #EC4899;
      text-shadow: 
        0 2px 12px rgba(236, 72, 153, 0.6),
        0 0 20px rgba(236, 72, 153, 0.3);
    }
    
    /* ============================================
       SECTION 7: TOP AGENTS LEADERBOARD
       ============================================ */
    .leaderboard {
      background: rgba(30, 41, 59, 0.65);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 13px;
      padding: 18px 20px;
      backdrop-filter: blur(18px);
      box-shadow: 
        0 4px 16px rgba(0, 0, 0, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
      margin-bottom: 16px;
    }
    
    @media (max-width: 430px) {
      .leaderboard {
        padding: 12px 14px;
        border-radius: 10px;
        margin-bottom: 12px;
      }
    }
    
    #leaderboard-all-rows {
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y;
      flex: 1;
      min-height: 0;
    }
    
    .leaderboard-title {
      font-size: 24px;
      color: #FFFFFF;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 1.6px;
      font-weight: 800;
      text-shadow: 0 3px 12px rgba(0, 0, 0, 0.62);
      line-height: 1.3;
    }
    
    @media (max-width: 430px) {
      .leaderboard-title {
        font-size: 14px;
        margin-bottom: 12px;
      }
    }
    
    .leaderboard-section {
      margin-bottom: 4px;
      padding-left: 0;
      padding-right: 0;
      max-height: 400px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    @media (max-width: 430px) {
      .leaderboard-section {
        margin-bottom: 3px;
        padding-left: 0;
        padding-right: 0;
        max-height: 280px;
      }
    }
    
    .leaderboard-section-title {
      font-size: 15px;
      color: #14B8A6;
      margin-bottom: 14px;
      text-transform: uppercase;
      letter-spacing: 1.45px;
      font-weight: 800;
      text-shadow: 0 2px 10px rgba(20, 184, 166, 0.5);
      padding-left: 2px;
      line-height: 1.3;
    }
    
    @media (max-width: 430px) {
      .leaderboard-section-title {
        font-size: 10px;
        margin-bottom: 10px;
      }
    }
    
    .leaderboard-header {
      display: grid;
      grid-template-columns: 40px 46px 50px 35px 1fr 1fr 1fr 1fr 1fr;
      gap: 4px;
      padding: 6px 4px 6px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.32);
      font-size: 8px;
      color: #D1E3FF;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      font-weight: 800;
      margin-bottom: 6px;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    }
    
    @media (max-width: 430px) {
      .leaderboard-header {
        grid-template-columns: 30px 34.5px 40px 28px 1fr 1fr 1fr 1fr 1fr;
        gap: 3px;
        font-size: 6px;
        padding: 5px 3px 5px 0;
        margin-bottom: 5px;
      }
    }

    .metric-icon-head {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9DD7FF;
      opacity: 0.95;
      filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.4));
      width: 100%;
    }

    .metric-icon-head.missed {
      color: #F87171;
      filter: drop-shadow(0 1px 5px rgba(239, 68, 68, 0.45));
    }

    .metric-icon-head svg {
      width: 14.3px;
      height: 14.3px;
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    
    @media (max-width: 430px) {
      .metric-icon-head svg {
        width: 11px;
        height: 11px;
      }
    }

    .change-col-head {
      text-align: left;
      transform: translateX(-8px);
    }
    
    .leaderboard-row {
      display: grid;
      grid-template-columns: 40px 46px 50px 35px 1fr 1fr 1fr 1fr 1fr;
      grid-template-rows: auto 2px;
      gap: 4px;
      align-items: center;
      padding: 6px 4px 6px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.25);
      position: relative;
      border-radius: 8px;
      margin: 2px 0;
      background: linear-gradient(90deg, 
        rgba(20, 184, 166, 0.04) 0%,
        rgba(139, 92, 246, 0.06) 100%
      );
      transition: all 0.25s ease;
    }
    
    @media (max-width: 430px) {
      .leaderboard-row {
        grid-template-columns: 30px 34.5px 40px 28px 1fr 1fr 1fr 1fr 1fr;
        grid-template-rows: auto 1.5px;
        gap: 3px;
        padding: 5px 3px 5px 0;
        border-radius: 6px;
        margin: 2px 0;
      }
    }
    .rank,
    .avatar,
    .agent-name-section,
    .rank-change,
    .stat-value {
      grid-row: 1;
    }

    .row-progress {
      grid-column: 5 / 10;
      grid-row: 2;
      height: 2px;
      border-radius: 99px;
      background: rgba(148, 163, 184, 0.22);
      overflow: hidden;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35);
    }
    
    @media (max-width: 430px) {
      .row-progress {
        height: 1.5px;
      }
    }

    .row-progress-fill {
      height: 100%;
      width: 0%;
      border-radius: 99px;
      background: linear-gradient(90deg, #1D9BF0 0%, #22D3EE 48%, #8B5CF6 100%);
      box-shadow: 0 0 10px rgba(34, 211, 238, 0.45);
    }

    
    .leaderboard-row:last-child {
      border-bottom: none;
    }
    
    /* Left accent line on hover/active rows */
    .leaderboard-row::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: linear-gradient(180deg, #14B8A6 0%, #8B5CF6 100%);
      border-radius: 8px 0 0 8px;
      opacity: 0.4;
    }
    
    .rank {
      font-size: 16.5px;
      font-weight: 800;
      text-align: center;
      color: #94A3B8;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
      letter-spacing: -0.2px;
      line-height: 1;
    }
    
    @media (max-width: 430px) {
      .rank {
        font-size: 10px;
      }
    }
    
    .rank-1 {
      color: #FCD34D;
      filter: drop-shadow(0 0 10px rgba(252, 211, 77, 0.75));
      font-size: 37.4px;
      text-shadow: 0 2px 8px rgba(252, 211, 77, 0.65);
    }
    
    @media (max-width: 430px) {
      .rank-1 {
        font-size: 12px;
      }
    }
    
    .avatar {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      color: #FFFFFF;
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.42);
      box-shadow: 
        0 4px 14px rgba(0, 0, 0, 0.5),
        0 0 18px rgba(20, 184, 166, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.22);
      margin-left: 4px;
    }
    
    @media (max-width: 430px) {
      .avatar {
        width: 34.5px;
        height: 34.5px;
        font-size: 9.2px;
        margin-left: 2px;
      }
    }
    
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .agent-name-section {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5px;
      padding-left: 4px;
      min-width: 0;
      max-width: 70px;
      overflow: hidden;
    }
    
    @media (max-width: 430px) {
      .agent-name-section {
        padding-left: 3px;
        max-width: 60px;
      }
    }
    
    .agent-first,
    .agent-last {
      font-size: 5px;
      font-weight: 700;
      color: #FFFFFF;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.62);
      letter-spacing: 0.2px;
      line-height: 1.1;
      white-space: nowrap;
      word-break: keep-all;
      text-overflow: ellipsis;
      overflow: hidden;
    }
    
    @media (max-width: 430px) {
      .agent-first,
      .agent-last {
        font-size: 4px;
      }
    }

    .agent-last {
      font-weight: 800;
      color: #E2E8F0;
    }
    
    .live-text {
      font-size: 15.4px;
      color: #10B981;
      font-weight: 600;
      text-shadow: 0 1px 4px rgba(16, 185, 129, 0.5);
      letter-spacing: 0.5px;
    }
    
    .stat-value {
      font-size: 38.8125px;
      color: #E2E8F0;
      text-align: center;
      font-weight: 700;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
      letter-spacing: -0.3px;
      line-height: 1;
      padding-right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    
    .stat-value:nth-child(4) {
      padding-left: 8px;
    }
    
    @media (max-width: 430px) {
      .stat-value {
        font-size: 24.84px;
        gap: 3px;
      }
      .stat-value:nth-child(4) {
        padding-left: 6px;
      }
    }

    .stat-value:not(:last-child) {
      border-right: 1px dashed rgba(148, 163, 184, 0.35);
    }
    
    .stat-main {
      font-size: 15.625px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    
    @media (max-width: 430px) {
      .stat-main {
        font-size: 8px;
      }
    }

    .stat-main.missed {
      color: #F87171;
      text-shadow:
        0 1px 8px rgba(239, 68, 68, 0.45),
        0 0 14px rgba(239, 68, 68, 0.3);
    }

    .stat-main.usage {
      font-size: 10.3px;
      letter-spacing: 0;
    }
    
    @media (max-width: 430px) {
      .stat-main.usage {
        font-size: 7px;
      }
    }

    .rank-change {
      text-align: center;
      font-size: 14.6px;
      font-weight: 800;
      letter-spacing: -0.2px;
      line-height: 1;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
    }
    
    @media (max-width: 430px) {
      .rank-change {
        font-size: 12px;
      }
    }

    .rank-change.up {
      color: #10B981;
      filter: drop-shadow(0 0 7px rgba(16, 185, 129, 0.5));
    }

    .rank-change.down {
      color: #EF4444;
      filter: drop-shadow(0 0 7px rgba(239, 68, 68, 0.5));
    }

    .rank-change.flat {
      color: #94A3B8;
    }
    
    .live-dot {
      width: 6px;
      height: 6px;
      background: #10B981;
      border-radius: 50%;
      box-shadow: 
        0 0 8px rgba(16, 185, 129, 1),
        0 0 14px rgba(16, 185, 129, 0.7);
      animation: pulse 2s infinite;
    }
    
    .live-text {
      font-size: 15.4px;
      color: #10B981;
      font-weight: 600;
      text-shadow: 0 1px 4px rgba(16, 185, 129, 0.5);
      letter-spacing: 0.5px;
      line-height: 1.2;
    }
    
    /* ============================================
       SECTION 8: EST WEEKLY PRODUCTION PANEL
       ============================================ */
    .goal-section {
      margin-top: 4px;
      padding: 34px 28px;
      background: linear-gradient(120deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%);
      border: 1px solid rgba(56, 189, 248, 0.28);
      border-radius: 16px;
      backdrop-filter: blur(18px);
      position: sticky;
      bottom: 0;
      z-index: 10;
      box-shadow: 
        0 8px 24px rgba(0, 0, 0, 0.36),
        0 0 28px rgba(34, 211, 238, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }
    
    @media (max-width: 430px) {
      .goal-section {
        margin-top: 3px;
        padding: 20px 16px;
        border-radius: 12px;
      }
    }
    
    .goal-label {
      font-size: 8.5px;
      color: #7DD3FC;
      font-weight: 700;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      text-shadow: 0 1px 8px rgba(34, 211, 238, 0.35);
    }
    
    @media (max-width: 430px) {
      .goal-label {
        font-size: 7px;
      }
    }
    
    .goal-percent {
      font-size: 33.15px;
      color: #FFFFFF;
      font-weight: 800;
      letter-spacing: -1px;
      line-height: 1;
      text-shadow:
        0 2px 14px rgba(56, 189, 248, 0.38),
        0 2px 8px rgba(0, 0, 0, 0.55);
      text-align: right;
      margin-left: auto;
    }
    
    @media (max-width: 430px) {
      .goal-percent {
        font-size: 23.4px;
      }
    }
    
    .goal-bar {
      width: 100%;
      height: 14px;
      background: rgba(148, 163, 184, 0.24);
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 18px;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    @media (max-width: 430px) {
      .goal-bar {
        height: 10px;
        margin-bottom: 12px;
      }
    }
    
    .goal-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #22D3EE 0%, #3B82F6 55%, #8B5CF6 100%);
      border-radius: 6px;
      transition: width 0.5s;
      box-shadow: 
        0 0 14px rgba(56, 189, 248, 0.55),
        0 0 22px rgba(139, 92, 246, 0.42);
    }
    
    .goal-target {
      font-size: 13.325px;
      color: #E2E8F0;
      text-align: left;
      font-weight: 700;
      letter-spacing: 0.2px;
    }
    
    @media (max-width: 430px) {
      .goal-target {
        font-size: 10.4px;
      }
    }

    .goal-change {
      font-size: 13.325px;
      font-weight: 800;
      letter-spacing: 0.2px;
      text-shadow: 0 1px 7px rgba(0, 0, 0, 0.45);
      text-align: left;
      margin-left: 0;
    }
    
    @media (max-width: 430px) {
      .goal-change {
        font-size: 10.4px;
      }
    }

    .goal-change.up {
      color: #10B981;
      filter: drop-shadow(0 0 7px rgba(16, 185, 129, 0.5));
    }

    .goal-change.down {
      color: #EF4444;
      filter: drop-shadow(0 0 7px rgba(239, 68, 68, 0.5));
    }

    .goal-top-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 18px;
    }

    .goal-bottom-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-top: 12px;
    }
    
    /* ============================================
       SECTION 9: FOOTER
       ============================================ */
    .footer {
      margin-top: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 15px;
      border-top: 1px solid rgba(148, 163, 184, 0.2);
    }
    
    .footer-logo {
      font-size: 9.9px;
      font-weight: 600;
      color: #94A3B8;
      letter-spacing: 0.2px;
    }
    
    .footer-status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 7.15px;
      color: #10B981;
      font-weight: 500;
    }
    
    .footer-dot {
      width: 5px;
      height: 5px;
      background: #10B981;
      border-radius: 50%;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
    }
    
    /* ============================================
       ANIMATIONS - ELECTRIC & ANIMATED
       ============================================ */
    @keyframes pulse {
      0%, 100% { 
        opacity: 1; 
        transform: scale(1);
      }
      50% { 
        opacity: 0.65; 
        transform: scale(1.1);
      }
    }
    
    @keyframes electricGlow {
      0%, 100% {
        text-shadow: 
          0 4px 20px rgba(16, 185, 129, 0.9),
          0 0 40px rgba(16, 185, 129, 0.6),
          0 0 60px rgba(16, 185, 129, 0.3);
      }
      50% {
        text-shadow: 
          0 4px 30px rgba(16, 185, 129, 1),
          0 0 60px rgba(16, 185, 129, 0.8),
          0 0 90px rgba(16, 185, 129, 0.5);
      }
    }
    
    @keyframes avatarGlow {
      0%, 100% {
        box-shadow: 
          0 4px 20px rgba(0, 0, 0, 0.6),
          0 0 30px rgba(20, 184, 166, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }
      50% {
        box-shadow: 
          0 4px 25px rgba(0, 0, 0, 0.7),
          0 0 45px rgba(20, 184, 166, 0.7),
          0 0 60px rgba(139, 92, 246, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.4);
      }
    }
    
    @keyframes goldPulse {
      0%, 100% {
        filter: drop-shadow(0 0 12px rgba(252, 211, 77, 1));
      }
      50% {
        filter: drop-shadow(0 0 20px rgba(252, 211, 77, 1));
      }
    }
    
    @keyframes rowPulse {
      0%, 100% {
        background: linear-gradient(90deg, 
          rgba(20, 184, 166, 0.08) 0%,
          rgba(139, 92, 246, 0.08) 100%
        );
      }
      50% {
        background: linear-gradient(90deg, 
          rgba(20, 184, 166, 0.12) 0%,
          rgba(139, 92, 246, 0.12) 100%
        );
      }
    }
    
    @keyframes tileFloat {
      0%, 100% {
        transform: translateY(0);
        box-shadow: 
          0 4px 18px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.12);
      }
      50% {
        transform: translateY(-3px);
        box-shadow: 
          0 8px 25px rgba(0, 0, 0, 0.4),
          0 0 20px rgba(20, 184, 166, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.15);
      }
    }
  </style>
</head>
<body>
  <div class="card-container" id="card-root">
    <!-- SECTION 3: Header -->
    <div class="header">
      <div class="logo-section">
        <div class="logo">AO</div>
        <div class="agency-name">AO INTELLIGENCE</div>
      </div>
      <div class="time-live">
        <span class="live-dot-header"></span>
        <span id="time-display">1:00 PM</span>
      </div>
    </div>
    
    <!-- SECTION 6: KPI Tiles -->
    <div class="kpi-grid">
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="2.3"/><circle cx="16" cy="8" r="2.3"/><path d="M3.5 18c0-2.9 2.1-4.5 4.5-4.5s4.5 1.6 4.5 4.5"/><path d="M11.5 18c0-2.9 2.1-4.5 4.5-4.5s4.5 1.6 4.5 4.5"/></svg></div>
        <div class="kpi-value" id="kpi-agents">0/30</div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M6 3h4l2 5-2 2a17 17 0 0 0 4 4l2-2 5 2v4c0 1-1 2-2 2A16 16 0 0 1 4 5c0-1 1-2 2-2z"/></svg></div>
        <div class="kpi-value dials" id="kpi-dials">
          <span id="kpi-dials-number">0</span>
        </div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M2 12l5-5 5 5-5 5-5-5z"/><path d="M12 12l5-5 5 5-5 5-5-5z"/></svg></div>
        <div class="kpi-value reach" id="kpi-reach">
          <span id="kpi-reach-number">0</span>
        </div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 15l2.5 2.5L16 12"/></svg></div>
        <div class="kpi-value booked" id="kpi-booked">
          <span id="kpi-booked-number">0</span>
        </div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r="2.5"/></svg></div>
        <div class="kpi-value instant" id="kpi-instant">
          <span id="kpi-instant-number">0</span>
        </div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 3l-4 4 4 4"/><path d="M19 17H5"/><path d="M15 13l4 4-4 4"/></svg></div>
        <div class="kpi-value connects" id="kpi-connects">
          <span id="kpi-connects-number">0</span>
        </div>
      </div>
    </div>
    
    <!-- SECTION 7: Agency Performance Leaderboard -->
    <div class="leaderboard">
      <div class="leaderboard-section">
        <div class="leaderboard-header">
          <div></div>
          <div></div>
          <div class="metric-icon-head" title="Change"><svg viewBox="0 0 24 24"><text x="12" y="16" font-size="28" font-weight="bold" text-anchor="middle" fill="currentColor">%</text></svg></div>
          <div class="metric-icon-head" title="Dials"><svg viewBox="0 0 24 24"><path d="M6 3h4l2 5-2 2a17 17 0 0 0 4 4l2-2 5 2v4c0 1-1 2-2 2A16 16 0 0 1 4 5c0-1 1-2 2-2z"/></svg></div>
          <div class="metric-icon-head" title="Reach"><svg viewBox="0 0 24 24"><path d="M2 12l5-5 5 5-5 5-5-5z"/><path d="M12 12l5-5 5 5-5 5-5-5z"/></svg></div>
          <div class="metric-icon-head" title="Booked"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 15l2.5 2.5L16 12"/></svg></div>
          <div class="metric-icon-head" title="Instant"><svg viewBox="0 0 24 24"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r="2.5"/></svg></div>
          <div class="metric-icon-head" title="Connects"><svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 3l-4 4 4 4"/><path d="M19 17H5"/><path d="M15 13l4 4-4 4"/></svg></div>
          <div class="metric-icon-head" title="AOI Usage"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg></div>
        </div>
        <div id="leaderboard-all-rows"></div>
      </div>
    </div>
    
    <!-- SECTION 8: EST Weekly Production -->
    <div class="goal-section">
      <div class="goal-top-row">
        <div class="goal-label">EST Weekly Production</div>
        <div class="goal-percent" id="goal-percent">$0</div>
      </div>
      <div class="goal-bar">
        <div class="goal-bar-fill" id="goal-bar-fill" style="width: 0%;"></div>
      </div>
      <div class="goal-bottom-row">
        <div class="goal-target" id="goal-target">Previous Weeks ALP: $89,000</div>
        <div class="goal-change" id="goal-change">Change: +$0 (0.0%) \u25B2</div>
      </div>
    </div>
    
    <!-- SECTION 9: Footer -->
    <div class="footer">
      <div class="footer-logo">AO INTELLIGENCE</div>
      <div class="footer-status">
        <span class="footer-dot"></span>
        <span>Updated just now</span>
      </div>
    </div>
  </div>
  
  <script>
    const data = __CARD_DATA__;
    
    // Set time display
    const date = new Date(data.generatedAt);
    document.getElementById('time-display').textContent = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    
    // Set KPIs - numbers only, NO triangles, NO percentages
    const totalAgents = Number(data.totals.totalAgents || 30);
    document.getElementById('kpi-agents').textContent = \`\${data.totals.activeAgents}/\${totalAgents}\`;
    document.getElementById('kpi-dials-number').textContent = data.totals.dials.toLocaleString();
    document.getElementById('kpi-reach-number').textContent = data.totals.reach.toLocaleString();
    document.getElementById('kpi-booked-number').textContent = data.totals.booked.toLocaleString();
    document.getElementById('kpi-instant-number').textContent = data.totals.instant.toLocaleString();
    document.getElementById('kpi-connects-number').textContent = data.totals.connects.toLocaleString();
    const asCurrency = (value) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value || 0);

    const formatAoiUsage = (value) => {
      const totalMinutes = Math.max(0, Math.round(Number(value) || 0));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 0 && minutes === 0) return hours + 'H';
      if (hours > 0) return hours + 'H ' + minutes + 'M';
      return totalMinutes + 'M';
    };

    const statHTML = (value, extraClass = '') =>
      '<div class="stat-main ' + extraClass + '">' + value + '</div>';
    const formatAgentName = (name) => {
      const cleaned = String(name || '').replace(/s+/g, ' ').trim();
      if (!cleaned) return '<div class="agent-first">Unknown</div>';

      const parts = cleaned.split(' ');
      const first = parts[0] || '';
      const last = parts.length > 1 ? parts[parts.length - 1] : '';

      if (!last || first.toLowerCase() === last.toLowerCase()) {
        return '<div class="agent-first">' + first + '</div>';
      }

      return '<div class="agent-first">' + first + '</div><div class="agent-last">' + last + '</div>';
    };
    const rankChangeHTML = (changeValue) => {
      const value = Number(changeValue || 0);
      if (value > 0) {
        return '<div class="rank-change up">+' + value + ' \u25B2</div>';
      }
      if (value < 0) {
        return '<div class="rank-change down">' + value + ' \u25BC</div>';
      }
      return '<div class="rank-change flat">0</div>';
    };

    // Bottom production hero section
    const weeklyProductionEst = Number(data.totals.weeklyProductionEst || Math.round(data.totals.booked * 220));
    const previousWeeksALP = Number(data.totals.previousWeeksALP || 89000);
    const weeklyProgress = Math.min(100, Math.max(8, Math.round((weeklyProductionEst / Math.max(previousWeeksALP, 1)) * 100)));
    const weeklyChange = weeklyProductionEst - previousWeeksALP;
    const weeklyChangePct = previousWeeksALP > 0 ? (weeklyChange / previousWeeksALP) * 100 : 0;
    const weeklyUp = weeklyChange >= 0;

    document.getElementById('goal-percent').textContent = asCurrency(weeklyProductionEst);
    document.getElementById('goal-bar-fill').style.width = weeklyProgress + '%';
    document.getElementById('goal-target').textContent = 'Previous Weeks ALP: ' + asCurrency(previousWeeksALP);
    const goalChangeEl = document.getElementById('goal-change');
    goalChangeEl.textContent = 'Change: ' + (weeklyUp ? '+' : '-') + asCurrency(Math.abs(weeklyChange)) + ' (' + (weeklyUp ? '+' : '-') + Math.abs(weeklyChangePct).toFixed(1) + '%) ' + (weeklyUp ? '\u25B2' : '\u25BC');
    goalChangeEl.className = 'goal-change ' + (weeklyUp ? 'up' : 'down');
    
    // Leaderboard - weighted performance ranking:
    // dials=1, reach=10, booked=40, connects=25, instant=80
    // Show ALL active agents, sorted by performance score
    const score = (a) => (a.dials * 1) + (a.reach * 10) + (a.booked * 40) + (a.connects * 25) + (a.instant * 80);
    const sortedAgents = [...data.agents].sort((a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      if (b.booked !== a.booked) return b.booked - a.booked;
      if (b.reach !== a.reach) return b.reach - a.reach;
      return b.dials - a.dials;
    });
    
    // Build all agent rows (with scrolling)
    const allRowsEl = document.getElementById('leaderboard-all-rows');
    sortedAgents.forEach(agent => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      
      const rankClass = agent.rank === 1 ? 'rank-1' : '';
      const initials = agent.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const rowProgress = Math.max(12, Math.min(100, Math.round(agent.aoiUsage)));
      // Use agent profile picture, fallback to deterministic initials avatar (not random).
      const demoPhotoUrl = agent.photoUrl || \`https://ui-avatars.com/api/?name=\${encodeURIComponent(agent.name)}&size=256&background=0f172a&color=e2e8f0&bold=true\`;
      
      row.innerHTML = \`
        <div class="rank \${rankClass}">#\${agent.rank}</div>
        <div class="avatar">
          <img src="\${demoPhotoUrl}" alt="\${agent.name}" onerror="this.parentElement.innerHTML='\${initials}'; this.parentElement.style.background='linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)';" />
        </div>
        \${rankChangeHTML(agent.rankChange)}
        <div class="stat-value">\${statHTML(agent.dials)}</div>
        <div class="stat-value">\${statHTML(agent.reach)}</div>
        <div class="stat-value">\${statHTML(agent.booked)}</div>
        <div class="stat-value">\${statHTML(agent.instant)}</div>
        <div class="stat-value">\${statHTML(agent.connects)}</div>
        <div class="stat-value">\${statHTML(formatAoiUsage(agent.aoiUsage), 'usage')}</div>
        <div class="row-progress">
          <div class="row-progress-fill" style="width: \${rowProgress}%"></div>
        </div>
      \`;
      
      allRowsEl.appendChild(row);
    });
    
    // Mark as ready
    document.getElementById('card-root').setAttribute('data-ready', 'true');
  </script>
</body>
</html>`;
  const dataJson = JSON.stringify(payload);
  return html.replace("__CARD_DATA__", dataJson);
}
async function generateBackgroundTemplate() {
  try {
    const { OPENAI_API_KEY: OPENAI_API_KEY2 } = await Promise.resolve().then(() => (init_hardcoded_config(), hardcoded_config_exports));
    const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY2;
    if (!apiKey) {
      console.log("[bg] OpenAI API key not set, using gradient background");
      return null;
    }
    const openai = new OpenAI3({ apiKey });
    const prompt = `Create a premium, high-contrast, futuristic dashboard background for a business analytics card.

Visual direction:
- cinematic dark navy base (#081327 to #111c35), not flat
- layered depth with soft glass panels, subtle light rays, and controlled neon accents
- accent colors: cyan/teal (#22d3ee, #14b8a6) and violet (#8b5cf6)
- abstract data-tech motif: fine grid traces, geometric lines, and atmospheric particles
- polished enterprise quality (not cartoon, not noisy)

Hard constraints:
- NO text, NO numbers, NO logos, NO UI widgets
- keep central and lower-mid regions clean for overlaying metrics
- avoid heavy bloom over important content zones
- portrait composition suitable for 1290x2796 output`;
    console.log("[bg] Generating background template with OpenAI...");
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1792",
      // DALL-E 3 max size, we'll scale it
      quality: "standard",
      n: 1
    });
    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      console.log("[bg] No image URL returned from OpenAI");
      return null;
    }
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tempDir = path2.join(process.cwd(), "temp");
    if (!fs2.existsSync(tempDir)) {
      fs2.mkdirSync(tempDir, { recursive: true });
    }
    const bgPath = path2.join(tempDir, `activity-card-bg-${Date.now()}.png`);
    fs2.writeFileSync(bgPath, buffer);
    console.log("[bg] Background template generated:", bgPath);
    return bgPath;
  } catch (error) {
    console.error("[bg] Failed to generate background template:", error.message);
    return null;
  }
}
async function renderCardToPNG(payload, outputPath, backgroundImagePath) {
  let browser = null;
  try {
    const { chromium } = await import("playwright");
    console.log("[render] Launching browser...");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1290, height: 2796 },
      deviceScaleFactor: 3
      // Maximum crispness
    });
    const possiblePaths = [
      path2.join(process.cwd(), "..", "temp", "activity-card-bg-template.png"),
      // From server/scripts -> ../temp
      path2.join(process.cwd(), "temp", "activity-card-bg-template.png"),
      // From server -> temp
      backgroundImagePath
      // Use provided path if exists
    ].filter(Boolean);
    let bgImagePath = null;
    for (const testPath of possiblePaths) {
      if (testPath && fs2.existsSync(testPath)) {
        bgImagePath = testPath;
        console.log("\u2705 Using template background image:", bgImagePath);
        break;
      }
    }
    if (!bgImagePath) {
      console.log("\u26A0\uFE0F Template background not found at any expected location, checking cache or generating new...");
      const cachedBgPath = path2.join(process.cwd(), "temp", "activity-card-bg-template.png");
      if (fs2.existsSync(cachedBgPath)) {
        console.log("\u{1F4E6} Using cached background template");
        bgImagePath = cachedBgPath;
      } else {
        bgImagePath = await generateBackgroundTemplate();
      }
    }
    let html = generateHTML(payload);
    if (bgImagePath && fs2.existsSync(bgImagePath)) {
      const bgBuffer = fs2.readFileSync(bgImagePath);
      const bgBase64 = bgBuffer.toString("base64");
      const bgDataUrl = `data:image/png;base64,${bgBase64}`;
      html = html.replace(/__BACKGROUND_IMAGE_URL__/g, bgDataUrl);
      html = html.replace(/__GRADIENT_OPACITY__/g, "0.24");
      html = html.replace(/__GLOW_OPACITY__/g, "0.3");
      console.log("\u2705 Background image embedded with balanced overlay for readability");
    } else {
      html = html.replace(/background-image: url\('__BACKGROUND_IMAGE_URL__'\);/g, "");
      html = html.replace(/url\('__BACKGROUND_IMAGE_URL__'/g, "transparent");
      html = html.replace(/__GRADIENT_OPACITY__/g, "0.95");
      html = html.replace(/__GLOW_OPACITY__/g, "0.9");
      console.log("\u26A0\uFE0F No background image, using gradient fallback");
    }
    console.log("[render] Loading HTML template...");
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(resolve);
        } else {
          setTimeout(resolve, 1500);
        }
      });
    });
    console.log("[render] Waiting for card to render...");
    await page.waitForSelector('#card-root[data-ready="true"]', { timeout: 8e3 });
    console.log("[render] Taking screenshot...");
    const cardElement = page.locator("#card-root");
    await cardElement.screenshot({
      path: outputPath,
      type: "png"
    });
    console.log(`[render] Card rendered to: ${outputPath}`);
  } catch (error) {
    console.error("[render] Failed to render card:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
async function generatePayloadFromData() {
  console.log("[card] Generating activity card from live data...");
  const payload = await buildActivityCardPayload();
  return payload;
}
async function renderActivityCard(outputDir, precomputedPayload) {
  const outputPath = outputDir ? path2.join(outputDir, `activity-card-${Date.now()}.png`) : path2.join(process.cwd(), "temp", `activity-card-${Date.now()}.png`);
  const dir = path2.dirname(outputPath);
  if (!fs2.existsSync(dir)) {
    fs2.mkdirSync(dir, { recursive: true });
  }
  const payload = precomputedPayload || await generatePayloadFromData();
  const templateBgPath = path2.join(process.cwd(), "..", "temp", "activity-card-bg-template.png");
  const altTemplatePath = path2.join(process.cwd(), "temp", "activity-card-bg-template.png");
  let bgImagePath = null;
  if (fs2.existsSync(templateBgPath)) {
    bgImagePath = templateBgPath;
    console.log("\u2705 Using template background from:", templateBgPath);
  } else if (fs2.existsSync(altTemplatePath)) {
    bgImagePath = altTemplatePath;
    console.log("\u2705 Using template background from:", altTemplatePath);
  } else {
    console.log("\u26A0\uFE0F Template background not found, generating new one...");
    bgImagePath = await generateBackgroundTemplate();
  }
  await renderCardToPNG(payload, outputPath, bgImagePath);
  try {
    console.log("[upload] Uploading to Supabase hourly-reports bucket...");
    const fileName = `activity-card-${Date.now()}.png`;
    const fileBuffer = fs2.readFileSync(outputPath);
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage.from("hourly-reports").upload(fileName, fileBuffer, {
      contentType: "image/png",
      upsert: true
    });
    if (uploadError) {
      console.error("[upload] Failed to upload to Supabase:", uploadError);
      console.log("[upload] Trying installers bucket as fallback...");
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin.storage.from("installers").upload(`hourly-reports/${fileName}`, fileBuffer, {
        contentType: "image/png",
        upsert: true
      });
      if (fallbackError) {
        console.error("[upload] Failed to upload to fallback bucket:", fallbackError);
      } else {
        console.log("[upload] Uploaded to installers bucket fallback");
      }
    } else {
      console.log("[upload] Uploaded to Supabase hourly-reports bucket:", fileName);
      const { data: publicUrlData } = supabaseAdmin.storage.from("hourly-reports").getPublicUrl(fileName);
      if (publicUrlData?.publicUrl) {
        console.log("[upload] Public URL:", publicUrlData.publicUrl);
      }
    }
  } catch (error) {
    console.error("[upload] Error uploading to Supabase:", error.message);
  }
  return outputPath;
}
var init_render_activity_card = __esm({
  "server/scripts/render-activity-card.ts"() {
    "use strict";
    init_supabase();
    init_activity_card_report_service();
  }
});

// server/activity-card-delivery-service.ts
import * as fs3 from "fs";
import * as path3 from "path";
import sharp from "sharp";
import twilio5 from "twilio";
async function uploadCompressedCard(imagePath) {
  const compressedPath = imagePath.replace(/\.png$/i, "-compressed.jpg");
  await sharp(imagePath).jpeg({ quality: 62, mozjpeg: true }).toFile(compressedPath);
  const fileBuffer = await fs3.promises.readFile(compressedPath);
  const key = `hourly-reports/${path3.basename(compressedPath, ".jpg")}-${Date.now()}.jpg`;
  const { error } = await supabaseAdmin.storage.from("installers").upload(key, fileBuffer, {
    contentType: "image/jpeg",
    upsert: true
  });
  if (error) throw new Error(`Failed to upload compressed card: ${error.message}`);
  const { data } = supabaseAdmin.storage.from("installers").getPublicUrl(key);
  if (!data?.publicUrl) throw new Error("Failed to resolve public URL for compressed card");
  return { localCompressedPath: compressedPath, publicUrl: data.publicUrl };
}
async function runChrisHierarchyActivityCardReport(options) {
  const dryRun = !!options?.dryRun;
  const trigger = options?.trigger || "manual";
  const errors = [];
  const { scope, recipients } = await resolveChrisRecipients();
  const runId = await createRunRecord(scope.scopeKey);
  try {
    const payload = await buildActivityCardPayload(scope);
    const outputPath = await renderActivityCard(void 0, payload);
    const { publicUrl } = await uploadCompressedCard(outputPath);
    await updateRunRecord(runId, {
      status: dryRun ? "dry_run_completed" : "completed",
      generatedImagePath: outputPath,
      generatedImageUrl: publicUrl,
      payload,
      agentRanks: Object.fromEntries(payload.agents.map((a) => [a.name.toLowerCase(), a.rank]))
    });
    if (dryRun) {
      return { runId, outputPath, uploadedUrl: publicUrl, emailSent: 0, mmsSent: 0, errors };
    }
    let emailSent = 0;
    let mmsSent = 0;
    const twilioClient = twilio5(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    for (const recipient of recipients) {
      if (recipient.email) {
        const deliveryId = await createDeliveryRecord(runId, recipient, "email");
        try {
          const sent = await sendEmail2({
            to: recipient.email,
            subject: `AO Intelligence Activity Card (${trigger})`,
            html: `
              <div style="font-family: Arial, sans-serif;">
                <h2>AO Intelligence Activity Card</h2>
                <p>Hi ${recipient.fullName},</p>
                <p>Your latest hierarchy activity card is ready.</p>
                <p><a href="${publicUrl}">Open Image</a></p>
                <p>Generated at: ${new Date(payload.generatedAt).toLocaleString()}</p>
              </div>
            `
          });
          if (!sent) throw new Error("Email provider returned false");
          await updateDeliveryRecord(deliveryId, { status: "delivered" });
          emailSent++;
        } catch (e) {
          const msg = `email:${recipient.email} -> ${e?.message || e}`;
          errors.push(msg);
          await updateDeliveryRecord(deliveryId, { status: "failed", errorMessage: msg });
        }
      }
      if (recipient.phone) {
        const deliveryId = await createDeliveryRecord(runId, recipient, "mms");
        try {
          const message = await twilioClient.messages.create({
            from: TWILIO_PHONE_NUMBER,
            to: recipient.phone.startsWith("+") ? recipient.phone : `+1${recipient.phone.replace(/\D/g, "")}`,
            body: "AO Intelligence Activity Card",
            mediaUrl: [publicUrl]
          });
          await updateDeliveryRecord(deliveryId, { status: message.status || "sent", providerSid: message.sid });
          mmsSent++;
        } catch (e) {
          const msg = `mms:${recipient.phone} -> ${e?.message || e}`;
          errors.push(msg);
          await updateDeliveryRecord(deliveryId, {
            status: "failed",
            errorMessage: msg,
            errorCode: e?.code ? String(e.code) : void 0
          });
        }
      }
    }
    return { runId, outputPath, uploadedUrl: publicUrl, emailSent, mmsSent, errors };
  } catch (e) {
    await updateRunRecord(runId, { status: "failed", errorMessage: e?.message || String(e) });
    throw e;
  }
}
var init_activity_card_delivery_service = __esm({
  "server/activity-card-delivery-service.ts"() {
    "use strict";
    init_supabase();
    init_email();
    init_hardcoded_config();
    init_activity_card_report_service();
    init_render_activity_card();
  }
});

// server/activity-card-report-scheduler.ts
var activity_card_report_scheduler_exports = {};
__export(activity_card_report_scheduler_exports, {
  ActivityCardReportScheduler: () => ActivityCardReportScheduler,
  activityCardReportScheduler: () => activityCardReportScheduler
});
import * as cron10 from "node-cron";
var ActivityCardReportScheduler, activityCardReportScheduler;
var init_activity_card_report_scheduler = __esm({
  "server/activity-card-report-scheduler.ts"() {
    "use strict";
    init_activity_card_delivery_service();
    ActivityCardReportScheduler = class {
      cronJob = null;
      isRunning = false;
      start() {
        if (this.isRunning) return;
        this.cronJob = cron10.schedule(
          "0 9,12,15 * * 1-5",
          async () => {
            try {
              console.log("\u23F0 Activity card scheduler trigger fired");
              const result = await runChrisHierarchyActivityCardReport({ trigger: "scheduler" });
              console.log(`\u2705 Activity card sent (run=${result.runId}) email=${result.emailSent} mms=${result.mmsSent} errors=${result.errors.length}`);
            } catch (error) {
              console.error("\u274C Activity card scheduler run failed:", error?.message || error);
            }
          },
          {
            scheduled: true,
            timezone: "America/Los_Angeles"
          }
        );
        this.isRunning = true;
        console.log("\u2705 Activity card report scheduler started (Mon-Fri 9:00/12:00/15:00 PST)");
      }
      stop() {
        if (this.cronJob) {
          this.cronJob.stop();
          this.cronJob = null;
        }
        this.isRunning = false;
      }
    };
    activityCardReportScheduler = new ActivityCardReportScheduler();
  }
});

// server/timezone-helper.ts
function getTimezoneForState2(state) {
  const upperState = state?.toUpperCase().trim();
  return STATE_TIMEZONES[upperState] || "America/New_York";
}
function getTimezoneAbbr(state) {
  const timezone = getTimezoneForState2(state);
  if (timezone.includes("New_York") || timezone.includes("Detroit") || timezone.includes("Indiana") || timezone.includes("Kentucky")) {
    return "ET";
  } else if (timezone.includes("Chicago") || timezone.includes("North_Dakota")) {
    return "CT";
  } else if (timezone.includes("Denver") || timezone.includes("Boise")) {
    return "MT";
  } else if (timezone === "America/Phoenix") {
    return "MST";
  } else if (timezone.includes("Los_Angeles")) {
    return "PT";
  } else if (timezone.includes("Anchorage")) {
    return "AKT";
  } else if (timezone.includes("Honolulu")) {
    return "HST";
  }
  return "ET";
}
function isSafeToCall(state) {
  const timezone = getTimezoneForState2(state);
  const now = /* @__PURE__ */ new Date();
  const leadTimeString = now.toLocaleString("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  const leadHour = parseInt(now.toLocaleString("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false
  }));
  if (leadHour < 8) {
    return {
      safe: false,
      reason: `Too early (before 8 AM ${getTimezoneAbbr(state)})`,
      leadLocalTime: leadTimeString,
      leadHour
    };
  }
  if (leadHour >= 21) {
    return {
      safe: false,
      reason: `Too late (after 9 PM ${getTimezoneAbbr(state)})`,
      leadLocalTime: leadTimeString,
      leadHour
    };
  }
  return {
    safe: true,
    leadLocalTime: leadTimeString,
    leadHour
  };
}
async function countCallableLeads(_supabaseClient, agentEmail) {
  try {
    const email = String(agentEmail || "").trim().toLowerCase();
    if (!email) return 0;
    const r = await pool.query(
      `SELECT COUNT(*)::text AS c
       FROM masterlead
       WHERE LOWER(TRIM(COALESCE(cn_email, ''))) = $1
         AND COALESCE(dnc::text, 'false') IN ('false', 'f', '0', '')
         AND (
           taalk_market IS NULL
           OR LOWER(TRIM(taalk_market)) NOT IN ('plus lead', 'plus leads')
         )
        AND COALESCE("TaalkResolve"::text, '') NOT IN ('true', '1')
         AND (
           cnresolution IS NULL
           OR LOWER(TRIM(cnresolution)) IN ('pending', 'called', 'no_answer_vm', 'new')
         )`,
      [email]
    );
    return Number(r.rows[0]?.c || 0);
  } catch (error) {
    console.error(`\u274C Error in countCallableLeads for ${agentEmail}:`, error);
    return 0;
  }
}
var STATE_TIMEZONES;
var init_timezone_helper = __esm({
  "server/timezone-helper.ts"() {
    "use strict";
    init_db();
    STATE_TIMEZONES = {
      // Eastern Time
      "CT": "America/New_York",
      "DE": "America/New_York",
      "FL": "America/New_York",
      "GA": "America/New_York",
      "MA": "America/New_York",
      "MD": "America/New_York",
      "ME": "America/New_York",
      "NC": "America/New_York",
      "NH": "America/New_York",
      "NJ": "America/New_York",
      "NY": "America/New_York",
      "OH": "America/New_York",
      "PA": "America/New_York",
      "RI": "America/New_York",
      "SC": "America/New_York",
      "VA": "America/New_York",
      "VT": "America/New_York",
      "WV": "America/New_York",
      "MI": "America/Detroit",
      "IN": "America/Indiana/Indianapolis",
      "KY": "America/Kentucky/Louisville",
      // Central Time
      "AL": "America/Chicago",
      "AR": "America/Chicago",
      "IA": "America/Chicago",
      "IL": "America/Chicago",
      "KS": "America/Chicago",
      "LA": "America/Chicago",
      "MN": "America/Chicago",
      "MO": "America/Chicago",
      "MS": "America/Chicago",
      "NE": "America/Chicago",
      "OK": "America/Chicago",
      "SD": "America/Chicago",
      "TN": "America/Chicago",
      "TX": "America/Chicago",
      "WI": "America/Chicago",
      "ND": "America/North_Dakota/Center",
      // Mountain Time
      "AZ": "America/Phoenix",
      // Arizona doesn't observe DST
      "CO": "America/Denver",
      "ID": "America/Boise",
      "MT": "America/Denver",
      "NM": "America/Denver",
      "UT": "America/Denver",
      "WY": "America/Denver",
      // Pacific Time
      "CA": "America/Los_Angeles",
      "NV": "America/Los_Angeles",
      "OR": "America/Los_Angeles",
      "WA": "America/Los_Angeles",
      // Alaska
      "AK": "America/Anchorage",
      // Hawaii
      "HI": "America/Honolulu"
    };
  }
});

// server/lead-assignment-scheduler.ts
var lead_assignment_scheduler_exports = {};
__export(lead_assignment_scheduler_exports, {
  leadAssignmentScheduler: () => leadAssignmentScheduler
});
import * as cron11 from "node-cron";
function parseProfileArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v ?? "").trim()).filter(Boolean);
      }
    } catch {
    }
    return trimmed.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return [];
}
function getCustomerStates(customerData) {
  const raw = parseProfileArray(customerData?.states ?? customerData?.licensed_states);
  return raw.map((s) => s.toUpperCase().trim()).filter(Boolean);
}
function getCustomerMarkets(customerData) {
  const raw = parseProfileArray(customerData?.market ?? customerData?.taalk_market);
  return raw.map((m) => m.trim()).filter(Boolean);
}
var FTC_TIMEZONE_RECYCLING_ENABLED, AUTO_TOPUP_ENABLED, LEAD_CAP, LEAD_RECYCLE_AFTER_MS, LeadAssignmentScheduler, leadAssignmentScheduler;
var init_lead_assignment_scheduler = __esm({
  "server/lead-assignment-scheduler.ts"() {
    "use strict";
    init_supabase();
    init_local_masterlead_client();
    init_timezone_helper();
    FTC_TIMEZONE_RECYCLING_ENABLED = true;
    AUTO_TOPUP_ENABLED = String(process.env.LEAD_AUTO_TOPUP_ENABLED || "true").toLowerCase() !== "false";
    LEAD_CAP = 300;
    LEAD_RECYCLE_AFTER_MS = Number(process.env.LEAD_RECYCLE_AFTER_MS || 2 * 60 * 60 * 1e3);
    LeadAssignmentScheduler = class {
      midnightResetTask = null;
      continuousAssignmentTask = null;
      leadRecyclingTask = null;
      startScheduler() {
        console.log("\u{1F504} Starting Lead Assignment Scheduler...");
        this.midnightResetTask = cron11.schedule("0 0 * * *", async () => {
          console.log("\u{1F319} MIDNIGHT RESET: Starting daily lead unassignment...");
          await this.midnightReset();
        });
        if (AUTO_TOPUP_ENABLED) {
          this.continuousAssignmentTask = cron11.schedule("*/30 * * * *", async () => {
            console.log("\u{1F4E6} AUTO TOP-UP: Starting periodic lead refill for today-active agents...");
            await this.topUpActiveAgentsToday();
          });
        } else {
          this.continuousAssignmentTask = null;
          console.log("\u23ED\uFE0F AUTO TOP-UP disabled via LEAD_AUTO_TOPUP_ENABLED=false");
        }
        this.leadRecyclingTask = cron11.schedule("*/5 * * * *", async () => {
          console.log("\u267B\uFE0F LEAD RECYCLING: Starting periodic lead recycling and limit enforcement...");
          await this.recycleCalledLeads();
          await this.enforceLeadCap();
        });
        console.log("\u2705 Lead Assignment Scheduler started");
        console.log("   - Midnight reset: Daily at 12:00 AM");
        console.log("   - Lead recycling: Every 5 minutes");
        console.log(`   - Lead cap enforcement (${LEAD_CAP}): Every 5 minutes`);
        console.log(`   - Auto top-up: ${AUTO_TOPUP_ENABLED ? "Every 30 minutes (enabled)" : "Disabled"}`);
        if (AUTO_TOPUP_ENABLED) {
          setTimeout(() => {
            this.topUpActiveAgentsToday().catch((error) => {
              console.error("\u274C Startup top-up pass failed:", error);
            });
          }, 2e3);
        }
      }
      /**
       * MIDNIGHT RESET
       * Unassigns all pending/called/null leads and saves assignment history
       */
      async midnightReset() {
        try {
          if (!supabaseAdmin) {
            console.error("\u274C Supabase not available");
            return;
          }
          const { data: leadsToReset, error: fetchError } = await masterleadClient2.from("masterlead").select("id, cn_email, cnresolution").not("cn_email", "is", null).or("cnresolution.eq.pending,cnresolution.eq.called,cnresolution.is.null");
          if (fetchError) {
            console.error("\u274C Error fetching leads for reset:", fetchError);
            return;
          }
          if (!leadsToReset || leadsToReset.length === 0) {
            console.log("\u2705 No leads to reset");
            return;
          }
          console.log(`\u{1F4CA} Found ${leadsToReset.length} leads to unassign`);
          const { data: updatedLeads, error: updateError } = await masterleadClient2.from("masterlead").update({
            previous_cn_email: supabaseAdmin.sql`cn_email`,
            last_assigned_date: (/* @__PURE__ */ new Date()).toISOString(),
            cn_email: null,
            cnresolution: supabaseAdmin.sql`CASE 
            WHEN cnresolution IS NULL THEN 'pending'
            WHEN cnresolution = 'called' THEN 'pending'
            ELSE cnresolution
          END`
          }).not("cn_email", "is", null).or("cnresolution.eq.pending,cnresolution.eq.called,cnresolution.is.null");
          if (updateError) {
            console.error("\u274C Error updating leads:", updateError);
            return;
          }
          console.log(`\u2705 MIDNIGHT RESET COMPLETE: ${leadsToReset.length} leads unassigned and reset to pending`);
        } catch (error) {
          console.error("\u274C Midnight reset error:", error);
        }
      }
      /**
       * CONTINUOUS ASSIGNMENT
       * Checks active agents and fills them to lead cap when below cap
       */
      async continuousAssignment() {
        try {
          if (!supabaseAdmin) {
            console.error("\u274C Supabase not available");
            return;
          }
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1e3);
          const { data: recentCalls, error: callsError } = await supabaseAdmin.from("twilio_call_logs").select("owner_email").gte("created_at", twoHoursAgo.toISOString()).not("owner_email", "is", null);
          if (callsError) {
            console.error("\u274C Error fetching recent calls:", callsError);
            return;
          }
          const activeEmails = [...new Set(recentCalls?.map((c) => c.owner_email) || [])];
          const activeAgents = activeEmails.map((email) => ({ agentEmail: email }));
          if (!activeAgents || activeAgents.length === 0) {
            console.log("\u26A0\uFE0F No agents with Twilio calls in last 2 hours");
            return;
          }
          console.log(`\u{1F465} Checking ${activeAgents.length} agents with Twilio calls in last 2 hours...`);
          const { data: allAssignedLeads } = await masterleadClient2.from("masterlead").select("cn_email").not("cn_email", "is", null).or("cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called,cnresolution.eq.").limit(1e5);
          const inactiveAgents = [...new Set(allAssignedLeads?.map((l) => l.cn_email).filter((email) => !activeEmails.includes(email)) || [])];
          let totalUnassignedFromInactive = 0;
          for (const inactiveEmail of inactiveAgents) {
            const { data: leadsToUnassign } = await masterleadClient2.from("masterlead").select("id").eq("cn_email", inactiveEmail).or("cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called,cnresolution.eq.").eq("dnc", false);
            if (leadsToUnassign && leadsToUnassign.length > 0) {
              const { error: unassignError } = await masterleadClient2.from("masterlead").update({
                previous_cn_email: inactiveEmail,
                last_assigned_date: (/* @__PURE__ */ new Date()).toISOString(),
                cn_email: null,
                assigned_date: null,
                cnresolution: "pending"
              }).in("id", leadsToUnassign.map((l) => l.id));
              if (!unassignError) {
                totalUnassignedFromInactive += leadsToUnassign.length;
                console.log(`\u{1F6AB} Unassigned ${leadsToUnassign.length} leads from inactive agent ${inactiveEmail}`);
              }
            }
          }
          if (totalUnassignedFromInactive > 0) {
            console.log(`\u2705 Unassigned ${totalUnassignedFromInactive} total leads from ${inactiveAgents.length} inactive agents`);
          }
          let assignedAgents = 0;
          let totalLeadsAssigned = 0;
          for (const agent of activeAgents) {
            const agentEmail = agent.agentEmail;
            const currentCallableLeads = await countCallableLeads(supabaseAdmin, agentEmail);
            if (currentCallableLeads > LEAD_CAP) {
              const excessLeads = currentCallableLeads - LEAD_CAP;
              console.log(`\u{1F6A8} EXCESS LEADS: ${agentEmail} has ${currentCallableLeads} pending leads (OVER LIMIT). Unassigning ${excessLeads}...`);
              const { data: leadsToUnassign } = await masterleadClient2.from("masterlead").select("id, currently_calling").eq("cn_email", agentEmail).or("cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called,cnresolution.eq.").eq("dnc", false).or("currently_calling.is.null,currently_calling.eq.false").order("assigned_date", { ascending: true, nullsFirst: true }).limit(excessLeads);
              if (leadsToUnassign && leadsToUnassign.length > 0) {
                const { error: unassignError } = await masterleadClient2.from("masterlead").update({
                  previous_cn_email: agentEmail,
                  last_assigned_date: (/* @__PURE__ */ new Date()).toISOString(),
                  cn_email: null,
                  assigned_date: null,
                  cnresolution: "pending"
                  // Reset back to pending when unassigning
                }).in("id", leadsToUnassign.map((l) => l.id));
                if (unassignError) throw unassignError;
                console.log(`   \u2705 Unassigned ${leadsToUnassign.length} excess leads from ${agentEmail}`);
              }
            } else if (currentCallableLeads < LEAD_CAP) {
              const leadsNeeded = LEAD_CAP - currentCallableLeads;
              console.log(`\u{1F4E4} ASSIGNING: ${agentEmail} has ${currentCallableLeads} callable leads, adding ${leadsNeeded} to reach ${LEAD_CAP}...`);
              const { data: customerData } = await supabaseAdmin.from("customers").select("states, market, licensed_states, taalk_market").or(`company_email.eq.${agentEmail},personal_email.eq.${agentEmail}`).maybeSingle();
              const customerStates = getCustomerStates(customerData);
              const customerMarkets = getCustomerMarkets(customerData);
              if (customerStates.length === 0 || customerMarkets.length === 0) {
                console.warn(
                  `\u26A0\uFE0F SKIP ASSIGN: ${agentEmail} missing states/market profile (states=${JSON.stringify(customerStates)}, markets=${JSON.stringify(customerMarkets)})`
                );
                continue;
              }
              const leadsAssigned = await this.assignLeadsToAgent(
                agentEmail,
                customerStates,
                customerMarkets,
                leadsNeeded
              );
              if (leadsAssigned > 0) {
                assignedAgents++;
                totalLeadsAssigned += leadsAssigned;
                console.log(`\u2705 Assigned ${leadsAssigned} leads to ${agentEmail}`);
              }
            } else {
              console.log(`\u23ED\uFE0F SKIPPED: ${agentEmail} has ${currentCallableLeads} callable leads`);
            }
          }
          console.log(`\u2705 CONTINUOUS ASSIGNMENT COMPLETE: ${totalLeadsAssigned} leads assigned to ${assignedAgents} agents`);
        } catch (error) {
          console.error("\u274C Continuous assignment error:", error);
        }
      }
      /**
       * TODAY-ACTIVE TOP-UP
       * Finds agents who made at least one outbound/inbound call today and fills them to lead cap.
       * Uses the same Leadsync assignment webhook logic as other top-up paths.
       */
      async topUpActiveAgentsToday() {
        try {
          if (!supabaseAdmin) {
            console.error("\u274C Supabase not available");
            return;
          }
          const dayStart = /* @__PURE__ */ new Date();
          dayStart.setHours(0, 0, 0, 0);
          const { data: todayCalls, error: callsError } = await supabaseAdmin.from("twilio_call_logs").select("owner_email").gte("call_started_at", dayStart.toISOString()).not("owner_email", "is", null);
          if (callsError) {
            console.error("\u274C Error fetching today calls for top-up:", callsError);
            return;
          }
          const activeEmails = [...new Set((todayCalls || []).map((c) => String(c.owner_email || "").toLowerCase().trim()).filter(Boolean))];
          if (activeEmails.length === 0) {
            console.log("\u23ED\uFE0F AUTO TOP-UP: No agents with calls today");
            return;
          }
          console.log(`\u{1F465} AUTO TOP-UP: Found ${activeEmails.length} today-active agents`);
          let assignedAgents = 0;
          let totalLeadsAssigned = 0;
          for (const agentEmail of activeEmails) {
            const currentCallableLeads = await countCallableLeads(supabaseAdmin, agentEmail);
            if (currentCallableLeads >= LEAD_CAP) {
              console.log(`\u23ED\uFE0F SKIPPED: ${agentEmail} has ${currentCallableLeads} callable leads`);
              continue;
            }
            const leadsNeeded = LEAD_CAP - currentCallableLeads;
            console.log(`\u{1F4E4} ASSIGNING: ${agentEmail} has ${currentCallableLeads} callable leads, adding ${leadsNeeded} to reach ${LEAD_CAP}...`);
            const { data: customerData } = await supabaseAdmin.from("customers").select("states, market, licensed_states, taalk_market").or(`company_email.eq.${agentEmail},personal_email.eq.${agentEmail}`).maybeSingle();
            const customerStates = getCustomerStates(customerData);
            const customerMarkets = getCustomerMarkets(customerData);
            if (customerStates.length === 0 || customerMarkets.length === 0) {
              console.warn(
                `\u26A0\uFE0F SKIP ASSIGN: ${agentEmail} missing states/market profile (states=${JSON.stringify(customerStates)}, markets=${JSON.stringify(customerMarkets)})`
              );
              continue;
            }
            const leadsAssigned = await this.assignLeadsToAgent(
              agentEmail,
              customerStates,
              customerMarkets,
              leadsNeeded
            );
            if (leadsAssigned > 0) {
              assignedAgents++;
              totalLeadsAssigned += leadsAssigned;
              console.log(`\u2705 Assigned ${leadsAssigned} leads to ${agentEmail}`);
            }
          }
          console.log(`\u2705 AUTO TOP-UP COMPLETE (today-active): ${totalLeadsAssigned} leads assigned to ${assignedAgents} agents`);
        } catch (error) {
          console.error("\u274C Today-active auto top-up error:", error);
        }
      }
      /**
       * Assign leads to a specific agent based on territory and market matching
       */
      async assignLeadsToAgent(agentEmail, licensedStates, markets, count2) {
        try {
          if (!supabaseAdmin) return 0;
          const currentCallable = await countCallableLeads(supabaseAdmin, agentEmail.toLowerCase());
          console.warn(
            `LEADSYNC DISABLED: lead-assignment-scheduler skipped old bulk assignment for ${agentEmail} (current: ${currentCallable}, would have requested: ${count2})`
          );
          return 0;
        } catch (error) {
          console.error(`\u274C Error in assignLeadsToAgent for ${agentEmail}:`, error);
          return 0;
        }
      }
      /**
       * LEAD RECYCLING
       * Recycles called/no-answer/voicemail leads and ensures agents never exceed lead cap
       * Runs every 30 minutes
       * Can also be called manually via admin endpoint
       */
      async recycleCalledLeads() {
        try {
          if (!supabaseAdmin) {
            console.error("\u274C Supabase not available");
            return { recycled: 0, unassigned: 0, agentsProcessed: 0 };
          }
          const recycleCutoff = new Date(Date.now() - LEAD_RECYCLE_AFTER_MS).toISOString();
          console.log("\u267B\uFE0F Starting lead recycling process...");
          console.log("\u{1F50D} Checking Supabase connection...", !!supabaseAdmin);
          const { data: agentData, error: fetchError } = await masterleadClient2.from("masterlead").select("cn_email").not("cn_email", "is", null).neq("cn_email", "").eq("dnc", false).lt("updated_at", recycleCutoff).limit(1e5);
          console.log("\u{1F4CA} Query result:", {
            hasData: !!agentData,
            dataLength: agentData?.length || 0,
            hasError: !!fetchError,
            error: fetchError?.message || null
          });
          if (fetchError) {
            console.error("\u274C Error fetching assigned leads:", fetchError);
            return { recycled: 0, unassigned: 0, agentsProcessed: 0 };
          }
          if (!agentData || agentData.length === 0) {
            console.log("\u2705 No assigned leads to recycle");
            return { recycled: 0, unassigned: 0, agentsProcessed: 0 };
          }
          const agentEmails = [...new Set(agentData.map((l) => l.cn_email).filter(Boolean))];
          console.log(`\u{1F465} Found ${agentEmails.length} agents with assigned leads (total assigned leads: ${agentData.length})`);
          console.log(`\u{1F4CB} Sample agents: ${agentEmails.slice(0, 5).join(", ")}`);
          let totalRecycled = 0;
          let totalUnassigned = 0;
          let agentsProcessed = 0;
          for (const agentEmail of agentEmails) {
            let hasMoreCalled = true;
            let batchCount = 0;
            while (hasMoreCalled && batchCount < 50) {
              const { data: calledLeads, error: calledError } = await masterleadClient2.from("masterlead").select("id, cnresolution, currently_calling, aointel").eq("cn_email", agentEmail).in("cnresolution", ["called", "no_answer_vm", "no_answer"]).eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").or("aointel.is.null,aointel.eq.false").or("currently_calling.is.null,currently_calling.eq.false").limit(2e3);
              if (calledError || !calledLeads || calledLeads.length === 0) {
                hasMoreCalled = false;
                break;
              }
              const calledIds = calledLeads.map((l) => l.id);
              const { error: unassignError } = await masterleadClient2.from("masterlead").update({
                previous_cn_email: agentEmail,
                last_assigned_date: (/* @__PURE__ */ new Date()).toISOString(),
                cn_email: null,
                assigned_date: null,
                cnresolution: "pending"
                // Reset stale called/no-answer leads to pending for recycling
              }).in("id", calledIds);
              if (!unassignError) {
                totalRecycled += calledIds.length;
                console.log(`   \u267B\uFE0F Batch ${batchCount + 1}: Recycled ${calledIds.length} stale called/no_answer leads from ${agentEmail}`);
              }
              hasMoreCalled = calledLeads.length === 2e3;
              batchCount++;
            }
            if (FTC_TIMEZONE_RECYCLING_ENABLED) {
              let hasMoreTimezoneRestricted = true;
              let timezoneBatchCount = 0;
              while (hasMoreTimezoneRestricted && timezoneBatchCount < 50) {
                const { data: recyclableLeads, error: allLeadsError } = await masterleadClient2.from("masterlead").select("id, state, taalk_state, currently_calling, cnresolution, aointel").eq("cn_email", agentEmail).or("cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called,cnresolution.eq.no_answer_vm,cnresolution.eq.no_answer").eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").or("aointel.is.null,aointel.eq.false").or("currently_calling.is.null,currently_calling.eq.false").limit(2e3);
                if (allLeadsError || !recyclableLeads || recyclableLeads.length === 0) {
                  hasMoreTimezoneRestricted = false;
                  break;
                }
                const nonCallableLeads = recyclableLeads.filter((lead) => {
                  const leadState = lead.taalk_state || lead.state;
                  if (!leadState) return false;
                  const safeCheck = isSafeToCall(leadState);
                  return !safeCheck.safe;
                });
                if (nonCallableLeads.length > 0) {
                  const nonCallableIds = nonCallableLeads.map((l) => l.id);
                  const { error: unassignError } = await masterleadClient2.from("masterlead").update({
                    previous_cn_email: agentEmail,
                    last_assigned_date: (/* @__PURE__ */ new Date()).toISOString(),
                    cn_email: null,
                    assigned_date: null
                  }).in("id", nonCallableIds);
                  if (!unassignError) {
                    totalUnassigned += nonCallableIds.length;
                    console.log(`   \u{1F30D} Batch ${timezoneBatchCount + 1}: Unassigned ${nonCallableIds.length} timezone-restricted leads from ${agentEmail}`);
                  }
                }
                hasMoreTimezoneRestricted = recyclableLeads.length === 2e3;
                timezoneBatchCount++;
              }
            }
            const [nullCountResult, pendingCountResult, calledCountResult, noAnswerCountResult] = await Promise.all([
              masterleadClient2.from("masterlead").select("*", { count: "exact", head: true }).eq("cn_email", agentEmail).is("cnresolution", null).eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)"),
              masterleadClient2.from("masterlead").select("*", { count: "exact", head: true }).eq("cn_email", agentEmail).eq("cnresolution", "pending").eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)"),
              masterleadClient2.from("masterlead").select("*", { count: "exact", head: true }).eq("cn_email", agentEmail).eq("cnresolution", "called").eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)"),
              masterleadClient2.from("masterlead").select("*", { count: "exact", head: true }).eq("cn_email", agentEmail).in("cnresolution", ["no_answer_vm", "no_answer"]).eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)")
            ]);
            const recyclableLeadsCount = (nullCountResult.count || 0) + (pendingCountResult.count || 0) + (calledCountResult.count || 0) + (noAnswerCountResult.count || 0);
            if (recyclableLeadsCount > LEAD_CAP) {
              const excessRecyclable = recyclableLeadsCount - LEAD_CAP;
              console.log(`\u{1F6A8} EXCESS RECYCLABLE: ${agentEmail} has ${recyclableLeadsCount} recyclable leads (limit: ${LEAD_CAP}). Unassigning ${excessRecyclable}...`);
              let hasMoreRecyclable = true;
              let totalUnassignedThisAgent = 0;
              let batchNum = 0;
              while (hasMoreRecyclable && batchNum < 200) {
                const [nullLeads, pendingLeads, calledLeads, noAnswerLeads] = await Promise.all([
                  masterleadClient2.from("masterlead").select("id, assigned_date, currently_calling, cnresolution").eq("cn_email", agentEmail).is("cnresolution", null).eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").or("currently_calling.is.null,currently_calling.eq.false").order("assigned_date", { ascending: false, nullsFirst: false }).limit(2e3),
                  masterleadClient2.from("masterlead").select("id, assigned_date, currently_calling, cnresolution").eq("cn_email", agentEmail).eq("cnresolution", "pending").eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").or("currently_calling.is.null,currently_calling.eq.false").order("assigned_date", { ascending: false, nullsFirst: false }).limit(2e3),
                  masterleadClient2.from("masterlead").select("id, assigned_date, currently_calling, cnresolution").eq("cn_email", agentEmail).eq("cnresolution", "called").eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").or("currently_calling.is.null,currently_calling.eq.false").order("assigned_date", { ascending: false, nullsFirst: false }).limit(2e3),
                  masterleadClient2.from("masterlead").select("id, assigned_date, currently_calling, cnresolution").eq("cn_email", agentEmail).in("cnresolution", ["no_answer_vm", "no_answer"]).eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").or("currently_calling.is.null,currently_calling.eq.false").order("assigned_date", { ascending: false, nullsFirst: false }).limit(2e3)
                ]);
                const allRecyclableLeads = [
                  ...nullLeads.data || [],
                  ...pendingLeads.data || [],
                  ...calledLeads.data || [],
                  ...noAnswerLeads.data || []
                ];
                if (allRecyclableLeads.length === 0) {
                  hasMoreRecyclable = false;
                  break;
                }
                const sortedLeads = [...allRecyclableLeads].sort((a, b) => {
                  const dateA = a.assigned_date ? new Date(a.assigned_date).getTime() : 0;
                  const dateB = b.assigned_date ? new Date(b.assigned_date).getTime() : 0;
                  return dateB - dateA;
                });
                const keepIds = new Set(sortedLeads.slice(0, LEAD_CAP).map((l) => l.id));
                const leadsToUnassign = allRecyclableLeads.filter((lead) => !keepIds.has(lead.id));
                if (leadsToUnassign.length > 0) {
                  const unassignIds = leadsToUnassign.map((l) => l.id);
                  const { error: unassignError } = await masterleadClient2.from("masterlead").update({
                    previous_cn_email: agentEmail,
                    last_assigned_date: (/* @__PURE__ */ new Date()).toISOString(),
                    cn_email: null,
                    assigned_date: null
                    // Keep resolution status - don't reset to pending
                  }).in("id", unassignIds);
                  if (!unassignError) {
                    totalUnassignedThisAgent += unassignIds.length;
                    totalUnassigned += unassignIds.length;
                    console.log(`   \u{1F5D1}\uFE0F Batch ${batchNum + 1}: Unassigned ${unassignIds.length} excess recyclable leads from ${agentEmail} (${totalUnassignedThisAgent} total unassigned so far)`);
                  }
                }
                hasMoreRecyclable = allRecyclableLeads.length >= 2e3;
                batchNum++;
                if (totalUnassignedThisAgent >= excessRecyclable) {
                  break;
                }
              }
              const [finalNullCount, finalPendingCount, finalCalledCount, finalNoAnswerCount] = await Promise.all([
                masterleadClient2.from("masterlead").select("*", { count: "exact", head: true }).eq("cn_email", agentEmail).is("cnresolution", null).eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)"),
                masterleadClient2.from("masterlead").select("*", { count: "exact", head: true }).eq("cn_email", agentEmail).eq("cnresolution", "pending").eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)"),
                masterleadClient2.from("masterlead").select("*", { count: "exact", head: true }).eq("cn_email", agentEmail).eq("cnresolution", "called").eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)"),
                masterleadClient2.from("masterlead").select("*", { count: "exact", head: true }).eq("cn_email", agentEmail).in("cnresolution", ["no_answer_vm", "no_answer"]).eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)")
              ]);
              const finalRecyclableCount = (finalNullCount.count || 0) + (finalPendingCount.count || 0) + (finalCalledCount.count || 0) + (finalNoAnswerCount.count || 0);
              if (finalRecyclableCount > LEAD_CAP) {
                const [finalNullLeads, finalPendingLeads, finalCalledLeads, finalNoAnswerLeads] = await Promise.all([
                  masterleadClient2.from("masterlead").select("id, assigned_date").eq("cn_email", agentEmail).is("cnresolution", null).eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").order("assigned_date", { ascending: false, nullsFirst: false }).limit(5e3),
                  masterleadClient2.from("masterlead").select("id, assigned_date").eq("cn_email", agentEmail).eq("cnresolution", "pending").eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").order("assigned_date", { ascending: false, nullsFirst: false }).limit(5e3),
                  masterleadClient2.from("masterlead").select("id, assigned_date").eq("cn_email", agentEmail).eq("cnresolution", "called").eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").order("assigned_date", { ascending: false, nullsFirst: false }).limit(5e3),
                  masterleadClient2.from("masterlead").select("id, assigned_date").eq("cn_email", agentEmail).in("cnresolution", ["no_answer_vm", "no_answer"]).eq("dnc", false).lt("updated_at", recycleCutoff).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").order("assigned_date", { ascending: false, nullsFirst: false }).limit(5e3)
                ]);
                const allFinalRecyclable = [
                  ...finalNullLeads.data || [],
                  ...finalPendingLeads.data || [],
                  ...finalCalledLeads.data || [],
                  ...finalNoAnswerLeads.data || []
                ];
                if (allFinalRecyclable.length > LEAD_CAP) {
                  const sortedFinal = [...allFinalRecyclable].sort((a, b) => {
                    const dateA = a.assigned_date ? new Date(a.assigned_date).getTime() : 0;
                    const dateB = b.assigned_date ? new Date(b.assigned_date).getTime() : 0;
                    return dateB - dateA;
                  });
                  const keepIds = new Set(sortedFinal.slice(0, LEAD_CAP).map((l) => l.id));
                  const unassignFinal = allFinalRecyclable.filter((l) => !keepIds.has(l.id));
                  if (unassignFinal.length > 0) {
                    const finalUnassignIds = unassignFinal.map((l) => l.id);
                    await masterleadClient2.from("masterlead").update({
                      previous_cn_email: agentEmail,
                      last_assigned_date: (/* @__PURE__ */ new Date()).toISOString(),
                      cn_email: null,
                      assigned_date: null
                    }).in("id", finalUnassignIds);
                    totalUnassigned += finalUnassignIds.length;
                    console.log(`   \u2705 FINAL CLEANUP: Unassigned ${finalUnassignIds.length} recyclable leads from ${agentEmail} (now at ${finalRecyclableCount - finalUnassignIds.length} recyclable leads)`);
                  }
                }
              }
            }
            if (totalRecycled > 0 || totalUnassigned > 0) {
              agentsProcessed++;
            }
          }
          console.log(`\u2705 LEAD RECYCLING COMPLETE:`);
          console.log(`   - Recycled ${totalRecycled} no-answer/voicemail leads`);
          console.log(`   - Unassigned ${totalUnassigned} excess leads`);
          console.log(`   - Processed ${agentsProcessed} agents`);
          return {
            recycled: totalRecycled,
            unassigned: totalUnassigned,
            agentsProcessed
          };
        } catch (error) {
          console.error("\u274C Lead recycling error:", error);
          return {
            recycled: 0,
            unassigned: 0,
            agentsProcessed: 0
          };
        }
      }
      /**
       * ENFORCE LEAD CAP
       * Unassigns excess leads from agents who have MORE than cap assigned leads (regardless of resolution)
       * This prevents agents from accumulating thousands of leads
       */
      async enforceLeadCap() {
        try {
          if (!supabaseAdmin) {
            console.error("\u274C Supabase not available");
            return { unassigned: 0, agentsProcessed: 0 };
          }
          console.log(`\u{1F6A8} ENFORCING LEAD CAP (${LEAD_CAP}): Checking all agents for excess leads...`);
          const { data: agentData, error: fetchError } = await masterleadClient2.from("masterlead").select("cn_email").not("cn_email", "is", null).neq("cn_email", "").eq("dnc", false).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").limit(1e5);
          if (fetchError) {
            console.error("\u274C Error fetching assigned leads:", fetchError);
            return { unassigned: 0, agentsProcessed: 0 };
          }
          if (!agentData || agentData.length === 0) {
            console.log("\u2705 No assigned leads to check");
            return { unassigned: 0, agentsProcessed: 0 };
          }
          const agentEmails = [...new Set(agentData.map((l) => l.cn_email).filter(Boolean))];
          console.log(`\u{1F465} Checking ${agentEmails.length} agents for excess leads...`);
          let totalUnassigned = 0;
          let agentsProcessed = 0;
          for (const agentEmail of agentEmails) {
            const { count: callableCount, error: countError } = await masterleadClient2.from("masterlead").select("*", { count: "exact", head: true }).eq("cn_email", agentEmail).eq("dnc", false).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").or("TaalkResolve.is.null,TaalkResolve.eq.false").or("cnresolution.is.null,cnresolution.in.(pending,called,no_answer_vm,new)");
            if (countError) {
              console.error(`\u274C Error counting callable leads for ${agentEmail}:`, countError);
              continue;
            }
            const callableLeads = callableCount || 0;
            if (callableLeads > LEAD_CAP) {
              const excessLeads = callableLeads - LEAD_CAP;
              console.log(`\u{1F6A8} EXCESS CALLABLE LEADS: ${agentEmail} has ${callableLeads} callable leads (OVER LIMIT by ${excessLeads}). Unassigning excess...`);
              let hasMore = true;
              let batchNum = 0;
              let unassignedThisAgent = 0;
              while (hasMore && batchNum < 50 && unassignedThisAgent < excessLeads) {
                const { data: callableLeadsToUnassign } = await masterleadClient2.from("masterlead").select("id, assigned_date, currently_calling, cnresolution").eq("cn_email", agentEmail).eq("dnc", false).not("taalk_market", "in", "(Plus Lead,Plus Leads,plus lead,plus leads)").or("cnresolution.is.null,cnresolution.in.(pending,no_answer_vm,new)").or("currently_calling.is.null,currently_calling.eq.false").order("assigned_date", { ascending: true, nullsFirst: true }).limit(2e3);
                if (callableLeadsToUnassign && callableLeadsToUnassign.length > 0) {
                  const toUnassign = callableLeadsToUnassign.slice(0, Math.min(2e3, excessLeads - unassignedThisAgent));
                  const unassignIds = toUnassign.map((l) => l.id);
                  const { error: unassignError } = await masterleadClient2.from("masterlead").update({
                    previous_cn_email: agentEmail,
                    last_assigned_date: (/* @__PURE__ */ new Date()).toISOString(),
                    cn_email: null,
                    assigned_date: null,
                    cnresolution: "pending"
                    // Reset to pending
                  }).in("id", unassignIds);
                  if (!unassignError) {
                    unassignedThisAgent += unassignIds.length;
                    totalUnassigned += unassignIds.length;
                    console.log(`   \u2705 Batch ${batchNum + 1}: Unassigned ${unassignIds.length} callable leads from ${agentEmail}`);
                  }
                  hasMore = callableLeadsToUnassign.length === 2e3 && unassignedThisAgent < excessLeads;
                } else {
                  hasMore = false;
                }
                batchNum++;
              }
              if (unassignedThisAgent > 0) {
                agentsProcessed++;
                console.log(`   \u2705 ${agentEmail}: Unassigned ${unassignedThisAgent} excess callable leads (now at ${callableLeads - unassignedThisAgent} callable leads)`);
              }
            }
          }
          console.log(`\u2705 LEAD CAP ENFORCEMENT COMPLETE:`);
          console.log(`   - Unassigned ${totalUnassigned} excess leads`);
          console.log(`   - Processed ${agentsProcessed} agents with excess leads`);
          return {
            unassigned: totalUnassigned,
            agentsProcessed
          };
        } catch (error) {
          console.error("\u274C Error enforcing lead cap:", error);
          return {
            unassigned: 0,
            agentsProcessed: 0
          };
        }
      }
      stopScheduler() {
        if (this.midnightResetTask) {
          this.midnightResetTask.stop();
          this.midnightResetTask = null;
        }
        if (this.continuousAssignmentTask) {
          this.continuousAssignmentTask.stop();
          this.continuousAssignmentTask = null;
        }
        if (this.leadRecyclingTask) {
          this.leadRecyclingTask.stop();
          this.leadRecyclingTask = null;
        }
        console.log("\u{1F6D1} Lead Assignment Scheduler stopped");
      }
    };
    leadAssignmentScheduler = new LeadAssignmentScheduler();
  }
});

// server/call-analytics-disposition-model.ts
var call_analytics_disposition_model_exports = {};
__export(call_analytics_disposition_model_exports, {
  DISPOSITION_MODEL: () => DISPOSITION_MODEL,
  INSTANT_PRESENTATION_MIN_DURATION_SEC: () => INSTANT_PRESENTATION_MIN_DURATION_SEC,
  applyDispositionRules: () => applyDispositionRules,
  buildDispositionPromptSection: () => buildDispositionPromptSection,
  getDispositionDefinition: () => getDispositionDefinition,
  getDispositionFromCallOutcome: () => getDispositionFromCallOutcome,
  loadDispositionModelFromDb: () => loadDispositionModelFromDb
});
async function loadDispositionModelFromDb() {
  if (!supabaseAdmin) return;
  try {
    const { data, error } = await supabaseAdmin.from("call_analytics_disposition_rules").select("id, label, description, prompt_instructions, min_duration_sec, max_duration_sec, scorecard_zero, transcript_indicators, must_not_contain, call_outcome_mapping, sort_order, active").eq("active", true).order("sort_order", { ascending: true });
    if (error || !data?.length) {
      cachedDefinitions = null;
      return;
    }
    cachedDefinitions = data.map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      description: row.description ?? "",
      callOutcomeMapping: Array.isArray(row.call_outcome_mapping) ? row.call_outcome_mapping : row.call_outcome_mapping ? [row.call_outcome_mapping] : [],
      rules: {
        minDurationSec: row.min_duration_sec ?? void 0,
        maxDurationSec: row.max_duration_sec ?? void 0,
        scorecardZero: row.scorecard_zero ?? false,
        transcriptIndicators: Array.isArray(row.transcript_indicators) ? row.transcript_indicators : [],
        mustNotContain: Array.isArray(row.must_not_contain) ? row.must_not_contain : []
      }
    }));
  } catch {
    cachedDefinitions = null;
  }
}
function getDefinitions() {
  return cachedDefinitions ?? DISPOSITION_MODEL;
}
function getDispositionFromCallOutcome(callOutcome) {
  const upper = (callOutcome || "").toUpperCase();
  const def = getDefinitions().find((d) => d.callOutcomeMapping.includes(upper));
  return def?.id ?? "instant_presentation";
}
function getDispositionDefinition(id) {
  return getDefinitions().find((d) => d.id === id);
}
function buildDispositionPromptSection() {
  const defs = getDefinitions();
  const lines = [
    "**DISPOSITION RULES (follow strictly):**",
    ""
  ];
  for (const d of defs) {
    lines.push(`- **${d.id}** (from AI outcome ${d.callOutcomeMapping.join(" or ")}): ${d.description}`);
    if (d.rules?.minDurationSec) {
      const minMin = Math.round(d.rules.minDurationSec / 60);
      lines.push(`  - REQUIRED: Call duration must be at least ${minMin} minutes (${d.rules.minDurationSec} seconds). Shorter calls must NOT use this disposition.`);
    }
    if (d.rules?.maxDurationSec) {
      lines.push(`  - Typically call is under ${Math.round(d.rules.maxDurationSec / 60)} minutes.`);
    }
    if (d.rules?.scorecardZero) {
      lines.push(`  - When using this disposition, set all scorecard scores to 0 (overallScore 0).`);
    }
    if (d.rules?.transcriptIndicators?.length) {
      lines.push(`  - Look for: ${d.rules.transcriptIndicators.slice(0, 5).join("; ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
function applyDispositionRules(disposition, callDurationSec) {
  const def = getDispositionDefinition(disposition);
  if (!def?.rules) return disposition;
  const sec = normalizeDurationToSeconds(callDurationSec);
  if (def.rules.minDurationSec != null && sec > 0 && sec < def.rules.minDurationSec) {
    if (disposition === "instant_presentation") return "call_back";
    if (disposition === "booked" && sec < 30) return "call_back";
  }
  if (disposition === "instant_presentation" && sec > 0 && sec < 60) return "call_back";
  return disposition;
}
function normalizeDurationToSeconds(value) {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const n = Number(value);
  if (n > 7200) return Math.round(n / 1e3);
  return n;
}
var DISPOSITION_MODEL, cachedDefinitions, INSTANT_PRESENTATION_MIN_DURATION_SEC;
var init_call_analytics_disposition_model = __esm({
  "server/call-analytics-disposition-model.ts"() {
    "use strict";
    init_supabase();
    DISPOSITION_MODEL = [
      {
        id: "no_answer_vm",
        label: "No Answer / Voicemail",
        description: 'Prospect did NOT speak. Voicemail (beep, leave a message), disconnected, or ring-out. One-sided: only agent talking, no prospect replies. Use when you hear: "leave a message", "after the beep", automated greeting, no human on line.',
        callOutcomeMapping: ["NO_SHOW"],
        rules: {
          scorecardZero: true,
          transcriptIndicators: ["leave a message", "after the beep", "not available", "voicemail", "message machine", "one-sided", "only agent speaking"],
          mustNotContain: ["prospect said", "client said", "they said", "customer replied"]
        }
      },
      {
        id: "spanish",
        label: "Spanish",
        description: "Prospect or context indicates need for Spanish speaker (we don't have one). Transcript mentions: spanish, espa\xF1ol, speak spanish, habla espa\xF1ol. Usually short (< 2 min). Do NOT use CALLBACK for these.",
        callOutcomeMapping: ["OTHER"],
        rules: {
          maxDurationSec: 150,
          // often under 2.5 min
          transcriptIndicators: ["spanish", "espa\xF1ol", "espanol", "speak spanish", "habla espa\xF1ol"]
        }
      },
      {
        id: "sale",
        label: "Sale",
        description: "Prospect purchased / closed the sale. Money committed, policy sold.",
        callOutcomeMapping: ["SOLD"],
        rules: {
          transcriptIndicators: ["sold", "purchased", "signed", "enrolled", "payment", "policy", "closed the sale"]
        }
      },
      {
        id: "booked",
        label: "Booked",
        description: 'Agent scheduled a SPECIFIC appointment (date and/or time set). Use only when an appointment was actually set\u2014not just "call back later".',
        callOutcomeMapping: ["BOOKED"],
        rules: {
          minDurationSec: 30,
          // real booking usually has some dialogue
          transcriptIndicators: ["appointment", "scheduled", "set for", "date", "time", "calendar", "tomorrow at", "next week"],
          mustNotContain: ["just call back", "call me later", "no specific time"]
        }
      },
      {
        id: "call_back",
        label: "Call Back",
        description: 'Prospect wants to be called back later but NO specific appointment was set. "Call me later", "try again tomorrow", interest but no date/time set.',
        callOutcomeMapping: ["CALLBACK"],
        rules: {
          transcriptIndicators: ["call back", "call me later", "try again", "reach out later", "not a good time", "busy right now"]
        }
      },
      {
        id: "instant_presentation",
        label: "Instant Presentation",
        description: 'Full presentation was given but no sale, no appointment, no callback set. Prospect heard the full pitch. ONLY valid when call is at least 8 minutes (480 seconds). Shorter calls cannot be "full presentation"\u2014use call_back or not_interested instead.',
        callOutcomeMapping: ["OTHER"],
        rules: {
          minDurationSec: 8 * 60,
          // 8 minutes
          transcriptIndicators: ["full presentation", "went through the pitch", "explained the product", "heard everything"],
          mustNotContain: ["voicemail", "leave a message", "no answer"]
        }
      },
      {
        id: "not_interested",
        label: "Not Interested",
        description: "Prospect said no, needs to think, raised objections and is not moving forward. Not interested, objection, think about it.",
        callOutcomeMapping: ["THINK", "OBJECTION"],
        rules: {
          transcriptIndicators: ["not interested", "no thanks", "think about it", "objection", "not right now", "maybe later", "don't need"]
        }
      }
    ];
    cachedDefinitions = null;
    INSTANT_PRESENTATION_MIN_DURATION_SEC = 8 * 60;
  }
});

// server/storage.ts
var storage_exports = {};
__export(storage_exports, {
  DatabaseStorage: () => DatabaseStorage,
  MemStorage: () => MemStorage,
  storage: () => storage
});
import { nanoid } from "nanoid";
import { eq as eq2, and as and2, sql as sql4 } from "drizzle-orm";
var MemStorage, DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_schema();
    init_db();
    init_supabase();
    init_local_masterlead_client();
    MemStorage = class {
      users;
      verificationSessions;
      agentProfile;
      currentUserId;
      currentSessionId;
      currentLeads;
      constructor() {
        this.users = /* @__PURE__ */ new Map();
        this.verificationSessions = /* @__PURE__ */ new Map();
        this.agentProfile = null;
        this.currentUserId = 1;
        this.currentSessionId = 1;
        this.currentLeads = /* @__PURE__ */ new Map();
      }
      async getUser(id) {
        return this.users.get(id);
      }
      async getUserByUsername(username) {
        return Array.from(this.users.values()).find(
          (user) => user.username === username
        );
      }
      async createUser(insertUser) {
        const id = this.currentUserId++;
        const user = {
          id,
          username: insertUser.username,
          password: insertUser.password,
          agentPhone: insertUser.agentPhone || null,
          agentName: insertUser.agentName || null
        };
        this.users.set(id, user);
        return user;
      }
      async getAgentProfile() {
        return this.agentProfile || void 0;
      }
      async createOrUpdateAgentProfile(profile) {
        const agentProfile = {
          id: 1,
          supabaseUserId: "mem-storage-default",
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          email: profile.email,
          zoomId: profile.zoomId || null,
          zoomPassword: profile.zoomPassword || null,
          profilePicture: profile.profilePicture || null,
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        };
        this.agentProfile = agentProfile;
        return agentProfile;
      }
      async createVerificationSession(session) {
        const sessionId = `VER-${Date.now()}-${nanoid(6)}`;
        const verificationSession = {
          id: this.verificationSessions.size + 1,
          sessionId,
          firstName: session.firstName,
          lastName: session.lastName,
          spouseName: session.spouseName,
          phone: session.phone,
          agentPhone: session.agentPhone,
          agentFirstName: session.agentFirstName || null,
          agentLastName: session.agentLastName || null,
          city: session.city,
          state: session.state,
          premium: session.premium,
          achDrawDate: session.achDrawDate || null,
          achDrawDateShort: session.achDrawDateShort || null,
          verificationMethod: session.verificationMethod,
          zoomRoomId: session.zoomRoomId,
          zoomPassword: session.zoomPassword,
          language: session.language || "en",
          screenshotPath: session.screenshotPath || null,
          status: "pending",
          createdAt: /* @__PURE__ */ new Date(),
          smsVerificationCode: null,
          clientApprovalTimestamp: null,
          completedAt: null,
          // Add missing fields that were causing errors
          taalkCallId: null,
          taalkCallStatus: null,
          taalkCallInitiatedAt: null,
          taalkCallCompletedAt: null,
          callCompleted: false,
          verificationResult: null
        };
        this.verificationSessions.set(sessionId, verificationSession);
        return verificationSession;
      }
      async getVerificationSession(sessionId) {
        return this.verificationSessions.get(sessionId);
      }
      async getVerificationSessionByCode(verificationCode) {
        return Array.from(this.verificationSessions.values()).find(
          (session) => session.smsVerificationCode === verificationCode
        );
      }
      async updateVerificationSession(sessionId, updates) {
        const session = this.verificationSessions.get(sessionId);
        if (!session) return void 0;
        const updatedSession = { ...session, ...updates };
        this.verificationSessions.set(sessionId, updatedSession);
        return updatedSession;
      }
      async completeVerificationSession(sessionId) {
        const session = this.verificationSessions.get(sessionId);
        if (!session) return void 0;
        const completedSession = {
          ...session,
          status: "completed",
          completedAt: /* @__PURE__ */ new Date()
        };
        this.verificationSessions.set(sessionId, completedSession);
        return completedSession;
      }
      // Supabase-linked agent profile methods (not implemented in memory storage)
      async getAgentProfileBySupabaseId(supabaseUserId) {
        return null;
      }
      async createAgentProfileWithSupabaseId(profileData) {
        return this.createOrUpdateAgentProfile(profileData);
      }
      async getAgentProfileByEmail(email) {
        return null;
      }
      async countAgentProfilesForEmail(_email) {
        return 0;
      }
      async getAllAgentProfiles() {
        return [];
      }
      // RGA Management (stub implementations for memory storage)
      async getDistinctRGATeams() {
        return [];
      }
      async getMGAsByRGA(rgaTeam) {
        return [];
      }
      async assignMGAToRGA(mgaTeam, rgaTeam) {
      }
      async updateAgentProfileBySupabaseId(supabaseUserId, updates) {
        return null;
      }
      // Appointment methods (stub implementations for memory storage)
      async createAppointment(appointment) {
        throw new Error("Appointments not supported in memory storage");
      }
      async getAppointments(agentId) {
        return [];
      }
      async getAppointmentsByDate(agentId, date) {
        return [];
      }
      async updateAppointment(id, updates) {
        return void 0;
      }
      async deleteAppointment(id) {
        return false;
      }
      // Incoming leads operations (stub implementations for memory storage)
      async createIncomingLead(lead) {
        throw new Error("Incoming leads not supported in memory storage");
      }
      async getIncomingLeads(status) {
        return [];
      }
      async updateIncomingLeadStatus(id, status, assignedAgent) {
        return void 0;
      }
      // Call tracking operations (stub implementations for memory storage)
      async trackOutboundCall(callData) {
        throw new Error("Call tracking not supported in memory storage");
      }
      async updateOutboundCallStatus(updateData) {
        return void 0;
      }
      async getLastCallToNumber(phoneNumber) {
        return void 0;
      }
      async getAgentForCallbacks(phoneNumber) {
        return void 0;
      }
      async createInboundCallRoute(routeData) {
        throw new Error("Inbound call routing not supported in memory storage");
      }
      async getActiveInboundCalls(agentEmail) {
        return [];
      }
      async updateInboundCallStatus(callSid, status, endTime) {
        return void 0;
      }
      async getCallbackStats() {
        return {
          totalActiveCalls: 0,
          callbackCalls: 0,
          newCallerCalls: 0,
          callbackPercentage: 0,
          agentSpecificCallbacks: {}
        };
      }
      // Recruit Candidates operations (stub implementations for memory storage)
      async createRecruitCandidate(candidate) {
        throw new Error("Recruit candidates not supported in memory storage");
      }
      async getRecruitCandidates(agentEmail) {
        return [];
      }
      async getRecruitCandidateById(id) {
        return void 0;
      }
      async updateRecruitCandidate(id, updates) {
        return void 0;
      }
      async deleteRecruitCandidate(id) {
        return false;
      }
      // Music preferences - simple stub for MemStorage
      async getMusicPreferences(agentEmail) {
        return { musicType: "silence" };
      }
      // Team management - simple stub for MemStorage
      async getDistinctMGATeams() {
        return ["Team Alpha", "Team Beta", "Team Gamma"];
      }
      // Quality Manager Team Assignment stubs
      async getQMTeamAssignments(qmEmail) {
        return [];
      }
      async assignQMToTeam(qmEmail, mgaTeam) {
      }
      async removeQMFromTeam(qmEmail, mgaTeam) {
      }
      async replaceQMTeamAssignments(qmEmail, mgaTeams2) {
      }
      async getAllQMTeamAssignments() {
        return [];
      }
      // Enhanced Team Management stubs
      async getAllTeams() {
        return [
          { id: 1, name: "Sample MGA Team", description: "Sample MGA", teamType: "MGA", isActive: true },
          { id: 2, name: "Sample RGA Team", description: "Sample RGA", teamType: "RGA", isActive: true }
        ];
      }
      async getTeamsByType(teamType) {
        const allTeams = await this.getAllTeams();
        return allTeams.filter((team) => team.teamType === teamType);
      }
      async getQualityManagersByTeam(teamId) {
        return [];
      }
      async assignQMToTeamById(qmEmail, teamId) {
      }
      async removeQMFromTeamById(qmEmail, teamId) {
      }
    };
    DatabaseStorage = class {
      teamDirectoryCache = /* @__PURE__ */ new Map();
      async getUser(id) {
        const [user] = await db.select().from(users).where(eq2(users.id, id));
        return user || void 0;
      }
      async getUserByUsername(username) {
        const [user] = await db.select().from(users).where(eq2(users.username, username));
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
          }).where(eq2(agentProfiles.id, existing.id)).returning();
          return updatedProfile;
        } else {
          const [newProfile] = await db.insert(agentProfiles).values(profile).returning();
          return newProfile;
        }
      }
      async createVerificationSession(session) {
        const sessionId = `VER-${Date.now()}-${nanoid(6)}`;
        let agentMgaTeam = session.agentMgaTeam || null;
        let agentRgaTeam = session.agentRgaTeam || null;
        let agentAssociateId = session.associateId;
        let agentCompanyEmail = session.companyEmail;
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
            if (!agentMgaTeam && session.agentFirstName && session.agentLastName) {
              const agentFullName = `${session.agentFirstName} ${session.agentLastName}`;
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
        const isDemo = session.is_demo === true || session.is_demo === "true";
        const supabaseData = {
          session_id: sessionId,
          first_name: session.firstName,
          last_name: session.lastName,
          spouse_name: session.spouseName,
          phone: session.phone,
          agent_phone: session.agentPhone,
          agent_first_name: session.agentFirstName,
          agent_last_name: session.agentLastName,
          associate_id: agentAssociateId,
          // Use looked up or provided associate_id
          company_email: agentCompanyEmail,
          // Use looked up or provided company_email
          agent_mga_team: agentMgaTeam,
          agent_rga_team: agentRgaTeam,
          city: session.city,
          state: session.state,
          premium: session.premium,
          ach_draw_date: session.achDrawDate,
          ach_draw_date_short: session.achDrawDateShort,
          verification_method: session.verificationMethod,
          zoom_room_id: session.zoomRoomId,
          zoom_password: session.zoomPassword,
          language: session.language || "en",
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
              firstName: session.firstName,
              lastName: session.lastName,
              spouseName: session.spouseName,
              phone: session.phone,
              agentPhone: session.agentPhone,
              agentFirstName: session.agentFirstName,
              agentLastName: session.agentLastName,
              city: session.city,
              state: session.state,
              premium: session.premium,
              achDrawDate: session.achDrawDate,
              achDrawDateShort: session.achDrawDateShort,
              verificationMethod: session.verificationMethod,
              zoomRoomId: session.zoomRoomId,
              zoomPassword: session.zoomPassword,
              language: session.language || "en",
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
        const [session] = await db.select().from(verificationSessions).where(eq2(verificationSessions.sessionId, sessionId));
        return session || void 0;
      }
      async getVerificationSessionByCode(verificationCode) {
        const [session] = await db.select().from(verificationSessions).where(eq2(verificationSessions.smsVerificationCode, verificationCode));
        return session || void 0;
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
          const [updatedSession] = await db.update(verificationSessions).set(dbUpdates).where(eq2(verificationSessions.sessionId, sessionId)).returning();
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
        }).where(eq2(verificationSessions.sessionId, sessionId)).returning();
        return completedSession || void 0;
      }
      // Appointment methods
      async createAppointment(appointment) {
        const [newAppointment] = await db.insert(appointments).values(appointment).returning();
        return newAppointment;
      }
      async getAppointments(agentId) {
        const appointmentsList = await db.select().from(appointments).where(eq2(appointments.agentId, agentId)).orderBy(appointments.date, appointments.time);
        return appointmentsList;
      }
      async getAppointmentsByDate(agentId, date) {
        const appointmentsList = await db.select().from(appointments).where(and2(
          eq2(appointments.agentId, agentId),
          eq2(appointments.date, date)
        )).orderBy(appointments.time);
        return appointmentsList;
      }
      async updateAppointment(id, updates) {
        const [updatedAppointment] = await db.update(appointments).set({
          ...updates,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq2(appointments.id, id)).returning();
        return updatedAppointment || void 0;
      }
      async deleteAppointment(id) {
        const result = await db.delete(appointments).where(eq2(appointments.id, id));
        return (result.rowCount || 0) > 0;
      }
      // Incoming leads operations (CSV webhook)
      async createIncomingLead(lead) {
        const [newLead] = await db.insert(incomingLeads).values(lead).returning();
        return newLead;
      }
      async getIncomingLeads(status) {
        if (status) {
          return await db.select().from(incomingLeads).where(eq2(incomingLeads.status, status));
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
        const [updatedLead] = await db.update(incomingLeads).set(updates).where(eq2(incomingLeads.id, id)).returning();
        return updatedLead;
      }
      // Supabase-linked agent profile methods
      async getAgentProfileBySupabaseId(supabaseUserId) {
        const [profile] = await db.select().from(agentProfiles).where(eq2(agentProfiles.supabaseUserId, supabaseUserId));
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
          const { count: count2, error } = await supabaseAdmin.from("agent_profiles").select("id", { count: "exact", head: true }).ilike("email", normalizedEmail);
          if (error) {
            console.warn("\u26A0\uFE0F countAgentProfilesForEmail:", error.message);
            return 0;
          }
          return typeof count2 === "number" ? count2 : 0;
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
              const payload = {
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
              const { error: upsertError } = await supabaseAdmin.from("agent_hierarchy").upsert(payload, { onConflict: "agent_associate_id" });
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
          const payload = {
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
            await supabaseAdmin.from("agent_hierarchy").update(payload).eq("id", existingByEmail.id);
          } else {
            payload.created_at = (/* @__PURE__ */ new Date()).toISOString();
            await supabaseAdmin.from("agent_hierarchy").upsert(payload, { onConflict: "agent_associate_id" });
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
        const results = await db.selectDistinct({ rga: agentProfiles.rgaTeam }).from(agentProfiles).where(sql4`${agentProfiles.rgaTeam} IS NOT NULL`);
        return results.map((r) => r.rga).filter(Boolean);
      }
      async getMGAsByRGA(rgaTeam) {
        const results = await db.selectDistinct({ mga: agentProfiles.mgaTeam }).from(agentProfiles).where(eq2(agentProfiles.rgaTeam, rgaTeam)).where(sql4`${agentProfiles.mgaTeam} IS NOT NULL`);
        return results.map((r) => r.mga).filter(Boolean);
      }
      async assignMGAToRGA(mgaTeam, rgaTeam) {
        await db.update(agentProfiles).set({ rgaTeam }).where(eq2(agentProfiles.mgaTeam, mgaTeam));
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
        }).where(eq2(agentProfiles.supabaseUserId, supabaseUserId)).returning();
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
        const [updatedCall] = await db.update(outboundCallHistory).set(updates).where(and2(
          eq2(outboundCallHistory.leadPhone, updateData.leadPhone),
          eq2(outboundCallHistory.agentEmail, updateData.agentEmail)
        )).returning();
        return updatedCall || void 0;
      }
      async getLastCallToNumber(phoneNumber) {
        const [lastCall] = await db.select().from(outboundCallHistory).where(eq2(outboundCallHistory.leadPhone, phoneNumber)).orderBy(outboundCallHistory.lastContactedAt).limit(1);
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
          return await db.select().from(inboundCallRouting).where(and2(
            eq2(inboundCallRouting.callStatus, "active"),
            eq2(inboundCallRouting.routedToAgent, agentEmail)
          ));
        } else {
          return await db.select().from(inboundCallRouting).where(eq2(inboundCallRouting.callStatus, "active"));
        }
      }
      async updateInboundCallStatus(callSid, status, endTime) {
        const updates = { callStatus: status };
        if (endTime) {
          updates.callEndTime = endTime;
        }
        const [updatedRoute] = await db.update(inboundCallRouting).set(updates).where(eq2(inboundCallRouting.incomingCallSid, callSid)).returning();
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
        const profiles = await db.select({ mgaTeam: agentProfiles.mgaTeam }).from(agentProfiles).where(sql4`mga_team IS NOT NULL AND mga_team != ''`);
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
          const overdueFollowups = await db.select().from(aoiFollowups).where(sql4`due_date < ${today} AND status = 'pending'`).orderBy(aoiFollowups.dueDate);
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
          const { count: masterleadTotalCount, error: masterleadCountError } = await masterleadClient2.from("masterlead").select("*", { count: "exact", head: true });
          console.log(`\u{1F4CA} Total masterlead records in database: ${masterleadTotalCount || 0}`);
          if (masterleadCountError) console.log("\u274C Masterlead count error:", masterleadCountError);
          const { data: vdpCalls2, error: vdpError } = await supabase2.from("vdp_calls").select("*").or("duration.gte.240,duration.is.null").order("id", { ascending: false }).limit(200);
          if (vdpError) {
            console.error("\u274C Supabase error getting VDP calls:", vdpError);
          } else {
            console.log(`\u{1F50D} Retrieved ${vdpCalls2?.length || 0} VDP calls`);
          }
          const { data: masterleadCalls, error: masterleadError } = await masterleadClient2.from("masterlead").select("*").or("cnresolution.ilike.%booked%,cnresolution.ilike.%appointment%,cnresolution.ilike.%call back%,cnresolution.ilike.%callback%").order("created_at", { ascending: false }).limit(2e3);
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
          const pendingFollowups = await db.select().from(aoiFollowups).where(sql4`agent_email = ${agentEmail} AND status = 'pending'`).orderBy(aoiFollowups.dueDate);
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
          }).where(eq2(aoiFollowups.id, followupId)).returning();
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
          const assignments = await db.select({ mgaTeam: qualityManagerTeamAssignments.mgaTeam }).from(qualityManagerTeamAssignments).where(eq2(qualityManagerTeamAssignments.qmEmail, qmEmail));
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
            and2(
              eq2(qualityManagerTeamAssignments.qmEmail, qmEmail),
              eq2(qualityManagerTeamAssignments.mgaTeam, mgaTeam)
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
          await db.delete(qualityManagerTeamAssignments).where(eq2(qualityManagerTeamAssignments.qmEmail, qmEmail));
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
          }).from(mgaTeams).where(eq2(mgaTeams.isActive, true));
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
          }).from(mgaTeams).where(and2(
            eq2(mgaTeams.isActive, true),
            eq2(mgaTeams.teamType, teamType)
          ));
          return teams2;
        } catch (error) {
          console.error(`\u274C Error getting ${teamType} teams:`, error);
          return [];
        }
      }
      async getQualityManagersByTeam(teamId) {
        try {
          const team = await db.select({ name: mgaTeams.name }).from(mgaTeams).where(eq2(mgaTeams.id, teamId)).limit(1);
          if (team.length === 0) {
            return [];
          }
          const assignments = await db.select({ qmEmail: qualityManagerTeamAssignments.qmEmail }).from(qualityManagerTeamAssignments).where(eq2(qualityManagerTeamAssignments.mgaTeam, team[0].name));
          return assignments.map((a) => a.qmEmail);
        } catch (error) {
          console.error("\u274C Error getting quality managers by team:", error);
          return [];
        }
      }
      async assignQMToTeamById(qmEmail, teamId) {
        try {
          const team = await db.select({ name: mgaTeams.name }).from(mgaTeams).where(eq2(mgaTeams.id, teamId)).limit(1);
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
          const team = await db.select({ name: mgaTeams.name }).from(mgaTeams).where(eq2(mgaTeams.id, teamId)).limit(1);
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
    storage = new DatabaseStorage();
  }
});

// server/redis-config.ts
function getRedisUrl() {
  const env = process.env.REDIS_URL?.trim();
  if (env) return env;
  const fallback = HARDCODED_CONFIG.REDIS_URL?.trim();
  if (!fallback) return void 0;
  if (fallback.includes("railway.internal")) {
    const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT) || Boolean(process.env.RAILWAY_SERVICE_ID) || Boolean(process.env.RAILWAY_PROJECT_ID);
    if (!onRailway) return void 0;
  }
  return fallback;
}
var init_redis_config = __esm({
  "server/redis-config.ts"() {
    "use strict";
    init_hardcoded_config();
  }
});

// server/call-log-tracker.ts
async function logCallStarted(client, params) {
  const now = params.startedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const { error } = await client.from("call_log").insert({
    lead_id: params.leadId,
    agent_email: params.agentEmail.toLowerCase(),
    taalk_market: params.taalkMarket ?? null,
    is_plus_lead: params.isPlusLead ?? null,
    call_sid: params.callSid ?? null,
    direction: params.direction ?? "outbound",
    source: params.source,
    started_at: now,
    call_status: "started",
    reached: false,
    connect_id: params.connectId ?? null,
    meeting_id: params.meetingId ?? null
  });
  if (error) {
    console.error("logCallStarted failed", error, params);
  } else {
    console.log(`\u2705 Call logged: ${params.source} call started for lead ${params.leadId} by ${params.agentEmail}`);
  }
}
async function logCallCompleted(client, params) {
  const {
    callSid,
    callStatus,
    reached,
    disposition,
    notes,
    connectedAt,
    endedAt,
    durationSeconds,
    talkSeconds
  } = params;
  const updatePayload = {
    call_status: callStatus,
    reached,
    disposition: disposition ?? null,
    notes: notes ?? null,
    connected_at: connectedAt ?? null,
    ended_at: endedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    duration_seconds: durationSeconds ?? null,
    talk_seconds: talkSeconds ?? null
  };
  const { error } = await client.from("call_log").update(updatePayload).eq("call_sid", callSid);
  if (error) {
    console.error("logCallCompleted failed", error, params);
  } else {
    console.log(`\u2705 Call completed: ${callSid} - ${callStatus} (reached: ${reached})`);
  }
}
var init_call_log_tracker = __esm({
  "server/call-log-tracker.ts"() {
    "use strict";
  }
});

// server/backfill-call-log-from-twilio.ts
var backfill_call_log_from_twilio_exports = {};
__export(backfill_call_log_from_twilio_exports, {
  backfillCallsFromDatabase: () => backfillCallsFromDatabase,
  backfillCallsFromTwilio: () => backfillCallsFromTwilio
});
import twilio6 from "twilio";
async function fetchCallsFromDatabase(startDate, endDate) {
  console.log("\u{1F4CA} Fetching calls from twilio_call_logs table...");
  let query = supabaseAdmin.from("twilio_call_logs").select("twilio_call_sid, owner_email, agent_identity, from_number, to_number, call_status, call_duration, call_started_at, call_ended_at, call_direction, call_source, metadata").order("call_started_at", { ascending: false });
  if (startDate) {
    query = query.gte("call_started_at", startDate.toISOString());
  }
  if (endDate) {
    query = query.lte("call_started_at", endDate.toISOString());
  }
  const { data, error } = await query.limit(1e4);
  if (error) {
    console.error("\u274C Error fetching calls from database:", error);
    return [];
  }
  console.log(`\u2705 Found ${data?.length || 0} calls in twilio_call_logs`);
  return data || [];
}
async function fetchCallsFromTwilio(startDate, endDate, limit = 1e3) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("\u274C Twilio credentials not configured");
    return [];
  }
  console.log("\u{1F4DE} Fetching calls from Twilio API...");
  const client = twilio6(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  try {
    const calls = [];
    let page = await client.calls.list({
      limit,
      startTimeAfter: startDate,
      startTimeBefore: endDate
    });
    calls.push(...page);
    while (page.hasNextPage() && calls.length < limit) {
      page = await page.nextPage();
      calls.push(...page);
    }
    console.log(`\u2705 Fetched ${calls.length} calls from Twilio API`);
    return calls;
  } catch (error) {
    console.error("\u274C Error fetching calls from Twilio:", error);
    return [];
  }
}
async function findLeadByPhone(phoneNumber) {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const { data: exactMatch } = await masterleadClient2.from("masterlead").select("id, taalk_market").eq("phone", cleanPhone).maybeSingle();
  if (exactMatch) {
    return exactMatch;
  }
  const { data: plusOneMatch } = await masterleadClient2.from("masterlead").select("id, taalk_market").eq("phone", `1${cleanPhone}`).maybeSingle();
  if (plusOneMatch) {
    return plusOneMatch;
  }
  if (cleanPhone.length === 11 && cleanPhone.startsWith("1")) {
    const { data: noCountryCode } = await masterleadClient2.from("masterlead").select("id, taalk_market").eq("phone", cleanPhone.substring(1)).maybeSingle();
    if (noCountryCode) {
      return noCountryCode;
    }
  }
  return null;
}
function getAgentEmailFromCall(call) {
  if ("metadata" in call && call.metadata) {
    const metadata = typeof call.metadata === "string" ? JSON.parse(call.metadata) : call.metadata;
    if (metadata.agent_email) {
      return metadata.agent_email;
    }
  }
  if ("owner_email" in call && call.owner_email) {
    return call.owner_email;
  }
  if ("agent_identity" in call && call.agent_identity) {
    const identity = String(call.agent_identity);
    if (identity.startsWith("client:")) {
      return identity.replace("client:", "");
    }
  }
  const fromNumber = "from_number" in call ? call.from_number : "from" in call ? call.from : null;
  if (fromNumber && fromNumber.startsWith("client:")) {
    return fromNumber.replace("client:", "");
  }
  return null;
}
function getCallSourceAndDirection(call, agentEmail) {
  const direction = "direction" in call ? call.direction : "call_direction" in call ? call.call_direction : null;
  const fromNumber = "from_number" in call ? call.from_number : "from" in call ? call.from : null;
  const callSource = "call_source" in call ? call.call_source : null;
  if (fromNumber && fromNumber.startsWith("client:")) {
    return { source: "dialer", direction: "outbound" };
  }
  if (callSource) {
    const sourceMap = {
      "call_connector_pro": "dialer",
      "webrtc_device": "dialer",
      "dialer": "dialer",
      "vdp": "vdp",
      "meet": "meet",
      "hotlead": "hotlead"
    };
    const mappedSource = sourceMap[callSource.toLowerCase()];
    if (mappedSource) {
      return {
        source: mappedSource,
        direction: direction === "inbound" ? "inbound" : "outbound"
      };
    }
  }
  if ("metadata" in call && call.metadata) {
    try {
      const metadata = typeof call.metadata === "string" ? JSON.parse(call.metadata) : call.metadata;
      if (metadata.call_source) {
        const sourceMap = {
          "call_connector_pro": "dialer",
          "dialer": "dialer",
          "vdp": "vdp",
          "meet": "meet",
          "hotlead": "hotlead"
        };
        const mappedSource = sourceMap[metadata.call_source.toLowerCase()];
        if (mappedSource) {
          return {
            source: mappedSource,
            direction: direction === "inbound" ? "inbound" : "outbound"
          };
        }
      }
    } catch (e) {
    }
  }
  if (direction === "inbound") {
    return { source: "manual", direction: "inbound" };
  }
  return { source: "dialer", direction: "outbound" };
}
async function backfillCallsFromDatabase(startDate, endDate) {
  console.log("\u{1F680} Starting call log backfill from database...");
  console.log(`\u{1F4C5} Date range: ${startDate?.toISOString() || "all"} to ${endDate?.toISOString() || "all"}`);
  const calls = await fetchCallsFromDatabase(startDate, endDate);
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  for (const call of calls) {
    try {
      const callSid = call.twilio_call_sid || call.call_sid || call.sid;
      if (!callSid) {
        skipped++;
        continue;
      }
      const { data: existing } = await supabaseAdmin.from("call_log").select("id").eq("call_sid", callSid).maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }
      const agentEmail = getAgentEmailFromCall(call);
      if (!agentEmail) {
        console.warn(`\u26A0\uFE0F No agent email found for call ${callSid}`);
        skipped++;
        continue;
      }
      const toNumber = call.to_number || call.to;
      if (!toNumber) {
        skipped++;
        continue;
      }
      const lead = await findLeadByPhone(toNumber);
      if (!lead) {
        skipped++;
        continue;
      }
      const { source, direction } = getCallSourceAndDirection(call, agentEmail);
      const taalkMarket = lead.taalk_market || null;
      const isPlusLead = taalkMarket && (taalkMarket.toLowerCase() === "plus lead" || taalkMarket.toLowerCase() === "plus leads");
      const callStatus = call.call_status || call.status || "completed";
      const reached = callStatus === "completed" || callStatus === "answered" || callStatus === "in-progress";
      const durationSeconds = call.call_duration || call.duration ? parseInt(String(call.call_duration || call.duration), 10) : null;
      const startedAt = call.call_started_at || call.startTime?.toISOString() || (/* @__PURE__ */ new Date()).toISOString();
      const endedAt = call.call_ended_at || call.endTime?.toISOString() || null;
      await logCallStarted(supabaseAdmin, {
        leadId: lead.id,
        agentEmail,
        taalkMarket,
        isPlusLead,
        callSid,
        source,
        direction,
        startedAt
      });
      if (callStatus !== "started" && callStatus !== "ringing" && callStatus !== "queued" && callStatus !== "initiated") {
        let disposition = null;
        try {
          const { data: leadData } = await masterleadClient2.from("masterlead").select("cnresolution").eq("id", lead.id).maybeSingle();
          if (leadData?.cnresolution) {
            disposition = leadData.cnresolution;
          }
        } catch (dispositionError) {
        }
        await logCallCompleted(supabaseAdmin, {
          callSid,
          callStatus,
          reached,
          disposition,
          notes: null,
          connectedAt: reached ? startedAt : null,
          endedAt: endedAt || (/* @__PURE__ */ new Date()).toISOString(),
          durationSeconds,
          talkSeconds: durationSeconds
        });
      }
      processed++;
      if (processed % 100 === 0) {
        console.log(`\u{1F4CA} Processed ${processed} calls...`);
      }
    } catch (error) {
      console.error(`\u274C Error processing call ${call.twilio_call_sid || call.call_sid}:`, error);
      errors++;
    }
  }
  console.log(`\u2705 Backfill complete! Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
  return { processed, skipped, errors };
}
async function backfillCallsFromTwilio(startDate, endDate, limit = 1e3) {
  console.log("\u{1F680} Starting call log backfill from Twilio API...");
  console.log(`\u{1F4C5} Date range: ${startDate?.toISOString() || "all"} to ${endDate?.toISOString() || "all"}`);
  const calls = await fetchCallsFromTwilio(startDate, endDate, limit);
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  for (const call of calls) {
    try {
      const { data: existing } = await supabaseAdmin.from("call_log").select("id").eq("call_sid", call.sid).maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }
      let agentEmail = null;
      const { data: existingCall } = await supabaseAdmin.from("twilio_call_logs").select("owner_email, agent_identity, metadata").eq("twilio_call_sid", call.sid).maybeSingle();
      if (existingCall) {
        agentEmail = getAgentEmailFromCall(existingCall);
      }
      if (!agentEmail) {
        if (call.from && call.from.startsWith("client:")) {
          agentEmail = call.from.replace("client:", "");
        }
      }
      if (!agentEmail) {
        console.warn(`\u26A0\uFE0F No agent email found for call ${call.sid}`);
        skipped++;
        continue;
      }
      if (!call.to) {
        skipped++;
        continue;
      }
      const lead = await findLeadByPhone(call.to);
      if (!lead) {
        console.warn(`\u26A0\uFE0F No lead found for phone ${call.to}`);
        skipped++;
        continue;
      }
      const { source, direction } = getCallSourceAndDirection(call, agentEmail);
      const taalkMarket = lead.taalk_market || null;
      const isPlusLead = taalkMarket && (taalkMarket.toLowerCase() === "plus lead" || taalkMarket.toLowerCase() === "plus leads");
      const callStatus = call.status || "completed";
      const reached = callStatus === "completed";
      const durationSeconds = call.duration ? parseInt(call.duration, 10) : null;
      await logCallStarted(supabaseAdmin, {
        leadId: lead.id,
        agentEmail,
        taalkMarket,
        isPlusLead,
        callSid: call.sid,
        source,
        direction,
        startedAt: call.startTime?.toISOString() || call.dateCreated?.toISOString() || (/* @__PURE__ */ new Date()).toISOString()
      });
      if (callStatus !== "started" && callStatus !== "ringing" && callStatus !== "queued" && callStatus !== "initiated") {
        let disposition = null;
        try {
          const { data: leadData } = await masterleadClient2.from("masterlead").select("cnresolution").eq("id", lead.id).maybeSingle();
          if (leadData?.cnresolution) {
            disposition = leadData.cnresolution;
          }
        } catch (dispositionError) {
        }
        await logCallCompleted(supabaseAdmin, {
          callSid: call.sid,
          callStatus,
          reached,
          disposition,
          notes: null,
          connectedAt: reached ? call.startTime?.toISOString() || null : null,
          endedAt: call.endTime?.toISOString() || call.dateUpdated?.toISOString() || (/* @__PURE__ */ new Date()).toISOString(),
          durationSeconds,
          talkSeconds: durationSeconds
        });
      }
      processed++;
      if (processed % 100 === 0) {
        console.log(`\u{1F4CA} Processed ${processed} calls...`);
      }
    } catch (error) {
      console.error(`\u274C Error processing call ${call.sid}:`, error);
      errors++;
    }
  }
  console.log(`\u2705 Backfill complete! Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
  return { processed, skipped, errors };
}
var init_backfill_call_log_from_twilio = __esm({
  "server/backfill-call-log-from-twilio.ts"() {
    "use strict";
    init_supabase();
    init_local_masterlead_client();
    init_call_log_tracker();
    init_hardcoded_config();
  }
});

// server/backfill-call-analytics-table.ts
var backfill_call_analytics_table_exports = {};
__export(backfill_call_analytics_table_exports, {
  backfillCallAnalyticsTable: () => backfillCallAnalyticsTable
});
function parseArgs() {
  const args = process.argv.slice(2);
  let days = 90;
  let limit = 1e4;
  for (const a of args) {
    if (a.startsWith("--days=")) days = parseInt(a.split("=")[1], 10) || 90;
    if (a.startsWith("--limit=")) limit = parseInt(a.split("=")[1], 10) || 1e4;
  }
  return { days, limit };
}
async function backfillFromTwilio(days, limit) {
  console.log("\n\u{1F4DE} Backfilling from twilio_call_logs (ONLY calls with Supabase recording)...");
  const start = /* @__PURE__ */ new Date();
  start.setDate(start.getDate() - days);
  const { data: twilioCalls, error: twErr } = await supabaseAdmin.from("twilio_call_logs").select("twilio_call_sid, owner_email, to_number, call_started_at, call_duration, call_direction, recording_url, parent_call_sid").gte("call_started_at", start.toISOString()).in("call_direction", ["outbound"]).in("call_status", ["answered", "completed"]).not("recording_url", "is", null).ilike("recording_url", "%supabase%").order("call_started_at", { ascending: false }).limit(limit);
  if (twErr) {
    console.error("\u274C Error fetching twilio_call_logs:", twErr);
    return { inserted: 0, updated: 0, errors: 1 };
  }
  const sids = (twilioCalls || []).map((c) => c.twilio_call_sid);
  const { data: existing } = await supabaseAdmin.from("taalk_call_analytics").select("taalk_call_id").in("taalk_call_id", sids);
  const existingBySid = new Set((existing || []).map((r) => r.taalk_call_id));
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  for (const c of twilioCalls || []) {
    try {
      const sid = c.twilio_call_sid;
      const agentEmail = c.owner_email || "unknown";
      const existingRow = existingBySid.has(sid);
      if (!existingRow) {
        const { error: insErr } = await supabaseAdmin.from("taalk_call_analytics").insert({
          billing_transaction_id: `twilio-${sid}`,
          taalk_call_id: sid,
          agent_email: agentEmail,
          call_date: c.call_started_at || (/* @__PURE__ */ new Date()).toISOString(),
          call_duration: c.call_duration > 0 ? c.call_duration : null,
          analysis_status: "pending"
        });
        if (!insErr) {
          inserted++;
          existingBySid.add(sid);
        } else {
          if (insErr.code === "23505") existingBySid.add(sid);
          else errors++;
        }
      }
    } catch (e) {
      errors++;
      if (errors <= 3) console.error("\u274C Error processing", c.twilio_call_sid, e?.message);
    }
  }
  console.log(`   Twilio: ${inserted} inserted, ${updated} updated, ${errors} errors`);
  return { inserted, updated, errors };
}
async function backfillFromTaalk(days, limit) {
  console.log("\n\u{1F4CB} Backfilling from billing_transactions + vdp_calls (Taalk)...");
  const start = /* @__PURE__ */ new Date();
  start.setDate(start.getDate() - days);
  const { data: bt, error: btErr } = await supabaseAdmin.from("billing_transactions").select("transaction_id, agent_email, transaction_date, source_id, source_table, metadata").eq("transaction_type", "connect").eq("source_table", "vdp_calls").gte("transaction_date", start.toISOString()).order("transaction_date", { ascending: false }).limit(limit);
  if (btErr) {
    console.error("\u274C Error fetching billing_transactions:", btErr);
    return { inserted: 0, updated: 0, errors: 1 };
  }
  const transactionIds = (bt || []).map((t) => t.transaction_id);
  const { data: existing } = await supabaseAdmin.from("taalk_call_analytics").select("billing_transaction_id").in("billing_transaction_id", transactionIds);
  const existingById = new Set((existing || []).map((r) => r.billing_transaction_id));
  let inserted = 0;
  let errors = 0;
  for (const t of bt || []) {
    try {
      const taalkCallId = t.metadata?.sessionID || t.metadata?.taalk_call_id || null;
      if (!taalkCallId) continue;
      const agentEmail = t.agent_email || "unknown";
      if (existingById.has(t.transaction_id)) continue;
      const { error: insErr } = await supabaseAdmin.from("taalk_call_analytics").insert({
        billing_transaction_id: t.transaction_id,
        taalk_call_id: taalkCallId,
        agent_email: agentEmail,
        call_date: t.transaction_date || (/* @__PURE__ */ new Date()).toISOString(),
        analysis_status: "pending"
      });
      if (!insErr) {
        inserted++;
        existingById.add(t.transaction_id);
      } else if (insErr.code !== "23505") errors++;
    } catch (e) {
      errors++;
      if (errors <= 3) console.error("\u274C Error processing", t.transaction_id, e?.message);
    }
  }
  console.log(`   Taalk: ${inserted} inserted, ${errors} errors`);
  return { inserted, updated: 0, errors };
}
async function enrichExistingRows(_days, _limit) {
  console.log("\n\u{1F527} Enrich step skipped (run migration first for denormalized columns)");
  return 0;
}
async function backfillCallAnalyticsTable(days = 90, limit = 1e4) {
  const twResult = await backfillFromTwilio(days, limit);
  const taResult = await backfillFromTaalk(days, limit);
  const enriched = await enrichExistingRows(days, limit);
  return { twilio: twResult, taalk: taResult, enriched };
}
async function main() {
  const { days, limit } = parseArgs();
  console.log(`
\u{1F680} Backfilling call analytics table (last ${days} days, limit ${limit})`);
  if (!supabaseAdmin) {
    console.error("\u274C Supabase admin client not available");
    process.exit(1);
  }
  const result = await backfillCallAnalyticsTable(days, limit);
  console.log("\n\u2705 Backfill complete:", result);
}
var init_backfill_call_analytics_table = __esm({
  "server/backfill-call-analytics-table.ts"() {
    "use strict";
    init_supabase();
    if (process.argv[1]?.includes("backfill-call-analytics-table")) {
      main().catch((e) => {
        console.error("\u274C Fatal:", e);
        process.exit(1);
      });
    }
  }
});

// server/call-analytics-transcript-upload.ts
var call_analytics_transcript_upload_exports = {};
__export(call_analytics_transcript_upload_exports, {
  uploadTranscriptToSupabase: () => uploadTranscriptToSupabase
});
async function uploadTranscriptToSupabase(billingTransactionId, transcript) {
  if (!transcript || !transcript.trim()) {
    console.warn(`\u26A0\uFE0F Skipping transcript upload - empty transcript for ${billingTransactionId}`);
    return null;
  }
  const safeId = billingTransactionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${TRANSCRIPTS_PREFIX}/${safeId}.txt`;
  try {
    const buffer = Buffer.from(transcript, "utf-8");
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(fileName, buffer, {
      contentType: "text/plain; charset=utf-8",
      upsert: true
    });
    if (uploadError) {
      console.error(`\u274C Transcript upload failed for ${billingTransactionId}:`, uploadError);
      return null;
    }
    const { data: urlData, error: urlError } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(fileName, 63072e3);
    if (urlError || !urlData?.signedUrl) {
      console.warn(`\u26A0\uFE0F Transcript uploaded but signed URL failed for ${billingTransactionId}:`, urlError);
      return fileName;
    }
    console.log(`\u2705 Uploaded full transcript to Supabase: ${fileName}`);
    return urlData.signedUrl;
  } catch (e) {
    console.error(`\u274C Transcript upload error for ${billingTransactionId}:`, e?.message);
    return null;
  }
}
var BUCKET, TRANSCRIPTS_PREFIX;
var init_call_analytics_transcript_upload = __esm({
  "server/call-analytics-transcript-upload.ts"() {
    "use strict";
    init_supabase();
    BUCKET = "verify_agent_screenshot";
    TRANSCRIPTS_PREFIX = "call-analysis/transcripts";
  }
});

// server/recording-downloader-scheduler.ts
var recording_downloader_scheduler_exports = {};
__export(recording_downloader_scheduler_exports, {
  recordingDownloaderScheduler: () => recordingDownloaderScheduler
});
async function downloadNewRecordings2() {
  console.log(`
\u{1F504} [${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Recording Downloader: Checking for new recordings...`);
  try {
    const { data: sessions, error } = await supabaseAdmin.from("verification_sessions").select("id, session_id, taalk_call_id, taalk_call_url, recording_url, status").not("taalk_call_id", "is", null).or("recording_url.is.null,recording_url.eq.,recording_url.eq.PENDING,recording_url.eq.PROCESSING,recording_url.like.%api.taalk.ai%").gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString()).limit(100);
    if (error) {
      console.error("\u274C Recording Downloader: Database query error:", error);
      return;
    }
    if (!sessions || sessions.length === 0) {
      console.log("\u2705 Recording Downloader: No new recordings to download");
      return;
    }
    console.log(`\u{1F4E5} Recording Downloader: Found ${sessions.length} sessions to download`);
    let successCount = 0;
    let failCount = 0;
    for (const session of sessions) {
      try {
        const callId = session.taalk_call_id;
        const taalkRecordingUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        let response = await fetch(taalkRecordingUrl, {
          headers: {
            "Authorization": `Bearer ${TAALK_API_KEY3}`,
            "Accept": "audio/mpeg, audio/mp3, audio/*, */*"
          }
        });
        if (!response.ok) {
          const basicAuth = Buffer.from("michaelmandella@aoglobelife.com:Aoletsgrow24!").toString("base64");
          response = await fetch(taalkRecordingUrl, {
            headers: {
              "Authorization": `Basic ${basicAuth}`,
              "Accept": "audio/mpeg"
            }
          });
        }
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const fileName = `recordings/${callId}.mp3`;
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage.from("verify_agent_screenshot").upload(fileName, buffer, {
            contentType: "audio/mpeg",
            upsert: true
          });
          if (uploadError) {
            console.error(`  \u274C Recording Downloader: Upload failed for ${session.session_id}:`, uploadError.message);
            failCount++;
            continue;
          }
          const { data: signedData, error: signedError } = await supabaseAdmin.storage.from("verify_agent_screenshot").createSignedUrl(fileName, 63072e3);
          const signedUrl = signedData?.signedUrl || null;
          await supabaseAdmin.from("verification_sessions").update({
            taalk_call_url: fileName,
            // Store Supabase storage path
            recording_url: signedUrl,
            // Store 2-year signed URL
            taalk_call_status: "completed",
            taalk_call_completed_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", session.id);
          console.log(`  \u2705 Recording Downloader: Downloaded ${session.session_id} (${Math.round(buffer.length / 1024)}KB)`);
          successCount++;
        } else {
          console.log(`  \u26A0\uFE0F Recording Downloader: Taalk returned ${response.status} for ${session.session_id}`);
          failCount++;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error2) {
        console.error(`  \u274C Recording Downloader: Error processing ${session.session_id}:`, error2.message);
        failCount++;
      }
    }
    if (successCount > 0 || failCount > 0) {
      console.log(`\u{1F4CA} Recording Downloader Summary: \u2705 ${successCount} downloaded, \u274C ${failCount} failed`);
    }
  } catch (error) {
    console.error("\u274C Recording Downloader: Fatal error:", error);
  }
}
var TAALK_API_KEY3, recordingDownloaderScheduler;
var init_recording_downloader_scheduler = __esm({
  "server/recording-downloader-scheduler.ts"() {
    "use strict";
    init_supabase();
    TAALK_API_KEY3 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    recordingDownloaderScheduler = {
      start: () => {
        console.log("\u{1F3B5} Recording Downloader Scheduler Started");
        console.log("\u23F0 Downloading new PreCheck recordings every 5 minutes");
        downloadNewRecordings2();
        setInterval(() => {
          downloadNewRecordings2();
        }, 5 * 60 * 1e3);
      }
    };
  }
});

// server/job-queue.ts
var job_queue_exports = {};
__export(job_queue_exports, {
  enqueueJob: () => enqueueJob,
  getJobResult: () => getJobResult,
  setJobResult: () => setJobResult,
  startJobWorker: () => startJobWorker
});
import { createClient as createClient3 } from "redis";
async function getClient() {
  if (_client) return _client;
  const url = getRedisUrl();
  if (!url) throw new Error("REDIS_URL not configured (set REDIS_URL or hardcoded-config REDIS_URL)");
  _client = createClient3({ url });
  _client.on("error", (err) => console.error("[JobQueue] Redis error:", err.message));
  await _client.connect();
  return _client;
}
async function enqueueJob(type, payload = {}, createdBy) {
  const client = await getClient();
  const job = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    createdBy
  };
  await client.lPush(QUEUE_KEY, JSON.stringify(job));
  console.log(`[JobQueue] Enqueued job ${job.id} (${type})`);
  return job.id;
}
async function setJobResult(jobId, result) {
  const client = await getClient();
  await client.setEx(`${RESULTS_KEY}:${jobId}`, RESULT_TTL, JSON.stringify(result));
}
async function getJobResult(jobId) {
  const client = await getClient();
  const val = await client.get(`${RESULTS_KEY}:${jobId}`);
  return val ? JSON.parse(val) : null;
}
async function startJobWorker() {
  console.log("[JobQueue] Worker started \u2014 listening for jobs...");
  const client = await getClient();
  while (true) {
    try {
      const result = await client.brPop(QUEUE_KEY, 5);
      if (!result) continue;
      const job = JSON.parse(result.element);
      console.log(`[JobQueue] Processing job ${job.id} (${job.type})`);
      try {
        await runJob(job);
        await setJobResult(job.id, { status: "done", message: "Completed successfully" });
        console.log(`[JobQueue] \u2705 Job ${job.id} done`);
      } catch (err) {
        console.error(`[JobQueue] \u274C Job ${job.id} failed:`, err.message);
        await setJobResult(job.id, { status: "error", message: err.message });
      }
    } catch (err) {
      console.error("[JobQueue] Worker loop error:", err.message);
      await new Promise((r) => setTimeout(r, 2e3));
    }
  }
}
async function runJob(job) {
  const { supabaseAdmin: supabaseAdmin3 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
  switch (job.type) {
    case "backfill-billing-transactions": {
      const { billingTransactionSync: billingTransactionSync2 } = await Promise.resolve().then(() => (init_billing_transaction_sync(), billing_transaction_sync_exports));
      await billingTransactionSync2.runOnce?.();
      break;
    }
    case "backfill-call-log": {
      const mod = await Promise.resolve().then(() => (init_backfill_call_log_from_twilio(), backfill_call_log_from_twilio_exports));
      await mod.run?.();
      break;
    }
    case "backfill-call-analytics": {
      const mod = await Promise.resolve().then(() => (init_backfill_call_analytics_table(), backfill_call_analytics_table_exports));
      await mod.run?.();
      break;
    }
    case "backfill-twilio-parent-to-number": {
      if (!supabaseAdmin3) throw new Error("Supabase not configured");
      const { data: calls } = await supabaseAdmin3.from("twilio_call_logs").select("twilio_call_sid, parent_call_sid").is("to_number", null).not("parent_call_sid", "is", null).limit(job.payload.limit || 100);
      if (!calls?.length) break;
      const twilio7 = (await import("twilio")).default;
      const { TWILIO_ACCOUNT_SID: TWILIO_ACCOUNT_SID2, TWILIO_AUTH_TOKEN: TWILIO_AUTH_TOKEN2 } = await Promise.resolve().then(() => (init_hardcoded_config(), hardcoded_config_exports));
      const client = twilio7(TWILIO_ACCOUNT_SID2, TWILIO_AUTH_TOKEN2);
      let fixed = 0;
      for (const call of calls) {
        try {
          const tc = await client.calls(call.twilio_call_sid).fetch();
          if (tc.to) {
            await supabaseAdmin3.from("twilio_call_logs").update({ to_number: tc.to }).eq("twilio_call_sid", call.twilio_call_sid);
            fixed++;
          }
        } catch {
        }
      }
      console.log(`[JobQueue] backfill-twilio-parent-to-number: fixed ${fixed}/${calls.length}`);
      break;
    }
    case "backfill-twilio-child-recording-url": {
      if (!supabaseAdmin3) throw new Error("Supabase not configured");
      const { data: calls } = await supabaseAdmin3.from("twilio_call_logs").select("twilio_call_sid").is("recording_url", null).eq("call_direction", "outbound").limit(job.payload.limit || 50);
      if (!calls?.length) break;
      const twilio7 = (await import("twilio")).default;
      const { TWILIO_ACCOUNT_SID: TWILIO_ACCOUNT_SID2, TWILIO_AUTH_TOKEN: TWILIO_AUTH_TOKEN2 } = await Promise.resolve().then(() => (init_hardcoded_config(), hardcoded_config_exports));
      const client = twilio7(TWILIO_ACCOUNT_SID2, TWILIO_AUTH_TOKEN2);
      let fixed = 0;
      for (const call of calls) {
        try {
          const recordings = await client.recordings.list({ callSid: call.twilio_call_sid, limit: 1 });
          if (recordings[0]) {
            const url = `https://api.twilio.com${recordings[0].uri.replace(".json", ".mp3")}`;
            await supabaseAdmin3.from("twilio_call_logs").update({ recording_url: url }).eq("twilio_call_sid", call.twilio_call_sid);
            fixed++;
          }
        } catch {
        }
      }
      console.log(`[JobQueue] backfill-twilio-child-recording-url: fixed ${fixed}/${calls.length}`);
      break;
    }
    case "backfill-twilio-call-numbers":
    case "backfill-owner-email": {
      console.log(`[JobQueue] ${job.type} not yet implemented in worker`);
      break;
    }
    case "ai-screenshot-analysis": {
      const { sessionId } = job.payload;
      if (!sessionId) throw new Error("Missing sessionId");
      const { verificationAnalysisScheduler: verificationAnalysisScheduler2 } = await Promise.resolve().then(() => (init_verification_analysis_scheduler(), verification_analysis_scheduler_exports));
      await verificationAnalysisScheduler2.analyzeSession?.(sessionId);
      break;
    }
    case "transcript-sync": {
      const { sessionId } = job.payload;
      if (!sessionId) throw new Error("Missing sessionId");
      const mod = await Promise.resolve().then(() => (init_call_analytics_transcript_upload(), call_analytics_transcript_upload_exports));
      await mod.syncTranscript?.(sessionId);
      break;
    }
    case "recording-download": {
      const { sessionId } = job.payload;
      if (!sessionId) throw new Error("Missing sessionId");
      const mod = await Promise.resolve().then(() => (init_recording_downloader_scheduler(), recording_downloader_scheduler_exports));
      await mod.downloadRecording?.(sessionId);
      break;
    }
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}
var QUEUE_KEY, RESULTS_KEY, RESULT_TTL, _client;
var init_job_queue = __esm({
  "server/job-queue.ts"() {
    "use strict";
    init_redis_config();
    QUEUE_KEY = "aoirail:jobs";
    RESULTS_KEY = "aoirail:job_results";
    RESULT_TTL = 60 * 60;
    _client = null;
  }
});

// server/feature-flags.ts
function isWorkersGloballyEnabled() {
  return process.env.ENABLE_WORKERS !== "false";
}

// server/twilio-auto-sync.js
init_supabase();
init_hardcoded_config();
init_db();
import twilio from "twilio";
var BOOKED_RESOLUTIONS = [
  "booked",
  "appointment",
  "appointment_set",
  "set_appointment",
  "qualified",
  "callback_scheduled",
  "meet",
  "sale"
];
function normalizePhone2(raw) {
  return String(raw || "").replace(/\D/g, "").slice(-10);
}
var TwilioAutoSync = class {
  constructor() {
    this.running = false;
    this.interval = null;
    this.lastRunAt = null;
    this.lastError = null;
    this.twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  async runOnce() {
    if (!supabaseAdmin) return;
    const startedAt = Date.now();
    try {
      let toFix = 0, dialReach = 0, booked = 0;
      try {
        toFix = await this.fixMissingToNumbers(36);
      } catch (e) {
        console.error("TwilioAutoSync fixMissingToNumbers failed:", e.message);
      }
      try {
        dialReach = await this.syncDialReachMetrics(24);
      } catch (e) {
        console.error("TwilioAutoSync syncDialReachMetrics failed:", e.message);
      }
      try {
        booked = await this.syncBookedMetrics(48);
      } catch (e) {
        console.error("TwilioAutoSync syncBookedMetrics failed:", e.message);
      }
      this.lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
      this.lastError = null;
      console.log(`\u2705 TwilioAutoSync cycle complete in ${Date.now() - startedAt}ms | to_number_fixed=${toFix} dial/reach_inserted=${dialReach} booked_inserted=${booked}`);
    } catch (error) {
      this.lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error("\u274C TwilioAutoSync cycle failed:", error);
    }
  }
  startAutoSync(intervalMs = 6e4) {
    if (this.running) return;
    this.running = true;
    this.runOnce().catch(() => {
    });
    this.interval = setInterval(() => {
      this.runOnce().catch(() => {
      });
    }, intervalMs);
    console.log(`\u{1F504} TwilioAutoSync started (every ${Math.round(intervalMs / 1e3)}s)`);
  }
  stopAutoSync() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.running = false;
    console.log("\u{1F6D1} TwilioAutoSync stopped");
  }
  // Backward compatibility with old callers
  start() {
    this.startAutoSync();
  }
  stop() {
    this.stopAutoSync();
  }
  async fixExistingAttributions() {
    return this.fixMissingToNumbers(168);
  }
  getStatus() {
    return {
      running: this.running,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError
    };
  }
  async fixMissingToNumbers(hoursBack = 36) {
    const end = /* @__PURE__ */ new Date();
    const start = new Date(end.getTime() - hoursBack * 60 * 60 * 1e3);
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const parentRows = [];
    const pageSize = 1e3;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin.from("twilio_call_logs").select("id,twilio_call_sid,to_number,call_started_at,call_direction").gte("call_started_at", startIso).lt("call_started_at", endIso).eq("call_direction", "outbound").or("to_number.is.null,to_number.eq.").range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      parentRows.push(...rows);
      if (rows.length < pageSize) break;
    }
    if (parentRows.length === 0) return 0;
    const parentBySid = /* @__PURE__ */ new Map();
    for (const row of parentRows) {
      const sid = String(row.twilio_call_sid || "").trim();
      if (sid) parentBySid.set(sid, Number(row.id));
    }
    const startDate = new Date(start.toISOString());
    const endDate = new Date(end.toISOString());
    const twilioCalls = await this.twilioClient.calls.list({
      startTimeAfter: startDate,
      startTimeBefore: endDate,
      pageSize: 1e3,
      limit: 1e5
    });
    const toById = /* @__PURE__ */ new Map();
    for (const call of twilioCalls) {
      const parentSid = String(call.parentCallSid || "").trim();
      if (!parentSid) continue;
      const id = parentBySid.get(parentSid);
      const to = String(call.to || "").trim();
      if (!id || !to) continue;
      if (!toById.has(id)) toById.set(id, to);
    }
    const entries = [...toById.entries()];
    let updated = 0;
    const byToNumber = /* @__PURE__ */ new Map();
    for (const [id, to] of entries) {
      if (!byToNumber.has(to)) byToNumber.set(to, []);
      byToNumber.get(to).push(id);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const [to, ids] of byToNumber.entries()) {
      const { error, count: count2 } = await supabaseAdmin.from("twilio_call_logs").update({ to_number: to, updated_at: now }).in("id", ids);
      if (!error) updated += ids.length;
    }
    return updated;
  }
  async syncDialReachMetrics(hoursBack = 24) {
    const end = /* @__PURE__ */ new Date();
    const start = new Date(end.getTime() - hoursBack * 60 * 60 * 1e3);
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const existing = /* @__PURE__ */ new Set();
    let offset = 0;
    while (true) {
      const { rows } = await leaseDialerPool.query(
        `SELECT call_sid, event_type FROM agent_dial_metrics WHERE source = 'twilio_auto_sync' AND event_timestamp >= $1 AND event_timestamp < $2 LIMIT 1000 OFFSET $3`,
        [startIso, endIso, offset]
      );
      for (const row of rows) {
        existing.add(`${String(row.call_sid || "")}:${String(row.event_type || "")}`);
      }
      if (rows.length < 1e3) break;
      offset += 1e3;
    }
    const inserts = [];
    let tclOffset = 0;
    while (true) {
      const { rows } = await leaseDialerPool.query(
        `SELECT owner_email, to_number, call_duration, call_status, call_started_at, twilio_call_sid FROM twilio_call_logs WHERE call_direction='outbound' AND call_started_at >= $1 AND call_started_at < $2 AND owner_email IS NOT NULL AND owner_email <> '' AND to_number IS NOT NULL AND to_number <> '' ORDER BY call_started_at DESC LIMIT 1000 OFFSET $3`,
        [startIso, endIso, tclOffset]
      );
      for (const row of rows) {
        const email = String(row.owner_email || "").toLowerCase().trim();
        const phone = normalizePhone2(row.to_number);
        const status = String(row.call_status || "").toLowerCase();
        const duration = Number(row.call_duration || 0);
        const sid = String(row.twilio_call_sid || "").trim();
        const ts = row.call_started_at instanceof Date ? row.call_started_at.toISOString() : String(row.call_started_at || "");
        if (!email || phone.length !== 10 || !sid || !ts) continue;
        const answeredOrCompleted = status === "answered" || status === "completed";
        const excluded = ["failed", "busy", "no-answer", "canceled"].includes(status) && !answeredOrCompleted;
        const isDial = (duration >= 1 || answeredOrCompleted) && !excluded;
        const isReach = duration >= 55 && answeredOrCompleted;
        if (isDial) {
          const key = `${sid}:dial`;
          if (!existing.has(key)) {
            existing.add(key);
            inserts.push({
              agent_email: email,
              lead_phone: phone,
              event_type: "dial",
              event_timestamp: ts,
              call_duration: duration > 0 ? duration : null,
              call_status: status || null,
              call_sid: sid,
              source: "twilio_auto_sync",
              disposition: null
            });
          }
        }
        if (isReach) {
          const key = `${sid}:reach`;
          if (!existing.has(key)) {
            existing.add(key);
            inserts.push({
              agent_email: email,
              lead_phone: phone,
              event_type: "reach",
              event_timestamp: ts,
              call_duration: duration > 0 ? duration : null,
              call_status: status || null,
              call_sid: sid,
              source: "twilio_auto_sync",
              disposition: "connected"
            });
          }
        }
      }
      if (rows.length < 1e3) break;
      tclOffset += 1e3;
    }
    const cols = ["agent_email", "lead_phone", "event_type", "event_timestamp", "call_duration", "call_status", "call_sid", "source", "disposition"];
    let inserted = 0;
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100);
      const placeholders = chunk.map(
        (_, ri) => `(${cols.map((_2, ci) => `$${ri * cols.length + ci + 1}`).join(", ")})`
      ).join(", ");
      const values = chunk.flatMap((r) => cols.map((c) => r[c] !== void 0 ? r[c] : null));
      await leaseDialerPool.query(
        `INSERT INTO agent_dial_metrics (${cols.join(", ")}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        values
      );
      inserted += chunk.length;
      await new Promise((r) => setTimeout(r, 200));
    }
    return inserted;
  }
  async syncBookedMetrics(hoursBack = 48) {
    const end = /* @__PURE__ */ new Date();
    const start = new Date(end.getTime() - hoursBack * 60 * 60 * 1e3);
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const existing = /* @__PURE__ */ new Set();
    let offset = 0;
    while (true) {
      const { rows } = await leaseDialerPool.query(
        `SELECT agent_email, lead_id, lead_phone, event_timestamp FROM agent_dial_metrics WHERE event_type = 'booked' AND event_timestamp >= $1 AND event_timestamp < $2 LIMIT 1000 OFFSET $3`,
        [startIso, endIso, offset]
      );
      for (const row of rows) {
        const email = String(row.agent_email || "").toLowerCase().trim();
        const leadId = Number(row.lead_id || 0) || 0;
        const phone = normalizePhone2(row.lead_phone);
        const day = String(row.event_timestamp || "").slice(0, 10);
        if (!email || !day) continue;
        if (leadId > 0) {
          existing.add(`id:${email}:${leadId}:${day}`);
        } else if (phone.length === 10) {
          existing.add(`phone:${email}:${phone}:${day}`);
        }
      }
      if (rows.length < 1e3) break;
      offset += 1e3;
    }
    const inserts = [];
    const resolutionPlaceholders = BOOKED_RESOLUTIONS.map((_, i) => `$${i + 3}`).join(", ");
    let mlOffset = 0;
    while (true) {
      const { rows } = await leaseDialerPool.query(
        `SELECT id, cn_email, phone, first_name, last_name, state, cnresolution, updated_at FROM masterlead WHERE cnresolution IN (${resolutionPlaceholders}) AND updated_at >= $1 AND updated_at < $2 ORDER BY updated_at DESC LIMIT 1000 OFFSET $${BOOKED_RESOLUTIONS.length + 3}`,
        [startIso, endIso, ...BOOKED_RESOLUTIONS, mlOffset]
      );
      for (const row of rows) {
        const email = String(row.cn_email || "").toLowerCase().trim();
        const phone = normalizePhone2(row.phone);
        const leadId = Number(row.id || 0) || null;
        const ts = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || "");
        if (!email || phone.length !== 10 || !leadId || !ts) continue;
        const day = ts.slice(0, 10);
        const key = `id:${email}:${leadId}:${day}`;
        const phoneKey = `phone:${email}:${phone}:${day}`;
        if (existing.has(key)) continue;
        if (existing.has(phoneKey)) continue;
        existing.add(key);
        existing.add(phoneKey);
        inserts.push({
          agent_email: email,
          lead_id: leadId,
          lead_phone: phone,
          lead_name: `${String(row.first_name || "").trim()} ${String(row.last_name || "").trim()}`.trim() || null,
          lead_state: String(row.state || "").trim().toUpperCase() || null,
          event_type: "booked",
          event_timestamp: ts,
          disposition: String(row.cnresolution || "booked").toLowerCase(),
          source: "twilio_auto_sync_booked",
          notes: "Auto-synced from masterlead resolution"
        });
      }
      if (rows.length < 1e3) break;
      mlOffset += 1e3;
    }
    const cols = ["agent_email", "lead_id", "lead_phone", "lead_name", "lead_state", "event_type", "event_timestamp", "disposition", "source", "notes"];
    let inserted = 0;
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100);
      const placeholders = chunk.map(
        (_, ri) => `(${cols.map((_2, ci) => `$${ri * cols.length + ci + 1}`).join(", ")})`
      ).join(", ");
      const values = chunk.flatMap((r) => cols.map((c) => r[c] !== void 0 ? r[c] : null));
      await leaseDialerPool.query(
        `INSERT INTO agent_dial_metrics (${cols.join(", ")}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        values
      );
      inserted += chunk.length;
      await new Promise((r) => setTimeout(r, 200));
    }
    return inserted;
  }
  async refreshLiveCallBoard() {
    try {
      const { liveCallBoardStatsScheduler: liveCallBoardStatsScheduler2 } = await Promise.resolve().then(() => (init_live_call_board_stats_scheduler(), live_call_board_stats_scheduler_exports));
      await liveCallBoardStatsScheduler2.triggerUpdate();
      const { rebuildAllLiveSnapshots: rebuildAllLiveSnapshots2 } = await Promise.resolve().then(() => (init_public_live_card_service(), public_live_card_service_exports));
      await rebuildAllLiveSnapshots2();
    } catch (error) {
      console.warn("\u26A0\uFE0F live_call_boardt refresh skipped:", error?.message || error);
    }
  }
};
var twilioAutoSync = new TwilioAutoSync();

// server/background-workers.ts
init_hot_table_mode();
var JOB_WEBHOOKS_ENABLED4 = String(process.env.ENABLE_ZAPIER_JOB_WEBHOOKS || "").toLowerCase() === "true";
async function startBackgroundWorkers() {
  if (process.env.ENABLE_WORKERS === "false") {
    console.log("\u23ED\uFE0F ENABLE_WORKERS=false \u2014 background workers not started");
    return;
  }
  console.log("\u{1F4B0} Starting VDP Credit Enforcer...");
  try {
    const { vdpCreditEnforcer: vdpCreditEnforcer2 } = await Promise.resolve().then(() => (init_vdp_credit_enforcer(), vdp_credit_enforcer_exports));
    vdpCreditEnforcer2.start();
    console.log("\u2705 VDP Credit Enforcer started - checking every 10 minutes");
  } catch (error) {
    console.warn("\u26A0\uFE0F VDP Credit Enforcer failed to start (non-critical):", error);
  }
  console.log("\u{1F4CA} Starting Agent Availability Tracker...");
  try {
    const { agentAvailabilityTracker: agentAvailabilityTracker2 } = await Promise.resolve().then(() => (init_agent_availability_tracker(), agent_availability_tracker_exports));
    agentAvailabilityTracker2.start();
    console.log("\u2705 Agent Availability Tracker started");
  } catch (error) {
    console.warn("\u26A0\uFE0F Agent Availability Tracker failed to start (non-critical):", error);
  }
  console.log("\u{1F4E7} Starting Daily Verification Report Scheduler...");
  try {
    const { startDailyReportScheduler: startDailyReportScheduler2 } = await Promise.resolve().then(() => (init_verification_daily_report(), verification_daily_report_exports));
    startDailyReportScheduler2();
    console.log("\u2705 Daily Verification Report Scheduler started");
  } catch (error) {
    console.warn("\u26A0\uFE0F Daily Report Scheduler failed to start (non-critical):", error);
  }
  function getStatesOutsideCallingWindowNow() {
    const stateTimezones2 = {
      CT: "America/New_York",
      ME: "America/New_York",
      NH: "America/New_York",
      VT: "America/New_York",
      MA: "America/New_York",
      RI: "America/New_York",
      NY: "America/New_York",
      NJ: "America/New_York",
      PA: "America/New_York",
      OH: "America/New_York",
      MI: "America/New_York",
      IN: "America/New_York",
      KY: "America/New_York",
      WV: "America/New_York",
      VA: "America/New_York",
      NC: "America/New_York",
      SC: "America/New_York",
      GA: "America/New_York",
      FL: "America/New_York",
      MD: "America/New_York",
      DE: "America/New_York",
      DC: "America/New_York",
      IL: "America/Chicago",
      WI: "America/Chicago",
      MN: "America/Chicago",
      IA: "America/Chicago",
      MO: "America/Chicago",
      AR: "America/Chicago",
      LA: "America/Chicago",
      MS: "America/Chicago",
      AL: "America/Chicago",
      TN: "America/Chicago",
      OK: "America/Chicago",
      KS: "America/Chicago",
      NE: "America/Chicago",
      SD: "America/Chicago",
      ND: "America/Chicago",
      TX: "America/Chicago",
      MT: "America/Denver",
      WY: "America/Denver",
      CO: "America/Denver",
      NM: "America/Denver",
      UT: "America/Denver",
      ID: "America/Denver",
      AZ: "America/Phoenix",
      WA: "America/Los_Angeles",
      OR: "America/Los_Angeles",
      CA: "America/Los_Angeles",
      NV: "America/Los_Angeles",
      AK: "America/Anchorage",
      HI: "Pacific/Honolulu"
    };
    const outside = [];
    for (const [state, tz] of Object.entries(stateTimezones2)) {
      const hour = parseInt((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }));
      if (hour >= 21 || hour < 8) outside.push(state);
    }
    return outside;
  }
  try {
    const cron22 = await import("node-cron");
    const runCallingWindowSweep = async () => {
      try {
        const { pool: pool2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const result = await pool2.query(`
          WITH outside_window AS (
            UPDATE leasedialer_assignments la
            SET status = 'released',
                released_at = NOW(),
                release_reason = 'outside_calling_window_sweep',
                updated_at = NOW()
            FROM masterlead ml
            WHERE ml.id = la.lead_id
              AND la.status IN ('queued', 'active')
              AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($1::text[])
            RETURNING la.lead_id, la.agent_email
          )
          SELECT COUNT(*)::int AS released FROM outside_window
        `, [getStatesOutsideCallingWindowNow()]);
        console.log("[CallingWindowSweep] Released", result.rows[0]?.released, "after-hours assignments");
      } catch (e) {
        console.error("[CallingWindowSweep] failed:", e?.message);
      }
    };
    for (const hour of [18, 19, 20, 21]) {
      cron22.default.schedule(`0 ${hour} * * *`, runCallingWindowSweep, { timezone: "America/Los_Angeles" });
    }
    console.log("\u2705 Calling window sweep scheduled at 6, 7, 8, 9 PM PT");
  } catch (e) {
    console.warn("\u26A0\uFE0F Calling window sweep scheduler failed to start:", e?.message);
  }
  try {
    const cron12 = await import("node-cron");
    cron12.default.schedule("0 8 * * *", async () => {
      try {
        const { sendAOIntelActiveUsersReport: sendAOIntelActiveUsersReport2 } = await Promise.resolve().then(() => (init_ao_intel_active_users_report(), ao_intel_active_users_report_exports));
        await sendAOIntelActiveUsersReport2();
      } catch (e) {
        console.error("[AOIntel] Report failed:", e?.message);
      }
    }, { timezone: "America/Los_Angeles" });
    console.log("\u2705 AO Intel Active Users report scheduled \u2014 daily 8 AM PT");
  } catch (e) {
    console.warn("\u26A0\uFE0F AO Intel report scheduler failed to start:", e?.message);
  }
  console.log("\u{1F3AF} Starting Recruit VDP Poller...");
  try {
    const { recruitVDPPoller: recruitVDPPoller2 } = await Promise.resolve().then(() => (init_recruit_vdp_poller(), recruit_vdp_poller_exports));
    recruitVDPPoller2.start();
    console.log("\u2705 Recruit VDP Poller started - monitoring for aorecruit calls");
  } catch (error) {
    console.error("\u26A0\uFE0F Recruit VDP Poller failed to start (non-critical):", error);
  }
  console.log("\u{1F3AF} Starting Recruit AI Summary Updater...");
  try {
    const { recruitAISummaryUpdater: recruitAISummaryUpdater2 } = await Promise.resolve().then(() => (init_recruit_ai_summary_updater(), recruit_ai_summary_updater_exports));
    recruitAISummaryUpdater2.start();
    console.log("\u2705 Recruit AI Summary Updater started - will check for missing summaries every 5 minutes");
  } catch (error) {
    console.error("\u26A0\uFE0F Recruit AI Summary Updater failed to start (non-critical):", error);
  }
  console.log("\u{1F3AF} Starting AOIntel VDP Poller...");
  try {
    const { aoIntelVDPPoller: aoIntelVDPPoller2, setAOIntelLeadDisplayTrigger: setAOIntelLeadDisplayTrigger2 } = await Promise.resolve().then(() => (init_aointel_vdp_poller(), aointel_vdp_poller_exports));
    setAOIntelLeadDisplayTrigger2(async () => {
    });
    aoIntelVDPPoller2.start();
    console.log("\u2705 AOIntel VDP Poller started - monitoring for AOIntel PICK_UP events (2s interval)");
  } catch (error) {
    console.error("\u26A0\uFE0F AOIntel VDP Poller failed to start (non-critical):", error);
  }
  Promise.resolve().then(() => (init_taalk_vdp_poller(), taalk_vdp_poller_exports)).then(({ taalkVDPPoller: taalkVDPPoller2 }) => {
    taalkVDPPoller2.start();
    console.log("\u2705 Taalk VDP Poller started - polling Taalk API every 10 seconds");
    Promise.resolve().then(() => (init_vdp_agent_tracker(), vdp_agent_tracker_exports)).then(({ vdpAgentTracker: vdpAgentTracker2 }) => {
      vdpAgentTracker2.start();
      console.log("\u2705 VDP Agent Tracker started - real-time dial/reached/booked enabled");
    }).catch((err) => console.warn("\u26A0\uFE0F VDP Agent Tracker failed (non-critical):", err));
  }).catch((err) => console.warn("\u26A0\uFE0F Taalk VDP Poller failed (non-critical):", err));
  Promise.resolve().then(() => (init_recording_scheduler(), recording_scheduler_exports)).then(() => {
    console.log("\u2705 Recording scheduler started - checking every 5 minutes");
  }).catch((err) => console.warn("\u26A0\uFE0F Recording scheduler failed (non-critical):", err));
  Promise.resolve().then(() => (init_recording_url_scheduler(), recording_url_scheduler_exports)).then(() => {
    console.log("\u2705 Recording URL scheduler started - checking every 10 minutes");
  }).catch((err) => console.warn("\u26A0\uFE0F Recording URL scheduler failed (non-critical):", err));
  Promise.resolve().then(() => (init_hotlead_scheduler(), hotlead_scheduler_exports)).then(({ hotleadScheduler: hotleadScheduler2 }) => {
    hotleadScheduler2.startScheduler();
    console.log("\u2705 Hotlead scheduler started - sending leads to Zapier every 5 minutes");
  }).catch((err) => console.warn("\u26A0\uFE0F Hotlead scheduler failed (non-critical):", err));
  Promise.resolve().then(() => (init_daily_billing_recap_service(), daily_billing_recap_service_exports)).then(({ DailyBillingRecapService: DailyBillingRecapService2 }) => {
    DailyBillingRecapService2.setupDailyRecapScheduler();
    console.log("\u2705 Daily billing recap scheduler started");
  }).catch((err) => console.warn("\u26A0\uFE0F Billing recap failed (non-critical):", err));
  Promise.resolve().then(() => (init_appointment_reminder_scheduler(), appointment_reminder_scheduler_exports)).then(({ appointmentReminderScheduler: appointmentReminderScheduler2 }) => {
    appointmentReminderScheduler2.start();
    console.log("\u2705 Appointment reminder scheduler started - checking every 5 minutes");
  }).catch((err) => console.warn("\u26A0\uFE0F Appointment reminder scheduler failed (non-critical):", err));
  if (isHotTablesEodOnly()) {
    console.log("\u23ED\uFE0F Twilio auto-sync disabled in hot-table EOD-only mode");
  } else {
    try {
      twilioAutoSync.startAutoSync(6e4);
      console.log("\u2705 Twilio auto-sync started (every 60 seconds)");
    } catch (syncErr) {
      console.warn("\u26A0\uFE0F Twilio auto-sync failed to start (non-critical):", syncErr);
    }
  }
  Promise.resolve().then(() => (init_billing_transaction_sync(), billing_transaction_sync_exports)).then(({ billingTransactionSync: billingTransactionSync2 }) => {
    if (billingTransactionSync2) {
      billingTransactionSync2.start();
      console.error(
        "[AOIrail] billing-transaction-sync start() invoked (connects \u2192 billing_transactions; check stderr for timer ACTIVE)"
      );
      setTimeout(() => {
        const isActive = billingTransactionSync2.timer != null;
        if (isActive) {
          console.error("[AOIrail] billing-transaction-sync timer confirmed ACTIVE after 10s");
        } else {
          console.error("[AOIrail] billing-transaction-sync timer NOT active \u2014 retrying start()");
          billingTransactionSync2.start();
        }
      }, 1e4);
    } else {
      console.error("[AOIrail] billingTransactionSync instance missing \u2014 module load bug");
    }
  }).catch((err) => {
    console.error("\u274C Billing transaction sync failed to load:", err);
    setTimeout(() => {
      Promise.resolve().then(() => (init_billing_transaction_sync(), billing_transaction_sync_exports)).then(({ billingTransactionSync: billingTransactionSync2 }) => {
        billingTransactionSync2.start();
        console.log("\u2705 Billing transaction sync started on retry");
      }).catch((retryErr) => console.error("\u274C Billing transaction sync retry failed:", retryErr));
    }, 3e4);
  });
  Promise.resolve().then(() => (init_verification_analysis_scheduler(), verification_analysis_scheduler_exports)).then(({ verificationAnalysisScheduler: verificationAnalysisScheduler2 }) => {
    verificationAnalysisScheduler2.start();
    console.log("\u2705 Verification analysis scheduler started - analyzing AI summaries every hour");
  }).catch((err) => {
    console.error("\u274C CRITICAL: Verification analysis scheduler failed to start:", err);
    console.error("   AI summaries will NOT be analyzed automatically!");
  });
  Promise.resolve().then(() => (init_taalk_campaign_sync_scheduler(), taalk_campaign_sync_scheduler_exports)).then(({ taalkCampaignSyncScheduler: taalkCampaignSyncScheduler2 }) => {
    taalkCampaignSyncScheduler2.start();
    console.log("\u2705 Taalk campaign sync scheduler started");
  }).catch((err) => console.warn("\u26A0\uFE0F Taalk campaign sync failed (non-critical):", err));
  if (isHotTablesEodOnly()) {
    console.log("\u23ED\uFE0F Inbound calls Twilio sync disabled in hot-table EOD-only mode");
  } else {
    Promise.resolve().then(() => (init_inbound_calls_twilio_sync(), inbound_calls_twilio_sync_exports)).then(({ startInboundCallsTwilioSync: startInboundCallsTwilioSync2 }) => {
      startInboundCallsTwilioSync2();
    }).catch((err) => console.warn("\u26A0\uFE0F Inbound calls Twilio sync failed (non-critical):", err));
  }
  if (JOB_WEBHOOKS_ENABLED4) {
    Promise.resolve().then(() => (init_twilio_call_zapier_scheduler(), twilio_call_zapier_scheduler_exports)).then(({ twilioCallZapierScheduler: twilioCallZapierScheduler2 }) => {
      twilioCallZapierScheduler2.start();
      console.log("\u2705 Twilio\u2192Zapier call scheduler started - syncing every 5 minutes");
    }).catch((err) => console.warn("\u26A0\uFE0F Twilio\u2192Zapier scheduler failed (non-critical):", err));
  } else {
    console.log("\u23ED\uFE0F Twilio\u2192Zapier job scheduler disabled (ENABLE_ZAPIER_JOB_WEBHOOKS!=true)");
  }
  if (JOB_WEBHOOKS_ENABLED4 && process.env.BOOKED_LEADS_WEBHOOK_SENDER_ENABLED === "true") {
    Promise.resolve().then(() => (init_booked_leads_webhook_sender(), booked_leads_webhook_sender_exports)).then(({ bookedLeadsWebhookSender: bookedLeadsWebhookSender2 }) => {
      bookedLeadsWebhookSender2.start();
      console.log("\u2705 Call Connector Pro webhook sender started");
    }).catch((err) => console.warn("\u26A0\uFE0F Webhook sender failed (non-critical):", err));
  } else {
    console.log("\u23ED\uFE0F Call Connector Pro booked/long-call webhook sender disabled (job/env guard)");
  }
  Promise.resolve().then(() => (init_ftc_queue_cleaner(), ftc_queue_cleaner_exports)).then(({ startFTCQueueCleaner: startFTCQueueCleaner2 }) => {
    startFTCQueueCleaner2();
    console.log("\u2705 FTC queue cleaner started - updates FTCRESTRICTED column every 60 minutes");
  }).catch((err) => console.warn("\u26A0\uFE0F FTC queue cleaner failed (non-critical):", err));
  Promise.resolve().then(() => (init_verification_automation_scheduler(), verification_automation_scheduler_exports)).then(({ verificationAutomationScheduler: verificationAutomationScheduler2 }) => {
    verificationAutomationScheduler2.start();
    console.log("\u2705 Verification Automation scheduler started - runs IP analysis every 15 minutes");
  }).catch((err) => console.warn("\u26A0\uFE0F Verification Automation scheduler failed (non-critical):", err));
  Promise.resolve().then(() => (init_presentation_lifecycle_manager(), presentation_lifecycle_manager_exports)).then(({ presentationLifecycleManager: presentationLifecycleManager2 }) => {
    presentationLifecycleManager2.start();
    console.log("\u2705 Presentation lifecycle manager started");
  }).catch((err) => console.warn("\u26A0\uFE0F Presentation lifecycle manager failed (non-critical):", err));
  Promise.resolve().then(() => (init_ccpro_flag_sync_scheduler(), ccpro_flag_sync_scheduler_exports)).then(({ ccproFlagSyncScheduler: ccproFlagSyncScheduler2 }) => {
    ccproFlagSyncScheduler2.start();
    console.log("\u2705 CCPRO flag sync scheduler started - syncs daily at 3:00 AM EST");
  }).catch((err) => console.warn("\u26A0\uFE0F CCPRO flag sync scheduler failed (non-critical):", err));
  Promise.resolve().then(() => (init_connectnow_billing_daily_scheduler(), connectnow_billing_daily_scheduler_exports)).then(({ connectNowBillingDailyScheduler: connectNowBillingDailyScheduler2 }) => {
    connectNowBillingDailyScheduler2.start();
    console.log("\u2705 ConnectNow Billing Daily Scheduler started - populates data daily at 12:00 AM PST");
  }).catch((err) => console.warn("\u26A0\uFE0F ConnectNow Billing Daily Scheduler failed (non-critical):", err));
  Promise.resolve().then(() => (init_activity_card_report_scheduler(), activity_card_report_scheduler_exports)).then(({ activityCardReportScheduler: activityCardReportScheduler2 }) => {
    activityCardReportScheduler2.start();
    console.log("\u2705 Activity card report scheduler started for Chris hierarchy pilot");
  }).catch((err) => console.warn("\u26A0\uFE0F Activity card report scheduler failed (non-critical):", err));
  Promise.resolve().then(() => (init_lead_assignment_scheduler(), lead_assignment_scheduler_exports)).then(({ leadAssignmentScheduler: leadAssignmentScheduler2 }) => {
    leadAssignmentScheduler2.startScheduler();
    console.log("\u2705 Lead Assignment Scheduler started - midnight reset + 5-min cnresolution recycling");
  }).catch((err) => console.warn("\u26A0\uFE0F Lead Assignment Scheduler failed to start (non-critical):", err));
  const runUnownedLeadRecycle = async () => {
    try {
      const { pool: pool2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const result = await pool2.query(`
        UPDATE masterlead
        SET cnresolution = 'pending',
            updated_at = NOW()
        WHERE lower(trim(coalesce(cnresolution, ''))) IN ('called', 'call', 'no_answer', 'no answer', 'no_answer_vm', 'voicemail')
          AND (cn_email IS NULL OR btrim(cn_email) = '')
          AND COALESCE(btrim(taalk_lead_id::text), '') <> ''
          AND COALESCE(lower(dnc::text), '') NOT IN ('true', '1', 'yes', 'y')
          AND NOT (lower(COALESCE(taalk_market::text, '')) LIKE '%plus%' OR lower(COALESCE(market::text, '')) LIKE '%plus%')
          AND COALESCE(updated_at, last_contacted, created_at, NOW()) < NOW() - INTERVAL '1 hour'
        RETURNING id
      `);
      if (result.rowCount && result.rowCount > 0) {
        console.log("[UNOWNED_RECYCLE] Reset " + result.rowCount + " unowned called leads to pending");
      }
    } catch (err) {
      console.warn("[UNOWNED_RECYCLE] Failed:", err && err.message);
    }
  };
  setTimeout(runUnownedLeadRecycle, 3e4);
  setInterval(runUnownedLeadRecycle, 5 * 60 * 1e3);
  console.log("\u{1F6AB} Call Analytics Scheduler DISABLED - OpenAI API calls turned off to prevent excessive billing");
  Promise.resolve().then(() => (init_call_analytics_disposition_model(), call_analytics_disposition_model_exports)).then(({ loadDispositionModelFromDb: loadDispositionModelFromDb2 }) => {
    loadDispositionModelFromDb2().then(() => console.log("\u2705 Call analytics disposition rules loaded from DB")).catch(() => {
    });
  }).catch(() => {
  });
  console.log("\u23ED\uFE0F No-answer 1-minute auto-reset loop disabled by ops");
  const runFailedLeadQueueCleanup = async () => {
    try {
      const { pool: pool2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { rows } = await pool2.query(`
        WITH recent_failed_phones AS (
          SELECT DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10
          FROM twilio_call_logs t
          WHERE lower(COALESCE(t.call_status, '')) = 'failed'
            AND lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
            AND t.call_started_at >= NOW() - INTERVAL '20 minutes'
            AND length(RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)) = 10
        ),
        target_leads AS (
          SELECT ml.id
          FROM masterlead ml
          JOIN recent_failed_phones rf
            ON (
              rf.phone10 = NULLIF(btrim(ml.phone_last10), '')
              OR rf.phone10 = RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)
            )
        ),
        released AS (
          UPDATE leasedialer_assignments la
          SET status = 'released',
              released_at = NOW(),
              release_reason = 'failed_call_15m_sync',
              updated_at = NOW()
          WHERE la.status IN ('queued', 'active')
            AND la.lead_id IN (SELECT id FROM target_leads)
          RETURNING la.id
        ),
        marked_failed AS (
          UPDATE masterlead ml
          SET cnresolution = 'failed',
              updated_at = NOW()
          WHERE ml.id IN (SELECT id FROM target_leads)
            AND lower(trim(COALESCE(ml.cnresolution, ''))) <> 'failed'
          RETURNING ml.id
        )
        SELECT
          (SELECT COUNT(*)::int FROM recent_failed_phones) AS failed_phones_window,
          (SELECT COUNT(*)::int FROM released) AS queue_rows_released,
          (SELECT COUNT(*)::int FROM marked_failed) AS masterlead_rows_marked_failed
      `);
      const stats = rows?.[0] || {};
      console.log(
        `[FailedLeadCleanup/15m] failed_phones_window=${stats.failed_phones_window || 0} queue_rows_released=${stats.queue_rows_released || 0} masterlead_rows_marked_failed=${stats.masterlead_rows_marked_failed || 0}`
      );
    } catch (e) {
      console.warn("[FailedLeadCleanup/15m] failed (non-critical):", e?.message || e);
    }
  };
  setTimeout(() => {
    runFailedLeadQueueCleanup().catch(() => {
    });
  }, 1e4);
  setInterval(() => {
    runFailedLeadQueueCleanup().catch(() => {
    });
  }, 15 * 60 * 1e3);
  console.log("\u2705 Failed lead queue cleanup scheduled - every 15 minutes");
  setTimeout(async () => {
    try {
      const { ensurePublicLiveCardTables: ensurePublicLiveCardTables2, seedChrisLiveLink: seedChrisLiveLink2 } = await Promise.resolve().then(() => (init_public_live_card_service(), public_live_card_service_exports));
      await ensurePublicLiveCardTables2();
      const link = await seedChrisLiveLink2();
      console.log(`[WORKER] \u2705 Public live card ready at ${link.urlPath}`);
    } catch (err) {
      console.warn("[WORKER] \u26A0\uFE0F Public live card bootstrap failed (non-critical):", err.message);
    }
  }, 1e4);
  const runHierarchySync = async () => {
    try {
      const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
      await storage2.syncAllProfilesToHierarchy();
      console.log("[WORKER] \u2705 Agent hierarchy synced");
    } catch (err) {
      console.warn("[WORKER] \u26A0\uFE0F Agent hierarchy sync failed (non-critical):", err.message);
    }
  };
  setTimeout(runHierarchySync, 6e4);
  setInterval(runHierarchySync, 6 * 60 * 60 * 1e3);
  console.log("\u2705 Background worker bootstrap complete (schedulers may still be loading asynchronously)");
}

// server/entry-worker.ts
process.env.TZ = "America/Los_Angeles";
process.on("uncaughtException", (error) => {
  console.error("[WORKER] \u274C UNCAUGHT EXCEPTION:", error);
  console.error("[WORKER] Stack:", error.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error("[WORKER] \u274C UNHANDLED REJECTION:", reason);
  if (reason instanceof Error) console.error("[WORKER] Stack:", reason.stack);
});
async function main2() {
  if (!isWorkersGloballyEnabled()) {
    console.log("[WORKER] \u23ED\uFE0F ENABLE_WORKERS=false \u2014 exiting");
    process.exit(0);
    return;
  }
  console.log("[WORKER] \u{1F680} AOIrail background worker starting...");
  await startBackgroundWorkers();
  console.log("[WORKER] \u{1F7E2} Schedulers bootstrapped (async jobs may still be loading)");
  try {
    const { startJobWorker: startJobWorker2 } = await Promise.resolve().then(() => (init_job_queue(), job_queue_exports));
    startJobWorker2().catch((err) => console.error("[WORKER] Job queue error:", err));
    console.log("[WORKER] \u2705 Redis job queue worker started");
  } catch (err) {
    console.warn("[WORKER] \u26A0\uFE0F Job queue failed to start (non-critical):", err.message);
  }
}
main2().catch((err) => {
  console.error("[WORKER] \u274C Critical failure:", err);
  process.exit(1);
});
