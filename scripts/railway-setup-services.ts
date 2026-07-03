/**
 * Railway API: create one service per section (Shell, API, Twilio, Precheck, etc.).
 * Uses Railway default domains (*.up.railway.app). Optionally set DOMAIN_PARENT to add custom domains.
 *
 * Usage:
 *   RAILWAY_TOKEN=<your-token> npm run railway:setup-services
 *   RAILWAY_TOKEN=<token> DOMAIN_PARENT=aoiglobe.com npm run railway:setup-services  # also add custom domains
 *
 * Get token: https://railway.com/account/tokens (Account or Workspace token).
 */

const RAILWAY_GRAPHQL = 'https://backboard.railway.com/graphql/v2';

const SECTION_SERVICES = [
  'shell',
  'api',
  'twilio',
  'data',
  'precheck',
  'precheck-admin',
  'connect',
  'recruit',
  'stats',
  'campaign-manager',
  'leadsync',
] as const;

async function gql<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(RAILWAY_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Railway API ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  if (!json.data) throw new Error('No data in response');
  return json.data as T;
}

interface ProjectsResult {
  projects: { edges: Array<{ node: { id: string; name: string } }> };
}
interface ProjectResult {
  project: {
    id: string;
    name: string;
    baseEnvironmentId?: string;
    services?: { edges: Array<{ node: { id: string; name: string } }> };
  };
}
interface EnvsResult {
  environments: { edges: Array<{ node: { id: string; name: string } }> };
}
interface ServiceCreateResult {
  serviceCreate: { id: string; name: string };
}
interface CustomDomainResult {
  customDomainCreate: { id: string; domain: string };
}

async function main() {
  const token = process.env.RAILWAY_TOKEN;
  if (!token) {
    console.error('Set RAILWAY_TOKEN (Account or Workspace token from https://railway.com/account/tokens)');
    process.exit(1);
  }

  const projectId = process.env.RAILWAY_PROJECT_ID;
  const domainParent = process.env.DOMAIN_PARENT ?? ''; // empty = Railway domains only (*.up.railway.app)

  let resolvedProjectId = projectId;
  let environmentId: string;

  if (!resolvedProjectId) {
    const data = await gql<ProjectsResult>(token, `
      query { projects(first: 20) { edges { node { id name } } } }
    `);
    const projects = data.projects?.edges?.map((e) => e.node) ?? [];
    if (projects.length === 0) {
      console.error('No projects found. Create a project in Railway first or set RAILWAY_PROJECT_ID.');
      process.exit(1);
    }
    const chosen = projects.find((p) => p.name.toLowerCase().includes('aoi')) ?? projects[0];
    resolvedProjectId = chosen.id;
    console.log(`Using project: ${chosen.name} (${chosen.id})`);
  }

  const proj = await gql<ProjectResult>(token, `
    query($id: String!) {
      project(id: $id) {
        id
        name
        baseEnvironmentId
        services(first: 100) { edges { node { id name } } }
      }
    }
  `, { id: resolvedProjectId });
  const existingServiceNames = new Set(
    (proj.project?.services?.edges ?? []).map((e) => e.node.name)
  );

  if (!proj.project?.baseEnvironmentId) {
    const envs = await gql<EnvsResult>(token, `
      query($projectId: String!) { environments(projectId: $projectId, first: 5) { edges { node { id name } } } }
    `, { projectId: resolvedProjectId });
    const firstEnv = envs.environments?.edges?.[0]?.node;
    if (!firstEnv) {
      console.error('Project has no environment.');
      process.exit(1);
    }
    environmentId = firstEnv.id;
    console.log(`Using environment: ${firstEnv.name} (${environmentId})`);
  } else {
    environmentId = proj.project.baseEnvironmentId;
    console.log(`Using base environment: ${environmentId}`);
  }

  const created: Array<{ name: string; id: string }> = [];

  for (const name of SECTION_SERVICES) {
    const fullName = `aoirail-${name}`;
    if (existingServiceNames.has(fullName)) {
      console.log(`Skip (exists): ${fullName}`);
      continue;
    }

    let svc: { id: string; name: string };
    try {
      const res = await gql<ServiceCreateResult>(token, `
        mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id name } }
      `, {
        input: {
          projectId: resolvedProjectId,
          name: fullName,
        },
      });
      svc = res.serviceCreate;
    } catch (e: unknown) {
      const msg = (e as Error).message ?? String(e);
      if (/already|exist|duplicate|unique|taken/i.test(msg)) {
        console.log(`Skip (API): ${fullName} — ${msg}`);
        continue;
      }
      throw e;
    }
    existingServiceNames.add(svc.name);
    created.push({ name: svc.name, id: svc.id });
    console.log(`Created service: ${svc.name} (${svc.id})`);

    if (domainParent) {
      const subdomain = name === 'precheck-admin' ? 'precheck-admin' : name;
      const domain = `${subdomain}.${domainParent}`;
      try {
        const domainRes = await gql<CustomDomainResult>(token, `
          mutation($input: CustomDomainCreateInput!) { customDomainCreate(input: $input) { id domain } }
        `, {
          input: {
            projectId: resolvedProjectId,
            environmentId,
            serviceId: svc.id,
            domain,
          },
        });
        console.log(`  Domain: ${domainRes.customDomainCreate.domain}`);
      } catch (e: unknown) {
        console.warn(`  Domain ${domain} skipped:`, (e as Error).message);
      }
    }
  }

  console.log('\nDone. Created this run:');
  if (created.length === 0) {
    console.log('  (none — every aoirail-* service already existed)');
  } else {
    created.forEach((c) => console.log(`  ${c.name}: ${c.id}`));
  }
  console.log('\nUse Railway default URLs (e.g. https://aoirail-shell-production.up.railway.app).');
  console.log('Next: npm run railway:connect-repos (same RAILWAY_TOKEN) to attach repo + rootDirectory/build/start.');
  console.log('Optional: root railway.campaign-manager.json / railway.leadsync.json mirror apps/*/railway.json for copy-paste.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
