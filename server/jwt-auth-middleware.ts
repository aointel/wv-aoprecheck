/**
 * Supabase JWT auth middleware for compartmentalized architecture.
 * Validates JWT from cookie (sb-access-token) or Authorization: Bearer header,
 * then populates req.session.user and req.session.profile so existing route
 * handlers and requireAuth continue to work without changes.
 * Session population: always populates session for valid tokens (safeguards removed for WebRTC compatibility).
 *
 * Caches resolved session by token hash with a short TTL and dedupes concurrent
 * getUser calls to reduce Supabase Auth load and connect-timeout storms.
 */
import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { supabaseAdmin } from "./supabase";
import { storage } from "./storage";

const COOKIE_NAME = "sb-access-token";
const CACHE_TTL_MS = 90_000;
const GET_USER_TIMEOUT_MS = 6_000;
const MAX_CACHE_ENTRIES = 2500;

type CachedSession = {
  user: { id: string; email: string; created_at?: string };
  profile: unknown;
  exp: number;
};

const sessionCache = new Map<string, CachedSession>();
const inflightAuth = new Map<string, Promise<CachedSession | null>>();

let lastJwtMiddlewareErrorLogMs = 0;
const JWT_ERR_LOG_INTERVAL_MS = 60_000;

function tokenCacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function trimSessionCache(): void {
  while (sessionCache.size > MAX_CACHE_ENTRIES) {
    const first = sessionCache.keys().next().value;
    if (first) sessionCache.delete(first);
    else break;
  }
}

function cloneForSession<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyCachedSession(session: any, entry: CachedSession): void {
  session.user = { ...entry.user };
  session.profile = cloneForSession(entry.profile);
}

async function resolveAuthToCacheEntry(token: string): Promise<CachedSession | null> {
  if (!supabaseAdmin) return null;

  const userResult = await Promise.race([
    supabaseAdmin.auth.getUser(token),
    new Promise<{ data: { user: null }; error: { message: string } }>((resolve) =>
      setTimeout(
        () => resolve({ data: { user: null }, error: { message: "jwt_lookup_timeout" } }),
        GET_USER_TIMEOUT_MS,
      ),
    ),
  ]);

  const {
    data: { user },
    error,
  } = userResult;

  if (error || !user) {
    return null;
  }

  if (
    !user.email?.endsWith("@aoglobelife.com") &&
    user.email !== "test@aoprecheck.com" &&
    user.email !== "chrislafond@aoglobelife.com" &&
    user.email !== "cnsysop@aoglobelife.com"
  ) {
    return null;
  }

  let agentProfile = await storage.getAgentProfileByEmail(user.email || "");
  if (!agentProfile && user.email) {
    const emailPrefix = user.email.split("@")[0];
    const nameParts = emailPrefix.split(/[._-]/);
    const firstName = nameParts[0]
      ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1)
      : "Agent";
    const lastName = nameParts[1]
      ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1)
      : "User";
    try {
      agentProfile = await storage.createAgentProfileWithSupabaseId({
        supabaseUserId: user.id,
        firstName,
        lastName,
        phone: "+1-555-0000",
        email: user.email,
        zoomId: "",
        zoomPassword: "1",
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
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
    }
  }

  const sessionUser = {
    id: user.id,
    email: user.email!,
    created_at: user.created_at,
  };

  let profileWithAssociateId = { ...agentProfile };
  if (supabaseAdmin && user.email && !(agentProfile as any).associate_id) {
    try {
      const email = user.email.toLowerCase().trim();
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("associate_id")
        .or(`company_email.ilike.${email},personal_email.ilike.${email}`)
        .limit(1)
        .maybeSingle();

      if (customer?.associate_id != null) {
        (profileWithAssociateId as any).associate_id = customer.associate_id;
      }
    } catch {
      // associate_id is optional
    }
  }

  return {
    user: sessionUser,
    profile: profileWithAssociateId,
    exp: Date.now() + CACHE_TTL_MS,
  };
}

export async function jwtAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const session = req.session as any;
  if (session?.user) {
    return next();
  }

  let token: string | undefined;
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
    applyCachedSession(session, hit);
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
      applyCachedSession(session, entry);
    }
  } catch {
    // already logged in shared inflight path
  }

  next();
}
