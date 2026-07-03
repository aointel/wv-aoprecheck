import type { NextFunction, Request, Response } from "express";

type MetricPoint = {
  ts: number;
  durationMs: number;
  ok: boolean;
};

type Aggregate = {
  key: string;
  count: number;
  errors: number;
  totalMs: number;
  maxMs: number;
  points: MetricPoint[];
};

const MAX_POINTS_PER_KEY = 400;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

class PerfStore {
  private requests = new Map<string, Aggregate>();
  private dependencies = new Map<string, Aggregate>();

  private upsert(map: Map<string, Aggregate>, key: string): Aggregate {
    let agg = map.get(key);
    if (!agg) {
      agg = { key, count: 0, errors: 0, totalMs: 0, maxMs: 0, points: [] };
      map.set(key, agg);
    }
    return agg;
  }

  private record(map: Map<string, Aggregate>, key: string, durationMs: number, ok: boolean): void {
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

  recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    const key = `${method.toUpperCase()} ${path}`;
    const ok = statusCode < 500;
    this.record(this.requests, key, durationMs, ok);
  }

  recordDependency(kind: string, target: string, durationMs: number, ok: boolean): void {
    const key = `${kind}:${target}`;
    this.record(this.dependencies, key, durationMs, ok);
  }

  private toRows(map: Map<string, Aggregate>, limit: number) {
    const rows = Array.from(map.values()).map((agg) => {
      const samples = agg.points.map((p) => p.durationMs).sort((a, b) => a - b);
      const p = (q: number) => {
        if (!samples.length) return 0;
        const idx = Math.min(samples.length - 1, Math.floor((q / 100) * samples.length));
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
        maxMs: agg.maxMs,
      };
    });
    rows.sort((a, b) => b.p95Ms - a.p95Ms || b.maxMs - a.maxMs || b.count - a.count);
    return rows.slice(0, limit);
  }

  getSummary(limit = 25) {
    return {
      generatedAt: new Date().toISOString(),
      topRoutesByP95: this.toRows(this.requests, limit),
      topDependenciesByP95: this.toRows(this.dependencies, limit),
    };
  }

  reset(): void {
    this.requests.clear();
    this.dependencies.clear();
  }
}

export const perfStore = new PerfStore();

// Track event-loop lag as a baseline signal for CPU/process contention.
const LOOP_SAMPLE_MS = 1000;
let expected = Date.now() + LOOP_SAMPLE_MS;
const lagTimer = setInterval(() => {
  const now = Date.now();
  const lag = Math.max(0, now - expected);
  perfStore.recordDependency("runtime", "eventloop.lag", lag, true);
  expected = now + LOOP_SAMPLE_MS;
}, LOOP_SAMPLE_MS);
if (typeof lagTimer.unref === "function") lagTimer.unref();

function normalizePath(originalUrl: string): string {
  const q = originalUrl.indexOf("?");
  if (q === -1) return originalUrl;
  return originalUrl.slice(0, q);
}

export function requestPerfMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const path = normalizePath(req.originalUrl || req.url || req.path || "/");
  res.on("finish", () => {
    perfStore.recordRequest(req.method, path, res.statusCode, Date.now() - start);
  });
  next();
}

export async function timedDependency<T>(
  kind: string,
  target: string,
  fn: () => Promise<T>,
): Promise<T> {
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

function compactUrl(input: RequestInfo | URL): string {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
  try {
    const u = new URL(raw);
    const firstPath = u.pathname.split("/").filter(Boolean).slice(0, 2).join("/");
    return `${u.host}/${firstPath || ""}`.replace(/\/$/, "");
  } catch {
    return raw.slice(0, 120);
  }
}

export function wrapFetchWithPerf(
  kind: string,
  fetchFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const target = compactUrl(input);
    return timedDependency(kind, target, () => fetchFn(input, init));
  };
}
