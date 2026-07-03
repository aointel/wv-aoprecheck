import { HARDCODED_CONFIG } from "./hardcoded-config";

/**
 * Single Redis URL for sessions, job queue, and any other Redis use.
 *
 * - Prefer `process.env.REDIS_URL` (Railway Redis plugin / multi-service deploys).
 * - Fall back to `hardcoded-config` only when env is unset.
 * - Skip `*.railway.internal` off Railway so local dev does not DNS-fail and spam errors.
 */
export function getRedisUrl(): string | undefined {
  const env = process.env.REDIS_URL?.trim();
  if (env) return env;

  const fallback = HARDCODED_CONFIG.REDIS_URL?.trim();
  if (!fallback) return undefined;

  if (fallback.includes("railway.internal")) {
    const onRailway =
      Boolean(process.env.RAILWAY_ENVIRONMENT) ||
      Boolean(process.env.RAILWAY_SERVICE_ID) ||
      Boolean(process.env.RAILWAY_PROJECT_ID);
    if (!onRailway) return undefined;
  }

  return fallback;
}
