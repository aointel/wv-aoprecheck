import { sweepStaleLeasedialerAgentQueues } from "../leasedialer-assignment-service";
import { leaseDialerPool } from "../db";

async function run() {
  const batchSize = Math.max(1, Number(process.argv[2] || 1000));
  const staleMinutes = Math.max(15, Number(process.argv[3] || 20));
  const noDialReclaimMinutes = Math.max(15, Number(process.argv[4] || 120));

  const result = await sweepStaleLeasedialerAgentQueues({
    batchSize,
    staleMinutes,
    noDialReclaimMinutes,
  });

  const reasonCounts = await leaseDialerPool.query(
    `
      SELECT release_reason, COUNT(*)::int AS count, MAX(updated_at) AS latest_updated_at
      FROM leasedialer_assignments
      WHERE updated_at >= NOW() - INTERVAL '30 minutes'
        AND release_reason IN (
          'idle_no_recent_dial_reclaim',
          'hourly_stale_queue_sweeper',
          'hourly_bad_queue_sweeper',
          'stale_lease_cleanup'
        )
      GROUP BY release_reason
      ORDER BY count DESC, release_reason ASC
    `,
  );

  console.log(
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        input: { batchSize, staleMinutes, noDialReclaimMinutes },
        sweepResult: result,
        releaseReasonsLast30m: reasonCounts.rows,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await leaseDialerPool.end().catch(() => undefined);
  });
