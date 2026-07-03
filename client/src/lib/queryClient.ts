import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getServiceRequestCredentials, resolveServiceUrl } from "@/lib/service-routing";

const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_RETRY_DELAYS_MS = [250, 600];

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function isTransientStatus(status: number): boolean {
  return TRANSIENT_STATUS_CODES.has(status);
}

function isTransientErrorMessage(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network error") ||
    m.includes("load failed") ||
    m.includes("timeout")
  );
}

async function fetchWithTransientRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = String(init?.method || "GET").toUpperCase();
  const canRetry = method === "GET" || method === "HEAD" || method === "OPTIONS";
  if (!canRetry) return fetch(input, init);

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(input, init);
      if (isTransientStatus(res.status) && attempt < TRANSIENT_RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, TRANSIENT_RETRY_DELAYS_MS[attempt]));
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!isTransientErrorMessage(message) || attempt >= TRANSIENT_RETRY_DELAYS_MS.length) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, TRANSIENT_RETRY_DELAYS_MS[attempt]));
    }
  }
  throw (lastError || new Error("Transient fetch failure"));
}

function shouldRetryQuery(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  const statusPrefix = Number(message.split(":")[0] || 0);
  if (statusPrefix === 401 || statusPrefix === 403 || statusPrefix === 404) return false;
  return (
    isTransientStatus(statusPrefix) ||
    isTransientErrorMessage(message)
  );
}

export function getAPIBaseURL(): string {
  if (typeof window === "undefined") return "";
  return (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? window.location.origin
    : "";
}

/** Auth + optional `x-user-email` for segmented data / Twilio hosts (same-origin uses cookies; cross-origin uses Bearer). */
export async function buildDefaultApiHeaders(userEmail?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  try {
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    }
  } catch {
    // Supabase session optional
  }

  if (userEmail) {
    headers["x-user-email"] = userEmail;
  } else {
    try {
      const storedUser = localStorage.getItem("current_producer");
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        if (userData.email) headers["x-user-email"] = userData.email;
      }
    } catch {
      // localStorage fallback optional
    }
  }
  return headers;
}

/**
 * `fetch` after `resolveServiceUrl` + credentials + default auth headers.
 * Use for raw `fetch` call sites so `/api/outbound-dialer/*` and other data-prefix paths hit the data deploy from Connect.
 */
export async function segmentedFetch(
  path: string,
  init: RequestInit = {},
  userEmail?: string,
): Promise<Response> {
  const base = getAPIBaseURL();
  const rel = path.startsWith("/") ? path : `/${path}`;
  const rawUrl =
    path.startsWith("http://") || path.startsWith("https://") ? path : `${base}${rel}`;
  const endpoint = resolveServiceUrl(rawUrl);
  const credentials = getServiceRequestCredentials(endpoint);
  const auth = await buildDefaultApiHeaders(userEmail);
  const merged = new Headers(init.headers as HeadersInit | undefined);
  for (const [k, v] of Object.entries(auth)) {
    if (!merged.has(k)) merged.set(k, v);
  }
  return fetch(endpoint, { ...init, headers: merged, credentials });
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  userEmail?: string,  // NEW: Optional explicit user email
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(await buildDefaultApiHeaders(userEmail)),
  };

  const base = getAPIBaseURL();
  const endpoint = resolveServiceUrl(`${base}${url}`);
  const credentials = getServiceRequestCredentials(endpoint);

  const res = await fetch(endpoint, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const requestPath = queryKey.join("/") as string;
    const endpoint = resolveServiceUrl(`${getAPIBaseURL()}${requestPath}`);
    const credentials = getServiceRequestCredentials(endpoint);
    const authHeaders = await buildDefaultApiHeaders();
    const res = await fetchWithTransientRetry(endpoint, {
      credentials,
      headers: authHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => failureCount < 2 && shouldRetryQuery(error),
      retryDelay: (attemptIndex) => (attemptIndex <= 1 ? 300 : 800),
      // CRITICAL: Always refetch on mount to ensure fresh data when navigating from redirects
      refetchOnMount: true,
    },
    mutations: {
      retry: false,
    },
  },
});
