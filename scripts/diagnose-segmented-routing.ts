type Probe = {
  name: string;
  url: string;
  init?: RequestInit;
  expect: (status: number, body: string) => { ok: boolean; detail: string };
};

type Result = {
  name: string;
  status: number;
  ok: boolean;
  detail: string;
};

const SERVICES = {
  shell: "https://aoirail-shell-production.up.railway.app",
  api: "https://aoirail-api-production.up.railway.app",
  twilio: "https://aoirail-twilio-production.up.railway.app",
  data: "https://aoirail-data-production.up.railway.app",
  precheck: "https://aoirail-precheck-production.up.railway.app",
  precheckAdmin: "https://aoirail-precheck-admin-production.up.railway.app",
  connect: "https://aoirail-connect-production.up.railway.app",
  recruit: "https://aoirail-recruit-production.up.railway.app",
  stats: "https://aoirail-stats-production.up.railway.app",
  "campaign-manager": "https://aoirail-campaign-manager-production.up.railway.app",
  leadsync: "https://aoirail-leadsync-production.up.railway.app",
} as const;

async function runProbe(probe: Probe): Promise<Result> {
  try {
    const res = await fetch(probe.url, probe.init);
    const body = await res.text();
    const verdict = probe.expect(res.status, body);
    return {
      name: probe.name,
      status: res.status,
      ok: verdict.ok,
      detail: verdict.detail,
    };
  } catch (error) {
    return {
      name: probe.name,
      status: -1,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function anyHealthOk(statusA: number, statusB: number): boolean {
  return (statusA >= 200 && statusA < 300) || (statusB >= 200 && statusB < 300);
}

async function healthCheck(name: string, baseUrl: string): Promise<Result> {
  const h1 = await runProbe({
    name: `${name} /health`,
    url: `${baseUrl}/health`,
    expect: (status) => ({
      ok: status >= 200 && status < 300,
      detail: status >= 200 && status < 300 ? "ok" : "not ok",
    }),
  });
  const h2 = await runProbe({
    name: `${name} /api/health`,
    url: `${baseUrl}/api/health`,
    expect: (status) => ({
      ok: status >= 200 && status < 300,
      detail: status >= 200 && status < 300 ? "ok" : "not ok",
    }),
  });

  return {
    name: `${name} health`,
    status: anyHealthOk(h1.status, h2.status) ? 200 : h2.status,
    ok: anyHealthOk(h1.status, h2.status),
    detail: `health=${h1.status}, api/health=${h2.status}`,
  };
}

async function main() {
  const results: Result[] = [];

  for (const [name, baseUrl] of Object.entries(SERVICES)) {
    results.push(await healthCheck(name, baseUrl));
  }

  results.push(
    await runProbe({
      name: "twilio should serve /incomingcall (POST)",
      url: `${SERVICES.twilio}/incomingcall`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "CallSid=CA_TEST&From=%2B16095551212&To=%2B16096048379",
      },
      expect: (status) => ({
        ok: status !== 404,
        detail: status !== 404 ? "route exists on twilio" : "404 missing on twilio",
      }),
    }),
  );

  results.push(
    await runProbe({
      name: "twilio should serve /api/twilio/token",
      url: `${SERVICES.twilio}/api/twilio/token`,
      init: { method: "GET" },
      expect: (status) => ({
        ok: status !== 404,
        detail: status !== 404 ? "route exists on twilio" : "404 missing on twilio",
      }),
    }),
  );

  const twilioRouteProbes: Probe[] = [
    {
      name: "twilio should serve /api/twilio/taskrouter/accept",
      url: `${SERVICES.twilio}/api/twilio/taskrouter/accept`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskSid: "WT_TEST", reservationSid: "WR_TEST" }),
      },
      expect: (status) => ({
        ok: status !== 404,
        detail: status !== 404 ? "route exists on twilio" : "404 missing on twilio",
      }),
    },
    {
      name: "twilio should serve /api/twilio/taskrouter/reject",
      url: `${SERVICES.twilio}/api/twilio/taskrouter/reject`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskSid: "WT_TEST", reservationSid: "WR_TEST" }),
      },
      expect: (status) => ({
        ok: status !== 404,
        detail: status !== 404 ? "route exists on twilio" : "404 missing on twilio",
      }),
    },
    {
      name: "twilio should serve /api/twilio/taskrouter/assignment",
      url: `${SERVICES.twilio}/api/twilio/taskrouter/assignment`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "TaskSid=WT_TEST&ReservationSid=WR_TEST",
      },
      expect: (status) => ({
        ok: status !== 404,
        detail: status !== 404 ? "route exists on twilio" : "404 missing on twilio",
      }),
    },
  ];
  for (const probe of twilioRouteProbes) {
    results.push(await runProbe(probe));
  }

  results.push(
    await runProbe({
      name: "data should serve /api/masterlead/update-last-contacted",
      url: `${SERVICES.data}/api/masterlead/update-last-contacted`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: "0000000000" }),
      },
      expect: (status) => ({
        ok: status !== 404,
        detail: status !== 404 ? "route exists on data" : "404 missing on data",
      }),
    }),
  );

  const dataRouteProbes: Probe[] = [
    {
      name: "data should serve /api/masterlead/update-resolution",
      url: `${SERVICES.data}/api/masterlead/update-resolution`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: "123", resolution: "pending" }),
      },
      expect: (status) => ({
        ok: status !== 404,
        detail: status !== 404 ? "route exists on data" : "404 missing on data",
      }),
    },
    {
      name: "data should serve /api/outbound-dialer/leads",
      url: `${SERVICES.data}/api/outbound-dialer/leads`,
      init: { method: "GET" },
      expect: (status) => ({
        ok: status !== 404,
        detail: status !== 404 ? "route exists on data" : "404 missing on data",
      }),
    },
    {
      name: "data should serve /api/outbound-dialer/save-disposition",
      url: `${SERVICES.data}/api/outbound-dialer/save-disposition`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      expect: (status) => ({
        ok: status !== 404,
        detail: status !== 404 ? "route exists on data" : "404 missing on data",
      }),
    },
    {
      name: "data should serve /api/inbound-calls/active/:agentEmail",
      url: `${SERVICES.data}/api/inbound-calls/active/test%40aoglobelife.com`,
      init: { method: "GET" },
      expect: (status) => ({
        ok: status !== 404,
        detail: status !== 404 ? "route exists on data" : "404 missing on data",
      }),
    },
  ];
  for (const probe of dataRouteProbes) {
    results.push(await runProbe(probe));
  }

  const nonTwilio = [
    "shell",
    "api",
    "data",
    "precheck",
    "precheckAdmin",
    "connect",
    "recruit",
    "stats",
  ] as const;
  for (const svc of nonTwilio) {
    results.push(
      await runProbe({
        name: `${svc} should block /api/twilio/token`,
        url: `${SERVICES[svc]}/api/twilio/token`,
        init: { method: "GET" },
        expect: (status) => ({
          ok: status === 404,
          detail: status === 404 ? "blocked" : `NOT blocked (${status})`,
        }),
      }),
    );
  }

  const nonData = [
    "shell",
    "api",
    "twilio",
    "precheck",
    "precheckAdmin",
    "connect",
    "recruit",
    "stats",
  ] as const;
  for (const svc of nonData) {
    results.push(
      await runProbe({
        name: `${svc} should block /api/masterlead/update-last-contacted`,
        url: `${SERVICES[svc]}/api/masterlead/update-last-contacted`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: "0000000000" }),
        },
        expect: (status) => ({
          ok: status === 404,
          detail: status === 404 ? "blocked" : `NOT blocked (${status})`,
        }),
      }),
    );
  }

  // Ensure Connect no longer serves data-heavy outbound leads route directly.
  results.push(
    await runProbe({
      name: "connect should block /api/outbound-dialer/leads",
      url: `${SERVICES.connect}/api/outbound-dialer/leads?userEmail=test%40aoglobelife.com`,
      init: { method: "GET" },
      expect: (status) => ({
        ok: status === 404,
        detail: status === 404 ? "blocked" : `NOT blocked (${status})`,
      }),
    }),
  );

  let pass = 0;
  let fail = 0;
  for (const result of results) {
    if (result.ok) pass += 1;
    else fail += 1;
    console.log(`${result.ok ? "✅" : "❌"} ${result.name} [${result.status}] - ${result.detail}`);
  }
  console.log("");
  console.log(`Checks: ${results.length}, Passed: ${pass}, Failed: ${fail}`);

  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

