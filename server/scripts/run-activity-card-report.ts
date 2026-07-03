import { runChrisHierarchyActivityCardReport, runChrisHierarchyDryRun } from '../activity-card-delivery-service';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    const result = await runChrisHierarchyDryRun();
    console.log('Dry run complete:', result);
    return;
  }
  const result = await runChrisHierarchyActivityCardReport({ trigger: 'manual_script' });
  console.log('Run complete:', result);
}

main().catch((e) => {
  console.error('Activity card report run failed:', e);
  process.exit(1);
});

