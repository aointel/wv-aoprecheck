/**
 * Smoke test segmented Railway services before production cutover.
 *
 * Usage:
 *   SHELL_URL=... API_URL=... TWILIO_URL=... CONNECT_URL=... npm run verify:segmented-services
 *
 * Required for Twilio isolation checks:
 *   TWILIO_URL, CONNECT_URL
 *
 * Optional:
 *   SHELL_URL, API_URL, PRECHECK_URL, PRECHECK_ADMIN_URL, RECRUIT_URL, STATS_URL
 *   CAMPAIGN_MANAGER_SERVICE_URL (GET /api/health on aoirail-campaign-manager)
 *   LEADSYNC_SERVICE_URL (GET /health on aoirail-leadsync)
 */

type ProbeResult = {
  name: string;
  ok: boolean;
  status?: number;
  detail?: string;
};

const maybeUrlEnvKeys = [
  "SHELL_URL",
  "API_URL",
  "TWILIO_URL",
  "DATA_URL",
  "PRECHECK_URL",
  "PRECHECK_ADMIN_URL",
  "CONNECT_URL",
  "RECRUIT_URL",
  "STATS_URL",
] as const;

/** Standalone apps (own Railway services); health path differs from /health only. */
const standaloneServiceHealth: ReadonlyArray<{ envKey: string; path: string }> = [
  { envKey: "CAMPAIGN_MANAGER_SERVICE_URL", path: "/api/health" },
  { envKey: "LEADSYNC_SERVICE_URL", path: "/health" },
];

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

async function probe(
  name: string,
  input: RequestInfo | URL,
  init: RequestInit,
  validator: (response: Response, body: string) => { ok: boolean; detail?: string }
): Promise<ProbeResult> {
  try {
    const response = await fetch(input, init);
    const body = await response.text();
    const verdict = validator(response, body);
    return {
      name,
      ok: verdict.ok,
      status: response.status,
      detail: verdict.detail,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function printResults(results: ProbeResult[]): void {
  for (const result of results) {
    const emoji = result.ok ? "✅" : "❌";
    const status = typeof result.status === "number" ? ` [${result.status}]` : "";
    const detail = result.detail ? ` - ${result.detail}` : "";
    console.log(`${emoji} ${result.name}${status}${detail}`);
  }
}

async function run(): Promise<void> {
  const envUrls: Partial<Record<(typeof maybeUrlEnvKeys)[number], string>> = {};
  for (const key of maybeUrlEnvKeys) {
    const value = process.env[key]?.trim();
    if (value) envUrls[key] = trimTrailingSlash(value);
  }

  const results: ProbeResult[] = [];

  // Basic health checks (optional per service).
  for (const key of maybeUrlEnvKeys) {
    const baseUrl = envUrls[key];
    if (!baseUrl) continue;
    results.push(
      await probe(
        `${key} /health`,
        `${baseUrl}/health`,
        { method: "GET" },
        (response) => ({
          ok: response.status >= 200 && response.status < 300,
          detail: response.status >= 200 && response.status < 300 ? "healthy" : "health check failed",
        })
      )
    );
  }

  for (const { envKey, path } of standaloneServiceHealth) {
    const baseUrl = process.env[envKey]?.trim();
    if (!baseUrl) continue;
    const root = trimTrailingSlash(baseUrl);
    results.push(
      await probe(
        `${envKey} ${path}`,
        `${root}${path}`,
        { method: "GET" },
        (response) => ({
          ok: response.status >= 200 && response.status < 300,
          detail: response.status >= 200 && response.status < 300 ? "healthy" : "health check failed",
        })
      )
    );
  }

  const twilioUrl = envUrls.TWILIO_URL;
  const connectUrl = envUrls.CONNECT_URL;
  const apiUrl = envUrls.API_URL;
  const dataUrl = envUrls.DATA_URL;

  // Twilio-only route should resolve on Twilio service.
  if (twilioUrl) {
    results.push(
      await probe(
        "TWILIO_URL /incomingcall",
        `${twilioUrl}/incomingcall`,
        { method: "GET" },
        (response, body) => {
          const hasTwiml = body.includes("<Response");
          const ok = response.status === 200 && hasTwiml;
          return {
            ok,
            detail: ok ? "TwiML returned" : "expected 200 TwiML response",
          };
        }
      )
    );

    results.push(
      await probe(
        "TWILIO_URL /api/twilio/token",
        `${twilioUrl}/api/twilio/token`,
        { method: "GET" },
        (response) => ({
          // 404 means route missing; any non-404 means route exists and is isolated here.
          ok: response.status !== 404,
          detail: response.status !== 404 ? "route exists" : "route missing on twilio service",
        })
      )
    );
  }

  // Same Twilio route should be blocked from non-Twilio services.
  if (connectUrl) {
    results.push(
      await probe(
        "CONNECT_URL should block /api/twilio/token",
        `${connectUrl}/api/twilio/token`,
        { method: "GET" },
        (response) => ({
          ok: response.status === 404,
          detail: response.status === 404 ? "blocked as expected" : "unexpectedly reachable from connect service",
        })
      )
    );
  }

  if (apiUrl) {
    results.push(
      await probe(
        "API_URL should block /incomingcall",
        `${apiUrl}/incomingcall`,
        { method: "GET" },
        (response) => ({
          ok: response.status === 404,
          detail: response.status === 404 ? "blocked as expected" : "unexpectedly reachable from api service",
        })
      )
    );
  }

  if (dataUrl) {
    results.push(
      await probe(
        "DATA_URL /api/masterlead route present",
        `${dataUrl}/api/masterlead/update-last-contacted`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: "0000000000" }),
        },
        (response) => ({
          // expect route exists (auth/validation may fail), but should not be 404
          ok: response.status !== 404,
          detail: response.status !== 404 ? "route exists" : "masterlead route missing on data service",
        })
      )
    );
  }

  printResults(results);

  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log(`Checks: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
