import { getOrCreatePermanentHierarchyLink, rebuildSnapshotForManager } from '../public-live-card-service';

async function run(): Promise<void> {
  const managerEmail = String(process.argv[2] || 'chrislafond@aoglobelife.com').toLowerCase().trim();
  if (!managerEmail.includes('@')) {
    throw new Error('Usage: tsx server/scripts/seed-public-live-card-link.ts <manager_email>');
  }

  const link = await getOrCreatePermanentHierarchyLink(managerEmail);
  await rebuildSnapshotForManager(link.managerEmail);

  const base = process.env.BASE_URL || process.env.PUBLIC_BASE_URL || 'https://aoirail-production.up.railway.app';
  const vanityPath = `/${link.vanitySlug || link.token}`;
  const fallbackPath = `/live/${link.token}`;
  const url = `${base.replace(/\/$/, '')}${vanityPath}`;
  console.log(JSON.stringify({
    managerEmail: link.managerEmail,
    managerName: link.managerName,
    scopeKey: link.scopeKey,
    token: link.token,
    vanitySlug: link.vanitySlug,
    urlPath: vanityPath,
    fallbackUrlPath: fallbackPath,
    fullUrl: url,
  }, null, 2));
}

run().catch((error) => {
  console.error('❌ Failed to seed public live card link:', error);
  process.exit(1);
});

