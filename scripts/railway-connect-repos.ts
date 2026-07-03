/**
 * Railway API: Connect existing aoirail-* services to GitHub repo and set build/start config.
 * Run this after railway-setup-services (or if services exist but have no repo attached).
 *
 * Usage:
 *   RAILWAY_TOKEN=<token> npm run railway:connect-repos
 *   RAILWAY_TOKEN=<token> GITHUB_REPO=owner/repo GITHUB_BRANCH=main npm run railway:connect-repos
 *
 * Env vars:
 *   RAILWAY_TOKEN - required (Account or Workspace token)
 *   RAILWAY_PROJECT_ID - optional (uses first AOI project if unset)
 *   GITHUB_REPO - optional (default: mmandella/PolicyVerify from package.json)
 *   GITHUB_BRANCH - optional (default: main)
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

interface ServiceConfig {
  rootDirectory: string;
  buildCommand: string;
  startCommand: string;
}

const SERVICE_CONFIG: Record<(typeof SECTION_SERVICES)[number], ServiceConfig> = {
  shell: { rootDirectory: 'apps/shell', buildCommand: 'npm run build', startCommand: 'npm run start' },
  api: { rootDirectory: 'apps/api', buildCommand: 'npm run build', startCommand: 'npm run start' },
  twilio: { rootDirectory: 'apps/twilio', buildCommand: 'npm run build', startCommand: 'npm run start' },
  data: { rootDirectory: 'apps/data', buildCommand: 'npm run build', startCommand: 'npm run start' },
  precheck: { rootDirectory: 'apps/precheck', buildCommand: 'npm run build', startCommand: 'npm run start' },
  'precheck-admin': { rootDirectory: 'apps/precheck-admin', buildCommand: 'npm run build', startCommand: 'npm run start' },
  connect: { rootDirectory: 'apps/connect', buildCommand: 'npm run build', startCommand: 'npm run start' },
  recruit: { rootDirectory: 'apps/recruit', buildCommand: 'npm run build', startCommand: 'npm run start' },
  stats: { rootDirectory: 'apps/stats', buildCommand: 'npm run build', startCommand: 'npm run start' },
  'campaign-manager': {
    rootDirectory: 'apps/campaign-manager',
    buildCommand: 'npm ci --include=dev && npm run build',
    startCommand: 'npm start',
  },
  leadsync: {
    rootDirectory: 'apps/leadsync',
    buildCommand: 'npm ci',
    startCommand: 'npm start',
  },
};

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
interface ProjectWithServicesResult {
  project: {
    id: string;
    name: string;
    baseEnvironmentId?: string;
    services: { edges: Array<{ node: { id: string; name: string } }> };
  };
}
interface EnvsResult {
  environments: { edges: Array<{ node: { id: string; name: string } }> };
}
interface ServiceConnectResult {
  serviceConnect: { id: string };
}
interface ServiceInstanceUpdateResult {
  serviceInstanceUpdate: unknown;
}

async function main() {
  const token = process.env.RAILWAY_TOKEN;
  if (!token) {
    console.error('Set RAILWAY_TOKEN (Account or Workspace token from https://railway.com/account/tokens)');
    process.exit(1);
  }

  const repo = process.env.GITHUB_REPO ?? 'mmandella/PolicyVerify';
  const branch = process.env.GITHUB_BRANCH ?? 'main';
  let projectId = process.env.RAILWAY_PROJECT_ID;

  if (!projectId) {
    const data = await gql<ProjectsResult>(token, `
      query { projects(first: 20) { edges { node { id name } } } }
    `);
    const projects = data.projects?.edges?.map((e) => e.node) ?? [];
    if (projects.length === 0) {
      console.error('No projects found. Set RAILWAY_PROJECT_ID or create a project first.');
      process.exit(1);
    }
    const chosen = projects.find((p) => p.name.toLowerCase().includes('aoi')) ?? projects[0];
    projectId = chosen.id;
    console.log(`Using project: ${chosen.name} (${chosen.id})`);
  }

  const proj = await gql<ProjectWithServicesResult>(token, `
    query($id: String!) {
      project(id: $id) {
        id
        name
        baseEnvironmentId
        services(first: 100) { edges { node { id name } } }
      }
    }
  `, { id: projectId });

  const project = proj.project;
  if (!project) {
    console.error('Project not found');
    process.exit(1);
  }

  let environmentId = project.baseEnvironmentId;
  if (!environmentId) {
    const envs = await gql<EnvsResult>(token, `
      query($projectId: String!) { environments(projectId: $projectId, first: 5) { edges { node { id name } } } }
    `, { projectId: project.id });
    const firstEnv = envs.environments?.edges?.[0]?.node;
    if (!firstEnv) {
      console.error('Project has no environment.');
      process.exit(1);
    }
    environmentId = firstEnv.id;
    console.log(`Using environment: ${firstEnv.name} (${environmentId})`);
  }

  const services = project.services?.edges?.map((e) => e.node) ?? [];
  const aoirailServices = services.filter((s) => s.name.startsWith('aoirail-'));

  if (aoirailServices.length === 0) {
    console.error('No aoirail-* services found. Run npm run railway:setup-services first.');
    process.exit(1);
  }

  console.log(`Connecting to repo: ${repo} (branch: ${branch})`);
  console.log('');

  for (const svc of aoirailServices) {
    const sectionName = svc.name.replace('aoirail-', '') as (typeof SECTION_SERVICES)[number];
    const config = SERVICE_CONFIG[sectionName];
    if (!config) {
      console.warn(`  Skipping ${svc.name} (no config)`);
      continue;
    }

    try {
      await gql<ServiceConnectResult>(token, `
        mutation($id: String!, $input: ServiceConnectInput!) {
          serviceConnect(id: $id, input: $input) { id }
        }
      `, {
        id: svc.id,
        input: { repo, branch },
      });
      console.log(`  ${svc.name}: connected to ${repo}`);
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (msg.includes('already connected') || msg.includes('Connected')) {
        console.log(`  ${svc.name}: already connected`);
      } else {
        console.warn(`  ${svc.name}: connect failed - ${msg}`);
        continue;
      }
    }

    try {
      await gql<ServiceInstanceUpdateResult>(token, `
        mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
          serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
        }
      `, {
        serviceId: svc.id,
        environmentId,
        input: {
          rootDirectory: config.rootDirectory,
          buildCommand: config.buildCommand,
          startCommand: config.startCommand,
        },
      });
      console.log(`  ${svc.name}: root=${config.rootDirectory}, build/start configured`);
    } catch (e: unknown) {
      console.warn(`  ${svc.name}: instance update failed -`, (e as Error).message);
    }

    console.log('');
  }

  console.log('Done. Services are connected and configured.');
  console.log('Railway will deploy on next push to', branch);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
