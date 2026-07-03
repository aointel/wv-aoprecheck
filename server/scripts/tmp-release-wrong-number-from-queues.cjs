const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const apply = process.argv.includes("--apply");

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();

  try {
    const preview = await client.query(
      `
        SELECT
          COUNT(*)::int AS assignments_to_release,
          COUNT(DISTINCT lower(la.agent_email))::int AS impacted_agents
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE la.status IN ('queued', 'active')
          AND lower(trim(COALESCE(ml.cnresolution, ''))) = 'wrong_number'
      `,
    );

    const output = {
      mode: apply ? "apply" : "dry-run",
      preview: preview.rows[0] || { assignments_to_release: 0, impacted_agents: 0 },
      applied: false,
      released_rows: 0,
      queue_count_rows_updated: 0,
    };

    if (!apply) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    await client.query("BEGIN");

    const releaseResult = await client.query(
      `
        WITH released AS (
          UPDATE leasedialer_assignments la
          SET
            status = 'released',
            released_at = NOW(),
            release_reason = 'wrong_number_cleanup',
            updated_at = NOW()
          FROM masterlead ml
          WHERE ml.id = la.lead_id
            AND la.status IN ('queued', 'active')
            AND lower(trim(COALESCE(ml.cnresolution, ''))) = 'wrong_number'
          RETURNING lower(la.agent_email) AS agent_email
        ),
        impacted AS (
          SELECT DISTINCT agent_email
          FROM released
        ),
        recalculated AS (
          UPDATE leasedialer_client_status lcs
          SET
            local_leased_lead_count = q.queued_count,
            updated_at = NOW()
          FROM (
            SELECT
              i.agent_email,
              COALESCE(COUNT(*) FILTER (WHERE la.status = 'queued'), 0)::int AS queued_count
            FROM impacted i
            LEFT JOIN leasedialer_assignments la
              ON lower(la.agent_email) = i.agent_email
            GROUP BY i.agent_email
          ) q
          WHERE lower(lcs.agent_email) = q.agent_email
          RETURNING lcs.agent_email
        )
        SELECT
          (SELECT COUNT(*)::int FROM released) AS released_rows,
          (SELECT COUNT(*)::int FROM recalculated) AS queue_count_rows_updated
      `,
    );

    await client.query("COMMIT");

    output.applied = true;
    output.released_rows = Number(releaseResult.rows[0]?.released_rows || 0);
    output.queue_count_rows_updated = Number(releaseResult.rows[0]?.queue_count_rows_updated || 0);
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
